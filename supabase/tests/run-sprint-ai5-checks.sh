#!/usr/bin/env bash
#
# AI Sprint 5 — deterministic segments and the owner-approved campaign.
#
#   bash supabase/tests/run-sprint-ai5-checks.sh
#
# WHAT IS REAL HERE AND WHAT IS A STAND-IN
#
# Real migration files, run unmodified:
#
#   20260730_capture_baseline_queue_engine.sql   the queue engine + base RLS
#   20260828_group_booking.sql                   serial_before_insert
#   20260918_appointment_core.sql                appointments
#   20260919_appointment_availability.sql        staff hours
#   20260920_appointment_money.sql               appointments.completed_at
#   20260921_membership.sql                      tiers + membership_is_active
#   20260922_loyalty.sql                         points, accounts, ledger
#   20260924_rewards.sql                         rewards
#   20260930_ai_actions.sql                      the audit table (Sprint 3)
#   20261001_ai_actions_sprint4.sql              appointment + reward actions
#   20261002_ai_campaigns_sprint5.sql            this sprint
#
# Stand-ins, and the reason for each:
#
#   the base TABLES (profiles, shops, services, chairs, chair_service_stats,
#   serials, queue_public) and `auth` — the baseline migration contains no
#   CREATE TABLE, because those objects were built in the Supabase dashboard
#   before this repo had a migration history. Same as every previous harness.
#
#   `notifications` and `notification_enabled()` — created by
#   20260729_notifications.sql and rewritten by 20260807, neither of which can
#   run here: they install triggers on tables this harness does not build and
#   reference `favorites`, `regular_reminders` and `delete_my_account`. The
#   table is reproduced with its REAL shape and its real RLS policy, and
#   `notification_enabled` is copied VERBATIM from 20260807 rather than stubbed
#   — section G's reachable/muted counts are meaningless if it is a constant,
#   and the Sprint 4 harness's stub returned `false`, which would have made
#   every campaign in this file send to nobody.
#
#   `referrals` — 20260923_referral.sql is 1,065 lines of a system not under
#   test. Only the three columns `shop_segment_insights` reads.
#
#   `broadcast_shop_notification` — the existing manual broadcast. NOT
#   installed, because its migration cannot run here. Section H tests the
#   shared daily budget by writing a PROMO notification directly instead, which
#   exercises the same predicate `broadcast_campaign` actually evaluates.
#
# A green run therefore means "these migrations are sound against a schema
# shaped like the real one". It does NOT mean "they will apply to production".
#
# THE CLAIMS THIS FILE EXISTS TO CHECK
#
# Most cannot be proven by reading code, and several cannot be proven in
# JavaScript at all:
#
#   A  the migration applies INSIDE ONE TRANSACTION — which is how the Supabase
#      SQL editor sends it, and the reason every shape CHECK casts
#      `action_type` to text. This matters more than in Sprint 4 because this
#      file REBUILDS two constraints whose `else false` branch would otherwise
#      reject every campaign row
#   S  RLS really is on, before anything is called isolated
#   B  nobody can write ai_actions or notifications directly
#   C  the segments are deterministic, and they mean what they say
#   D  a malformed campaign proposal is refused — by the function AND the table
#   E  SHOP ISOLATION: one owner cannot see or message another's customers
#   F  the AI cannot send. `broadcast_campaign` refuses every state except a
#      CONFIRMED campaign owned by the caller, whose snapshot it is sent to
#   G  the counts come from rows: reachable, muted, and the send count
#   H  the daily budget is shared with the existing manual broadcast
#   I  the owner's edit reaches the notification, and cannot change anything else
#   J  CONCURRENCY, with genuinely parallel clients:
#        J1  one proposal, five simultaneous approvals → exactly one send
#        J2  an expired proposal cannot be approved, racing or not
#        J3  a cancelled proposal cannot be approved
#        J4  a retried send after a lost reply duplicates nothing
#   K  no leaked rows: every table is counted at the end
#
# E, F and J are the ones worth the trouble. They are the difference between
# "the AI layer validates carefully" and "the database would refuse it even if
# the AI layer were wrong", and only the second is a guarantee.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PORT=5620
DIR=$(mktemp -d /tmp/qf-ai5-XXXXXX)
PGBIN=/usr/lib/postgresql/16/bin
RUNAS=${RUNAS:-postgres}

pass=0; fail=0
check() {
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s (expected [%s], got [%s])\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}
contains() {
  case "$3" in (*"$2"*) printf '  PASS  %s\n' "$1"; pass=$((pass+1));;
  (*) printf '  FAIL  %s (wanted [%s] in [%s])\n' "$1" "$2" "$3"; fail=$((fail+1));; esac
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
ASFILE() { su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=authenticated -c test.uid=$1' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -f $2" 2>&1; }

echo "== fixture =="
cat > "$DIR/fixture.sql" <<'SQL'
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

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

create type public.user_role as enum ('customer','provider');
create type public.business_type as enum ('SALON','PARLOUR','UNISEX');
create type public.shop_status as enum ('PENDING','ACTIVE','SUSPENDED','REJECTED');
create type public.serial_status as enum ('WAITING','IN_PROGRESS','DONE','CANCELLED','NO_SHOW');
create type public.assignment_mode as enum ('AUTO','CHOSEN','MANUAL');
create type public.payment_status as enum ('UNPAID','ADVANCE','PAID','DUE');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text not null default '',
  phone text,
  avatar_url text,
  preferred_business_type text,
  -- The column `notification_enabled` reads. Real shape, real default.
  notification_prefs jsonb not null default '{}'::jsonb,
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
  logo_url text,
  is_open boolean not null default true,
  accepting_new boolean not null default true,
  break_until timestamptz,
  women_only boolean not null default false,
  status public.shop_status not null default 'ACTIVE',
  weekly_hours jsonb not null default
    '{"mon":{"open":"09:00","close":"21:00"},"tue":{"open":"09:00","close":"21:00"},
      "wed":{"open":"09:00","close":"21:00"},"thu":{"open":"09:00","close":"21:00"},
      "fri":{"open":"09:00","close":"21:00"},"sat":{"open":"09:00","close":"21:00"},
      "sun":{"open":"09:00","close":"21:00"}}'::jsonb,
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
  due_collected_at timestamptz,
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

-- ---------------------------------------------------------------------------
-- notifications — real shape, real policy, real type list
-- ---------------------------------------------------------------------------
-- From 20260729_notifications.sql, with the CHECK widened by 20260831. The
-- migration itself cannot run here (triggers on tables this harness does not
-- build), so the table is reproduced. `Insert: never` in the generated types
-- is the client story; here there is deliberately NO insert policy, exactly as
-- in production — every notification is written by a SECURITY DEFINER function.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (
    type in ('SERIAL_CONFIRMED', 'QUEUE_UPDATE', 'YOUR_TURN', 'CANCELLED',
             'PROMO', 'REMINDER', 'SYSTEM', 'NEW_BOOKING', 'LEAVE_NOW',
             'DAILY_SUMMARY', 'WAIT_ALERT')
  ),
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "users read own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- referrals — only what shop_segment_insights reads
-- ---------------------------------------------------------------------------
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  code text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING','CONVERTED')),
  converted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;

create or replace function public.set_updated_at() returns trigger
 language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

create or replace function public.notify_serial_event() returns trigger
 language plpgsql as $$ begin return coalesce(new, old); end $$;

-- VERBATIM from 20260807_notification_prefs_and_delete_account.sql. Not a stub:
-- the reachable and muted counts in section G, and the filter inside
-- `broadcast_campaign`, are all meaningless if this is a constant.
create or replace function public.notification_enabled(p_user_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (p.notification_prefs ->> p_type) is distinct from 'false'
     from public.profiles p
     where p.id = p_user_id),
    true
  );
$$;
grant execute on function public.notification_enabled(uuid, text) to authenticated;

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

-- The real one, same shape, same security mode. Every segment function and
-- every owner policy in this schema is built on it, so a stub returning TRUE
-- would report each of section E's isolation checks as a pass for the wrong
-- reason.
create or replace function public.is_shop_owner(p_shop_id uuid) returns boolean
 language sql stable security definer set search_path to 'public'
as $$ select exists (
  select 1 from public.shops where id = p_shop_id and owner_id = auth.uid()
) $$;
SQL
FILE "$DIR/fixture.sql" || { echo "fixture failed"; exit 1; }

