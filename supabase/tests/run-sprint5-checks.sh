#!/usr/bin/env bash
#
# Sprint 5 — per-staff hours, time off, rescheduling and reminders, run
# against a throwaway local Postgres exactly as run-local-checks.sh does.
#
#   bash supabase/tests/run-sprint5-checks.sh
#
# Applies 20260918 then 20260919 on top of the fixture, then walks the test
# matrix: availability, reschedule, security, reminders.
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PORT=5601
DIR=$(mktemp -d /tmp/qf-s5-XXXXXX)
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
# The reason string a trigger raised, so a refusal can be checked for *why*.
WHY()  { Q "$1" 2>&1 | grep -oE '(staff_on_leave|staff_not_working_that_day|shop_closed_that_day|outside_working_hours|appointment_in_past|slot_taken|appointment_not_reschedulable|appointment_not_found|staff does not belong[^"]*)' | head -1; }

echo "== applying migrations =="
FILE "$HERE/fixture.sql" >/dev/null || exit 1
for m in 20260918_appointment_core 20260919_appointment_availability; do
  if ! FILE "$ROOT/supabase/migrations/$m.sql" >/dev/null 2>"$DIR/err"; then
    echo "  MIGRATION FAILED: $m"; sed 's/^/    /' "$DIR/err" | head -20; exit 1
  fi
  echo "  applied $m"
done
FILE "$ROOT/supabase/migrations/20260919_appointment_availability.sql" >/dev/null 2>&1
check "re-running 20260919 is safe" OK "$(OK 'select 1')"
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
INS="insert into appointments (shop_id,staff_id,service_ids,starts_at,ends_at,is_walk_in,customer_name)"
# Local noon on a day a few days out, in the shop's own zone.
AT() { echo "((current_date + $1 + time '$2') at time zone 'Asia/Dhaka')"; }

echo
echo "== seeding: existing staff kept working, nothing went dark =="
check "every chair got its weekly hours" 0 \
  "$(Q "select count(*) from chairs c where not exists (select 1 from staff_working_hours w where w.chair_id=c.id)")"
check "7 days seeded per chair (shop opens daily)" 7 \
  "$(Q "select count(*) from staff_working_hours where chair_id='$ST'")"
check "seeded from the shop's own hours" "10:00:00" \
  "$(Q "select start_time::text from staff_working_hours where chair_id='$ST' limit 1")"
Q "insert into chairs (id, shop_id, label, staff_name) values ('cccccccc-0000-0000-0000-00000000000f','$S','Seat 3','New')" >/dev/null
check "a newly added chair is seeded too" 7 \
  "$(Q "select count(*) from staff_working_hours where chair_id='cccccccc-0000-0000-0000-00000000000f'")"
Q "delete from chairs where id='cccccccc-0000-0000-0000-00000000000f'" >/dev/null

echo
echo "== availability =="
Q "delete from appointments; delete from staff_time_off;" >/dev/null
check "a staff working day accepts a booking" OK \
  "$(OK "$INS values ('$S','$ST',array['$SV'::uuid], $(AT 3 12:00), $(AT 3 12:00) + interval '1 min', true,'ok1')")"

# Narrow Shila to mornings only, then try an afternoon.
Q "update staff_working_hours set end_time='13:00' where chair_id='$ST'" >/dev/null
check "outside the STAFF's own hours is refused" "outside_working_hours" \
  "$(WHY "$INS values ('$S','$ST',array['$SV'::uuid], $(AT 4 15:00), $(AT 4 15:00) + interval '1 min', true,'x')")"
check "inside them is still fine" OK \
  "$(OK "$INS values ('$S','$ST',array['$SV'::uuid], $(AT 4 11:00), $(AT 4 11:00) + interval '1 min', true,'ok2')")"
check "the other beautician still works afternoons" OK \
  "$(OK "$INS values ('$S','$ST2',array['$SV'::uuid], $(AT 4 15:00), $(AT 4 15:00) + interval '1 min', true,'ok3')")"
Q "update staff_working_hours set end_time='20:00' where chair_id='$ST'" >/dev/null

