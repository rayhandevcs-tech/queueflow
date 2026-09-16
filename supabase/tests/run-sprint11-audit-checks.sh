#!/usr/bin/env bash
#
# Sprint 11 final audit — who may execute which function.
#
#   bash supabase/tests/run-sprint11-audit-checks.sh
#
# WHAT IS UNDER TEST, AND WHY THE FIXTURE LOOKS LIKE THIS
#
# Every other harness in this folder stands up a stand-in schema and then runs a
# real migration's DDL over it, because the thing being tested is that DDL. Here
# the thing being tested is not a function body — it is the GRANT on a function.
# A grant knows nothing about a body. So the fixture below creates the seventeen
# functions as one-line stubs with byte-identical signatures, and then runs
# `20260927_function_grants.sql` verbatim over them.
#
# That is not a shortcut around the test; the signature IS the addressable
# object. What the fixture does have to reproduce faithfully is the *privilege
# environment*, and that is where a plain Postgres cluster differs from Supabase
# in a way that matters:
#
#   · Postgres grants EXECUTE on every new function to PUBLIC.
#   · Supabase ALSO sets DEFAULT PRIVILEGES on schema public so that new
#     functions are granted to `anon` and `authenticated` BY NAME.
#
# The second one is the trap. `revoke ... from public` does not remove a grant
# held by name, so a fix that only revokes from PUBLIC looks like it worked on a
# bare cluster and changes nothing on Supabase. The fixture therefore installs
# both, and check A2 exists purely to prove the by-name grant is really there
# before the migration runs — otherwise the "after" checks would pass for the
# wrong reason.
#
# So a green run here means: against a privilege environment shaped like
# Supabase's, this migration closes exactly the twelve functions it claims to,
# leaves the five it must not touch alone, keeps the nightly job working, and
# does not break a trigger that calls a locked-down function. It does NOT mean
# the production instance currently has the problem — nobody could reach the
# production instance from the session that wrote this. The migration's own
# handover block carries the query that settles that.
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PORT=5612
DIR=$(mktemp -d /tmp/qf-s11audit-XXXXXX)
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