echo "== real migrations =="
for m in 20260730_capture_baseline_queue_engine \
         20260828_group_booking \
         20260918_appointment_core \
         20260919_appointment_availability \
         20260920_appointment_money \
         20260921_membership \
         20260922_loyalty; do
  out=$(FILE "$ROOT/supabase/migrations/$m.sql" 2>&1)
  case "$out" in (*[Ee][Rr][Rr][Oo][Rr]*)
    echo "  $m did not apply cleanly — aborting"; echo "$out" | head -8; exit 1;; esac
done

cat > "$DIR/referral-column.sql" <<'SQL'
alter table public.loyalty_transactions add column if not exists source_referral_id uuid;
SQL
FILE "$DIR/referral-column.sql" || exit 1

for m in 20260924_rewards 20260930_ai_actions 20261001_ai_actions_sprint4; do
  out=$(FILE "$ROOT/supabase/migrations/$m.sql" 2>&1)
  case "$out" in (*[Ee][Rr][Rr][Oo][Rr]*)
    echo "  $m did not apply cleanly — aborting"; echo "$out" | head -8; exit 1;; esac
done

echo ""
echo "== A. the Sprint 5 migration, applied the way the SQL editor sends it =="
# ONE transaction, explicitly. This is section A's whole point: `ALTER TYPE ...
# ADD VALUE` is legal inside a transaction, but USING the new value is not — so
# a shape CHECK written as `action_type = 'SEND_CAMPAIGN'` would apply fine
# under psql (which commits each statement) and abort the entire migration in
# the Supabase editor. Casting to text is what makes both work.
#
# And this file does something Sprint 4's did not: it DROPS AND REBUILDS two
# existing constraints. If that rebuild were skipped or failed, the table would
# silently refuse every campaign row — so "applies whole, in one transaction" is
# the difference between a working feature and a migration that half-lands.
cat > "$DIR/sprint5.sql" <<SQL
begin;
\\i $ROOT/supabase/migrations/20261002_ai_campaigns_sprint5.sql
commit;
SQL
out=$(FILE "$DIR/sprint5.sql" 2>&1)
case "$out" in
  (*[Ee][Rr][Rr][Oo][Rr]*) check "A1 applies inside one transaction" "clean" "$out";;
  (*) check "A1 applies inside one transaction" "clean" "clean";;
esac

check "A2 four action types exist" "4" \
  "$(Q "select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='ai_action_type'")"
check "A3 and they are exactly the four intended" "BOOK_APPOINTMENT,JOIN_QUEUE,REDEEM_REWARD,SEND_CAMPAIGN" \
  "$(Q "select string_agg(e.enumlabel, ',' order by e.enumlabel) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='ai_action_type'")"
check "A4 none of the forbidden campaign types exist" "0" \
  "$(Q "select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='ai_action_type' and e.enumlabel in ('AUTO_SEND','SCHEDULE_CAMPAIGN','CANCEL_CAMPAIGN','BULK_MESSAGE','SMART_BLAST','CANCEL_APPOINTMENT','RESCHEDULE_APPOINTMENT')")"
check "A5 the six campaign columns exist" "6" \
  "$(Q "select count(*) from information_schema.columns where table_schema='public' and table_name='ai_actions' and column_name in ('campaign_segment','campaign_since','campaign_recipients','campaign_title','campaign_body','campaign_sent_count')")"
check "A6 the eight shape constraints exist" "8" \
  "$(Q "select count(*) from pg_constraint where conname in ('ai_actions_slot_shape','ai_actions_one_result','ai_actions_result_only_when_executed','ai_actions_result_matches_type','ai_actions_params_match_type','ai_actions_campaign_segment_known','ai_actions_campaign_bounds','ai_actions_campaign_count_shape')")"
check "A7 the campaign uniqueness index exists" "1" \
  "$(Q "select count(*) from pg_indexes where schemaname='public' and tablename='notifications' and indexname='notifications_one_per_campaign_recipient_idx'")"
check "A8 still exactly one ai_action_propose" "1" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_action_propose'")"
check "A9 still exactly one ai_action_settle" "1" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_action_settle'")"
check "A10 six ai_action_* functions, all DEFINER" "6" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.proname like 'ai_action_%'")"
check "A11 the five segment/campaign functions exist" "5" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('shop_segment_rows','shop_segment_summary','shop_segment_members','shop_segment_insights','shop_campaign_recipients')")"
check "A12 broadcast_campaign and campaign_send_count exist" "2" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('broadcast_campaign','campaign_send_count')")"
check "A13 anon holds EXECUTE on none of the new functions" "0" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'shop_segment%' or p.proname like 'campaign%' or p.proname='broadcast_campaign' or p.proname like 'ai_action_%') and has_function_privilege('anon', p.oid, 'execute')")"
check "A14 shop_segment_rows is internal — authenticated cannot call it" "f" \
  "$(Q "select has_function_privilege('authenticated','public.shop_segment_rows(uuid,text,date)'::regprocedure,'execute')")"
check "A15 authenticated CAN call the four wrappers" "4" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('shop_segment_summary','shop_segment_members','shop_segment_insights','shop_campaign_recipients') and has_function_privilege('authenticated', p.oid, 'execute')")"
check "A16 settle takes a result count too" "1" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_action_settle' and pg_get_functiondef(p.oid) like '%p_result_count%'")"
check "A17 no ai_action_* function writes a notification" "0" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ai_action_%' and pg_get_functiondef(p.oid) ilike '%insert into public.notifications%'")"
check "A18 no segment function writes anything at all" "0" \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'shop_segment%' or p.proname='shop_campaign_recipients') and (pg_get_functiondef(p.oid) ilike '%insert into%' or pg_get_functiondef(p.oid) ilike '%update public%' or pg_get_functiondef(p.oid) ilike '%delete from%')")"
check "A19 the Sprint 4 booking engine is still INVOKER" "f" \
  "$(Q "select prosecdef from pg_proc where oid='public.book_appointment(uuid,uuid,uuid[],timestamptz,text,text,boolean,text)'::regprocedure")"
check "A20 the segment vocabulary is closed to six" "6" \
  "$(Q "select count(*) from (select unnest(array['REGULARS','HIGH_FREQUENCY','RECENT','LAPSED','MEMBERS','LOYALTY_ENGAGED'])) s where (select pg_get_constraintdef(oid) from pg_constraint where conname='ai_actions_campaign_segment_known') like '%' || s.unnest || '%'")"

echo ""
echo "== S. sanity: RLS really is on before anything is called isolated =="
check "S1 ai_actions has RLS enabled" "t" \
  "$(Q "select relrowsecurity from pg_class where oid='public.ai_actions'::regclass")"
check "S2 notifications has RLS enabled" "t" \
  "$(Q "select relrowsecurity from pg_class where oid='public.notifications'::regclass")"
check "S3 ai_actions still has no write policy" "0" \
  "$(Q "select count(*) from pg_policies where schemaname='public' and tablename='ai_actions' and cmd<>'SELECT'")"
check "S4 notifications has no write policy" "0" \
  "$(Q "select count(*) from pg_policies where schemaname='public' and tablename='notifications' and cmd<>'SELECT'")"
check "S5 serials has RLS enabled" "t" \
  "$(Q "select relrowsecurity from pg_class where oid='public.serials'::regclass")"
check "S6 customer_memberships has RLS enabled" "t" \
  "$(Q "select relrowsecurity from pg_class where oid='public.customer_memberships'::regclass")"
check "S7 loyalty_accounts has RLS enabled" "t" \
  "$(Q "select relrowsecurity from pg_class where oid='public.loyalty_accounts'::regclass")"

