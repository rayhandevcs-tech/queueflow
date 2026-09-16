-- =============================================================================
-- AI Sprint 4 — two more confirmed actions on the SAME audit table
-- =============================================================================
--
-- WHAT THIS FILE DOES
--
-- Sprint 3 built `ai_actions` and one action: JOIN_QUEUE. Sprint 4 adds
-- BOOK_APPOINTMENT and REDEEM_REWARD. Everything structural it needs already
-- exists, so this file is deliberately small:
--
--   1. two new members on `ai_action_type`
--   2. five nullable columns — the parameters and results the two new actions
--      need that a queue join does not
--   3. shape constraints, so a row cannot describe two actions at once
--   4. two unique indexes, mirroring `ai_actions_one_per_serial_idx`
--   5. `ai_action_propose` and `ai_action_settle` widened
--
-- WHAT IT DELIBERATELY DOES NOT DO
--
-- There is no `ai_appointment_actions` table and no `ai_reward_actions` table.
-- One audit table with a lifecycle was the right shape in Sprint 3 and adding
-- two more of them would mean three places to ask "what did the assistant do".
--
-- There is also **no function here that books an appointment or redeems a
-- reward**, exactly as Sprint 3 contains no function that writes a serial. The
-- appointment write stays `public.book_appointment()` — SECURITY INVOKER, so
-- RLS and `appointment_before_insert` still decide — and the redemption stays
-- `public.redeem_reward()`, which already locks the reward then the account and
-- is the only door through which points are ever spent. An
-- `ai_book_appointment()` would be a second booking engine, and the day it
-- drifted from `appointment_before_insert` there would be two answers to "what
-- are the rules for taking an appointment".
--
-- The functions below still touch ONLY `public.ai_actions`.
--
-- -----------------------------------------------------------------------------
-- WHY THE SHAPE CONSTRAINTS CAST action_type TO text
-- -----------------------------------------------------------------------------
-- This is not a style choice and it is worth knowing before editing the file.
--
-- Postgres refuses to USE a newly added enum value in the same transaction that
-- added it:
--
--     ERROR:  unsafe use of new value "BOOK_APPOINTMENT" of enum type
--             ai_action_type
--     HINT:  New enum values must be committed before they can be used.
--
-- `ALTER TYPE ... ADD VALUE` itself is fine inside a transaction (PG 12+), and
-- psql running this file statement-by-statement would commit each one and never
-- notice. But the Supabase SQL editor sends a whole script as one implicit
-- transaction, and that is how this migration will actually be applied — so a
-- CHECK constraint written as `action_type = 'BOOK_APPOINTMENT'` would abort
-- the entire migration on the editor and work everywhere else, which is the
-- worst way for a problem to be discovered.
--
-- Comparing `action_type::text` sidesteps it: no enum literal is resolved, so
-- there is nothing uncommitted to use. Verified both ways against a real
-- PostgreSQL 16 cluster before this file was written, and section A of
-- `run-sprint-ai4-checks.sh` applies the file inside an explicit BEGIN/COMMIT
-- so a regression here fails a test rather than a customer's SQL editor.
--
-- plpgsql function bodies are unaffected — they are strings at CREATE time and
-- resolve at first call, which is after the commit.

-- ---------------------------------------------------------------------------
-- 1) Vocabulary
-- ---------------------------------------------------------------------------
-- Two, and exactly two. CANCEL_APPOINTMENT, RESCHEDULE_APPOINTMENT and
-- SEND_CAMPAIGN are deliberately absent: an action type that exists but has no
-- confirmed path is an invitation to wire one up casually, and the confirm
-- endpoint's `default:` branch refusing an unknown type is only a guarantee
-- while the type cannot be stored in the first place.
alter type public.ai_action_type add value if not exists 'BOOK_APPOINTMENT';
alter type public.ai_action_type add value if not exists 'REDEEM_REWARD';

-- ---------------------------------------------------------------------------
-- 2) The parameters and results the new actions need
-- ---------------------------------------------------------------------------
-- All nullable, all additive. An existing JOIN_QUEUE row is untouched and
-- still satisfies every constraint below.
alter table public.ai_actions
  -- WHICH STAFF and WHEN, for an appointment. Both come from a slot that
  -- `shop_available_slots()` actually returned — never from a time the model
  -- wrote out. `on delete set null` for the same reason `shop_id` has it: the
  -- record that the action happened must outlive the row it pointed at.
  add column if not exists staff_id uuid references public.chairs(id) on delete set null,
  add column if not exists starts_at timestamptz,

  -- WHICH REWARD, for a redemption. Scoped by `shop_id` on the same row, which
  -- is what makes "points are per business" expressible here rather than only
  -- enforced downstream.
  add column if not exists reward_id uuid references public.rewards(id) on delete set null,

  -- RESULTS. One per action type, alongside Sprint 3's `serial_id`.
  add column if not exists appointment_id uuid
    references public.appointments(id) on delete set null,
  add column if not exists redemption_id uuid
    references public.reward_redemptions(id) on delete set null;

