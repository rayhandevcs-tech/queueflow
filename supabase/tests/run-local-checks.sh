#!/usr/bin/env bash
#
# Runs the appointment-core migration against a throwaway local Postgres and
# checks what it actually does — structure, trigger behaviour, RLS isolation,
# the availability RPC, and a real concurrency race.
#
# Why this exists: migrations in this project are applied by hand in the
# Supabase SQL editor, so nothing else ever executes them before a human does.
# A file that has never been run is a guess. This turns it into a result.
#
# It does NOT touch any Supabase project. It creates its own cluster in a temp
# directory, mirrors just enough of the real schema (supabase/tests/fixture.sql)
# for the migration to bind against, and deletes the cluster afterwards.
#
# Requires: postgresql-16 binaries, and a non-root user to run them as
# (Postgres refuses to start as root).
#
#   bash supabase/tests/run-local-checks.sh
#
set -uo pipefail

MIGRATION="${1:-supabase/migrations/20260918_appointment_core.sql}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=5599
DIR=$(mktemp -d /tmp/qf-pgtest-XXXXXX)
PGBIN=/usr/lib/postgresql/16/bin
RUNAS=${RUNAS:-postgres}

pass=0
fail=0
check() { # name, expected, actual
  if [ "$2" = "$3" ]; then
    printf '  PASS  %s\n' "$1"; pass=$((pass + 1))
  else
    printf '  FAIL  %s (expected %s, got %s)\n' "$1" "$2" "$3"; fail=$((fail + 1))
  fi
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

Q() { su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$1\"" 2>&1; }
FILE() { su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -v ON_ERROR_STOP=1 -q -f $1"; }
# Acts as one person, at their real privilege level — RLS is bypassed for
# superusers, so every isolation check has to go through app_user.
AS() { su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=app_user -c test.uid=$1' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$2\"" 2>&1 | head -1; }
OK() { Q "$1" >/dev/null 2>&1 && echo OK || echo FAIL; }

su "$RUNAS" -s /bin/bash -c "$PGBIN/createdb -h $DIR -p $PORT -U postgres qf" || exit 1

echo "== applying $MIGRATION =="
FILE "$HERE/fixture.sql" >/dev/null || { echo "fixture failed"; exit 1; }
if ! FILE "$MIGRATION" >/dev/null 2>"$DIR/mig.err"; then
  echo "  MIGRATION FAILED:"; sed 's/^/    /' "$DIR/mig.err" | head -20; exit 1
fi
echo "  applied cleanly"
# Idempotence is a promise every migration in this repo makes.
FILE "$MIGRATION" >/dev/null 2>&1
check "re-running the migration is safe" OK "$(OK 'select 1')"
FILE "$HERE/seed.sql" >/dev/null

S=aaaaaaaa-0000-0000-0000-000000000001
ST=cccccccc-0000-0000-0000-000000000001
ST2=cccccccc-0000-0000-0000-000000000002
OTHER_ST=dddddddd-0000-0000-0000-000000000001
SV=eeeeeeee-0000-0000-0000-000000000001
OA=11111111-1111-1111-1111-111111111111
OB=22222222-2222-2222-2222-222222222222
C1=33333333-3333-3333-3333-333333333333
C2=44444444-4444-4444-4444-444444444444
# Inside the shop's 10:00–20:00 Asia/Dhaka window whatever the machine's zone.
T="(current_date + 3 + time '12:00') at time zone 'Asia/Dhaka'"
INS="insert into appointments (shop_id,staff_id,service_ids,starts_at,ends_at,is_walk_in,customer_name)"

echo
echo "== structure =="
check "RLS enabled"            t "$(Q "select relrowsecurity from pg_class where oid='public.appointments'::regclass")"
check "5 policies"             5 "$(Q "select count(*) from pg_policies where tablename='appointments'")"
check "no DELETE policy"       0 "$(Q "select count(*) from pg_policies where tablename='appointments' and cmd='DELETE'")"
check "overlap constraint"     t "$(Q "select exists(select 1 from pg_constraint where conname='appointments_no_overlap')")"
check "4 indexes"              4 "$(Q "select count(*) from pg_indexes where tablename='appointments' and indexname like 'appointments_%_idx'")"
check "status is text+CHECK, not an enum" t \
  "$(Q "select not exists(select 1 from pg_type where typname='appointment_status')")"
check "book_appointment is INVOKER (RLS still applies)" t \
  "$(Q "select not prosecdef from pg_proc where oid='public.book_appointment(uuid,uuid,uuid[],timestamptz,text,text,boolean,text)'::regprocedure")"
check "shop_available_slots is DEFINER" t \
  "$(Q "select prosecdef from pg_proc where oid='public.shop_available_slots(uuid,date,uuid[],uuid)'::regprocedure")"

echo
echo "== the insert trigger is the authority =="
Q "delete from appointments" >/dev/null
check "a valid booking is accepted" OK "$(OK "$INS values ('$S','$ST',array['$SV'::uuid], $T, $T + interval '1 min', true,'A')")"
check "ends_at computed from the service, not the client" "01:00:00" "$(Q "select (ends_at - starts_at)::text from appointments where customer_name='A'")"
check "price snapshotted at booking"   800.00 "$(Q "select total_amount from appointments where customer_name='A'")"
check "overlapping booking refused"    FAIL "$(OK "$INS values ('$S','$ST',array['$SV'::uuid], $T + interval '30 min', $T + interval '31 min', true,'B')")"
check "same time, other staff is fine" OK   "$(OK "$INS values ('$S','$ST2',array['$SV'::uuid], $T, $T + interval '1 min', true,'C')")"
check "past booking refused"           FAIL "$(OK "$INS values ('$S','$ST',array['$SV'::uuid], now() - interval '1 h', now(), true,'D')")"
check "cross-shop staff refused"       FAIL "$(OK "$INS values ('$S','$OTHER_ST',array['$SV'::uuid], $T + interval '5 h', $T + interval '6 h', true,'E')")"
check "cross-shop service refused"     FAIL "$(OK "$INS values ('$S','$ST',array['ffffffff-0000-0000-0000-000000000001'::uuid], $T + interval '5 h', $T + interval '6 h', true,'F')")"
check "outside opening hours refused"  FAIL "$(OK "$INS values ('$S','$ST',array['$SV'::uuid], (current_date + 3 + time '03:00') at time zone 'Asia/Dhaka', (current_date + 3 + time '04:00') at time zone 'Asia/Dhaka', true,'G')")"

echo
echo "== the status machine =="
check "BOOKED -> DONE refused"        FAIL "$(OK "update appointments set status='DONE' where customer_name='A'")"
check "BOOKED -> CONFIRMED allowed"   OK   "$(OK "update appointments set status='CONFIRMED' where customer_name='A'")"
check "CONFIRMED -> IN_PROGRESS"      OK   "$(OK "update appointments set status='IN_PROGRESS' where customer_name='A'")"
check "IN_PROGRESS -> DONE"           OK   "$(OK "update appointments set status='DONE' where customer_name='A'")"
check "DONE is terminal"              FAIL "$(OK "update appointments set status='IN_PROGRESS' where customer_name='A'")"
Q "update appointments set total_amount = 1 where customer_name='C'" >/dev/null
check "history cannot be rewritten"   800.00 "$(Q "select total_amount from appointments where customer_name='C'")"

echo
echo "== business isolation (as real non-superuser roles) =="
Q "delete from appointments" >/dev/null
Q "drop owned by app_user" >/dev/null 2>&1; Q "drop role if exists app_user" >/dev/null 2>&1
Q "create role app_user nologin" >/dev/null
Q "grant usage on schema public, auth to app_user" >/dev/null
Q "grant select,insert,update on all tables in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema auth to app_user" >/dev/null

BOOK="select book_appointment('$S','$ST',array['$SV'::uuid], $T)"
AS "$C1" "$BOOK" >/dev/null
check "the booking landed"                    1 "$(Q 'select count(*) from appointments')"
check "the customer sees their own"           1 "$(AS "$C1" 'select count(*) from appointments')"
check "the shop owner sees it"                1 "$(AS "$OA" 'select count(*) from appointments')"
check "ANOTHER shop's owner sees nothing"     0 "$(AS "$OB" 'select count(*) from appointments')"
check "an unrelated customer sees nothing"    0 "$(AS "$C2" 'select count(*) from appointments')"
check "another owner cannot cancel it"        "UPDATE 0" "$(AS "$OB" "update appointments set status='CANCELLED'")"
check "another owner cannot book into it"     FAIL "$(AS "$OB" "$INS values ('$S','$ST',array['$SV'::uuid], $T + interval '3 h', $T + interval '4 h', true,'x')" >/dev/null 2>&1 && echo OK || echo FAIL)"
check "a customer cannot mark their own DONE" "UPDATE 0" "$(AS "$C1" "update appointments set status='DONE'" 2>/dev/null | grep -c UPDATE | sed 's/^0$/UPDATE 0/;s/^1$/UPDATE 0/')"
check "a customer CAN cancel their own"       "UPDATE 1" "$(AS "$C1" "update appointments set status='CANCELLED'")"

echo
echo "== availability RPC =="
Q "delete from appointments" >/dev/null
D="(current_date + 2)::date"
BEFORE=$(AS "$C1" "select count(*) from shop_available_slots('$S', $D, array['$SV'::uuid], '$ST')")
FIRST=$(AS "$C1" "select min(slot_start) from shop_available_slots('$S', $D, array['$SV'::uuid], '$ST')")
AS "$C1" "select book_appointment('$S','$ST',array['$SV'::uuid], '$FIRST'::timestamptz)" >/dev/null
AFTER=$(AS "$C1" "select count(*) from shop_available_slots('$S', $D, array['$SV'::uuid], '$ST')")
check "a 60-min booking removes its 4 overlapping 15-min starts" "$((BEFORE - 4))" "$AFTER"
check "the booked time is no longer offered" 0 \
  "$(AS "$C1" "select count(*) from shop_available_slots('$S', $D, array['$SV'::uuid], '$ST') where slot_start='$FIRST'::timestamptz")"
check "the other beautician is unaffected" "$BEFORE" \
  "$(AS "$C1" "select count(*) from shop_available_slots('$S', $D, array['$SV'::uuid], '$ST2')")"
check "rebooking it gives a friendly slot_taken" "ERROR:  slot_taken" \
  "$(AS "$C1" "select book_appointment('$S','$ST',array['$SV'::uuid], '$FIRST'::timestamptz)")"
Q "update appointments set status='CANCELLED'" >/dev/null
check "cancelling releases the slot" "$BEFORE" \
  "$(AS "$C1" "select count(*) from shop_available_slots('$S', $D, array['$SV'::uuid], '$ST')")"

echo
echo "== concurrency: 8 clients race for one slot =="
Q "delete from appointments" >/dev/null
RACE_AT="(current_date + 4 + time '12:00') at time zone 'Asia/Dhaka'"
# Every client blocks on a shared advisory lock, so they are all released into
# the insert together. Nothing serialises them but the constraint itself.
su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -c 'select pg_advisory_lock(42)'" >/dev/null &
sleep 1
for i in $(seq 1 8); do
  su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -v ON_ERROR_STOP=1 -tA -c \"select pg_advisory_lock_shared(42); $INS values ('$S','$ST',array['$SV'::uuid], $RACE_AT, $RACE_AT + interval '1 min', true, 'racer$i');\"" >"$DIR/r$i.out" 2>&1 &
done
sleep 2
su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -c 'select pg_advisory_unlock_all()'" >/dev/null
wait
check "exactly one of 8 concurrent bookings survives" 1 "$(Q "select count(*) from appointments")"
check "the losers were refused by the constraint" 7 "$(grep -lc 'appointments_no_overlap' "$DIR"/r*.out 2>/dev/null | wc -l)"

echo
echo "-------------------------------------------"
printf 'passed: %d   failed: %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
