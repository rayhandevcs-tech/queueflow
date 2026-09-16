#!/usr/bin/env bash
#
# Sprint 11 polish — the platform loyalty default, and per-shop service styles.
#
#   bash supabase/tests/run-sprint11-polish-checks.sh
#
# Two migrations are under test, and between them they make four claims that
# are worth more than a code read:
#
#   20260928_platform_settings.sql
#     · only a SUPER_ADMIN can move the platform default
#     · a NEW shop starts at that default, an EXISTING shop keeps its own
#     · not one historical ledger row changes when the default moves
#
#   20260929_service_styles.sql
#     · shop B cannot see into, add to, reorder or delete shop A's style list
#     · a customer can read a style list but cannot create one
#     · a customer's past pick survives the catalogue being renamed, and
#       survives the style being deleted outright
#
# The last one is the reason this file exists. Before 20260929 the pick was a
# bare foreign key with ON DELETE CASCADE, so renaming a style rewrote history
# and deleting one erased it. "Preserved" is a claim about what happens after a
# destructive edit, and the only way to check it is to make the edit.
#
# `serial_style_preferences` and the `hairstyles` catalogue are built by running
# the REAL 20260914 migration, not a stand-in, because both migrations under
# test alter it. What IS a stand-in is the surrounding baseline — profiles,
# shops, services, serials, the admin identity helpers and loyalty_settings —
# shaped to match production and documented inline where it matters. So a green
# run means "these two migrations are sound against a schema shaped like the
# real one", NOT "they will apply to production".
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PORT=5613
DIR=$(mktemp -d /tmp/qf-s11polish-XXXXXX)
PGBIN=/usr/lib/postgresql/16/bin
RUNAS=${RUNAS:-postgres}

pass=0; fail=0
check() {
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s (expected [%s], got [%s])\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}
cleanup() {
  su "$RUNAS" -s /bin/bash -c "$PGBIN/pg_ctl -D $DIR/data stop -m immediate" >/dev/null 2>&1
  rm -rf "$DIR"
}
trap cleanup EXIT

chown -R "$RUNAS" "$DIR"
su "$RUNAS" -s /bin/bash -c "$PGBIN/initdb -D $DIR/data -U postgres --auth=trust" >/dev/null 2>&1 \
  || { echo "initdb failed — is postgresql-16 installed, and does user '$RUNAS' exist?"; exit 1; }
su "$RUNAS" -s /bin/bash -c "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/pg.log start" >/dev/null 2>&1
sleep 2
su "$RUNAS" -s /bin/bash -c "$PGBIN/createdb -h $DIR -p $PORT -U postgres qf" || exit 1

Q()  { su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$1\"" 2>&1 | head -1; }
FILE(){ su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -v ON_ERROR_STOP=1 -q -f $1"; }
# A real non-superuser role. A superuser bypasses RLS entirely and would report
# every isolation check below as a pass no matter what the policies said.
AS() { su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=authenticated -c test.uid=$1' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$2\"" 2>&1 | head -1; }

echo "== fixture =="
cat > "$DIR/fixture.sql" <<'SQL'
create extension if not exists pgcrypto;
create schema if not exists auth;
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  role text not null default 'customer'
);
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null,
  business_type text not null default 'SALON'
);
create table public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  rate numeric(10,2) not null default 0,
  is_active boolean not null default true
);
-- Enough of `serials` for 20260914's FK and for the "nothing was touched"
-- check. `updated_at` is present because the real table has it.
create table public.serials (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.profiles(id),
  status text not null default 'WAITING',
  updated_at timestamptz not null default now()
);

create or replace function public.is_shop_owner(p_shop_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from public.shops where id = p_shop_id and owner_id = auth.uid()) $$;

-- The baseline's shared updated_at trigger function; 20260914 attaches it to
-- serial_style_preferences, so it has to exist before that migration runs.
create or replace function public.set_updated_at() returns trigger
 language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- The admin identity trio, same shape and same security mode as 20260901.
create table public.admin_users (
  user_id uuid primary key,
  level text not null check (level in ('SUPER_ADMIN','MODERATOR','SUPPORT')),
  status text not null default 'ACTIVE'
);
create or replace function public.is_platform_admin() returns boolean
 language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid() and status='ACTIVE') $$;