comment on column public.ai_actions.starts_at is
  'Appointment start, from a slot shop_available_slots() returned. Never a time the model produced.';
comment on column public.ai_actions.reward_id is
  'The reward being redeemed. Always read back with shop_id — loyalty is per business.';

-- ---------------------------------------------------------------------------
-- 3) A row describes ONE action
-- ---------------------------------------------------------------------------
-- Without these, a BOOK_APPOINTMENT row could carry a `reward_id` and a
-- REDEEM_REWARD row could carry a `starts_at`, and the confirm endpoint's
-- dispatch would be the only thing keeping them apart. The database saying no
-- is worth more than every future caller remembering.
do $$
begin
  -- An appointment's two parameters travel together or not at all. A staff
  -- member with no time, or a time with no staff, is not half a booking — it
  -- is a booking nobody can revalidate.
  if not exists (select 1 from pg_constraint where conname = 'ai_actions_slot_shape') then
    alter table public.ai_actions
      add constraint ai_actions_slot_shape
      check ((staff_id is null) = (starts_at is null));
  end if;

  -- At most one result, whatever the type. Two would mean one confirmation
  -- created two things.
  if not exists (select 1 from pg_constraint where conname = 'ai_actions_one_result') then
    alter table public.ai_actions
      add constraint ai_actions_one_result
      check (num_nonnulls(serial_id, appointment_id, redemption_id) <= 1);
  end if;

  -- A result only on an executed row. `EXECUTED` is a Sprint 3 enum value, so
  -- the literal is committed and safe to name directly — unlike the two added
  -- above. Generalises `ai_actions_serial_only_when_executed`, which is left in
  -- place: it costs nothing and it is what Sprint 3's tests assert on.
  if not exists (
    select 1 from pg_constraint where conname = 'ai_actions_result_only_when_executed'
  ) then
    alter table public.ai_actions
      add constraint ai_actions_result_only_when_executed
      check (
        num_nonnulls(serial_id, appointment_id, redemption_id) = 0
        or status = 'EXECUTED'
      );
  end if;

  -- The result column has to match the action type: a JOIN_QUEUE row pointing
  -- at an appointment would make the audit actively misleading.
  if not exists (
    select 1 from pg_constraint where conname = 'ai_actions_result_matches_type'
  ) then
    alter table public.ai_actions
      add constraint ai_actions_result_matches_type
      check (
        case action_type::text
          when 'JOIN_QUEUE'       then appointment_id is null and redemption_id is null
          when 'BOOK_APPOINTMENT' then serial_id is null and redemption_id is null
          when 'REDEEM_REWARD'    then serial_id is null and appointment_id is null
          else false
        end
      );
  end if;

  -- And so do the parameters. This is the constraint that makes
  -- "a redemption has no services and an appointment has no reward" a fact
  -- about the table rather than a habit of one function.
  --
  -- Note `cardinality(service_ids) = 0` for a redemption: spending points on a
  -- coupon is not a service purchase. Sprint 3's `ai_action_services_required`
  -- lives on in `ai_action_propose` for the other two types.
  if not exists (
    select 1 from pg_constraint where conname = 'ai_actions_params_match_type'
  ) then
    alter table public.ai_actions
      add constraint ai_actions_params_match_type
      check (
        case action_type::text
          when 'JOIN_QUEUE' then
            staff_id is null and starts_at is null and reward_id is null
            and cardinality(service_ids) > 0
          when 'BOOK_APPOINTMENT' then
            staff_id is not null and starts_at is not null and reward_id is null
            and cardinality(service_ids) > 0
          when 'REDEEM_REWARD' then
            staff_id is null and starts_at is null and reward_id is not null
            and cardinality(service_ids) = 0
          else false
        end
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4) One audit row per thing created
-- ---------------------------------------------------------------------------
-- The same guarantee `ai_actions_one_per_serial_idx` gives the queue, for the
-- other two. It means a retry that somehow got past the status guard still
-- could not attach a second audit row to the same appointment or the same
-- coupon — so counting EXECUTED rows is safe. NULLs are not unique to each
-- other in Postgres, so unsettled rows are unaffected.
create unique index if not exists ai_actions_one_per_appointment_idx
  on public.ai_actions (appointment_id)
  where appointment_id is not null;

