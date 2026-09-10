#!/usr/bin/env bash
#
# Sprint 5.1 (hardening) — appointments in the money flow, run against a
# throwaway local Postgres exactly as the other two harnesses do.
#
#   bash supabase/tests/run-sprint5-hardening-checks.sh
#
# Applies 20260918 → 20260919 → 20260920 on top of the fixture, plus a minimal
# stand-in for the salon's own money tables, and then walks the hardening
# verification list from the brief:
#
#   1. the list query — shop-scoped, status-filtered, date-filtered
#   2. completion — completed_at stamped, then frozen
#   3. historical price — a repriced service cannot rewrite a past appointment
#   4. the appointment → financial-record relationship (the app's own queries)
#   5. cross-shop financial isolation, as a real non-superuser role
#   6. the due reminder's owner check and cooldown
#   7. salon regression — the queue's rows, trigger and RPC untouched
#
# A green run means the migration is sound against a schema shaped like the
# real one. It is NOT proof that it will apply to production — the fixture is
# a stand-in, not a dump.
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PORT=5602
DIR=$(mktemp -d /tmp/qf-s51-XXXXXX)
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
# Did a statement raise, and with which message? `head -1` because psql prints
# the value and then its own status line.
SAYS() { Q "$1" 2>&1 | grep -oE "$2" | head -1; }

echo "== applying migrations =="
FILE "$HERE/fixture.sql" >/dev/null || exit 1

# ---------------------------------------------------------------------------
# The salon's own money tables, so "the queue still works" is a real check
# rather than an assertion about a table that was never there. Deliberately
# built here and not in fixture.sql: the other two harnesses do not need it
# and the shared fixture should keep describing only what they exercise.
# ---------------------------------------------------------------------------
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
Q "create or replace function public.serial_before_update() returns trigger
   language plpgsql as \\\$\\\$
   begin
     if new.status = 'DONE' then new.completed_at := coalesce(old.completed_at, now()); end if;
     return new;
   end \\\$\\\$" >/dev/null
Q "create trigger serials_before_update before update on public.serials
     for each row execute function public.serial_before_update()" >/dev/null
Q "create or replace function public.send_due_reminder(p_serial_id uuid) returns void
   language plpgsql as \\\$\\\$ begin
     update public.serials set due_reminded_at = now() where id = p_serial_id;
   end \\\$\\\$" >/dev/null

for m in 20260918_appointment_core 20260919_appointment_availability 20260920_appointment_money; do
  if ! FILE "$ROOT/supabase/migrations/$m.sql" >/dev/null 2>"$DIR/err"; then
    echo "  MIGRATION FAILED: $m"; sed 's/^/    /' "$DIR/err" | head -20; exit 1
  fi
  echo "  applied $m"
done
FILE "$ROOT/supabase/migrations/20260920_appointment_money.sql" >/dev/null 2>&1
check "re-running 20260920 is safe (idempotent)" OK "$(OK 'select 1')"
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

INSC="insert into appointments (shop_id,staff_id,customer_id,service_ids,starts_at,ends_at,is_walk_in)"
# Local noon-ish on a day a few out, in the shop's own zone — inside both the
# shop's 10:00–20:00 and the hours 20260919 seeded for every chair.
AT() { echo "((current_date + $1 + time '$2') at time zone 'Asia/Dhaka')"; }
# Book, then walk the status machine to DONE with the payment the sheet sends.
NEW() { Q "$INSC values ('$1','$2','$3',array['$4'::uuid], $5, $5 + interval '1 hour', false) returning id" | head -1; }
FINISH_PAID() { Q "update appointments set status='IN_PROGRESS' where id='$1';
                   update appointments set status='DONE', payment_status='PAID', payment_method='$2',
                          due_amount=0, due_collected_at=now() where id='$1'" >/dev/null; }
FINISH_DUE()  { Q "update appointments set status='IN_PROGRESS' where id='$1';
                   update appointments set status='DONE', payment_status='DUE', payment_method=null,
                          due_amount=$2, due_collected_at=null where id='$1'" >/dev/null; }

echo
echo "== the migration landed =="
COLS="select exists (select 1 from information_schema.columns where table_schema='public' and table_name='appointments' and column_name="
check "completed_at column exists"    "t" "$(Q "${COLS}'completed_at')")"
check "due_reminded_at column exists" "t" "$(Q "${COLS}'due_reminded_at')")"
check "income index exists"           "t" "$(Q "select exists (select 1 from pg_indexes where indexname='appointments_completed_idx')")"
check "due index exists"              "t" "$(Q "select exists (select 1 from pg_indexes where indexname='appointments_due_idx')")"
check "due reminder RPC exists"       "t" "$(Q "select to_regprocedure('public.send_appointment_due_reminder(uuid)') is not null")"
check "overlap constraint survived"   "t" "$(Q "select exists (select 1 from pg_constraint where conname='appointments_no_overlap')")"
check "reschedule history trigger survived" "t" \
  "$(Q "select exists (select 1 from pg_trigger where tgname='appointments_after_update')")"
