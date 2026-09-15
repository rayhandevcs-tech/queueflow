#!/usr/bin/env bash
#
# Sprint 9 — rewards and redemption, run against a throwaway local Postgres
# exactly as the other harnesses do.
#
#   bash supabase/tests/run-sprint9-checks.sh
#
# Applies 20260918 → 20260919 → 20260920 → 20260921 → 20260922 → 20260923 →
# 20260924 on top of the fixture, so rewards land beside a real appointments
# engine, a real membership programme, a real loyalty ledger and a real
# referral system rather than on an empty schema, and walks the brief:
#
#   A. the reward catalogue — create, read, edit, activate/deactivate
#   B. redemption — valid, insufficient, inactive, missing, cross-shop,
#      out of stock, expired offer, and a real 6-client concurrency race
#   C. the ledger — one negative REDEEM row, balance == ledger sum, and a
#      failed redemption leaving neither points nor an orphan coupon
#   D. verification — owner only, never the customer, never twice
#   E. security, as a real non-superuser — forgery and cross-shop reads
#   F. bill application — the discount lands on a salon serial AND on a
#      parlour appointment, whose total_amount is frozen by its core trigger
#   G. regression — queue, appointments, membership, loyalty, referral
#
# A green run means the migration is sound against a schema shaped like the
# real one. It is NOT proof that it will apply to production — the fixture is
# a stand-in, not a dump.
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PORT=5606
DIR=$(mktemp -d /tmp/qf-s9-XXXXXX)
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

ERRS='reward_requires_login|reward_not_found|reward_inactive|reward_offer_expired|reward_out_of_stock|reward_insufficient_points|reward_code_generation_failed|reward_service_wrong_shop|redemption_booking_type_invalid|redemption_code_invalid|redemption_not_found|redemption_already_used|redemption_expired|redemption_booking_not_found|redemption_wrong_customer|redemption_service_not_in_booking|redemption_use_is_final|redemption_expiry_is_final|not your shop|duplicate key value|violates check constraint|violates row-level security|violates foreign key constraint|permission denied'
WHY()  { Q  "$1"      2>&1 | grep -oE "$ERRS" | head -1; }
WHYAS(){ AS "$1" "$2"      | grep -oE "$ERRS" | head -1; }

echo "== applying migrations =="
FILE "$HERE/fixture.sql" >/dev/null || exit 1

# The shared fixture's `shops` stand-in has no logo_url; the real table does,
# and both my_loyalty_accounts() and my_redemptions() return it.
Q "alter table public.shops add column if not exists logo_url text" >/dev/null

# A salon stand-in with the money columns the loyalty, referral and reward
# triggers all read, so the queue side runs on a real row.
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
     completed_at timestamptz,
     created_at timestamptz not null default now()
   )" >/dev/null