create unique index if not exists ai_actions_one_per_redemption_idx
  on public.ai_actions (redemption_id)
  where redemption_id is not null;

-- ---------------------------------------------------------------------------
-- 5) propose — widened, and now type-aware
-- ---------------------------------------------------------------------------
-- DROPPED and recreated rather than `create or replace`d, because the argument
-- list changes. Dropping a function destroys no data and the table is
-- untouched; what it does mean is that this migration must be applied whole,
-- which the verification block at the foot checks.
--
-- The three new arguments default to null, so an existing six-argument call by
-- name still resolves here. That is not laziness about the call site — it means
-- a half-deployed state (new SQL, old JavaScript) proposes a valid JOIN_QUEUE
-- rather than failing, and there is only ever ONE `ai_action_propose` so
-- PostgREST can never find the call ambiguous.
drop function if exists public.ai_action_propose(
  public.ai_action_type, uuid, uuid[], text, jsonb, integer
);

create or replace function public.ai_action_propose(
  p_action_type  public.ai_action_type,
  p_shop_id      uuid,
  p_service_ids  uuid[],
  p_nonce        text,
  p_display      jsonb,
  p_ttl_seconds  integer,
  p_staff_id     uuid default null,
  p_starts_at    timestamptz default null,
  p_reward_id    uuid default null
)
returns public.ai_actions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid  uuid := auth.uid();
  v_row  public.ai_actions;
  v_type text := p_action_type::text;
  v_svc  uuid[] := coalesce(p_service_ids, '{}'::uuid[]);
begin
  if v_uid is null then
    raise exception 'ai_action_requires_login';
  end if;

  -- Every action this app has is scoped to one business. A proposal with no
  -- shop could not be revalidated against anything, and Sprint 3's confirm
  -- endpoint already refused one — so the refusal belongs here, where it is
  -- true for all three types at once.
  if p_shop_id is null then
    raise exception 'ai_action_shop_required';
  end if;

  -- Bounded so a caller cannot mint an effectively permanent proposal. The
  -- ceiling is the point: a stale queue estimate, a slot somebody else has
  -- since taken and a points balance that has moved are all the same risk.
  if p_ttl_seconds is null or p_ttl_seconds < 30 or p_ttl_seconds > 1800 then
    raise exception 'ai_action_ttl_out_of_range';
  end if;
  if p_nonce is null or length(p_nonce) < 16 then
    raise exception 'ai_action_nonce_too_short';
  end if;

  -- Per-type shape. The table's CHECK constraints say the same thing and are
  -- the real guarantee; these raises exist so the caller gets a named reason
  -- instead of a constraint name.
  if v_type = 'REDEEM_REWARD' then
    if p_reward_id is null then
      raise exception 'ai_action_reward_required';
    end if;
    if p_staff_id is not null or p_starts_at is not null then
      raise exception 'ai_action_bad_shape';
    end if;
    -- Points buy a coupon, not a service. Anything in `service_ids` here would
    -- mean the proposal was assembled from the wrong draft.
    if cardinality(v_svc) <> 0 then
      raise exception 'ai_action_bad_shape';
    end if;

  elsif v_type = 'BOOK_APPOINTMENT' then
    if p_staff_id is null or p_starts_at is null then
      raise exception 'ai_action_slot_required';
    end if;
    -- The server's clock, not the client's. A slot already in the past cannot
    -- be confirmed later either — `appointment_before_insert` raises
    -- `appointment_in_past` — but refusing now means the customer is not shown
    -- a card for a time that has gone.
    if p_starts_at <= now() then
      raise exception 'ai_action_slot_in_past';
    end if;
    if p_reward_id is not null then
      raise exception 'ai_action_bad_shape';
    end if;
    if cardinality(v_svc) = 0 then
      raise exception 'ai_action_services_required';
    end if;

  else
    -- JOIN_QUEUE, unchanged from Sprint 3.
    if cardinality(v_svc) = 0 then
      raise exception 'ai_action_services_required';
    end if;
    if p_staff_id is not null or p_starts_at is not null or p_reward_id is not null then
      raise exception 'ai_action_bad_shape';
    end if;
  end if;

  -- Tidy this customer's abandoned proposals first, so their history says what
  -- became of them rather than leaving a row PROPOSED forever. Cheap: the
  -- partial index covers exactly this predicate.
  perform public.ai_action_expire_mine();

  insert into public.ai_actions (
    user_id, action_type, status, shop_id, service_ids, nonce, display,
    expires_at, staff_id, starts_at, reward_id
  ) values (
    v_uid, p_action_type, 'PROPOSED', p_shop_id, v_svc, p_nonce,
    coalesce(p_display, '{}'::jsonb),
    now() + make_interval(secs => p_ttl_seconds),
    p_staff_id, p_starts_at, p_reward_id
  )
  returning * into v_row;

  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- 6) settle — one result argument, and the row decides which column it is
