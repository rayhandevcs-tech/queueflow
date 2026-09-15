#!/usr/bin/env bash
#
# Sprint 10 — analytics, run against a throwaway local Postgres exactly as the
# other harnesses do.
#
#   bash supabase/tests/run-sprint10-checks.sh
#
# Applies 20260918 → … → 20260925 on top of the fixture, then builds three
# shops on purpose:
#
#   · shop A — a UNISEX shop with serials AND appointments, loyalty, a
#     membership, a converted referral and a redeemed reward
#   · shop B — its own smaller copy of all of that, so "isolation" means
#     scoping rather than an empty table
#   · shop C — completely empty, so every empty-state answer is exercised
#
# and walks the brief:
#
#   A. overview · B. booking metrics · C. revenue · D. appointments
#   E. salon queue · F. staff utilization · G. peak slots · H. loyalty
#   I. membership · J. referral · K. rewards · L. retention
#   M. empty states · N. date boundaries · O. cross-shop isolation
#   P. unauthorized access · Q. regression
#
# Many checks are INVARIANTS rather than hard-coded totals — "the trend sums
# to the overview", "staff revenue sums to the shop's own", "loyalty
# outstanding equals the ledger". Those catch a whole class of bug that a
# hand-computed number cannot, and they cannot be wrong because the author's
# arithmetic was.
#
# A green run means the migration is sound against a schema shaped like the
# real one. It is NOT proof that it will apply to production — the fixture is
# a stand-in, not a dump.
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PORT=5610
DIR=$(mktemp -d /tmp/qf-s10-XXXXXX)
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
  || { echo "initdb failed"; exit 1; }
su "$RUNAS" -s /bin/bash -c "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/pg.log start" >/dev/null 2>&1
sleep 2
su "$RUNAS" -s /bin/bash -c "$PGBIN/createdb -h $DIR -p $PORT -U postgres qf" || exit 1

Q()    { su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$1\"" 2>&1; }
FILE() { su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -v ON_ERROR_STOP=1 -q -f $1"; }
AS()   { su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=app_user -c test.uid=$1' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$2\"" 2>&1 | head -1; }
OK()   { Q "$1" >/dev/null 2>&1 && echo OK || echo FAIL; }

ERRS='analytics_shop_required|analytics_range_required|analytics_range_reversed|analytics_range_too_wide|analytics_bucket_invalid|analytics_dimension_invalid|not your shop|permission denied|violates row-level security'
WHY()  { Q  "$1"      2>&1 | grep -oE "$ERRS" | head -1; }
WHYAS(){ AS "$1" "$2"      | grep -oE "$ERRS" | head -1; }

echo "== applying migrations =="
FILE "$HERE/fixture.sql" >/dev/null || exit 1
Q "alter table public.shops add column if not exists logo_url text" >/dev/null

# The salon stand-in, with every column the analytics RPCs read.
Q "create table public.serials (
     id uuid primary key default gen_random_uuid(),
     shop_id uuid not null references public.shops(id) on delete cascade,
     chair_id uuid references public.chairs(id),
     customer_id uuid references public.profiles(id),
     customer_name text,
     status text not null default 'WAITING',
     total_amount numeric(10,2) not null default 0,
     payment_status text not null default 'DUE',
     payment_method text,
     due_amount numeric(10,2) not null default 0,
     due_collected_at timestamptz,
     due_reminded_at timestamptz,
     service_ids uuid[] not null default '{}',
     services_snapshot jsonb not null default '[]'::jsonb,
     booked_at timestamptz not null default now(),
     started_at timestamptz,
     completed_at timestamptz,
     created_at timestamptz not null default now()
   )" >/dev/null

# manual_entries — the third income source the overview and trend both read.
Q "create table public.manual_entries (
     id uuid primary key default gen_random_uuid(),
     shop_id uuid not null references public.shops(id) on delete cascade,
     chair_id uuid references public.chairs(id),
     service_id uuid references public.services(id),
     amount numeric(10,2) not null,
     -- The real table (20260818) carries payment_method as well, and the
     -- PAYMENT_METHOD breakdown reads it. A stub missing a column the RPC
     -- selects is a harness bug, not a migration bug — it cost one run.
     payment_method text check (payment_method in ('cash','bkash','nagad','rocket','card')),
     payment_status text not null default 'PAID',
     note text,
     created_at timestamptz not null default now()
   )" >/dev/null
Q "alter table public.manual_entries enable row level security" >/dev/null
Q "create policy \\\"manual: owner\\\" on public.manual_entries for all
     using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id))" >/dev/null

su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -q" <<'STUBS' >/dev/null
create or replace function public.send_due_reminder(p uuid) returns void language plpgsql as $x$ begin end $x$;
create or replace function public.send_daily_summaries(p_day date default null) returns int language sql as $x$ select 0 $x$;
create or replace function public.send_customer_reminders() returns int language sql as $x$ select 0 $x$;
create or replace function public.serial_before_update() returns trigger language plpgsql as $x$
  begin
    if new.status = 'DONE' then
      new.completed_at := coalesce(old.completed_at, now());
    end if;
    if not (old.status = 'IN_PROGRESS' and new.status = 'DONE') then
      new.total_amount := old.total_amount;
    end if;
    return new;
  end $x$;
create trigger serials_before_update before update on public.serials
  for each row execute function public.serial_before_update();
create or replace function public.serial_after_update() returns trigger language plpgsql as $x$ begin return null; end $x$;
create trigger serials_after_update after update on public.serials
  for each row execute function public.serial_after_update();
create trigger serials_sync_queue_public after insert or update on public.serials
  for each row execute function public.serial_after_update();
-- RLS on the serials stand-in, so the isolation section tests something real.
alter table public.serials enable row level security;
create policy "serials: owner" on public.serials for all
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));
create policy "serials: own" on public.serials for select
  using (customer_id = auth.uid());
STUBS

for m in 20260918_appointment_core 20260919_appointment_availability \
         20260920_appointment_money 20260921_membership 20260922_loyalty \
         20260923_referral 20260924_rewards 20260925_analytics; do
  if ! FILE "$ROOT/supabase/migrations/$m.sql" >/dev/null 2>"$DIR/err"; then
    echo "  MIGRATION FAILED: $m"; sed 's/^/    /' "$DIR/err" | head -25; exit 1
  fi
  echo "  applied $m"
done
FILE "$ROOT/supabase/migrations/20260925_analytics.sql" >/dev/null 2>&1
check "re-running 20260925 is safe (idempotent)" OK "$(OK 'select 1')"
FILE "$HERE/seed.sql" >/dev/null

OA=11111111-1111-1111-1111-111111111111
OB=22222222-2222-2222-2222-222222222222
OC=77777777-7777-7777-7777-777777777777
C1=33333333-3333-3333-3333-333333333333
C2=44444444-4444-4444-4444-444444444444
C3=55555555-5555-5555-5555-555555555555
C4=66666666-6666-6666-6666-666666666666
C5=88888888-8888-8888-8888-888888888888
S=aaaaaaaa-0000-0000-0000-000000000001
SB=bbbbbbbb-0000-0000-0000-000000000002
SC=cccccccc-1111-1111-1111-111111111111
ST=cccccccc-0000-0000-0000-000000000001
ST2=cccccccc-0000-0000-0000-000000000002
STB=dddddddd-0000-0000-0000-000000000001
SV=eeeeeeee-0000-0000-0000-000000000001
SV2=eeeeeeee-0000-0000-0000-000000000002
SVB=ffffffff-0000-0000-0000-000000000001