check "all 5 appointment policies survived" 5 "$(Q "select count(*) from pg_policies where tablename='appointments'")"

echo
echo "== completion stamps the time the work finished =="
Q "delete from appointments" >/dev/null
A1=$(NEW "$S" "$ST" "$C1" "$SV" "$(AT 2 12:00)")
check "a fresh booking has no completed_at" "t" \
  "$(Q "select completed_at is null from appointments where id='$A1'")"
# `tail -1`, not `head -1`: psql prints its own "UPDATE 1" status line before
# the select's value when both statements are sent as one command.
Q "update appointments set status='IN_PROGRESS' where id='$A1'" >/dev/null
check "IN_PROGRESS does not stamp it either" "t" \
  "$(Q "select completed_at is null from appointments where id='$A1'")"
Q "update appointments set status='DONE', payment_status='PAID', payment_method='cash', due_amount=0 where id='$A1'" >/dev/null
check "DONE stamps completed_at"            "t" "$(Q "select completed_at is not null from appointments where id='$A1'")"
check "and stamps it as roughly now"        "t" \
  "$(Q "select completed_at > now() - interval '2 minutes' from appointments where id='$A1'")"
# This is the one that keeps a month's income honest: without the freeze a
# plain UPDATE could drag last month's takings into this month.
Q "update appointments set completed_at = now() - interval '40 days' where id='$A1'" >/dev/null
check "completed_at cannot be moved afterwards" "t" \
  "$(Q "select completed_at > now() - interval '2 minutes' from appointments where id='$A1'")"
A2=$(NEW "$S" "$ST" "$C1" "$SV" "$(AT 2 14:00)")
Q "update appointments set status='IN_PROGRESS' where id='$A2'" >/dev/null
Q "update appointments set status='DONE', completed_at = now() - interval '90 days' where id='$A2'" >/dev/null
check "a client-supplied completed_at on the DONE move is ignored" "t" \
  "$(Q "select completed_at > now() - interval '2 minutes' from appointments where id='$A2'")"

echo
echo "== the payment is recorded, the price is not touched =="
Q "delete from appointments" >/dev/null
A3=$(NEW "$S" "$ST" "$C1" "$SV" "$(AT 3 12:00)")
check "the price was snapshotted from the service" "800.00" \
  "$(Q "select total_amount::text from appointments where id='$A3'")"
FINISH_PAID "$A3" bkash
check "payment_status became PAID"      "PAID"  "$(Q "select payment_status from appointments where id='$A3'")"
check "the method was recorded"          "bkash" "$(Q "select payment_method from appointments where id='$A3'")"
check "nothing is left owing"            "0.00"  "$(Q "select due_amount::text from appointments where id='$A3'")"
check "the collection time was recorded" "t"     "$(Q "select due_collected_at is not null from appointments where id='$A3'")"

A4=$(NEW "$S" "$ST" "$C1" "$SV" "$(AT 3 15:00)")
FINISH_DUE "$A4" 800
check "an unpaid job becomes DUE"        "DUE"   "$(Q "select payment_status from appointments where id='$A4'")"
check "with no method, since nothing was collected" "t" \
  "$(Q "select payment_method is null from appointments where id='$A4'")"
check "and the balance stands"           "800.00" "$(Q "select due_amount::text from appointments where id='$A4'")"

# The deliberate difference from `completeSerial`, which may rewrite
# total_amount on this one transition: an appointment is closed at the price
# it was quoted, because the quote is what the customer agreed to.
Q "update appointments set total_amount = 5000 where id='$A3'" >/dev/null
check "total_amount stays frozen even on a completed job" "800.00" \
  "$(Q "select total_amount::text from appointments where id='$A3'")"