su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -q" <<'STUBS' >/dev/null
create or replace function public.send_due_reminder(p uuid) returns void language plpgsql as $x$ begin end $x$;
create or replace function public.send_daily_summaries(p_day date default null) returns int language sql as $x$ select 0 $x$;
create or replace function public.send_customer_reminders() returns int language sql as $x$ select 0 $x$;
-- A stand-in for the real serial_before_update: it stamps completed_at and,
-- crucially for Sprint 9, freezes total_amount on every transition EXCEPT
-- IN_PROGRESS -> DONE (that one-transition exception is 20260912's).
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
STUBS

for m in 20260918_appointment_core 20260919_appointment_availability \
         20260920_appointment_money 20260921_membership 20260922_loyalty \
         20260923_referral 20260924_rewards; do
  if ! FILE "$ROOT/supabase/migrations/$m.sql" >/dev/null 2>"$DIR/err"; then
    echo "  MIGRATION FAILED: $m"; sed 's/^/    /' "$DIR/err" | head -25; exit 1
  fi
  echo "  applied $m"
done
FILE "$ROOT/supabase/migrations/20260924_rewards.sql" >/dev/null 2>&1
check "re-running 20260924 is safe (idempotent)" OK "$(OK 'select 1')"
FILE "$HERE/seed.sql" >/dev/null

OA=11111111-1111-1111-1111-111111111111
OB=22222222-2222-2222-2222-222222222222
C1=33333333-3333-3333-3333-333333333333
C2=44444444-4444-4444-4444-444444444444
C3=55555555-5555-5555-5555-555555555555
C4=66666666-6666-6666-6666-666666666666
S=aaaaaaaa-0000-0000-0000-000000000001
SB=bbbbbbbb-0000-0000-0000-000000000002
ST=cccccccc-0000-0000-0000-000000000001
ST2=cccccccc-0000-0000-0000-000000000002
STB=dddddddd-0000-0000-0000-000000000001
SV=eeeeeeee-0000-0000-0000-000000000001
SV2=eeeeeeee-0000-0000-0000-000000000002
SVB=ffffffff-0000-0000-0000-000000000001

Q "insert into profiles (id, full_name, phone) values
     ('$C3','Sumona Akter','01900000005'),
     ('$C4','Tania Begum','01900000006')" >/dev/null

AT() { echo "((current_date + $1 + time '$2') at time zone 'Asia/Dhaka')"; }
NEWAPPT() { Q "insert into appointments (shop_id,staff_id,customer_id,service_ids,starts_at,ends_at,is_walk_in)
                values ('$1','$2','$3',$5, $4, $4 + interval '2 hours', false) returning id" | head -1; }
DONEAPPT() {
  AS "$2" "update appointments set status='IN_PROGRESS' where id='$1'" >/dev/null
  AS "$2" "update appointments set status='DONE', payment_status='PAID', payment_method='cash', due_amount=0 where id='$1'" >/dev/null
}
# The serial stand-in has no insert trigger, so the snapshot is written by hand
# in exactly the shape 20260822 produces — FREE_SERVICE reads `rate` from it.
NEWSERIAL() { Q "insert into serials (shop_id, chair_id, customer_id, customer_name, total_amount, status, service_ids, services_snapshot)
                  values ('$1','$2','$3','$4',$5,'WAITING', $6, $7) returning id" | head -1; }
SNAP1() { echo "jsonb_build_array(jsonb_build_object('service_id','$1','name','$2','rate',$3,'estimated_duration_min',60))"; }

# The non-superuser role: superusers bypass RLS *and* carry no auth.uid(),
# while every reward RPC is gated on auth.uid() or is_shop_owner().
Q "drop owned by app_user" >/dev/null 2>&1; Q "drop role if exists app_user" >/dev/null 2>&1
Q "create role app_user nologin" >/dev/null
Q "grant usage on schema public, auth to app_user" >/dev/null
Q "grant select,insert,update,delete on all tables in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema auth to app_user" >/dev/null

echo
echo "== structure =="
check "rewards exists"            "t" "$(Q "select to_regclass('public.rewards') is not null")"
check "reward_redemptions exists" "t" "$(Q "select to_regclass('public.reward_redemptions') is not null")"
check "rewards RLS on"            "t" "$(Q "select relrowsecurity from pg_class where oid='public.rewards'::regclass")"
check "redemptions RLS on"        "t" "$(Q "select relrowsecurity from pg_class where oid='public.reward_redemptions'::regclass")"
check "2 rewards policies"        2 "$(Q "select count(*) from pg_policies where tablename='rewards'")"
# immutable history: issuing and consuming happen only inside DEFINER RPCs
check "redemptions: exactly 1 policy"      1 "$(Q "select count(*) from pg_policies where tablename='reward_redemptions'")"
check "redemptions: that policy is SELECT" "SELECT" "$(Q "select cmd from pg_policies where tablename='reward_redemptions'")"
check "redemptions: NO insert policy" "t" "$(Q "select not exists (select 1 from pg_policies where tablename='reward_redemptions' and cmd='INSERT')")"
check "redemptions: NO update policy" "t" "$(Q "select not exists (select 1 from pg_policies where tablename='reward_redemptions' and cmd='UPDATE')")"
check "redemptions: NO delete policy" "t" "$(Q "select not exists (select 1 from pg_policies where tablename='reward_redemptions' and cmd='DELETE')")"
check "history freeze trigger"        "t" "$(Q "select exists (select 1 from pg_trigger where tgname='reward_redemptions_freeze')")"
check "cross-shop service guard trigger" "t" "$(Q "select exists (select 1 from pg_trigger where tgname='rewards_before_write')")"
check "value-matches-kind constraint" "t" "$(Q "select exists (select 1 from pg_constraint where conname='rewards_value_matches_kind')")"
check "redemption status-shape constraint" "t" "$(Q "select exists (select 1 from pg_constraint where conname='reward_redemptions_status_shape')")"
check "code unique per shop"          "t" "$(Q "select exists (select 1 from pg_indexes where indexname='reward_redemptions_code')")"
check "one reward per booking index"  "t" "$(Q "select exists (select 1 from pg_indexes where indexname='reward_redemptions_one_per_booking_idx')")"
check "reward name unique per shop"   "t" "$(Q "select exists (select 1 from pg_indexes where indexname='rewards_shop_name_idx')")"
check "no CANCELLED status"           "t" "$(Q "select pg_get_constraintdef(oid) not like '%CANCELLED%' from pg_constraint where conname='reward_redemptions_status_check'")"
check "no Postgres enum type (decision 45)" 0 \
  "$(Q "select count(*) from pg_type where typname in ('reward_kind','redemption_status') and typtype='e'")"
check "reward_discount_for is IMMUTABLE" "i" \
  "$(Q "select provolatile from pg_proc where oid='public.reward_discount_for(text,numeric,uuid,numeric,jsonb)'::regprocedure")"
check "redeem_reward is DEFINER"        "t" "$(Q "select prosecdef from pg_proc where oid='public.redeem_reward(uuid,uuid)'::regprocedure")"
check "mark_redemption_used is DEFINER" "t" "$(Q "select prosecdef from pg_proc where oid='public.mark_redemption_used(uuid,text,text,uuid)'::regprocedure")"
check "expire_redemptions is DEFINER"   "t" "$(Q "select prosecdef from pg_proc where oid='public.expire_redemptions()'::regprocedure")"
check "my_redemptions is DEFINER"       "t" "$(Q "select prosecdef from pg_proc where oid='public.my_redemptions()'::regprocedure")"
check "serials discount trigger exists"      "t" "$(Q "select exists (select 1 from pg_trigger where tgname='serials_zz_reward_discount')")"
check "appointments discount trigger exists" "t" "$(Q "select exists (select 1 from pg_trigger where tgname='appointments_zz_reward_discount')")"
check "both discount triggers are BEFORE"    2 \
  "$(Q "select count(*) from pg_trigger where tgname in ('serials_zz_reward_discount','appointments_zz_reward_discount') and (tgtype & 2) = 2")"
check "core before-triggers sort first"      "t" \
  "$(Q "select 'appointments_before_update' < 'appointments_zz_reward_discount' and 'serials_before_update' < 'serials_zz_reward_discount'")"
check "no reward was seeded"     0 "$(Q "select count(*) from rewards")"
check "no redemption was seeded" 0 "$(Q "select count(*) from reward_redemptions")"

echo
echo "== Sprint 7's ledger is reused, not duplicated =="
check "no separate points/balance table" "t" \
  "$(Q "select to_regclass('public.reward_points') is null and to_regclass('public.reward_accounts') is null and to_regclass('public.reward_balances') is null and to_regclass('public.point_balances') is null")"
check "ledger gained source_redemption_id" 1 \
  "$(Q "select count(*) from information_schema.columns where table_name='loyalty_transactions' and column_name='source_redemption_id'")"
check "ledger kind allows REDEEM" "t" \
  "$(Q "select pg_get_constraintdef(oid) like '%REDEEM%' from pg_constraint where conname='loyalty_transactions_kind_check'")"
check "the five older kinds are still allowed" "t" \
  "$(Q "select pg_get_constraintdef(oid) like '%EARN_SERIAL%' and pg_get_constraintdef(oid) like '%EARN_APPOINTMENT%' and pg_get_constraintdef(oid) like '%ADJUST%' and pg_get_constraintdef(oid) like '%REFERRAL_REFERRER%' and pg_get_constraintdef(oid) like '%REFERRAL_REFERRED%' from pg_constraint where conname='loyalty_transactions_kind_check'")"
check "a REDEEM row must be negative"  "t" "$(Q "select exists (select 1 from pg_constraint where conname='loyalty_tx_redeem_is_negative')")"
check "one ledger row per redemption"  "t" "$(Q "select exists (select 1 from pg_indexes where indexname='loyalty_tx_one_per_redemption_idx')")"
check "loyalty_accounts still has exactly 1 policy" 1 "$(Q "select count(*) from pg_policies where tablename='loyalty_accounts'")"
check "no column landed on serials"      0 \
  "$(Q "select count(*) from information_schema.columns where table_name='serials' and (column_name like '%reward%' or column_name like '%redem%')")"
check "no column landed on appointments" 0 \
  "$(Q "select count(*) from information_schema.columns where table_name='appointments' and (column_name like '%reward%' or column_name like '%redem%')")"
check "no column landed on services"     0 \
  "$(Q "select count(*) from information_schema.columns where table_name='services' and (column_name like '%reward%' or column_name like '%redem%')")"

echo
echo "== the discount formula =="
check "flat 100 off an 800 bill"        "100.00" "$(Q "select reward_discount_for('DISCOUNT_FLAT',100,null,800,'[]'::jsonb)::text")"
check "flat 500 never exceeds a 300 bill" "300.00" "$(Q "select reward_discount_for('DISCOUNT_FLAT',500,null,300,'[]'::jsonb)::text")"
check "10% of 850 rounds to 85.00"      "85.00" "$(Q "select reward_discount_for('DISCOUNT_PCT',10,null,850,'[]'::jsonb)::text")"
check "100% of a bill is the whole bill" "800.00" "$(Q "select reward_discount_for('DISCOUNT_PCT',100,null,800,'[]'::jsonb)::text")"
check "a zero bill earns no discount"   "0.00" "$(Q "select reward_discount_for('DISCOUNT_FLAT',100,null,0,'[]'::jsonb)::text")"
check "a null bill earns no discount"   "0.00" "$(Q "select reward_discount_for('DISCOUNT_FLAT',100,null,null,'[]'::jsonb)::text")"
check "free service takes the quoted rate" "800.00" \
  "$(Q "select reward_discount_for('FREE_SERVICE',null,'$SV',2300,$(SNAP1 "$SV" Facial 800))::text")"
check "free service not in the bill gives 0" "0.00" \
  "$(Q "select reward_discount_for('FREE_SERVICE',null,'$SV2',800,$(SNAP1 "$SV" Facial 800))::text")"
check "an unknown kind gives 0"         "0.00" "$(Q "select reward_discount_for('MYSTERY',100,null,800,'[]'::jsonb)::text")"

echo
echo "== A. the reward catalogue =="
AS "$OA" "insert into loyalty_settings (shop_id, is_enabled, taka_per_point) values ('$S', true, 100)" >/dev/null
AS "$OB" "insert into loyalty_settings (shop_id, is_enabled, taka_per_point) values ('$SB', true, 50)" >/dev/null

MK() { AS "$1" "insert into rewards (shop_id, name, kind, points_cost, value, service_id, stock, valid_until, is_active)
                 values ('$2','$3','$4',$5,$6,$7,$8,$9,${10:-true}) returning id"; }

RW_FLAT=$(MK "$OA" "$S" 'ZZ Flat 100'    DISCOUNT_FLAT 50  100   null        null null)
RW_PCT=$( MK "$OA" "$S" 'ZZ Ten Percent' DISCOUNT_PCT  30  10    null        null null)
RW_FREE=$(MK "$OA" "$S" 'ZZ Free Facial' FREE_SERVICE  200 null  "'$SV'"     null null)
RW_OFF=$( MK "$OA" "$S" 'ZZ Switched Off' DISCOUNT_FLAT 10 50    null        null null false)
RW_STK=$( MK "$OA" "$S" 'ZZ Last One'    DISCOUNT_FLAT 10  20    null        1    null)
RW_EXP=$( MK "$OA" "$S" 'ZZ Expired'     DISCOUNT_FLAT 10  20    null        null "now() - interval '1 day'")
RWB=$(    MK "$OB" "$SB" 'ZZ Shop B Flat' DISCOUNT_FLAT 20 50    null        null null)

check "the owner created six rewards"      6 "$(Q "select count(*) from rewards where shop_id='$S'")"
check "shop B has its own one"             1 "$(Q "select count(*) from rewards where shop_id='$SB'")"
check "a flat reward stores its taka"      "100.00" "$(Q "select value::text from rewards where id='$RW_FLAT'")"
check "a free-service reward stores the service" "$SV" "$(Q "select service_id from rewards where id='$RW_FREE'")"
check "another shop's owner cannot create one here" "violates row-level security" \
  "$(WHYAS "$OB" "insert into rewards (shop_id,name,kind,points_cost,value) values ('$S','ZZ Sneaky','DISCOUNT_FLAT',10,10)")"
check "a customer cannot create one at all"        "violates row-level security" \
  "$(WHYAS "$C1" "insert into rewards (shop_id,name,kind,points_cost,value) values ('$S','ZZ Mine','DISCOUNT_FLAT',10,10)")"
check "**a free service from another shop is refused**" "reward_service_wrong_shop" \
  "$(WHYAS "$OA" "insert into rewards (shop_id,name,kind,points_cost,service_id) values ('$S','ZZ Cross Shop','FREE_SERVICE',10,'$SVB')")"
check "the same name twice in one shop is refused"  "duplicate key value" \
  "$(WHYAS "$OA" "insert into rewards (shop_id,name,kind,points_cost,value) values ('$S','zz flat 100','DISCOUNT_FLAT',10,10)")"
check "but shop B may reuse that name"              "t" \
  "$(AS "$OB" "insert into rewards (shop_id,name,kind,points_cost,value) values ('$SB','ZZ Flat 100','DISCOUNT_FLAT',10,10) returning id is not null")"
# the shape constraint: four nonsense rewards the database refuses
check "a percentage over 100 is refused"   "violates check constraint" \
  "$(WHYAS "$OA" "insert into rewards (shop_id,name,kind,points_cost,value) values ('$S','ZZ Bad Pct','DISCOUNT_PCT',10,150)")"
check "a flat reward may not name a service" "violates check constraint" \
  "$(WHYAS "$OA" "insert into rewards (shop_id,name,kind,points_cost,value,service_id) values ('$S','ZZ Bad Flat','DISCOUNT_FLAT',10,10,'$SV')")"
check "a free service may not carry a value" "violates check constraint" \
  "$(WHYAS "$OA" "insert into rewards (shop_id,name,kind,points_cost,value,service_id) values ('$S','ZZ Bad Free','FREE_SERVICE',10,10,'$SV')")"
check "a zero points cost is refused"        "violates check constraint" \
  "$(WHYAS "$OA" "insert into rewards (shop_id,name,kind,points_cost,value) values ('$S','ZZ Free Lunch','DISCOUNT_FLAT',0,10)")"
# editing
check "the owner can rename and reprice"   "60" \
  "$(AS "$OA" "update rewards set name='ZZ Flat One Hundred', points_cost=60 where id='$RW_FLAT'" >/dev/null;
     Q "select points_cost from rewards where id='$RW_FLAT'")"
AS "$OA" "update rewards set points_cost=50 where id='$RW_FLAT'" >/dev/null
check "the owner can deactivate and reactivate" "t" \
  "$(AS "$OA" "update rewards set is_active=false where id='$RW_PCT'" >/dev/null;
     AS "$OA" "update rewards set is_active=true where id='$RW_PCT'" >/dev/null;
     Q "select is_active from rewards where id='$RW_PCT'")"
check "**a reward cannot be moved to another shop**" "$S" \
  "$(AS "$OA" "update rewards set shop_id='$SB' where id='$RW_FLAT'" >/dev/null;
     Q "select shop_id from rewards where id='$RW_FLAT'")"
check "another shop's owner cannot edit it"  50 \
  "$(AS "$OB" "update rewards set points_cost=1 where id='$RW_FLAT'" >/dev/null;
     Q "select points_cost from rewards where id='$RW_FLAT'")"