Q()    { su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$1\"" 2>&1 | head -1; }
QRAW() { su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$1\"" 2>&1; }
FILE() { su "$RUNAS" -s /bin/bash -c "$PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -v ON_ERROR_STOP=1 -q -f $1"; }
# Run as a real, unprivileged role — the whole subject of this file. A superuser
# bypasses every privilege check and would report success no matter what.
ASAUTH() { su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=authenticated' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$1\"" 2>&1 | head -1; }
ASSVC()  { su "$RUNAS" -s /bin/bash -c "PGOPTIONS='-c role=service_role' $PGBIN/psql -h $DIR -p $PORT -U postgres -d qf -tA -c \"$1\"" 2>&1 | head -1; }

CAN() { Q "select has_function_privilege('$1', 'public.$2', 'EXECUTE')"; }

# ---------------------------------------------------------------------------
# Fixture — Supabase's privilege environment, then the seventeen signatures
# ---------------------------------------------------------------------------
echo "== fixture: Supabase-shaped roles and default privileges =="
cat > "$DIR/fixture.sql" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase's stock setup. This is the line that makes `revoke ... from public`
-- insufficient on its own, and the reason this harness exists.
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- The twelve the migration must close.
create function public.expire_memberships() returns int language sql as $$ select 0 $$;
create function public.expire_redemptions() returns int language sql as $$ select 0 $$;
create function public.send_appointment_reminders(p_within_hours integer default 24) returns int language sql as $$ select 0 $$;
create function public.send_customer_reminders() returns int language sql as $$ select 0 $$;
create function public.send_daily_summaries(p_day date default null) returns int language sql as $$ select 0 $$;
create function public.notify_shop_wait_drop(p_shop_id uuid) returns void language sql as $$ select $$;
create function public.recalc_queue_estimates(p_shop_id uuid) returns void language sql as $$ select $$;
create function public.assign_best_chair(p_shop_id uuid, p_service_ids uuid[]) returns uuid language sql as $$ select null::uuid $$;
create function public.chair_backlog_min(p_chair_id uuid) returns int language sql as $$ select 0 $$;
create function public.estimate_duration_on_chair(p_chair_id uuid, p_service_ids uuid[]) returns int language sql as $$ select 0 $$;
create function public.shop_current_wait(p_shop_id uuid) returns int language sql as $$ select 0 $$;
create function public.referral_is_live(p_shop_id uuid) returns boolean language sql as $$ select true $$;

-- The five that must survive untouched.
create function public.is_shop_owner(p_shop_id uuid) returns boolean language sql as $$ select true $$;
create function public.is_chair_owner(p_chair_id uuid) returns boolean language sql as $$ select true $$;
create function public.membership_is_active(p_customer_id uuid, p_shop_id uuid) returns boolean language sql as $$ select true $$;
create function public.staff_is_available(p_chair_id uuid, p_at timestamptz) returns boolean language sql as $$ select true $$;
create function public.shop_available_slots(p_shop_id uuid, p_day date, p_service_ids uuid[], p_staff_id uuid) returns setof record language sql as $$ select $$;
-- ...and the provider-callable due reminder, which has its own owner guard.
create function public.send_appointment_due_reminder(p_appointment_id uuid) returns void language sql as $$ select $$;

-- A trigger whose function is SECURITY DEFINER and which calls one of the
-- locked-down helpers. This is the safety claim the fix rests on: inside a
-- DEFINER function the EXECUTE check is made against the function's OWNER, so
-- taking the grant away from the end user must not break this path.
create table public.serials (id serial primary key, shop_id uuid);
create function public.serial_after_insert() returns trigger
  language plpgsql security definer set search_path to 'public' as $fn$
begin
  perform public.recalc_queue_estimates(new.shop_id);
  return new;
end $fn$;
create trigger serials_after_insert after insert on public.serials
  for each row execute function public.serial_after_insert();
grant insert on public.serials to authenticated;
grant usage, select on sequence public.serials_id_seq to authenticated;
SQL
FILE "$DIR/fixture.sql" >/dev/null || { echo "fixture failed"; exit 1; }

# ---------------------------------------------------------------------------
# A. BEFORE — the finding itself. If these fail, the audit was wrong.
# ---------------------------------------------------------------------------
echo
echo "== A. before the migration: the problem is real =="
for fn in "send_customer_reminders()" "send_daily_summaries(date)" \
          "send_appointment_reminders(integer)" "expire_memberships()" \
          "expire_redemptions()" "notify_shop_wait_drop(uuid)" \
          "recalc_queue_estimates(uuid)" "assign_best_chair(uuid,uuid[])" \
          "chair_backlog_min(uuid)" "estimate_duration_on_chair(uuid,uuid[])" \
          "shop_current_wait(uuid)" "referral_is_live(uuid)"; do
  check "A1 authenticated can call $fn (the bug)" "t" "$(CAN authenticated "$fn")"
done
# Proves the by-name grant is present, so the "after" checks cannot pass for the
# wrong reason. `aclexplode` reads the real ACL rather than trusting a helper.
check "A2 the grant is held BY NAME, not only via PUBLIC" "t" \
  "$(Q "select exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.proname='send_customer_reminders' and a.grantee='authenticated'::regrole)")"
check "A3 anon can call it too" "t" "$(CAN anon "send_customer_reminders()")"
check "A4 a session can actually execute it, not just hold the bit" "0" \
  "$(ASAUTH "select public.send_customer_reminders()")"

# ---------------------------------------------------------------------------
# B. Apply the real migration file.
# ---------------------------------------------------------------------------
echo
echo "== B. applying supabase/migrations/20260927_function_grants.sql =="
FILE "$ROOT/supabase/migrations/20260927_function_grants.sql" >"$DIR/mig.log" 2>&1
check "B1 migration applied without error" "0" "$?"
check "B2 it reported what it locked down" "t" \
  "$(grep -qc 'locked down' "$DIR/mig.log" >/dev/null && echo t || echo f)"

