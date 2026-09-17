-- =============================================================================
-- AI Sprint 5 — retention segments and the owner-approved campaign
-- =============================================================================
--
-- Run this AFTER 20261001_ai_actions_sprint4.sql.
--
-- WHAT THIS FILE DOES
--
--   1. one new member on `ai_action_type` — SEND_CAMPAIGN, and only that
--   2. six nullable campaign columns on `ai_actions`
--   3. the two Sprint 4 shape CHECKs rebuilt with a SEND_CAMPAIGN branch,
--      plus three new ones
--   4. `shop_segment_summary`, `shop_segment_members`, `shop_segment_insights`
--      and `shop_campaign_recipients` — the deterministic segmentation layer
--   5. `broadcast_campaign` — a recipient-snapshot sibling of the existing
--      `broadcast_shop_notification`, sharing its table, its type, its opt-out
--      filter, its owner check and its daily budget
--   6. a unique index that makes a double send physically impossible
--   7. `ai_action_propose`, `ai_action_settle` widened, and one new
--      `ai_action_apply_campaign_edit`
--
-- WHAT IT DELIBERATELY DOES NOT DO
--
-- There is no `ai_campaigns` table, no `campaign_recipients` child table and no
-- second audit trail. One `ai_actions` row with a lifecycle was the right shape
-- in Sprint 3 and remains so; three parallel tables would mean three places to
-- ask "what did the assistant do".
--
-- There is **no function here that can send a campaign without an approved
-- proposal**. `broadcast_campaign` takes an `ai_actions` id, and refuses unless
-- that row is a CONFIRMED SEND_CAMPAIGN belonging to the caller, for the shop
-- the caller owns, whose stored recipient snapshot is exactly the set being
-- sent to. There is no "send to this segment" entry point, and no scheduler.
--
-- There is also no predictive anything. Every segment below is a `WHERE` clause
-- over rows that already exist. No score, no probability, no model — which is
-- the point: the owner is told "no completed visit since this date", which is a
-- fact, rather than "likely to churn", which would be a guess wearing a number.
--
-- -----------------------------------------------------------------------------
-- WHY THE SHAPE CONSTRAINTS CAST action_type TO text
-- -----------------------------------------------------------------------------
-- Same reason as Sprint 4, and it applies again to the new value. Postgres
-- refuses to USE a newly added enum value in the transaction that added it:
--
--     ERROR:  unsafe use of new value "SEND_CAMPAIGN" of enum type
--             ai_action_type
--     HINT:  New enum values must be committed before they can be used.
--
-- The Supabase SQL editor sends a script as one implicit transaction, which is
-- how this file will actually be applied, so `action_type = 'SEND_CAMPAIGN'` in
-- a CHECK would abort the whole migration there while working fine under psql.
-- Every comparison below is against `action_type::text`. plpgsql bodies are
-- unaffected — they are strings at CREATE time and resolve at first call.
--
-- This matters more here than in Sprint 4, because this migration REBUILDS two
-- existing constraints. Their `else false` branch means an unmodified
-- `ai_actions_params_match_type` would reject every SEND_CAMPAIGN row, so the
-- drop-and-recreate is not optional — and a half-applied migration would leave
-- the table unable to store the action the rest of the sprint proposes. Section
-- A of `run-sprint-ai5-checks.sh` applies this file inside one explicit
-- BEGIN/COMMIT so a regression fails a test rather than a customer's editor.

-- ---------------------------------------------------------------------------
-- 1) Vocabulary
-- ---------------------------------------------------------------------------
-- One, and exactly one. AUTO_SEND, SCHEDULE_CAMPAIGN, CANCEL_CAMPAIGN,
-- BULK_MESSAGE and SMART_BLAST are deliberately absent. An action type that
-- exists without a confirmed path is an invitation to wire one up casually, and
-- the confirm endpoint's `default:` refusing an unknown type is only a
-- guarantee while the type cannot be stored in the first place.
--
-- Note what SEND_CAMPAIGN is not: it is not "send". It is "the owner has been
-- shown a specific message, a specific audience and a specific count, and has
-- pressed a button". The send is the consequence of that row reaching
-- CONFIRMED, and nothing else in this schema can produce one.
alter type public.ai_action_type add value if not exists 'SEND_CAMPAIGN';

-- ---------------------------------------------------------------------------
-- 2) The parameters and result a campaign needs
-- ---------------------------------------------------------------------------
-- All nullable, all additive. Every existing row is untouched and still
-- satisfies every constraint below.
alter table public.ai_actions
  -- WHICH SEGMENT, and the window it was computed over. Stored so the
  -- revalidation at send time can recompute the same set — and so the audit can
  -- answer "why these customers" without anybody re-deriving it.
  --
  -- `text` rather than an enum on purpose: the segment vocabulary lives in
  -- `src/lib/ai/segments.ts` and in the function below, and a third copy as a
  -- Postgres type would be one more thing to keep in step for no extra
  -- guarantee. The CHECK below pins the list.
  add column if not exists campaign_segment text,
  add column if not exists campaign_since date,

  -- WHO. The recipient snapshot — §16's "deterministic recipient snapshot",
  -- literally. Not a segment name to be re-derived at send time: this array IS
  -- the set of people who will be messaged, frozen at the moment the owner was
  -- shown a count.
  --
  -- Not a FK array (Postgres has no such thing). `broadcast_campaign` re-checks
  -- every id against the shop's own customers at send time, which is the check
  -- that actually matters — a uuid in this column is a claim, not a permission.
  add column if not exists campaign_recipients uuid[],

  -- WHAT. The text the owner was shown, and after an edit, the text that was
  -- actually sent — `ai_action_apply_campaign_edit` overwrites these, so this
  -- pair always describes what went out. The ORIGINAL model draft survives in
  -- `display`, so both are recorded and neither has to be inferred.
  add column if not exists campaign_title text,
  add column if not exists campaign_body text,

  -- RESULT. A campaign creates N notification rows, not one row, so there is no
  -- id to point at the way `serial_id` points at a serial. The count is the
  -- result, and `campaign_send_count()` below can recount it from the
  -- notifications themselves — so this column is a convenience, not the only
  -- record.
  add column if not exists campaign_sent_count integer;

comment on column public.ai_actions.campaign_recipients is
  'The frozen recipient snapshot. Exactly who will be messaged, decided server-side '
  'at propose time. Never model-supplied, and re-verified against the shop at send time.';
comment on column public.ai_actions.campaign_segment is
  'Which deterministic segment produced the snapshot. An explanation, not the audience.';
comment on column public.ai_actions.campaign_sent_count is
  'How many notifications the approved send actually inserted. Null until EXECUTED.';