# A day the staff member does not work at all.
DOW=$(Q "select extract(isodow from (current_date + 5))::int")
Q "delete from staff_working_hours where chair_id='$ST' and weekday=$DOW" >/dev/null
check "a staff OFF day is refused" "staff_not_working_that_day" \
  "$(WHY "$INS values ('$S','$ST',array['$SV'::uuid], $(AT 5 12:00), $(AT 5 12:00) + interval '1 min', true,'x')")"
check "the slot RPC offers that person nothing that day" 0 \
  "$(Q "select count(*) from shop_available_slots('$S', (current_date+5)::date, array['$SV'::uuid], '$ST')")"
check "but their colleague is unaffected" "t" \
  "$(Q "select count(*) > 0 from shop_available_slots('$S', (current_date+5)::date, array['$SV'::uuid], '$ST2')")"
Q "insert into staff_working_hours (chair_id,weekday,start_time,end_time) values ('$ST',$DOW,'10:00','20:00')" >/dev/null

# A day the whole shop is shut.
DOW6=$(Q "select extract(isodow from (current_date + 6))::int")
KEY6=$(Q "select (array['mon','tue','wed','thu','fri','sat','sun'])[$DOW6]")
Q "update shops set weekly_hours = jsonb_set(weekly_hours, '{$KEY6,closed}', 'true') where id='$S'" >/dev/null
check "a SHOP closed day is refused" "shop_closed_that_day" \
  "$(WHY "$INS values ('$S','$ST',array['$SV'::uuid], $(AT 6 12:00), $(AT 6 12:00) + interval '1 min', true,'x')")"
check "the slot RPC returns nothing that day" 0 \
  "$(Q "select count(*) from shop_available_slots('$S', (current_date+6)::date, array['$SV'::uuid])")"
Q "update shops set weekly_hours = jsonb_set(weekly_hours, '{$KEY6,closed}', 'false') where id='$S'" >/dev/null

# Full-day leave.
Q "insert into staff_time_off (chair_id, starts_at, ends_at, reason) values ('$ST', (current_date+7)::timestamptz, (current_date+8)::timestamptz, 'full day')" >/dev/null
check "full-day leave refuses a booking" "staff_on_leave" \
  "$(WHY "$INS values ('$S','$ST',array['$SV'::uuid], $(AT 7 12:00), $(AT 7 12:00) + interval '1 min', true,'x')")"
check "leave removes every slot that day" 0 \
  "$(Q "select count(*) from shop_available_slots('$S', (current_date+7)::date, array['$SV'::uuid], '$ST')")"
check "the colleague is still bookable that day" "t" \
  "$(Q "select count(*) > 0 from shop_available_slots('$S', (current_date+7)::date, array['$SV'::uuid], '$ST2')")"

# Partial-day leave: mornings off, afternoon still open.
Q "insert into staff_time_off (chair_id, starts_at, ends_at, reason) values ('$ST2', $(AT 7 10:00), $(AT 7 13:00), 'half day')" >/dev/null
check "partial leave refuses a booking inside it" "staff_on_leave" \
  "$(WHY "$INS values ('$S','$ST2',array['$SV'::uuid], $(AT 7 11:00), $(AT 7 11:00) + interval '1 min', true,'x')")"
check "and accepts one after it" OK \
  "$(OK "$INS values ('$S','$ST2',array['$SV'::uuid], $(AT 7 16:00), $(AT 7 16:00) + interval '1 min', true,'ok4')")"
check "overlapping leave rows are refused" FAIL \
  "$(OK "insert into staff_time_off (chair_id, starts_at, ends_at) values ('$ST2', $(AT 7 12:00), $(AT 7 14:00))")"
Q "delete from staff_time_off" >/dev/null

# Service duration and existing conflicts.
LONG=eeeeeeee-0000-0000-0000-000000000002
check "a 120-min service yields fewer starts than a 60-min one" "t" \
  "$(Q "select (select count(*) from shop_available_slots('$S',(current_date+3)::date,array['$LONG'::uuid],'$ST')) < (select count(*) from shop_available_slots('$S',(current_date+3)::date,array['$SV'::uuid],'$ST'))")"
check "an existing appointment blocks its own time" 0 \
  "$(Q "select count(*) from shop_available_slots('$S',(current_date+3)::date,array['$SV'::uuid],'$ST') where slot_start = $(AT 3 12:00)")"