# ---------------------------------------------------------------------------
# C. AFTER — the twelve are closed.
# ---------------------------------------------------------------------------
echo
echo "== C. after: the twelve are closed to a session =="
for fn in "send_customer_reminders()" "send_daily_summaries(date)" \
          "send_appointment_reminders(integer)" "expire_memberships()" \
          "expire_redemptions()" "notify_shop_wait_drop(uuid)" \
          "recalc_queue_estimates(uuid)" "assign_best_chair(uuid,uuid[])" \
          "chair_backlog_min(uuid)" "estimate_duration_on_chair(uuid,uuid[])" \
          "shop_current_wait(uuid)" "referral_is_live(uuid)"; do
  check "C1 authenticated cannot call $fn" "f" "$(CAN authenticated "$fn")"
  check "C2 anon cannot call $fn"          "f" "$(CAN anon "$fn")"
done
# A privilege bit is a claim; a refused call is the fact.
check "C3 calling it as a session is actually refused" "permission denied" \
  "$(ASAUTH "select public.send_customer_reminders()" | grep -o 'permission denied')"

# ---------------------------------------------------------------------------
# D. AFTER — nothing that had to keep working stopped working.
# ---------------------------------------------------------------------------
echo
echo "== D. after: the nightly job and the five neighbours still work =="
for fn in "send_customer_reminders()" "send_daily_summaries(date)" \
          "send_appointment_reminders(integer)" "expire_memberships()" \
          "expire_redemptions()"; do
  check "D1 service_role can still call $fn" "t" "$(CAN service_role "$fn")"
done
check "D2 service_role can actually execute it" "0" \
  "$(ASSVC "select public.send_customer_reminders()")"
check "D3 is_shop_owner still callable (40 RLS policies depend on it)" "t" \
  "$(CAN authenticated "is_shop_owner(uuid)")"
check "D4 is_chair_owner still callable (8 RLS policies)" "t" \
  "$(CAN authenticated "is_chair_owner(uuid)")"
check "D5 membership_is_active still callable (INVOKER caller)" "t" \
  "$(CAN authenticated "membership_is_active(uuid,uuid)")"
check "D6 staff_is_available still callable (INVOKER caller)" "t" \
  "$(CAN authenticated "staff_is_available(uuid,timestamptz)")"
check "D7 shop_available_slots still callable (booking screen)" "t" \
  "$(CAN authenticated "shop_available_slots(uuid,date,uuid[],uuid)")"
check "D8 send_appointment_due_reminder still callable (provider screen)" "t" \
  "$(CAN authenticated "send_appointment_due_reminder(uuid)")"

# The safety claim, exercised rather than argued: a session inserts a serial,
# the DEFINER trigger calls a function that session may no longer call, and the
# insert must still succeed.
echo
echo "== E. the DEFINER-trigger path still works for a session =="
check "E1 a session can still insert a serial" "INSERT 0 1" \
  "$(ASAUTH "insert into public.serials (shop_id) values (gen_random_uuid())" | head -1)"
check "E2 ...and the row is there" "1" "$(Q "select count(*) from public.serials")"
check "E3 ...while that session still cannot call the helper directly" "permission denied" \
  "$(ASAUTH "select public.recalc_queue_estimates(gen_random_uuid())" | grep -o 'permission denied')"

# ---------------------------------------------------------------------------
# F. Idempotence — migrations here are run by hand and get re-run.
# ---------------------------------------------------------------------------
echo
echo "== F. running it twice changes nothing =="
FILE "$ROOT/supabase/migrations/20260927_function_grants.sql" >"$DIR/mig2.log" 2>&1
check "F1 second run has no ERROR" "" \
  "$(grep -oE 'ERROR|FATAL' "$DIR/mig2.log" | head -1)"
check "F2 still closed after a second run" "f" "$(CAN authenticated "send_customer_reminders()")"
check "F3 service_role still fine after a second run" "t" "$(CAN service_role "send_customer_reminders()")"
check "F4 is_shop_owner still fine after a second run" "t" "$(CAN authenticated "is_shop_owner(uuid)")"

echo
echo "================================"
printf 'PASS %d   FAIL %d\n' "$pass" "$fail"
echo "================================"
[ "$fail" -eq 0 ] || exit 1