-- ---------------------------------------------------------------------------
-- 3) A row still describes ONE action
-- ---------------------------------------------------------------------------
do $$
begin
  -- ---- rebuilt: the result column must match the action type ----------------
  -- Sprint 4's version has `else false`, so it rejects SEND_CAMPAIGN outright.
  -- Dropped and recreated with the new branch. Dropping a CHECK destroys no
  -- data, and the recreate re-validates every existing row.
  alter table public.ai_actions drop constraint if exists ai_actions_result_matches_type;
  alter table public.ai_actions
    add constraint ai_actions_result_matches_type
    check (
      case action_type::text
        when 'JOIN_QUEUE'       then appointment_id is null and redemption_id is null
                                 and campaign_sent_count is null
        when 'BOOK_APPOINTMENT' then serial_id is null and redemption_id is null
                                 and campaign_sent_count is null
        when 'REDEEM_REWARD'    then serial_id is null and appointment_id is null
                                 and campaign_sent_count is null
        -- A campaign creates no row of its own, so all three id columns stay
        -- null and the count carries the result instead.
        when 'SEND_CAMPAIGN'    then serial_id is null and appointment_id is null
                                 and redemption_id is null
        else false
      end
    );

  -- ---- rebuilt: and so do the parameters -----------------------------------
  -- This is the constraint that makes "a campaign has no services, no slot and
  -- no reward, and every other action has no campaign fields" a fact about the
  -- table rather than a habit of one function.
  alter table public.ai_actions drop constraint if exists ai_actions_params_match_type;
  alter table public.ai_actions
    add constraint ai_actions_params_match_type
    check (
      case action_type::text
        when 'JOIN_QUEUE' then
          staff_id is null and starts_at is null and reward_id is null
          and cardinality(service_ids) > 0
          and campaign_segment is null and campaign_recipients is null
          and campaign_title is null and campaign_body is null
          and campaign_since is null
        when 'BOOK_APPOINTMENT' then
          staff_id is not null and starts_at is not null and reward_id is null
          and cardinality(service_ids) > 0
          and campaign_segment is null and campaign_recipients is null
          and campaign_title is null and campaign_body is null
          and campaign_since is null
        when 'REDEEM_REWARD' then
          staff_id is null and starts_at is null and reward_id is not null
          and cardinality(service_ids) = 0
          and campaign_segment is null and campaign_recipients is null
          and campaign_title is null and campaign_body is null
          and campaign_since is null
        when 'SEND_CAMPAIGN' then
          -- No slot, no reward, no services: a campaign is not a purchase.
          staff_id is null and starts_at is null and reward_id is null
          and cardinality(service_ids) = 0
          -- And all four campaign parameters present. A proposal missing any
          -- one of them could not be revalidated, shown honestly, or sent.
          and campaign_segment is not null
          and campaign_recipients is not null
          and cardinality(campaign_recipients) > 0
          and campaign_title is not null and length(btrim(campaign_title)) > 0
          and campaign_body is not null and length(btrim(campaign_body)) > 0
        else false
      end
    );

  -- ---- new: the segment vocabulary is closed -------------------------------
  -- Six segments, named here as well as in TypeScript. A seventh cannot be
  -- stored until somebody adds it in both places, which is the review moment
  -- this constraint exists to force.
  if not exists (
    select 1 from pg_constraint where conname = 'ai_actions_campaign_segment_known'
  ) then
    alter table public.ai_actions
      add constraint ai_actions_campaign_segment_known
      check (
        campaign_segment is null
        or campaign_segment in (
          'REGULARS', 'HIGH_FREQUENCY', 'RECENT',
          'LAPSED', 'MEMBERS', 'LOYALTY_ENGAGED'
        )
      );
  end if;

  -- ---- new: bounded content and a bounded audience -------------------------
  -- §25's abuse protection, in the table. A 40kB notification body and a
  -- 50,000-recipient blast are both refused here, not only in the layer that
  -- happens to be calling.
  --
  -- The recipient floor is 3 and it is a judgement, recorded as one: a
  -- broadcast is written for a group, and with one or two people the owner
  -- should use the shop's own messaging rather than a promotional blast
  -- addressed to nobody in particular.
  if not exists (
    select 1 from pg_constraint where conname = 'ai_actions_campaign_bounds'
  ) then
    alter table public.ai_actions
      add constraint ai_actions_campaign_bounds
      check (
        (campaign_title is null or length(campaign_title) <= 80)
        and (campaign_body is null or length(campaign_body) <= 500)
        and (
          campaign_recipients is null
          or (
            cardinality(campaign_recipients) >= 3
            and cardinality(campaign_recipients) <= 500
          )
        )
      );
  end if;

  -- ---- new: a send count only on an executed campaign ----------------------
  -- Mirrors `ai_actions_result_only_when_executed` for the count. Without it a
  -- FAILED row could carry "sent 43", which is the one thing an audit row must
  -- not be able to say.
  --
  -- `>= 0` rather than `> 0`: a campaign whose entire audience muted
  -- promotions between the proposal and the send genuinely sent zero, and
  -- recording that honestly is better than refusing to record it.
  if not exists (
    select 1 from pg_constraint where conname = 'ai_actions_campaign_count_shape'
  ) then
    alter table public.ai_actions
      add constraint ai_actions_campaign_count_shape
      check (
        campaign_sent_count is null
        or (status = 'EXECUTED' and campaign_sent_count >= 0)
      );
  end if;
end $$;

-- An owner's campaign history, newest first. The existing
-- `ai_actions_user_created_idx` already covers `(user_id, created_at desc)`, so
-- this partial index exists only for the "has this shop sent one today" and
-- "what has this shop sent" questions, which filter by shop.
create index if not exists ai_actions_campaign_shop_idx
  on public.ai_actions (shop_id, created_at desc)
  where campaign_segment is not null;

-- ---------------------------------------------------------------------------
-- 4) One notification per campaign per person — enforced by the database
-- ---------------------------------------------------------------------------
-- This is the guarantee §17 asks for, and it is worth being precise about what
-- it adds over `ai_action_claim()`.
--
-- The claim is the primary duplicate-send guard: PROPOSED → CONFIRMED happens
-- once, atomically, and only the winner reaches the send. That is enough in
-- every ordinary case, including a double-tapped button.
--
-- What the claim cannot cover is a send that is RETRIED after its transaction's
-- outcome became unknown — a dropped connection, a timeout, a process killed
-- between the insert and the reply. There the application genuinely does not
-- know whether the notifications exist. This index answers that question with
-- the database rather than with a guess: a second insert for the same
-- (campaign, recipient) pair cannot happen, so a retry is safe by construction
-- rather than by being careful.
--
-- Partial on `data ? 'ai_action_id'`, so the existing PROMO notifications from
-- `broadcast_shop_notification` — which carry no campaign id — are untouched
-- and unconstrained. Both operators are immutable, which a unique index
-- predicate requires.
create unique index if not exists notifications_one_per_campaign_recipient_idx
  on public.notifications ((data ->> 'ai_action_id'), user_id)
  where data ? 'ai_action_id';

