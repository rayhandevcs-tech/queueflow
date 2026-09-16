#!/usr/bin/env bash
#
# Sprint 11 — the customer's preferred business type, run against a throwaway
# local Postgres exactly as the other harnesses do.
#
#   bash supabase/tests/run-sprint11-checks.sh
#
# The migration itself is one nullable column, so the interesting questions are
# not structural — they are about what the column must NOT do:
#
#   · a customer can read and change their OWN preference
#   · a customer **cannot** change anybody else's, even by asking directly
#   · a shop owner cannot reach into a customer's profile
#   · `role` is still immutable, so a widened UPDATE path did not open one
#   · the CHECK refuses UNISEX, lower case and junk
#   · **nothing was backfilled** — every pre-existing row is still null
#   · `shops.business_type` is untouched, and the two concepts stay separate
#   · NO_SHOW still exists on appointments (Sprint 11 claims it survives)
#
# `profiles` in `fixture.sql` is deliberately minimal, so this script first
# brings it up to the shape the baseline migration gives it in production —
# `role`, RLS, the two self-serve policies and the role-lock trigger — and then
# applies the real migration on top. That is the same stand-in discipline every
# other harness here uses, and it is why a green run means "the migration is
# sound against a schema shaped like the real one", NOT "it will apply to
# production".
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PORT=5611
DIR=$(mktemp -d /tmp/qf-s11-XXXXXX)
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

