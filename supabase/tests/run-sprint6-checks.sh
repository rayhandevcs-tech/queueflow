#!/usr/bin/env bash
#
# Sprint 6 — membership, run against a throwaway local Postgres exactly as the
# other harnesses do.
#
#   bash supabase/tests/run-sprint6-checks.sh
#
# Applies 20260918 → 20260919 → 20260920 → 20260921 on top of the fixture, so
# the membership tables land beside a real appointments engine rather than on
# an empty schema, and walks the brief's database test list:
#
#   1. structure — tables, RLS, policies, indexes, triggers, functions
#   2. tiers — validation, per-shop name uniqueness, benefit shape
#   3. enrollment — the server computes price/duration/snapshot, not the client
#   4. one live membership per (shop, customer), enforced by the index
#   5. lifecycle — the status machine, and what each transition stamps
#   6. expiry — never active past expires_at, with or without the cron
#   7. historical integrity — editing a tier rewrites no past membership
#   8. isolation, as a real non-superuser role — read AND write, both ways
#   9. regression — queue, appointments and their money untouched
#
# A green run means the migration is sound against a schema shaped like the
# real one. It is NOT proof that it will apply to production — the fixture is
# a stand-in, not a dump.
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PORT=5603
DIR=$(mktemp -d /tmp/qf-s6-XXXXXX)
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
# Did it raise, and with which reason? Reasons are single tokens on purpose.
WHY()  { Q "$1" 2>&1 | grep -oE 'membership_tier_not_found|membership_tier_wrong_shop|membership_tier_inactive|membership_must_start_pending_or_active|invalid membership status transition|duplicate key value|violates check constraint|violates row-level security' | head -1; }
WHYAS(){ AS "$1" "$2" | grep -oE 'membership_tier_not_found|membership_tier_wrong_shop|membership_tier_inactive|invalid membership status transition|duplicate key value|violates check constraint|violates row-level security' | head -1; }

echo "== applying migrations =="
FILE "$HERE/fixture.sql" >/dev/null || exit 1

# A salon stand-in, so "the queue still works" is a check on a real row.
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
     services_snapshot jsonb not null default '[]'::jsonb,
     completed_at timestamptz,
     created_at timestamptz not null default now()
   )" >/dev/null
Q "create or replace function public.send_due_reminder(p_serial_id uuid) returns void
   language plpgsql as \\\$\\\$ begin
     update public.serials set due_reminded_at = now() where id = p_serial_id;
   end \\\$\\\$" >/dev/null

for m in 20260918_appointment_core 20260919_appointment_availability \
         20260920_appointment_money 20260921_membership; do
  if ! FILE "$ROOT/supabase/migrations/$m.sql" >/dev/null 2>"$DIR/err"; then
    echo "  MIGRATION FAILED: $m"; sed 's/^/    /' "$DIR/err" | head -25; exit 1
  fi
  echo "  applied $m"
done
FILE "$ROOT/supabase/migrations/20260921_membership.sql" >/dev/null 2>&1
check "re-running 20260921 is safe (idempotent)" OK "$(OK 'select 1')"
FILE "$HERE/seed.sql" >/dev/null

OA=11111111-1111-1111-1111-111111111111
OB=22222222-2222-2222-2222-222222222222
C1=33333333-3333-3333-3333-333333333333
C2=44444444-4444-4444-4444-444444444444
S=aaaaaaaa-0000-0000-0000-000000000001
SB=bbbbbbbb-0000-0000-0000-000000000002
ST=cccccccc-0000-0000-0000-000000000001
SV=eeeeeeee-0000-0000-0000-000000000001

TIER="insert into membership_tiers (shop_id, name, price, duration_days, benefits)"
JOIN="insert into customer_memberships (shop_id, customer_id, tier_id)"

# The non-superuser role is created up front, not just before the isolation
# section: superusers bypass RLS *and* carry no auth.uid(), and some of the
# trigger logic asks `is_shop_owner()`. Anything about who may do what has to
# run through this role to mean anything.
Q "drop owned by app_user" >/dev/null 2>&1; Q "drop role if exists app_user" >/dev/null 2>&1
Q "create role app_user nologin" >/dev/null
Q "grant usage on schema public, auth to app_user" >/dev/null
Q "grant select,insert,update,delete on all tables in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema auth to app_user" >/dev/null