-- ---------------------------------------------------------------------------
-- 5) The segmentation layer
-- ---------------------------------------------------------------------------
-- Four read-only functions. They share one shape and one set of rules, so it is
-- worth stating both once.
--
-- AUTHORIZATION. Every one of them starts with `is_shop_owner(p_shop_id)`, the
-- same SECURITY DEFINER predicate every `owner_*` RLS policy in this schema
-- uses. An owner who names another shop gets `not your shop`; there is no
-- argument through which a caller could widen the scope, because the scope IS
-- the argument and the argument is checked.
--
-- WHY SECURITY DEFINER. Three of the four need something an owner cannot read
-- under RLS: `profiles.notification_prefs`, via `notification_enabled()`, which
-- is how "how many of these people will actually receive a promotion" gets
-- answered without exposing whose preference is whose. `shop_segment_members`
-- could have been INVOKER — an owner can read their own shop's serials and
-- appointments — but it reports a reachable count too, and splitting it would
-- have meant two functions whose answers had to agree.
--
-- WHAT THEY DO NOT RETURN. No phone number, no email, no address, no date of
-- birth, no notification preference per person, and — from the member listing —
-- no customer id. Nothing downstream accepts a customer id from a caller, so
-- returning one would be risk with no use. The display name is the same
-- snapshot the owner's own Regulars and Appointments screens already show.
--
-- A VISIT is a completed job: a `serials` row with `status = 'DONE'` or an
-- `appointments` row with `status = 'DONE'`, either way with `completed_at` set
-- and a non-null `customer_id`. Both, always, because a UNISEX shop runs a
-- queue and an appointment book at once and a segment that saw only half of a
-- shop's work would be wrong about every customer who used the other half.
-- Walk-ins are excluded by `customer_id is not null`: there is nobody to
-- notify, and a phone number is not an account.
--
-- THE WINDOW is a DATE, `p_since`, and that is deliberate rather than
-- convenient. A cutoff of `now() - interval '60 days'` moves continuously, so a
-- customer whose last visit was 60 days and 5 minutes ago would enter LAPSED
-- while the owner read the draft — and the send would then refuse with
-- SEGMENT_CHANGED for no reason anybody could explain. A date computed once,
-- passed in, and stored on the proposal means the only thing that can change
-- the set is real customer activity, which is exactly what SEGMENT_CHANGED
-- should mean.