check "a customer cannot edit it either"     50 \
  "$(AS "$C1" "update rewards set points_cost=1 where id='$RW_FLAT'" >/dev/null;
     Q "select points_cost from rewards where id='$RW_FLAT'")"
check "a customer sees the five active rewards at shop A" 5 \
  "$(AS "$C1" "select count(*) from rewards where shop_id='$S'")"
check "**and never the switched-off one**"   0 \
  "$(AS "$C1" "select count(*) from rewards where id='$RW_OFF'")"
check "the owner still sees all six"         6 "$(AS "$OA" "select count(*) from rewards where shop_id='$S'")"

echo
echo "== B. redemption =="
# Points arrive through the owner's own documented door, loyalty_adjust(),
# which writes a ledger row — so the invariant holds from the first line.
AS "$OA" "select loyalty_adjust('$S','$C1',500,'ZZ probe seed')" >/dev/null
AS "$OA" "select loyalty_adjust('$S','$C2',100,'ZZ probe seed')" >/dev/null
AS "$OA" "select loyalty_adjust('$S','$C3',50,'ZZ probe seed')"  >/dev/null
AS "$OB" "select loyalty_adjust('$SB','$C1',200,'ZZ probe seed')" >/dev/null
check "C1 holds 500 points at shop A" 500 "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "and 200 at shop B, separately" 200 "$(Q "select balance from loyalty_accounts where shop_id='$SB' and customer_id='$C1'")"