create or replace function public.admin_level() returns text
 language sql stable security definer set search_path = public
as $$ select level from public.admin_users where user_id = auth.uid() and status='ACTIVE' $$;
create or replace function public.admin_can(p_permission text) returns boolean
 language sql stable security definer set search_path = public
as $$
  select case public.admin_level()
    when 'SUPER_ADMIN' then true
    when 'MODERATOR'   then p_permission in ('shops.review','shops.status','users.moderate','reports.resolve','support.handle')
    when 'SUPPORT'     then p_permission in ('support.handle')
    else false end;
$$;
create table public.admin_audit_log (
  id bigserial primary key, action text not null, meta jsonb, created_at timestamptz default now()
);
create or replace function public.admin_log(p_action text, p_a uuid, p_b uuid, p_meta jsonb)
 returns void language sql security definer set search_path = public
as $$ insert into public.admin_audit_log (action, meta) values (p_action, p_meta) $$;

-- loyalty_settings and the ledger, copied from 20260922's shape. The default of
-- 100 on taka_per_point is the thing 20260928 removes, so it has to be here.
create table public.loyalty_settings (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  is_enabled boolean not null default false,
  taka_per_point integer not null default 100 check (taka_per_point between 1 and 100000),
  min_bill_taka numeric(10,2) not null default 0 check (min_bill_taka >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.loyalty_settings enable row level security;
create policy "loyalty_settings: owner manage" on public.loyalty_settings for all
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));
create table public.loyalty_transactions (
  id bigserial primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.profiles(id),
  points integer not null,
  bill_amount numeric(10,2),
  taka_per_point integer,
  created_at timestamptz not null default now()
);

-- Supabase's own API roles, by their real names. Several policies in the
-- migrations under test are written `to authenticated`, and a policy scoped to
-- a role does nothing for a session that is not a member of it — so borrowing a
-- generic `app_user` here would have quietly skipped them. Running as
-- `authenticated` is also simply what production does.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
grant usage on schema public, auth to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
SQL
FILE "$DIR/fixture.sql" >/dev/null || { echo "fixture failed"; exit 1; }

echo "== applying the real 20260914 (hairstyles + serial_style_preferences) =="
FILE "$ROOT/supabase/migrations/20260914_hairstyle_catalogue.sql" >"$DIR/m14.log" 2>&1 \
  || { echo "20260914 failed:"; cat "$DIR/m14.log"; exit 1; }
Q "grant select, insert, update, delete on all tables in schema public to authenticated" >/dev/null

# ---- people and things ----------------------------------------------------
OWNER_A=$(Q "insert into public.profiles (full_name, role) values ('Owner A','provider') returning id")
OWNER_B=$(Q "insert into public.profiles (full_name, role) values ('Owner B','provider') returning id")
CUST=$(Q   "insert into public.profiles (full_name) values ('Customer') returning id")
SUPER=$(Q  "insert into public.profiles (full_name) values ('Super') returning id")
MOD=$(Q    "insert into public.profiles (full_name) values ('Mod') returning id")
Q "insert into public.admin_users (user_id, level) values ('$SUPER','SUPER_ADMIN')" >/dev/null
Q "insert into public.admin_users (user_id, level) values ('$MOD','MODERATOR')" >/dev/null
SHOP_A=$(Q "insert into public.shops (owner_id, name) values ('$OWNER_A','A') returning id")
SHOP_B=$(Q "insert into public.shops (owner_id, name) values ('$OWNER_B','B') returning id")
SVC_A=$(Q  "insert into public.services (shop_id, name, rate) values ('$SHOP_A','Haircut',300) returning id")
SVC_B=$(Q  "insert into public.services (shop_id, name, rate) values ('$SHOP_B','Haircut',300) returning id")
SER=$(Q    "insert into public.serials (shop_id, customer_id) values ('$SHOP_A','$CUST') returning id")
NEWSTYLE() { Q "insert into public.hairstyles (kind, slug, name_bn, name_en, description_bn, description_en, suits_notes_en) values ('HAIR','$1','$2','$3','d','d','n') returning id"; }
# 20260914 does not just create the catalogue, it SEEDS it — so a fixture that
# invents 'undercut' collides with the real row and hands back an error string
# where a uuid was expected. Namespacing the test's own styles keeps this file
# working no matter what the seed grows to.
CLASSIC=$(NEWSTYLE zz-test-classic 'ক্লাসিক' 'Classic Cut')
LOWFADE=$(NEWSTYLE zz-test-low-fade 'লো ফেড' 'Low Fade')
MIDFADE=$(NEWSTYLE zz-test-mid-fade 'মিড ফেড' 'Mid Fade')
UNDERCUT=$(NEWSTYLE zz-test-undercut 'আন্ডারকাট' 'Undercut')
for v in "$CLASSIC" "$LOWFADE" "$MIDFADE" "$UNDERCUT"; do
  case "$v" in *ERROR*|"") echo "fixture: a test style failed to insert: $v"; exit 1;; esac