-- ------------------------------ the shared rule -----------------------------
-- Each segment's membership, as one function so the summary, the listing, the
-- insights and the recipient snapshot cannot disagree. If they disagreed the
-- owner would be shown a count from one and messaged from another.
--
-- Returns the customer's id, so the callers above can each decide how much of
-- it to reveal. This one is not granted to `authenticated` — see the grants
-- block — because it is the raw form and the four wrappers are the interface.
create or replace function public.shop_segment_rows(
  p_shop_id uuid,
  p_segment text,
  p_since   date
)
returns table (
  customer_id   uuid,
  display_name  text,
  last_visit_at timestamptz,
  visit_count   integer,
  promo_optin   boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if p_shop_id is null then
    raise exception 'segment_shop_required';
  end if;
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'not your shop';
  end if;
  if p_segment is null then
    raise exception 'segment_required';
  end if;
  if p_since is null then
    raise exception 'segment_window_required';
  end if;
  -- A window the caller cannot have meant. Two years is already wider than this
  -- product's whole history; the ceiling is here so a typo cannot turn into a
  -- table scan presented as a segment.
  if p_since > current_date then
    raise exception 'segment_window_in_future';
  end if;
  if p_since < current_date - 1095 then
    raise exception 'segment_window_too_wide';
  end if;

  return query
  with visits as (
    -- Every completed job this shop has ever done for a known customer, from
    -- both halves of the product. `union all` then aggregate: a customer with a
    -- serial and an appointment on the same day has made two visits, and
    -- deduplicating them would understate a regular.
    select s.customer_id as cid,
           coalesce(nullif(btrim(s.customer_name), ''), 'কাস্টমার') as cname,
           s.completed_at as at
      from public.serials s
     where s.shop_id = p_shop_id
       and s.status = 'DONE'
       and s.completed_at is not null
       and s.customer_id is not null
    union all
    select a.customer_id,
           coalesce(nullif(btrim(a.customer_name), ''), 'কাস্টমার'),
           a.completed_at
      from public.appointments a
     where a.shop_id = p_shop_id
       and a.status = 'DONE'
       and a.completed_at is not null
       and a.customer_id is not null
  ),
  per_customer as (
    select cid,
           -- The name as of the most recent visit, so a customer who changed it
           -- is shown the current one rather than whichever row sorted first.
           (array_agg(cname order by at desc))[1] as cname,
           max(at) as last_at,
           count(*)::int as all_visits,
           count(*) filter (where at >= p_since::timestamptz)::int as window_visits
      from visits
     group by cid
  ),
  chosen as (
    select p.cid, p.cname, p.last_at, p.window_visits as n
      from per_customer p
     where case p_segment
             -- Two completed visits in the window. The threshold is
             -- `computeRegulars`' own REGULAR_VISIT_THRESHOLD and the existing
             -- `broadcast_shop_notification('regulars')`' `having count(*) >= 2`
             -- — one number, already in the product, not a new opinion.
             when 'REGULARS'       then p.window_visits >= 2
             -- A stricter cut of the same rule, for a shop that wants its best
             -- customers rather than its returning ones.
             when 'HIGH_FREQUENCY' then p.window_visits >= 5
             when 'RECENT'         then p.window_visits >= 1
             -- Came at least once, ever, and not since the cutoff. NOT "churn":
             -- this says what the records show and nothing about the future.
             -- `all_visits >= 1` is implied by the row existing at all and is
             -- written out because the distinction from "never visited" is the
             -- whole meaning of the segment — somebody who has never been here
             -- is not lapsed, they are a stranger.
             when 'LAPSED'         then p.all_visits >= 1 and p.window_visits = 0
             else false
           end

    union all

    -- MEMBERS and LOYALTY_ENGAGED are states rather than histories, so they are
    -- their own branches. Their `last_visit_at` and `visit_count` still come
    -- from the visit history where there is one — a member who has never been
    -- in gets nulls, which the insights function counts and reports rather than
    -- rendering as a zero.
    --
    -- `distinct on` because a renewing customer has several membership rows and
    -- a segment must not list anybody twice: a duplicate would inflate the
    -- count the owner approves and, in the snapshot, be silently swallowed by
    -- the uniqueness index at send time.
    select mm.cid,
           coalesce(
             (select p.cname from per_customer p where p.cid = mm.cid),
             nullif(btrim(mm.mname), ''),
             'কাস্টমার'
           ),
           (select p.last_at from per_customer p where p.cid = mm.cid),
           coalesce((select p.window_visits from per_customer p where p.cid = mm.cid), 0)
      from (
        select distinct on (m.customer_id)
               m.customer_id as cid, m.customer_name as mname
          from public.customer_memberships m
         where p_segment = 'MEMBERS'
           and m.shop_id = p_shop_id
           -- The existing door for "is this person a member right now". It
           -- checks `expires_at` itself, so a lapsed row never reads as active
           -- even before the nightly job has flipped it — which is why this is
           -- a function call and not `status = 'ACTIVE'`.
           and public.membership_is_active(p_shop_id, m.customer_id)
         order by m.customer_id, m.created_at desc
      ) mm

    union all

    select l.customer_id,
           coalesce(
             (select p.cname from per_customer p where p.cid = l.customer_id),
             'কাস্টমার'
           ),
           (select p.last_at from per_customer p where p.cid = l.customer_id),
           coalesce((select p.window_visits from per_customer p where p.cid = l.customer_id), 0)
      from public.loyalty_accounts l
     where p_segment = 'LOYALTY_ENGAGED'
       and l.shop_id = p_shop_id
       -- Points they could actually spend. A zero balance is a card, not an
       -- engagement, and a "you have points waiting" message to somebody with
       -- none is the kind of thing that teaches people to ignore the app.
       and l.balance > 0
  )
  select c.cid,
         c.cname,
         c.last_at,
         c.n,
         -- Whether a promotional notification would reach them at all. The
         -- existing per-user preference, via the existing function — the same
         -- one `broadcast_shop_notification` filters on, so the count shown to
         -- the owner and the count the send produces come from one rule.
         public.notification_enabled(c.cid, 'PROMO')
    from chosen c
   order by c.last_at desc nulls last;
end $$;

comment on function public.shop_segment_rows(uuid, text, date) is
  'Deterministic segment membership for one shop. The single source the summary, '
  'the listing, the insights and the recipient snapshot all read. Owner-only.';

-- ------------------------------ 5a) the summary -----------------------------
-- Every segment at once, with counts and nothing else. This is what the owner's
-- first question ("who should I be paying attention to?") is answered from, and
-- returning only counts is what keeps that question cheap.
create or replace function public.shop_segment_summary(
  p_shop_id uuid,
  p_since   date
)
returns table (
  segment          text,
  member_count     integer,
  reachable_count  integer,
  oldest_last_visit timestamptz,
  newest_last_visit timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_segment text;
begin
  if p_shop_id is null then
    raise exception 'segment_shop_required';
  end if;
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'not your shop';
  end if;

  foreach v_segment in array array[
    'REGULARS', 'HIGH_FREQUENCY', 'RECENT', 'LAPSED', 'MEMBERS', 'LOYALTY_ENGAGED'
  ]
  loop
    return query
    select v_segment,
           count(*)::int,
           count(*) filter (where r.promo_optin)::int,
           min(r.last_visit_at),
           max(r.last_visit_at)
      from public.shop_segment_rows(p_shop_id, v_segment, p_since) r;
  end loop;
end $$;

-- ------------------------------ 5b) the listing -----------------------------
-- Who is in one segment, by name, bounded. For "আমার regular customer কারা?" —
-- a question about people, which needs names and nothing else.
--
-- No customer id, no phone, no notification preference. The cap is the caller's
-- but hard-limited here: a segment of four hundred is answered with a sample
-- and a true count, because four hundred names is not an answer to anything.
create or replace function public.shop_segment_members(
  p_shop_id uuid,
  p_segment text,
  p_since   date,
  p_limit   integer default 20
)
returns table (
  display_name  text,
  last_visit_at timestamptz,
  visit_count   integer
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  -- `shop_segment_rows` re-checks ownership itself; this is here so a bad
  -- `p_limit` is refused before any work happens.
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'segment_limit_out_of_range';
  end if;

  return query
  select r.display_name, r.last_visit_at, r.visit_count
    from public.shop_segment_rows(p_shop_id, p_segment, p_since) r
   limit p_limit;
end $$;

-- ------------------------------ 5c) the insights ----------------------------
-- Aggregates for understanding one segment, and aggregates only. Every figure
-- here is a count or a date over the segment's own rows — there is no rate, no
-- projection and no comparison to an imagined norm.
create or replace function public.shop_segment_insights(
  p_shop_id uuid,
  p_segment text,
  p_since   date
)
returns table (
  member_count      integer,
  reachable_count   integer,
  muted_count       integer,
  never_visited     integer,
  oldest_last_visit timestamptz,
  newest_last_visit timestamptz,
  visited_last_30   integer,
  visited_31_90     integer,
  visited_91_plus   integer,
  avg_visits        numeric,
  active_members    integer,
  with_points       integer,
  referred_someone  integer
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if p_shop_id is null then
    raise exception 'segment_shop_required';
  end if;
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'not your shop';
  end if;

  return query
  -- `seg`, not `rows`: ROWS is a Postgres keyword and a CTE named after it is
  -- a parse error waiting for whoever edits this next.
  with seg as (
    select * from public.shop_segment_rows(p_shop_id, p_segment, p_since)
  )
  select count(*)::int,
         count(*) filter (where r.promo_optin)::int,
         count(*) filter (where not r.promo_optin)::int,
         -- A member or points-holder who has never completed a visit here. Worth
         -- surfacing rather than hiding in a null: it is the difference between
         -- "twelve members" and "twelve members, four of whom have never been".
         count(*) filter (where r.last_visit_at is null)::int,
         min(r.last_visit_at),
         max(r.last_visit_at),
         count(*) filter (
           where r.last_visit_at >= now() - interval '30 days'
         )::int,
         count(*) filter (
           where r.last_visit_at < now() - interval '30 days'
             and r.last_visit_at >= now() - interval '90 days'
         )::int,
         count(*) filter (where r.last_visit_at < now() - interval '90 days')::int,
         -- Rounded to one place. Null when the segment is empty, never 0 — this
         -- schema's standing rule, and the prompt depends on it surviving.
         case when count(*) = 0 then null
              else round(avg(r.visit_count)::numeric, 1) end,
         (select count(*)::int from seg r2
           where public.membership_is_active(p_shop_id, r2.customer_id)),
         (select count(*)::int from public.loyalty_accounts l
           where l.shop_id = p_shop_id and l.balance > 0
             and l.customer_id in (select r3.customer_id from seg r3)),
         (select count(distinct f.referrer_id)::int from public.referrals f
           where f.shop_id = p_shop_id and f.status = 'CONVERTED'
             and f.referrer_id in (select r4.customer_id from seg r4))
    from seg r;
end $$;

-- --------------------------- 5d) the recipient set --------------------------
-- The snapshot, and the only function that returns customer ids.
--
-- Two jobs, and they are the same job at two moments: building the snapshot
-- when the proposal is created, and recomputing it when the owner approves so
-- the two can be compared. Because both go through this function with the same
-- arguments, a difference between them is a real change in the shop's
-- customers, never a difference in how the question was asked.
--
-- Promo-reachable only. That is what makes the count on the card honest: the
-- owner is shown the number of people who will actually be messaged, not a
-- segment size that quietly shrinks at send time.
create or replace function public.shop_campaign_recipients(
  p_shop_id uuid,
  p_segment text,
  p_since   date
)
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  -- Sorted, so two calls produce the same array and an equality comparison
  -- means what it looks like it means.
  select r.customer_id
    from public.shop_segment_rows(p_shop_id, p_segment, p_since) r
   where r.promo_optin
   order by r.customer_id;
$$;