Q "insert into profiles (id, full_name, phone) values
     ('$C3','Sumona Akter','01900000005'),
     ('$C4','Tania Begum','01900000006'),
     ('$C5','Ruma Khatun','01900000007'),
     ('$OC','Owner C','01700000003')" >/dev/null
# The empty shop. Every "no data" answer below is measured against this one.
Q "insert into shops (id, owner_id, name, business_type) values
     ('$SC','$OC','Empty Parlour','PARLOUR')" >/dev/null

# ---------------------------------------------------------------------------
# Seeding HISTORY means writing the past, which the live triggers refuse
# ---------------------------------------------------------------------------
# `appointment_before_insert` rejects a slot in the past and computes
# ends_at/total_amount/services_snapshot itself; `appointment_before_update`
# freezes them. Both are right, and both are tested in their own harnesses —
# but neither lets a test build last week. So the two triggers are disabled
# for the seeding block only, explicitly, and every value is supplied by hand.
# That is a visible manoeuvre rather than a hidden dependency on what time it
# happens to be (the trap that made Sprint 5.1's harness flaky).
Q "alter table public.appointments disable trigger appointment_before_insert_trg" >/dev/null 2>&1
Q "alter table public.appointments disable trigger appointments_before_insert" >/dev/null 2>&1
Q "alter table public.appointments disable trigger appointments_before_update" >/dev/null 2>&1

DHK() { echo "((current_date - $1 + time '$2') at time zone 'Asia/Dhaka')"; }
SNAP() { echo "jsonb_build_array(jsonb_build_object('service_id','$1','name','$2','rate',$3,'estimated_duration_min',60))"; }

NEWS() { # shop chair customer status total payment daysAgo hh:mm  -> serial id
  Q "insert into serials (shop_id, chair_id, customer_id, customer_name, status,
                          total_amount, payment_status, service_ids, services_snapshot,
                          booked_at, started_at, completed_at)
     values ('$1', '$2', $3, 'X', '$4', $5, '$6',
             array['$SV'::uuid], $(SNAP "$SV" Facial "$5"),
             $(DHK "$7" "$8") - interval '30 minutes',
             case when '$4' = 'DONE' then $(DHK "$7" "$8") - interval '20 minutes' else null end,
             case when '$4' = 'DONE' then $(DHK "$7" "$8") else null end)
     returning id" | head -1
}
NEWA() { # shop staff customer status total payment daysAgo hh:mm minutes -> id
  Q "insert into appointments (shop_id, staff_id, customer_id, customer_name, status,
                               total_amount, payment_status, service_ids, services_snapshot,
                               starts_at, ends_at, booked_at, completed_at)
     values ('$1','$2',$3,'X','$4',$5,'$6',
             array['$SV'::uuid], $(SNAP "$SV" Facial "$5"),
             $(DHK "$7" "$8"), $(DHK "$7" "$8") + interval '$9 minutes',
             $(DHK "$7" "$8") - interval '3 days',
             case when '$4' = 'DONE' then $(DHK "$7" "$8") + interval '$9 minutes' else null end)
     returning id" | head -1
}

# ---- shop A: a unisex shop. Serials AND appointments. ----
SR1=$(NEWS "$S" "$ST" "'$C1'" DONE      800  PAID 1 12:00)
SR2=$(NEWS "$S" "$ST" "'$C2'" DONE      1200 DUE  2 15:00)
SR3=$(NEWS "$S" "$ST" "null"  DONE      500  PAID 3 10:00)   # walk-in
SR4=$(NEWS "$S" "$ST" "'$C1'" CANCELLED 0    DUE  2 16:00)
SR5=$(NEWS "$S" "$ST" "'$C3'" NO_SHOW   0    DUE  3 17:00)
# Outside the 7-day window on purpose: it is what makes C1 a RETURNING
# customer, and it proves the range filter actually excludes things.
SROLD=$(NEWS "$S" "$ST" "'$C1'" DONE    900  PAID 40 12:00)

AP1=$(NEWA "$S" "$ST2" "'$C2'" DONE      1000 PAID 2 14:00 60)
AP2=$(NEWA "$S" "$ST2" "'$C3'" DONE      1500 DUE  4 11:00 120)
AP3=$(NEWA "$S" "$ST2" "'$C1'" CANCELLED 0    DUE  3 16:00 60)
AP4=$(NEWA "$S" "$ST2" "'$C2'" NO_SHOW   0    DUE  5 10:00 60)
# Future — must be invisible to a past-facing window.
APF=$(Q "insert into appointments (shop_id, staff_id, customer_id, customer_name, status,
            total_amount, payment_status, service_ids, services_snapshot, starts_at, ends_at, booked_at)
         values ('$S','$ST2','$C4','X','BOOKED',700,'DUE',array['$SV'::uuid],
                 $(SNAP "$SV" Facial 700),
                 ((current_date + 2 + time '12:00') at time zone 'Asia/Dhaka'),
                 ((current_date + 2 + time '13:00') at time zone 'Asia/Dhaka'),
                 now()) returning id" | head -1)

Q "insert into manual_entries (shop_id, chair_id, amount, payment_method, payment_status, created_at)
   values ('$S','$ST',300,'cash','PAID', $(DHK 1 11:00))" >/dev/null

# ---- shop B: its own data, so isolation is about scope, not emptiness ----
SRB=$(NEWS "$SB" "$STB" "'$C2'" DONE 2000 PAID 1 12:00)
APB=$(NEWA "$SB" "$STB" "'$C3'" DONE 3000 PAID 2 14:00 90)
Q "insert into manual_entries (shop_id, chair_id, amount, payment_method, payment_status, created_at)
   values ('$SB','$STB',900,'cash','PAID', $(DHK 1 11:00))" >/dev/null

Q "alter table public.appointments enable trigger appointment_before_insert_trg" >/dev/null 2>&1
Q "alter table public.appointments enable trigger appointments_before_insert" >/dev/null 2>&1
Q "alter table public.appointments enable trigger appointments_before_update" >/dev/null 2>&1

# `chairs_seed_staff_hours` (20260919) already gave BOTH seats hours, copied
# from the shop's weekly_hours — 10:00–20:00 every day, so 600 min/day. That
# is the real denominator for seat 2 and nothing needs inserting.
#
# Seat 1's hours are DELETED on purpose: a seat whose hours were never set is
# the case decision 69 is about, and it has to be reachable to be tested.
check "the seeding trigger gave both seats hours" 14 \
  "$(Q "select count(*) from staff_working_hours swh join chairs c on c.id = swh.chair_id where c.shop_id = '$S'")"
Q "delete from staff_working_hours where chair_id = '$ST'" >/dev/null

Q "drop owned by app_user" >/dev/null 2>&1; Q "drop role if exists app_user" >/dev/null 2>&1
Q "create role app_user nologin" >/dev/null
Q "grant usage on schema public, auth to app_user" >/dev/null
Q "grant select,insert,update,delete on all tables in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema auth to app_user" >/dev/null

