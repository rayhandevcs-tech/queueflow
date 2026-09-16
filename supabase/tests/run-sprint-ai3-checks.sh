#!/usr/bin/env bash
#
# AI Sprint 3 — the ai_actions lifecycle, and the queue write it guards.
#
#   bash supabase/tests/run-sprint-ai3-checks.sh
#
# WHAT IS REAL HERE AND WHAT IS A STAND-IN
#
# Real migration files, run unmodified:
#
#   20260730_capture_baseline_queue_engine.sql   the queue engine + base RLS
#   20260828_group_booking.sql                   serial_before_insert + the
#                                                one-active-serial index
#   20260930_ai_actions.sql                      this sprint
#
# Stand-ins: the base TABLES (profiles, shops, services, chairs,
# chair_service_stats, serials) and `auth`. The baseline migration deliberately
# contains no CREATE TABLE — those objects were built in the Supabase dashboard
# before this repo had a migration history, and the file says so at the top. So
# the tables are shaped from src/types/database.types.ts and the logic under
# test is the genuine article.
#
# A green run therefore means "these migrations are sound against a schema
# shaped like the real one". It does NOT mean "they will apply to production".
#
# THE CLAIMS THIS FILE EXISTS TO CHECK
#
# Most of them are about things that cannot be proven by reading code:
#
#   A  the table, enums, indexes and constraints land as intended
#   B  RLS isolates a customer's actions, and NOBODY can write the table
#      directly — so status = 'EXECUTED' is unreachable from outside
#   C  the lifecycle functions permit exactly the legal transitions
#   D  a proposal can be claimed ONCE (the replay guard), and a lapsed one
#      self-marks EXPIRED
#   E  the queue write still refuses everything it refused before — another
#      customer's row, a foreign service, an inactive service, a closed shop,
#      a shop not accepting new bookings
#   F  a second confirmation cannot produce a second serial, because
#      one_active_serial_per_customer refuses it
#   G  the price recorded against a serial comes from services.rate at insert
#      time, not from anything a caller supplied
#   H  this migration contains no path that writes a serial
#
# E, F and G are the ones worth the trouble. They are the difference between
# "the AI layer validates carefully" and "the database would refuse it even if
# the AI layer were wrong", and only the second is a guarantee.
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PORT=5617
DIR=$(mktemp -d /tmp/qf-ai3-XXXXXX)
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
QQ() { su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$1\"" 2>&1; }
FILE(){ su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -v ON_ERROR_STOP=1 -q -f $1"; }
# Supabase's real `authenticated` role. A superuser bypasses RLS entirely and
# would report every isolation check below as a pass whatever the policies said.
AS() { su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=authenticated -c test.uid=$1' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$2\"" 2>&1 | head -1; }

echo "== fixture =="
cat > "$DIR/fixture.sql" <<'SQL'
create extension if not exists pgcrypto;

-- Supabase's roles, by name. The policies this sprint adds are `to
-- authenticated`, and a policy scoped to a role does nothing at all for a
-- session that is not a member of it — so a generic test role would silently
-- skip the very thing under test.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Enums the baseline's functions and the real tables depend on.
create type public.user_role as enum ('customer','provider');
create type public.business_type as enum ('SALON','PARLOUR','UNISEX');
create type public.shop_status as enum ('PENDING','ACTIVE','SUSPENDED','REJECTED');
create type public.serial_status as enum ('WAITING','IN_PROGRESS','DONE','CANCELLED','NO_SHOW');
create type public.assignment_mode as enum ('AUTO','CHOSEN','MANUAL');
create type public.payment_status as enum ('UNPAID','ADVANCE','PAID','DUE');

-- Base tables, shaped from src/types/database.types.ts. Columns the baseline
-- and 20260828 actually touch are the ones that matter; the rest are present so
-- an `insert ... returning *` behaves like production.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text not null default '',
  phone text,
  preferred_business_type text,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  business_type public.business_type not null default 'SALON',
  address text not null default '',
  is_open boolean not null default true,
  accepting_new boolean not null default true,
  break_until timestamptz,
  women_only boolean not null default false,
  status public.shop_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  rate numeric(10,2) not null default 0,
  default_duration_min integer not null default 30,
  is_active boolean not null default true,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.chairs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  label text not null,
  staff_name text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  commission_pct numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.chair_service_stats (
  chair_id uuid not null references public.chairs(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  can_perform boolean not null default true,
  rolling_avg_duration_min integer,
  completed_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (chair_id, service_id)
);
create table public.serials (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  chair_id uuid references public.chairs(id) on delete set null,
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null default '',
  customer_phone text,
  service_ids uuid[] not null default '{}',
  services_snapshot jsonb not null default '[]'::jsonb,
  total_amount numeric(10,2) not null default 0,
  status public.serial_status not null default 'WAITING',
  position integer not null default 0,
  is_walk_in boolean not null default false,
  assignment_mode public.assignment_mode not null default 'AUTO',
  estimated_duration_min integer not null default 30,
  estimated_start_at timestamptz,
  booked_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  advance_paid boolean not null default false,
  advance_method text,
  advance_txn_id text,
  payment_status public.payment_status not null default 'UNPAID',
  due_amount numeric(10,2) not null default 0,
  payment_method text,
  extended_min integer not null default 0,
  arrived_at timestamptz,
  called_at timestamptz,
  travel_min integer,
  notified_leave_at timestamptz,
  notified_two_ahead_at timestamptz,
  notified_turn_at timestamptz,
  group_id uuid,
  party_seq integer,
  party_member_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shared trigger helper the baseline attaches in several places.
create or replace function public.set_updated_at() returns trigger
 language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- `notify_serial_event()` — a no-op stand-in.
--
-- The baseline attaches a trigger using it at line 515 but does not create it
-- (it lives with the notification work, which this harness has no business
-- running). With ON_ERROR_STOP that one missing function aborted the baseline
-- BEFORE its `ENABLE ROW LEVEL SECURITY` block and before every policy — so
-- `serials` had RLS off and zero policies, and section E's inserts all
-- succeeded. The sanity check right after the migrations is what surfaced it,
-- and it is why that check is there: a half-applied baseline is far more
-- dangerous in a security harness than one that fails outright, because most
-- of the suite still passes.
--
-- A no-op is honest here. Push notifications are not what section E is about,
-- and stubbing the trigger changes nothing the queue's rules depend on.
create or replace function public.notify_serial_event() returns trigger
 language plpgsql as $$ begin return coalesce(new, old); end $$;

-- `notification_enabled(uuid, text)` — the per-customer push opt-out check,
-- stubbed to FALSE.
--
-- These two are the ONLY functions the baseline and 20260828 call without
-- defining; that was established mechanically rather than by reading, by
-- diffing every `public.x(` call site against every `create or replace
-- function public.x` in both files. Returning false means the queue engine
-- decides not to notify and goes no further into the notification code, which
-- is the outcome that keeps this harness about the queue.
create or replace function public.notification_enabled(p_user_id uuid, p_kind text)
 returns boolean language sql stable as $$ select false $$;

-- `is_platform_admin()` from 20260901, same shape and same security mode.
--
-- Not optional, and finding out why was instructive: inserting a serial makes
-- the queue engine renumber the rows behind it, those UPDATEs fire
-- `serial_before_update`, and that function consults `is_platform_admin()` when
-- deciding whether a customer_id may be detached. Without it every legitimate
-- join in section F failed with "function does not exist" — and, worse, the
-- checks in section E passed for the wrong reason, because they only looked for
-- the RLS message and a different error is still an error. A test that cannot
-- tell "refused for the right reason" from "broke" is not testing anything.
create table if not exists public.admin_users (
  user_id uuid primary key,
  level text not null default 'SUPER_ADMIN',
  status text not null default 'ACTIVE'
);
create or replace function public.is_platform_admin() returns boolean
 language sql stable security definer set search_path to 'public'
as $$ select exists (
  select 1 from public.admin_users where user_id = auth.uid() and status = 'ACTIVE'
) $$;

-- `queue_public` — the PII-free projection the app and the AI both read.
--
-- A TABLE, not a view, and finding that out was the second thing this harness
-- taught me. The baseline's `sync_queue_public()` trigger does
-- `insert into public.queue_public ... on conflict (id) do update`, which a
-- view cannot accept — so modelling it as a view made every legitimate serial
-- insert fail deep inside `recalc_queue_estimates()`. The name reads like a
-- view and the app only ever selects from it, which is exactly why the mistake
-- was easy; `Insert: never` in database.types.ts is the app's rule, not the
-- database's.
create table public.queue_public (
  id uuid primary key,
  shop_id uuid not null,
  chair_id uuid,
  position integer not null default 0,
  status public.serial_status not null,
  is_walk_in boolean not null default false,
  estimated_duration_min integer not null default 30,
  estimated_start_at timestamptz,
  updated_at timestamptz not null default now()
);
grant select on public.queue_public to anon, authenticated;
SQL
FILE "$DIR/fixture.sql" || { echo "fixture failed"; exit 1; }

echo "== real migrations =="
# The queue engine and base RLS, then the party rules which replace
# serial_before_insert and the one-active-serial index with their current form.
# ON_ERROR_STOP is deliberate and these must NOT be allowed to fail quietly. A
# baseline that aborts half way leaves RLS off and the policies missing, which
# turns every isolation check in section E into a silent false negative.
FILE "$ROOT/supabase/migrations/20260730_capture_baseline_queue_engine.sql" 2>&1 | grep -i 'error' \
  && { echo "  baseline did not apply cleanly — aborting"; exit 1; }
FILE "$ROOT/supabase/migrations/20260828_group_booking.sql" 2>&1 | grep -i 'error' \
  && { echo "  20260828 did not apply cleanly — aborting"; exit 1; }

# Sanity: the two things every queue check below depends on must be the real ones.
check "baseline: serial_before_insert present" "t" \
  "$(Q "select to_regprocedure('public.serial_before_insert()') is not null")"
check "baseline: one_active_serial_per_customer present" "t" \
  "$(Q "select exists (select 1 from pg_indexes where indexname='one_active_serial_per_customer')")"
check "baseline: serials customer insert policy present" "t" \
  "$(Q "select exists (select 1 from pg_policies where tablename='serials' and policyname='serials: customer insert')")"
# Without these two, section E cannot fail — so they are checked before it runs.
check "baseline: RLS is ON for serials" "t" \
  "$(Q "select relrowsecurity from pg_class where oid='public.serials'::regclass")"
check "baseline: serials carries its full policy set" "5" \
  "$(Q "select count(*) from pg_policies where tablename='serials'")"

echo "== the migration under test =="
FILE "$ROOT/supabase/migrations/20260930_ai_actions.sql" || { echo "20260930 failed"; exit 1; }

echo "== seed =="
cat > "$DIR/seed.sql" <<'SQL'
-- Two customers and one shopkeeper, so isolation has someone to be isolated from.
insert into auth.users (id) values
  ('11111111-1111-4111-8111-111111111111'),   -- customer A
  ('22222222-2222-4222-8222-222222222222'),   -- customer B
  ('33333333-3333-4333-8333-333333333333');   -- owner
insert into public.profiles (id, role, full_name) values
  ('11111111-1111-4111-8111-111111111111','customer','Customer A'),
  ('22222222-2222-4222-8222-222222222222','customer','Customer B'),
  ('33333333-3333-4333-8333-333333333333','provider','Owner');

insert into public.shops (id, owner_id, name, business_type, is_open, accepting_new) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','Salon A','SALON',true,true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333','Parlour B','PARLOUR',true,true),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','33333333-3333-4333-8333-333333333333','Closed C','SALON',false,true),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','33333333-3333-4333-8333-333333333333','Paused D','SALON',true,false);

insert into public.services (id, shop_id, name, rate, default_duration_min, is_active) values
  ('50000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Haircut',500,30,true),
  ('50000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Retired',300,30,false),
  ('50000000-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Facial',1200,60,true),
  ('50000000-0000-4000-8000-000000000004','cccccccc-cccc-4ccc-8ccc-cccccccccccc','Shave',150,15,true),
  ('50000000-0000-4000-8000-000000000005','dddddddd-dddd-4ddd-8ddd-dddddddddddd','Trim',200,20,true);

insert into public.chairs (id, shop_id, label, staff_name) values
  ('c0000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','Rahim'),
  ('c0000000-0000-4000-8000-000000000004','cccccccc-cccc-4ccc-8ccc-cccccccccccc','1','Karim'),
  ('c0000000-0000-4000-8000-000000000005','dddddddd-dddd-4ddd-8ddd-dddddddddddd','1','Jamal');
insert into public.chair_service_stats (chair_id, service_id, can_perform) values
  ('c0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',true),
  ('c0000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000004',true),
  ('c0000000-0000-4000-8000-000000000005','50000000-0000-4000-8000-000000000005',true);
SQL
FILE "$DIR/seed.sql" || { echo "seed failed"; exit 1; }

A=11111111-1111-4111-8111-111111111111
B=22222222-2222-4222-8222-222222222222
OWNER=33333333-3333-4333-8333-333333333333
SALON=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
PARLOUR=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
CLOSED=cccccccc-cccc-4ccc-8ccc-cccccccccccc
PAUSED=dddddddd-dddd-4ddd-8ddd-dddddddddddd
HAIRCUT=50000000-0000-4000-8000-000000000001
RETIRED=50000000-0000-4000-8000-000000000002
FACIAL=50000000-0000-4000-8000-000000000003
NONCE=nonce-aaaaaaaaaaaaaaaaaaaa

echo
echo "== A. shape =="
check "A1 ai_actions exists" "t" "$(Q "select to_regclass('public.ai_actions') is not null")"
check "A2 ai_action_status enum has six states" "6" \
  "$(Q "select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='ai_action_status'")"
check "A3 ai_action_type has JOIN_QUEUE only" "JOIN_QUEUE" \
  "$(Q "select string_agg(e.enumlabel::text,',') from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='ai_action_type'")"
check "A4 user_created index" "t" \
  "$(Q "select exists (select 1 from pg_indexes where indexname='ai_actions_user_created_idx')")"
check "A5 open-proposals partial index" "t" \
  "$(Q "select exists (select 1 from pg_indexes where indexname='ai_actions_open_idx')")"
check "A6 one-audit-row-per-serial unique index" "t" \
  "$(Q "select exists (select 1 from pg_indexes where indexname='ai_actions_one_per_serial_idx' and indexdef like 'CREATE UNIQUE%')")"
check "A7 RLS enabled" "t" "$(Q "select relrowsecurity from pg_class where oid='public.ai_actions'::regclass")"
check "A8 exactly one policy, and it is SELECT" "SELECT" \
  "$(Q "select string_agg(distinct cmd,',') from pg_policies where tablename='ai_actions'")"
check "A9 no write policy for anybody" "0" \
  "$(Q "select count(*) from pg_policies where tablename='ai_actions' and cmd <> 'SELECT'")"
check "A10 five lifecycle functions, all DEFINER" "5" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ai_action_%' and p.prosecdef")"
check "A11 settled-shape constraint present" "t" \
  "$(Q "select exists (select 1 from pg_constraint where conname='ai_actions_settled_shape')")"
check "A12 serial-only-when-executed constraint present" "t" \
  "$(Q "select exists (select 1 from pg_constraint where conname='ai_actions_serial_only_when_executed')")"

echo
echo "== B. nobody can write the table directly =="
# This is the whole reason there is no write policy. If any of these succeeded,
# `status = 'EXECUTED'` would be a thing a customer could simply assert.
r=$(AS "$A" "insert into public.ai_actions (user_id, action_type, nonce, expires_at) values ('$A','JOIN_QUEUE','$NONCE', now()+interval '5 min')")
check "B1 customer cannot INSERT an action row" "1" "$(printf '%s' "$r" | grep -c 'violates row-level security')"
# Seed one row through the proper door so there is something to try to update.
ACT=$(AS "$A" "select (public.ai_action_propose('JOIN_QUEUE','$SALON', array['$HAIRCUT']::uuid[], '$NONCE', '{\\\"price_taka\\\":500}'::jsonb, 300)).id")
check "B2 propose created a PROPOSED row" "PROPOSED" "$(Q "select status from public.ai_actions where id='$ACT'")"
r=$(AS "$A" "update public.ai_actions set status='EXECUTED' where id='$ACT'")
check "B3 customer cannot UPDATE status to EXECUTED" "0" "$(Q "select count(*) from public.ai_actions where id='$ACT' and status='EXECUTED'")"
r=$(AS "$A" "delete from public.ai_actions where id='$ACT'")
check "B4 customer cannot DELETE their action row" "1" "$(Q "select count(*) from public.ai_actions where id='$ACT'")"
check "B5 customer A can read their own row" "1" "$(AS "$A" "select count(*) from public.ai_actions where id='$ACT'")"
check "B6 customer B cannot read A's row" "0" "$(AS "$B" "select count(*) from public.ai_actions where id='$ACT'")"
check "B7 the shop OWNER cannot read it either" "0" "$(AS "$OWNER" "select count(*) from public.ai_actions where id='$ACT'")"
check "B8 an anonymous session cannot read it" "0" \
  "$(su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=anon' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"select count(*) from public.ai_actions\"" 2>&1 | head -1)"

echo
echo "== C. the lifecycle permits only the legal transitions =="
r=$(AS "$A" "select public.ai_action_propose('JOIN_QUEUE','$SALON', array[]::uuid[], '$NONCE', '{}'::jsonb, 300)")
check "C1 propose refuses an empty service list" "1" "$(printf '%s' "$r" | grep -c 'ai_action_services_required')"
r=$(AS "$A" "select public.ai_action_propose('JOIN_QUEUE','$SALON', array['$HAIRCUT']::uuid[], 'short', '{}'::jsonb, 300)")
check "C2 propose refuses a short nonce" "1" "$(printf '%s' "$r" | grep -c 'ai_action_nonce_too_short')"
r=$(AS "$A" "select public.ai_action_propose('JOIN_QUEUE','$SALON', array['$HAIRCUT']::uuid[], '$NONCE', '{}'::jsonb, 99999)")
check "C3 propose refuses an unbounded TTL" "1" "$(printf '%s' "$r" | grep -c 'ai_action_ttl_out_of_range')"
r=$(su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=authenticated' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"select public.ai_action_propose('JOIN_QUEUE','$SALON', array['$HAIRCUT']::uuid[], '$NONCE', '{}'::jsonb, 300)\"" 2>&1 | head -1)
check "C4 propose refuses a session with no auth.uid()" "1" "$(printf '%s' "$r" | grep -c 'ai_action_requires_login')"
check "C5 propose stamps user_id from auth.uid(), not from an argument" "$A" \
  "$(Q "select user_id from public.ai_actions where id='$ACT'")"

r=$(AS "$A" "select public.ai_action_settle('$ACT','EXECUTED', gen_random_uuid(), null)")
check "C6 cannot settle a row that was never confirmed" "1" "$(printf '%s' "$r" | grep -c 'ai_action_not_settleable')"
r=$(AS "$A" "select public.ai_action_settle('$ACT','CANCELLED', null, null)")
check "C7 settle refuses a status that is not EXECUTED/FAILED" "1" "$(printf '%s' "$r" | grep -c 'ai_action_bad_settle_status')"
r=$(AS "$B" "select public.ai_action_claim('$ACT','$NONCE')")
check "C8 customer B cannot claim A's proposal" "1" "$(printf '%s' "$r" | grep -c 'ai_action_not_found')"
r=$(AS "$A" "select public.ai_action_claim('$ACT','wrong-nonce-wrong-nonce')")
check "C9 a wrong nonce is refused" "1" "$(printf '%s' "$r" | grep -c 'ai_action_nonce_mismatch')"
r=$(AS "$OWNER" "select public.ai_action_claim('$ACT','$NONCE')")
check "C10 the shop owner cannot claim a customer's proposal" "1" "$(printf '%s' "$r" | grep -c 'ai_action_not_found')"

echo
echo "== D. claimed once — the replay guard =="
check "D1 A claims their own proposal" "CONFIRMED" "$(AS "$A" "select (public.ai_action_claim('$ACT','$NONCE')).status")"
r=$(AS "$A" "select public.ai_action_claim('$ACT','$NONCE')")
check "D2 a second claim is refused" "1" "$(printf '%s' "$r" | grep -c 'ai_action_not_claimable')"
check "D3 confirmed_at was stamped" "t" "$(Q "select confirmed_at is not null from public.ai_actions where id='$ACT'")"
r=$(AS "$A" "select public.ai_action_cancel('$ACT')")
check "D4 a confirmed proposal can no longer be cancelled" "1" "$(printf '%s' "$r" | grep -c 'ai_action_not_cancellable')"

# Expiry. `make_interval` on propose means the row decides; a 30-second TTL and
# a backdated expires_at is the only way to observe the lapse without waiting.
EXP=$(AS "$A" "select (public.ai_action_propose('JOIN_QUEUE','$SALON', array['$HAIRCUT']::uuid[], '$NONCE', '{}'::jsonb, 30)).id")
Q "update public.ai_actions set expires_at = now() - interval '1 second' where id='$EXP'" >/dev/null
r=$(AS "$A" "select public.ai_action_claim('$EXP','$NONCE')")
check "D5 an expired proposal cannot be claimed" "1" "$(printf '%s' "$r" | grep -c 'ai_action_expired')"
# The claim RAISED, so it cannot also have persisted anything — a raise rolls
# back the whole call. That is why expiry is its own non-raising sweep, and why
# the row is still PROPOSED at this point rather than EXPIRED.
check "D6 the refused claim persisted nothing" "PROPOSED" "$(Q "select status from public.ai_actions where id='$EXP'")"
check "D7 the sweep marks it EXPIRED" "1" "$(AS "$A" "select public.ai_action_expire_mine()")"
check "D8 and it stuck" "EXPIRED" "$(Q "select status from public.ai_actions where id='$EXP'")"
check "D9 the sweep is idempotent" "0" "$(AS "$A" "select public.ai_action_expire_mine()")"
check "D10 it did not touch a live proposal" "0" \
  "$(Q "select count(*) from public.ai_actions where status='EXPIRED' and expires_at > now()")"
r=$(AS "$B" "select public.ai_action_expire_mine()")
check "D11 B's sweep cannot expire A's proposals" "0" "$(printf '%s' "$r")"

CAN=$(AS "$A" "select (public.ai_action_propose('JOIN_QUEUE','$SALON', array['$HAIRCUT']::uuid[], '$NONCE', '{}'::jsonb, 300)).id")
check "D12 a proposal can be cancelled" "CANCELLED" "$(AS "$A" "select (public.ai_action_cancel('$CAN')).status")"
r=$(AS "$A" "select public.ai_action_claim('$CAN','$NONCE')")
check "D13 a cancelled proposal cannot then be claimed" "1" "$(printf '%s' "$r" | grep -c 'ai_action_cancelled')"
r=$(AS "$B" "select public.ai_action_cancel('$ACT')")
check "D14 customer B cannot cancel A's proposal" "1" "$(printf '%s' "$r" | grep -c 'ai_action_not_cancellable')"

echo
echo "== E. the queue write still refuses everything it refused before =="
# Every one of these is the DATABASE saying no, with no AI-layer validation in
# the picture at all. That is what makes them guarantees rather than habits.
r=$(AS "$A" "insert into public.serials (shop_id, customer_id, customer_name, service_ids, is_walk_in) values ('$SALON','$B','Impostor', array['$HAIRCUT']::uuid[], false)")
check "E1 cannot insert a serial for ANOTHER customer" "1" "$(printf '%s' "$r" | grep -c 'violates row-level security')"
check "E1b and no row was created for them" "0" "$(Q "select count(*) from public.serials where customer_id='$B'")"
r=$(AS "$A" "insert into public.serials (shop_id, customer_id, customer_name, service_ids, is_walk_in) values ('$SALON','$A','A', array['$HAIRCUT']::uuid[], true)")
check "E2 a customer cannot insert a walk-in" "1" "$(printf '%s' "$r" | grep -c 'violates row-level security')"
check "E2b and no walk-in row exists" "0" "$(Q "select count(*) from public.serials where is_walk_in")"
r=$(AS "$A" "insert into public.serials (shop_id, customer_id, customer_name, service_ids, is_walk_in) values ('$SALON','$A','A', array['$FACIAL']::uuid[], false)")
check "E3 a service from ANOTHER shop is refused" "1" "$(printf '%s' "$r" | grep -c 'invalid service selection')"
r=$(AS "$A" "insert into public.serials (shop_id, customer_id, customer_name, service_ids, is_walk_in) values ('$SALON','$A','A', array['$RETIRED']::uuid[], false)")
check "E4 an INACTIVE service is refused" "1" "$(printf '%s' "$r" | grep -c 'invalid service selection')"
r=$(AS "$A" "insert into public.serials (shop_id, customer_id, customer_name, service_ids, is_walk_in) values ('$CLOSED','$A','A', array['50000000-0000-4000-8000-000000000004']::uuid[], false)")
check "E5 a CLOSED shop is refused" "1" "$(printf '%s' "$r" | grep -c 'shop is not open')"
r=$(AS "$A" "insert into public.serials (shop_id, customer_id, customer_name, service_ids, is_walk_in) values ('$PAUSED','$A','A', array['50000000-0000-4000-8000-000000000005']::uuid[], false)")
check "E6 a shop not accepting new bookings is refused" "1" "$(printf '%s' "$r" | grep -c 'not accepting new bookings')"
check "E7 after six refusals the table is still empty" "0" "$(Q "select count(*) from public.serials")"

echo
echo "== F. the legitimate write, and the duplicate that follows it =="
SER=$(AS "$A" "insert into public.serials (shop_id, customer_id, customer_name, service_ids, is_walk_in) values ('$SALON','$A','CustA', array['$HAIRCUT']::uuid[], false) returning id")
check "F1 the legitimate join succeeds" "t" "$(Q "select '$SER' ~ '^[0-9a-f-]{36}$'")"
check "F2 status was set by the trigger, not the caller" "WAITING" "$(Q "select status from public.serials where id='$SER'")"
check "F3 the chair was assigned by the trigger" "t" "$(Q "select chair_id is not null from public.serials where id='$SER'")"
# G, folded in here because it needs this row: the amount comes from
# services.rate. The caller never sent a price and could not have.
check "G1 total_amount came from services.rate" "500.00" "$(Q "select total_amount from public.serials where id='$SER'")"
check "G2 services_snapshot was priced by the trigger" "500.00" \
  "$(Q "select (services_snapshot->0->>'rate')::numeric(10,2) from public.serials where id='$SER'")"

# The duplicate. A second confirmation, a double-tap, a retried request — all of
# them arrive here, and this index is what makes them harmless.
r=$(AS "$A" "insert into public.serials (shop_id, customer_id, customer_name, service_ids, is_walk_in) values ('$SALON','$A','CustA', array['$HAIRCUT']::uuid[], false)")
check "F4 a SECOND active serial for the same customer is refused" "1" "$(printf '%s' "$r" | grep -c 'one_active_serial_per_customer')"
check "F5 still exactly one serial" "1" "$(Q "select count(*) from public.serials where customer_id='$A' and status='WAITING'")"

# Settle the audit row against the real serial, which is the only way EXECUTED
# is ever written.
check "F6 settle records EXECUTED with the serial" "EXECUTED" \
  "$(AS "$A" "select (public.ai_action_settle('$ACT','EXECUTED','$SER', null)).status")"
check "F7 serial_id was stored" "$SER" "$(Q "select serial_id from public.ai_actions where id='$ACT'")"
check "F8 settled_at was stamped" "t" "$(Q "select settled_at is not null from public.ai_actions where id='$ACT'")"
r=$(AS "$A" "select public.ai_action_settle('$ACT','EXECUTED','$SER', null)")
check "F9 an executed row cannot be settled twice" "1" "$(printf '%s' "$r" | grep -c 'ai_action_not_settleable')"

# A second audit row pointing at the same serial — the unique index refuses it
# even though the lifecycle would already have.
ACT2=$(AS "$A" "select (public.ai_action_propose('JOIN_QUEUE','$SALON', array['$HAIRCUT']::uuid[], '$NONCE', '{}'::jsonb, 300)).id")
AS "$A" "select public.ai_action_claim('$ACT2','$NONCE')" >/dev/null
r=$(AS "$A" "select public.ai_action_settle('$ACT2','EXECUTED','$SER', null)")
check "F10 two audit rows cannot claim the same serial" "1" "$(printf '%s' "$r" | grep -c 'ai_actions_one_per_serial_idx')"
check "F11 a FAILED settle stores a code and no serial" "QUEUE_REFUSED|" \
  "$(AS "$A" "select (public.ai_action_settle('$ACT2','FAILED', null, 'QUEUE_REFUSED')).failure_code || '|' || coalesce((select serial_id::text from public.ai_actions where id='$ACT2'),'')")"

echo
echo "== H. this migration writes no serials =="
check "H1 no ai_action_* function touches public.serials" "0" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ai_action_%' and (pg_get_functiondef(p.oid) ilike '%insert into public.serials%' or pg_get_functiondef(p.oid) ilike '%update public.serials%')")"
# Comments stripped before matching: the first version of this check matched
# the migration's own verification query, which contains the phrase in prose.
# A test that a comment can fail is a test that invites softening the comment.
check "H2 no executable line in the migration writes a serial" "0" \
  "$(sed 's/--.*$//' "$ROOT/supabase/migrations/20260930_ai_actions.sql" | grep -ic 'insert into public.serials')"
check "H3 every ai_action_* function pins search_path" "5" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ai_action_%' and array_to_string(p.proconfig,',') like '%search_path%'")"
check "H4 anon holds EXECUTE on none of them" "0" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace, aclexplode(p.proacl) a join pg_roles r on r.oid=a.grantee where n.nspname='public' and p.proname like 'ai_action_%' and r.rolname='anon' and a.privilege_type='EXECUTE'")"
check "H5 authenticated holds EXECUTE on all five" "5" \
  "$(Q "select count(distinct p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace, aclexplode(p.proacl) a join pg_roles r on r.oid=a.grantee where n.nspname='public' and p.proname like 'ai_action_%' and r.rolname='authenticated' and a.privilege_type='EXECUTE'")"

echo
echo "== J. concurrency, with genuinely parallel clients =="
# Not simulated. Each of these is a separate psql process against the same
# cluster, started in the background and waited on — because a race that is
# tested sequentially is not tested at all.

# J1: one proposal, two simultaneous claims. Exactly one may win. This is the
# replay guard under the condition it exists for — a double-tapped confirm
# button, or a retried request arriving twice.
RACE=$(AS "$A" "select (public.ai_action_propose('JOIN_QUEUE','$SALON', array['$HAIRCUT']::uuid[], '$NONCE', '{}'::jsonb, 300)).id")
for i in 1 2 3 4; do
  su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=authenticated -c test.uid=$A' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"select (public.ai_action_claim('$RACE','$NONCE')).status\"" >"$DIR/race.$i" 2>&1 &
done
wait
won=$(grep -lc CONFIRMED "$DIR"/race.* 2>/dev/null | wc -l)
lost=$(grep -l 'ai_action_not_claimable\|ai_action_expired' "$DIR"/race.* 2>/dev/null | wc -l)
check "J1 exactly one of four parallel claims won" "1" "$won"
check "J2 the other three were refused" "3" "$lost"
check "J3 the row is CONFIRMED once" "CONFIRMED" "$(Q "select status from public.ai_actions where id='$RACE'")"

# J4: two DIFFERENT customers joining the same shop at the same moment. Both
# are entitled to a place, and the engine's advisory locks are what keep the
# positions from colliding. B is used here; A already holds an active serial
# from section F, so a third customer is needed for the second half.
insert_sql="insert into public.serials (shop_id, customer_id, customer_name, service_ids, is_walk_in) values ('$SALON', %s, 'X', array['$HAIRCUT']::uuid[], false)"
Q "insert into auth.users (id) values ('44444444-4444-4444-8444-444444444444')" >/dev/null
Q "insert into public.profiles (id, role, full_name) values ('44444444-4444-4444-8444-444444444444','customer','D')" >/dev/null
C1=22222222-2222-4222-8222-222222222222
C2=44444444-4444-4444-8444-444444444444
for uid in "$C1" "$C2"; do
  su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=authenticated -c test.uid=$uid' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$(printf "$insert_sql" "'$uid'")\"" >"$DIR/join.$uid" 2>&1 &
done
wait
check "J4 both customers got a serial" "2" \
  "$(Q "select count(*) from public.serials where customer_id in ('$C1','$C2')")"
check "J5 their positions on a chair are distinct" "0" \
  "$(Q "select count(*) from (select chair_id, position from public.serials where status='WAITING' group by chair_id, position having count(*) > 1) d")"

# J6: the same customer racing themselves — the case a retry produces. Only one
# active serial may exist, whichever request wins.
for i in 1 2 3; do
  su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=authenticated -c test.uid=$C2' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$(printf "$insert_sql" "'$C2'")\"" >"$DIR/dup.$i" 2>&1 &
done
wait
check "J6 a racing retry cannot create a second active serial" "1" \
  "$(Q "select count(*) from public.serials where customer_id='$C2' and status in ('WAITING','IN_PROGRESS')")"

echo
echo "== I. re-running the migration is harmless =="
FILE "$ROOT/supabase/migrations/20260930_ai_actions.sql" >/dev/null 2>&1
check "I1 second apply succeeded" "t" "$(Q "select to_regclass('public.ai_actions') is not null")"
check "I2 the executed row survived it" "EXECUTED" "$(Q "select status from public.ai_actions where id='$ACT'")"
check "I3 still exactly one SELECT policy" "1" \
  "$(Q "select count(*) from pg_policies where tablename='ai_actions'")"

echo
echo "=============================="
printf 'PASS %d   FAIL %d\n' "$pass" "$fail"
echo "=============================="
[ "$fail" -eq 0 ] || exit 1