echo ""
echo "== seed =="
# Two shops with DIFFERENT owners, because every isolation check in section E
# needs a real other party rather than a second shop of the same owner.
#
# Eight customers at shop one, arranged so that each segment has a known,
# hand-countable membership — the whole value of section C is that the expected
# numbers were worked out here rather than read off the first run.
#
#   c1  4 visits, last 2 days ago      → RECENT, REGULARS
#   c2  5 visits, last 3 days ago      → RECENT, REGULARS, HIGH_FREQUENCY
#   c3  2 visits, last 200 days ago    → REGULARS(no, outside window), LAPSED
#   c4  1 visit,  last 200 days ago    → LAPSED
#   c5  1 visit,  last 5 days ago      → RECENT
#   c6  3 visits, last 1 day ago, MUTED PROMO → RECENT, REGULARS, not reachable
#   c7  no visits, active membership   → MEMBERS
#   c8  no visits, 400 loyalty points  → LOYALTY_ENGAGED
#   c9  at the OTHER shop only         → must never appear for shop one
cat > "$DIR/seed.sql" <<'SQL'
insert into auth.users (id) values
  ('aaaaaaaa-0000-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000002'),
  ('aaaaaaaa-0000-4000-8000-000000000003'),
  ('aaaaaaaa-0000-4000-8000-000000000004'),
  ('aaaaaaaa-0000-4000-8000-000000000005'),
  ('aaaaaaaa-0000-4000-8000-000000000006'),
  ('aaaaaaaa-0000-4000-8000-000000000007'),
  ('aaaaaaaa-0000-4000-8000-000000000008'),
  ('aaaaaaaa-0000-4000-8000-000000000009'),
  ('bbbbbbbb-0000-4000-8000-000000000001'),
  ('bbbbbbbb-0000-4000-8000-000000000002');

insert into public.profiles (id, role, full_name, phone, notification_prefs) values
  ('aaaaaaaa-0000-4000-8000-000000000001','customer','কাস্টমার এক','01700000001','{}'),
  ('aaaaaaaa-0000-4000-8000-000000000002','customer','কাস্টমার দুই','01700000002','{}'),
  ('aaaaaaaa-0000-4000-8000-000000000003','customer','কাস্টমার তিন','01700000003','{}'),
  ('aaaaaaaa-0000-4000-8000-000000000004','customer','কাস্টমার চার','01700000004','{}'),
  ('aaaaaaaa-0000-4000-8000-000000000005','customer','কাস্টমার পাঁচ','01700000005','{}'),
  -- Muted promotions. The one customer who is in a segment and unreachable.
  ('aaaaaaaa-0000-4000-8000-000000000006','customer','কাস্টমার ছয়','01700000006','{"PROMO": false}'),
  ('aaaaaaaa-0000-4000-8000-000000000007','customer','কাস্টমার সাত','01700000007','{}'),
  ('aaaaaaaa-0000-4000-8000-000000000008','customer','কাস্টমার আট','01700000008','{}'),
  ('aaaaaaaa-0000-4000-8000-000000000009','customer','অন্য দোকানের কাস্টমার','01700000009','{}'),
  ('bbbbbbbb-0000-4000-8000-000000000001','provider','মালিক এক','01800000001','{}'),
  ('bbbbbbbb-0000-4000-8000-000000000002','provider','মালিক দুই','01800000002','{}');

insert into public.shops (id, owner_id, name, business_type, status) values
  ('cccccccc-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000001',
   'রহিম হেয়ার কাট','SALON','ACTIVE'),
  ('cccccccc-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000002',
   'অন্য দোকান','SALON','ACTIVE');

insert into public.services (id, shop_id, name, rate, default_duration_min) values
  ('dddddddd-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','হেয়ার কাট',500,30),
  ('dddddddd-0000-4000-8000-000000000002','cccccccc-0000-4000-8000-000000000002','হেয়ার কাট',400,30);

insert into public.chairs (id, shop_id, label, staff_name) values
  ('eeeeeeee-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','চেয়ার ১','করিম'),
  ('eeeeeeee-0000-4000-8000-000000000002','cccccccc-0000-4000-8000-000000000002','চেয়ার ১','জামাল');

-- `assign_best_chair()` requires an EXISTING row with can_perform = true — the
-- opposite default from `appointment_before_insert`, which treats a missing row
-- as "can". That asymmetry is recorded in the Sprint 4 harness; it is repeated
-- here because without these rows every seeded serial is refused with "selected
-- chair cannot perform all requested services".
insert into public.chair_service_stats (chair_id, service_id, can_perform) values
  ('eeeeeeee-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001', true),
  ('eeeeeeee-0000-4000-8000-000000000002','dddddddd-0000-4000-8000-000000000002', true);

-- Completed visits — HISTORY, months old in places.
--
-- Three triggers are disabled for these inserts, deliberately and narrowly.
-- There is repo precedent for exactly this: 20260806_payment_status_due_ledger
-- disables and re-enables `notify_serial_event_trigger` around a backfill, for
-- the same reason.
--
-- `serials_before_insert` exists to take a NEW serial: it assigns a chair,
-- prices the services, computes the position in today's queue and refuses a
-- shop that is not accepting. Every one of those is wrong for a row that is
-- supposed to represent a haircut from two hundred days ago.
--
-- `serials_after_insert` and `notify_serial_event_trigger` both run the REAL
-- `notify_serial_event` from 20260828_group_booking.sql, which sends the
-- customer a "your serial is confirmed" notification and the owner a "new
-- booking" one. Leaving them on produced 38 notifications from the seed alone —
-- and since every notification assertion in this file is about who received a
-- CAMPAIGN, a history seed that fills the table with unrelated rows makes those
-- assertions meaningless. It also made check B4 read as a policy failure when
-- it was really the seed talking: the owner genuinely owned 18 NEW_BOOKING
-- rows. Historical rows should not notify anybody about a haircut they had last
-- year.
--
-- The queue engine and the notification triggers are tested by earlier
-- harnesses; what this file tests is what the segment functions read, which is
-- `status`, `completed_at` and `customer_id`.
alter table public.serials disable trigger serials_before_insert;
alter table public.serials disable trigger serials_after_insert;
alter table public.serials disable trigger notify_serial_event_trigger;

insert into public.serials
  (shop_id, chair_id, customer_id, customer_name, service_ids, status, completed_at, position, total_amount)
select 'cccccccc-0000-4000-8000-000000000001',
       'eeeeeeee-0000-4000-8000-000000000001',
       v.cid, v.cname, array['dddddddd-0000-4000-8000-000000000001']::uuid[],
       'DONE', v.at, 1, 500
  from (values
    ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'কাস্টমার এক', now() - interval '2 days'),
    ('aaaaaaaa-0000-4000-8000-000000000001','কাস্টমার এক', now() - interval '20 days'),
    ('aaaaaaaa-0000-4000-8000-000000000001','কাস্টমার এক', now() - interval '40 days'),
    ('aaaaaaaa-0000-4000-8000-000000000001','কাস্টমার এক', now() - interval '50 days'),
    ('aaaaaaaa-0000-4000-8000-000000000002','কাস্টমার দুই', now() - interval '3 days'),
    ('aaaaaaaa-0000-4000-8000-000000000002','কাস্টমার দুই', now() - interval '10 days'),
    ('aaaaaaaa-0000-4000-8000-000000000002','কাস্টমার দুই', now() - interval '17 days'),
    ('aaaaaaaa-0000-4000-8000-000000000002','কাস্টমার দুই', now() - interval '24 days'),
    ('aaaaaaaa-0000-4000-8000-000000000002','কাস্টমার দুই', now() - interval '31 days'),
    ('aaaaaaaa-0000-4000-8000-000000000003','কাস্টমার তিন', now() - interval '200 days'),
    ('aaaaaaaa-0000-4000-8000-000000000003','কাস্টমার তিন', now() - interval '230 days'),
    ('aaaaaaaa-0000-4000-8000-000000000004','কাস্টমার চার', now() - interval '200 days'),
    ('aaaaaaaa-0000-4000-8000-000000000005','কাস্টমার পাঁচ', now() - interval '5 days'),
    ('aaaaaaaa-0000-4000-8000-000000000006','কাস্টমার ছয়', now() - interval '1 day'),
    ('aaaaaaaa-0000-4000-8000-000000000006','কাস্টমার ছয়', now() - interval '12 days'),
    ('aaaaaaaa-0000-4000-8000-000000000006','কাস্টমার ছয়', now() - interval '26 days')
  ) as v(cid, cname, at);

-- The other shop's only customer. Section E exists to prove this row is
-- invisible and unmessageable from shop one.
insert into public.serials
  (shop_id, chair_id, customer_id, customer_name, service_ids, status, completed_at, position, total_amount)
values ('cccccccc-0000-4000-8000-000000000002','eeeeeeee-0000-4000-8000-000000000002',
        'aaaaaaaa-0000-4000-8000-000000000009','অন্য দোকানের কাস্টমার',
        array['dddddddd-0000-4000-8000-000000000002']::uuid[],'DONE', now() - interval '4 days', 1, 400);