# ---- loyalty, referral, membership and a reward, all through their own doors ----
AS "$OA" "insert into loyalty_settings (shop_id, is_enabled, taka_per_point, referral_enabled,
            referral_referrer_points, referral_referred_points)
          values ('$S', true, 100, true, 10, 5)" >/dev/null
AS "$OB" "insert into loyalty_settings (shop_id, is_enabled, taka_per_point) values ('$SB', true, 100)" >/dev/null

# Real EARN rows through loyalty_award, tied to real jobs — not hand-written
# ledger rows, because the ledger has no INSERT policy and should not.
AS "$OA" "select loyalty_award('$S','$C1',8,'EARN_SERIAL','$SR1',null,800,100,null)" >/dev/null
AS "$OA" "select loyalty_award('$S','$C2',10,'EARN_APPOINTMENT',null,'$AP1',1000,100,null)" >/dev/null
AS "$OA" "select loyalty_adjust('$S','$C1',500,'ZZ seed')" >/dev/null
AS "$OA" "select loyalty_adjust('$S','$C1',-50,'ZZ correction')" >/dev/null
AS "$OB" "select loyalty_adjust('$SB','$C2',700,'ZZ seed')" >/dev/null

# A reward, redeemed for real: that is the only way a REDEEM ledger row exists.
RW=$(AS "$OA" "insert into rewards (shop_id,name,kind,points_cost,value)
                values ('$S','ZZ Hundred Off','DISCOUNT_FLAT',200,100) returning id")
RWB=$(AS "$OB" "insert into rewards (shop_id,name,kind,points_cost,value)
                 values ('$SB','ZZ Fifty Off','DISCOUNT_FLAT',100,50) returning id")
CODE=$(AS "$C1" "select redemption_code from redeem_reward('$S','$RW')")

# The bill that coupon will land on. It belongs to **C1**, the customer who
# redeemed it: `mark_redemption_used` refuses one person's coupon on another
# person's bill (`redemption_wrong_customer`), so a fixture that applied C1's
# coupon to C4's serial below would only be testing Sprint 9's guard.
#
# It is left OPEN here on purpose. The coupon is verified in section K while
# the job is still running — the way it happens at a counter — and the serial
# is only then closed, so the discount is applied by the Sprint 9 trigger and
# the revenue figures can be checked against the **final** amount.
SR7=$(Q "insert into serials (shop_id, chair_id, customer_id, customer_name, status,
            total_amount, payment_status, service_ids, services_snapshot, booked_at)
         values ('$S','$ST','$C1','X','WAITING',700,'DUE',array['$SV'::uuid],
                 $(SNAP "$SV" Facial 700), now()) returning id" | head -1)

# A referral that really converts. The claimer must be NEW to the shop —
# `claim_referral` refuses anyone who already has completed work here
# (Sprint 8's `referral_not_a_new_customer`), which is why this is C4 and not
# C3: C3 already has a finished appointment above.
RC=$(AS "$C1" "select my_referral_code('$S')")
CLAIMED=$(AS "$C4" "select claim_referral('$S','$RC')")
check "the referral claim was accepted (C4 is new to this shop)" "t" \
  "$(Q "select '$CLAIMED' ~ '^[0-9a-f-]{36}\$'")"
SR6=$(Q "insert into serials (shop_id, chair_id, customer_id, customer_name, status,
            total_amount, payment_status, service_ids, services_snapshot, booked_at)
         values ('$S','$ST','$C4','X','WAITING',600,'DUE',array['$SV'::uuid],
                 $(SNAP "$SV" Facial 600), now()) returning id" | head -1)
AS "$OA" "update serials set status='IN_PROGRESS' where id='$SR6'" >/dev/null
AS "$OA" "update serials set status='DONE', payment_status='PAID', total_amount=600 where id='$SR6'" >/dev/null

# Membership: a tier and two enrolments, one paid and one still due.
TIER=$(AS "$OA" "insert into membership_tiers (shop_id,name,price,duration_days)
                  values ('$S','ZZ Gold',5000,180) returning id")
# Sprint 6's insert trigger lands every enrolment on PENDING — the status
# machine is PENDING → ACTIVE — so activating is a deliberate second step,
# exactly as the owner's own UI does it.
AS "$OA" "insert into customer_memberships (shop_id, customer_id, tier_id, payment_status, payment_method, paid_at)
          values ('$S','$C1','$TIER','PAID','cash', now())" >/dev/null
AS "$OA" "update customer_memberships set status='ACTIVE'
           where shop_id='$S' and customer_id='$C1'" >/dev/null
AS "$OA" "insert into customer_memberships (shop_id, customer_id, tier_id)
          values ('$S','$C2','$TIER')" >/dev/null
TIERB=$(AS "$OB" "insert into membership_tiers (shop_id,name,price,duration_days)
                   values ('$SB','ZZ Silver',2000,90) returning id")
AS "$OB" "insert into customer_memberships (shop_id, customer_id, tier_id, payment_status, payment_method, paid_at)
          values ('$SB','$C3','$TIERB','PAID','cash', now())" >/dev/null
AS "$OB" "update customer_memberships set status='ACTIVE'
           where shop_id='$SB' and customer_id='$C3'" >/dev/null

# The window under test everywhere below: the last 7 local days, inclusive.
F7="current_date - 6"
T0="current_date"
OV() { AS "$OA" "select $1 from shop_overview_stats('$S', $F7, $T0)"; }

echo
echo "== structure =="
check "no analytics table was created (decision 67)" "t" \
  "$(Q "select to_regclass('public.analytics_events') is null and to_regclass('public.analytics_daily') is null and to_regclass('public.shop_analytics') is null and to_regclass('public.analytics_snapshots') is null")"
check "analytics_scope exists"  "t" "$(Q "select to_regprocedure('public.analytics_scope(uuid,date,date)') is not null")"
check "all 11 analytics RPCs exist" 11 \
  "$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('shop_overview_stats','shop_revenue_trend','shop_appointment_stats','shop_queue_stats','shop_staff_stats','shop_peak_slots','shop_loyalty_stats','shop_membership_stats','shop_referral_summary','shop_reward_stats','shop_analytics_breakdown')")"
check "**every analytics function is SECURITY INVOKER**" "t" \
  "$(Q "select not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.proname in ('analytics_scope','shop_overview_stats','shop_revenue_trend','shop_appointment_stats','shop_queue_stats','shop_staff_stats','shop_peak_slots','shop_loyalty_stats','shop_membership_stats','shop_referral_summary','shop_reward_stats','shop_analytics_breakdown'))")"
check "**every analytics function is read-only (STABLE, never VOLATILE)**" "t" \
  "$(Q "select not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.provolatile='v' and p.proname in ('analytics_scope','shop_overview_stats','shop_revenue_trend','shop_appointment_stats','shop_queue_stats','shop_staff_stats','shop_peak_slots','shop_loyalty_stats','shop_membership_stats','shop_referral_summary','shop_reward_stats','shop_analytics_breakdown'))")"
check "the serials (shop_id, completed_at) index landed" "t" \
  "$(Q "select exists (select 1 from pg_indexes where indexname='serials_shop_completed_idx')")"
check "appointments still has no started_at (so no actual-duration metric)" "t" \
  "$(Q "select not exists (select 1 from information_schema.columns where table_name='appointments' and column_name='started_at')")"

echo
echo "== P. the gate: unauthorized and malformed calls =="
check "**another shop's owner is refused, not given zeros**" "not your shop" \
  "$(WHYAS "$OB" "select * from shop_overview_stats('$S', $F7, $T0)")"
check "    …and so is every other RPC"  "not your shop|not your shop|not your shop|not your shop" \
  "$(printf '%s|%s|%s|%s' \
      "$(WHYAS "$OB" "select * from shop_appointment_stats('$S', $F7, $T0)")" \
      "$(WHYAS "$OB" "select * from shop_staff_stats('$S', $F7, $T0)")" \
      "$(WHYAS "$OB" "select * from shop_loyalty_stats('$S', $F7, $T0)")" \
      "$(WHYAS "$OB" "select * from shop_reward_stats('$S', $F7, $T0)")")"
check "**a customer is refused provider analytics**" "not your shop" \
  "$(WHYAS "$C1" "select * from shop_overview_stats('$S', $F7, $T0)")"
check "**an unauthenticated caller is refused**" "not your shop" \
  "$(WHY "select * from shop_overview_stats('$S', $F7, $T0)")"
check "a null shop is refused"              "analytics_shop_required" \
  "$(WHYAS "$OA" "select * from shop_overview_stats(null, $F7, $T0)")"
check "a null date is refused"              "not your shop" \
  "$(WHYAS "$OB" "select * from shop_overview_stats('$S', null, $T0)")"
check "    …and for the owner, it is the date that is refused" "analytics_range_required" \
  "$(WHYAS "$OA" "select * from shop_overview_stats('$S', null, $T0)")"
check "a reversed range is refused"         "analytics_range_reversed" \
  "$(WHYAS "$OA" "select * from shop_overview_stats('$S', $T0, $F7)")"
check "an unbounded range is refused"       "analytics_range_too_wide" \
  "$(WHYAS "$OA" "select * from shop_overview_stats('$S', current_date - 4000, $T0)")"
check "a nonsense trend bucket is refused"  "analytics_bucket_invalid" \
  "$(WHYAS "$OA" "select * from shop_revenue_trend('$S', $F7, $T0, 'FORTNIGHT')")"
check "a nonsense breakdown dimension is refused" "analytics_dimension_invalid" \
  "$(WHYAS "$OA" "select * from shop_analytics_breakdown('$S', $F7, $T0, 'ASTROLOGY')")"
check "a made-up shop id is refused"        "not your shop" \
  "$(WHYAS "$OA" "select * from shop_overview_stats('00000000-0000-0000-0000-000000000000', $F7, $T0)")"

echo
echo "== A. overview, and L. retention =="
check "7 jobs finished in the window"       7 "$(OV jobs_completed)"
# 7 touched: five in the window, the no-show, and SR7 — which is still open
# and therefore counted by booked_at, not by a completion it does not have.
check "serials: 7 touched, 4 finished"      "7|4" "$(OV "serials_total || '|' || serials_completed")"
check "serials: 1 cancelled, 1 no-show"     "1|1" "$(OV "serials_cancelled || '|' || serials_no_show")"
check "appointments: 4 in the window"       4 "$(OV appointments_total)"
check "    **the future one is excluded**"  "t" \
  "$(Q "select starts_at > now() from appointments where id='$APF'")"
check "appointments: 2 done, 1 cancelled, 1 no-show" "2|1|1" \
  "$(OV "appointments_completed || '|' || appointments_cancelled || '|' || appointments_no_show")"
check "1 manual entry"                      1 "$(OV manual_entries)"
check "revenue total 5900 (3100 queue + 2500 parlour + 300 manual)" "5900.00" "$(OV "revenue_total::text")"
check "    collected 3200"                  "3200.00" "$(OV "revenue_collected::text")"
check "    due 2700"                        "2700.00" "$(OV "revenue_due::text")"
check "**collected + due == total**"        "t" \
  "$(AS "$OA" "select revenue_collected + revenue_due = revenue_total from shop_overview_stats('$S', $F7, $T0)")"
check "avg ticket 5900/7 = 842.86"          "842.86" "$(OV "avg_ticket::text")"
check "4 customers served"                  4 "$(OV customers_unique)"
check "**3 new, 1 returning** (only C1 was here 40 days ago)" "3|1" \
  "$(OV "customers_new || '|' || customers_returning")"
check "**new + returning == unique**"       "t" \
  "$(AS "$OA" "select customers_new + customers_returning = customers_unique from shop_overview_stats('$S', $F7, $T0)")"
check "1 customer came more than once"      1 "$(OV customers_repeat)"
check "2 walk-ins (one serial, one manual entry)" 2 "$(OV walk_ins)"

echo
echo "== C. revenue trend =="
check "a 7-day window gives 7 daily buckets" 7 \
  "$(AS "$OA" "select count(*) from shop_revenue_trend('$S', $F7, $T0, 'DAY')")"
check "**the trend sums to the overview total**" "t" \
  "$(AS "$OA" "select (select sum(revenue_total) from shop_revenue_trend('$S', $F7, $T0, 'DAY'))
                    = (select revenue_total from shop_overview_stats('$S', $F7, $T0))")"
check "**and its collected column does too**"   "t" \
  "$(AS "$OA" "select (select sum(revenue_collected) from shop_revenue_trend('$S', $F7, $T0, 'DAY'))
                    = (select revenue_collected from shop_overview_stats('$S', $F7, $T0))")"
check "**and its job count does too**"          "t" \
  "$(AS "$OA" "select (select sum(jobs) from shop_revenue_trend('$S', $F7, $T0, 'DAY'))
                    = (select jobs_completed from shop_overview_stats('$S', $F7, $T0))")"
check "empty days come back as zero, not missing" "t" \
  "$(AS "$OA" "select count(*) > 0 from shop_revenue_trend('$S', $F7, $T0, 'DAY') where revenue_total = 0")"
check "buckets are ordered oldest first"        "t" \
  "$(AS "$OA" "select bucket_start = ($F7) from shop_revenue_trend('$S', $F7, $T0, 'DAY') limit 1")"
check "a month bucket over one month gives one row" 1 \
  "$(AS "$OA" "select count(*) from shop_revenue_trend('$S', date_trunc('month', current_date)::date, $T0, 'MONTH')")"

echo
echo "== D. appointment metrics =="
AP() { AS "$OA" "select $1 from shop_appointment_stats('$S', $F7, $T0)"; }
check "4 appointments, 2 completed"        "4|2" "$(AP "total || '|' || completed")"
check "1 cancelled, 1 no-show, 0 still booked" "1|1|0" \
  "$(AP "cancelled || '|' || no_show || '|' || booked")"
check "**completion rate 50.0% of settled**" "50.0" "$(AP "completion_rate::text")"
check "no-show rate 25.0%"                  "25.0" "$(AP "no_show_rate::text")"
check "cancel rate 25.0%"                   "25.0" "$(AP "cancel_rate::text")"
check "**the three rates sum to 100**"      "t" \
  "$(AS "$OA" "select completion_rate + no_show_rate + cancel_rate = 100.0 from shop_appointment_stats('$S', $F7, $T0)")"
check "avg SCHEDULED minutes is 90 (60 and 120)" "90.0" "$(AP "avg_scheduled_min::text")"
check "lead time is measured, not guessed"  "3.0" "$(AP "avg_lead_days::text")"

echo
echo "== E. salon queue metrics =="
QS() { AS "$OA" "select $1 from shop_queue_stats('$S', $F7, $T0)"; }
check "7 serials touched, 4 finished"      "7|4" "$(QS "total || '|' || completed")"
check "1 cancelled, 1 no-show"             "1|1" "$(QS "cancelled || '|' || no_show")"
check "1 walk-in finished"                 1 "$(QS walk_ins)"
check "completion rate 66.7% of settled"   "66.7" "$(QS "completion_rate::text")"
check "**avg service time is MEASURED (started_at → completed_at)**" "t" \
  "$(QS "avg_service_min is not null")"
check "**avg wait is MEASURED (booked_at → started_at)**"            "t" \
  "$(QS "avg_wait_min is not null")"
check "the busiest day is a real date in range" "t" \
  "$(QS "busiest_day between ($F7) and ($T0)")"

echo
echo "== F. staff utilization, with a real denominator =="
SS() { AS "$OA" "select $1 from shop_staff_stats('$S', $F7, $T0) where staff_id='$2'"; }
check "shop A has exactly its own two seats" 2 \
  "$(AS "$OA" "select count(*) from shop_staff_stats('$S', $F7, $T0)")"
check "seat 1 did 4 queue jobs, 0 appointments" "4|0" "$(SS "serial_jobs || '|' || appointment_jobs" "$ST")"
check "seat 2 did 0 queue jobs, 2 appointments" "0|2" "$(SS "serial_jobs || '|' || appointment_jobs" "$ST2")"
check "seat 1 earned 3100"                  "3100.00" "$(SS "revenue_total::text" "$ST")"
check "seat 2 earned 2500"                  "2500.00" "$(SS "revenue_total::text" "$ST2")"
check "**staff revenue sums to the shop's, minus manual entries**" "t" \
  "$(AS "$OA" "select (select sum(revenue_total) from shop_staff_stats('$S', $F7, $T0))
                    = (select revenue_total - 300 from shop_overview_stats('$S', $F7, $T0))")"
check "seat 2 booked 180 minutes"           180 "$(SS booked_minutes "$ST2")"
check "**seat 2's denominator is its configured hours: 7 × 600**" 4200 \
  "$(SS working_minutes "$ST2")"
check "**so utilization is 180/4200 = 4.3%**" "4.3" "$(SS "utilization_pct::text" "$ST2")"
check "**seat 1 has no hours set, so working_minutes is NULL**" "t" \
  "$(SS "working_minutes is null" "$ST")"
check "**and its utilization is NULL — not 0, not 100**" "t" \
  "$(SS "utilization_pct is null" "$ST")"
check "seat 1 carries its cancellation and no-show" "1|1" \
  "$(SS "cancelled || '|' || no_show" "$ST")"

echo
echo "== G. peak slots =="
PK() { AS "$OA" "select coalesce(sum(jobs),0) from shop_peak_slots('$S', $F7, $T0) where bucket_kind='$1' and source='$2'"; }
check "queue hours sum to the finished serials"      4 "$(PK HOUR SERIAL)"
check "queue weekdays sum to the same"               4 "$(PK WEEKDAY SERIAL)"
# 3, not 2 and not 4: the two completed slots plus the no-show (demand that
# held a seat), and NOT the cancellation (demand that was given back).
check "**appointment hours count booked SLOTS, not completions**" 3 "$(PK HOUR APPOINTMENT)"
check "appointment weekdays sum to the same"         3 "$(PK WEEKDAY APPOINTMENT)"
check "    the cancelled slot is excluded"           "t" \
  "$(AS "$OA" "select not exists (select 1 from shop_peak_slots('$S', $F7, $T0)
                 where bucket_kind='HOUR' and source='APPOINTMENT' and bucket=16)")"
check "the two sources are reported separately"      "t" \
  "$(AS "$OA" "select count(distinct source) = 2 from shop_peak_slots('$S', $F7, $T0)")"
check "hours are 0–23 in Dhaka local time"           "t" \
  "$(AS "$OA" "select bool_and(bucket between 0 and 23) from shop_peak_slots('$S', $F7, $T0) where bucket_kind='HOUR'")"
check "weekdays are isodow 1–7"                      "t" \
  "$(AS "$OA" "select bool_and(bucket between 1 and 7) from shop_peak_slots('$S', $F7, $T0) where bucket_kind='WEEKDAY'")"
check "a 14:00 appointment is bucketed at hour 14"   "t" \
  "$(AS "$OA" "select exists (select 1 from shop_peak_slots('$S', $F7, $T0) where bucket_kind='HOUR' and source='APPOINTMENT' and bucket=14)")"

echo
echo "== H. loyalty, from the ledger and nowhere else =="
LY() { AS "$OA" "select $1 from shop_loyalty_stats('$S', $F7, $T0)"; }
check "the programme reads as on"          "t" "$(LY is_enabled)"
check "3 accounts, all holding points"     "3|3" "$(LY "accounts || '|' || accounts_with_balance")"
check "**outstanding == the sum of loyalty_accounts.balance**" "t" \
  "$(AS "$OA" "select (select outstanding_points from shop_loyalty_stats('$S', $F7, $T0))
                    = (select sum(balance) from loyalty_accounts where shop_id='$S')")"
check "**outstanding == the ledger's own sum**"               "t" \
  "$(AS "$OA" "select (select outstanding_points from shop_loyalty_stats('$S', $F7, $T0))
                    = (select sum(points) from loyalty_transactions where shop_id='$S')")"
check "**earned == every positive ledger row**"               "t" \
  "$(AS "$OA" "select (select earned_points from shop_loyalty_stats('$S', $F7, $T0))
                    = (select sum(points) from loyalty_transactions where shop_id='$S' and points > 0)")"
check "**redeemed is reported positive, and is the REDEEM row**" 200 "$(LY redeemed_points)"
check "adjusted is the net of the two hand corrections"       450 "$(LY adjusted_points)"
check "**referral points are broken out separately: 10 + 5**" 15 "$(LY referral_points)"
check "lifetime == earned, since nothing predates the window" "t" \
  "$(AS "$OA" "select (select lifetime_points from shop_loyalty_stats('$S', $F7, $T0))
                    = (select earned_points from shop_loyalty_stats('$S', $F7, $T0))")"
check "**earned − redeemed + negative adjusts == outstanding**" "t" \
  "$(AS "$OA" "select (select earned_points - redeemed_points from shop_loyalty_stats('$S', $F7, $T0))
                    - (select coalesce(-sum(points),0) from loyalty_transactions
                        where shop_id='$S' and kind='ADJUST' and points < 0)
                    = (select outstanding_points from shop_loyalty_stats('$S', $F7, $T0))")"
check "8 ledger rows in the window"        8 "$(LY transactions)"
check "3 customers earned something"       3 "$(LY earning_customers)"

echo
echo "== I. membership, with Sprint 6's reality respected =="
MB() { AS "$OA" "select $1 from shop_membership_stats('$S', $F7, $T0)"; }
check "1 tier, active"                     "1|1" "$(MB "tiers_total || '|' || tiers_active")"
check "1 active member, 1 pending"         "1|1" "$(MB "active_members || '|' || pending_members")"
check "0 expired, 0 cancelled"             "0|0" "$(MB "expired_members || '|' || cancelled_members")"
check "**revenue is COLLECTED only (paid_at in range)**" "5000.00" "$(MB "revenue_collected::text")"
check "the unpaid one shows as due, not as revenue"     "5000.00" "$(MB "revenue_due::text")"
check "2 enrolled in the window"           2 "$(MB new_in_range)"
check "2 distinct members"                 2 "$(MB members_unique)"
check "**Sprint 6's own summary RPC still answers as before**" "1|1" \
  "$(AS "$OA" "select active_count || '|' || pending_count from shop_membership_summary('$S')")"
check "by-tier breakdown names the tier"   "ZZ Gold" \
  "$(AS "$OA" "select label from shop_analytics_breakdown('$S', $F7, $T0, 'MEMBERSHIP_TIER') limit 1")"
check "    and counts both enrolments"     2 \
  "$(AS "$OA" "select jobs from shop_analytics_breakdown('$S', $F7, $T0, 'MEMBERSHIP_TIER') limit 1")"

echo
echo "== J. referral, using Sprint 8's conversion definition =="
RF() { AS "$OA" "select $1 from shop_referral_summary('$S', $F7, $T0)"; }
check "the programme reads as on"          "t" "$(RF is_enabled)"
check "1 code issued"                      1 "$(RF codes_issued)"
check "1 referral, 0 pending, 1 converted" "1|0|1" \
  "$(RF "referrals_total || '|' || referrals_pending || '|' || referrals_converted")"
check "**conversion rate 100.0%**"         "100.0" "$(RF "conversion_rate::text")"
check "1 active referrer"                  1 "$(RF referrers_active)"
check "**1 customer actually brought in**" 1 "$(RF customers_brought)"
check "15 points awarded across both sides" 15 "$(RF points_awarded)"
check "**referral points match the loyalty ledger's own figure**" "t" \
  "$(AS "$OA" "select (select points_awarded from shop_referral_summary('$S', $F7, $T0))
                    = (select referral_points from shop_loyalty_stats('$S', $F7, $T0))")"
# A claimed-but-not-converted referral must NOT count as converted. C5 is
# used because they, too, must be new to the shop.
AS "$C5" "select claim_referral('$S','$RC')" >/dev/null
check "**a claimed code is NOT a conversion**" "2|1|1" \
  "$(RF "referrals_total || '|' || referrals_pending || '|' || referrals_converted")"
check "    so the rate drops to 50.0%"     "50.0" "$(RF "conversion_rate::text")"
check "    and customers_brought stays 1"  1 "$(RF customers_brought)"

echo
echo "== K. rewards =="
RW_() { AS "$OA" "select $1 from shop_reward_stats('$S', $F7, $T0)"; }
check "1 reward, active and on the shelf"  "1|1|1" \
  "$(RW_ "rewards_total || '|' || rewards_active || '|' || rewards_available")"
check "1 redemption, still in a pocket"    "1|1|0|0" \
  "$(RW_ "redemptions_total || '|' || redemptions_issued || '|' || redemptions_used || '|' || redemptions_expired")"
check "**use rate is N/A while nothing has been settled**" "t" "$(RW_ "use_rate is null")"
check "200 points spent on rewards"        200 "$(RW_ points_spent)"
check "**and that matches the ledger's REDEEM total**" "t" \
  "$(AS "$OA" "select (select points_spent from shop_reward_stats('$S', $F7, $T0))
                    = (select redeemed_points from shop_loyalty_stats('$S', $F7, $T0))")"
check "no discount given yet"              "0" "$(RW_ "discount_given::text")"
check "1 redeeming customer"               1 "$(RW_ redeeming_customers)"
# Consume it against its owner's own open bill, then the rates become
# meaningful. SR7 is C1's, which is whose coupon this is.
REV_BEFORE=$(AS "$OA" "select revenue_total::text from shop_overview_stats('$S', $F7, $T0)")
AS "$OA" "select * from mark_redemption_used('$S','$CODE','SERIAL','$SR7')" >/dev/null
check "once used, 1 used and 0 issued"     "0|1" "$(RW_ "redemptions_issued || '|' || redemptions_used")"
check "**use rate becomes 100.0%**"        "100.0" "$(RW_ "use_rate::text")"
check "and the discount given is recorded" "100.00" "$(RW_ "discount_given::text")"
check "**verifying a coupon does not by itself move the revenue**" "$REV_BEFORE" \
  "$(AS "$OA" "select revenue_total::text from shop_overview_stats('$S', $F7, $T0)")"

# Now close the job. Sprint 9's BEFORE UPDATE trigger takes the 100 off at
# DONE, so the bill lands at 600 — and this is the point of the fixture: the
# analytics must report the **final** amount, never the pre-discount one.
AS "$OA" "update serials set status='IN_PROGRESS' where id='$SR7'" >/dev/null
AS "$OA" "update serials set status='DONE', payment_status='PAID' where id='$SR7'" >/dev/null
check "**the closed bill is the discounted 600, not the original 700**" "600.00" \
  "$(Q "select total_amount::text from serials where id='$SR7'")"
check "**and revenue grew by the discounted amount, not the sticker price**" "600.00" \
  "$(AS "$OA" "select ((select revenue_total from shop_overview_stats('$S', $F7, $T0)) - $REV_BEFORE)::text")"
check "    so the shop's total is 6500"    "6500.00" "$(OV "revenue_total::text")"
check "    and 8 jobs are now finished"    8 "$(OV jobs_completed)"
check "**the trend still sums to the overview after a discount**" "t" \
  "$(AS "$OA" "select (select sum(revenue_total) from shop_revenue_trend('$S', $F7, $T0, 'DAY'))
                    = (select revenue_total from shop_overview_stats('$S', $F7, $T0))")"
check "popular rewards names the reward"   "ZZ Hundred Off" \
  "$(AS "$OA" "select label from shop_analytics_breakdown('$S', $F7, $T0, 'REWARD') limit 1")"
check "**no refund metric exists, because the system has no refunds**" "t" \
  "$(Q "select not exists (select 1 from information_schema.columns
         where table_name='reward_redemptions' and column_name like '%refund%')")"

echo
echo "== the breakdown RPC =="
check "service breakdown names the service" "Facial" \
  "$(AS "$OA" "select label from shop_analytics_breakdown('$S', $F7, $T0, 'SERVICE') limit 1")"
check "**a single-service bill attributes its whole amount**" "t" \
  "$(AS "$OA" "select (select sum(amount) from shop_analytics_breakdown('$S', $F7, $T0, 'SERVICE'))
                    = (select revenue_total - 300 from shop_overview_stats('$S', $F7, $T0))")"
check "payment methods split cash from due" "t" \
  "$(AS "$OA" "select count(*) >= 2 from shop_analytics_breakdown('$S', $F7, $T0, 'PAYMENT_METHOD')")"
check "**the payment-method split sums to the shop's revenue**" "t" \
  "$(AS "$OA" "select (select sum(amount) from shop_analytics_breakdown('$S', $F7, $T0, 'PAYMENT_METHOD'))
                    = (select revenue_total from shop_overview_stats('$S', $F7, $T0))")"
check "the due bucket equals the overview's due" "t" \
  "$(AS "$OA" "select (select amount from shop_analytics_breakdown('$S', $F7, $T0, 'PAYMENT_METHOD') where key='due')
                    = (select revenue_due from shop_overview_stats('$S', $F7, $T0))")"

echo
echo "== N. date boundaries =="
check "**a one-day window includes that whole local day**" "t" \
  "$(AS "$OA" "select revenue_total = 1100 from shop_overview_stats('$S', current_date - 1, current_date - 1)")"
check "    (800 serial + 300 manual entry, both on that day)" "t" \
  "$(AS "$OA" "select jobs_completed = 2 from shop_overview_stats('$S', current_date - 1, current_date - 1)")"
check "the day before it is empty"         "0" \
  "$(AS "$OA" "select revenue_total::text from shop_overview_stats('$S', current_date - 7, current_date - 7)")"
check "**the 40-day-old job is outside a 7-day window**" "t" \
  "$(AS "$OA" "select (select revenue_total from shop_overview_stats('$S', $F7, $T0)) < (select revenue_total from shop_overview_stats('$S', current_date - 60, $T0))")"
check "    but inside a 60-day one, adding exactly 900" "t" \
  "$(AS "$OA" "select (select revenue_total from shop_overview_stats('$S', current_date - 60, $T0))
                    - (select revenue_total from shop_overview_stats('$S', $F7, $T0)) = 900")"
check "a future-only window is empty, not an error" "0|0" \
  "$(AS "$OA" "select jobs_completed || '|' || revenue_total::text from shop_overview_stats('$S', current_date + 10, current_date + 20)")"
check "    and the future appointment does show in a future window" 1 \
  "$(AS "$OA" "select total from shop_appointment_stats('$S', current_date + 1, current_date + 5)")"
check "the widest allowed range (1095 days) is accepted" "t" \
  "$(AS "$OA" "select count(*) = 1 from shop_overview_stats('$S', current_date - 1095, $T0)")"

echo
echo "== O. cross-shop isolation =="
check "shop B's own overview is its own numbers" "5900.00" \
  "$(AS "$OB" "select revenue_total::text from shop_overview_stats('$SB', current_date - 6, $T0)")"
check "**shop A's revenue and shop B's do not overlap**" "t" \
  "$(AS "$OA" "select revenue_total = 6500 from shop_overview_stats('$S', $F7, $T0)")"
check "shop B sees only its own seat"       1 \
  "$(AS "$OB" "select count(*) from shop_staff_stats('$SB', $F7, $T0)")"
check "    and it is shop B's seat"         "$STB" \
  "$(AS "$OB" "select staff_id from shop_staff_stats('$SB', $F7, $T0)")"
check "shop B's loyalty is its own"         700 \
  "$(AS "$OB" "select outstanding_points from shop_loyalty_stats('$SB', $F7, $T0)")"
check "shop B's membership is its own"      1 \
  "$(AS "$OB" "select active_members from shop_membership_stats('$SB', $F7, $T0)")"
check "shop B has no referrals of its own"  0 \
  "$(AS "$OB" "select referrals_total from shop_referral_summary('$SB', $F7, $T0)")"
check "shop B has its own reward, no redemptions" "1|0" \
  "$(AS "$OB" "select rewards_total || '|' || redemptions_total from shop_reward_stats('$SB', $F7, $T0)")"
check "shop B's peak slots exclude shop A's" 1 \
  "$(AS "$OB" "select coalesce(sum(jobs),0) from shop_peak_slots('$SB', $F7, $T0) where bucket_kind='HOUR' and source='SERIAL'")"
# **A date range cannot escape the shop scope.** Widening the window to the
# maximum the gate allows must not reach one taka of the other shop: the scope
# is `shop_id AND date`, never one or the other. Compared against shop B's own
# three income sources computed here as superuser, so the RPC has to agree with
# the tables rather than with another RPC.
BREV=$(Q "select (coalesce((select sum(total_amount) from serials
                             where shop_id='$SB' and status='DONE'
                               and payment_status in ('PAID','DUE')),0)
                + coalesce((select sum(total_amount) from appointments
                             where shop_id='$SB' and status='DONE'
                               and payment_status in ('PAID','DUE')),0)
                + coalesce((select sum(amount) from manual_entries
                             where shop_id='$SB'),0))::text")
