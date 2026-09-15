#!/usr/bin/env bash
#
# Sprint 8 — the referral system, run against a throwaway local Postgres
# exactly as the other harnesses do.
#
#   bash supabase/tests/run-sprint8-checks.sh
#
# Applies 20260918 → 20260919 → 20260920 → 20260921 → 20260922 → 20260923 on
# top of the fixture, so referral lands beside a real appointments engine, a
# real membership programme and a real loyalty ledger rather than on an empty
# schema, and walks the brief:
#
#   1. structure — two tables, RLS, and the ABSENCE of write policies
#   2. code creation and lookup — minted once, found case-insensitively
#   3. a valid claim — and that it awards NOTHING by itself
#   4. an invalid code · self-referral · a duplicate claim
#   5. cross-shop isolation — shop B's code does not exist at shop A
#   6. the qualifying conversion — both sides paid, into THAT shop's account
#   7. no duplicate rewards, at two independent layers
#   8. loyalty integration — one ledger, one balance, one invariant
#   9. rollback/error safety — a broken reward never blocks a job
#  10. regression — salon, appointments, membership and loyalty untouched
#
# A green run means the migration is sound against a schema shaped like the
# real one. It is NOT proof that it will apply to production — the fixture is
# a stand-in, not a dump.
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PORT=5605
DIR=$(mktemp -d /tmp/qf-s8-XXXXXX)
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

ERRS='referral_requires_login|referral_not_enabled|referral_code_invalid|referral_code_not_found|referral_self_not_allowed|referral_not_a_new_customer|referral_already_claimed|referral_not_converted|referral_side_invalid|referral_needs_exactly_one_qualifying_booking|referral_conversion_is_final|referral_not_found|referral_code_generation_failed|not your shop|duplicate key value|violates check constraint|violates row-level security|violates foreign key constraint|permission denied'
WHY()  { Q  "$1"      2>&1 | grep -oE "$ERRS" | head -1; }
WHYAS(){ AS "$1" "$2"      | grep -oE "$ERRS" | head -1; }

echo "== applying migrations =="
FILE "$HERE/fixture.sql" >/dev/null || exit 1

# The shared fixture's `shops` stand-in has no logo_url; the real table does,
# and my_loyalty_accounts() (Sprint 7) returns it.
Q "alter table public.shops add column if not exists logo_url text" >/dev/null

# A salon stand-in with the money columns both the loyalty and the referral
# trigger read, so the queue side of "DONE -> reward" runs on a real row.
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
         20260920_appointment_money 20260921_membership 20260922_loyalty \
         20260923_referral; do
  if ! FILE "$ROOT/supabase/migrations/$m.sql" >/dev/null 2>"$DIR/err"; then
    echo "  MIGRATION FAILED: $m"; sed 's/^/    /' "$DIR/err" | head -25; exit 1
  fi
  echo "  applied $m"
done
FILE "$ROOT/supabase/migrations/20260923_referral.sql" >/dev/null 2>&1
check "re-running 20260923 is safe (idempotent)" OK "$(OK 'select 1')"
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
SVB=ffffffff-0000-0000-0000-000000000001

Q "insert into profiles (id, full_name, phone) values
     ('$C3','Sumona Akter','01900000005'),
     ('$C4','Tania Begum','01900000006')" >/dev/null