done

# An old ledger row, written before anything below happens.
Q "insert into public.loyalty_transactions (shop_id, customer_id, points, bill_amount, taka_per_point) values ('$SHOP_A','$CUST',3,300,100)" >/dev/null
LEDGER_BEFORE=$(Q "select md5(string_agg(id||':'||points||':'||coalesce(taka_per_point,0), ',' order by id)) from public.loyalty_transactions")

echo
echo "== A. platform_settings — structure =="
FILE "$ROOT/supabase/migrations/20260928_platform_settings.sql" >"$DIR/m28.log" 2>&1
check "A1 20260928 applied cleanly" "" "$(grep -oE 'ERROR|FATAL' "$DIR/m28.log" | head -1)"
check "A2 exactly one row" "1" "$(Q "select count(*) from public.platform_settings")"
check "A3 it starts at 100" "100" "$(Q "select loyalty_taka_per_point from public.platform_settings")"
check "A4 RLS is on" "t" "$(Q "select relrowsecurity from pg_class where oid='public.platform_settings'::regclass")"
check "A5 a read policy exists" "1" "$(Q "select count(*) from pg_policies where tablename='platform_settings' and cmd='SELECT'")"
check "A6 **no write policy for anybody**" "0" "$(Q "select count(*) from pg_policies where tablename='platform_settings' and cmd in ('INSERT','UPDATE','DELETE','ALL')")"
check "A7 the singleton cannot be duplicated" "duplicate key" \
  "$(Q "insert into public.platform_settings (id) values (true)" | grep -o 'duplicate key')"
check "A8 the RPC is SECURITY DEFINER" "t" "$(Q "select prosecdef from pg_proc where proname='admin_set_loyalty_default'")"
check "A9 its search_path is pinned" "t" "$(Q "select proconfig::text like '%search_path%' from pg_proc where proname='admin_set_loyalty_default'")"
check "A10 taka_per_point lost its column default" "t" \
  "$(Q "select column_default is null from information_schema.columns where table_name='loyalty_settings' and column_name='taka_per_point'")"
check "A11 the fill trigger is installed" "1" \
  "$(Q "select count(*) from pg_trigger where tgname='zz_loyalty_settings_default_rate' and not tgisinternal")"

echo
echo "== B. platform_settings — who may change it =="
check "B1 **a customer cannot**" "not authorised" \
  "$(AS "$CUST" "select public.admin_set_loyalty_default(50)" | grep -o 'not authorised')"
check "B2 **a shop owner cannot**" "not authorised" \
  "$(AS "$OWNER_A" "select public.admin_set_loyalty_default(50)" | grep -o 'not authorised')"
check "B3 **a MODERATOR cannot** (platform.settings is SUPER_ADMIN-only)" "not authorised" \
  "$(AS "$MOD" "select public.admin_set_loyalty_default(50)" | grep -o 'not authorised')"
check "B4 a caller with no identity at all cannot" "not authorised" \
  "$(AS "" "select public.admin_set_loyalty_default(50)" | grep -o 'not authorised')"
check "B5 the value did not move through any of that" "100" \
  "$(Q "select loyalty_taka_per_point from public.platform_settings")"
check "B6 a customer cannot UPDATE the table directly either" "0" \
  "$(AS "$CUST" "update public.platform_settings set loyalty_taka_per_point = 1 where id" | grep -oE '^UPDATE 0$' | grep -o 0)"
check "B7 ...and a shop owner cannot" "0" \
  "$(AS "$OWNER_A" "update public.platform_settings set loyalty_taka_per_point = 1 where id" | grep -oE '^UPDATE 0$' | grep -o 0)"