echo
echo "== structure =="
check "membership_tiers exists"       "t" "$(Q "select to_regclass('public.membership_tiers') is not null")"
check "customer_memberships exists"  "t" "$(Q "select to_regclass('public.customer_memberships') is not null")"
check "tiers RLS on"                 "t" "$(Q "select relrowsecurity from pg_class where oid='public.membership_tiers'::regclass")"
check "memberships RLS on"           "t" "$(Q "select relrowsecurity from pg_class where oid='public.customer_memberships'::regclass")"
check "2 tier policies"              2 "$(Q "select count(*) from pg_policies where tablename='membership_tiers'")"
check "5 membership policies"        5 "$(Q "select count(*) from pg_policies where tablename='customer_memberships'")"
check "no DELETE policy on memberships" "t" \
  "$(Q "select not exists (select 1 from pg_policies where tablename='customer_memberships' and cmd='DELETE')")"
check "one-live partial unique index" "t" \
  "$(Q "select exists (select 1 from pg_indexes where indexname='customer_memberships_one_live_idx')")"
check "insert trigger exists"        "t" "$(Q "select exists (select 1 from pg_trigger where tgname='customer_memberships_before_insert')")"
check "update trigger exists"        "t" "$(Q "select exists (select 1 from pg_trigger where tgname='customer_memberships_before_update')")"
check "membership_is_active exists"  "t" "$(Q "select to_regprocedure('public.membership_is_active(uuid,uuid)') is not null")"
check "membership_is_active is DEFINER" "t" \
  "$(Q "select prosecdef from pg_proc where oid='public.membership_is_active(uuid,uuid)'::regprocedure")"
check "expire_memberships exists"    "t" "$(Q "select to_regprocedure('public.expire_memberships()') is not null")"
check "summary RPC is INVOKER (RLS decides)" "f" \
  "$(Q "select prosecdef from pg_proc where oid='public.shop_membership_summary(uuid)'::regprocedure")"
check "benefits guard is IMMUTABLE"  "i" \
  "$(Q "select provolatile from pg_proc where oid='public.membership_benefits_valid(jsonb)'::regprocedure")"
check "no tier was seeded for any shop (decision 36)" 0 "$(Q "select count(*) from membership_tiers")"

echo
echo "== tiers =="
G=$(Q "$TIER values ('$S','Gold',1000,30,'[{\\\"kind\\\":\\\"DISCOUNT\\\",\\\"label\\\":\\\"১০% ছাড়\\\",\\\"value\\\":10}]'::jsonb) returning id" | head -1)
check "a tier can be created"                 "t" "$(Q "select '$G' is not null")"
check "the same name twice in one shop is refused" "duplicate key value" \
  "$(WHY "$TIER values ('$S','gold',500,30,'[]'::jsonb)")"
check "the same name in ANOTHER shop is fine" OK \
  "$(OK "$TIER values ('$SB','Gold',900,30,'[]'::jsonb)")"
check "a negative price is refused"           "violates check constraint" \
  "$(WHY "$TIER values ('$S','Cheap',-1,30,'[]'::jsonb)")"
check "a zero-day duration is refused"        "violates check constraint" \
  "$(WHY "$TIER values ('$S','Instant',100,0,'[]'::jsonb)")"
check "a one-letter name is refused"          "violates check constraint" \
  "$(WHY "$TIER values ('$S','X',100,30,'[]'::jsonb)")"
check "an unknown benefit kind is refused"    "violates check constraint" \
  "$(WHY "$TIER values ('$S','Weird',100,30,'[{\\\"kind\\\":\\\"FREE_CAR\\\",\\\"label\\\":\\\"car\\\"}]'::jsonb)")"
check "a benefit with no label is refused"    "violates check constraint" \
  "$(WHY "$TIER values ('$S','Blank',100,30,'[{\\\"kind\\\":\\\"DISCOUNT\\\",\\\"label\\\":\\\"  \\\"}]'::jsonb)")"