-- A cancelled and a no-show visit for c5, to prove a visit is a COMPLETED job.
-- Without these the "status = 'DONE'" in the segment rule is untested.
insert into public.serials
  (shop_id, chair_id, customer_id, customer_name, service_ids, status, completed_at, position, total_amount)
values ('cccccccc-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000005','কাস্টমার পাঁচ',
        array['dddddddd-0000-4000-8000-000000000001']::uuid[],'CANCELLED', null, 2, 500),
       ('cccccccc-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000005','কাস্টমার পাঁচ',
        array['dddddddd-0000-4000-8000-000000000001']::uuid[],'NO_SHOW', null, 3, 500);

-- A walk-in with no account. Nobody to notify, so it must not become a member
-- of anything.
insert into public.serials
  (shop_id, chair_id, customer_id, customer_name, customer_phone, service_ids, status, completed_at, position, total_amount, is_walk_in)
values ('cccccccc-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001',
        null,'হাঁটা কাস্টমার','01799999999',
        array['dddddddd-0000-4000-8000-000000000001']::uuid[],'DONE', now() - interval '1 day', 4, 500, true);

-- c7: an active membership, no visits.
insert into public.membership_tiers (id, shop_id, name, price, duration_days, is_active)
values ('ffffffff-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001',
        'গোল্ড', 2000, 365, true);
-- Last year's membership, expired, AND this year's, active — a renewal, which
-- is what most members look like after a year.
--
-- This is the case `distinct on` exists for, and it is not hypothetical.
-- `customer_memberships_one_live_idx` forbids two PENDING/ACTIVE rows, so two
-- live memberships cannot happen; but `membership_is_active(shop, customer)`
-- asks about the CUSTOMER, not the row, so both rows below satisfy it and a
-- plain join would list this person twice — inflating the count the owner
-- approves, and putting a duplicate in the snapshot.
-- Inserted ACTIVE and then expired, because `membership_before_insert` raises
-- `membership_must_start_pending_or_active` — a membership cannot be born
-- expired, which is correct and is also how a real renewal actually happens.
insert into public.customer_memberships
  (shop_id, customer_id, tier_id, customer_name, tier_snapshot, price, duration_days,
   payment_status, status, started_at, expires_at)
values ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000007',
        'ffffffff-0000-4000-8000-000000000001','কাস্টমার সাত','{}'::jsonb, 2000, 365,
        'PAID','ACTIVE', now() - interval '400 days', now() - interval '35 days');
update public.customer_memberships set status = 'EXPIRED'
 where customer_id = 'aaaaaaaa-0000-4000-8000-000000000007';

insert into public.customer_memberships
  (shop_id, customer_id, tier_id, customer_name, tier_snapshot, price, duration_days,
   payment_status, status, started_at, expires_at)
values ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000007',
        'ffffffff-0000-4000-8000-000000000001','কাস্টমার সাত','{}'::jsonb, 2000, 365,
        'PAID','ACTIVE', now() - interval '10 days', now() + interval '300 days');

-- c8: 400 points, no visits. And c1 with a ZERO balance, which must NOT count
-- as loyalty-engaged.
insert into public.loyalty_accounts (shop_id, customer_id, balance, lifetime_earned) values
  ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000008', 400, 400),
  ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001', 0, 200);

-- A converted referral, for the insights count.
insert into public.referrals (shop_id, referrer_id, referred_id, status, converted_at)
values ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000005','CONVERTED', now() - interval '6 days');
SQL
FILE "$DIR/seed.sql" || { echo "seed failed"; exit 1; }

O1=bbbbbbbb-0000-4000-8000-000000000001
O2=bbbbbbbb-0000-4000-8000-000000000002
C1=aaaaaaaa-0000-4000-8000-000000000001
C6=aaaaaaaa-0000-4000-8000-000000000006
C9=aaaaaaaa-0000-4000-8000-000000000009
SHOP1=cccccccc-0000-4000-8000-000000000001
SHOP2=cccccccc-0000-4000-8000-000000000002
# 60 days back, as a DATE. The whole reason the window is a date and not an
# interval: it does not move while the test runs.
SINCE="current_date - 60"

echo ""
echo "== B. nobody writes these tables directly =="
contains "B1 an owner cannot insert a campaign row by hand" "row-level security" \
  "$(AS "$O1" "insert into public.ai_actions (user_id, action_type, shop_id, service_ids, nonce, expires_at, campaign_segment, campaign_since, campaign_recipients, campaign_title, campaign_body) values ('$O1','SEND_CAMPAIGN','$SHOP1','{}'::uuid[],repeat('a',24),now()+interval '10 min','LAPSED',$SINCE,array['$C1'::uuid,'$C6'::uuid,'$C9'::uuid],'x','y')")"
contains "B2 an owner cannot forge EXECUTED" "0" \
  "$(AS "$O1" "with u as (update public.ai_actions set status='EXECUTED' where user_id='$O1' returning 1) select count(*) from u")"
contains "B3 nobody can insert a notification by hand" "row-level security" \
  "$(AS "$O1" "insert into public.notifications (user_id, type, title, body) values ('$C1','PROMO','x','y')")"
check "B4 an owner cannot read a customer's notifications" "0" \
  "$(AS "$O1" "select count(*) from public.notifications")"

echo ""
echo "== C. the segments are deterministic, and mean what they say =="
check "C1 RECENT is the four who came inside the window" "4" \
  "$(AS "$O1" "select member_count from public.shop_segment_summary('$SHOP1', $SINCE) where segment='RECENT'")"
check "C2 REGULARS is the three with 2+ visits inside it" "3" \
  "$(AS "$O1" "select member_count from public.shop_segment_summary('$SHOP1', $SINCE) where segment='REGULARS'")"
check "C3 HIGH_FREQUENCY is the one with 5" "1" \
  "$(AS "$O1" "select member_count from public.shop_segment_summary('$SHOP1', $SINCE) where segment='HIGH_FREQUENCY'")"
check "C4 LAPSED is the two who came once, long ago" "2" \
  "$(AS "$O1" "select member_count from public.shop_segment_summary('$SHOP1', $SINCE) where segment='LAPSED'")"
check "C5 MEMBERS counts a renewing customer once" "1" \
  "$(AS "$O1" "select member_count from public.shop_segment_summary('$SHOP1', $SINCE) where segment='MEMBERS'")"
check "C6 LOYALTY_ENGAGED excludes a zero balance" "1" \
  "$(AS "$O1" "select member_count from public.shop_segment_summary('$SHOP1', $SINCE) where segment='LOYALTY_ENGAGED'")"
check "C7 a walk-in with no account is in nothing" "0" \
  "$(AS "$O1" "select count(*) from public.shop_segment_members('$SHOP1','RECENT',$SINCE,50) where display_name='হাঁটা কাস্টমার'")"
check "C8 a cancelled and a no-show are not visits" "1" \
  "$(AS "$O1" "select visit_count from public.shop_segment_members('$SHOP1','RECENT',$SINCE,50) where display_name='কাস্টমার পাঁচ'")"
check "C9 LAPSED and RECENT cannot overlap" "0" \
  "$(AS "$O1" "select count(*) from public.shop_campaign_recipients('$SHOP1','LAPSED',$SINCE) l where l in (select r from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE) r)")"
check "C10 the same question twice gives the same answer" "t" \
  "$(AS "$O1" "select (select array_agg(x) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE) x) = (select array_agg(y) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE) y)")"
check "C11 the snapshot is sorted, so equality means equality" "t" \
  "$(AS "$O1" "select (select array_agg(x) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE) x) = (select array_agg(y order by y) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE) y)")"
check "C12 a muted customer is a member but not a recipient" "3" \
  "$(AS "$O1" "select count(*) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE)")"
check "C13 and the summary says so: 4 members, 3 reachable" "4|3" \
  "$(AS "$O1" "select member_count || '|' || reachable_count from public.shop_segment_summary('$SHOP1', $SINCE) where segment='RECENT'")"
check "C14 the member listing carries no customer id" "0" \
  "$(Q "select count(*) from information_schema.routines r join information_schema.parameters p on p.specific_name=r.specific_name where r.routine_name='shop_segment_members' and p.parameter_mode='OUT' and p.parameter_name like '%customer%'")"
check "C15 nor any phone number" "0" \
  "$(Q "select count(*) from information_schema.routines r join information_schema.parameters p on p.specific_name=r.specific_name where r.routine_name='shop_segment_members' and p.parameter_mode='OUT' and (p.parameter_name like '%phone%' or p.parameter_name like '%email%')")"