echo
echo "== rescheduling =="
Q "delete from appointments; delete from staff_time_off; delete from appointment_reschedules;" >/dev/null
Q "drop owned by app_user" >/dev/null 2>&1; Q "drop role if exists app_user" >/dev/null 2>&1
Q "create role app_user nologin" >/dev/null
Q "grant usage on schema public, auth to app_user" >/dev/null
Q "grant select,insert,update,delete on all tables in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema auth to app_user" >/dev/null

A1=$(AS "$C1" "select book_appointment('$S','$ST',array['$SV'::uuid], $(AT 8 12:00))")
check "a plain UPDATE cannot move the time" "$(Q "select starts_at from appointments where id='$A1'" | tail -1)" \
  "$(Q "update appointments set starts_at = $(AT 8 15:00) where id='$A1'; select starts_at from appointments where id='$A1'" | tail -1)"
check "the owner can reschedule through the RPC" "$A1" \
  "$(AS "$OA" "select reschedule_appointment('$A1', $(AT 8 16:00))")"
check "the new time is stored" "t" \
  "$(Q "select starts_at = $(AT 8 16:00) from appointments where id='$A1'")"
check "history is kept, not lost" 1 "$(Q "select count(*) from appointment_reschedules where appointment_id='$A1'")"
check "history holds the ORIGINAL time" "t" \
  "$(Q "select from_starts_at = $(AT 8 12:00) from appointment_reschedules where appointment_id='$A1'")"
check "duration is preserved across the move" "01:00:00" \
  "$(Q "select (ends_at - starts_at)::text from appointments where id='$A1'")"

A2=$(AS "$C1" "select book_appointment('$S','$ST2',array['$SV'::uuid], $(AT 8 16:00))")
check "moving onto an OCCUPIED slot is refused" "slot_taken" \
  "$(AS "$OA" "select reschedule_appointment('$A2', $(AT 8 16:30), '$ST')" | grep -oE 'slot_taken')"
Q "insert into staff_time_off (chair_id, starts_at, ends_at) values ('$ST2', $(AT 9 10:00), $(AT 9 20:00))" >/dev/null
check "moving onto a staff member's LEAVE is refused" "staff_on_leave" \
  "$(AS "$OA" "select reschedule_appointment('$A2', $(AT 9 12:00))" | grep -oE 'staff_on_leave')"
check "moving into the past is refused" "appointment_in_past" \
  "$(AS "$OA" "select reschedule_appointment('$A2', now() - interval '1 hour')" | grep -oE 'appointment_in_past')"
OUT=$(AS "$OA" "select reschedule_appointment('$A2', $(AT 10 12:00), '$STB')")
case "$OUT" in *"does not belong"*) R=t ;; *) R="$OUT" ;; esac
check "moving to ANOTHER shop's staff is refused" "t" "$R"
Q "update appointments set status='CANCELLED' where id='$A2'" >/dev/null
check "a CANCELLED appointment cannot be rescheduled" "appointment_not_reschedulable" \
  "$(AS "$OA" "select reschedule_appointment('$A2', $(AT 10 12:00))" | grep -oE 'appointment_not_reschedulable')"
OUT=$(AS "$C1" "select reschedule_appointment('$A1', $(AT 10 12:00))")
case "$OUT" in *"violates row-level security"*) R=t ;; *) R="$OUT" ;; esac
check "a customer cannot reschedule (RLS: cancel is their only write)" "t" "$R"
Q "delete from staff_time_off" >/dev/null

echo
echo "== security =="
check "another shop's owner sees no appointments"        0 "$(AS "$OB" 'select count(*) from appointments')"
check "an unrelated customer sees no appointments"       0 "$(AS "$C2" 'select count(*) from appointments')"
check "another customer cannot see this one's history"   0 "$(AS "$C2" 'select count(*) from appointment_reschedules')"
check "the booking customer CAN see their own history"   1 "$(AS "$C1" "select count(*) from appointment_reschedules where appointment_id='$A1'")"
check "another shop's owner sees no staff hours"         0 "$(AS "$OB" "select count(*) from staff_working_hours where chair_id='$ST'")"
check "the owner sees their own staff hours"             7 "$(AS "$OA" "select count(*) from staff_working_hours where chair_id='$ST'")"
check "time off cannot be created for another shop's staff" FAIL \
  "$(AS "$OB" "insert into staff_time_off (chair_id, starts_at, ends_at) values ('$ST', $(AT 11 10:00), $(AT 11 12:00))" | grep -q 'INSERT 0 1' && echo OK || echo FAIL)"