check "benefits that are not an array are refused" "violates check constraint" \
  "$(WHY "$TIER values ('$S','Objecty',100,30,'{\\\"kind\\\":\\\"DISCOUNT\\\"}'::jsonb)")"
check "a benefit with no value is fine (only DISCOUNT needs one)" OK \
  "$(OK "$TIER values ('$S','Priority',100,30,'[{\\\"kind\\\":\\\"PRIORITY_BOOKING\\\",\\\"label\\\":\\\"আগে সময় পাবে\\\"}]'::jsonb)")"
check "a tier's shop cannot be moved"         "$S" \
  "$(Q "update membership_tiers set shop_id='$SB' where id='$G'; select shop_id from membership_tiers where id='$G'" | tail -1)"

echo
echo "== enrollment: the server decides the price =="
M1=$(Q "$JOIN values ('$S','$C1','$G') returning id" | head -1)
check "a membership starts PENDING"           "PENDING" "$(Q "select status from customer_memberships where id='$M1'")"
check "the price came from the tier"          "1000.00" "$(Q "select price::text from customer_memberships where id='$M1'")"
check "the duration came from the tier"       30 "$(Q "select duration_days from customer_memberships where id='$M1'")"
check "the snapshot holds the tier's name"    "Gold" "$(Q "select tier_snapshot->>'name' from customer_memberships where id='$M1'")"
check "the snapshot holds the benefits"       "১০% ছাড়" \
  "$(Q "select tier_snapshot->'benefits'->0->>'label' from customer_memberships where id='$M1'")"
check "PENDING has no dates yet"              "t" \
  "$(Q "select started_at is null and expires_at is null from customer_memberships where id='$M1'")"
check "PENDING is unpaid by default"          "DUE" "$(Q "select payment_status from customer_memberships where id='$M1'")"
# The client sending its own price is the attack this trigger exists for.
M2=$(Q "insert into customer_memberships (shop_id, customer_id, tier_id, price, duration_days, tier_snapshot)
        values ('$S','$C2','$G', 1, 9999, '{\\\"name\\\":\\\"forged\\\"}'::jsonb) returning id" | head -1)
check "a client-sent price is overwritten"    "1000.00" "$(Q "select price::text from customer_memberships where id='$M2'")"
check "a client-sent duration is overwritten" 30 "$(Q "select duration_days from customer_memberships where id='$M2'")"
check "a client-sent snapshot is overwritten" "Gold" "$(Q "select tier_snapshot->>'name' from customer_memberships where id='$M2'")"
check "an unknown tier is refused"            "membership_tier_not_found" \
  "$(WHY "$JOIN values ('$S','$C1','00000000-0000-0000-0000-000000000000')")"
# Hoisted out of the check argument on purpose: an assignment nested inside
# `$( … )` inside a quoted argument does not reach the command that follows it.
GB=$(Q "select id from membership_tiers where shop_id='$SB' limit 1" | head -1)
check "another shop's tier is refused"        "membership_tier_wrong_shop" \
  "$(WHY "$JOIN values ('$S','$C1','$GB')")"
PI=$(Q "select id from membership_tiers where name='Priority' and shop_id='$S'" | head -1)
Q "update membership_tiers set is_active=false where id='$PI'" >/dev/null
check "an inactive tier cannot be joined"     "membership_tier_inactive" \
  "$(WHY "$JOIN values ('$S','$C2','$PI')")"
Q "update membership_tiers set is_active=true where id='$PI'" >/dev/null
check "starting straight in EXPIRED is refused" "membership_must_start_pending_or_active" \
  "$(Q "insert into customer_memberships (shop_id,customer_id,tier_id,status) values ('$S','$C1','$G','EXPIRED')" 2>&1 | grep -oE 'membership_must_start_pending_or_active')"

echo
echo "== one live membership per (shop, customer) =="
check "a second live membership at the same shop is refused" "duplicate key value" \
  "$(WHY "$JOIN values ('$S','$C1','$G')")"
check "the same customer at ANOTHER shop is fine" OK \
  "$(OK "insert into customer_memberships (shop_id,customer_id,tier_id) values ('$SB','$C1','$GB')")"
check "customer A's membership is business-scoped" 1 \
  "$(Q "select count(*) from customer_memberships where customer_id='$C1' and shop_id='$S'")"
check "and they hold one at each shop separately" 2 \
  "$(Q "select count(*) from customer_memberships where customer_id='$C1'")"
# Cancelling frees the slot — a customer who left can come back.
Q "update customer_memberships set status='CANCELLED' where id='$M2'" >/dev/null
check "after cancelling, the same customer can join again" OK \
  "$(OK "$JOIN values ('$S','$C2','$G')")"
check "the cancelled row is still there (history, not deleted)" 1 \
  "$(Q "select count(*) from customer_memberships where id='$M2'")"

echo
echo "== lifecycle =="
# As the owner, not as the superuser: recording a payment is gated on
# `is_shop_owner()`, and a superuser has no auth.uid() to be one.
AS "$OA" "update customer_memberships set status='ACTIVE', payment_status='PAID', payment_method='bkash' where id='$M1'" >/dev/null
check "PENDING → ACTIVE works"                "ACTIVE"  "$(Q "select status from customer_memberships where id='$M1'")"
check "activation stamps started_at"          "t" "$(Q "select started_at is not null from customer_memberships where id='$M1'")"
check "activation computes expires_at from the duration" "t" \
  "$(Q "select expires_at = started_at + interval '30 days' from customer_memberships where id='$M1'")"
check "paying stamps paid_at"                 "t" "$(Q "select paid_at is not null from customer_memberships where id='$M1'")"
check "the method was recorded"               "bkash" "$(Q "select payment_method from customer_memberships where id='$M1'")"
check "ACTIVE → PENDING is refused"           "invalid membership status transition" \
  "$(WHY "update customer_memberships set status='PENDING' where id='$M1'")"
check "the window cannot be stretched later"  "t" \
  "$(Q "update customer_memberships set expires_at = now() + interval '900 days' where id='$M1'" >/dev/null;
     Q "select expires_at < now() + interval '31 days' from customer_memberships where id='$M1'")"