check "**the widest allowed range still returns only shop B's own money**" "$BREV" \
  "$(AS "$OB" "select revenue_total::text from shop_overview_stats('$SB', current_date - 1095, $T0)")"
check "**all eleven RPCs refuse the other shop, not just the headline one**" \
  "not your shop|not your shop|not your shop|not your shop|not your shop|not your shop" \
  "$(printf '%s|%s|%s|%s|%s|%s' \
      "$(WHYAS "$OB" "select * from shop_revenue_trend('$S', $F7, $T0, 'DAY')")" \
      "$(WHYAS "$OB" "select * from shop_queue_stats('$S', $F7, $T0)")" \
      "$(WHYAS "$OB" "select * from shop_peak_slots('$S', $F7, $T0)")" \
      "$(WHYAS "$OB" "select * from shop_membership_stats('$S', $F7, $T0)")" \
      "$(WHYAS "$OB" "select * from shop_referral_summary('$S', $F7, $T0)")" \
      "$(WHYAS "$OB" "select * from shop_analytics_breakdown('$S', $F7, $T0, 'SERVICE')")")"
# PII, asserted against the function signatures themselves: no aggregate RPC
# may return a customer name, phone, avatar or id. `shop_staff_stats` returns
# a STAFF name, which is the shop's own employee and the point of the metric —
# so it is named here as the one allowed exception rather than quietly passing.
# `customers_unique` and friends are COUNTS, so a blanket "%customer%" match
# would fail on the very columns that make the metric useful. What must never
# appear is a field that identifies a person.
check "**no aggregate analytics RPC returns customer PII**" 0 \
  "$(Q "select count(*) from information_schema.parameters
         where specific_schema='public'
           and parameter_mode in ('OUT','INOUT')
           and specific_name similar to '(shop_overview_stats|shop_loyalty_stats|shop_referral_summary|shop_reward_stats|shop_appointment_stats|shop_queue_stats|shop_peak_slots|shop_membership_stats|shop_revenue_trend)[_0-9]*'
           and (parameter_name in ('customer_id','customer_name','customer_phone',
                                   'customer_avatar_url','phone','email','avatar_url',
                                   'full_name','referrer_id','referred_id')
                or parameter_name like '%%\\_phone'
                or parameter_name like '%%\\_email')")"