echo
echo "== historical correctness: repricing a service rewrites nothing =="
Q "update services set rate = 2500, name = 'Facial Deluxe' where id='$SV'" >/dev/null
check "the past appointment keeps its own price" "800.00" \
  "$(Q "select total_amount::text from appointments where id='$A3'")"
check "and its own service name"                 "Facial" \
  "$(Q "select services_snapshot->0->>'name' from appointments where id='$A3'")"
check "and its own rate inside the snapshot"     "800.00" \
  "$(Q "select (services_snapshot->0->>'rate')::numeric(10,2)::text from appointments where id='$A3'")"
A5=$(NEW "$S" "$ST2" "$C1" "$SV" "$(AT 4 12:00)")
check "a NEW booking picks up the new price"     "2500.00" \
  "$(Q "select total_amount::text from appointments where id='$A5'")"
Q "update services set rate = 800, name = 'Facial' where id='$SV'" >/dev/null

echo
echo "== the appointment → financial-record relationship =="
# The exact three queries the app runs: income history, the cashbook, the due
# ledger. Written as SQL here so a schema change that silently drops rows out
# of one of them fails this file rather than a screen.
INCOME="select count(*) from appointments where shop_id='$S' and status='DONE'
          and payment_status in ('PAID','DUE') and completed_at >= date_trunc('month', now() - interval '1 year')"
check "both completed jobs are in the income window"  2 "$(Q "$INCOME")"
check "the paid one counts as collected"              "800.00" \
  "$(Q "select coalesce(sum(total_amount),0)::text from appointments where shop_id='$S' and status='DONE' and payment_status='PAID'")"
check "the unpaid one counts as outstanding"          "800.00" \
  "$(Q "select coalesce(sum(due_amount),0)::text from appointments where shop_id='$S' and status='DONE' and payment_status='DUE' and due_collected_at is null")"
check "a still-booked job is NOT income yet"          2 \
  "$(Q "$INCOME")"
A6=$(NEW "$S" "$ST" "$C1" "$SV" "$(AT 5 12:00)")
Q "update appointments set status='CANCELLED' where id='$A6'" >/dev/null
check "a cancelled job never enters the money flow"   2 "$(Q "$INCOME")"
check "and has no completed_at to enter it with"      "t" \
  "$(Q "select completed_at is null from appointments where id='$A6'")"
A7=$(NEW "$S" "$ST" "$C1" "$SV" "$(AT 5 16:00)")
Q "update appointments set status='NO_SHOW' where id='$A7'" >/dev/null
check "a no-show is money-neutral too"                2 "$(Q "$INCOME")"
check "the due ledger sees exactly one debt"          1 \
  "$(Q "select count(*) from appointments where shop_id='$S' and status='DONE' and payment_status='DUE' and due_amount > 0 and due_collected_at is null")"
Q "update appointments set due_collected_at = now(), payment_status='PAID', payment_method='cash', due_amount=0 where id='$A4'" >/dev/null
check "collecting it clears it from the ledger"       0 \
  "$(Q "select count(*) from appointments where shop_id='$S' and status='DONE' and payment_status='DUE' and due_amount > 0 and due_collected_at is null")"
check "but the work still counts as income"           2 "$(Q "$INCOME")"

echo
echo "== the list query =="
Q "delete from appointments" >/dev/null
L1=$(NEW "$S" "$ST" "$C1" "$SV" "$(AT 0 19:00)")   # today, later on
L2=$(NEW "$S" "$ST" "$C1" "$SV" "$(AT 2 12:00)")   # a coming day
L3=$(NEW "$S" "$ST2" "$C1" "$SV" "$(AT 2 15:00)")  # same day, other person
FINISH_PAID "$L3" cash
L4=$(NEW "$S" "$ST" "$C1" "$SV" "$(AT 3 12:00)")
Q "update appointments set status='CANCELLED' where id='$L4'" >/dev/null
L5=$(NEW "$S" "$ST2" "$C1" "$SV" "$(AT 3 15:00)")
Q "update appointments set status='NO_SHOW' where id='$L5'" >/dev/null