-- ---------------------------------------------------------------------------
-- 6) The send
-- ---------------------------------------------------------------------------
-- `broadcast_campaign` is a sibling of `broadcast_shop_notification`, not a
-- replacement and not a second notification system. It writes the same
-- `notifications` rows, with the same `PROMO` type, through the same
-- `notification_enabled` filter, behind the same owner check, under the same
-- one-broadcast-per-shop-per-day budget.
--
-- WHY A SIBLING AT ALL. The existing function takes a TARGET — `'recent'` or
-- `'regulars'` — and recomputes the audience inside itself at send time. That
-- is exactly what §16 forbids for an approved campaign: the owner approves a
-- count, and a function that re-derives its own audience can send to a
-- different set of people than the one that was shown. It also cannot express
-- four of this sprint's six segments, including LAPSED, which is the whole
-- point of a retention feature.
--
-- So this function takes the snapshot instead. What it does NOT do is trust it:
--
--   · the proposal must be a CONFIRMED SEND_CAMPAIGN row belonging to the
--     caller, for this shop — so there is no way to send without an approval;
--   · the set being sent to must equal the set stored on that row — so the
--     approved audience and the messaged audience are the same people by
--     construction, not by the caller being careful;
--   · every recipient must be a customer of THIS shop, checked in SQL against
--     the shop's own serials, appointments, memberships and loyalty accounts —
--     so a uuid that found its way into the array cannot be messaged.
--
-- The original function is untouched and still used by the manual "নোটিফিকেশন
-- পাঠান" screen and by `notifyRegularsAboutOffer`. Two call sites, two
-- shapes, one table.
create or replace function public.broadcast_campaign(
  p_shop_id   uuid,
  p_action_id uuid,
  p_title     text,
  p_body      text
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid       uuid := auth.uid();
  v_action    public.ai_actions;
  v_recipients uuid[];
  v_sent      integer;
  v_unknown   integer;
begin
  if v_uid is null then
    raise exception 'campaign_requires_login';
  end if;
  if p_shop_id is null or p_action_id is null then
    raise exception 'campaign_bad_request';
  end if;

  -- 1) The caller owns this shop. `is_shop_owner` reads `auth.uid()` itself, so
  --    there is no identity argument to get wrong.
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'not your shop';
  end if;

  -- 2) There is an approved proposal, it is this caller's, and it is for this
  --    shop. A row in any other state — PROPOSED, EXECUTED, CANCELLED, EXPIRED,
  --    FAILED — is refused, which is what makes "the AI cannot send" a property
  --    of the database rather than of the endpoint.
  select * into v_action
    from public.ai_actions
   where id = p_action_id
     and user_id = v_uid
   for update;

  if not found then
    raise exception 'campaign_action_not_found';
  end if;
  if v_action.action_type::text <> 'SEND_CAMPAIGN' then
    raise exception 'campaign_wrong_action_type';
  end if;
  if v_action.status <> 'CONFIRMED' then
    raise exception 'campaign_not_confirmed';
  end if;
  if v_action.shop_id is distinct from p_shop_id then
    raise exception 'campaign_wrong_shop';
  end if;

  v_recipients := v_action.campaign_recipients;
  if v_recipients is null or cardinality(v_recipients) = 0 then
    raise exception 'campaign_no_recipients';
  end if;
  if cardinality(v_recipients) > 500 then
    raise exception 'campaign_too_many_recipients';
  end if;

  -- 3) The content. Taken from the ROW, never from a parameter — the two
  --    arguments exist only so the caller can prove it is sending what it
  --    thinks it is sending, and a mismatch is a bug worth failing on rather
  --    than resolving silently in either direction.
  if p_title is distinct from v_action.campaign_title
     or p_body is distinct from v_action.campaign_body then
    raise exception 'campaign_content_mismatch';
  end if;
  if v_action.campaign_title is null or btrim(v_action.campaign_title) = ''
     or v_action.campaign_body is null or btrim(v_action.campaign_body) = '' then
    raise exception 'campaign_content_required';
  end if;

  -- 4) Every recipient is genuinely a customer of this shop.
  --
  --    This is the check that makes the snapshot safe to store as a plain array.
  --    "Customer of this shop" is deliberately the union of all four ways the
  --    relationship exists — a completed job, a membership, or a points card —
  --    because a member who has not yet visited is still this shop's customer,
  --    and MEMBERS is one of the segments.
  select count(*) into v_unknown
    from unnest(v_recipients) as cand(id)
   where not exists (
     select 1 from public.serials s
      where s.shop_id = p_shop_id and s.customer_id = cand.id
     )
     and not exists (
       select 1 from public.appointments a
        where a.shop_id = p_shop_id and a.customer_id = cand.id
     )
     and not exists (
       select 1 from public.customer_memberships m
        where m.shop_id = p_shop_id and m.customer_id = cand.id
     )
     and not exists (
       select 1 from public.loyalty_accounts l
        where l.shop_id = p_shop_id and l.customer_id = cand.id
     );

  if v_unknown > 0 then
    raise exception 'campaign_recipient_not_a_customer';
  end if;

  -- 5) The existing daily budget, shared with the manual broadcast on purpose.
  --
  --    §25 says to reuse existing rate limiting, and this is it: at most one
  --    PROMO per shop per day, counted over the same table with the same
  --    predicate as `broadcast_shop_notification`. Sharing the budget means an
  --    owner cannot get two promotional blasts out of one day by using the
  --    assistant for one and the manual screen for the other, which is the
  --    behaviour the limit exists to produce.
  --
  --    Two honest notes. `created_at::date` is the SERVER's day, not Dhaka's —
  --    a pre-existing property of the original function, matched here
  --    deliberately so the two share one boundary rather than disagreeing about
  --    when "today" ends. And this check is a policy gate, not a concurrency
  --    primitive: two simultaneous transactions could both pass it. What makes
  --    a double send impossible is `ai_action_claim()` upstream and
  --    `notifications_one_per_campaign_recipient_idx` underneath.
  if exists (
    select 1 from public.notifications n
     where n.type = 'PROMO'
       and (n.data ->> 'shop_id') = p_shop_id::text
       and n.created_at::date = current_date
       -- Except this campaign's own rows. Without this exclusion a retry after
       -- a lost reply would be refused as "already broadcast today" instead of
       -- being recognised as the same send, which is the difference between a
       -- safe retry and a confusing one.
       and coalesce(n.data ->> 'ai_action_id', '') <> p_action_id::text
  ) then
    raise exception 'campaign_daily_limit';
  end if;

  -- 6) The send itself. One statement.
  --
  --    `on conflict do nothing` against the campaign uniqueness index, so a
  --    retry inserts the rows that are missing and nothing else — the function
  --    is idempotent per recipient without needing to know whether it has run
  --    before.
  --
  --    Inner-joined against `auth.users` for the same reason the original
  --    function is: a stale customer id left behind by a deleted account would
  --    otherwise fail the whole batch on a foreign key.
  --
  --    `notification_enabled` is re-checked here rather than trusted from the
  --    snapshot. The snapshot was already filtered when it was built, so this
  --    only matters for somebody who muted promotions in between — and when
  --    that happens their wish is the newer one.
  insert into public.notifications (user_id, type, title, body, data)
  select u.id, 'PROMO', v_action.campaign_title, v_action.campaign_body,
         jsonb_build_object(
           'shop_id', p_shop_id,
           -- What makes the result recountable, the retry safe and the audit
           -- exact. Not sensitive: an action id is meaningless without the row.
           'ai_action_id', p_action_id
         )
    from unnest(v_recipients) as cand(id)
    join auth.users u on u.id = cand.id
   where public.notification_enabled(cand.id, 'PROMO')
  on conflict do nothing;

  get diagnostics v_sent = row_count;
  return v_sent;