check "    the only name any of them returns is the shop's own staff" "t" \
  "$(Q "select bool_and(parameter_name in ('staff_name','staff_label'))
          from information_schema.parameters
         where specific_schema='public'
           and parameter_mode in ('OUT','INOUT')
           and specific_name similar to 'shop_staff_stats[_0-9]*'
           and parameter_name ilike '%name%'")"
check "    and the breakdown's label is a service/tier/reward, never a person" "t" \
  "$(AS "$OA" "select bool_and(label not in (select full_name from profiles))
                 from shop_analytics_breakdown('$S', $F7, $T0, 'SERVICE')")"

echo
echo "== M. the empty shop — every answer is a safe one =="
EC() { AS "$OC" "select $1 from $2('$SC', $F7, $T0)"; }
check "an empty shop's overview returns one row of zeros" 1 \
  "$(AS "$OC" "select count(*) from shop_overview_stats('$SC', $F7, $T0)")"
check "    zero jobs, zero revenue"        "0|0" "$(EC "jobs_completed || '|' || revenue_total::text" shop_overview_stats)"
check "    **and avg ticket is NULL, not 0**" "t" "$(EC "avg_ticket is null" shop_overview_stats)"
check "    zero customers"                 "0|0|0" \
  "$(EC "customers_unique || '|' || customers_new || '|' || customers_returning" shop_overview_stats)"
