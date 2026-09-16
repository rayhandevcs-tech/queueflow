-- =============================================================================
-- Sprint 11 final audit — close the default EXECUTE grant on internal functions
-- =============================================================================
--
-- WHAT THIS FIXES
--
-- Postgres grants EXECUTE on a new function to PUBLIC unless you say otherwise,
-- and Supabase goes further: its stock setup sets DEFAULT PRIVILEGES on schema
-- `public` so every new function is also granted to `anon` and `authenticated`
-- by name. Neither is a mistake on its own — it is what makes an ordinary RPC
-- callable at all. It becomes a mistake for the functions that were never meant
-- to be an RPC.
--
-- Twelve such functions exist. None of them was ever given a GRANT or a REVOKE
-- in any migration, so all twelve inherited the default and are callable over
-- PostgREST by anybody holding a session — in six cases with side effects:
--
--   send_customer_reminders()          writes notification rows for EVERY
--   send_daily_summaries(date)         customer / shop on the platform and
--   send_appointment_reminders(int)    fans out to the push webhook
--   notify_shop_wait_drop(uuid)        notifies a shop's followers — any shop
--   expire_memberships()               sweeps memberships platform-wide
--   expire_redemptions()               sweeps coupons platform-wide
--
-- and in six cases as an information leak or wasted work:
--
--   recalc_queue_estimates(uuid)       rewrites any shop's queue ETAs
--   assign_best_chair(uuid, uuid[])    internal queue helpers
--   chair_backlog_min(uuid)
--   estimate_duration_on_chair(uuid, uuid[])
--   shop_current_wait(uuid)
--   referral_is_live(uuid)             probes another shop's programme state
--
-- The expiry sweeps are date-driven and therefore idempotent, and none of these
-- returns another shop's rows to the caller, so this is not a confidentiality
-- break. What it is: an unauthenticated-in-spirit write path. Any logged-in
-- account could spam every customer on the platform with notifications and
-- real push sends, on repeat, at the project's expense. That is worth closing.
--
-- The five cron functions are called from exactly one place — the nightly route
-- at `src/app/api/cron/nightly/route.ts`, which uses the service-role client —
-- so `service_role` keeps its grant and the job is unaffected. The other seven
-- are called only from inside other SECURITY DEFINER functions and triggers,
-- where the EXECUTE check is made against the *calling function's owner*, not
-- against the end user. Revoking the end user's grant therefore cannot break
-- them. That is the whole reason this is a safe change and not a risky one.
--
-- WHAT THIS DELIBERATELY DOES NOT TOUCH
--
-- Five neighbours look similar and must keep their grants. Each was checked:
--
--   is_shop_owner(uuid)          named in 40 RLS policies. A policy expression
--                                is evaluated as the QUERYING user, so revoking
--                                this would deny every shop-scoped read and
--                                write in the product.
--   is_chair_owner(uuid)         same, in 8 policies.
--   membership_is_active(...)    called from shop_membership_stats(), which is
--                                SECURITY INVOKER — the caller's own grant is
--                                what is checked.
--   staff_is_available(...)      called from reschedule_appointment(), also
--                                SECURITY INVOKER.
--   shop_available_slots(...)    called directly by the customer booking screen
--                                and by the provider availability screen. It is
--                                a public-availability read by design.
--
-- `send_appointment_due_reminder(...)` also stays: the provider's due-ledger
-- screen calls it, and it already carries its own `is_shop_owner` guard.
--
-- SHAPE
--
-- Additive and non-destructive in the strongest sense — this file changes no
-- table, no column, no policy, no function body and no row. It only narrows who
-- may call twelve functions. It is driven off `pg_proc` rather than a hand-typed
-- signature list so that it cannot miss an overload, and it is idempotent:
-- running it twice is the same as running it once.
--
-- Written for Sprint 11's final audit. Discovered by static audit of the grant
-- surface across all 61 migrations; NOT yet confirmed against the live
-- instance, because this session had no database access. See the handover block
-- at the foot of the file for the one query that confirms it.

-- -----------------------------------------------------------------------------
-- 1. Functions that stop being reachable by a session, but stay reachable by
--    the nightly job.
-- -----------------------------------------------------------------------------

do $$
declare
  r record;
  -- The nightly route calls these five through the service-role key.
  v_cron text[] := array[
    'expire_memberships',
    'expire_redemptions',
    'send_appointment_reminders',
    'send_customer_reminders',
    'send_daily_summaries'
  ];
  -- These seven are only ever called from inside another SECURITY DEFINER
  -- function or trigger, where the owner's privileges apply, so nothing needs
  -- a grant back.
  v_internal text[] := array[
    'notify_shop_wait_drop',
    'recalc_queue_estimates',
    'assign_best_chair',
    'chair_backlog_min',
    'estimate_duration_on_chair',
    'shop_current_wait',
    'referral_is_live'
  ];
  v_all text[] := v_cron || v_internal;
  v_roles text[];
  v_role text;