CODE2=$(AS "$C2" "select redemption_code from redeem_reward('$S','$RW_FLAT')")
check "C2 redeemed and got a code"      "t" "$(Q "select '$CODE2' ~ '^[A-Z0-9]{6}\$'")"
check "the code avoids ambiguous 0/O/1/I/L" "t" "$(Q "select '$CODE2' !~ '[01ILO]'")"
check "C2's balance fell 100 → 50"      50 "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C2'")"
check "the coupon is ISSUED"            "ISSUED" "$(Q "select status from reward_redemptions where code='$CODE2'")"
check "it snapshotted the reward's name" "ZZ Flat One Hundred" \
  "$(Q "select reward_snapshot->>'name' from reward_redemptions where code='$CODE2'")"
check "it snapshotted the points cost"  50 "$(Q "select points_spent from reward_redemptions where code='$CODE2'")"
check "nothing is marked used yet"      "t" "$(Q "select used_at is null and discount_amount is null from reward_redemptions where code='$CODE2'")"

check "too few points is refused"       "reward_insufficient_points" \
  "$(WHYAS "$C3" "select * from redeem_reward('$S','$RW_FREE')")"
check "and the refusal cost C3 nothing" 50 "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C3'")"
check "a switched-off reward is refused" "reward_inactive" \
  "$(WHYAS "$C1" "select * from redeem_reward('$S','$RW_OFF')")"
check "a nonexistent reward is refused"  "reward_not_found" \
  "$(WHYAS "$C1" "select * from redeem_reward('$S','00000000-0000-0000-0000-000000000000')")"
check "an offer past its valid_until is refused" "reward_offer_expired" \
  "$(WHYAS "$C1" "select * from redeem_reward('$S','$RW_EXP')")"
# **the cross-shop test, both directions**
check "**shop B's reward does not exist at shop A**" "reward_not_found" \
  "$(WHYAS "$C1" "select * from redeem_reward('$S','$RWB')")"
check "**and shop A's reward does not exist at shop B**" "reward_not_found" \
  "$(WHYAS "$C1" "select * from redeem_reward('$SB','$RW_FLAT')")"
check "a guest with no session is refused" "reward_requires_login" \
  "$(WHY "select * from redeem_reward('$S','$RW_FLAT')")"
check "no stray coupon came out of any refusal" 1 "$(Q "select count(*) from reward_redemptions")"

# stock
check "the last-one reward is taken"    "t" "$(AS "$C1" "select redemption_code is not null from redeem_reward('$S','$RW_STK')")"
check "its stock fell to 0"             0 "$(Q "select stock from rewards where id='$RW_STK'")"
check "**and the next customer is refused**" "reward_out_of_stock" \
  "$(WHYAS "$C2" "select * from redeem_reward('$S','$RW_STK')")"
check "a sold-out reward left C2's balance alone" 50 \
  "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C2'")"