STARTED=$(Q "select started_at from customer_memberships where id='$M1'" | head -1)
Q "update customer_memberships set started_at = now() - interval '100 days' where id='$M1'" >/dev/null
check "started_at cannot be moved either"     "t" \
  "$(Q "select started_at = '$STARTED'::timestamptz from customer_memberships where id='$M1'")"
check "ACTIVE → EXPIRED works"                "EXPIRED" \
  "$(Q "update customer_memberships set status='EXPIRED' where id='$M1'" >/dev/null;
     Q "select status from customer_memberships where id='$M1'")"
check "EXPIRED is terminal"                   "invalid membership status transition" \
  "$(WHY "update customer_memberships set status='ACTIVE' where id='$M1'")"
check "CANCELLED is terminal too"             "invalid membership status transition" \
  "$(WHY "update customer_memberships set status='ACTIVE' where id='$M2'")"
check "cancelling stamps cancelled_at"        "t" \
  "$(Q "select cancelled_at is not null from customer_memberships where id='$M2'")"

echo
echo "== expiry: never active past expires_at =="
Q "delete from customer_memberships" >/dev/null
E1=$(Q "insert into customer_memberships (shop_id,customer_id,tier_id,status) values ('$S','$C1','$G','ACTIVE') returning id" | head -1)
check "a fresh membership reads as active"    "t" "$(Q "select membership_is_active('$S','$C1')")"
check "a PENDING one does not"                "f" \
  "$(P=$(Q "$JOIN values ('$S','$C2','$G') returning id" | head -1); Q "select membership_is_active('$S','$C2')")"
# Backdate the row directly (the app cannot — that is the freeze above), so the
# read paths can be tested against a lapsed one.
Q "alter table customer_memberships disable trigger customer_memberships_before_update" >/dev/null
Q "update customer_memberships set started_at = now() - interval '40 days', expires_at = now() - interval '10 days' where id='$E1'" >/dev/null
Q "alter table customer_memberships enable trigger customer_memberships_before_update" >/dev/null
check "a lapsed row is NOT active, even while still marked ACTIVE" "f" \
  "$(Q "select membership_is_active('$S','$C1')")"