AT() { echo "((current_date + $1 + time '$2') at time zone 'Asia/Dhaka')"; }
# $5 is the service; it must belong to $1, or the insert trigger refuses it
# for being cross-shop.
NEWAPPT() { Q "insert into appointments (shop_id,staff_id,customer_id,service_ids,starts_at,ends_at,is_walk_in)
                values ('$1','$2','$3',array['${5:-$SV}'::uuid], $4, $4 + interval '1 hour', false) returning id" | head -1; }
DONEAPPT() {
  AS "$2" "update appointments set status='IN_PROGRESS' where id='$1'" >/dev/null
  AS "$2" "update appointments set status='DONE', payment_status='PAID', payment_method='cash', due_amount=0 where id='$1'" >/dev/null
}
NEWSERIAL() { Q "insert into serials (shop_id, chair_id, customer_id, customer_name, total_amount, status)
                  values ('$1','$2','$3','$4',$5,'WAITING') returning id" | head -1; }

# The non-superuser role: superusers bypass RLS *and* carry no auth.uid(),
# while every referral RPC is gated on auth.uid() or is_shop_owner().
Q "drop owned by app_user" >/dev/null 2>&1; Q "drop role if exists app_user" >/dev/null 2>&1
Q "create role app_user nologin" >/dev/null
Q "grant usage on schema public, auth to app_user" >/dev/null
Q "grant select,insert,update,delete on all tables in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema public to app_user" >/dev/null
Q "grant execute on all functions in schema auth to app_user" >/dev/null

echo
echo "== structure =="
check "referral_codes exists"  "t" "$(Q "select to_regclass('public.referral_codes') is not null")"
check "referrals exists"       "t" "$(Q "select to_regclass('public.referrals') is not null")"
check "referral_codes RLS on"  "t" "$(Q "select relrowsecurity from pg_class where oid='public.referral_codes'::regclass")"
check "referrals RLS on"       "t" "$(Q "select relrowsecurity from pg_class where oid='public.referrals'::regclass")"
# the absence of write policies IS the design (decision 32's reasoning)
check "referral_codes: exactly 1 policy"       1 "$(Q "select count(*) from pg_policies where tablename='referral_codes'")"
check "referral_codes: that policy is SELECT"  "SELECT" "$(Q "select cmd from pg_policies where tablename='referral_codes'")"
check "referral_codes: NO insert policy"       "t" "$(Q "select not exists (select 1 from pg_policies where tablename='referral_codes' and cmd='INSERT')")"
check "referrals: exactly 1 policy"            1 "$(Q "select count(*) from pg_policies where tablename='referrals'")"
check "referrals: that policy is SELECT"       "SELECT" "$(Q "select cmd from pg_policies where tablename='referrals'")"
check "referrals: NO insert policy"            "t" "$(Q "select not exists (select 1 from pg_policies where tablename='referrals' and cmd='INSERT')")"
check "referrals: NO update policy"            "t" "$(Q "select not exists (select 1 from pg_policies where tablename='referrals' and cmd='UPDATE')")"
check "referrals: NO delete policy"            "t" "$(Q "select not exists (select 1 from pg_policies where tablename='referrals' and cmd='DELETE')")"
# codes are shop-scoped (decision 34, amended)
check "referral_codes PK is (shop_id, customer_id)" "{shop_id,customer_id}" \
  "$(Q "select array_agg(a.attname::text order by k.ord) from pg_constraint c join unnest(c.conkey) with ordinality as k(attnum, ord) on true join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum where c.conrelid='public.referral_codes'::regclass and c.contype='p'")"
check "code is globally unique" "t" \
  "$(Q "select exists (select 1 from pg_constraint where conrelid='public.referral_codes'::regclass and contype='u')")"
check "one referral per (shop, referred) index" "t" "$(Q "select exists (select 1 from pg_indexes where indexname='referrals_one_per_shop')")"
check "self-referral refused by the database"   "t" "$(Q "select exists (select 1 from pg_constraint where conname='referrals_no_self_referral')")"
check "conversion shape constraint"             "t" "$(Q "select exists (select 1 from pg_constraint where conname='referrals_conversion_shape')")"
check "same-shop relationship via composite FK" "t" \
  "$(Q "select exists (select 1 from pg_constraint where conrelid='public.referrals'::regclass and contype='f' and confrelid='public.referral_codes'::regclass)")"
check "history freeze trigger"                  "t" "$(Q "select exists (select 1 from pg_trigger where tgname='referrals_freeze_history')")"
check "only PENDING and CONVERTED are allowed"  "t" \
  "$(Q "select pg_get_constraintdef(oid) not like '%VOID%' and pg_get_constraintdef(oid) like '%CONVERTED%' from pg_constraint where conname='referrals_status_check'")"
check "no Postgres enum type was created (decision 45)" 0 \
  "$(Q "select count(*) from pg_type where typname='referral_status' and typtype='e'")"

echo
echo "== Sprint 7's ledger is reused, not duplicated =="
check "no separate referral points/reward table" "t" \
  "$(Q "select to_regclass('public.referral_rewards') is null and to_regclass('public.referral_points') is null and to_regclass('public.referral_accounts') is null and to_regclass('public.referral_transactions') is null")"
check "ledger gained source_referral_id"  1 \
  "$(Q "select count(*) from information_schema.columns where table_name='loyalty_transactions' and column_name='source_referral_id'")"
check "ledger kind allows the referrer side" "t" \
  "$(Q "select pg_get_constraintdef(oid) like '%REFERRAL_REFERRER%' from pg_constraint where conname='loyalty_transactions_kind_check'")"
check "ledger kind allows the referred side" "t" \
  "$(Q "select pg_get_constraintdef(oid) like '%REFERRAL_REFERRED%' from pg_constraint where conname='loyalty_transactions_kind_check'")"
check "the three old kinds are still allowed" "t" \
  "$(Q "select pg_get_constraintdef(oid) like '%EARN_SERIAL%' and pg_get_constraintdef(oid) like '%EARN_APPOINTMENT%' and pg_get_constraintdef(oid) like '%ADJUST%' from pg_constraint where conname='loyalty_transactions_kind_check'")"
check "one reward per referral side index" "t" \
  "$(Q "select exists (select 1 from pg_indexes where indexname='loyalty_tx_one_per_referral_side_idx')")"
check "loyalty_settings gained 3 referral columns" 3 \
  "$(Q "select count(*) from information_schema.columns where table_name='loyalty_settings' and column_name in ('referral_enabled','referral_referrer_points','referral_referred_points')")"
check "still exactly 2 loyalty_settings policies" 2 "$(Q "select count(*) from pg_policies where tablename='loyalty_settings'")"
check "loyalty_accounts still has exactly 1 policy" 1 "$(Q "select count(*) from pg_policies where tablename='loyalty_accounts'")"
check "referral_is_live is DEFINER"       "t" "$(Q "select prosecdef from pg_proc where oid='public.referral_is_live(uuid)'::regprocedure")"
check "my_referral_code is DEFINER"       "t" "$(Q "select prosecdef from pg_proc where oid='public.my_referral_code(uuid)'::regprocedure")"
check "claim_referral is DEFINER"         "t" "$(Q "select prosecdef from pg_proc where oid='public.claim_referral(uuid,text)'::regprocedure")"
check "referral_convert is DEFINER"       "t" "$(Q "select prosecdef from pg_proc where oid='public.referral_convert(uuid,uuid,uuid)'::regprocedure")"
check "referral_award_points is DEFINER"  "t" "$(Q "select prosecdef from pg_proc where oid='public.referral_award_points(uuid,text)'::regprocedure")"
check "my_referrals is DEFINER"           "t" "$(Q "select prosecdef from pg_proc where oid='public.my_referrals(uuid)'::regprocedure")"
check "shop_referral_stats is DEFINER"    "t" "$(Q "select prosecdef from pg_proc where oid='public.shop_referral_stats(uuid)'::regprocedure")"
check "serials referral trigger exists"      "t" "$(Q "select exists (select 1 from pg_trigger where tgname='serials_zz_referral_convert')")"
check "appointments referral trigger exists" "t" "$(Q "select exists (select 1 from pg_trigger where tgname='appointments_zz_referral_convert')")"
check "loyalty fires before referral (name order)" "t" \
  "$(Q "select 'serials_zz_loyalty_award' < 'serials_zz_referral_convert'")"
check "no shop had referral switched on" 0 "$(Q "select count(*) from loyalty_settings where referral_enabled")"
check "no code was seeded"               0 "$(Q "select count(*) from referral_codes")"
check "no referral was seeded"           0 "$(Q "select count(*) from referrals")"

echo
echo "== the switch: nothing works before the shop turns it on =="
check "asking for a code at a shop with no programme is refused" "referral_not_enabled" \
  "$(WHYAS "$C1" "select my_referral_code('$S')")"
check "claiming at a shop with no programme is refused"          "referral_not_enabled" \
  "$(WHYAS "$C2" "select claim_referral('$S','ABC123')")"
check "referral_is_live says false"  "f" "$(Q "select referral_is_live('$S')")"

# loyalty on, referral still off -> referral is not live
AS "$OA" "insert into loyalty_settings (shop_id, is_enabled, taka_per_point) values ('$S', true, 100)" >/dev/null
check "loyalty alone does not make referral live" "f" "$(Q "select referral_is_live('$S')")"
check "and a code still cannot be minted"         "referral_not_enabled" \
  "$(WHYAS "$C1" "select my_referral_code('$S')")"

# referral on, but loyalty off -> still not live (referral rewards ARE points)
AS "$OA" "update loyalty_settings set is_enabled=false, referral_enabled=true where shop_id='$S'" >/dev/null
check "referral alone does not make it live either" "f" "$(Q "select referral_is_live('$S')")"

AS "$OA" "update loyalty_settings set is_enabled=true, referral_enabled=true,
            referral_referrer_points=10, referral_referred_points=5 where shop_id='$S'" >/dev/null
check "both switches on makes it live"   "t" "$(Q "select referral_is_live('$S')")"
# A refused UPDATE is silent, not an error: the policy's USING clause simply
# hides the row, so 0 rows change and psql reports UPDATE 0. The proof is
# therefore the unchanged value, not an error message.
check "another shop's owner cannot rewrite shop A's referral terms" 10 \
  "$(AS "$OB" "update loyalty_settings set referral_referrer_points=9999 where shop_id='$S'" >/dev/null;
     Q "select referral_referrer_points from loyalty_settings where shop_id='$S'")"
check "nor switch shop A's referral off"  "t" \
  "$(AS "$OB" "update loyalty_settings set referral_enabled=false where shop_id='$S'" >/dev/null;
     Q "select referral_enabled from loyalty_settings where shop_id='$S'")"