check "B8 still 100" "100" "$(Q "select loyalty_taka_per_point from public.platform_settings")"
check "B9 **a SUPER_ADMIN can**" "50" "$(AS "$SUPER" "select public.admin_set_loyalty_default(50)")"
check "B10 and it stuck" "50" "$(Q "select loyalty_taka_per_point from public.platform_settings")"
check "B11 the change was audited" "1" \
  "$(Q "select count(*) from public.admin_audit_log where action='platform.loyalty_default'")"
check "B12 zero is refused" "out of range" \
  "$(AS "$SUPER" "select public.admin_set_loyalty_default(0)" | grep -o 'out of range')"
check "B13 a negative is refused" "out of range" \
  "$(AS "$SUPER" "select public.admin_set_loyalty_default(-5)" | grep -o 'out of range')"
check "B14 absurdly large is refused" "out of range" \
  "$(AS "$SUPER" "select public.admin_set_loyalty_default(100001)" | grep -o 'out of range')"
check "B15 null is refused" "required" \
  "$(AS "$SUPER" "select public.admin_set_loyalty_default(null)" | grep -o 'required')"
check "B16 none of the rejects moved the value" "50" \
  "$(Q "select loyalty_taka_per_point from public.platform_settings")"

echo
echo "== C. the default reaches a NEW shop and spares an OLD one =="
# Shop A configured itself back when the default was 100.
Q "insert into public.loyalty_settings (shop_id, is_enabled, taka_per_point) values ('$SHOP_A', true, 100)" >/dev/null
check "C1 shop A is on 100 by its own choice" "100" \
  "$(Q "select taka_per_point from public.loyalty_settings where shop_id='$SHOP_A'")"
# Shop B configures itself now, without naming a rate.
Q "insert into public.loyalty_settings (shop_id, is_enabled) values ('$SHOP_B', true)" >/dev/null
check "C2 **shop B picked up the platform default of 50**" "50" \
  "$(Q "select taka_per_point from public.loyalty_settings where shop_id='$SHOP_B'")"
check "C3 **shop A was not touched by the admin's change**" "100" \
  "$(Q "select taka_per_point from public.loyalty_settings where shop_id='$SHOP_A'")"
# And a shop that names its own rate still gets it, default or no default.
Q "update public.loyalty_settings set taka_per_point = 200 where shop_id='$SHOP_B'" >/dev/null
check "C4 a shop can still override the default" "200" \
  "$(Q "select taka_per_point from public.loyalty_settings where shop_id='$SHOP_B'")"
check "C5 **not one historical ledger row changed**" "$LEDGER_BEFORE" \
  "$(Q "select md5(string_agg(id||':'||points||':'||coalesce(taka_per_point,0), ',' order by id)) from public.loyalty_transactions")"
check "C6 the old row still records the rate it was earned under" "100" \
  "$(Q "select taka_per_point from public.loyalty_transactions order by id limit 1")"
check "C7 an owner still cannot touch another shop's settings" "0" \
  "$(AS "$OWNER_B" "update public.loyalty_settings set taka_per_point = 7 where shop_id='$SHOP_A'" | grep -oE '^UPDATE 0$' | grep -o 0)"
check "C8 ...and shop A is unchanged" "100" \
  "$(Q "select taka_per_point from public.loyalty_settings where shop_id='$SHOP_A'")"

echo
echo "== D. service_styles — structure =="
FILE "$ROOT/supabase/migrations/20260929_service_styles.sql" >"$DIR/m29.log" 2>&1
check "D1 20260929 applied cleanly" "" "$(grep -oE 'ERROR|FATAL' "$DIR/m29.log" | head -1)"
Q "grant select, insert, update, delete on public.service_styles to authenticated" >/dev/null
check "D2 RLS is on" "t" "$(Q "select relrowsecurity from pg_class where oid='public.service_styles'::regclass")"
check "D3 four policies" "4" "$(Q "select count(*) from pg_policies where tablename='service_styles'")"
check "D4 **no shop_id column** — isolation comes from the service" "f" \
  "$(Q "select exists (select 1 from information_schema.columns where table_name='service_styles' and column_name='shop_id')")"
check "D5 composite primary key" "t" \
  "$(Q "select exists (select 1 from pg_constraint where conrelid='public.service_styles'::regclass and contype='p')")"