check "no appointments: counts 0, **rates NULL**" "0|true" \
  "$(EC "total || '|' || (completion_rate is null)::text" shop_appointment_stats)"
check "    and avg scheduled minutes NULL" "t" "$(EC "avg_scheduled_min is null" shop_appointment_stats)"
check "no serials: counts 0, **times NULL**" "0|true|true" \
  "$(EC "total || '|' || (avg_service_min is null)::text || '|' || (avg_wait_min is null)::text" shop_queue_stats)"
check "    and the busiest day is NULL"    "t" "$(EC "busiest_day is null" shop_queue_stats)"
check "no loyalty members: zeros, and off" "false|0|0" \
  "$(EC "is_enabled::text || '|' || accounts || '|' || outstanding_points" shop_loyalty_stats)"
check "no memberships: zeros"              "0|0" \
  "$(EC "tiers_total || '|' || active_members" shop_membership_stats)"
check "no referrals: zero, **rate NULL**"  "0|true" \
  "$(EC "referrals_total || '|' || (conversion_rate is null)::text" shop_referral_summary)"
check "no rewards: zero, **use rate NULL**" "0|true" \
  "$(EC "rewards_total || '|' || (use_rate is null)::text" shop_reward_stats)"
check "an empty shop has no seats to report" 0 \
  "$(AS "$OC" "select count(*) from shop_staff_stats('$SC', $F7, $T0)")"