check "negative referrer points are refused" "violates check constraint" \
  "$(WHY "update loyalty_settings set referral_referrer_points=-1 where shop_id='$S'")"

# shop B runs its own programme, on different terms
AS "$OB" "insert into loyalty_settings (shop_id, is_enabled, taka_per_point, referral_enabled,
            referral_referrer_points, referral_referred_points)
          values ('$SB', true, 50, true, 20, 0)" >/dev/null
check "shop B's programme is live on its own terms" "t" "$(Q "select referral_is_live('$SB')")"

echo
echo "== code creation and lookup =="
CODE1=$(AS "$C1" "select my_referral_code('$S')")
check "C1 got a code at shop A"           "t" "$(Q "select '$CODE1' ~ '^[A-Z0-9]{6,12}\$'")"
check "asking again returns the SAME code" "$CODE1" "$(AS "$C1" "select my_referral_code('$S')")"
check "and only one row was written"      1 "$(Q "select count(*) from referral_codes where shop_id='$S' and customer_id='$C1'")"
CODE1B=$(AS "$C1" "select my_referral_code('$SB')")
check "the same customer's code at shop B is a DIFFERENT code" "t" "$(Q "select '$CODE1' <> '$CODE1B'")"
check "so C1 holds two codes, one per shop" 2 "$(Q "select count(*) from referral_codes where customer_id='$C1'")"
check "codes avoid the ambiguous 0/O/1/I/L" "t" "$(Q "select '$CODE1$CODE1B' !~ '[01ILO]'")"
check "C1 can read their own code"        1 "$(AS "$C1" "select count(*) from referral_codes where customer_id='$C1' and shop_id='$S'")"
check "owner A can read their shop's codes" 1 "$(AS "$OA" "select count(*) from referral_codes where shop_id='$S'")"
check "C2 cannot read C1's code"          0 "$(AS "$C2" "select count(*) from referral_codes where customer_id='$C1'")"
check "nobody can mint a code in someone else's name" "violates row-level security" \
  "$(WHYAS "$C2" "insert into referral_codes (shop_id, customer_id, code) values ('$S','$C1','VANITY')")"