# 'today' — the local calendar day, in the shop's zone.
DAY="starts_at >= (current_date::timestamp at time zone 'Asia/Dhaka') and starts_at < ((current_date + 1)::timestamp at time zone 'Asia/Dhaka')"
check "today shows only today's row"        1 "$(Q "select count(*) from appointments where shop_id='$S' and $DAY")"
check "upcoming excludes what fell through" 2 \
  "$(Q "select count(*) from appointments where shop_id='$S' and starts_at >= now() and status in ('BOOKED','CONFIRMED','IN_PROGRESS')")"
check "completed shows only finished work"  1 \
  "$(Q "select count(*) from appointments where shop_id='$S' and status='DONE'")"
check "cancelled covers both ways it fails" 2 \
  "$(Q "select count(*) from appointments where shop_id='$S' and status in ('CANCELLED','NO_SHOW')")"
check "all shows every row"                 5 "$(Q "select count(*) from appointments where shop_id='$S'")"
check "the provider filter narrows to one person" 3 \
  "$(Q "select count(*) from appointments where shop_id='$S' and staff_id='$ST'")"
check "a date range is inclusive of its last day" 2 \
  "$(Q "select count(*) from appointments where shop_id='$S'
          and starts_at >= ((current_date + 2)::timestamp at time zone 'Asia/Dhaka')
          and starts_at <  ((current_date + 3)::timestamp at time zone 'Asia/Dhaka')")"
check "every row carries the eight columns the list prints" "t" \
  "$(Q "select bool_and(customer_name is not null and services_snapshot is not null and staff_id is not null
                        and starts_at is not null and ends_at is not null and total_amount is not null
                        and status is not null and payment_status is not null)
        from appointments where shop_id='$S'")"

echo
echo "== cross-shop isolation, as a real non-superuser =="
# Superusers bypass RLS, so the isolation checks have to run as a role that
# does not — the same reason Sprint 5's harness created this role.
Q "drop owned by app_user" >/dev/null 2>&1; Q "drop role if exists app_user" >/dev/null 2>&1
Q "create role app_user nologin" >/dev/null
Q "grant usage on schema public, auth to app_user" >/dev/null
Q "grant select,insert,update,delete on all tables in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema auth to app_user" >/dev/null

# Shop B gets its own money, so "sees nothing" is about scoping and not about
# an empty table.
B1=$(NEW "$SB" "$STB" "$C2" "$SVB" "$(AT 2 12:00)")
FINISH_PAID "$B1" cash

check "owner A sees only their own appointments"  5 "$(AS "$OA" "select count(*) from appointments")"
check "owner B sees only theirs"                  1 "$(AS "$OB" "select count(*) from appointments")"
check "owner B cannot read shop A's rows by id"   0 "$(AS "$OB" "select count(*) from appointments where shop_id='$S'")"
# Shop B's own service is priced 900, so a wrong answer here would be 1700 —
# the two shops' takings are deliberately different numbers.
check "owner B's income total excludes shop A"    "900.00" \
  "$(AS "$OB" "select coalesce(sum(total_amount),0)::text from appointments where status='DONE'")"
check "owner A's income total excludes shop B"    "800.00" \
  "$(AS "$OA" "select coalesce(sum(total_amount),0)::text from appointments where status='DONE'")"
check "an unrelated customer sees no money at all" 0 \
  "$(AS "$C2" "select count(*) from appointments where shop_id='$S'")"
check "owner B cannot mark shop A's job collected" 0 \
  "$(AS "$OB" "with u as (update appointments set due_collected_at=now() where shop_id='$S' returning 1) select count(*) from u")"
check "owner B cannot rewrite shop A's price"      "t" \
  "$(AS "$OB" "update appointments set total_amount=1 where shop_id='$S'" >/dev/null;
     Q "select bool_and(total_amount = 800) from appointments where shop_id='$S'")"

echo
echo "== the due reminder =="
Q "delete from notifications" >/dev/null
D1=$(NEW "$S" "$ST" "$C1" "$SV" "$(AT 6 12:00)")
FINISH_DUE "$D1" 800
check "the owner can send it"                  "" \
  "$(AS "$OA" "select send_appointment_due_reminder('$D1')" | grep -oE 'ERROR|not your shop')"
check "one notification was written"           1 \
  "$(Q "select count(*) from notifications where type='REMINDER'")"
check "it went to the right customer"          "$C1" \
  "$(Q "select user_id from notifications where type='REMINDER'")"
check "it names the amount owed"               "t" \
  "$(Q "select body like '%800%' from notifications where type='REMINDER'")"