check "D6 a style cannot be offered twice for one service" "duplicate key" \
  "$(Q "insert into public.service_styles (service_id, hairstyle_id) values ('$SVC_A','$CLASSIC'), ('$SVC_A','$CLASSIC')" | grep -o 'duplicate key')"

echo
echo "== E. service_styles — shop isolation =="
check "E1 **owner A can offer styles on its own service**" "INSERT 0 3" \
  "$(AS "$OWNER_A" "insert into public.service_styles (service_id, hairstyle_id, sort_order) values ('$SVC_A','$CLASSIC',0),('$SVC_A','$LOWFADE',1),('$SVC_A','$MIDFADE',2)")"
check "E2 **owner B cannot add to shop A's service**" "violates row-level security" \
  "$(AS "$OWNER_B" "insert into public.service_styles (service_id, hairstyle_id) values ('$SVC_A','$UNDERCUT')" | grep -o 'violates row-level security')"
check "E3 **owner B cannot reorder shop A's list**" "0" \
  "$(AS "$OWNER_B" "update public.service_styles set sort_order = 99 where service_id='$SVC_A'" | grep -oE '^UPDATE 0$' | grep -o 0)"
check "E4 **owner B cannot delete from shop A's list**" "0" \
  "$(AS "$OWNER_B" "delete from public.service_styles where service_id='$SVC_A'" | grep -oE '^DELETE 0$' | grep -o 0)"
check "E5 shop A's list is intact after all three attempts" "3" \
  "$(Q "select count(*) from public.service_styles where service_id='$SVC_A'")"
check "E6 ...and still in shop A's own order" "0" \
  "$(Q "select min(sort_order) from public.service_styles where service_id='$SVC_A'")"
# Note the different shape of refusal, which is the point of splitting the
# policies per command. E3/E4 are `using` failures — the rows are invisible to
# owner B, so the statement legally matches nothing and reports UPDATE 0. This
# one is a `with check` failure: owner A may see the row, so it is not hidden,
# but the row they are trying to WRITE belongs to shop B. That is refused
# loudly, and it has to be: silently dropping a cross-tenant write would look
# to the caller like it had worked.
check "E7 **owner A cannot move a row onto shop B's service**" "violates row-level security" \
  "$(AS "$OWNER_A" "update public.service_styles set service_id='$SVC_B' where service_id='$SVC_A'" | grep -o 'violates row-level security')"
check "E7b ...and shop A's rows stayed on shop A's service" "3" \
  "$(Q "select count(*) from public.service_styles where service_id='$SVC_A'")"
check "E7c ...and nothing landed on shop B's service" "0" \
  "$(Q "select count(*) from public.service_styles where service_id='$SVC_B'")"
check "E8 **a customer cannot create a style offering**" "violates row-level security" \
  "$(AS "$CUST" "insert into public.service_styles (service_id, hairstyle_id) values ('$SVC_A','$UNDERCUT')" | grep -o 'violates row-level security')"
check "E9 a customer CAN read the list (needed before booking)" "3" \
  "$(AS "$CUST" "select count(*) from public.service_styles where service_id='$SVC_A'")"
# Shop B offers a different list — the requirement that started all this.
AS "$OWNER_B" "insert into public.service_styles (service_id, hairstyle_id, sort_order) values ('$SVC_B','$CLASSIC',0),('$SVC_B','$UNDERCUT',1)" >/dev/null
check "E10 **shop B's haircut offers a different list**" "Classic Cut,Undercut" \
  "$(AS "$CUST" "select string_agg(h.name_en, ',' order by ss.sort_order) from public.service_styles ss join public.hairstyles h on h.id=ss.hairstyle_id where ss.service_id='$SVC_B'")"
check "E11 ...and shop A's is still its own" "Classic Cut,Low Fade,Mid Fade" \
  "$(AS "$CUST" "select string_agg(h.name_en, ',' order by ss.sort_order) from public.service_styles ss join public.hairstyles h on h.id=ss.hairstyle_id where ss.service_id='$SVC_A'")"
check "E12 a service with no styles configured returns an empty list, not an error" "0" \
  "$(AS "$CUST" "select count(*) from public.service_styles where service_id = gen_random_uuid()")"