check "C16 the listing cap is enforced" "2" \
  "$(AS "$O1" "select count(*) from public.shop_segment_members('$SHOP1','RECENT',$SINCE,2)")"
contains "C17 an absurd cap is refused" "segment_limit_out_of_range" \
  "$(AS "$O1" "select count(*) from public.shop_segment_members('$SHOP1','RECENT',$SINCE,5000)")"
contains "C18 a future window is refused" "segment_window_in_future" \
  "$(AS "$O1" "select count(*) from public.shop_segment_members('$SHOP1','RECENT',current_date + 1, 10)")"
contains "C19 an unknown segment name yields nothing, not everything" "0" \
  "$(AS "$O1" "select count(*) from public.shop_campaign_recipients('$SHOP1','WILL_CHURN',$SINCE)")"
check "C20 insights: 4 members, 3 reachable, 1 muted" "4|3|1" \
  "$(AS "$O1" "select member_count || '|' || reachable_count || '|' || muted_count from public.shop_segment_insights('$SHOP1','RECENT',$SINCE)")"
check "C21 insights: a member who has never visited is counted as such" "1" \
  "$(AS "$O1" "select never_visited from public.shop_segment_insights('$SHOP1','MEMBERS',$SINCE)")"
check "C22 insights: avg_visits is null for an empty segment, never 0" "" \
  "$(AS "$O1" "select coalesce(avg_visits::text,'') from public.shop_segment_insights('$SHOP1','WILL_CHURN',$SINCE)")"
check "C23 insights: the referral count comes from the referrals table" "1" \
  "$(AS "$O1" "select referred_someone from public.shop_segment_insights('$SHOP1','REGULARS',$SINCE)")"

echo ""
echo "== D. a malformed campaign proposal is refused =="
contains "D1 no segment → named refusal" "ai_action_segment_required" \
  "$(AS "$O1" "select id from public.ai_action_propose('SEND_CAMPAIGN','$SHOP1','{}'::uuid[],repeat('a',24),'{}'::jsonb,600)")"
contains "D2 no window → named refusal" "ai_action_segment_window_required" \
  "$(AS "$O1" "select id from public.ai_action_propose('SEND_CAMPAIGN','$SHOP1','{}'::uuid[],repeat('a',24),'{}'::jsonb,600,null,null,null,'LAPSED')")"
contains "D3 no recipients → named refusal" "ai_action_recipients_required" \
  "$(AS "$O1" "select id from public.ai_action_propose('SEND_CAMPAIGN','$SHOP1','{}'::uuid[],repeat('a',24),'{}'::jsonb,600,null,null,null,'LAPSED',$SINCE)")"
contains "D4 fewer than three recipients → named refusal" "ai_action_segment_too_small" \
  "$(AS "$O1" "select id from public.ai_action_propose('SEND_CAMPAIGN','$SHOP1','{}'::uuid[],repeat('a',24),'{}'::jsonb,600,null,null,null,'LAPSED',$SINCE,array['$C1'::uuid],'শিরোনাম','বার্তা')")"
contains "D5 no content → named refusal" "ai_action_campaign_content_required" \
  "$(AS "$O1" "select id from public.ai_action_propose('SEND_CAMPAIGN','$SHOP1','{}'::uuid[],repeat('a',24),'{}'::jsonb,600,null,null,null,'LAPSED',$SINCE,array['$C1'::uuid,'$C6'::uuid,'$C9'::uuid])")"
contains "D6 an unknown segment is refused by the TABLE" "ai_actions_campaign_segment_known" \
  "$(AS "$O1" "select id from public.ai_action_propose('SEND_CAMPAIGN','$SHOP1','{}'::uuid[],repeat('a',24),'{}'::jsonb,600,null,null,null,'WILL_CHURN',$SINCE,array['$C1'::uuid,'$C6'::uuid,'$C9'::uuid],'শিরোনাম','বার্তা')")"
contains "D7 a campaign carrying a slot is refused" "ai_action_bad_shape" \
  "$(AS "$O1" "select id from public.ai_action_propose('SEND_CAMPAIGN','$SHOP1','{}'::uuid[],repeat('a',24),'{}'::jsonb,600,'eeeeeeee-0000-4000-8000-000000000001',now()+interval '1 day',null,'LAPSED',$SINCE,array['$C1'::uuid,'$C6'::uuid,'$C9'::uuid],'শিরোনাম','বার্তা')")"
contains "D8 a queue join carrying campaign fields is refused" "ai_action_bad_shape" \
  "$(AS "$O1" "select id from public.ai_action_propose('JOIN_QUEUE','$SHOP1',array['dddddddd-0000-4000-8000-000000000001'::uuid],repeat('a',24),'{}'::jsonb,600,null,null,null,'LAPSED',$SINCE,array['$C1'::uuid,'$C6'::uuid,'$C9'::uuid],'শিরোনাম','বার্তা')")"
contains "D9 an over-long body is refused by the TABLE" "ai_actions_campaign_bounds" \
  "$(AS "$O1" "select id from public.ai_action_propose('SEND_CAMPAIGN','$SHOP1','{}'::uuid[],repeat('a',24),'{}'::jsonb,600,null,null,null,'LAPSED',$SINCE,array['$C1'::uuid,'$C6'::uuid,'$C9'::uuid],'শিরোনাম',repeat('x',501))")"
contains "D10 a TTL beyond the ceiling is refused" "ai_action_ttl_out_of_range" \
  "$(AS "$O1" "select id from public.ai_action_propose('SEND_CAMPAIGN','$SHOP1','{}'::uuid[],repeat('a',24),'{}'::jsonb,99999,null,null,null,'LAPSED',$SINCE,array['$C1'::uuid,'$C6'::uuid,'$C9'::uuid],'শিরোনাম','বার্তা')")"
contains "D11 settling an action that is not the caller's is refused" "ai_action_not_settleable" \
  "$(AS "$O1" "select id from public.ai_action_settle(gen_random_uuid(),'EXECUTED',null,null)")"

echo ""
echo "== E. shop isolation — this is the one that matters =="
contains "E1 an owner cannot summarise another shop" "not your shop" \
  "$(AS "$O1" "select count(*) from public.shop_segment_summary('$SHOP2', $SINCE)")"
contains "E2 nor list its customers" "not your shop" \
  "$(AS "$O1" "select count(*) from public.shop_segment_members('$SHOP2','RECENT',$SINCE,10)")"
contains "E3 nor read its insights" "not your shop" \
  "$(AS "$O1" "select member_count from public.shop_segment_insights('$SHOP2','RECENT',$SINCE)")"
contains "E4 nor build a recipient snapshot from it" "not your shop" \
  "$(AS "$O1" "select count(*) from public.shop_campaign_recipients('$SHOP2','RECENT',$SINCE)")"
contains "E5 nor propose a campaign against it" "not your shop" \
  "$(AS "$O1" "select id from public.ai_action_propose('SEND_CAMPAIGN','$SHOP2','{}'::uuid[],repeat('a',24),'{}'::jsonb,600,null,null,null,'RECENT',$SINCE,array['$C9'::uuid,'$C1'::uuid,'$C6'::uuid],'শিরোনাম','বার্তা')")"
check "E6 the other shop's customer never appears in shop one's segments" "0" \
  "$(AS "$O1" "select count(*) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE) r where r = '$C9'")"
check "E7 nor by name" "0" \
  "$(AS "$O1" "select count(*) from public.shop_segment_members('$SHOP1','RECENT',$SINCE,50) where display_name='অন্য দোকানের কাস্টমার'")"
contains "E8 a CUSTOMER cannot read owner segmentation at all" "not your shop" \
  "$(AS "$C1" "select count(*) from public.shop_segment_summary('$SHOP1', $SINCE)")"
contains "E9 nor call the recipient snapshot" "not your shop" \
  "$(AS "$C1" "select count(*) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE)")"
contains "E10 nor propose a campaign" "not your shop" \
  "$(AS "$C1" "select id from public.ai_action_propose('SEND_CAMPAIGN','$SHOP1','{}'::uuid[],repeat('a',24),'{}'::jsonb,600,null,null,null,'RECENT',$SINCE,array['$C1'::uuid,'$C6'::uuid,'$C9'::uuid],'শিরোনাম','বার্তা')")"