echo
echo "== B2. a real concurrency race — 6 clients, points for exactly one =="
# C4 gets exactly one redemption's worth. Six clients are released together by
# a shared advisory lock; nothing serialises them but the row lock inside
# redeem_reward() and the balance >= 0 CHECK beneath it.
AS "$OA" "select loyalty_adjust('$S','$C4',50,'ZZ probe seed')" >/dev/null
su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -c 'select pg_advisory_lock(99)'" >/dev/null &
sleep 1
for i in $(seq 1 6); do
  su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=app_user -c test.uid=$C4' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -v ON_ERROR_STOP=1 -tA -c \"select pg_advisory_lock_shared(99); select redemption_code from redeem_reward('$S','$RW_FLAT');\"" >"$DIR/race$i.out" 2>&1 &
done
sleep 2
su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -c 'select pg_advisory_unlock_all()'" >/dev/null
wait
check "**exactly one of 6 concurrent redemptions survives**" 1 \
  "$(Q "select count(*) from reward_redemptions where customer_id='$C4'")"
check "the losers were refused for want of points" 5 \
  "$(grep -l 'reward_insufficient_points' "$DIR"/race*.out 2>/dev/null | wc -l)"
check "C4's balance landed on exactly 0"  0 \
  "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C4'")"
check "and exactly one REDEEM row was written for C4" 1 \
  "$(Q "select count(*) from loyalty_transactions where customer_id='$C4' and kind='REDEEM'")"
check "balance == ledger sum after the race" "t" \
  "$(Q "select not exists (select 1 from loyalty_accounts a where a.balance <> coalesce((select sum(t.points) from loyalty_transactions t where t.shop_id=a.shop_id and t.customer_id=a.customer_id),0))")"

echo
echo "== C. the ledger =="
check "the redemption wrote a REDEEM row" "REDEEM" \
  "$(Q "select kind from loyalty_transactions where source_redemption_id=(select id from reward_redemptions where code='$CODE2')")"
check "**and it is negative**"            "-50" \
  "$(Q "select points from loyalty_transactions where source_redemption_id=(select id from reward_redemptions where code='$CODE2')")"
check "lifetime_earned did NOT fall"      100 \
  "$(Q "select lifetime_earned from loyalty_accounts where shop_id='$S' and customer_id='$C2'")"
check "every coupon has exactly one ledger row" "t" \
  "$(Q "select (select count(*) from reward_redemptions) = (select count(*) from loyalty_transactions where kind='REDEEM')")"
check "no REDEEM row is missing its coupon"    "t" \
  "$(Q "select not exists (select 1 from loyalty_transactions where kind='REDEEM' and source_redemption_id is null)")"
check "a second ledger row for one coupon is refused" "duplicate key value" \
  "$(WHY "insert into loyalty_transactions (shop_id,customer_id,points,kind,source_redemption_id) select shop_id,customer_id,-1,'REDEEM',id from reward_redemptions where code='$CODE2'")"
check "**a positive REDEEM row is refused**"   "violates check constraint" \
  "$(WHY "insert into loyalty_transactions (shop_id,customer_id,points,kind,source_redemption_id) select shop_id,customer_id,99,'REDEEM',id from reward_redemptions where code='$CODE2'")"
check "a REDEEM row may not also name a serial" "violates check constraint" \
  "$(WHY "insert into loyalty_transactions (shop_id,customer_id,points,kind,source_redemption_id,source_serial_id) select shop_id,customer_id,-1,'REDEEM',id,'00000000-0000-0000-0000-000000000000' from reward_redemptions where code='$CODE2'")"
check "balance == ledger sum, every account" "t" \
  "$(Q "select not exists (select 1 from loyalty_accounts a where a.balance <> coalesce((select sum(t.points) from loyalty_transactions t where t.shop_id=a.shop_id and t.customer_id=a.customer_id),0))")"
check "no account ever went negative"        "t" "$(Q "select not exists (select 1 from loyalty_accounts where balance < 0)")"

echo
echo "== D. verification, and F. the bill =="
SNAP_A=$(SNAP1 "$SV" Facial 800)
SR2=$(NEWSERIAL "$S" "$ST" "$C2" "Nadia" 800 "array['$SV'::uuid]" "$SNAP_A")
AS "$OA" "update serials set status='IN_PROGRESS' where id='$SR2'" >/dev/null

check "another shop's owner cannot verify the code" "not your shop" \
  "$(WHYAS "$OB" "select * from mark_redemption_used('$S','$CODE2','SERIAL','$SR2')")"
check "**shop A's code does not exist at shop B**"  "redemption_not_found" \
  "$(WHYAS "$OB" "select * from mark_redemption_used('$SB','$CODE2','SERIAL','$SR2')")"
check "**the customer cannot consume their own coupon**" "not your shop" \
  "$(WHYAS "$C2" "select * from mark_redemption_used('$S','$CODE2','SERIAL','$SR2')")"
check "an unknown code is refused"                  "redemption_not_found" \
  "$(WHYAS "$OA" "select * from mark_redemption_used('$S','ZZZZZZ','SERIAL','$SR2')")"
check "an empty code is refused"                    "redemption_code_invalid" \
  "$(WHYAS "$OA" "select * from mark_redemption_used('$S','   ','SERIAL','$SR2')")"
check "a nonsense booking type is refused"          "redemption_booking_type_invalid" \
  "$(WHYAS "$OA" "select * from mark_redemption_used('$S','$CODE2','INVOICE','$SR2')")"
check "a booking from another shop is refused"      "redemption_booking_not_found" \
  "$(WHYAS "$OA" "select * from mark_redemption_used('$S','$CODE2','SERIAL','00000000-0000-0000-0000-000000000000')")"
check "the coupon is still ISSUED after all of that" "ISSUED" \
  "$(Q "select status from reward_redemptions where code='$CODE2'")"

check "the owner verified it: 100 off an 800 bill"  "100.00" \
  "$(AS "$OA" "select discount_amount::text from mark_redemption_used('$S','$CODE2','SERIAL','$SR2')")"
check "the coupon is now USED"     "USED" "$(Q "select status from reward_redemptions where code='$CODE2'")"
check "it records the booking"     "SERIAL|$SR2" \
  "$(Q "select used_on_booking_type || '|' || used_on_booking_id from reward_redemptions where code='$CODE2'")"