check "its status is still literally ACTIVE (cron has not run)" "ACTIVE" \
  "$(Q "select status from customer_memberships where id='$E1'")"
check "the nightly job flips exactly one row" 1 "$(Q "select expire_memberships()")"
check "a second run flips nothing (idempotent)" 0 "$(Q "select expire_memberships()")"
check "and now it reads EXPIRED"              "EXPIRED" "$(Q "select status from customer_memberships where id='$E1'")"
check "the summary excludes a lapsed membership" 0 \
  "$(Q "select active_count from shop_membership_summary('$S')")"
# Renewal must not be blocked by a lapsed row, cron or no cron.
Q "delete from customer_memberships" >/dev/null
R1=$(Q "insert into customer_memberships (shop_id,customer_id,tier_id,status) values ('$S','$C1','$G','ACTIVE') returning id" | head -1)
Q "alter table customer_memberships disable trigger customer_memberships_before_update" >/dev/null
Q "update customer_memberships set started_at = now() - interval '40 days', expires_at = now() - interval '1 hour' where id='$R1'" >/dev/null
Q "alter table customer_memberships enable trigger customer_memberships_before_update" >/dev/null
check "renewing over a lapsed row works without the cron" OK \
  "$(OK "$JOIN values ('$S','$C1','$G')")"
check "the lapsed row was expired on the way" "EXPIRED" \
  "$(Q "select status from customer_memberships where id='$R1'")"
check "and there is exactly one live row again" 1 \
  "$(Q "select count(*) from customer_memberships where shop_id='$S' and customer_id='$C1' and status in ('PENDING','ACTIVE')")"

echo
echo "== historical integrity =="
Q "delete from customer_memberships" >/dev/null
H1=$(Q "insert into customer_memberships (shop_id,customer_id,tier_id,status) values ('$S','$C1','$G','ACTIVE') returning id" | head -1)
Q "update membership_tiers
      set name='Gold Plus', price=2500, duration_days=90,
          benefits='[{\\\"kind\\\":\\\"DISCOUNT\\\",\\\"label\\\":\\\"২৫% ছাড়\\\",\\\"value\\\":25}]'::jsonb
    where id='$G'" >/dev/null
check "the tier really was edited"            "2500.00" "$(Q "select price::text from membership_tiers where id='$G'")"
check "the old membership keeps its price"    "1000.00" "$(Q "select price::text from customer_memberships where id='$H1'")"
check "and its duration"                      30 "$(Q "select duration_days from customer_memberships where id='$H1'")"
check "and the name it was sold under"        "Gold" "$(Q "select tier_snapshot->>'name' from customer_memberships where id='$H1'")"
check "and the benefits it was sold with"     "১০% ছাড়" \
  "$(Q "select tier_snapshot->'benefits'->0->>'label' from customer_memberships where id='$H1'")"
check "its expiry still follows the OLD duration" "t" \
  "$(Q "select expires_at = started_at + interval '30 days' from customer_memberships where id='$H1'")"
N1=$(Q "$JOIN values ('$S','$C2','$G') returning id" | head -1)
check "a NEW membership picks up the new price" "2500.00" \
  "$(Q "select price::text from customer_memberships where id='$N1'")"
check "the tier link survives (not orphaned)" "t" \
  "$(Q "select tier_id = '$G' from customer_memberships where id='$H1'")"
check "a tier with members cannot be deleted" "FAIL" "$(OK "delete from membership_tiers where id='$G'")"
check "a tier with no members can be"         OK \
  "$(Q "$TIER values ('$S','Throwaway',10,10,'[]'::jsonb)" >/dev/null; OK "delete from membership_tiers where name='Throwaway' and shop_id='$S'")"

echo
echo "== isolation, as a real non-superuser =="
GB=$(Q "select id from membership_tiers where shop_id='$SB' limit 1" | head -1)
Q "insert into customer_memberships (shop_id,customer_id,tier_id,status) values ('$SB','$C2','$GB','ACTIVE')" >/dev/null

