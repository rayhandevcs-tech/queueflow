-- =============================================================================
-- AI Sprint 3 — the audit trail for AI-initiated actions
-- =============================================================================
--
-- WHAT THIS TABLE IS
--
-- Sprint 3 gives the customer assistant its first ability to change something:
-- joining a salon queue. This table is what makes that accountable, and it is
-- doing three jobs at once — deliberately, because they are the same job:
--
--   1. AUDIT.     Who asked for what, where, when, and what happened.
--   2. PROPOSAL.  The description of the action a customer is being asked to
--                 confirm, held server-side so the confirmation cannot be
--                 assembled by the client.
--   3. REPLAY GUARD. The row's own status is the thing that makes a second
--                 confirmation a no-op rather than a second booking.
--
-- Splitting these into a proposals table and an actions table was the first
-- design, and it was wrong: two rows per action that must agree, with a window
-- in which they do not. One row with a lifecycle has no such window.
--
-- WHAT THIS TABLE IS NOT
--
-- It is NOT a way to join a queue. There is no function here that inserts a
-- serial, and there must never be. The queue write stays exactly where it
-- already is — a plain INSERT into `public.serials`, under the
-- `serials: customer insert` policy, through the BEFORE INSERT trigger that
-- assigns the chair, prices the services and computes the position. A
-- SECURITY DEFINER "ai_join_queue()" would move the queue's authority out of
-- the queue engine and into a function written for the convenience of one
-- caller, and the day it drifted from the trigger there would be two answers
-- to "what are the rules for taking a serial".
--
-- The five functions below touch ONLY this table. Each one re-checks
-- `auth.uid()` and each one is a single guarded UPDATE or INSERT.
--
-- It is also NOT a conversation log. No prompt, no transcript, no message text,
-- no API key. What is stored is the shape of an action: ids, a display snapshot
-- of the figures the customer was shown, and an outcome.
--
-- WHY THERE IS NO CLIENT WRITE POLICY
--
-- The table has SELECT for its owner and no INSERT, UPDATE or DELETE policy for
-- anybody. That is not an omission. With RLS enabled and no policy, a write
-- from the browser or from a cookie-bound server client is refused outright, so
-- `status = 'EXECUTED'` is not something a customer can set by calling the REST
-- API directly — it is unreachable except through `ai_action_settle()`, which
-- only moves a row that is already CONFIRMED and only for its own owner.
--
-- The alternative was a policy pair in the style of `serials: customer cancel
-- own` (USING on the old row, WITH CHECK on the new one). That would work for
-- PROPOSED → CONFIRMED, but it would also hand the client a write surface on an
-- audit table, and an audit table the audited party can write to is worth
-- rather less.

-- ---------------------------------------------------------------------------
-- 1) Vocabulary
-- ---------------------------------------------------------------------------

-- One action type this sprint. The enum exists so that Sprint 4's appointment
-- and reward actions are an ALTER TYPE rather than a text column nobody
-- validates — and so that a stray value cannot be stored at all.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_action_type') then
    create type public.ai_action_type as enum ('JOIN_QUEUE');
  end if;
end $$;

-- The lifecycle. Every transition is enforced by one of the functions below;
-- the enum only says which words exist.
--
--   PROPOSED   created by the assistant, shown to the customer, nothing written
--   CONFIRMED  the customer pressed confirm; claimed, exactly once
--   EXECUTED   the serial exists
--   CANCELLED  the customer said no
--   EXPIRED    the customer never answered in time
--   FAILED     confirmed, revalidated, and the queue still refused it
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_action_status') then
    create type public.ai_action_status as enum (
      'PROPOSED', 'CONFIRMED', 'EXECUTED', 'CANCELLED', 'EXPIRED', 'FAILED'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) The table
-- ---------------------------------------------------------------------------