Q()    { su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$1\"" 2>&1; }
FILE() { su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -v ON_ERROR_STOP=1 -q -f $1"; }
AS()   { su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=app_user -c test.uid=$1' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$2\"" 2>&1 | head -1; }
QFILE(){ su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -f $1" 2>&1; }
# `-tA` still prints the command tag ("UPDATE 1") after a RETURNING row, so
# anything asserting on a returned VALUE has to take the first line only.
Q1()   { Q "$1" | head -1; }

ERRS='violates check constraint|violates row-level security|profile role is immutable|permission denied'
WHY()   { Q  "$1"      2>&1 | grep -oE "$ERRS" | head -1; }
WHYAS() { AS "$1" "$2"      | grep -oE "$ERRS" | head -1; }

echo "== applying migrations =="
FILE "$HERE/fixture.sql" >/dev/null || { echo "fixture failed"; exit 1; }
FILE "$ROOT/supabase/migrations/20260918_appointment_core.sql" >/dev/null 2>&1 \
  || { echo "20260918 failed"; exit 1; }

# ---- bring `profiles` up to its production shape ------------------------
# The baseline (20260730) gives it a role column, RLS, two row-level policies
# and a trigger that freezes `role`. The fixture has none of that, and every
# security question below depends on all of it.
Q "alter table public.profiles add column if not exists role text not null default 'customer'" >/dev/null
Q "alter table public.profiles enable row level security" >/dev/null
Q "create policy \\\"profiles: read own\\\" on public.profiles for select using (auth.uid() = id)" >/dev/null
Q "create policy \\\"profiles: update own\\\" on public.profiles for update
     using (auth.uid() = id) with check (auth.uid() = id)" >/dev/null
Q "create or replace function public.lock_profile_role() returns trigger language plpgsql as \\\$\\\$
   begin
     if new.role is distinct from old.role then
       raise exception 'profile role is immutable after signup';
     end if;
     return new;
   end \\\$\\\$" >/dev/null
Q "create trigger profiles_lock_role before update on public.profiles
     for each row execute function public.lock_profile_role()" >/dev/null

# `shops` in the fixture has no RLS at all, so without this the "a customer
# cannot edit a shop's business_type" check would pass against nothing. These
# two policies are the baseline's own shape: anyone may read a shop, only its
# owner may write one.
Q "alter table public.shops enable row level security" >/dev/null
Q "create policy \\\"shops: public read\\\" on public.shops for select using (true)" >/dev/null
Q "create policy \\\"shops: owner manage\\\" on public.shops for all
     using (public.is_shop_owner(id)) with check (public.is_shop_owner(id))" >/dev/null

# A salon stand-in, only so the migration's own verification block can ask
# whether serials still allow NO_SHOW. Nothing else here reads it.
Q "create table if not exists public.serials (
     id uuid primary key default gen_random_uuid(),
     shop_id uuid not null references public.shops(id) on delete cascade,
     customer_id uuid references public.profiles(id),
     status text not null default 'WAITING'
       check (status in ('WAITING','IN_PROGRESS','DONE','CANCELLED','NO_SHOW')),
     created_at timestamptz not null default now()
   )" >/dev/null

# ---- two customers and an owner, created BEFORE the migration -----------
# That order is the point of the legacy checks: these three rows predate the
# column, exactly like every real account does.
C1=33333333-3333-3333-3333-333333333333
C2=44444444-4444-4444-4444-444444444444
OA=11111111-1111-1111-1111-111111111111
S=aaaaaaaa-0000-0000-0000-000000000001

Q "insert into profiles (id, full_name, role) values
    ('$C1','Rumi','customer'), ('$C2','Nadia','customer'), ('$OA','Karim','provider')" >/dev/null
Q "insert into shops (id, owner_id, name, business_type) values
    ('$S','$OA','ZZ Salon','SALON')" >/dev/null
# One seat, because 20260918's insert trigger checks that the appointment's
# staff belongs to this shop and is active — and an empty `chairs` table would
# have made the NO_SHOW checks below fail for a reason that has nothing to do
# with NO_SHOW.
CH=cccccccc-0000-0000-0000-000000000001
Q "insert into chairs (id, shop_id, label, staff_name, is_active)
   values ('$CH','$S','1','Karim',true)" >/dev/null
# And one service: 20260918's insert trigger BUILDS services_snapshot by
# joining `services`, and refuses a booking whose total duration is under a
# minute — so an appointment needs a real, priced, timed service to exist.
SV=eeeeeeee-0000-0000-0000-000000000001
Q "insert into services (id, shop_id, name, rate, default_duration_min, is_active)
   values ('$SV','$S','Facial',600,60,true)" >/dev/null

MIG="$ROOT/supabase/migrations/20260926_customer_preference.sql"
if ! FILE "$MIG" >/dev/null 2>"$DIR/mig.err"; then
  echo "  MIGRATION FAILED:"; sed 's/^/    /' "$DIR/mig.err" | head -20; exit 1
fi
echo "  applied cleanly"
# Idempotence is a promise every migration in this repo makes — and this one
# adds a constraint in a DO block precisely so a second run does not fail.
# `if not exists` emits a NOTICE on the second run, which psql writes to
# stderr; only an ERROR means the promise was broken.
FILE "$MIG" >/dev/null 2>"$DIR/mig2.err"
check "re-running the migration is safe" "" \
  "$(grep -E 'ERROR|FATAL' "$DIR/mig2.err" | head -1)"
check "    and it says so out loud rather than silently" "t" \
  "$(Q "select $(grep -c 'NOTICE' "$DIR/mig2.err") >= 1")"

# The migration's own handover block is captured HERE, immediately after the
# migration and before a single test write — one of its checks asserts that
# nothing was backfilled, and this harness deliberately sets a preference a few
# lines below. Running it later would have it reporting our own edits as a
# failed migration. It is asserted on at the end, where it reads better.
awk '/^-- select \* from \(values/,/^-- \) as t\(check_name, ok\)/' "$MIG" \
  | sed -E 's/^--[[:space:]]?//' > "$DIR/verify.sql"
VOUT=$(QFILE "$DIR/verify.sql")

Q "drop owned by app_user" >/dev/null 2>&1; Q "drop role if exists app_user" >/dev/null 2>&1
Q "create role app_user nologin" >/dev/null
Q "grant usage on schema public, auth to app_user" >/dev/null
Q "grant select,insert,update,delete on all tables in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema auth to app_user" >/dev/null

echo
echo "== structure =="
check "the column exists"                    "t" \
  "$(Q "select exists (select 1 from information_schema.columns
         where table_name='profiles' and column_name='preferred_business_type')")"
check "it is text, not an enum (decision 45)" "text" \
  "$(Q "select data_type from information_schema.columns
         where table_name='profiles' and column_name='preferred_business_type'")"
check "**it is nullable, with no default**"  "YES|"  \
  "$(Q "select is_nullable || '|' || coalesce(column_default,'') from information_schema.columns
         where table_name='profiles' and column_name='preferred_business_type'")"
check "the CHECK exists"                     "t" \
  "$(Q "select exists (select 1 from pg_constraint
         where conname='profiles_preferred_business_type_check')")"
check "    and it does not allow UNISEX"     "t" \
  "$(Q "select pg_get_constraintdef(oid) not like '%UNISEX%' from pg_constraint
         where conname='profiles_preferred_business_type_check'")"
check "no second preference table was created" "t" \
  "$(Q "select to_regclass('public.customer_preferences') is null
             and to_regclass('public.user_preferences') is null
             and to_regclass('public.customer_profiles') is null")"
check "**no theme column landed in the database**" 0 \
  "$(Q "select count(*) from information_schema.columns
         where table_schema='public' and column_name like '%theme%'")"

echo
echo "== A7. legacy customers =="
check "**nothing was backfilled — all three rows are still null**" 3 \
  "$(Q "select count(*) from profiles where preferred_business_type is null")"
check "    not one row was given a value"    0 \
  "$(Q "select count(*) from profiles where preferred_business_type is not null")"
check "    and no row was lost"              3 "$(Q "select count(*) from profiles")"

echo
echo "== the CHECK constraint =="
check "SALON is accepted"    "SALON" \
  "$(Q1 "update profiles set preferred_business_type='SALON' where id='$C1' returning preferred_business_type")"
check "PARLOUR is accepted"  "PARLOUR" \
  "$(Q1 "update profiles set preferred_business_type='PARLOUR' where id='$C1' returning preferred_business_type")"
check "**UNISEX is refused**"      "violates check constraint" \
  "$(WHY "update profiles set preferred_business_type='UNISEX' where id='$C1'")"
check "**lower case is refused**"  "violates check constraint" \
  "$(WHY "update profiles set preferred_business_type='salon' where id='$C1'")"
check "an empty string is refused" "violates check constraint" \
  "$(WHY "update profiles set preferred_business_type='' where id='$C1'")"
check "clearing it back to null is allowed" "" \
  "$(Q1 "update profiles set preferred_business_type=null where id='$C1' returning coalesce(preferred_business_type,'')")"

echo
echo "== G. security: one customer, one preference =="
check "a customer can read their own profile" "Rumi" \
  "$(AS "$C1" "select full_name from profiles where id='$C1'")"
check "**a customer can set their own preference**" "PARLOUR" \
  "$(AS "$C1" "update profiles set preferred_business_type='PARLOUR' where id='$C1'
                returning preferred_business_type")"
check "    and read it back"                  "PARLOUR" \
  "$(AS "$C1" "select preferred_business_type from profiles where id='$C1'")"
# A refused UPDATE is SILENT — the policy's USING clause hides the row, so 0
# rows change and psql says "UPDATE 0" rather than raising. Sprint 8 learned
# this the hard way, so the assertion is on the VALUE, not on an error string.
AS "$C2" "update profiles set preferred_business_type='SALON' where id='$C1'" >/dev/null
check "**customer B cannot change customer A's preference**" "PARLOUR" \
  "$(Q "select preferred_business_type from profiles where id='$C1'")"
check "    B's own row is untouched too"      "" \
  "$(Q "select coalesce(preferred_business_type,'') from profiles where id='$C2'")"
check "**B cannot even read A's row**"        "0" \
  "$(AS "$C2" "select count(*) from profiles where id='$C1'")"
check "**a shop owner cannot change a customer's preference**" "PARLOUR" \
  "$(AS "$OA" "update profiles set preferred_business_type='SALON' where id='$C1'" >/dev/null;
    Q "select preferred_business_type from profiles where id='$C1'")"
check "an unauthenticated caller changes nothing" "PARLOUR" \
  "$(AS "" "update profiles set preferred_business_type='SALON' where id='$C1'" >/dev/null;
    Q "select preferred_business_type from profiles where id='$C1'")"