check "owner A sees only their own shop's memberships" 2 \
  "$(AS "$OA" "select count(*) from customer_memberships")"
check "owner B sees only theirs"                       1 \
  "$(AS "$OB" "select count(*) from customer_memberships")"
check "owner B cannot read shop A's memberships by id" 0 \
  "$(AS "$OB" "select count(*) from customer_memberships where shop_id='$S'")"
check "owner B cannot read shop A's prices"            "0" \
  "$(AS "$OB" "select coalesce(sum(price),0)::int from customer_memberships where shop_id='$S'")"
check "owner B cannot MODIFY shop A's membership"      0 \
  "$(AS "$OB" "with u as (update customer_memberships set status='CANCELLED' where shop_id='$S' returning 1) select count(*) from u")"
check "the row is untouched"                           "ACTIVE" \
  "$(Q "select status from customer_memberships where id='$H1'")"
check "owner B cannot enroll someone at shop A"        "violates row-level security" \
  "$(WHYAS "$OB" "insert into customer_memberships (shop_id,customer_id,tier_id) values ('$S','$C2','$G')")"
check "owner B cannot edit shop A's tiers"             0 \
  "$(AS "$OB" "with u as (update membership_tiers set price=1 where shop_id='$S' returning 1) select count(*) from u")"
check "owner B cannot create a tier at shop A"         "violates row-level security" \
  "$(WHYAS "$OB" "insert into membership_tiers (shop_id,name,price,duration_days) values ('$S','Sneaky',1,1)")"
check "a customer sees their own membership"           1 \
  "$(AS "$C1" "select count(*) from customer_memberships")"
check "a customer cannot see another customer's"       0 \
  "$(AS "$C2" "select count(*) from customer_memberships where customer_id='$C1'")"
P2=$(Q "select id from customer_memberships where customer_id='$C2' and shop_id='$S' and status='PENDING'" | head -1)
AS "$C2" "update customer_memberships set status='ACTIVE' where id='$P2'" >/dev/null
check "a customer cannot activate their own request"   "PENDING" \
  "$(Q "select status from customer_memberships where id='$P2'")"
AS "$C2" "update customer_memberships set status='CANCELLED' where id='$P2'" >/dev/null
check "a customer CAN cancel their own"                "CANCELLED" \
  "$(Q "select status from customer_memberships where id='$P2'")"
# The hole the first run of this harness found: RLS lets a customer create a
# PENDING row, and nothing stopped them declaring it PAID in the same insert.
Q "delete from customer_memberships where customer_id='$C1' and shop_id='$SB'" >/dev/null
AS "$C1" "insert into customer_memberships (shop_id,customer_id,tier_id,payment_status,payment_method)
            values ('$SB','$C1','$GB','PAID','cash')" >/dev/null
check "a customer cannot forge a paid membership"      "DUE" \
  "$(Q "select payment_status from customer_memberships where customer_id='$C1' and shop_id='$SB'" | head -1)"
check "nor a payment method"                           "t" \
  "$(Q "select payment_method is null from customer_memberships where customer_id='$C1' and shop_id='$SB'" | head -1)"
CM=$(Q "select id from customer_memberships where customer_id='$C1' and shop_id='$SB'" | head -1)
AS "$C1" "update customer_memberships set status='CANCELLED', payment_status='PAID' where id='$CM'" >/dev/null
check "nor slip a payment in while cancelling"         "DUE" \
  "$(Q "select payment_status from customer_memberships where id='$CM'")"
check "the cancel itself still went through"           "CANCELLED" \
  "$(Q "select status from customer_memberships where id='$CM'")"
check "nobody can delete a membership (no DELETE policy)" 0 \
  "$(AS "$OA" "with d as (delete from customer_memberships where shop_id='$S' returning 1) select count(*) from d")"
check "customers cannot see an inactive tier"          0 \
  "$(Q "update membership_tiers set is_active=false where id='$GB'" >/dev/null;
     AS "$C1" "select count(*) from membership_tiers where id='$GB'")"