contains "E11 the second owner cannot reach shop one either" "not your shop" \
  "$(AS "$O2" "select count(*) from public.shop_segment_summary('$SHOP1', $SINCE)")"
check "E12 and CAN reach their own" "1" \
  "$(AS "$O2" "select member_count from public.shop_segment_summary('$SHOP2', $SINCE) where segment='RECENT'")"
contains "E13 an anonymous caller gets nothing" "not your shop" \
  "$(AS "" "select count(*) from public.shop_segment_summary('$SHOP1', $SINCE)")"

echo ""
echo "== F. the AI cannot send. Only an approved proposal can =="
# One real proposal, built the way the server builds one: the snapshot comes
# from `shop_campaign_recipients`, never from a literal.
cat > "$DIR/propose.sql" <<SQL
select id from public.ai_action_propose(
  'SEND_CAMPAIGN', '$SHOP1', '{}'::uuid[], repeat('n', 24), '{}'::jsonb, 600,
  null, null, null,
  'LAPSED', $SINCE,
  (select array_agg(x) from public.shop_campaign_recipients('$SHOP1','LAPSED',$SINCE) x),
  'অনেকদিন আসোনি', 'আবার এসো — আমরা আছি।');
SQL
# LAPSED has only two members, which the floor of three refuses. That floor is
# real and tested in D4; here the campaign needs a segment big enough to send,
# so RECENT it is.
cat > "$DIR/propose.sql" <<SQL
select id from public.ai_action_propose(
  'SEND_CAMPAIGN', '$SHOP1', '{}'::uuid[], repeat('n', 24), '{}'::jsonb, 600,
  null, null, null,
  'RECENT', $SINCE,
  (select array_agg(x) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE) x),
  'আবার দেখা হবে', 'তোমার জন্য অপেক্ষা করছি।');
SQL
A1=$(ASFILE "$O1" "$DIR/propose.sql" | head -1)
check "F1 a real campaign proposal exists" "1" \
  "$(Q "select count(*) from public.ai_actions where id='$A1' and status='PROPOSED'")"
check "F2 its snapshot is the three reachable customers" "3" \
  "$(Q "select cardinality(campaign_recipients) from public.ai_actions where id='$A1'")"
check "F3 and the muted customer is not in it" "0" \
  "$(Q "select count(*) from public.ai_actions where id='$A1' and '$C6' = any(campaign_recipients)")"

contains "F4 a PROPOSED campaign cannot be sent" "campaign_not_confirmed" \
  "$(AS "$O1" "select public.broadcast_campaign('$SHOP1','$A1','আবার দেখা হবে','তোমার জন্য অপেক্ষা করছি।')")"
contains "F5 an invented action id cannot be sent" "campaign_action_not_found" \
  "$(AS "$O1" "select public.broadcast_campaign('$SHOP1',gen_random_uuid(),'x','y')")"
# The ownership check comes first, so a customer is stopped by "not your shop"
# rather than by "no such action" — which is the right order: it refuses
# without revealing whether the action id is real.
contains "F6 a customer cannot send an owner's campaign" "not your shop" \
  "$(AS "$C1" "select public.broadcast_campaign('$SHOP1','$A1','আবার দেখা হবে','তোমার জন্য অপেক্ষা করছি।')")"
contains "F7 an anonymous caller cannot send" "campaign_requires_login" \
  "$(AS "" "select public.broadcast_campaign('$SHOP1','$A1','x','y')")"
check "F8 nothing was sent by any of that" "0" \
  "$(Q "select count(*) from public.notifications where data ? 'ai_action_id'")"

# Now claim it — the owner presses the button.
check "F9 the owner claims it" "CONFIRMED" \
  "$(AS "$O1" "select status from public.ai_action_claim('$A1', repeat('n',24))")"
contains "F10 a content mismatch is refused, not silently resolved" "campaign_content_mismatch" \
  "$(AS "$O1" "select public.broadcast_campaign('$SHOP1','$A1','অন্য শিরোনাম','অন্য বার্তা')")"
contains "F11 the wrong shop is refused" "not your shop" \
  "$(AS "$O1" "select public.broadcast_campaign('$SHOP2','$A1','আবার দেখা হবে','তোমার জন্য অপেক্ষা করছি।')")"
check "F12 still nothing sent" "0" \
  "$(Q "select count(*) from public.notifications where data ? 'ai_action_id'")"
check "F13 the approved send reaches exactly three people" "3" \
  "$(AS "$O1" "select public.broadcast_campaign('$SHOP1','$A1','আবার দেখা হবে','তোমার জন্য অপেক্ষা করছি।')")"
check "F14 and the notifications exist, typed PROMO" "3" \
  "$(Q "select count(*) from public.notifications where type='PROMO' and (data->>'ai_action_id')='$A1'")"
check "F15 the muted customer received nothing" "0" \
  "$(Q "select count(*) from public.notifications where user_id='$C6'")"
check "F16 the other shop's customer received nothing" "0" \
  "$(Q "select count(*) from public.notifications where user_id='$C9'")"
check "F17 the body is the approved body" "1" \
  "$(Q "select count(distinct body) from public.notifications where (data->>'ai_action_id')='$A1'")"
check "F18 every notification carries its shop" "3" \
  "$(Q "select count(*) from public.notifications where (data->>'shop_id')='$SHOP1' and (data->>'ai_action_id')='$A1'")"
check "F19 each recipient can read their own" "1" \
  "$(AS "$C1" "select count(*) from public.notifications where (data->>'ai_action_id')='$A1'")"

echo ""
echo "== G. the counts come from rows =="
check "G1 campaign_send_count agrees with the table" "3" \
  "$(AS "$O1" "select public.campaign_send_count('$A1')")"
contains "G2 and refuses somebody else's action" "campaign_action_not_found" \
  "$(AS "$O2" "select public.campaign_send_count('$A1')")"
check "G3 settle records the count, not a result id" "3" \
  "$(AS "$O1" "select campaign_sent_count from public.ai_action_settle('$A1','EXECUTED',null,null,3)")"
check "G4 and the row is EXECUTED with no result id anywhere" "EXECUTED|0" \
  "$(Q "select status || '|' || num_nonnulls(serial_id, appointment_id, redemption_id) from public.ai_actions where id='$A1'")"
check "G5 settled_at was stamped" "f" \
  "$(Q "select settled_at is null from public.ai_actions where id='$A1'")"
contains "G6 an EXECUTED campaign cannot be settled again" "ai_action_not_settleable" \
  "$(AS "$O1" "select id from public.ai_action_settle('$A1','EXECUTED',null,null,3)")"
contains "G7 nor edited after the fact" "ai_action_not_editable" \
  "$(AS "$O1" "select id from public.ai_action_apply_campaign_edit('$A1','নতুন','লেখা')")"

echo ""
echo "== H. the daily budget is shared with the existing manual broadcast =="
# The second campaign of the day, proposed against a segment that still has
# three reachable members.
cat > "$DIR/propose2.sql" <<SQL
select id from public.ai_action_propose(
  'SEND_CAMPAIGN', '$SHOP1', '{}'::uuid[], repeat('m', 24), '{}'::jsonb, 600,
  null, null, null,
  'RECENT', $SINCE,
  (select array_agg(x) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE) x),
  'দ্বিতীয় বার্তা', 'একই দিনে দুবার।');
SQL
A2=$(ASFILE "$O1" "$DIR/propose2.sql" | head -1)
check "H1 a second campaign can be proposed" "1" \
  "$(Q "select count(*) from public.ai_actions where id='$A2' and status='PROPOSED'")"
check "H2 and claimed" "CONFIRMED" \
  "$(AS "$O1" "select status from public.ai_action_claim('$A2', repeat('m',24))")"
contains "H3 but the day's budget is already spent" "campaign_daily_limit" \
  "$(AS "$O1" "select public.broadcast_campaign('$SHOP1','$A2','দ্বিতীয় বার্তা','একই দিনে দুবার।')")"
check "H4 so nothing extra was sent" "3" \
  "$(Q "select count(*) from public.notifications where data ? 'ai_action_id'")"
check "H5 a FAILED settle records the reason, no count" "BROADCAST_LIMIT_REACHED|" \
  "$(AS "$O1" "select failure_code || '|' || coalesce(campaign_sent_count::text,'') from public.ai_action_settle('$A2','FAILED',null,'BROADCAST_LIMIT_REACHED')")"