-- ---------------------------------------------------------------------------
-- Sprint 3's version took `p_serial_id`. Three result columns could have meant
-- three arguments, but then a caller could settle a BOOK_APPOINTMENT row by
-- passing a serial id — the sort of mistake that produces an audit trail
-- quietly describing the wrong thing.
--
-- So there is ONE `p_result_id`, and the CASE below reads `action_type` off the
-- row being settled to choose its column. A caller cannot put a result in the
-- wrong place because a caller does not choose the place.
--
-- Renaming a parameter needs a DROP; `create or replace` refuses it.
drop function if exists public.ai_action_settle(
  uuid, public.ai_action_status, uuid, text
);

create or replace function public.ai_action_settle(
  p_action_id    uuid,
  p_status       public.ai_action_status,
  p_result_id    uuid,
  p_failure_code text
)
returns public.ai_actions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.ai_actions;
begin
  if v_uid is null then
    raise exception 'ai_action_requires_login';
  end if;
  if p_status not in ('EXECUTED', 'FAILED') then
    raise exception 'ai_action_bad_settle_status';
  end if;
  -- EXECUTED means something exists. Without this an action could claim to
  -- have succeeded while pointing at nothing, which is the one thing an audit
  -- row must not be able to say.
  if p_status = 'EXECUTED' and p_result_id is null then
    raise exception 'ai_action_executed_needs_result';
  end if;

  update public.ai_actions
     set status = p_status,
         serial_id = case
           when p_status = 'EXECUTED' and action_type::text = 'JOIN_QUEUE'
           then p_result_id else null end,
         appointment_id = case
           when p_status = 'EXECUTED' and action_type::text = 'BOOK_APPOINTMENT'
           then p_result_id else null end,
         redemption_id = case
           when p_status = 'EXECUTED' and action_type::text = 'REDEEM_REWARD'
           then p_result_id else null end,
         failure_code = case
           when p_status = 'FAILED'
           then left(coalesce(p_failure_code, 'UNKNOWN'), 64) else null end,
         settled_at = now()
   where id = p_action_id
     and user_id = v_uid           -- somebody else's action is invisible here
     and status = 'CONFIRMED'      -- never from PROPOSED: confirmation first
  returning * into v_row;

  if not found then
    raise exception 'ai_action_not_settleable';
  end if;

  return v_row;
end $$;

-- `ai_action_claim`, `ai_action_cancel` and `ai_action_expire_mine` are
-- unchanged and deliberately not touched. Claim returns `public.ai_actions`,
-- so the new columns appear in its result without any edit — which is the
-- reason the confirm endpoint can read `staff_id` and `reward_id` straight off
-- the claimed row rather than fetching it again.

-- ---------------------------------------------------------------------------
-- 7) EXECUTE grants
-- ---------------------------------------------------------------------------
-- The two recreated functions lost their grants with the DROP, and a fresh
-- `create function` grants EXECUTE to PUBLIC while Supabase's default
-- privileges additionally grant `anon` and `authenticated` BY NAME. So this is
-- not belt-and-braces: without it, `anon` would hold EXECUTE on both.
--
-- 20260927_function_grants.sql was written for exactly this and its lesson is
-- the reason the block is repeated here rather than assumed.
do $$
declare
  r record;