begin
  -- `anon` and `authenticated` are Supabase's roles; a plain Postgres cluster
  -- (the test harness) has neither, and REVOKE on a missing role is an error.
  select array_agg(rolname::text)
    into v_roles
    from pg_roles
   where rolname in ('anon', 'authenticated');

  for r in
    -- Built explicitly rather than through `oid::regprocedure`, whose text form
    -- drops the schema when `public` happens to be on the search_path. A
    -- REVOKE is not the place to depend on that.
    select format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid)) as sig,
           p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = any(v_all)
  loop
    -- PUBLIC carries the implicit grant every function is born with.
    execute format('revoke all on function %s from public', r.sig);

    -- Supabase's default privileges also name the two API roles explicitly,
    -- and revoking from PUBLIC does not touch a grant held by name.
    if v_roles is not null then
      foreach v_role in array v_roles loop
        execute format('revoke all on function %s from %I', r.sig, v_role);
      end loop;
    end if;

    if r.proname = any(v_cron)
       and exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', r.sig);
    end if;

    raise notice 'locked down %', r.sig;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Handover verification — uncomment and run in the SQL editor.
-- -----------------------------------------------------------------------------
--
-- This is the block that turns "the audit thinks so" into "the database says
-- so". Run it AFTER section 1. Every row should read `t`.
--
-- The `has_function_privilege` calls are the whole point: they ask Postgres the
-- question directly, rather than reading `information_schema`, which hides the
-- implicit PUBLIC grant behind a join that is easy to get wrong.
--
-- with expected(fname, who, allowed) as (values
--   -- the twelve that must now be closed to a session
--   ('send_customer_reminders()',                 'authenticated', false),
--   ('send_daily_summaries(date)',                'authenticated', false),
--   ('send_appointment_reminders(integer)',       'authenticated', false),
--   ('expire_memberships()',                      'authenticated', false),
--   ('expire_redemptions()',                      'authenticated', false),
--   ('notify_shop_wait_drop(uuid)',               'authenticated', false),
--   ('recalc_queue_estimates(uuid)',              'authenticated', false),
--   ('assign_best_chair(uuid, uuid[])',           'authenticated', false),
--   ('chair_backlog_min(uuid)',                   'authenticated', false),
--   ('estimate_duration_on_chair(uuid, uuid[])',  'authenticated', false),
--   ('shop_current_wait(uuid)',                   'authenticated', false),
--   ('referral_is_live(uuid)',                    'authenticated', false),
--   -- and closed to anon too
--   ('send_customer_reminders()',                 'anon',          false),
--   ('expire_memberships()',                      'anon',          false),
--   -- the nightly job must still work
--   ('send_customer_reminders()',                 'service_role',  true),
--   ('send_daily_summaries(date)',                'service_role',  true),
--   ('send_appointment_reminders(integer)',       'service_role',  true),
--   ('expire_memberships()',                      'service_role',  true),
--   ('expire_redemptions()',                      'service_role',  true),
--   -- and the five neighbours must be untouched, or the product breaks
--   ('is_shop_owner(uuid)',                       'authenticated', true),
--   ('is_chair_owner(uuid)',                      'authenticated', true),
--   ('shop_available_slots(uuid, date, uuid[], uuid)', 'authenticated', true)
-- )
-- select fname, who, allowed as should_be,
--        has_function_privilege(who, 'public.' || fname, 'EXECUTE') as actually_is,
--        has_function_privilege(who, 'public.' || fname, 'EXECUTE') = allowed as ok
--   from expected
--  order by ok, fname, who;
--
-- If `shop_available_slots` above reports a signature error, list the real one
-- with:
--   select oid::regprocedure from pg_proc
--    where proname = 'shop_available_slots' and pronamespace = 'public'::regnamespace;
--
-- AND the one query that shows whether the finding was real on this instance.
-- Run it BEFORE section 1 to see the problem, or on a restored copy afterwards:
--
-- select p.oid::regprocedure as fn,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed_can_call
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('send_customer_reminders','send_daily_summaries',
--                      'send_appointment_reminders','expire_memberships',
--                      'expire_redemptions','notify_shop_wait_drop',
--                      'recalc_queue_estimates','shop_current_wait')
--  order by 1;