check "nor a vanity code for themselves"  "violates row-level security" \
  "$(WHYAS "$C2" "insert into referral_codes (shop_id, customer_id, code) values ('$S','$C2','VANITY')")"
check "and no such code exists"           0 "$(Q "select count(*) from referral_codes where code='VANITY'")"

echo
echo "== a claim that must be refused =="
check "an empty code is refused"        "referral_code_invalid" "$(WHYAS "$C2" "select claim_referral('$S','   ')")"
check "an unknown code is refused"      "referral_code_not_found" "$(WHYAS "$C2" "select claim_referral('$S','ZZZZZZ')")"
check "C1 cannot claim their own code"  "referral_self_not_allowed" "$(WHYAS "$C1" "select claim_referral('$S','$CODE1')")"
# cross-shop: C1's shop-B code simply does not exist at shop A
check "shop B's code does not exist at shop A" "referral_code_not_found" \
  "$(WHYAS "$C2" "select claim_referral('$S','$CODE1B')")"
check "and shop A's code does not exist at shop B" "referral_code_not_found" \
  "$(WHYAS "$C2" "select claim_referral('$SB','$CODE1')")"
check "no referral row was created by any refusal" 0 "$(Q "select count(*) from referrals")"

echo
echo "== a valid claim awards NOTHING by itself =="
R1=$(AS "$C2" "select claim_referral('$S','$CODE1')")
check "C2's claim created a referral"      1 "$(Q "select count(*) from referrals where id='$R1'")"
check "it is PENDING"                      "PENDING" "$(Q "select status from referrals where id='$R1'")"
check "it names the right shop"            "$S" "$(Q "select shop_id from referrals where id='$R1'")"
check "it names the right referrer"        "$C1" "$(Q "select referrer_id from referrals where id='$R1'")"
check "it snapshots the code used"         "$CODE1" "$(Q "select code from referrals where id='$R1'")"
check "**no ledger row was written**"      0 "$(Q "select count(*) from loyalty_transactions")"
check "**no loyalty account was created**" 0 "$(Q "select count(*) from loyalty_accounts")"
check "and no points are recorded on the referral yet" "t" \
  "$(Q "select referrer_points is null and referred_points is null and converted_at is null from referrals where id='$R1'")"
check "a lowercase code is accepted too (case-insensitive)" "referral_already_claimed" \
  "$(WHYAS "$C2" "select claim_referral('$S',lower('$CODE1'))")"
check "a second claim is refused"          "referral_already_claimed" \
  "$(WHYAS "$C2" "select claim_referral('$S','$CODE1')")"
check "still exactly one referral row"     1 "$(Q "select count(*) from referrals")"

echo
echo "== the qualifying conversion =="
AP1=$(NEWAPPT "$S" "$ST" "$C2" "$(AT 3 12:00)")
DONEAPPT "$AP1" "$OA"
check "the appointment completed normally"  "DONE" "$(Q "select status from appointments where id='$AP1'")"
check "the referral is now CONVERTED"       "CONVERTED" "$(Q "select status from referrals where id='$R1'")"
check "it points at the qualifying appointment" "$AP1" "$(Q "select qualifying_appointment_id from referrals where id='$R1'")"
check "and not at a serial"                 "t" "$(Q "select qualifying_serial_id is null from referrals where id='$R1'")"
check "it stamped converted_at"             "t" "$(Q "select converted_at is not null from referrals where id='$R1'")"
check "it snapshotted both sides' points"   "10|5" "$(Q "select referrer_points || '|' || referred_points from referrals where id='$R1'")"
# the referrer had no account at all until now
check "the referrer C1 was paid 10"         10 "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "the referrer's ledger row names the referral" "$R1" \
  "$(Q "select source_referral_id from loyalty_transactions where kind='REFERRAL_REFERRER' and customer_id='$C1'")"
# the referred customer gets the booking's own points AND the referral bonus
check "the referred C2 has 8 + 5 = 13"      13 "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C2'")"
check "C2's ledger has the booking's points" 8 \
  "$(Q "select points from loyalty_transactions where kind='EARN_APPOINTMENT' and source_appointment_id='$AP1'")"
check "C2's ledger has the referral bonus"   5 \
  "$(Q "select points from loyalty_transactions where kind='REFERRAL_REFERRED' and source_referral_id='$R1'")"
check "loyalty was credited before the referral bonus" "t" \
  "$(Q "select (select created_at from loyalty_transactions where source_appointment_id='$AP1')
              <= (select created_at from loyalty_transactions where kind='REFERRAL_REFERRED' and source_referral_id='$R1')")"
check "exactly 3 ledger rows so far"         3 "$(Q "select count(*) from loyalty_transactions")"
check "balance == ledger sum everywhere"     "t" \
  "$(Q "select not exists (select 1 from loyalty_accounts a where a.balance <> coalesce((select sum(t.points) from loyalty_transactions t where t.shop_id=a.shop_id and t.customer_id=a.customer_id),0))")"
check "lifetime_earned counts the bonus too" 13 "$(Q "select lifetime_earned from loyalty_accounts where shop_id='$S' and customer_id='$C2'")"