end $$;

comment on function public.broadcast_campaign(uuid, uuid, text, text) is
  'Sends an owner-approved AI campaign to its frozen recipient snapshot. Refuses '
  'unless the ai_actions row is a CONFIRMED SEND_CAMPAIGN owned by the caller for '
  'this shop, and unless every recipient is genuinely this shop''s customer. '
  'Shares the one-PROMO-per-shop-per-day budget with broadcast_shop_notification.';

-- --------------------------- how many actually went -------------------------
-- Counted from the notifications themselves, so the audit can be reconciled
-- after a lost reply rather than guessed at.
--
-- SECURITY DEFINER because `notifications` is readable only by its recipient —
-- an owner cannot count their own campaign's deliveries under RLS. Narrow by
-- construction: it takes an action id, refuses unless that row belongs to
-- `auth.uid()`, and returns a single integer. There is no argument through
-- which it could be pointed at anybody else's notifications, and it returns no
-- rows, no names and no recipients.
create or replace function public.campaign_send_count(p_action_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer;
begin
  if v_uid is null then
    raise exception 'campaign_requires_login';
  end if;

  if not exists (
    select 1 from public.ai_actions
     where id = p_action_id and user_id = v_uid
       and action_type::text = 'SEND_CAMPAIGN'
  ) then
    raise exception 'campaign_action_not_found';
  end if;

  select count(*)::int into v_n
    from public.notifications n
   where (n.data ->> 'ai_action_id') = p_action_id::text;

  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- 7) The lifecycle, widened