check "an empty shop has no peak slots"      0 \
  "$(AS "$OC" "select count(*) from shop_peak_slots('$SC', $F7, $T0)")"
check "**but its trend still spans the window, all zeros**" "7|0" \
  "$(AS "$OC" "select count(*) || '|' || coalesce(sum(revenue_total),0)::text from shop_revenue_trend('$SC', $F7, $T0, 'DAY')")"
check "every breakdown dimension is simply empty" "0|0|0|0" \
  "$(printf '%s|%s|%s|%s' \
      "$(AS "$OC" "select count(*) from shop_analytics_breakdown('$SC', $F7, $T0, 'SERVICE')")" \
      "$(AS "$OC" "select count(*) from shop_analytics_breakdown('$SC', $F7, $T0, 'PAYMENT_METHOD')")" \
      "$(AS "$OC" "select count(*) from shop_analytics_breakdown('$SC', $F7, $T0, 'MEMBERSHIP_TIER')")" \
      "$(AS "$OC" "select count(*) from shop_analytics_breakdown('$SC', $F7, $T0, 'REWARD')")")"
check "and the empty shop's owner still cannot read shop A" "not your shop" \
  "$(WHYAS "$OC" "select * from shop_overview_stats('$S', $F7, $T0)")"

echo
echo "== Q. regression: nothing in the transactional systems moved =="
check "analytics wrote nothing: serial count unchanged" 9 \
  "$(Q "select count(*) from serials")"