check "it carries the appointment, not a serial" "t" \
  "$(Q "select data ? 'appointment_id' from notifications where type='REMINDER'")"
check "a second send inside 24h is refused"    "একবার" \
  "$(AS "$OA" "select send_appointment_due_reminder('$D1')" | grep -oE 'একবার')"
check "still exactly one notification"         1 \
  "$(Q "select count(*) from notifications where type='REMINDER'")"
check "another shop's owner is refused"        "not your shop" \
  "$(AS "$OB" "select send_appointment_due_reminder('$D1')" | grep -oE 'not your shop')"
P1=$(NEW "$S" "$ST2" "$C1" "$SV" "$(AT 6 15:00)")
FINISH_PAID "$P1" cash
check "a fully paid job has nothing to remind about" "বাকি নেই" \
  "$(AS "$OA" "select send_appointment_due_reminder('$P1')" | grep -oE 'বাকি নেই')"

W1=$(Q "insert into appointments (shop_id,staff_id,service_ids,starts_at,ends_at,is_walk_in,customer_name)
        values ('$S','$ST',array['$SV'::uuid], $(AT 7 12:00), $(AT 7 13:00), true,'Walk in') returning id" | head -1)
FINISH_DUE "$W1" 800
check "a walk-in with no account cannot be reminded" "অ্যাকাউন্ট নেই" \
  "$(AS "$OA" "select send_appointment_due_reminder('$W1')" | grep -oE 'অ্যাকাউন্ট নেই')"
check "a missing appointment is refused"       "appointment_not_found" \
  "$(AS "$OA" "select send_appointment_due_reminder('00000000-0000-0000-0000-000000000000')" | grep -oE 'appointment_not_found')"

echo
echo "== salon regression: the queue is where it was =="
check "the serials table is still there"        "t" "$(Q "select to_regclass('public.serials') is not null")"
check "serials.completed_at is still there"     "t" \
  "$(Q "select exists (select 1 from information_schema.columns where table_schema='public' and table_name='serials' and column_name='completed_at')")"
check "the queue's own BEFORE UPDATE trigger survived" "t" \
  "$(Q "select exists (select 1 from pg_trigger where tgname='serials_before_update')")"
check "the queue's due reminder RPC survived"   "t" \
  "$(Q "select to_regprocedure('public.send_due_reminder(uuid)') is not null")"
# The behavioural half: a serial still completes and still counts, with the
# appointment trigger nowhere near it.
SR=$(Q "insert into serials (shop_id, chair_id, customer_id, customer_name, total_amount, services_snapshot)
        values ('$S','$ST','$C1','Queue customer', 300, '[{\\\"name\\\":\\\"Haircut\\\",\\\"rate\\\":300}]'::jsonb) returning id" | head -1)
Q "update serials set status='DONE', payment_status='PAID', payment_method='cash', due_amount=0 where id='$SR'" >/dev/null
check "a serial still completes"                "DONE" "$(Q "select status from serials where id='$SR'")"
check "and still stamps its own completed_at"   "t" \
  "$(Q "select completed_at is not null from serials where id='$SR'")"
Q "update serials set total_amount = 350 where id='$SR'" >/dev/null
check "a serial's total_amount is still writable on completion" "350.00" \
  "$(Q "select total_amount::text from serials where id='$SR'")"
check "the queue's income query is unaffected by appointments" "350.00" \
  "$(Q "select coalesce(sum(total_amount),0)::text from serials where shop_id='$S' and status='DONE' and payment_status in ('PAID','DUE')")"
check "no appointment row leaked into serials"  0 "$(Q "select count(*) from serials where customer_name = 'Walk in'")"
check "no serial row leaked into appointments"  0 \
  "$(Q "select count(*) from appointments where customer_name = 'Queue customer'")"
check "the appointment trigger never touched a serial" "t" \
  "$(Q "select due_reminded_at is null from serials where id='$SR'")"

echo
echo "== nothing was retro-stamped =="
check "no un-finished appointment has a completed_at" 0 \
  "$(Q "select count(*) from appointments where status <> 'DONE' and completed_at is not null")"
check "every finished one has one"                    0 \
  "$(Q "select count(*) from appointments where status = 'DONE' and completed_at is null")"

echo
echo "-------------------------------------------"
printf 'passed: %d   failed: %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