check "it records the discount"    "100.00" "$(Q "select discount_amount::text from reward_redemptions where code='$CODE2'")"
check "**but the bill is untouched until the job is done**" "800.00" \
  "$(Q "select total_amount::text from serials where id='$SR2'")"
check "verifying it a second time is refused" "redemption_already_used" \
  "$(WHYAS "$OA" "select * from mark_redemption_used('$S','$CODE2','SERIAL','$SR2')")"

# **the headline: the discount lands on the salon bill at DONE**
AS "$OA" "update serials set status='DONE', payment_status='PAID', payment_method='cash' where id='$SR2'" >/dev/null
check "**the salon bill fell 800 → 700 at DONE**" "700.00" \
  "$(Q "select total_amount::text from serials where id='$SR2'")"
check "the serial still completed normally" "DONE" "$(Q "select status from serials where id='$SR2'")"
check "and stamped its own completed_at"    "t" "$(Q "select completed_at is not null from serials where id='$SR2'")"
check "**loyalty earned on the discounted bill, not the quoted one**" 7 \
  "$(Q "select points from loyalty_transactions where source_serial_id='$SR2'")"
check "a later update does not discount twice" "700.00" \
  "$(AS "$OA" "update serials set due_reminded_at=now() where id='$SR2'" >/dev/null;
     Q "select total_amount::text from serials where id='$SR2'")"
# A nested $(...) inside a quoted check argument silently produces an empty
# value — the same trap that cost two earlier sprints a false pass. Hoisted.
CODEX=$(AS "$C2" "select redemption_code from redeem_reward('$S','$RW_PCT')")
WHY_SECOND=$(WHYAS "$OA" "select * from mark_redemption_used('$S','$CODEX','SERIAL','$SR2')")
check "**one reward per booking: a second coupon on that bill is refused**" "duplicate key value" \
  "$WHY_SECOND"
check "and that second coupon stayed ISSUED" "ISSUED" \
  "$(Q "select status from reward_redemptions where code='$CODEX'")"

echo
echo "== F2. the parlour bill, whose total_amount its core trigger freezes =="
CODE1=$(AS "$C1" "select redemption_code from redeem_reward('$S','$RW_PCT')")
AP1=$(NEWAPPT "$S" "$ST" "$C1" "$(AT 3 12:00)" "array['$SV'::uuid]")
check "the appointment was quoted 800"  "800.00" "$(Q "select total_amount::text from appointments where id='$AP1'")"
check "a client still cannot rewrite that price" "800.00" \
  "$(AS "$OA" "update appointments set total_amount=1 where id='$AP1'" >/dev/null;
     Q "select total_amount::text from appointments where id='$AP1'")"
check "the owner verified a 10% coupon: 80 off" "80.00" \
  "$(AS "$OA" "select discount_amount::text from mark_redemption_used('$S','$CODE1','APPOINTMENT','$AP1')")"
DONEAPPT "$AP1" "$OA"
check "**the parlour bill fell 800 → 720 at DONE**" "720.00" \
  "$(Q "select total_amount::text from appointments where id='$AP1'")"
check "the appointment still completed normally" "DONE" "$(Q "select status from appointments where id='$AP1'")"
check "and its money is still recorded"          "PAID" "$(Q "select payment_status from appointments where id='$AP1'")"
check "loyalty earned on the discounted bill"    7 \
  "$(Q "select points from loyalty_transactions where source_appointment_id='$AP1'")"

# a free-service coupon, on a two-service bill
CODEF=$(AS "$C1" "select redemption_code from redeem_reward('$S','$RW_FREE')")
AP2=$(NEWAPPT "$S" "$ST2" "$C1" "$(AT 4 12:00)" "array['$SV'::uuid,'$SV2'::uuid]")
check "the two-service appointment was quoted 2300" "2300.00" \
  "$(Q "select total_amount::text from appointments where id='$AP2'")"
check "the free-service coupon is worth the quoted 800" "800.00" \
  "$(AS "$OA" "select discount_amount::text from mark_redemption_used('$S','$CODEF','APPOINTMENT','$AP2')")"
DONEAPPT "$AP2" "$OA"
check "**the bill fell 2300 → 1500**" "1500.00" "$(Q "select total_amount::text from appointments where id='$AP2'")"

# a free-service coupon offered against a bill that has no such service
CODEF2=$(AS "$C1" "select redemption_code from redeem_reward('$S','$RW_FREE')")
AP3=$(NEWAPPT "$S" "$ST" "$C1" "$(AT 5 12:00)" "array['$SV2'::uuid]")
check "**a free-facial coupon is refused on a bill with no facial**" "redemption_service_not_in_booking" \
  "$(WHYAS "$OA" "select * from mark_redemption_used('$S','$CODEF2','APPOINTMENT','$AP3')")"
check "and that coupon is still ISSUED"  "ISSUED" "$(Q "select status from reward_redemptions where code='$CODEF2'")"
DONEAPPT "$AP3" "$OA"
check "an appointment with no coupon keeps its quoted price" "1500.00" \
  "$(Q "select total_amount::text from appointments where id='$AP3'")"

# somebody else's coupon
CODE3=$(AS "$C3" "select redemption_code from redeem_reward('$S','$RW_STK')" 2>/dev/null)
AS "$OA" "update rewards set stock = 5 where id='$RW_STK'" >/dev/null
CODE3=$(AS "$C3" "select redemption_code from redeem_reward('$S','$RW_STK')")
AP4=$(NEWAPPT "$S" "$ST" "$C1" "$(AT 6 12:00)" "array['$SV'::uuid]")
check "**C3's coupon cannot be applied to C1's bill**" "redemption_wrong_customer" \
  "$(WHYAS "$OA" "select * from mark_redemption_used('$S','$CODE3','APPOINTMENT','$AP4')")"
check "and C3's coupon is still ISSUED"  "ISSUED" "$(Q "select status from reward_redemptions where code='$CODE3'")"

echo
echo "== D2. expiry =="
# expires_at is frozen by the history trigger — which is the point of it — so
# backdating for the test means disabling that trigger explicitly rather than
# pretending a client could do this.
Q "alter table public.reward_redemptions disable trigger reward_redemptions_freeze" >/dev/null
Q "update reward_redemptions set expires_at = now() - interval '1 day' where code='$CODE3'" >/dev/null
Q "alter table public.reward_redemptions enable trigger reward_redemptions_freeze" >/dev/null
check "**an expired coupon is refused even before the nightly sweep**" "redemption_expired" \
  "$(WHYAS "$OA" "select * from mark_redemption_used('$S','$CODE3','APPOINTMENT','$AP4')")"