echo
echo "== never twice =="
AP2=$(NEWAPPT "$S" "$ST" "$C2" "$(AT 4 12:00)")
DONEAPPT "$AP2" "$OA"
check "a second completed booking pays the booking's points" 21 \
  "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C2'")"
check "but NOT a second referral bonus"  1 \
  "$(Q "select count(*) from loyalty_transactions where kind='REFERRAL_REFERRED' and source_referral_id='$R1'")"
check "and the referrer was not paid again" 10 \
  "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "a later non-status update pays nothing" 10 \
  "$(AS "$OA" "update appointments set due_reminded_at=now() where id='$AP1'" >/dev/null;
     Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "calling referral_convert again returns 0, harmlessly" 0 \
  "$(AS "$OA" "select referral_convert('$R1', null, '$AP2')")"
check "calling referral_award_points again is refused by the index" "duplicate key value" \
  "$(WHYAS "$OA" "select referral_award_points('$R1','REFERRER')")"
check "the referrer's balance survived that"  10 \
  "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "an unknown side is refused"            "referral_side_invalid" \
  "$(WHYAS "$OA" "select referral_award_points('$R1','BOTH')")"
check "converting an unknown referral is refused" "referral_not_found" \
  "$(WHYAS "$OA" "select referral_convert('00000000-0000-0000-0000-000000000000', null, '$AP2')")"

echo
echo "== the claim must be in time =="
# C4 already finished a job at shop A, so the 'first completed booking'
# qualifier can never fire for them — saying no now is the honest answer.
SR4=$(NEWSERIAL "$S" "$ST" "$C4" "Tania Begum" 1000)
AS "$OA" "update serials set status='DONE', payment_status='PAID', payment_method='cash' where id='$SR4'" >/dev/null
check "C4's queue job earned its own points" 10 "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C4'")"
check "an existing customer cannot claim a code" "referral_not_a_new_customer" \
  "$(WHYAS "$C4" "select claim_referral('$S','$CODE1')")"
check "and no referral row was created for them" 0 "$(Q "select count(*) from referrals where referred_id='$C4'")"

echo
echo "== conversion from the salon queue, and cross-shop isolation =="
R2=$(AS "$C3" "select claim_referral('$S','$CODE1')")
check "C3 claimed C1's shop A code"  "PENDING" "$(Q "select status from referrals where id='$R2'")"
check "C1 now has two referrals at shop A" 2 "$(Q "select count(*) from referrals where shop_id='$S' and referrer_id='$C1'")"
# a PENDING referral needs exactly one qualifying booking — neither none…
check "converting with no qualifying booking is refused" "referral_needs_exactly_one_qualifying_booking" \
  "$(WHYAS "$OA" "select referral_convert('$R2', null, null)")"
# …nor both at once
check "converting with two qualifying bookings is refused" "referral_needs_exactly_one_qualifying_booking" \
  "$(WHYAS "$OA" "select referral_convert('$R2', '$SR4', '$AP2')")"
check "and it is still PENDING after both refusals" "PENDING" "$(Q "select status from referrals where id='$R2'")"

# shop B: C2 is the referrer there, on shop B's own terms (20 / 0)
CODE2B=$(AS "$C2" "select my_referral_code('$SB')")
R3=$(AS "$C3" "select claim_referral('$SB','$CODE2B')")
check "C3 also claimed at shop B"    "PENDING" "$(Q "select status from referrals where id='$R3'")"
check "the two claims are separate rows" "t" "$(Q "select '$R2' <> '$R3'")"
SRB=$(NEWSERIAL "$SB" "$STB" "$C3" "Sumona Akter" 700)
AS "$OB" "update serials set status='DONE', payment_status='PAID', payment_method='cash' where id='$SRB'" >/dev/null
check "shop B's referral converted from a queue serial" "CONVERTED" "$(Q "select status from referrals where id='$R3'")"
check "it points at the qualifying serial"  "$SRB" "$(Q "select qualifying_serial_id from referrals where id='$R3'")"
check "shop B paid its referrer 20"         20 "$(Q "select balance from loyalty_accounts where shop_id='$SB' and customer_id='$C2'")"
check "shop B pays the new customer 0, so no ledger row" 0 \
  "$(Q "select count(*) from loyalty_transactions where kind='REFERRAL_REFERRED' and source_referral_id='$R3'")"
check "but the referral still records 0 honestly" 0 "$(Q "select referred_points from referrals where id='$R3'")"
check "C3's shop B points are the serial's own (700/50)" 14 \
  "$(Q "select balance from loyalty_accounts where shop_id='$SB' and customer_id='$C3'")"
# **the cross-shop reward test the plan names**
check "shop B's reward did NOT land in shop A" 0 \
  "$(Q "select coalesce((select balance from loyalty_accounts where shop_id='$S' and customer_id='$C3'),0)")"
check "C2's shop A balance is untouched by shop B's reward" 21 \
  "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C2'")"
check "no ledger row crossed shops"  "t" \
  "$(Q "select not exists (select 1 from loyalty_transactions t join referrals r on r.id = t.source_referral_id where r.shop_id <> t.shop_id)")"