check "**role is still immutable — the new column did not widen that**" \
  "profile role is immutable" \
  "$(WHYAS "$C1" "update profiles set role='provider' where id='$C1'")"
check "    and a customer still cannot promote themselves by any path" "customer" \
  "$(Q "select role from profiles where id='$C1'")"

echo
echo "== F. the two concepts stay separate =="
check "shops.business_type is untouched"      "SALON" \
  "$(Q "select business_type from shops where id='$S'")"
check "**a customer's preference does not change their shop's type**" "SALON|PARLOUR" \
  "$(Q "select (select business_type from shops where id='$S') || '|' ||
               (select preferred_business_type from profiles where id='$C1')")"
check "a customer cannot edit a shop's business_type" "SALON" \
  "$(AS "$C1" "update shops set business_type='PARLOUR' where id='$S'" >/dev/null;
    Q "select business_type from shops where id='$S'")"
check "**no RLS policy anywhere mentions preferred_business_type**" 0 \
  "$(Q "select count(*) from pg_policies
         where schemaname='public'
           and (coalesce(qual,'') like '%preferred_business_type%'
             or coalesce(with_check,'') like '%preferred_business_type%')")"
check "    so nothing can hide a shop by customer preference" 0 \
  "$(Q "select count(*) from pg_policies
         where schemaname='public' and tablename='shops'
           and (coalesce(qual,'') like '%preferred%')")"