create table if not exists public.ai_actions (
  id uuid primary key default gen_random_uuid(),

  -- WHO. The authenticated customer, always — never a value the model
  -- supplied, and never a value the client sent. `ai_action_propose()` writes
  -- `auth.uid()` here and nothing else can write the column at all.
  user_id uuid not null references auth.users(id) on delete cascade,

  action_type public.ai_action_type not null,
  status public.ai_action_status not null default 'PROPOSED',

  -- WHERE. Nullable FKs with ON DELETE SET NULL: an audit row must survive the
  -- shop closing its account, and losing the reference is better than losing
  -- the record that the action happened.
  shop_id uuid references public.shops(id) on delete set null,

  -- WHAT. The services asked for, as ids. Not a FK array (Postgres has no such
  -- thing) — the authoritative check that these belong to the shop and are
  -- active happens in `serial_before_insert`, at the moment of the write, which
  -- is the only moment when the answer is not already stale.
  service_ids uuid[] not null default '{}',

  -- A proof-of-read, alongside RLS rather than instead of it.
  --
  -- RLS is what stops one customer touching another's proposal, and
  -- `ai_action_claim()` re-checks the owner besides. The nonce adds a second
  -- factor for the case where an id leaks but the row was never readable: a
  -- guessed uuid is not enough, you must have actually read the row. Cheap,
  -- and it costs nothing to keep.
  nonce text not null,

  -- What the customer was SHOWN, frozen. Never what they are charged.
  --
  -- The distinction matters enough to spell out: the price on the confirmation
  -- card comes from here, and the price actually recorded against the serial is
  -- computed by `serial_before_insert` from `services.rate` at insert time. If
  -- a shop reprices between the proposal and the confirmation, the customer is
  -- billed the shop's current rate, not the number in this column. This column
  -- exists so that "what were they looking at when they agreed?" has an answer.
  display jsonb not null default '{}'::jsonb,

  -- WHEN.
  created_at timestamptz not null default now(),
  -- Short by design: the figures inside `display` are a live queue's, and a
  -- confirmation screen that is an hour old is describing a shop that has moved
  -- on. See `AI_PROPOSAL_TTL_SECONDS` in src/lib/ai/proposals.ts — the two are
  -- kept in step, and the database is the one that decides.
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  settled_at timestamptz,

  -- RESULT.
  serial_id uuid references public.serials(id) on delete set null,
  -- A short code, never a Postgres message. `translateDbError()` already turns
  -- a constraint name into a sentence for the customer; what is stored here is
  -- the code that sentence was chosen from, so the audit says "why" without
  -- keeping a copy of the database's internals.
  failure_code text,

  -- A settled row must say how it settled, and an unsettled one must not
  -- pretend to. Without this, a bug that forgot to stamp `settled_at` would
  -- leave a row that reads as executed at no particular time.
  constraint ai_actions_settled_shape check (
    (status in ('EXECUTED', 'FAILED') and settled_at is not null)
    or (status not in ('EXECUTED', 'FAILED') and settled_at is null)
  ),
  -- Only an executed action may point at a serial. A CANCELLED row carrying a
  -- serial_id would be a contradiction, and this is cheaper than trusting every
  -- future caller not to write one.
  constraint ai_actions_serial_only_when_executed check (
    serial_id is null or status = 'EXECUTED'
  )
);

comment on table public.ai_actions is
  'Audit trail and confirmation store for AI-initiated customer actions. '
  'Not a queue-writing path: the serial insert stays in public.serials under its own RLS.';

-- ---------------------------------------------------------------------------
-- 3) Indexes
-- ---------------------------------------------------------------------------

-- The customer's own history, newest first — the only listing this table has.
create index if not exists ai_actions_user_created_idx
  on public.ai_actions (user_id, created_at desc);

-- Finding the live proposals for a customer, which is what the confirm path
-- and any "you have something waiting" check ask for. Partial, because a
-- settled row is never the answer to that question and there will be far more
-- settled rows than open ones.
create index if not exists ai_actions_open_idx
  on public.ai_actions (user_id, expires_at)
  where status in ('PROPOSED', 'CONFIRMED');

-- One audit row per serial. This is a real guarantee, not bookkeeping: it means
-- a retry that somehow got past the status guard still could not attach a
-- second audit row to the same booking, so the count of EXECUTED rows for a
-- shop can be trusted. NULLs are not unique to each other in Postgres, so every
-- unsettled row is unaffected.
create unique index if not exists ai_actions_one_per_serial_idx
  on public.ai_actions (serial_id)
  where serial_id is not null;

-- ---------------------------------------------------------------------------
-- 4) RLS — read your own, write nothing
-- ---------------------------------------------------------------------------

alter table public.ai_actions enable row level security;

-- The customer reads their own rows. That is what lets the confirmation card
-- render from the database rather than from a payload the client was handed,
-- so the figures on the card are the figures the server stored.
drop policy if exists "ai_actions: read own" on public.ai_actions;
create policy "ai_actions: read own" on public.ai_actions
  for select to authenticated
  using (user_id = auth.uid());

-- Deliberately absent, and each absence is a decision:
--
--   * no INSERT/UPDATE/DELETE policy for anyone — every transition goes through
--     the functions below, so `status = 'EXECUTED'` cannot be written from
--     outside them;
--   * no owner read policy. A shopkeeper can see the serial in their queue,
--     which is the part that concerns them. Whether a customer arrived by
--     tapping a button or by asking an assistant is the customer's business,
--     and a per-customer log of what they said to an AI is not something a
--     shop should be able to page through. Sprint 3's brief asks for exactly
--     this, and the shape of the table makes it the default rather than a rule
--     somebody has to remember;
--   * no admin read policy. When an admin genuinely needs this it should
--     arrive as its own change, gated on `admin_can(...)` like the rest of the
--     panel, and be visible in a diff. Granting it now "just in case" is how a
--     support tool becomes a surveillance tool.