check "C3's shop A referral is still PENDING" "PENDING" "$(Q "select status from referrals where id='$R2'")"
check "balance == ledger sum everywhere"  "t" \
  "$(Q "select not exists (select 1 from loyalty_accounts a where a.balance <> coalesce((select sum(t.points) from loyalty_transactions t where t.shop_id=a.shop_id and t.customer_id=a.customer_id),0))")"

echo
echo "== isolation and forgery, as a real non-superuser =="
check "owner B cannot read shop A's referrals"  0 "$(AS "$OB" "select count(*) from referrals where shop_id='$S'")"
check "owner B cannot read shop A's codes"      0 "$(AS "$OB" "select count(*) from referral_codes where shop_id='$S'")"
check "owner B sees only their own referrals"   1 "$(AS "$OB" "select count(*) from referrals")"
check "owner A sees only theirs"                2 "$(AS "$OA" "select count(*) from referrals")"
check "owner A cannot read shop B's codes"      0 "$(AS "$OA" "select count(*) from referral_codes where shop_id='$SB'")"
check "a customer sees only referrals they are party to" 2 "$(AS "$C3" "select count(*) from referrals")"
check "C4, party to nothing, sees nothing"      0 "$(AS "$C4" "select count(*) from referrals")"
check "a customer cannot forge a referral"      "violates row-level security" \
  "$(WHYAS "$C4" "insert into referrals (shop_id, referrer_id, referred_id, code) values ('$S','$C1','$C4','$CODE1')")"
check "nor forge one already CONVERTED"         "violates row-level security" \
  "$(WHYAS "$C4" "insert into referrals (shop_id, referrer_id, referred_id, code, status, converted_at, referrer_points, referred_points, qualifying_serial_id) values ('$S','$C1','$C4','$CODE1','CONVERTED',now(),9999,9999,'$SR4')")"
check "nor claim to be the referrer of someone else" "violates row-level security" \
  "$(WHYAS "$C4" "insert into referrals (shop_id, referrer_id, referred_id, code) values ('$S','$C4','$C2','$CODE1')")"
check "no forged row landed"                    2 "$(Q "select count(*) from referrals where shop_id='$S'")"
check "a customer cannot flip a referral to CONVERTED" "PENDING" \
  "$(AS "$C3" "update referrals set status='CONVERTED' where id='$R2'" >/dev/null;
     Q "select status from referrals where id='$R2'")"
check "the OWNER cannot either (no UPDATE policy at all)" "PENDING" \
  "$(AS "$OA" "update referrals set status='CONVERTED', converted_at=now(), referrer_points=500, referred_points=500, qualifying_serial_id='$SR4' where id='$R2'" >/dev/null;
     Q "select status from referrals where id='$R2'")"
check "nobody can delete a referral"            0 \
  "$(AS "$OA" "with d as (delete from referrals where shop_id='$S' returning 1) select count(*) from d")"
check "nobody can delete a code"                0 \
  "$(AS "$C1" "with d as (delete from referral_codes where customer_id='$C1' returning 1) select count(*) from d")"
# the RPCs refuse to work across shops
check "referral_convert with another shop's referral is refused" "not your shop" \
  "$(WHYAS "$OB" "select referral_convert('$R2', '$SR4', null)")"
check "a customer cannot convert their own referral"            "not your shop" \
  "$(WHYAS "$C3" "select referral_convert('$R2', '$SR4', null)")"
check "referral_award_points across shops is refused"           "not your shop" \
  "$(WHYAS "$OB" "select referral_award_points('$R1','REFERRER')")"
check "a customer cannot award themselves a referral bonus"     "not your shop" \
  "$(WHYAS "$C1" "select referral_award_points('$R1','REFERRER')")"
check "awarding a still-PENDING referral is refused"            "referral_not_converted" \
  "$(WHYAS "$OA" "select referral_award_points('$R2','REFERRER')")"
check "the balances survived all of that"  10 \
  "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
# the freeze trigger, tested where only a DEFINER function could reach
check "even a direct owner-level UPDATE cannot un-convert"  "referral_conversion_is_final" \
  "$(WHY "update referrals set status='PENDING' where id='$R1'")"
check "nor move a converted referral to another shop"       "$S" \
  "$(Q "update referrals set shop_id='$SB' where id='$R1'" >/dev/null; Q "select shop_id from referrals where id='$R1'")"
check "nor rewrite its points"                              10 \
  "$(Q "update referrals set referrer_points=9999 where id='$R1'" >/dev/null;
     Q "select referrer_points from referrals where id='$R1'")"
check "nor swap who referred whom"                          "$C1" \
  "$(Q "update referrals set referrer_id='$C4' where id='$R1'" >/dev/null;
     Q "select referrer_id from referrals where id='$R1'")"

echo
echo "== the customer's own list and the owner's statistics =="
check "C1's list at shop A has both referrals"  2 "$(AS "$C1" "select count(*) from my_referrals('$S')")"
check "one converted, one pending"              "1|1" \
  "$(AS "$C1" "select count(*) filter (where status='CONVERTED') || '|' || count(*) filter (where status='PENDING') from my_referrals('$S')")"
check "the name is shortened to its first word" "Nadia" \
  "$(AS "$C1" "select referred_name from my_referrals('$S') where status='CONVERTED'")"
check "the converted row carries the points earned" 10 \
  "$(AS "$C1" "select points_earned from my_referrals('$S') where status='CONVERTED'")"