check "the right owner CAN create it"                    OK \
  "$(AS "$OA" "insert into staff_time_off (chair_id, starts_at, ends_at) values ('$ST', $(AT 11 10:00), $(AT 11 12:00))" | grep -q 'INSERT 0 1' && echo OK || echo FAIL)"
check "another shop's owner sees no time off"            0 "$(AS "$OB" 'select count(*) from staff_time_off')"
check "reschedule history cannot be forged"              FAIL \
  "$(AS "$OA" "insert into appointment_reschedules (appointment_id,from_starts_at,from_ends_at,from_staff_id,to_starts_at,to_ends_at,to_staff_id) values ('$A1', now(), now(), '$ST', now(), now(), '$ST')" | grep -q 'INSERT 0 1' && echo OK || echo FAIL)"
Q "delete from staff_time_off" >/dev/null

echo
echo "== reminders =="
Q "delete from appointments; delete from notifications;" >/dev/null
# customer_id has to go in on the insert: appointment_before_update freezes it
# on purpose, so an appointment can never be reassigned to another person.
# Tracked by id, not by name: the insert trigger snapshots customer_name from
# the customer's profile, so the name passed in here does not survive.
INSC="insert into appointments (shop_id,staff_id,customer_id,service_ids,starts_at,ends_at,is_walk_in)"
# The next 12:00 in the shop's own zone, plus N days.
#
# NOT `now() + interval '20 hours'`: 20260919 validates every booking against
# the shop's 10:00–20:00 and the staff member's own hours, so a fixed offset
# lands outside them at some times of day and the whole reminder section fails
# depending on when it is run. Anchoring to local noon makes it deterministic.
# The offset flips to tomorrow from 11:00 local, so the soonest row is at most
# ~25 hours out — hence a 26-hour window below rather than 24.
NOON() { echo "((((now() at time zone 'Asia/Dhaka')::date + case when (now() at time zone 'Asia/Dhaka')::time < time '11:00' then 0 else 1 end + $1) + time '$2') at time zone 'Asia/Dhaka')"; }
SOON=$(Q "$INSC values ('$S','$ST','$C1',array['$SV'::uuid], $(NOON 0 12:00), $(NOON 0 13:00), false) returning id" | head -1)
CANX=$(Q "$INSC values ('$S','$ST2','$C2',array['$SV'::uuid], $(NOON 0 14:00), $(NOON 0 15:00), false) returning id" | head -1)
Q "update appointments set status='CANCELLED' where id='$CANX'" >/dev/null
FAR=$(Q "$INSC values ('$S','$ST','$C1',array['$SV'::uuid], $(NOON 8 12:00), $(NOON 8 13:00), false) returning id" | head -1)
check "the cancel actually landed" "CANCELLED" "$(Q "select status from appointments where id='$CANX'")"

check "one due appointment is reminded"          1 "$(Q 'select send_appointment_reminders(26)')"
check "a second run sends nothing (idempotent)"  0 "$(Q 'select send_appointment_reminders(26)')"
check "exactly one notification was written"     1 "$(Q "select count(*) from notifications where type='REMINDER'")"
check "it went to the right customer"            "$C1" "$(Q "select user_id from notifications where type='REMINDER'")"
check "the cancelled one was never reminded"     "t" \
  "$(Q "select reminded_at is null from appointments where id='$CANX'")"
check "the far-off one was not reminded"         "t" \
  "$(Q "select reminded_at is null from appointments where id='$FAR'")"
check "widening the window picks the far one up" 1 "$(Q 'select send_appointment_reminders(240)')"
check "the notification carries the appointment" "t" \
  "$(Q "select bool_and(data ? 'appointment_id') from notifications where type='REMINDER'")"
check "the time in the body is the shop's local time" "t" \
  "$(Q "select body like '%' || to_char((select starts_at from appointments where id='$SOON') at time zone 'Asia/Dhaka', 'HH12:MI AM') || '%' from notifications order by created_at limit 1")"

echo
echo "-------------------------------------------"
printf 'passed: %d   failed: %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