echo
echo "== NO_SHOW still exists (Sprint 11 claims it survives) =="
check "the appointments status CHECK still names NO_SHOW" "t" \
  "$(Q "select exists (select 1 from pg_constraint
         where conrelid='public.appointments'::regclass
           and pg_get_constraintdef(oid) like '%NO_SHOW%')")"
# The insert trigger from 20260918 refuses a booking in the past — correctly,
# and it is not what is under test here. A NO_SHOW is by nature a slot that has
# already passed, so the trigger is stood down for this one row and put back
# immediately. (Sprint 5.1's harness learned this lesson the same way.)
Q "alter table public.appointments disable trigger user" >/dev/null 2>&1
NOSHOW=$(Q1 "insert into appointments (shop_id, staff_id, customer_id, customer_name, status,
           service_ids, services_snapshot, starts_at, ends_at)
        values ('$S', '$CH', '$C1','X','NO_SHOW',
                array['$SV'::uuid], '[]'::jsonb,
                now() - interval '2 hours', now() - interval '1 hour')
        returning status")
Q "alter table public.appointments enable trigger user" >/dev/null 2>&1
check "**an appointment row can still carry NO_SHOW**" "NO_SHOW" "$NOSHOW"
check "    and a legal future booking still works through the real triggers" "BOOKED" \
  "$(Q1 "insert into appointments (shop_id, staff_id, customer_id, customer_name, status,
           service_ids, services_snapshot, starts_at, ends_at)
        values ('$S', '$CH', '$C1','X','BOOKED',
                array['$SV'::uuid], '[]'::jsonb,
                ((current_date + 2 + time '12:00') at time zone 'Asia/Dhaka'),
                ((current_date + 2 + time '13:00') at time zone 'Asia/Dhaka'))
        returning status")"
check "no appointment-status value was removed" "t" \
  "$(Q "select bool_and(pg_get_constraintdef(oid) like '%BOOKED%'
                    and pg_get_constraintdef(oid) like '%CONFIRMED%'
                    and pg_get_constraintdef(oid) like '%DONE%'
                    and pg_get_constraintdef(oid) like '%CANCELLED%'
                    and pg_get_constraintdef(oid) like '%NO_SHOW%')
         from pg_constraint
        where conrelid='public.appointments'::regclass
          and pg_get_constraintdef(oid) like '%NO_SHOW%'")"

echo
echo "== the handover block itself =="
# Same discipline as Sprint 10: the block the user runs by hand is code, so it
# is extracted, uncommented and executed — captured above, asserted here.
check "the verification block runs without error" "" \
  "$(printf '%s' "$VOUT" | grep -oE 'ERROR:.*' | head -1)"
# One of its checks reads the production schema rather than this stand-in:
# `shops.business_type` is a real Postgres enum there ('USER-DEFINED') and
# plain text here. It is expected to be false locally and true in the real
# instance, so it is named rather than silently tolerated.
EXPECTED_LOCAL_FALSE="shops.business_type untouched"
UNEXPECTED_FALSE=$(printf '%s' "$VOUT" | grep '|f$' | grep -vE "$EXPECTED_LOCAL_FALSE" || true)
check "**every other check in it comes back true**" "" "$UNEXPECTED_FALSE"
check "    and the one stand-in mismatch is exactly the expected one" 1 \
  "$(printf '%s' "$VOUT" | grep '|f$' | grep -cE "$EXPECTED_LOCAL_FALSE" || true)"
check "    the block is not silently empty"  "t" \
  "$(Q "select $(printf '%s' "$VOUT" | grep -c '|') >= 15")"

# And the behavioural probe, which rolls itself back.
awk '/^-- do \$\$/,/^-- end \$\$;/' "$MIG" | sed -E 's/^--[[:space:]]?//' > "$DIR/probe.sql"
POUT=$(QFILE "$DIR/probe.sql")
check "**the probe confirms the CHECK refuses UNISEX and lower case**" "t" \
  "$(Q "select '$(printf '%s' "$POUT" | tr -d "'" | tr '\n' ' ')' like '%UNISEX refuse%'")"
check "    and it left nothing behind"       "t" \
  "$(Q "select preferred_business_type = 'PARLOUR' from profiles where id='$C1'")"

echo
echo "-------------------------------------------"
printf 'passed: %d   failed: %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