-- ---------------------------------------------------------------------------
-- 5) The lifecycle — five functions, each one a guarded UPDATE or INSERT
-- ---------------------------------------------------------------------------
--
-- All five are SECURITY DEFINER, which needs justifying every time it is used.
-- Here the reason is narrow: the table has no write policy, so a transition has
-- to run as the owner of these functions. What keeps that safe is that each
-- function
--
--   * re-derives the actor from `auth.uid()` and refuses if it is null,
--   * matches on `user_id = auth.uid()` so it can only ever touch the caller's
--     own row,
--   * requires a specific current status, so the legal transitions are the only
--     ones expressible, and
--   * touches no table other than `public.ai_actions`.
--
-- None of them can create, modify or cancel a serial. The queue is untouched by
-- this file.

-- ------------------------------ propose ------------------------------------
-- Creates the row the customer will be shown. Writing nothing but this table,
-- and stamping `user_id` from the session so the caller cannot name anybody.
create or replace function public.ai_action_propose(
  p_action_type  public.ai_action_type,
  p_shop_id      uuid,
  p_service_ids  uuid[],
  p_nonce        text,
  p_display      jsonb,
  p_ttl_seconds  integer
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
  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    raise exception 'ai_action_services_required';
  end if;
  -- Bounded so a caller cannot mint an effectively permanent proposal. The
  -- ceiling is the point: stale queue figures are the risk this whole
  -- expiry mechanism exists to limit.
  if p_ttl_seconds is null or p_ttl_seconds < 30 or p_ttl_seconds > 1800 then
    raise exception 'ai_action_ttl_out_of_range';
  end if;
  if p_nonce is null or length(p_nonce) < 16 then
    raise exception 'ai_action_nonce_too_short';
  end if;

  -- Tidy this customer's abandoned proposals first, so their history says what
  -- became of them rather than leaving a row PROPOSED forever. Cheap: the
  -- partial index covers exactly this predicate.
  perform public.ai_action_expire_mine();

  insert into public.ai_actions (
    user_id, action_type, status, shop_id, service_ids, nonce, display, expires_at
  ) values (
    v_uid, p_action_type, 'PROPOSED', p_shop_id, p_service_ids, p_nonce,
    coalesce(p_display, '{}'::jsonb), now() + make_interval(secs => p_ttl_seconds)
  )
  returning * into v_row;

  return v_row;
end $$;

-- ---------------------------- expire mine ----------------------------------
-- Sweep the caller's own lapsed proposals to EXPIRED.
--
-- This function exists because of a real and slightly counter-intuitive
-- constraint: inside plpgsql, a `raise` aborts the surrounding transaction, so
-- an UPDATE performed just before raising is rolled back with it. The first
-- version of `ai_action_claim()` below marked a lapsed row EXPIRED and then
-- raised `ai_action_expired` — and the mark never survived. The harness caught
-- it (check D6), which is the entire argument for having a harness: the code
-- read perfectly well.
--
-- So expiry is a separate, non-raising statement. The confirm endpoint calls
-- this before claiming, and `ai_action_propose()` calls it too, which makes the
-- sweep self-healing: a customer who abandons a proposal has it tidied the next
-- time they ask for another, whether or not anything ever calls this directly.
--
-- Returns how many rows it moved, so a caller can tell "nothing to do" from
-- "your proposal was one of them".
create or replace function public.ai_action_expire_mine()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then
    raise exception 'ai_action_requires_login';
  end if;

  update public.ai_actions
     set status = 'EXPIRED'
   where user_id = v_uid
     and status = 'PROPOSED'
     and expires_at <= now();

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ------------------------------- claim -------------------------------------
-- PROPOSED → CONFIRMED, exactly once.
--
-- This single UPDATE is the replay guard, and it is worth being precise about
-- why it is enough. Two confirmations arriving together both run
-- `update ... where status = 'PROPOSED'`; the second blocks on the first's row
-- lock, then re-evaluates its WHERE against the committed new value, finds
-- CONFIRMED, and updates nothing. `not found` then raises. So "claimed twice"
-- is not a race that needs a lock of its own — it is a row that can only be
-- moved off PROPOSED once.
create or replace function public.ai_action_claim(
  p_action_id uuid,
  p_nonce     text
)
returns public.ai_actions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.ai_actions;
  v_cur public.ai_actions;
begin
  if v_uid is null then
    raise exception 'ai_action_requires_login';
  end if;

  update public.ai_actions
     set status = 'CONFIRMED', confirmed_at = now()
   where id = p_action_id
     and user_id = v_uid           -- somebody else's proposal is invisible here
     and nonce = p_nonce
     and status = 'PROPOSED'
     and expires_at > now()
  returning * into v_row;

  if found then
    return v_row;
  end if;

  -- It did not claim. Say why, in the vocabulary the endpoint maps to a
  -- message — and mark a lapsed proposal EXPIRED on the way past, so the
  -- customer's history shows what became of it rather than leaving it
  -- PROPOSED forever.
  select * into v_cur
    from public.ai_actions
   where id = p_action_id and user_id = v_uid;

  if not found then
    -- Wrong owner and non-existent are the same answer on purpose. "That is
    -- somebody else's" confirms the id is real.
    raise exception 'ai_action_not_found';
  end if;

  if v_cur.nonce <> p_nonce then
    raise exception 'ai_action_nonce_mismatch';
  end if;

  -- Still PROPOSED but past its expiry. The raise below would roll back any
  -- UPDATE attempted here, so the marking is NOT done inline — see
  -- `ai_action_expire_mine()`, which the endpoint calls before this.
  if v_cur.status = 'PROPOSED' and v_cur.expires_at <= now() then
    raise exception 'ai_action_expired';
  end if;

  if v_cur.status = 'EXECUTED' then
    raise exception 'ai_action_already_executed';
  end if;
  if v_cur.status = 'CANCELLED' then
    raise exception 'ai_action_cancelled';
  end if;
  if v_cur.status = 'EXPIRED' then
    raise exception 'ai_action_expired';
  end if;
  -- CONFIRMED or FAILED: it has already been through the gate once.
  raise exception 'ai_action_not_claimable';
end $$;

-- ------------------------------ settle -------------------------------------
-- CONFIRMED → EXECUTED or FAILED. The only way `EXECUTED` is ever written.
create or replace function public.ai_action_settle(
  p_action_id    uuid,
  p_status       public.ai_action_status,
  p_serial_id    uuid,
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
  if p_status = 'EXECUTED' and p_serial_id is null then
    raise exception 'ai_action_executed_needs_serial';
  end if;

  update public.ai_actions
     set status       = p_status,
         serial_id    = case when p_status = 'EXECUTED' then p_serial_id else null end,
         failure_code = case when p_status = 'FAILED' then left(coalesce(p_failure_code, 'UNKNOWN'), 64) else null end,
         settled_at   = now()
   where id = p_action_id
     and user_id = v_uid
     and status = 'CONFIRMED'     -- never from PROPOSED: confirmation first
  returning * into v_row;

  if not found then
    raise exception 'ai_action_not_settleable';
  end if;

  return v_row;
end $$;

-- ------------------------------ cancel -------------------------------------
-- PROPOSED → CANCELLED. The customer said no; nothing else happens.
create or replace function public.ai_action_cancel(p_action_id uuid)
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

  update public.ai_actions
     set status = 'CANCELLED'
   where id = p_action_id
     and user_id = v_uid
     and status = 'PROPOSED'
  returning * into v_row;

  if not found then
    raise exception 'ai_action_not_cancellable';
  end if;

  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- 6) EXECUTE grants
-- ---------------------------------------------------------------------------
-- `create function` grants EXECUTE to PUBLIC, and Supabase's default privileges
-- additionally grant `anon` and `authenticated` BY NAME — so revoking from
-- public alone leaves both roles holding it. 20260927_function_grants.sql was
-- written for exactly this, and its lesson applies here.
--
-- These five need `authenticated` (every one of them refuses a null
-- `auth.uid()` in its first statement), and nothing needs `anon`.
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
       and p.proname in ('ai_action_propose', 'ai_action_claim',
                         'ai_action_settle', 'ai_action_cancel',
                         'ai_action_expire_mine')
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
-- ১) টেবিল আর enum বসেছে (true আসার কথা):
--
--    select to_regclass('public.ai_actions') is not null
--       and exists (select 1 from pg_type where typname = 'ai_action_status') as ok;
--
-- ২) RLS চালু, আর লেখার কোনো পলিসি নেই (select_only = true আসার কথা):
--
--    select c.relrowsecurity
--       and count(*) filter (where p.cmd <> 'SELECT') = 0 as select_only
--      from pg_class c
--      left join pg_policies p on p.tablename = 'ai_actions'
--     where c.oid = 'public.ai_actions'::regclass
--     group by c.relrowsecurity;
--
-- ৩) পাঁচটা ফাংশন আছে আর সবগুলো DEFINER (৫ আসার কথা):
--
--    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.prosecdef
--       and p.proname like 'ai_action_%';   -- ৫ আসার কথা
--
-- ৪) এই ফাইলে সিরিয়াল লেখার কিছু নেই (০ আসার কথা):
--
--    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname like 'ai_action_%'
--       and pg_get_functiondef(p.oid) ilike '%insert into public.serials%';