-- ---------------------------------------------------------------------------
-- DROPPED and recreated rather than replaced, because the argument lists
-- change. Dropping a function destroys no data; what it does mean is that this
-- migration must be applied whole, which the verification block checks.
--
-- The new arguments all default to null, so an existing call by name still
-- resolves — a half-deployed state (new SQL, old JavaScript) proposes a valid
-- JOIN_QUEUE rather than failing, and there is only ever ONE
-- `ai_action_propose` so PostgREST can never find the call ambiguous.
drop function if exists public.ai_action_propose(
  public.ai_action_type, uuid, uuid[], text, jsonb, integer, uuid, timestamptz, uuid
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
  p_reward_id    uuid default null,
  p_campaign_segment    text default null,
  p_campaign_since      date default null,
  p_campaign_recipients uuid[] default null,
  p_campaign_title      text default null,
  p_campaign_body       text default null
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
  if p_shop_id is null then
    raise exception 'ai_action_shop_required';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds < 30 or p_ttl_seconds > 1800 then
    raise exception 'ai_action_ttl_out_of_range';
  end if;
  if p_nonce is null or length(p_nonce) < 16 then
    raise exception 'ai_action_nonce_too_short';
  end if;

  if v_type = 'SEND_CAMPAIGN' then
    -- Only a shop's owner may propose a campaign against it. Checked HERE, in
    -- the function that writes the row, and not only in the tool that assembles
    -- it — so a proposal for a shop the caller does not own cannot exist, and
    -- the send path never has to wonder.
    if not public.is_shop_owner(p_shop_id) then
      raise exception 'not your shop';
    end if;
    if p_campaign_segment is null then
      raise exception 'ai_action_segment_required';
    end if;
    if p_campaign_since is null then
      raise exception 'ai_action_segment_window_required';
    end if;
    if p_campaign_recipients is null or cardinality(p_campaign_recipients) = 0 then
      raise exception 'ai_action_recipients_required';
    end if;
    -- The floor and the ceiling the table also enforces, raised by name so the
    -- caller gets a reason rather than a constraint.
    if cardinality(p_campaign_recipients) < 3 then
      raise exception 'ai_action_segment_too_small';
    end if;
    if cardinality(p_campaign_recipients) > 500 then
      raise exception 'ai_action_segment_too_large';
    end if;
    if p_campaign_title is null or btrim(p_campaign_title) = ''
       or p_campaign_body is null or btrim(p_campaign_body) = '' then
      raise exception 'ai_action_campaign_content_required';
    end if;
    if p_staff_id is not null or p_starts_at is not null or p_reward_id is not null
       or cardinality(v_svc) <> 0 then
      raise exception 'ai_action_bad_shape';
    end if;

  elsif v_type = 'REDEEM_REWARD' then
    if p_reward_id is null then
      raise exception 'ai_action_reward_required';
    end if;
    if p_staff_id is not null or p_starts_at is not null then
      raise exception 'ai_action_bad_shape';
    end if;
    if cardinality(v_svc) <> 0 then
      raise exception 'ai_action_bad_shape';
    end if;
    if p_campaign_segment is not null or p_campaign_recipients is not null then
      raise exception 'ai_action_bad_shape';
    end if;

  elsif v_type = 'BOOK_APPOINTMENT' then
    if p_staff_id is null or p_starts_at is null then
      raise exception 'ai_action_slot_required';
    end if;
    if p_starts_at <= now() then
      raise exception 'ai_action_slot_in_past';
    end if;
    if p_reward_id is not null then
      raise exception 'ai_action_bad_shape';
    end if;
    if cardinality(v_svc) = 0 then
      raise exception 'ai_action_services_required';
    end if;
    if p_campaign_segment is not null or p_campaign_recipients is not null then
      raise exception 'ai_action_bad_shape';
    end if;

  else
    -- JOIN_QUEUE, unchanged since Sprint 3.
    if cardinality(v_svc) = 0 then
      raise exception 'ai_action_services_required';
    end if;
    if p_staff_id is not null or p_starts_at is not null or p_reward_id is not null then
      raise exception 'ai_action_bad_shape';
    end if;
    if p_campaign_segment is not null or p_campaign_recipients is not null then
      raise exception 'ai_action_bad_shape';
    end if;
  end if;

  perform public.ai_action_expire_mine();

  insert into public.ai_actions (
    user_id, action_type, status, shop_id, service_ids, nonce, display,
    expires_at, staff_id, starts_at, reward_id,
    campaign_segment, campaign_since, campaign_recipients,
    campaign_title, campaign_body
  ) values (
    v_uid, p_action_type, 'PROPOSED', p_shop_id, v_svc, p_nonce,
    coalesce(p_display, '{}'::jsonb),
    now() + make_interval(secs => p_ttl_seconds),
    p_staff_id, p_starts_at, p_reward_id,
    p_campaign_segment, p_campaign_since, p_campaign_recipients,
    p_campaign_title, p_campaign_body
  )
  returning * into v_row;

  return v_row;
end $$;

-- ------------------------- the owner's edit, applied ------------------------
-- CONFIRMED → CONFIRMED, with new content. §13's "the edited text becomes the
-- actual text to be sent", made structural.
--
-- What this function CAN change: the title and the body. That is the entire
-- parameter list, which is why it cannot change the shop, the segment, the
-- recipients, the action type or the status — there is nothing to pass. §13's
-- list of things an owner may not edit is enforced by absence rather than by
-- validation, which is the stronger form.
--
-- Why it writes to the row rather than the executor taking the text from the
-- request: the executor then reads the content from the database, so the text
-- that is sent and the text in the audit are the same string by construction.
-- `display` still holds the model's original draft, so an edited campaign shows
-- both what was suggested and what went out.
create or replace function public.ai_action_apply_campaign_edit(
  p_action_id uuid,
  p_title     text,
  p_body      text
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
  if p_title is null or btrim(p_title) = '' or length(p_title) > 80 then
    raise exception 'ai_action_campaign_title_invalid';
  end if;
  if p_body is null or btrim(p_body) = '' or length(p_body) > 500 then
    raise exception 'ai_action_campaign_body_invalid';
  end if;

  update public.ai_actions
     set campaign_title = btrim(p_title),
         campaign_body  = btrim(p_body)
   where id = p_action_id
     and user_id = v_uid                    -- somebody else's is invisible here
     and action_type::text = 'SEND_CAMPAIGN'
     -- CONFIRMED only. Editing a PROPOSED row would change what the card says
     -- underneath the owner reading it; editing a settled one would rewrite
     -- history.
     and status = 'CONFIRMED'
  returning * into v_row;

  if not found then
    raise exception 'ai_action_not_editable';
  end if;

  return v_row;
end $$;

-- ------------------------------ settle, widened -----------------------------
-- A campaign has no result row, so `p_result_id` cannot carry its outcome. One
-- more defaulted argument rather than a second settle function: two would mean
-- two places that can write EXECUTED.
drop function if exists public.ai_action_settle(
  uuid, public.ai_action_status, uuid, text
);

create or replace function public.ai_action_settle(
  p_action_id    uuid,
  p_status       public.ai_action_status,
  p_result_id    uuid,
  p_failure_code text,
  p_result_count integer default null
)
returns public.ai_actions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid  uuid := auth.uid();
  v_row  public.ai_actions;
  v_type text;
begin
  if v_uid is null then
    raise exception 'ai_action_requires_login';
  end if;
  if p_status not in ('EXECUTED', 'FAILED') then
    raise exception 'ai_action_bad_settle_status';
  end if;

  select action_type::text into v_type
    from public.ai_actions
   where id = p_action_id and user_id = v_uid;
  if v_type is null then
    raise exception 'ai_action_not_settleable';
  end if;

  -- EXECUTED means something happened, and the proof differs by type: the other
  -- three created a row, a campaign inserted a countable number of
  -- notifications. Either way an action cannot claim success while pointing at
  -- nothing, which is the one thing an audit row must not be able to say.
  if p_status = 'EXECUTED' then
    if v_type = 'SEND_CAMPAIGN' then
      if p_result_count is null or p_result_count < 0 then
        raise exception 'ai_action_executed_needs_count';
      end if;
    elsif p_result_id is null then
      raise exception 'ai_action_executed_needs_result';
    end if;
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
         campaign_sent_count = case
           when p_status = 'EXECUTED' and action_type::text = 'SEND_CAMPAIGN'
           then p_result_count else null end,
         failure_code = case
           when p_status = 'FAILED'
           then left(coalesce(p_failure_code, 'UNKNOWN'), 64) else null end,
         settled_at = now()
   where id = p_action_id
     and user_id = v_uid
     and status = 'CONFIRMED'      -- never from PROPOSED: confirmation first
  returning * into v_row;

  if not found then
    raise exception 'ai_action_not_settleable';
  end if;

  return v_row;
end $$;

-- `ai_action_claim`, `ai_action_cancel` and `ai_action_expire_mine` are
-- unchanged and deliberately untouched. Claim returns `public.ai_actions`, so
-- the campaign columns appear in its result with no edit — which is why the
-- confirm endpoint can read the segment, the recipients and the content
-- straight off the claimed row rather than fetching it again.

-- ---------------------------------------------------------------------------
-- 8) EXECUTE grants
-- ---------------------------------------------------------------------------
-- `create function` grants EXECUTE to PUBLIC, and Supabase's default privileges
-- additionally grant `anon` and `authenticated` BY NAME — so this block is not
-- belt-and-braces. Without it, `anon` would hold EXECUTE on every function
-- above, including the send.
--
-- `shop_segment_rows` is deliberately NOT granted. It is the raw form that
-- returns customer ids, and the four wrappers are the interface; a SECURITY
-- DEFINER wrapper calls it regardless of the caller's own privileges, so
-- withholding the grant costs nothing and removes a door.
--
-- Note the REVOKE from `authenticated` before the selective grant. Supabase's
-- default privileges grant EXECUTE on new functions to `authenticated` by name,
-- so merely not granting it would have left `shop_segment_rows` callable — the
-- harness caught exactly that (check A14), which is the argument for the
-- harness in one line.
do $$
declare
  r record;
begin
  for r in
    select format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid)) as sig,
           p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'ai_action_propose', 'ai_action_settle', 'ai_action_apply_campaign_edit',
         'shop_segment_rows', 'shop_segment_summary', 'shop_segment_members',
         'shop_segment_insights', 'shop_campaign_recipients',
         'broadcast_campaign', 'campaign_send_count'
       )
  loop
    execute format('revoke all on function %s from public', r.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', r.sig);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on function %s from authenticated', r.sig);
      if r.proname <> 'shop_segment_rows' then
        execute format('grant execute on function %s to authenticated', r.sig);
      end if;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- যাচাই — SQL এডিটরে হাতে চালাও (§37)