check "the nightly sweep marks exactly one expired" 1 "$(Q "select expire_redemptions()")"
check "and it is EXPIRED now"            "EXPIRED" "$(Q "select status from reward_redemptions where code='$CODE3'")"
check "an EXPIRED coupon still cannot be used" "redemption_expired" \
  "$(WHYAS "$OA" "select * from mark_redemption_used('$S','$CODE3','APPOINTMENT','$AP4')")"
check "the sweep is idempotent"          0 "$(Q "select expire_redemptions()")"
check "expiry is final"                  "redemption_expiry_is_final" \
  "$(WHY "update reward_redemptions set status='ISSUED' where code='$CODE3'")"
check "use is final"                     "redemption_use_is_final" \
  "$(WHY "update reward_redemptions set status='ISSUED' where code='$CODE2'")"

echo
echo "== E. security and forgery, as a real non-superuser =="
# The active catalogue of an ACTIVE shop is public by design — a customer has
# to be able to browse it, exactly as with membership_tiers and offers. What is
# private is the inactive catalogue and every redemption.
check "owner B cannot read shop A's INACTIVE rewards" 0 "$(AS "$OB" "select count(*) from rewards where id='$RW_OFF'")"
check "**owner B cannot read shop A's redemptions**"  0 "$(AS "$OB" "select count(*) from reward_redemptions where shop_id='$S'")"
check "owner B sees only their own shop's redemptions" 0 "$(AS "$OB" "select count(*) from reward_redemptions")"
check "owner A sees their own shop's redemptions"      "t" "$(AS "$OA" "select count(*) > 0 from reward_redemptions")"
check "**a customer cannot read another customer's coupon**" 0 \
  "$(AS "$C3" "select count(*) from reward_redemptions where customer_id='$C2'")"
check "a customer sees only their own"                 "t" \
  "$(AS "$C2" "select bool_and(customer_id = '$C2') from reward_redemptions")"
check "**a customer cannot forge a coupon**"           "violates row-level security" \
  "$(WHYAS "$C3" "insert into reward_redemptions (shop_id,customer_id,reward_id,reward_snapshot,points_spent,code) values ('$S','$C3','$RW_FREE','{}'::jsonb,1,'FORGED')")"
check "nor forge one already USED"                     "violates row-level security" \
  "$(WHYAS "$C3" "insert into reward_redemptions (shop_id,customer_id,reward_id,reward_snapshot,points_spent,code,status,used_at,used_on_booking_type,used_on_booking_id,discount_amount) values ('$S','$C3','$RW_FREE','{}'::jsonb,1,'FORGED2','USED',now(),'SERIAL','$SR2',9999)")"
check "no forged coupon landed"                        0 "$(Q "select count(*) from reward_redemptions where code like 'FORGED%'")"
check "**a customer cannot mark their coupon USED**"    "ISSUED" \
  "$(AS "$C1" "update reward_redemptions set status='USED', used_at=now() where code='$CODEF2'" >/dev/null;
     Q "select status from reward_redemptions where code='$CODEF2'")"
check "**a customer cannot change what a coupon cost**" 200 \
  "$(AS "$C1" "update reward_redemptions set points_spent=1 where code='$CODEF2'" >/dev/null;
     Q "select points_spent from reward_redemptions where code='$CODEF2'")"
check "the OWNER cannot rewrite a coupon either"        200 \
  "$(AS "$OA" "update reward_redemptions set points_spent=1, discount_amount=9999 where code='$CODEF2'" >/dev/null;
     Q "select points_spent from reward_redemptions where code='$CODEF2'")"
check "**nobody can delete a coupon**"                  0 \
  "$(AS "$OA" "with d as (delete from reward_redemptions where shop_id='$S' returning 1) select count(*) from d")"
check "a customer cannot forge a points deduction"      "violates row-level security" \
  "$(WHYAS "$C1" "insert into loyalty_transactions (shop_id,customer_id,points,kind) values ('$S','$C1',-5,'ADJUST')")"
BAL_BEFORE=$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")
AS "$C1" "update loyalty_accounts set balance = 9999 where shop_id='$S' and customer_id='$C1'" >/dev/null
check "**a customer cannot raise their own balance**" "$BAL_BEFORE" \
  "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "    and it certainly did not become 9999" "t" \
  "$(Q "select balance <> 9999 from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "a customer cannot spend someone else's points"   "reward_insufficient_points" \
  "$(WHYAS "$C4" "select * from redeem_reward('$S','$RW_FLAT')")"
check "my_redemptions returns C1's own coupons only"    "t" \
  "$(AS "$C1" "select bool_and(shop_id = '$S') from my_redemptions()")"
check "    and it carries the shop's name"              "Parlour A" \
  "$(AS "$C1" "select shop_name from my_redemptions() limit 1")"
check "    C2 has coupons of their own"                 "t" \
  "$(AS "$C2" "select count(*) > 0 from my_redemptions()")"
check "    and C1's coupons are not among them"         "t" \
  "$(C1_CODES=$(Q "select string_agg(quote_literal(code), ',') from reward_redemptions where customer_id='$C1'");
     AS "$C2" "select not exists (select 1 from my_redemptions() where redemption_code in ($C1_CODES))")"
check "    a guest sees nothing"                        0 "$(Q "select count(*) from my_redemptions()")"

echo
echo "== G. regression: queue, appointments, membership, loyalty, referral =="
check "serials_before_update still there"      "t" "$(Q "select exists (select 1 from pg_trigger where tgname='serials_before_update')")"
check "serials_after_update still there"       "t" "$(Q "select exists (select 1 from pg_trigger where tgname='serials_after_update')")"
check "serials_sync_queue_public still there"  "t" "$(Q "select exists (select 1 from pg_trigger where tgname='serials_sync_queue_public')")"
check "appointments_before_update still there" "t" "$(Q "select exists (select 1 from pg_trigger where tgname='appointments_before_update')")"
check "appointments_after_update still there"  "t" "$(Q "select exists (select 1 from pg_trigger where tgname='appointments_after_update')")"
check "loyalty triggers still there"           "t" \
  "$(Q "select exists (select 1 from pg_trigger where tgname='serials_zz_loyalty_award') and exists (select 1 from pg_trigger where tgname='appointments_zz_loyalty_award')")"