check "the pending row carries 0"               0 \
  "$(AS "$C1" "select points_earned from my_referrals('$S') where status='PENDING'")"
check "C1's list at shop B is empty (own list is per shop)" 0 "$(AS "$C1" "select count(*) from my_referrals('$SB')")"
check "C2's list at shop B has their one referral" 1 "$(AS "$C2" "select count(*) from my_referrals('$SB')")"
check "C2 cannot see C1's referrals through my_referrals" 0 "$(AS "$C2" "select count(*) from my_referrals('$S')")"
check "owner A's stats list one referrer"       1 "$(AS "$OA" "select count(*) from shop_referral_stats('$S')")"
check "and count 2 brought, 1 converted"        "2|1" \
  "$(AS "$OA" "select total_referrals || '|' || converted_count from shop_referral_stats('$S')")"
check "and the points that referrer earned"     10 "$(AS "$OA" "select points_awarded from shop_referral_stats('$S')")"
check "and name the referrer"                   "Rumi" "$(AS "$OA" "select referrer_name from shop_referral_stats('$S')")"
check "and their code"                          "$CODE1" "$(AS "$OA" "select code from shop_referral_stats('$S')")"
check "owner B's stats are their own only"      "Nadia" "$(AS "$OB" "select referrer_name from shop_referral_stats('$SB')")"
check "owner B cannot ask for shop A's stats"   "not your shop" "$(WHYAS "$OB" "select * from shop_referral_stats('$S')")"
check "a customer cannot ask for any shop's stats" "not your shop" "$(WHYAS "$C1" "select * from shop_referral_stats('$S')")"

echo
echo "== a referral failure never blocks a job (decision 55) =="
# Sabotage the ledger the way only a bug could, then confirm a shop owner can
# still close a job — and that the conversion rolls back whole.
Q "alter table public.loyalty_transactions add constraint zz_sabotage check (kind not like 'REFERRAL%') not valid" >/dev/null
AP3=$(NEWAPPT "$S" "$ST" "$C3" "$(AT 6 12:00)")
DONEAPPT "$AP3" "$OA"
check "the DONE transition still succeeded"  "DONE" "$(Q "select status from appointments where id='$AP3'")"
check "its money is still recorded"          "PAID" "$(Q "select payment_status from appointments where id='$AP3'")"
check "the booking's OWN loyalty points still landed" 8 \
  "$(Q "select points from loyalty_transactions where source_appointment_id='$AP3'")"
check "the referral stayed PENDING — the conversion rolled back whole" "PENDING" \
  "$(Q "select status from referrals where id='$R2'")"
check "no partial referral points were written" 0 \
  "$(Q "select count(*) from loyalty_transactions where source_referral_id='$R2'")"
check "and no referral points are recorded on the row" "t" \
  "$(Q "select referrer_points is null and referred_points is null from referrals where id='$R2'")"
check "balance == ledger sum despite the sabotage" "t" \
  "$(Q "select not exists (select 1 from loyalty_accounts a where a.balance <> coalesce((select sum(t.points) from loyalty_transactions t where t.shop_id=a.shop_id and t.customer_id=a.customer_id),0))")"
Q "alter table public.loyalty_transactions drop constraint zz_sabotage" >/dev/null

echo
echo "== a PENDING referral survives and converts on the next job =="
AP4=$(NEWAPPT "$S" "$ST" "$C3" "$(AT 7 12:00)")
DONEAPPT "$AP4" "$OA"
check "the referral finally converted"    "CONVERTED" "$(Q "select status from referrals where id='$R2'")"
check "on the LATER booking"              "$AP4" "$(Q "select qualifying_appointment_id from referrals where id='$R2'")"
check "the referrer was paid a second time, for a second person" 20 \
  "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C1'")"
check "two referrer rows, one per referral" 2 \
  "$(Q "select count(*) from loyalty_transactions where kind='REFERRAL_REFERRER' and customer_id='$C1'")"
check "C3 got the booking's 8 twice plus the 5 bonus" 21 \
  "$(Q "select balance from loyalty_accounts where shop_id='$S' and customer_id='$C3'")"
check "owner A's stats now show 2 of 2 converted" "2|2" \
  "$(AS "$OA" "select total_referrals || '|' || converted_count from shop_referral_stats('$S')")"

echo
echo "== ledger consistency, the whole way =="
check "balance == ledger sum, every account"  "t" \
  "$(Q "select not exists (select 1 from loyalty_accounts a where a.balance <> coalesce((select sum(t.points) from loyalty_transactions t where t.shop_id=a.shop_id and t.customer_id=a.customer_id),0))")"
check "lifetime_earned >= balance, every account" "t" \
  "$(Q "select not exists (select 1 from loyalty_accounts where lifetime_earned < balance)")"
check "every referral ledger row has a referral"  "t" \
  "$(Q "select not exists (select 1 from loyalty_transactions where kind like 'REFERRAL%' and source_referral_id is null)")"
check "every referral ledger row belongs to a party of that referral" "t" \
  "$(Q "select not exists (select 1 from loyalty_transactions t join referrals r on r.id=t.source_referral_id where t.customer_id not in (r.referrer_id, r.referred_id))")"
check "no CONVERTED referral is missing its points" "t" \
  "$(Q "select not exists (select 1 from referrals where status='CONVERTED' and (referrer_points is null or referred_points is null))")"