begin
  for r in
    select format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid)) as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('ai_action_propose', 'ai_action_settle')
  loop
    execute format('revoke all on function %s from public', r.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', r.sig);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- যাচাই — run these by hand after applying
-- ---------------------------------------------------------------------------
-- সব সারিতে ok = true হওয়া বাধ্যতামূলক।
--
-- select * from (values
--   ('three action types exist',
--    (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
--      where t.typname = 'ai_action_type') = 3),
--
--   ('the five new columns exist',
--    (select count(*) from information_schema.columns
--      where table_schema = 'public' and table_name = 'ai_actions'
--        and column_name in ('staff_id','starts_at','reward_id',
--                            'appointment_id','redemption_id')) = 5),
--
--   ('the five shape constraints exist',
--    (select count(*) from pg_constraint
--      where conname in ('ai_actions_slot_shape','ai_actions_one_result',
--                        'ai_actions_result_only_when_executed',
--                        'ai_actions_result_matches_type',
--                        'ai_actions_params_match_type')) = 5),
--
--   ('one audit row per appointment and per coupon',
--    (select count(*) from pg_indexes
--      where schemaname = 'public' and tablename = 'ai_actions'
--        and indexname in ('ai_actions_one_per_appointment_idx',
--                          'ai_actions_one_per_redemption_idx')) = 2),
--
--   ('still exactly one ai_action_propose and one ai_action_settle',
--    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public'
--        and p.proname in ('ai_action_propose','ai_action_settle')) = 2),
--
--   ('all five lifecycle functions are still DEFINER',
--    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.prosecdef
--        and p.proname like 'ai_action_%') = 5),
--
--   ('ai_actions still has no write policy',
--    (select count(*) from pg_policies
--      where schemaname = 'public' and tablename = 'ai_actions'
--        and cmd <> 'SELECT') = 0),
--
--   ('no ai_action_* function writes an appointment, a redemption or a serial',
--    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname like 'ai_action_%'
--        and (pg_get_functiondef(p.oid) ilike '%insert into public.serials%'
--          or pg_get_functiondef(p.oid) ilike '%insert into public.appointments%'
--          or pg_get_functiondef(p.oid) ilike '%public.reward_redemptions%'
--          or pg_get_functiondef(p.oid) ilike '%public.loyalty_accounts%')) = 0),
--
--   ('the booking engines are untouched and still where they were',
--    to_regprocedure('public.book_appointment(uuid,uuid,uuid[],timestamptz,text,text,boolean,text)') is not null
--      and to_regprocedure('public.redeem_reward(uuid,uuid)') is not null),
--
--   ('book_appointment is still INVOKER, so RLS still applies',
--    (select not prosecdef from pg_proc
--      where oid = 'public.book_appointment(uuid,uuid,uuid[],timestamptz,text,text,boolean,text)'::regprocedure)),
--
--   ('anon cannot execute the lifecycle functions',
--    not exists (
--      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public' and p.proname like 'ai_action_%'
--         and has_function_privilege('anon', p.oid, 'execute'))),
--
--   ('no rows lost',
--    (select count(*) >= 0 from public.ai_actions))
-- ) as t(check_name, ok) order by check_name;
--
--
-- ---------------------------------------------------------------------------
-- আচরণগত পরীক্ষা — এগুলো **ব্যর্থ হওয়ার কথা**
-- ---------------------------------------------------------------------------
-- প্রতিটা আলাদা করে চালাও। লগইন করা অবস্থায় চালাতে হবে (SQL এডিটর
-- service_role-এ চলে, তাই auth.uid() null — তখন `ai_action_requires_login`
-- আসবে, সেটাও একটা বৈধ ফল)।
--
-- ১) অ্যাপয়েন্টমেন্টের স্লট ছাড়া প্রস্তাব → ai_action_slot_required
--
-- select public.ai_action_propose('BOOK_APPOINTMENT', gen_random_uuid(),
--   array[gen_random_uuid()], repeat('a', 24), '{}'::jsonb, 300);
--
-- ২) অতীতের স্লট → ai_action_slot_in_past
--
-- select public.ai_action_propose('BOOK_APPOINTMENT', gen_random_uuid(),
--   array[gen_random_uuid()], repeat('a', 24), '{}'::jsonb, 300,
--   gen_random_uuid(), now() - interval '1 hour');
--
-- ৩) রিওয়ার্ড ছাড়া রিডেম্পশন → ai_action_reward_required
--
-- select public.ai_action_propose('REDEEM_REWARD', gen_random_uuid(),
--   '{}'::uuid[], repeat('a', 24), '{}'::jsonb, 300);
--
-- ৪) রিডেম্পশনে সার্ভিস → ai_action_bad_shape
--
-- select public.ai_action_propose('REDEEM_REWARD', gen_random_uuid(),
--   array[gen_random_uuid()], repeat('a', 24), '{}'::jsonb, 300,
--   null, null, gen_random_uuid());
--
-- ৫) সরাসরি সারি বসানো → RLS আটকাবে (new row violates row-level security)
--
-- insert into public.ai_actions (user_id, action_type, shop_id, service_ids,
--   nonce, expires_at) values (auth.uid(), 'BOOK_APPOINTMENT',
--   gen_random_uuid(), '{}'::uuid[], repeat('a', 24), now() + interval '5 min');