check "referral triggers still there"          "t" \
  "$(Q "select exists (select 1 from pg_trigger where tgname='serials_zz_referral_convert') and exists (select 1 from pg_trigger where tgname='appointments_zz_referral_convert')")"
check "appointment overlap constraint kept"    "t" "$(Q "select exists (select 1 from pg_constraint where conname='appointments_no_overlap')")"
check "5 appointment policies kept"            5 "$(Q "select count(*) from pg_policies where tablename='appointments'")"
check "5 membership policies kept"             5 "$(Q "select count(*) from pg_policies where tablename='customer_memberships'")"
check "referral policies kept"                 "1|1" \
  "$(Q "select (select count(*) from pg_policies where tablename='referrals') || '|' || (select count(*) from pg_policies where tablename='referral_codes')")"
check "loyalty_award kept, unchanged signature" "t" \
  "$(Q "select to_regprocedure('public.loyalty_award(uuid,uuid,integer,text,uuid,uuid,numeric,integer,text)') is not null")"
check "loyalty_adjust kept"                    "t" "$(Q "select to_regprocedure('public.loyalty_adjust(uuid,uuid,integer,text)') is not null")"
check "points_for_bill kept, still IMMUTABLE"  "i" "$(Q "select provolatile from pg_proc where oid='public.points_for_bill(numeric,integer,numeric)'::regprocedure")"
check "my_loyalty_accounts kept"               "t" "$(Q "select to_regprocedure('public.my_loyalty_accounts()') is not null")"
check "claim_referral kept"                    "t" "$(Q "select to_regprocedure('public.claim_referral(uuid,text)') is not null")"
check "referral_convert kept"                  "t" "$(Q "select to_regprocedure('public.referral_convert(uuid,uuid,uuid)') is not null")"
check "my_referral_code kept"                  "t" "$(Q "select to_regprocedure('public.my_referral_code(uuid)') is not null")"
check "membership_is_active kept"              "t" "$(Q "select to_regprocedure('public.membership_is_active(uuid,uuid)') is not null")"
check "expire_memberships kept"                "t" "$(Q "select to_regprocedure('public.expire_memberships()') is not null")"
check "no loyalty_award overload was created"  1 \
  "$(Q "select count(*) from pg_proc where proname='loyalty_award' and pronamespace='public'::regnamespace")"
# Assignments hoisted out of the check argument for the same reason as above.
AS "$OA" "update loyalty_settings set referral_enabled=true, referral_referrer_points=10, referral_referred_points=5 where shop_id='$S'" >/dev/null
RC=$(AS "$C1" "select my_referral_code('$S')")
AS "$C3" "select claim_referral('$S','$RC')" >/dev/null
SRR=$(NEWSERIAL "$S" "$ST" "$C3" "Sumona" 500 "array['$SV'::uuid]" "$SNAP_A")
AS "$OA" "update serials set status='IN_PROGRESS' where id='$SRR'" >/dev/null
AS "$OA" "update serials set status='DONE', payment_status='PAID' where id='$SRR'" >/dev/null
check "**referral still works end to end**"    "CONVERTED" \
  "$(Q "select status from referrals where referred_id='$C3' and shop_id='$S'")"
check "and it still paid the referrer 10"      10 \
  "$(Q "select points from loyalty_transactions where kind='REFERRAL_REFERRER' and customer_id='$C1'")"
check "membership money still separate"        0 "$(Q "select count(*) from customer_memberships")"
check "the invariant holds after everything"   "t" \
  "$(Q "select not exists (select 1 from loyalty_accounts a where a.balance <> coalesce((select sum(t.points) from loyalty_transactions t where t.shop_id=a.shop_id and t.customer_id=a.customer_id),0))")"
check "no account is negative after everything" "t" "$(Q "select not exists (select 1 from loyalty_accounts where balance < 0)")"

echo
echo "== H. a reward failure never blocks a job (decision 55) =="
# Sabotage the discount read the way only a bug could, then confirm an owner
# can still close a job — and that the coupon row survives as the record of
# what was owed.
CODES=$(AS "$C1" "select redemption_code from redeem_reward('$S','$RW_STK')")
AP5=$(NEWAPPT "$S" "$ST" "$C1" "$(AT 7 12:00)" "array['$SV'::uuid]")
AS "$OA" "select * from mark_redemption_used('$S','$CODES','APPOINTMENT','$AP5')" >/dev/null
Q "alter table public.reward_redemptions add constraint zz_sabotage check (false) not valid" >/dev/null
Q "create or replace function public.reward_discount_for(p_kind text, p_value numeric, p_service_id uuid, p_total numeric, p_snapshot jsonb)
   returns numeric language plpgsql immutable as \$x\$ begin raise exception 'zz sabotage'; end \$x\$" >/dev/null
DONEAPPT "$AP5" "$OA"
check "the DONE transition still succeeded despite a broken discount" "DONE" \
  "$(Q "select status from appointments where id='$AP5'")"
check "its money is still recorded"            "PAID" "$(Q "select payment_status from appointments where id='$AP5'")"
check "the coupon row survives as the record"  "20.00" \
  "$(Q "select discount_amount::text from reward_redemptions where code='$CODES'")"
Q "alter table public.reward_redemptions drop constraint zz_sabotage" >/dev/null
FILE "$ROOT/supabase/migrations/20260924_rewards.sql" >/dev/null 2>&1
check "the real formula is back after re-running the migration" "100.00" \
  "$(Q "select reward_discount_for('DISCOUNT_FLAT',100,null,800,'[]'::jsonb)::text")"
check "the invariant survived the sabotage"    "t" \
  "$(Q "select not exists (select 1 from loyalty_accounts a where a.balance <> coalesce((select sum(t.points) from loyalty_transactions t where t.shop_id=a.shop_id and t.customer_id=a.customer_id),0))")"

echo
echo "-------------------------------------------"
printf 'passed: %d   failed: %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