-- ---------------------------------------------------------------------------
-- ১) মাইগ্রেশন + enum + শেপ যাচাই। সব সারিতে ok = true হওয়া বাধ্যতামূলক।
--
-- select * from (values
--   ('চারটে action type আছে',
--    (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
--      where t.typname = 'ai_action_type') = 4),
--
--   ('SEND_CAMPAIGN আছে, নিষিদ্ধগুলো নেই',
--    exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
--             where t.typname = 'ai_action_type' and e.enumlabel = 'SEND_CAMPAIGN')
--    and not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
--             where t.typname = 'ai_action_type'
--               and e.enumlabel in ('AUTO_SEND','SCHEDULE_CAMPAIGN',
--                                   'CANCEL_CAMPAIGN','BULK_MESSAGE','SMART_BLAST'))),
--
--   ('ছটা campaign কলাম বসেছে',
--    (select count(*) from information_schema.columns
--      where table_schema = 'public' and table_name = 'ai_actions'
--        and column_name in ('campaign_segment','campaign_since','campaign_recipients',
--                            'campaign_title','campaign_body','campaign_sent_count')) = 6),
--
--   ('আটটা শেপ constraint আছে',
--    (select count(*) from pg_constraint
--      where conname in ('ai_actions_slot_shape','ai_actions_one_result',
--                        'ai_actions_result_only_when_executed',
--                        'ai_actions_result_matches_type','ai_actions_params_match_type',
--                        'ai_actions_campaign_segment_known','ai_actions_campaign_bounds',
--                        'ai_actions_campaign_count_shape')) = 8),
--
--   ('দুবার পাঠানো ডেটাবেসেই অসম্ভব',
--    exists (select 1 from pg_indexes where schemaname = 'public'
--             and tablename = 'notifications'
--             and indexname = 'notifications_one_per_campaign_recipient_idx')),
--
--   ('একটাই ai_action_propose আর একটাই ai_action_settle',
--    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public'
--        and p.proname in ('ai_action_propose','ai_action_settle')) = 2),
--
--   ('ছটা ai_action_* ফাংশন, সবগুলো DEFINER',
--    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.prosecdef
--        and p.proname like 'ai_action_%') = 6),
--
--   ('ai_actions-এ এখনো লেখার পলিসি নেই',
--    (select count(*) from pg_policies
--      where schemaname = 'public' and tablename = 'ai_actions'
--        and cmd <> 'SELECT') = 0),
--
--   ('কোনো ai_action_* ফাংশন notification লেখে না',
--    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname like 'ai_action_%'
--        and pg_get_functiondef(p.oid) ilike '%insert into public.notifications%') = 0),
--
--   ('পুরনো broadcast_shop_notification অপরিবর্তিত আছে',
--    to_regprocedure('public.broadcast_shop_notification(uuid,text,text,text)') is not null),
--
--   ('anon কোনো নতুন ফাংশন চালাতে পারে না',
--    not exists (
--      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public'
--         and (p.proname like 'shop_segment%' or p.proname like 'campaign%'
--              or p.proname = 'broadcast_campaign' or p.proname like 'ai_action_%')
--         and has_function_privilege('anon', p.oid, 'execute'))),
--
--   ('shop_segment_rows কেবল ভেতরের ব্যবহারের জন্য',
--    not has_function_privilege('authenticated',
--      'public.shop_segment_rows(uuid,text,date)'::regprocedure, 'execute')),
--
--   ('কোনো সারি হারায়নি',
--    (select count(*) >= 0 from public.ai_actions))
-- ) as t(check_name, ok) order by check_name;
--
--
-- ২) RLS আর owner-only segment access — নিজের দোকানের id দিয়ে চালাও।
--    লগইন করা অবস্থায় (SQL এডিটর service_role-এ চলে, তখন auth.uid() null,
--    আর `not your shop` আসবে — সেটাও একটা বৈধ ফল)।
--
-- select * from public.shop_segment_summary('<নিজের-shop-id>', current_date - 60);
-- select * from public.shop_segment_members('<নিজের-shop-id>', 'REGULARS', current_date - 60, 20);
-- select * from public.shop_segment_insights('<নিজের-shop-id>', 'LAPSED', current_date - 60);
--
--    অন্য কারো দোকান দিলে `not your shop` আসতে হবে:
--
-- select * from public.shop_segment_summary('<অন্য-কারো-shop-id>', current_date - 60);
--
--
-- ৩) recipient snapshot — গোনা আর সাজানো এক থাকতে হবে (দুবার চালিয়ে মিলাও):
--
-- select array_agg(id) from public.shop_campaign_recipients(
--   '<নিজের-shop-id>', 'LAPSED', current_date - 60) as t(id);
--
--
-- ---------------------------------------------------------------------------
-- আচরণগত পরীক্ষা — এগুলো **ব্যর্থ হওয়ার কথা** (§37 এর ৭-৯)
-- ---------------------------------------------------------------------------
-- প্রতিটা আলাদা করে চালাও।
--
-- ১) segment ছাড়া campaign প্রস্তাব → ai_action_segment_required
--
-- select public.ai_action_propose('SEND_CAMPAIGN', '<নিজের-shop-id>',
--   '{}'::uuid[], repeat('a', 24), '{}'::jsonb, 600);
--
-- ২) recipient ছাড়া → ai_action_recipients_required
--
-- select public.ai_action_propose('SEND_CAMPAIGN', '<নিজের-shop-id>',
--   '{}'::uuid[], repeat('a', 24), '{}'::jsonb, 600, null, null, null,
--   'LAPSED', current_date - 60);
--
-- ৩) তিনজনের কম → ai_action_segment_too_small
--
-- select public.ai_action_propose('SEND_CAMPAIGN', '<নিজের-shop-id>',
--   '{}'::uuid[], repeat('a', 24), '{}'::jsonb, 600, null, null, null,
--   'LAPSED', current_date - 60, array[gen_random_uuid()], 'শিরোনাম', 'বার্তা');
--
-- ৪) অজানা segment → ai_actions_campaign_segment_known ভাঙবে
--
-- select public.ai_action_propose('SEND_CAMPAIGN', '<নিজের-shop-id>',
--   '{}'::uuid[], repeat('a', 24), '{}'::jsonb, 600, null, null, null,
--   'WILL_CHURN', current_date - 60,
--   array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()], 'শিরোনাম', 'বার্তা');
--
-- ৫) অন্য কারো দোকানের নামে campaign → not your shop
--
-- select public.ai_action_propose('SEND_CAMPAIGN', '<অন্য-কারো-shop-id>',
--   '{}'::uuid[], repeat('a', 24), '{}'::jsonb, 600, null, null, null,
--   'LAPSED', current_date - 60,
--   array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()], 'শিরোনাম', 'বার্তা');
--
-- ৬) অনুমোদন ছাড়া পাঠানো → campaign_action_not_found / campaign_not_confirmed
--    (AI নিজে পাঠাতে পারে না — এটাই সেই প্রমাণ)
--
-- select public.broadcast_campaign('<নিজের-shop-id>', gen_random_uuid(),
--   'শিরোনাম', 'বার্তা');
--
-- ৭) সরাসরি সারি বসানো → RLS আটকাবে
--
-- insert into public.ai_actions (user_id, action_type, shop_id, service_ids,
--   nonce, expires_at, campaign_segment, campaign_since, campaign_recipients,
--   campaign_title, campaign_body)
-- values (auth.uid(), 'SEND_CAMPAIGN', '<নিজের-shop-id>', '{}'::uuid[],
--   repeat('a', 24), now() + interval '10 min', 'LAPSED', current_date - 60,
--   array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()], 'শিরোনাম', 'বার্তা');
--
-- ৮) EXECUTED সরাসরি লেখা → RLS আটকাবে (কোনো UPDATE পলিসি নেই)
--
-- update public.ai_actions set status = 'EXECUTED', campaign_sent_count = 999
--  where user_id = auth.uid();