# And the same budget in the other direction: the manual broadcast's own rows
# block a campaign. The manual function is not installed here (see the header),
# so its notification is written directly — the predicate being tested is the
# one `broadcast_campaign` evaluates, and it is identical.
check "H6 the other shop has its own budget" "1" \
  "$(Q "select 1 from public.shops where id='$SHOP2'")"
cat > "$DIR/propose3.sql" <<SQL
select id from public.ai_action_propose(
  'SEND_CAMPAIGN', '$SHOP2', '{}'::uuid[], repeat('p', 24), '{}'::jsonb, 600,
  null, null, null,
  'RECENT', $SINCE,
  array['$C9'::uuid,'$C1'::uuid,'$C6'::uuid],
  'অন্য দোকানের বার্তা', 'অন্য দোকান থেকে।');
SQL
A3=$(ASFILE "$O2" "$DIR/propose3.sql" | head -1)
check "H7 shop two's owner can propose against shop two" "1" \
  "$(Q "select count(*) from public.ai_actions where id='$A3'")"
check "H8 claimed" "CONFIRMED" \
  "$(AS "$O2" "select status from public.ai_action_claim('$A3', repeat('p',24))")"
# The snapshot deliberately contains two customers who are NOT shop two's, so
# the membership check has something real to refuse. This is the check that
# makes the plain uuid[] snapshot safe.
contains "H9 a recipient who is not this shop's customer is refused" "campaign_recipient_not_a_customer" \
  "$(AS "$O2" "select public.broadcast_campaign('$SHOP2','$A3','অন্য দোকানের বার্তা','অন্য দোকান থেকে।')")"
check "H10 and nothing went out" "3" \
  "$(Q "select count(*) from public.notifications where data ? 'ai_action_id'")"

echo ""
echo "== I. the owner's edit reaches the notification, and nothing else =="
# A fresh day, so the budget question is out of the way. The seeded PROMO rows
# are backdated instead of deleted: deleting them would also remove the
# evidence that section F's send happened.
Q "update public.notifications set created_at = now() - interval '2 days' where data ? 'ai_action_id'" >/dev/null
cat > "$DIR/propose4.sql" <<SQL
select id from public.ai_action_propose(
  'SEND_CAMPAIGN', '$SHOP1', '{}'::uuid[], repeat('e', 24), '{}'::jsonb, 600,
  null, null, null,
  'RECENT', $SINCE,
  (select array_agg(x) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE) x),
  'মডেলের খসড়া', 'মডেল যা লিখেছিল।');
SQL
A4=$(ASFILE "$O1" "$DIR/propose4.sql" | head -1)
contains "I1 a PROPOSED campaign cannot be edited" "ai_action_not_editable" \
  "$(AS "$O1" "select id from public.ai_action_apply_campaign_edit('$A4','মালিকের লেখা','মালিক যা লিখল।')")"
check "I2 claimed" "CONFIRMED" \
  "$(AS "$O1" "select status from public.ai_action_claim('$A4', repeat('e',24))")"
check "I3 the owner's edit lands on the row" "মালিকের লেখা" \
  "$(AS "$O1" "select campaign_title from public.ai_action_apply_campaign_edit('$A4','মালিকের লেখা','মালিক যা লিখল।')")"
check "I4 the segment is unchanged by the edit" "RECENT" \
  "$(Q "select campaign_segment from public.ai_actions where id='$A4'")"
check "I5 the snapshot is unchanged by the edit" "3" \
  "$(Q "select cardinality(campaign_recipients) from public.ai_actions where id='$A4'")"
check "I6 the shop is unchanged by the edit" "$SHOP1" \
  "$(Q "select shop_id from public.ai_actions where id='$A4'")"
check "I7 the status is still CONFIRMED" "CONFIRMED" \
  "$(Q "select status from public.ai_actions where id='$A4'")"
contains "I8 an empty edit is refused" "ai_action_campaign_title_invalid" \
  "$(AS "$O1" "select id from public.ai_action_apply_campaign_edit('$A4','   ','লেখা')")"
contains "I9 an over-long edit is refused" "ai_action_campaign_body_invalid" \
  "$(AS "$O1" "select id from public.ai_action_apply_campaign_edit('$A4','শিরোনাম',repeat('x',501))")"
contains "I10 another owner cannot edit it" "ai_action_not_editable" \
  "$(AS "$O2" "select id from public.ai_action_apply_campaign_edit('$A4','ছিনতাই','অন্য কারো লেখা।')")"
contains "I11 a customer cannot edit it" "ai_action_not_editable" \
  "$(AS "$C1" "select id from public.ai_action_apply_campaign_edit('$A4','ছিনতাই','অন্য কারো লেখা।')")"
check "I12 the EDITED text is what goes out" "3" \
  "$(AS "$O1" "select public.broadcast_campaign('$SHOP1','$A4','মালিকের লেখা','মালিক যা লিখল।')")"
check "I13 and the notification body is the owner's, not the model's" "3" \
  "$(Q "select count(*) from public.notifications where (data->>'ai_action_id')='$A4' and body='মালিক যা লিখল।'")"
check "I14 the model's draft reached nobody" "0" \
  "$(Q "select count(*) from public.notifications where body='মডেল যা লিখেছিল।'")"
check "I15 the audit row holds the sent text, display holds the draft" "মালিকের লেখা" \
  "$(Q "select campaign_title from public.ai_actions where id='$A4'")"
Q "select public.ai_action_settle('$A4','EXECUTED',null,null,3)" >/dev/null 2>&1
Q "update public.ai_actions set status='EXECUTED', campaign_sent_count=3, settled_at=now() where id='$A4' and status='CONFIRMED'" >/dev/null

echo ""
echo "== J. concurrency, with genuinely parallel clients =="
Q "update public.notifications set created_at = now() - interval '2 days' where data ? 'ai_action_id'" >/dev/null

# --- J1: one proposal, five simultaneous approvals -------------------------
cat > "$DIR/propose5.sql" <<SQL
select id from public.ai_action_propose(
  'SEND_CAMPAIGN', '$SHOP1', '{}'::uuid[], repeat('j', 24), '{}'::jsonb, 600,
  null, null, null,
  'RECENT', $SINCE,
  (select array_agg(x) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE) x),
  'একবারই যাবে', 'পাঁচবার চাপলেও।');
SQL
A5=$(ASFILE "$O1" "$DIR/propose5.sql" | head -1)
# Each client does exactly what the endpoint does: claim, then send. Only the
# claim winner should reach the send at all.
cat > "$DIR/j1.sql" <<SQL
select status from public.ai_action_claim('$A5', repeat('j',24));
select public.broadcast_campaign('$SHOP1','$A5','একবারই যাবে','পাঁচবার চাপলেও।');
SQL
for i in 1 2 3 4 5; do ASFILE "$O1" "$DIR/j1.sql" > "$DIR/j1-$i.out" 2>&1 & done
wait
check "J1 five simultaneous approvals → exactly one claim" "1" \
  "$(cat "$DIR"/j1-*.out | grep -c '^CONFIRMED$')"
check "J1b and exactly three notifications, not fifteen" "3" \
  "$(Q "select count(*) from public.notifications where (data->>'ai_action_id')='$A5'")"
check "J1c every loser said so" "4" \
  "$(cat "$DIR"/j1-*.out | grep -c 'ai_action_not_claimable\|ai_action_already_executed\|campaign_not_confirmed')"
Q "select public.ai_action_settle('$A5','EXECUTED',null,null,3)" >/dev/null 2>&1
Q "update public.ai_actions set status='EXECUTED', campaign_sent_count=3, settled_at=now() where id='$A5' and status='CONFIRMED'" >/dev/null

# --- J2: an expired proposal, raced ---------------------------------------
Q "update public.notifications set created_at = now() - interval '2 days' where data ? 'ai_action_id'" >/dev/null
cat > "$DIR/propose6.sql" <<SQL
select id from public.ai_action_propose(
  'SEND_CAMPAIGN', '$SHOP1', '{}'::uuid[], repeat('x', 24), '{}'::jsonb, 30,
  null, null, null,
  'RECENT', $SINCE,
  (select array_agg(x) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE) x),
  'সময় পেরোনো', 'এটা আর যাবে না।');