check "appointment count unchanged"        6 "$(Q "select count(*) from appointments")"
check "ledger row count unchanged"         10 "$(Q "select count(*) from loyalty_transactions")"
check "**balance == ledger sum, still**"   "t" \
  "$(Q "select not exists (select 1 from loyalty_accounts a where a.balance <> coalesce((select sum(t.points) from loyalty_transactions t where t.shop_id=a.shop_id and t.customer_id=a.customer_id),0))")"
check "core queue triggers still there"    "t" \
  "$(Q "select exists (select 1 from pg_trigger where tgname='serials_before_update') and exists (select 1 from pg_trigger where tgname='serials_after_update')")"
check "core appointment triggers still there" "t" \
  "$(Q "select exists (select 1 from pg_trigger where tgname='appointments_before_update') and exists (select 1 from pg_trigger where tgname='appointments_after_update')")"
check "all six zz_ programme triggers still there" 6 \
  "$(Q "select count(*) from pg_trigger where tgname in ('serials_zz_loyalty_award','appointments_zz_loyalty_award','serials_zz_referral_convert','appointments_zz_referral_convert','serials_zz_reward_discount','appointments_zz_reward_discount')")"
check "appointment overlap constraint kept" "t" \
  "$(Q "select exists (select 1 from pg_constraint where conname='appointments_no_overlap')")"
check "policy counts unchanged"            "5|5|1|1|1" \
  "$(Q "select (select count(*) from pg_policies where tablename='appointments') || '|' || (select count(*) from pg_policies where tablename='customer_memberships') || '|' || (select count(*) from pg_policies where tablename='loyalty_accounts') || '|' || (select count(*) from pg_policies where tablename='reward_redemptions') || '|' || (select count(*) from pg_policies where tablename='referrals')")"
check "no Sprint 6–9 function was replaced" "t" \
  "$(Q "select to_regprocedure('public.shop_membership_summary(uuid)') is not null
             and to_regprocedure('public.shop_referral_stats(uuid)') is not null
             and to_regprocedure('public.loyalty_adjust(uuid,uuid,integer,text)') is not null
             and to_regprocedure('public.redeem_reward(uuid,uuid)') is not null
             and to_regprocedure('public.mark_redemption_used(uuid,text,text,uuid)') is not null
             and to_regprocedure('public.claim_referral(uuid,text)') is not null
             and to_regprocedure('public.points_for_bill(numeric,integer,numeric)') is not null")"
check "**an analytics RPC cannot write — Postgres refuses a STABLE writer**" "t" \
  "$(Q "select provolatile = 's' from pg_proc where proname='shop_overview_stats'")"
# Assignments hoisted out of the check argument: a nested $(...) inside a
# quoted check argument silently produces an empty value, which cost two
# earlier sprints a false pass.
SRX=$(Q "insert into serials (shop_id, chair_id, customer_id, customer_name, status,
            total_amount, payment_status, service_ids, services_snapshot, booked_at)
         values ('$S','$ST','$C4','X','WAITING',400,'DUE',array['$SV'::uuid],
                 $(SNAP "$SV" Facial 400), now()) returning id" | head -1)
AS "$OA" "update serials set status='IN_PROGRESS' where id='$SRX'" >/dev/null
AS "$OA" "update serials set status='DONE', payment_status='PAID', total_amount=400 where id='$SRX'" >/dev/null
check "**loyalty still awards on a fresh DONE, after all that reading**" "t" \
  "$(Q "select exists (select 1 from loyalty_transactions where source_serial_id='$SRX')")"
check "    and the reward-discount trigger still leaves an uncouponed bill alone" "400.00" \
  "$(Q "select total_amount::text from serials where id='$SRX'")"

echo
echo "-------------------------------------------"
printf 'passed: %d   failed: %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