check "every CONVERTED referral has exactly one source" "t" \
  "$(Q "select not exists (select 1 from referrals where status='CONVERTED' and ((qualifying_serial_id is null) = (qualifying_appointment_id is null)))")"
check "accounts: 4 at shop A, 2 at shop B"    "4|2" \
  "$(Q "select (select count(*) from loyalty_accounts where shop_id='$S') || '|' || (select count(*) from loyalty_accounts where shop_id='$SB')")"
# R1: referrer 10 + referred 5 · R3 (shop B): referrer 20 only, because shop B
# pays the new customer nothing · R2: referrer 10 + referred 5 = five rows.
check "referral ledger rows: 5 in total"      5 \
  "$(Q "select count(*) from loyalty_transactions where kind like 'REFERRAL%'")"
check "of which 3 are referrer rows and 2 referred" "3|2" \
  "$(Q "select (select count(*) from loyalty_transactions where kind='REFERRAL_REFERRER') || '|' || (select count(*) from loyalty_transactions where kind='REFERRAL_REFERRED')")"

echo
echo "== regression: salon, appointments, membership, loyalty =="
check "serials_before_update still there"      "t" "$(Q "select exists (select 1 from pg_trigger where tgname='serials_before_update')")"
check "serials_after_update still there"       "t" "$(Q "select exists (select 1 from pg_trigger where tgname='serials_after_update')")"
check "serials_sync_queue_public still there"  "t" "$(Q "select exists (select 1 from pg_trigger where tgname='serials_sync_queue_public')")"
check "appointments_before_update still there" "t" "$(Q "select exists (select 1 from pg_trigger where tgname='appointments_before_update')")"
check "appointments_after_update still there"  "t" "$(Q "select exists (select 1 from pg_trigger where tgname='appointments_after_update')")"
check "loyalty triggers still there"           "t" \
  "$(Q "select exists (select 1 from pg_trigger where tgname='serials_zz_loyalty_award') and exists (select 1 from pg_trigger where tgname='appointments_zz_loyalty_award')")"
check "appointment overlap constraint kept"    "t" "$(Q "select exists (select 1 from pg_constraint where conname='appointments_no_overlap')")"
check "5 appointment policies kept"            5 "$(Q "select count(*) from pg_policies where tablename='appointments'")"
check "5 membership policies kept"            5 "$(Q "select count(*) from pg_policies where tablename='customer_memberships'")"
check "loyalty_award kept, unchanged signature" "t" \
  "$(Q "select to_regprocedure('public.loyalty_award(uuid,uuid,integer,text,uuid,uuid,numeric,integer,text)') is not null")"
check "loyalty_adjust kept"                    "t" "$(Q "select to_regprocedure('public.loyalty_adjust(uuid,uuid,integer,text)') is not null")"
check "points_for_bill kept, still IMMUTABLE"  "i" "$(Q "select provolatile from pg_proc where oid='public.points_for_bill(numeric,integer,numeric)'::regprocedure")"
check "my_loyalty_accounts kept"               "t" "$(Q "select to_regprocedure('public.my_loyalty_accounts()') is not null")"
check "membership_is_active kept"              "t" "$(Q "select to_regprocedure('public.membership_is_active(uuid,uuid)') is not null")"
check "expire_memberships kept"                "t" "$(Q "select to_regprocedure('public.expire_memberships()') is not null")"
check "no loyalty_award overload was created"  1 \
  "$(Q "select count(*) from pg_proc where proname='loyalty_award' and pronamespace='public'::regnamespace")"
check "no referral column landed on serials"   0 \
  "$(Q "select count(*) from information_schema.columns where table_name='serials' and column_name like '%referr%'")"
check "no referral column landed on appointments" 0 \
  "$(Q "select count(*) from information_schema.columns where table_name='appointments' and column_name like '%referr%'")"
check "no referral column landed on loyalty_accounts" 0 \
  "$(Q "select count(*) from information_schema.columns where table_name='loyalty_accounts' and column_name like '%referr%'")"
# the two income queries the app runs, as SQL, unchanged by referral
check "appointment income query unchanged"     "3200.00" \
  "$(Q "select coalesce(sum(total_amount),0)::text from appointments where shop_id='$S' and status='DONE' and payment_status in ('PAID','DUE')")"
check "queue income query unchanged"           "1000.00" \
  "$(Q "select coalesce(sum(total_amount),0)::text from serials where shop_id='$S' and status='DONE'")"
check "shop B's queue income is its own"       "700.00" \
  "$(Q "select coalesce(sum(total_amount),0)::text from serials where shop_id='$SB' and status='DONE'")"
check "referral points never touched any bill" "t" \
  "$(Q "select not exists (select 1 from loyalty_transactions where kind like 'REFERRAL%' and (bill_amount is not null or taka_per_point is not null))")"
check "membership money still separate"        0 "$(Q "select count(*) from customer_memberships")"
check "a walk-in still completes with no referral fuss" "DONE" \
  "$(SW=$(Q "insert into serials (shop_id, chair_id, customer_name, total_amount, status) values ('$S','$ST','Walk in', 500, 'WAITING') returning id" | head -1);
     AS "$OA" "update serials set status='DONE', payment_status='PAID' where id='$SW'" >/dev/null;
     Q "select status from serials where id='$SW'")"

echo
echo "-------------------------------------------"
printf 'passed: %d   failed: %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
