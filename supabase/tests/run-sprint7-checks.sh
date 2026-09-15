#!/usr/bin/env bash
#
# Sprint 7 — loyalty points, run against a throwaway local Postgres exactly as
# the other harnesses do.
#
#   bash supabase/tests/run-sprint7-checks.sh
#
# Applies 20260918 → 20260919 → 20260920 → 20260921 → 20260922 on top of the
# fixture, so loyalty lands beside a real appointments engine and a real
# membership programme rather than on an empty schema, and walks the brief:
#
#   1. structure — tables, RLS, the ABSENCE of write policies (decision 32)
#   2. the points formula, including its edges
#   3. earning from a queue serial and from a parlour appointment
#   4. never twice for the same job
#   5. the switch — a shop that hasn't enabled it earns nothing (decision 36)
#   6. balance == ledger sum, the invariant the plan names
#   7. isolation, as a real non-superuser: the plan's three named tests
#   8. regression — queue, appointments, membership and their money untouched
#
# A green run means the migration is sound against a schema shaped like the
# real one. It is NOT proof that it will apply to production — the fixture is
# a stand-in, not a dump.
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PORT=5604
DIR=$(mktemp -d /tmp/qf-s7-XXXXXX)
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
WHY()  { Q "$1" 2>&1 | grep -oE 'not your shop|loyalty_points_must_be_positive|loyalty_points_must_not_be_zero|loyalty_balance_cannot_go_negative|loyalty_award_kind_invalid|loyalty_needs_a_customer|duplicate key value|violates check constraint|violates row-level security|permission denied' | head -1; }
WHYAS(){ AS "$1" "$2" | grep -oE 'not your shop|loyalty_points_must_be_positive|loyalty_points_must_not_be_zero|loyalty_balance_cannot_go_negative|loyalty_award_kind_invalid|loyalty_needs_a_customer|duplicate key value|violates check constraint|violates row-level security|permission denied' | head -1; }

echo "== applying migrations =="
FILE "$HERE/fixture.sql" >/dev/null || exit 1

# The shared fixture's `shops` stand-in has no logo_url; the real table does,
# and my_loyalty_accounts() returns it so each point card can picture its shop.
# Added here rather than in fixture.sql, which the other harnesses share.
Q "alter table public.shops add column if not exists logo_url text" >/dev/null

# A salon stand-in with the money columns the loyalty trigger reads, so the
# queue side of "DONE -> points" is exercised on a real row.
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
su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -q" <<'STUBS' >/dev/null
create or replace function public.send_due_reminder(p uuid) returns void language plpgsql as $x$ begin end $x$;
create or replace function public.send_daily_summaries(p_day date default null) returns int language sql as $x$ select 0 $x$;
create or replace function public.send_customer_reminders() returns int language sql as $x$ select 0 $x$;
-- stand-ins for the two existing serials triggers the migration must not disturb
create or replace function public.serial_before_update() returns trigger language plpgsql as $x$
  begin if new.status='DONE' then new.completed_at := coalesce(old.completed_at, now()); end if; return new; end $x$;
create trigger serials_before_update before update on public.serials
  for each row execute function public.serial_before_update();
create or replace function public.serial_after_update() returns trigger language plpgsql as $x$ begin return null; end $x$;
create trigger serials_after_update after update on public.serials
  for each row execute function public.serial_after_update();
create trigger serials_sync_queue_public after insert or update on public.serials
  for each row execute function public.serial_after_update();
STUBS

for m in 20260918_appointment_core 20260919_appointment_availability \
         20260920_appointment_money 20260921_membership 20260922_loyalty; do
  if ! FILE "$ROOT/supabase/migrations/$m.sql" >/dev/null 2>"$DIR/err"; then
    echo "  MIGRATION FAILED: $m"; sed 's/^/    /' "$DIR/err" | head -25; exit 1
  fi
  echo "  applied $m"
done
FILE "$ROOT/supabase/migrations/20260922_loyalty.sql" >/dev/null 2>&1
check "re-running 20260922 is safe (idempotent)" OK "$(OK 'select 1')"
FILE "$HERE/seed.sql" >/dev/null