echo
echo "== F. a customer's pick outlives the shop changing its mind =="
SERIAL_BEFORE=$(Q "select updated_at from public.serials where id='$SER'")
check "F1 the customer records a pick" "INSERT 0 1" \
  "$(AS "$CUST" "insert into public.serial_style_preferences (serial_id, hairstyle_id, note) values ('$SER','$LOWFADE','একটু ছোট করে')")"
check "F2 **the name was snapshotted automatically**" "Low Fade" \
  "$(Q "select style_name_en from public.serial_style_preferences where serial_id='$SER'")"
check "F3 ...in Bangla too" "লো ফেড" \
  "$(Q "select style_name_bn from public.serial_style_preferences where serial_id='$SER'")"
# The catalogue gets renamed under them.
Q "update public.hairstyles set name_en='Low Taper Fade', name_bn='লো টেপার ফেড' where id='$LOWFADE'" >/dev/null
check "F4 **renaming the catalogue does NOT rewrite what the customer asked for**" "Low Fade" \
  "$(Q "select style_name_en from public.serial_style_preferences where serial_id='$SER'")"
# The shop stops offering it.
AS "$OWNER_A" "delete from public.service_styles where service_id='$SVC_A' and hairstyle_id='$LOWFADE'" >/dev/null
check "F5 the shop withdrew it from the service" "2" \
  "$(Q "select count(*) from public.service_styles where service_id='$SVC_A'")"
check "F6 **the customer's record survives the withdrawal**" "Low Fade" \
  "$(Q "select style_name_en from public.serial_style_preferences where serial_id='$SER'")"
# The admin deletes it from the catalogue entirely — this used to CASCADE the
# customer's row out of existence.
Q "delete from public.hairstyles where id='$LOWFADE'" >/dev/null
check "F7 **the row still exists after the style is deleted outright**" "1" \
  "$(Q "select count(*) from public.serial_style_preferences where serial_id='$SER'")"
check "F8 **and still says what they asked for**" "Low Fade" \
  "$(Q "select style_name_en from public.serial_style_preferences where serial_id='$SER'")"
check "F9 the dangling link was set to null, not left broken" "t" \
  "$(Q "select hairstyle_id is null from public.serial_style_preferences where serial_id='$SER'")"
check "F10 the customer's own note is untouched" "একটু ছোট করে" \
  "$(Q "select note from public.serial_style_preferences where serial_id='$SER'")"
check "F11 the delete rule really is SET NULL" "n" \
  "$(Q "select confdeltype from pg_constraint where conname='serial_style_preferences_hairstyle_id_fkey'")"
check "F12 **a customer cannot rewrite somebody else's pick**" "0" \
  "$(AS "$OWNER_B" "update public.serial_style_preferences set style_name_en='Buzz' where serial_id='$SER'" | grep -oE '^UPDATE 0$' | grep -o 0)"
check "F13 ...and it still reads as it did" "Low Fade" \
  "$(Q "select style_name_en from public.serial_style_preferences where serial_id='$SER'")"
check "F14 the serial itself was never modified by any of this" "$SERIAL_BEFORE" \
  "$(Q "select updated_at from public.serials where id='$SER'")"

echo
echo "== G. re-running both migrations is safe =="
FILE "$ROOT/supabase/migrations/20260928_platform_settings.sql" >"$DIR/m28b.log" 2>&1
FILE "$ROOT/supabase/migrations/20260929_service_styles.sql" >"$DIR/m29b.log" 2>&1
check "G1 20260928 again: no error" "" "$(grep -oE 'ERROR|FATAL' "$DIR/m28b.log" | head -1)"
check "G2 20260929 again: no error" "" "$(grep -oE 'ERROR|FATAL' "$DIR/m29b.log" | head -1)"
check "G3 the admin's value survived the re-run" "50" \
  "$(Q "select loyalty_taka_per_point from public.platform_settings")"
check "G4 still exactly one row" "1" "$(Q "select count(*) from public.platform_settings")"
check "G5 shop A's style list survived" "2" \
  "$(Q "select count(*) from public.service_styles where service_id='$SVC_A'")"
check "G6 the customer's pick survived" "Low Fade" \
  "$(Q "select style_name_en from public.serial_style_preferences where serial_id='$SER'")"

echo
echo "================================"
printf 'PASS %d   FAIL %d\n' "$pass" "$fail"
echo "================================"
[ "$fail" -eq 0 ] || exit 1