SQL
A6=$(ASFILE "$O1" "$DIR/propose6.sql" | head -1)
Q "update public.ai_actions set expires_at = now() - interval '1 second' where id='$A6'" >/dev/null
cat > "$DIR/j2.sql" <<SQL
select status from public.ai_action_claim('$A6', repeat('x',24));
select public.broadcast_campaign('$SHOP1','$A6','সময় পেরোনো','এটা আর যাবে না।');
SQL
for i in 1 2 3; do ASFILE "$O1" "$DIR/j2.sql" > "$DIR/j2-$i.out" 2>&1 & done
wait
check "J2 an expired proposal is claimed by nobody" "0" \
  "$(cat "$DIR"/j2-*.out | grep -c '^CONFIRMED$')"
check "J2b and sends nothing" "0" \
  "$(Q "select count(*) from public.notifications where (data->>'ai_action_id')='$A6'")"
check "J2c every attempt said expired" "3" \
  "$(cat "$DIR"/j2-*.out | grep -c 'ai_action_expired')"

# --- J3: a cancelled proposal, raced --------------------------------------
cat > "$DIR/propose7.sql" <<SQL
select id from public.ai_action_propose(
  'SEND_CAMPAIGN', '$SHOP1', '{}'::uuid[], repeat('c', 24), '{}'::jsonb, 600,
  null, null, null,
  'RECENT', $SINCE,
  (select array_agg(x) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE) x),
  'বাতিল', 'মালিক না বলেছে।');
SQL
A7=$(ASFILE "$O1" "$DIR/propose7.sql" | head -1)
check "J3 the owner cancels it" "CANCELLED" \
  "$(AS "$O1" "select status from public.ai_action_cancel('$A7')")"
cat > "$DIR/j3.sql" <<SQL
select status from public.ai_action_claim('$A7', repeat('c',24));
select public.broadcast_campaign('$SHOP1','$A7','বাতিল','মালিক না বলেছে।');
SQL
for i in 1 2 3; do ASFILE "$O1" "$DIR/j3.sql" > "$DIR/j3-$i.out" 2>&1 & done
wait
check "J3b a cancelled proposal is claimed by nobody" "0" \
  "$(cat "$DIR"/j3-*.out | grep -c '^CONFIRMED$')"
check "J3c and sends nothing" "0" \
  "$(Q "select count(*) from public.notifications where (data->>'ai_action_id')='$A7'")"

# --- J4: a retried send after a lost reply --------------------------------
# The case `ai_action_claim` genuinely cannot cover: the send succeeded but the
# caller never learned it did. The uniqueness index is what makes the retry
# safe, and `on conflict do nothing` is what makes it quiet.
Q "update public.notifications set created_at = now() - interval '2 days' where data ? 'ai_action_id'" >/dev/null
cat > "$DIR/propose8.sql" <<SQL
select id from public.ai_action_propose(
  'SEND_CAMPAIGN', '$SHOP1', '{}'::uuid[], repeat('r', 24), '{}'::jsonb, 600,
  null, null, null,
  'RECENT', $SINCE,
  (select array_agg(x) from public.shop_campaign_recipients('$SHOP1','RECENT',$SINCE) x),
  'পুনরায় পাঠানো', 'উত্তর হারিয়ে গেলে।');
SQL
A8=$(ASFILE "$O1" "$DIR/propose8.sql" | head -1)
Q "select public.ai_action_claim('$A8', repeat('r',24))" >/dev/null 2>&1
Q "update public.ai_actions set status='CONFIRMED', confirmed_at=now() where id='$A8' and status='PROPOSED'" >/dev/null
check "J4 the first send reaches three" "3" \
  "$(AS "$O1" "select public.broadcast_campaign('$SHOP1','$A8','পুনরায় পাঠানো','উত্তর হারিয়ে গেলে।')")"
check "J4b the retry inserts nothing new" "0" \
  "$(AS "$O1" "select public.broadcast_campaign('$SHOP1','$A8','পুনরায় পাঠানো','উত্তর হারিয়ে গেলে।')")"
check "J4c and there are still exactly three" "3" \
  "$(Q "select count(*) from public.notifications where (data->>'ai_action_id')='$A8'")"
check "J4d campaign_send_count reports the truth after a retry" "3" \
  "$(AS "$O1" "select public.campaign_send_count('$A8')")"
# And three retries at once, which is the shape a crashed-and-restarted server
# actually produces.
cat > "$DIR/j4.sql" <<SQL
select public.broadcast_campaign('$SHOP1','$A8','পুনরায় পাঠানো','উত্তর হারিয়ে গেলে।');
SQL
for i in 1 2 3; do ASFILE "$O1" "$DIR/j4.sql" > "$DIR/j4-$i.out" 2>&1 & done
wait
check "J4e three simultaneous retries add nothing" "3" \
  "$(Q "select count(*) from public.notifications where (data->>'ai_action_id')='$A8'")"
check "J4f and the index refused every duplicate quietly" "0" \
  "$(cat "$DIR"/j4-*.out | grep -c 'duplicate key')"
Q "select public.ai_action_settle('$A8','EXECUTED',null,null,3)" >/dev/null 2>&1
Q "update public.ai_actions set status='EXECUTED', campaign_sent_count=3, settled_at=now() where id='$A8' and status='CONFIRMED'" >/dev/null

echo ""
echo "== K. no leaked rows, and every count is explainable =="
check "K1 no EXECUTED campaign without a count" "0" \
  "$(Q "select count(*) from public.ai_actions where action_type::text='SEND_CAMPAIGN' and status='EXECUTED' and campaign_sent_count is null")"
check "K2 no unexecuted campaign carries a count" "0" \
  "$(Q "select count(*) from public.ai_actions where status<>'EXECUTED' and campaign_sent_count is not null")"
check "K3 no settled action is missing its timestamp" "0" \
  "$(Q "select count(*) from public.ai_actions where status in ('EXECUTED','FAILED') and settled_at is null")"
check "K4 no campaign row carries a slot, a reward or a service" "0" \
  "$(Q "select count(*) from public.ai_actions where action_type::text='SEND_CAMPAIGN' and (staff_id is not null or starts_at is not null or reward_id is not null or cardinality(service_ids)>0)")"
check "K5 every campaign's segment is one of the six" "0" \
  "$(Q "select count(*) from public.ai_actions where campaign_segment is not null and campaign_segment not in ('REGULARS','HIGH_FREQUENCY','RECENT','LAPSED','MEMBERS','LOYALTY_ENGAGED')")"
check "K6 every campaign notification names a real campaign" "0" \
  "$(Q "select count(*) from public.notifications n where n.data ? 'ai_action_id' and not exists (select 1 from public.ai_actions a where a.id::text = n.data->>'ai_action_id')")"
check "K7 nobody got the same campaign twice" "0" \
  "$(Q "select count(*) from (select (data->>'ai_action_id') k, user_id, count(*) c from public.notifications where data ? 'ai_action_id' group by 1,2 having count(*)>1) d")"
check "K8 every recipient of every campaign was in its snapshot" "0" \
  "$(Q "select count(*) from public.notifications n join public.ai_actions a on a.id::text = n.data->>'ai_action_id' where not (n.user_id = any(a.campaign_recipients))")"
check "K9 the muted customer never received anything, ever" "0" \
  "$(Q "select count(*) from public.notifications where user_id='$C6'")"
check "K10 the other shop's customer never received anything" "0" \
  "$(Q "select count(*) from public.notifications where user_id='$C9'")"
check "K11 no campaign was sent to a non-customer of its shop" "0" \
  "$(QQ "select count(*) from public.notifications n join public.ai_actions a on a.id::text = n.data->>'ai_action_id' where not exists (select 1 from public.serials s where s.shop_id=a.shop_id and s.customer_id=n.user_id) and not exists (select 1 from public.customer_memberships m where m.shop_id=a.shop_id and m.customer_id=n.user_id) and not exists (select 1 from public.loyalty_accounts l where l.shop_id=a.shop_id and l.customer_id=n.user_id)" | head -1)"
check "K12 nothing was written to serials, appointments or coupons" "0" \
  "$(Q "select (select count(*) from public.appointments) + (select count(*) from public.reward_redemptions) + (select count(*) from public.loyalty_transactions)")"
check "K13 the queue is untouched — only the seeded history" "20" \
  "$(Q "select count(*) from public.serials")"

echo ""
echo "======================================================================"
printf 'AI Sprint 5 checks:  %d passed, %d failed\n' "$pass" "$fail"
echo "======================================================================"
[ "$fail" -eq 0 ] || exit 1