OA=11111111-1111-1111-1111-111111111111
OB=22222222-2222-2222-2222-222222222222
C1=33333333-3333-3333-3333-333333333333
C2=44444444-4444-4444-4444-444444444444
S=aaaaaaaa-0000-0000-0000-000000000001
SB=bbbbbbbb-0000-0000-0000-000000000002
ST=cccccccc-0000-0000-0000-000000000001
ST2=cccccccc-0000-0000-0000-000000000002
STB=dddddddd-0000-0000-0000-000000000001
SV=eeeeeeee-0000-0000-0000-000000000001
SVB=ffffffff-0000-0000-0000-000000000001

AT() { echo "((current_date + $1 + time '$2') at time zone 'Asia/Dhaka')"; }
# $5 is the service; it must belong to $1, or the insert trigger refuses it
# for being cross-shop (which is how a wrong service silently cost shop B its
# account on the first run of this harness).
NEWAPPT() { Q "insert into appointments (shop_id,staff_id,customer_id,service_ids,starts_at,ends_at,is_walk_in)
                values ('$1','$2','$3',array['${5:-$SV}'::uuid], $4, $4 + interval '1 hour', false) returning id" | head -1; }

# The non-superuser role, created up front: superusers bypass RLS *and* carry
# no auth.uid(), and every loyalty write is gated on is_shop_owner().
Q "drop owned by app_user" >/dev/null 2>&1; Q "drop role if exists app_user" >/dev/null 2>&1
Q "create role app_user nologin" >/dev/null
Q "grant usage on schema public, auth to app_user" >/dev/null
Q "grant select,insert,update,delete on all tables in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema auth to app_user" >/dev/null

echo
echo "== structure =="
check "loyalty_settings exists"     "t" "$(Q "select to_regclass('public.loyalty_settings') is not null")"
check "loyalty_accounts exists"     "t" "$(Q "select to_regclass('public.loyalty_accounts') is not null")"
check "loyalty_transactions exists" "t" "$(Q "select to_regclass('public.loyalty_transactions') is not null")"
check "settings RLS on"             "t" "$(Q "select relrowsecurity from pg_class where oid='public.loyalty_settings'::regclass")"
check "accounts RLS on"             "t" "$(Q "select relrowsecurity from pg_class where oid='public.loyalty_accounts'::regclass")"
check "ledger RLS on"               "t" "$(Q "select relrowsecurity from pg_class where oid='public.loyalty_transactions'::regclass")"
check "2 settings policies"         2 "$(Q "select count(*) from pg_policies where tablename='loyalty_settings'")"
# decision 32 — the absence of write policies IS the design
check "accounts: exactly 1 policy"  1 "$(Q "select count(*) from pg_policies where tablename='loyalty_accounts'")"
check "accounts: that policy is SELECT" "SELECT" "$(Q "select cmd from pg_policies where tablename='loyalty_accounts'")"
check "accounts: NO update policy"  "t" "$(Q "select not exists (select 1 from pg_policies where tablename='loyalty_accounts' and cmd='UPDATE')")"
check "accounts: NO insert policy"  "t" "$(Q "select not exists (select 1 from pg_policies where tablename='loyalty_accounts' and cmd='INSERT')")"
check "ledger: exactly 1 policy"    1 "$(Q "select count(*) from pg_policies where tablename='loyalty_transactions'")"
check "ledger: append-only to clients" "t" "$(Q "select not exists (select 1 from pg_policies where tablename='loyalty_transactions' and cmd='INSERT')")"
# decision 33 — the (shop, customer) pair owns the points
check "accounts PK is (shop_id, customer_id)" "{shop_id,customer_id}" \
  "$(Q "select array_agg(a.attname::text order by k.ord) from pg_constraint c join unnest(c.conkey) with ordinality as k(attnum, ord) on true join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum where c.conrelid='public.loyalty_accounts'::regclass and c.contype='p'")"
check "one-per-serial unique index" "t" "$(Q "select exists (select 1 from pg_indexes where indexname='loyalty_tx_one_per_serial_idx')")"
check "one-per-appointment unique index" "t" "$(Q "select exists (select 1 from pg_indexes where indexname='loyalty_tx_one_per_appointment_idx')")"
check "points_for_bill is IMMUTABLE" "i" "$(Q "select provolatile from pg_proc where oid='public.points_for_bill(numeric,integer,numeric)'::regprocedure")"
check "loyalty_award is DEFINER"    "t" "$(Q "select prosecdef from pg_proc where proname='loyalty_award' and pronamespace='public'::regnamespace")"
check "loyalty_adjust is DEFINER"   "t" "$(Q "select prosecdef from pg_proc where proname='loyalty_adjust' and pronamespace='public'::regnamespace")"
check "my_loyalty_accounts is DEFINER" "t" "$(Q "select prosecdef from pg_proc where oid='public.my_loyalty_accounts()'::regprocedure")"
check "serials loyalty trigger exists" "t" "$(Q "select exists (select 1 from pg_trigger where tgname='serials_zz_loyalty_award')")"
check "appointments loyalty trigger exists" "t" "$(Q "select exists (select 1 from pg_trigger where tgname='appointments_zz_loyalty_award')")"
check "no shop had loyalty switched on" 0 "$(Q "select count(*) from loyalty_settings where is_enabled")"

echo
echo "== the points formula =="
check "800 at 100/point = 8"        8 "$(Q "select points_for_bill(800, 100, 0)")"
check "99 at 100/point = 0 (floor)" 0 "$(Q "select points_for_bill(99, 100, 0)")"
check "850 at 100/point = 8 (floor, not 8.5)" 8 "$(Q "select points_for_bill(850, 100, 0)")"
check "0 taka earns 0"              0 "$(Q "select points_for_bill(0, 100, 0)")"
check "below min_bill earns 0"      0 "$(Q "select points_for_bill(400, 100, 500)")"
check "at min_bill earns"           5 "$(Q "select points_for_bill(500, 100, 500)")"
check "a null bill earns 0"         0 "$(Q "select points_for_bill(null, 100, 0)")"
check "a 0 rate cannot divide by zero" 0 "$(Q "select points_for_bill(800, 0, 0)")"
check "rate of 1 gives a point per taka" 800 "$(Q "select points_for_bill(800, 1, 0)")"

echo
echo "== the switch (decision 36) =="
A1=$(NEWAPPT "$S" "$ST" "$C1" "$(AT 3 12:00)")
AS "$OA" "update appointments set status='IN_PROGRESS' where id='$A1'" >/dev/null
AS "$OA" "update appointments set status='DONE', payment_status='PAID', payment_method='cash', due_amount=0 where id='$A1'" >/dev/null
check "loyalty off: a completed appointment earns nothing" 0 \
  "$(Q "select count(*) from loyalty_transactions")"
check "loyalty off: no account was created"                0 \
  "$(Q "select count(*) from loyalty_accounts")"
check "but the appointment still completed normally"       "DONE" \
  "$(Q "select status from appointments where id='$A1'")"
check "and its money is still recorded"                    "PAID" \
  "$(Q "select payment_status from appointments where id='$A1'")"

# Now the owner switches it on, at 100 taka per point.
AS "$OA" "insert into loyalty_settings (shop_id, is_enabled, taka_per_point) values ('$S', true, 100)" >/dev/null
check "the owner could enable it"  "t" "$(Q "select is_enabled from loyalty_settings where shop_id='$S'")"
check "another shop's owner cannot enable it for shop A" "violates row-level security" \
  "$(WHYAS "$OB" "insert into loyalty_settings (shop_id, is_enabled) values ('$SB', true), ('$S', true)")"

echo
echo "== earning: parlour appointment =="
A2=$(NEWAPPT "$S" "$ST" "$C1" "$(AT 4 12:00)")
AS "$OA" "update appointments set status='IN_PROGRESS' where id='$A2'" >/dev/null
AS "$OA" "update appointments set status='DONE', payment_status='PAID', payment_method='cash', due_amount=0 where id='$A2'" >/dev/null
check "a completed appointment earned points"  8 "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "the ledger row says where they came from" "EARN_APPOINTMENT" \
  "$(Q "select kind from loyalty_transactions where source_appointment_id='$A2'")"
check "it snapshots the bill"                  "800.00" "$(Q "select bill_amount::text from loyalty_transactions where source_appointment_id='$A2'")"
check "it snapshots the rate in force"         100 "$(Q "select taka_per_point from loyalty_transactions where source_appointment_id='$A2'")"
check "lifetime_earned tracks it"              8 "$(Q "select lifetime_earned from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"

# A second UPDATE on the same DONE row must not pay twice.
AS "$OA" "update appointments set due_reminded_at = now() where id='$A2'" >/dev/null
check "a later update on the same row pays nothing more" 1 \
  "$(Q "select count(*) from loyalty_transactions where source_appointment_id='$A2'")"
check "balance unchanged"                      8 "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "calling loyalty_award again for that appointment is refused" "duplicate key value" \
  "$(WHYAS "$OA" "select loyalty_award('$S','$C1',8,'EARN_APPOINTMENT',null,'$A2',800,100,null)")"

echo
echo "== earning: salon queue serial =="
SR=$(Q "insert into serials (shop_id, chair_id, customer_id, customer_name, total_amount, status)
        values ('$S','$ST','$C2','Queue customer', 1250, 'WAITING') returning id" | head -1)
AS "$OA" "update serials set status='DONE', payment_status='PAID', payment_method='cash' where id='$SR'" >/dev/null
check "a completed serial earned points"       12 "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C2'")"
check "the ledger names the queue as the source" "EARN_SERIAL" \
  "$(Q "select kind from loyalty_transactions where source_serial_id='$SR'")"
check "the serial still completed normally"    "DONE" "$(Q "select status from serials where id='$SR'")"
check "and still stamped its own completed_at" "t" "$(Q "select completed_at is not null from serials where id='$SR'")"
check "a second update on the serial pays nothing more" 1 \
  "$(Q "select count(*) from loyalty_transactions where source_serial_id='$SR'")"

# A walk-in has no account to credit — normal, not an error.
SW=$(Q "insert into serials (shop_id, chair_id, customer_name, total_amount, status)
        values ('$S','$ST','Walk in', 900, 'WAITING') returning id" | head -1)
AS "$OA" "update serials set status='DONE', payment_status='PAID' where id='$SW'" >/dev/null
check "a walk-in with no account earns nothing" 2 "$(Q "select count(*) from loyalty_transactions")"
check "and the walk-in's job still completed"   "DONE" "$(Q "select status from serials where id='$SW'")"

echo
echo "== min_bill =="
AS "$OA" "update loyalty_settings set min_bill_taka = 1000 where shop_id='$S'" >/dev/null
A3=$(NEWAPPT "$S" "$ST2" "$C1" "$(AT 5 12:00)")
AS "$OA" "update appointments set status='IN_PROGRESS' where id='$A3'" >/dev/null
AS "$OA" "update appointments set status='DONE', payment_status='PAID' where id='$A3'" >/dev/null
check "an 800 bill under a 1000 floor earns nothing" 8 \
  "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "and wrote no ledger row"                      "t" \
  "$(Q "select not exists (select 1 from loyalty_transactions where source_appointment_id='$A3')")"
AS "$OA" "update loyalty_settings set min_bill_taka = 0 where shop_id='$S'" >/dev/null

echo
echo "== balance == ledger sum (the plan's invariant) =="
check "every account matches its ledger"  "t" \
  "$(Q "select not exists (select 1 from loyalty_accounts a where a.balance <> coalesce((select sum(t.points) from loyalty_transactions t where t.shop_id=a.shop_id and t.customer_id=a.customer_id),0))")"
# a manual correction, then re-check
AS "$OA" "select loyalty_adjust('$S','$C1',5,'goodwill')" >/dev/null
check "a positive adjust raised the balance"  13 "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "and left a ledger row that says why"   "goodwill" "$(Q "select note from loyalty_transactions where kind='ADJUST' and customer_id='$C1'")"
AS "$OA" "select loyalty_adjust('$S','$C1',-3,'correction')" >/dev/null
check "a negative adjust lowered it"          10 "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "lifetime_earned did NOT fall"          13 "$(Q "select lifetime_earned from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "the invariant still holds after adjusts" "t" \
  "$(Q "select not exists (select 1 from loyalty_accounts a where a.balance <> coalesce((select sum(t.points) from loyalty_transactions t where t.shop_id=a.shop_id and t.customer_id=a.customer_id),0))")"
check "adjusting below zero is refused"       "loyalty_balance_cannot_go_negative" \
  "$(WHYAS "$OA" "select loyalty_adjust('$S','$C1',-9999,'too much')")"
check "the refusal changed nothing"           10 "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "a zero adjust is refused"              "loyalty_points_must_not_be_zero" \
  "$(WHYAS "$OA" "select loyalty_adjust('$S','$C1',0,'nothing')")"

echo
echo "== isolation, as a real non-superuser =="
# shop B gets its own programme and its own points, so "sees nothing" is about
# scoping rather than an empty table
AS "$OB" "insert into loyalty_settings (shop_id, is_enabled, taka_per_point) values ('$SB', true, 50)" >/dev/null
AB=$(NEWAPPT "$SB" "$STB" "$C2" "$(AT 4 12:00)" "$SVB")
AS "$OB" "update appointments set status='IN_PROGRESS' where id='$AB'" >/dev/null
AS "$OB" "update appointments set status='DONE', payment_status='PAID' where id='$AB'" >/dev/null
check "shop B's own programme works (900 at 50 = 18)" 18 \
  "$(Q "select balance from loyalty_accounts where shop_id='$SB' and customer_id='$C2'")"

# (ক) B's owner cannot read A's loyalty_accounts
check "(a) owner B cannot read shop A's accounts"      0 "$(AS "$OB" "select count(*) from loyalty_accounts where shop_id='$S'")"
check "    owner B sees only their own"                1 "$(AS "$OB" "select count(*) from loyalty_accounts")"
check "    owner A sees only theirs"                   2 "$(AS "$OA" "select count(*) from loyalty_accounts")"
check "    owner B cannot read shop A's ledger"        0 "$(AS "$OB" "select count(*) from loyalty_transactions where shop_id='$S'")"
check "    owner B cannot sum shop A's points"         "0" "$(AS "$OB" "select coalesce(sum(balance),0)::int from loyalty_accounts where shop_id='$S'")"

# (খ) a customer cannot UPDATE their balance directly
check "(b) a customer's direct balance UPDATE does nothing" 10 \
  "$(AS "$C1" "update loyalty_accounts set balance = 9999 where customer_id='$C1' and shop_id='$S'" >/dev/null;
     Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "    the OWNER cannot do it either (no UPDATE policy at all)" 10 \
  "$(AS "$OA" "update loyalty_accounts set balance = 9999 where customer_id='$C1' and shop_id='$S'" >/dev/null;
     Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "    a customer cannot forge a ledger row"        "violates row-level security" \
  "$(WHYAS "$C1" "insert into loyalty_transactions (shop_id,customer_id,points,kind) values ('$S','$C1',500,'ADJUST')")"
check "    a customer cannot insert an account"         "violates row-level security" \
  "$(WHYAS "$C1" "insert into loyalty_accounts (shop_id,customer_id,balance) values ('$SB','$C1',777)")"
check "    the forged row never landed"                 0 \
  "$(Q "select count(*) from loyalty_transactions where points = 500")"
check "    nobody can delete a ledger row"              0 \
  "$(AS "$OA" "with d as (delete from loyalty_transactions where shop_id='$S' returning 1) select count(*) from d")"

# (গ) loyalty_award with someone else's shop_id fails
check "(c) loyalty_award with another shop's id is refused" "not your shop" \
  "$(WHYAS "$OB" "select loyalty_award('$S','$C1',100,'EARN_SERIAL','$SR',null,800,100,null)")"
check "    loyalty_adjust with another shop's id is refused" "not your shop" \
  "$(WHYAS "$OB" "select loyalty_adjust('$S','$C1',100,'sneaky')")"
check "    a customer cannot award themselves points"       "not your shop" \
  "$(WHYAS "$C1" "select loyalty_award('$S','$C1',100,'EARN_SERIAL',null,null,800,100,null)")"
check "    the balance survived all of that"                10 \
  "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"

# the customer's own card list
check "my_loyalty_accounts returns C1's own cards only"  1 "$(AS "$C1" "select count(*) from my_loyalty_accounts()")"
check "    and it carries the shop's name"               "Parlour A" "$(AS "$C1" "select shop_name from my_loyalty_accounts()")"
check "    C2 holds a card at each of two shops"         2 "$(AS "$C2" "select count(*) from my_loyalty_accounts()")"
check "    never a merged total — one row per shop"      "t" \
  "$(AS "$C2" "select count(distinct shop_id) = count(*) from my_loyalty_accounts()")"
check "    a shop's rate travels with the card"          "50" \
  "$(AS "$C2" "select taka_per_point::text from my_loyalty_accounts() where shop_id='$SB'")"
check "a customer cannot read another customer's card"   0 \
  "$(AS "$C2" "select count(*) from loyalty_accounts where customer_id='$C1'")"
check "customers cannot see a disabled shop's settings"  0 \
  "$(Q "update loyalty_settings set is_enabled=false where shop_id='$SB'" >/dev/null;
     AS "$C2" "select count(*) from loyalty_settings where shop_id='$SB'")"
check "but that shop's owner still can"                  1 "$(AS "$OB" "select count(*) from loyalty_settings where shop_id='$SB'")"
Q "update loyalty_settings set is_enabled=true where shop_id='$SB'" >/dev/null

echo
echo "== regression: queue, appointments, membership =="
check "serials_before_update still there"  "t" "$(Q "select exists (select 1 from pg_trigger where tgname='serials_before_update')")"
check "serials_after_update still there"   "t" "$(Q "select exists (select 1 from pg_trigger where tgname='serials_after_update')")"
check "serials_sync_queue_public still there" "t" "$(Q "select exists (select 1 from pg_trigger where tgname='serials_sync_queue_public')")"
check "appointments_before_update still there" "t" "$(Q "select exists (select 1 from pg_trigger where tgname='appointments_before_update')")"
check "appointments_after_update still there"  "t" "$(Q "select exists (select 1 from pg_trigger where tgname='appointments_after_update')")"
check "appointment overlap constraint kept" "t" "$(Q "select exists (select 1 from pg_constraint where conname='appointments_no_overlap')")"
check "5 appointment policies kept"         5 "$(Q "select count(*) from pg_policies where tablename='appointments'")"
check "5 membership policies kept"          5 "$(Q "select count(*) from pg_policies where tablename='customer_memberships'")"
check "membership_is_active kept"           "t" "$(Q "select to_regprocedure('public.membership_is_active(uuid,uuid)') is not null")"
check "expire_memberships kept"             "t" "$(Q "select to_regprocedure('public.expire_memberships()') is not null")"
check "appointment due reminder kept"       "t" "$(Q "select to_regprocedure('public.send_appointment_due_reminder(uuid)') is not null")"
check "reschedule RPC kept"                 "t" "$(Q "select to_regprocedure('public.reschedule_appointment(uuid,timestamptz,uuid,text)') is not null")"
check "no loyalty column landed on serials" 0 \
  "$(Q "select count(*) from information_schema.columns where table_name='serials' and (column_name like '%loyalt%' or column_name like '%point%')")"
check "no loyalty column landed on appointments" 0 \
  "$(Q "select count(*) from information_schema.columns where table_name='appointments' and (column_name like '%loyalt%' or column_name like '%point%')")"
check "appointment income query unchanged"  "2400.00" \
  "$(Q "select coalesce(sum(total_amount),0)::text from appointments where shop_id='$S' and status='DONE' and payment_status in ('PAID','DUE')")"
check "queue income query unchanged"        "2150.00" \
  "$(Q "select coalesce(sum(total_amount),0)::text from serials where shop_id='$S' and status='DONE'")"
check "membership money still separate"     0 "$(Q "select count(*) from customer_memberships")"

echo
echo "== a loyalty failure never blocks a job (decision 55) =="
# Sabotage the ledger write the way only a bug could, and confirm a shop owner
# can still close a job. NOT VALID so the existing rows are exempt and only the
# NEW insert is refused — plain ADD CONSTRAINT would fail its own table scan.
Q "alter table public.loyalty_transactions add constraint zz_sabotage check (false) not valid" >/dev/null
A4=$(NEWAPPT "$S" "$ST" "$C1" "$(AT 6 12:00)")
AS "$OA" "update appointments set status='IN_PROGRESS' where id='$A4'" >/dev/null
OUT=$(AS "$OA" "update appointments set status='DONE', payment_status='PAID' where id='$A4'")
check "the DONE transition still succeeded despite a broken loyalty write" "DONE" \
  "$(Q "select status from appointments where id='$A4'")"
check "and no partial points were written"  "t" \
  "$(Q "select not exists (select 1 from loyalty_transactions where source_appointment_id='$A4')")"
check "and the balance did not drift either" 10 \
  "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
Q "alter table public.loyalty_transactions drop constraint zz_sabotage" >/dev/null
check "the invariant still holds after the sabotage" "t" \
  "$(Q "select not exists (select 1 from loyalty_accounts a where a.balance <> coalesce((select sum(t.points) from loyalty_transactions t where t.shop_id=a.shop_id and t.customer_id=a.customer_id),0))")"

echo
echo "-------------------------------------------"
printf 'passed: %d   failed: %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