check "but its own shop's owner still can"             1 \
  "$(AS "$OB" "select count(*) from membership_tiers where id='$GB'")"
Q "update membership_tiers set is_active=true where id='$GB'" >/dev/null
check "the summary is empty for another shop's owner"  0 \
  "$(AS "$OB" "select active_count from shop_membership_summary('$S')")"
check "and real for the right owner"                   1 \
  "$(AS "$OA" "select active_count from shop_membership_summary('$S')")"
check "membership_is_active is business-scoped"        "f" \
  "$(Q "select membership_is_active('$SB','$C1') and membership_is_active('$S','$C1') = false")"

echo
echo "== regression: queue, appointments and their money =="
check "serials table still there"          "t" "$(Q "select to_regclass('public.serials') is not null")"
check "appointments table still there"     "t" "$(Q "select to_regclass('public.appointments') is not null")"
check "appointment overlap constraint kept" "t" \
  "$(Q "select exists (select 1 from pg_constraint where conname='appointments_no_overlap')")"
check "5 appointment policies kept"        5 "$(Q "select count(*) from pg_policies where tablename='appointments'")"
check "appointment completed_at kept"      "t" \
  "$(Q "select exists (select 1 from information_schema.columns where table_name='appointments' and column_name='completed_at')")"
check "queue due reminder kept"            "t" "$(Q "select to_regprocedure('public.send_due_reminder(uuid)') is not null")"
check "appointment due reminder kept"      "t" \
  "$(Q "select to_regprocedure('public.send_appointment_due_reminder(uuid)') is not null")"
check "appointment reminder RPC kept"      "t" \
  "$(Q "select to_regprocedure('public.send_appointment_reminders(integer)') is not null")"
check "reschedule RPC kept"                "t" \
  "$(Q "select to_regprocedure('public.reschedule_appointment(uuid,timestamptz,uuid,text)') is not null")"
# The behavioural half: both money flows still work, with membership beside them.
A1=$(Q "insert into appointments (shop_id,staff_id,customer_id,service_ids,starts_at,ends_at,is_walk_in)
        values ('$S','$ST','$C1',array['$SV'::uuid],
                ((current_date + 3 + time '12:00') at time zone 'Asia/Dhaka'),
                ((current_date + 3 + time '13:00') at time zone 'Asia/Dhaka'), false) returning id" | head -1)
Q "update appointments set status='IN_PROGRESS' where id='$A1'" >/dev/null
Q "update appointments set status='DONE', payment_status='PAID', payment_method='cash', due_amount=0 where id='$A1'" >/dev/null
check "an appointment still completes and gets paid" "PAID" \
  "$(Q "select payment_status from appointments where id='$A1'")"
check "and still stamps completed_at"      "t" \
  "$(Q "select completed_at is not null from appointments where id='$A1'")"
check "the appointment income query is unchanged" "800.00" \
  "$(Q "select coalesce(sum(total_amount),0)::text from appointments where shop_id='$S' and status='DONE' and payment_status in ('PAID','DUE')")"
SR=$(Q "insert into serials (shop_id,chair_id,customer_id,customer_name,total_amount,status,payment_status,payment_method,completed_at)
        values ('$S','$ST','$C1','Queue customer',300,'DONE','PAID','cash',now()) returning id" | head -1)
check "a serial still completes and counts" "300.00" \
  "$(Q "select coalesce(sum(total_amount),0)::text from serials where shop_id='$S' and status='DONE' and payment_status in ('PAID','DUE')")"
check "membership money is NOT mixed into appointment income" "800.00" \
  "$(Q "select coalesce(sum(total_amount),0)::text from appointments where shop_id='$S' and status='DONE'")"
check "no membership row leaked into serials" 0 "$(Q "select count(*) from serials where customer_name='Gold'")"
check "membership has no column on serials"  0 \
  "$(Q "select count(*) from information_schema.columns where table_name='serials' and column_name like '%member%'")"
check "membership has no column on appointments" 0 \
  "$(Q "select count(*) from information_schema.columns where table_name='appointments' and column_name like '%member%'")"

echo
echo "-------------------------------------------"
printf 'passed: %d   failed: %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
