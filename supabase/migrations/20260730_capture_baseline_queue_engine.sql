-- Sprint 11 (testing & hardening): baseline capture of the queue engine + base-table RLS.
--
-- IMPORTANT: every object below is ALREADY LIVE on the Supabase project — it was built
-- directly in the dashboard before this repo's migration history started (confirmed via
-- pg_get_functiondef/pg_get_triggerdef/pg_policies pulled from the live project on
-- 2026-07-30). This migration changes NO behavior; it only brings these objects into
-- version control so future sprints (and this sprint's RLS review) have a real source of
-- truth instead of tribal knowledge. Every statement is written to be safe to (re)run:
-- CREATE OR REPLACE FUNCTION, DROP TRIGGER/POLICY IF EXISTS + CREATE, CREATE INDEX IF NOT EXISTS.
--
-- Run this once in the Supabase dashboard's SQL editor. Re-running it later is harmless.

-- ---------------------------------------------------------------------------
-- Functions — bottom-up dependency order
-- ---------------------------------------------------------------------------

-- Used by nearly every "owner_*" RLS policy below (shops/services/chairs/serials/
-- chair_service_stats). SECURITY DEFINER but parameterized (uuid) — no injection risk.
CREATE OR REPLACE FUNCTION public.is_shop_owner(p_shop_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.shops
    where id = p_shop_id and owner_id = auth.uid()
  );
$function$;

-- Sum of a service's rolling average duration on this specific chair (falls back to the
-- service's default_duration_min the first time a chair performs it).
CREATE OR REPLACE FUNCTION public.estimate_duration_on_chair(p_chair_id uuid, p_service_ids uuid[])
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select greatest(
    coalesce(sum(coalesce(css.rolling_avg_duration_min, s.default_duration_min)), 0),
    1
  )::integer
  from unnest(p_service_ids) as sid
  join public.services s on s.id = sid
  left join public.chair_service_stats css
    on css.chair_id = p_chair_id and css.service_id = sid;
$function$;

-- "How long until this chair is totally free" — current IN_PROGRESS job's remaining time
-- (clamped to >= 1 minute) plus the full duration of every WAITING job already queued on
-- it. Used by assign_best_chair to pick the least-loaded eligible chair for a NEW booking
-- (not the same thing as a specific serial's own ETA — see recalc_queue_estimates for that).
CREATE OR REPLACE FUNCTION public.chair_backlog_min(p_chair_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(
    case
      when status = 'IN_PROGRESS' then greatest(
        ceil(extract(epoch from
          (coalesce(started_at, now())
            + make_interval(mins => estimated_duration_min)
            - now())) / 60.0)::integer,
        1)
      else estimated_duration_min
    end), 0)::integer
  from public.serials
  where chair_id = p_chair_id
    and status in ('WAITING', 'IN_PROGRESS');
$function$;

-- Picks the best eligible chair for a new booking: must be active and able to perform
-- every requested service; ordered by (backlog + this booking's duration) ascending, then
-- fewest already-waiting jobs, then the shop's manual sort_order — i.e. whichever chair
-- would finish this job soonest.
CREATE OR REPLACE FUNCTION public.assign_best_chair(p_shop_id uuid, p_service_ids uuid[])
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id
  from public.chairs c
  where c.shop_id = p_shop_id
    and c.is_active = true
    and not exists (                                   -- every service performable
      select 1
      from unnest(p_service_ids) as sid
      where not exists (
        select 1 from public.chair_service_stats css
        where css.chair_id = c.id
          and css.service_id = sid
          and css.can_perform = true))
  order by
    public.chair_backlog_min(c.id)
      + public.estimate_duration_on_chair(c.id, p_service_ids) asc,
    (select count(*) from public.serials se
      where se.chair_id = c.id and se.status = 'WAITING') asc,
    c.sort_order asc
  limit 1;
$function$;

-- THE per-serial ETA formula (Sprint 11 checklist item 1: "serial N wait = current
-- remaining + Σ previous customers' service minutes"). Walks a chair's WAITING/IN_PROGRESS
-- rows in position order: the IN_PROGRESS row's remaining time seeds the cursor (clamped to
-- at least 1 minute out so nothing reads as "already done"); each WAITING row after it gets
-- estimated_start_at = the running cursor, then the cursor advances by that row's own
-- duration for the next one. Re-run after any insert/status-change/chair-move affecting a
-- chair's lane (see serial_after_insert / serial_after_update below).
CREATE OR REPLACE FUNCTION public.recalc_queue_estimates(p_chair_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r            record;
  cursor_time  timestamptz := now();
begin
  for r in
    select id, status, estimated_duration_min, started_at
    from public.serials
    where chair_id = p_chair_id
      and status in ('IN_PROGRESS', 'WAITING')
    order by position
  loop
    if r.status = 'IN_PROGRESS' then
      cursor_time := greatest(
        coalesce(r.started_at, now())
          + make_interval(mins => r.estimated_duration_min),
        now() + interval '1 minute');
    else
      update public.serials
         set estimated_start_at = cursor_time
       where id = r.id;
      cursor_time := cursor_time + make_interval(mins => r.estimated_duration_min);
    end if;
  end loop;
end; $function$;

-- BEFORE INSERT on serials: validates shop is open + services belong to the shop, assigns
-- a chair (auto via assign_best_chair, advisory-locked per shop to avoid a double-assign
-- race, or validates a customer/provider-chosen chair), advisory-locks per chair to
-- serialize position assignment, freezes the booking-time services_snapshot/total_amount
-- (so later rate changes never rewrite past income), and — for online (non-walk-in)
-- bookings — snapshots the customer's current full_name/phone from profiles directly onto
-- the row. That snapshot is why `profiles`'s RLS below can safely stay "read own row only":
-- nothing needs a cross-user profile read to display a booking.
CREATE OR REPLACE FUNCTION public.serial_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
begin
  if not exists (select 1 from public.shops where id = new.shop_id and is_open) then
    raise exception 'shop is not open';
  end if;

  select count(*) into v_count
    from public.services
   where id = any (new.service_ids)
     and shop_id = new.shop_id
     and is_active = true;
  if v_count <> cardinality(new.service_ids) then
    raise exception 'invalid service selection for this shop';
  end if;

  if new.chair_id is null then
    perform pg_advisory_xact_lock(hashtext('shop:' || new.shop_id::text));
    new.chair_id := public.assign_best_chair(new.shop_id, new.service_ids);
    if new.chair_id is null then
      raise exception 'no chair available for the selected services';
    end if;
    new.assignment_mode := 'AUTO';
  else
    if not exists (
      select 1 from public.chairs
      where id = new.chair_id and shop_id = new.shop_id and is_active = true
    ) then
      raise exception 'chair does not belong to this shop or is inactive';
    end if;
    if exists (
      select 1 from unnest(new.service_ids) as sid
      where not exists (
        select 1 from public.chair_service_stats css
        where css.chair_id = new.chair_id
          and css.service_id = sid
          and css.can_perform = true)
    ) then
      raise exception 'selected chair cannot perform all requested services';
    end if;
    new.assignment_mode := case when new.is_walk_in then 'MANUAL' else 'CHOSEN' end;
  end if;

  perform pg_advisory_xact_lock(hashtext('chair:' || new.chair_id::text));

  new.status    := 'WAITING';
  new.booked_at := now();

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'service_id',             s.id,
      'name',                   s.name,
      'rate',                   s.rate,
      'estimated_duration_min', coalesce(css.rolling_avg_duration_min,
                                         s.default_duration_min)
    )), '[]'::jsonb),
    coalesce(sum(s.rate), 0)
  into new.services_snapshot, new.total_amount
  from unnest(new.service_ids) as sid
  join public.services s on s.id = sid
  left join public.chair_service_stats css
    on css.chair_id = new.chair_id and css.service_id = sid;

  new.estimated_duration_min :=
    public.estimate_duration_on_chair(new.chair_id, new.service_ids);

  select coalesce(max(position), 0) + 1
    into new.position
    from public.serials
   where chair_id = new.chair_id
     and status in ('WAITING', 'IN_PROGRESS');

  if new.is_walk_in = false then
    select full_name, phone
      into new.customer_name, new.customer_phone
      from public.profiles
     where id = new.customer_id;
  end if;

  return new;
end; $function$;

-- BEFORE UPDATE on serials: allows moving a WAITING serial to another (eligible, same-shop)
-- chair; enforces the status state machine (WAITING -> IN_PROGRESS/CANCELLED/NO_SHOW,
-- IN_PROGRESS -> DONE/CANCELLED, nothing else — this is the "invalid status transition"
-- error db-errors.ts silently reconciles on a race); stamps started_at/completed_at; and
-- force-resets booking-time-immutable columns back to their OLD values on every update
-- (shop_id, customer_id, is_walk_in, booked_at, service_ids, services_snapshot,
-- total_amount) so history can never be rewritten. customer_phone is the one exception —
-- providers may correct a walk-in's number after the fact.
CREATE OR REPLACE FUNCTION public.serial_before_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.chair_id is distinct from old.chair_id then
    if old.status <> 'WAITING' or new.status <> 'WAITING' then
      raise exception 'only WAITING serials can be moved between chairs';
    end if;

    if not exists (
      select 1 from public.chairs
      where id = new.chair_id and shop_id = old.shop_id and is_active = true
    ) then
      raise exception 'target chair does not belong to this shop or is inactive';
    end if;

    if exists (
      select 1 from unnest(old.service_ids) as sid
      where not exists (
        select 1 from public.chair_service_stats css
        where css.chair_id = new.chair_id
          and css.service_id = sid
          and css.can_perform = true)
    ) then
      raise exception 'target chair cannot perform this serial''s services';
    end if;

    perform pg_advisory_xact_lock(hashtext('chair:' || new.chair_id::text));

    select coalesce(max(position), 0) + 1
      into new.position
      from public.serials
     where chair_id = new.chair_id
       and status in ('WAITING', 'IN_PROGRESS');

    new.estimated_duration_min :=
      public.estimate_duration_on_chair(new.chair_id, old.service_ids);
    new.assignment_mode := 'MANUAL';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'WAITING'     and new.status in ('IN_PROGRESS','CANCELLED','NO_SHOW')) or
      (old.status = 'IN_PROGRESS' and new.status in ('DONE','CANCELLED'))
    ) then
      raise exception 'invalid status transition: % -> %', old.status, new.status;
    end if;

    if new.status = 'IN_PROGRESS' then
      new.started_at := coalesce(new.started_at, now());
    elsif new.status = 'DONE' then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  end if;

  new.shop_id           := old.shop_id;
  new.customer_id       := old.customer_id;
  new.is_walk_in        := old.is_walk_in;
  new.booked_at         := old.booked_at;
  new.service_ids       := old.service_ids;
  new.services_snapshot := old.services_snapshot;
  new.total_amount      := old.total_amount;

  return new;
end; $function$;

-- AFTER INSERT: re-run the ETA formula for the chair the new booking landed on.
CREATE OR REPLACE FUNCTION public.serial_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.recalc_queue_estimates(new.chair_id);
  return new;
end; $function$;

-- AFTER UPDATE: (a) on a chair move, closes the position gap left in the OLD chair's lane
-- and recalculates both lanes; (b) on completion, feeds the actual elapsed time into each
-- performed service's rolling_avg_duration_min (70% old estimate / 30% this run, split
-- proportionally across the serial's services) — this is what estimate_duration_on_chair's
-- numbers are built from over time; (c) on cancel/no-show, compacts the remaining queue
-- positions on that chair; (d) any status exit or start re-runs the ETA formula for the
-- chair. The `queueflow.stats_write` config flag is a transaction-scoped unlock so this
-- trigger (and only this trigger) may write chair_service_stats.rolling_avg_duration_min —
-- a separate protective trigger (not captured here, wasn't part of this pull) is implied to
-- guard that column from being reset by ordinary owner-driven UPDATEs.
CREATE OR REPLACE FUNCTION public.serial_after_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actual integer;
  v_total  integer;
  svc      record;
begin
  if new.chair_id is distinct from old.chair_id then
    update public.serials
       set position = position - 1
     where chair_id = old.chair_id
       and status in ('WAITING', 'IN_PROGRESS')
       and position > old.position;

    perform public.recalc_queue_estimates(old.chair_id);
    perform public.recalc_queue_estimates(new.chair_id);
  end if;

  if new.status is distinct from old.status then

    if new.status = 'DONE' and new.started_at is not null then
      v_actual := greatest(1,
        round(extract(epoch from (new.completed_at - new.started_at)) / 60)::integer);

      select greatest(coalesce(sum(
               coalesce(css.rolling_avg_duration_min, s.default_duration_min)), 1), 1)
        into v_total
        from unnest(new.service_ids) as sid
        join public.services s on s.id = sid
        left join public.chair_service_stats css
          on css.chair_id = new.chair_id and css.service_id = sid;

      perform set_config('queueflow.stats_write', 'on', true);

      for svc in
        select s.id as service_id,
               coalesce(css.rolling_avg_duration_min, s.default_duration_min) as est
          from unnest(new.service_ids) as sid
          join public.services s on s.id = sid
          left join public.chair_service_stats css
            on css.chair_id = new.chair_id and css.service_id = sid
      loop
        insert into public.chair_service_stats
          (chair_id, service_id, can_perform, rolling_avg_duration_min, completed_count)
        values
          (new.chair_id, svc.service_id, true,
           greatest(1, round(0.7 * svc.est
                           + 0.3 * (v_actual * svc.est::numeric / v_total)))::integer,
           1)
        on conflict (chair_id, service_id) do update
          set rolling_avg_duration_min = greatest(1, round(
                0.7 * coalesce(public.chair_service_stats.rolling_avg_duration_min, svc.est)
              + 0.3 * (v_actual * svc.est::numeric / v_total)))::integer,
              completed_count = public.chair_service_stats.completed_count + 1,
              updated_at = now();
      end loop;
    end if;

    if new.status in ('CANCELLED', 'NO_SHOW') then
      update public.serials
         set position = position - 1
       where chair_id = new.chair_id
         and status in ('WAITING', 'IN_PROGRESS')
         and position > old.position;
    end if;

    perform public.recalc_queue_estimates(new.chair_id);
  end if;

  return new;
end; $function$;

-- Keeps the `queue_public` cache table (what customers' Explore/live-tracking screens
-- actually read) in sync: upserts while WAITING/IN_PROGRESS, removes once the serial exits
-- either state. Decouples the public queue view from `serials`'s full (customer-identifying)
-- row shape.
CREATE OR REPLACE FUNCTION public.sync_queue_public()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status in ('WAITING', 'IN_PROGRESS') then
    insert into public.queue_public
      (id, shop_id, chair_id, position, status, is_walk_in,
       estimated_duration_min, estimated_start_at, updated_at)
    values
      (new.id, new.shop_id, new.chair_id, new.position, new.status,
       new.is_walk_in, new.estimated_duration_min, new.estimated_start_at, now())
    on conflict (id) do update
      set chair_id               = excluded.chair_id,
          position               = excluded.position,
          status                 = excluded.status,
          estimated_duration_min = excluded.estimated_duration_min,
          estimated_start_at     = excluded.estimated_start_at,
          updated_at             = now();
  else
    delete from public.queue_public where id = new.id;
  end if;
  return new;
end; $function$;

-- Guards shops.owner_id: the referenced profile must have role = 'provider'.
CREATE OR REPLACE FUNCTION public.enforce_provider_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.owner_id and role = 'provider'
  ) then
    raise exception 'shop owner must have provider role';
  end if;
  return new;
end; $function$;

-- Hardening against privilege escalation: a profile's role is immutable after signup.
CREATE OR REPLACE FUNCTION public.lock_profile_role()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.role is distinct from old.role then
    raise exception 'profile role is immutable after signup';
  end if;
  return new;
end; $function$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS profiles_lock_role ON public.profiles;
CREATE TRIGGER profiles_lock_role BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION lock_profile_role();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS serials_before_insert ON public.serials;
CREATE TRIGGER serials_before_insert BEFORE INSERT ON public.serials
  FOR EACH ROW EXECUTE FUNCTION serial_before_insert();

DROP TRIGGER IF EXISTS serials_before_update ON public.serials;
CREATE TRIGGER serials_before_update BEFORE UPDATE ON public.serials
  FOR EACH ROW EXECUTE FUNCTION serial_before_update();

DROP TRIGGER IF EXISTS serials_after_insert ON public.serials;
CREATE TRIGGER serials_after_insert AFTER INSERT ON public.serials
  FOR EACH ROW EXECUTE FUNCTION serial_after_insert();

DROP TRIGGER IF EXISTS serials_after_update ON public.serials;
CREATE TRIGGER serials_after_update AFTER UPDATE ON public.serials
  FOR EACH ROW EXECUTE FUNCTION serial_after_update();

DROP TRIGGER IF EXISTS serials_sync_queue_public ON public.serials;
CREATE TRIGGER serials_sync_queue_public AFTER INSERT OR UPDATE ON public.serials
  FOR EACH ROW EXECUTE FUNCTION sync_queue_public();

DROP TRIGGER IF EXISTS serials_updated_at ON public.serials;
CREATE TRIGGER serials_updated_at BEFORE UPDATE ON public.serials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- notify_serial_event_trigger / notify_serial_event() are already defined by
-- 20260729_notifications.sql + later fixes in this repo — recreating the trigger wiring
-- here (not the function body) purely so this file's trigger list matches the live table.
DROP TRIGGER IF EXISTS notify_serial_event_trigger ON public.serials;
CREATE TRIGGER notify_serial_event_trigger AFTER INSERT OR UPDATE ON public.serials
  FOR EACH ROW EXECUTE FUNCTION notify_serial_event();

DROP TRIGGER IF EXISTS shops_enforce_provider_owner ON public.shops;
CREATE TRIGGER shops_enforce_provider_owner BEFORE INSERT OR UPDATE OF owner_id ON public.shops
  FOR EACH ROW EXECUTE FUNCTION enforce_provider_owner();

DROP TRIGGER IF EXISTS shops_updated_at ON public.shops;
CREATE TRIGGER shops_updated_at BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Constraints — one active serial per customer, one in-progress job per chair
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS one_active_serial_per_customer ON public.serials
  USING btree (customer_id)
  WHERE (status = ANY (ARRAY['WAITING'::serial_status, 'IN_PROGRESS'::serial_status])
         AND customer_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS one_in_progress_per_chair ON public.serials
  USING btree (chair_id)
  WHERE (status = 'IN_PROGRESS'::serial_status);

-- ---------------------------------------------------------------------------
-- RLS — shops / services / chairs / chair_service_stats / serials / profiles
-- ---------------------------------------------------------------------------
-- All 6 tables already have row_level_security enabled live; re-asserting is a no-op.

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chair_service_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- shops
DROP POLICY IF EXISTS "shops: public read" ON public.shops;
CREATE POLICY "shops: public read" ON public.shops FOR SELECT USING (true);

DROP POLICY IF EXISTS "shops: owner insert" ON public.shops;
CREATE POLICY "shops: owner insert" ON public.shops FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "shops: owner update" ON public.shops;
CREATE POLICY "shops: owner update" ON public.shops FOR UPDATE
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "shops: owner delete" ON public.shops;
CREATE POLICY "shops: owner delete" ON public.shops FOR DELETE USING (auth.uid() = owner_id);

-- services
DROP POLICY IF EXISTS "services: public read" ON public.services;
CREATE POLICY "services: public read" ON public.services FOR SELECT USING (true);

DROP POLICY IF EXISTS "services: owner write" ON public.services;
CREATE POLICY "services: owner write" ON public.services FOR INSERT WITH CHECK (is_shop_owner(shop_id));

DROP POLICY IF EXISTS "services: owner update" ON public.services;
CREATE POLICY "services: owner update" ON public.services FOR UPDATE
  USING (is_shop_owner(shop_id)) WITH CHECK (is_shop_owner(shop_id));

DROP POLICY IF EXISTS "services: owner delete" ON public.services;
CREATE POLICY "services: owner delete" ON public.services FOR DELETE USING (is_shop_owner(shop_id));

-- chairs
-- NOTE: "chairs: public read" (USING true, below) is a KNOWN BUG kept here only to mirror
-- what's live today — it makes "anyone can browse active chairs" (is_active = true)
-- meaningless, since Postgres OR-combines multiple permissive SELECT policies on the same
-- table/command. See the follow-up migration 20260730_fix_chairs_public_read_rls.sql, which
-- drops this policy so inactive chairs stop being publicly readable.
DROP POLICY IF EXISTS "chairs: public read" ON public.chairs;
CREATE POLICY "chairs: public read" ON public.chairs FOR SELECT USING (true);

DROP POLICY IF EXISTS "anyone can browse active chairs" ON public.chairs;
CREATE POLICY "anyone can browse active chairs" ON public.chairs FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "chairs: owner insert" ON public.chairs;
CREATE POLICY "chairs: owner insert" ON public.chairs FOR INSERT WITH CHECK (is_shop_owner(shop_id));

DROP POLICY IF EXISTS "chairs: owner update" ON public.chairs;
CREATE POLICY "chairs: owner update" ON public.chairs FOR UPDATE
  USING (is_shop_owner(shop_id)) WITH CHECK (is_shop_owner(shop_id));

DROP POLICY IF EXISTS "chairs: owner delete" ON public.chairs;
CREATE POLICY "chairs: owner delete" ON public.chairs FOR DELETE USING (is_shop_owner(shop_id));

-- chair_service_stats
DROP POLICY IF EXISTS "anyone can browse chair capabilities" ON public.chair_service_stats;
CREATE POLICY "anyone can browse chair capabilities" ON public.chair_service_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "css: public read" ON public.chair_service_stats;
CREATE POLICY "css: public read" ON public.chair_service_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "css: owner insert" ON public.chair_service_stats;
CREATE POLICY "css: owner insert" ON public.chair_service_stats FOR INSERT WITH CHECK (
  is_shop_owner((select chairs.shop_id from chairs where chairs.id = chair_service_stats.chair_id))
);

DROP POLICY IF EXISTS "css: owner update" ON public.chair_service_stats;
CREATE POLICY "css: owner update" ON public.chair_service_stats FOR UPDATE
  USING (is_shop_owner((select chairs.shop_id from chairs where chairs.id = chair_service_stats.chair_id)))
  WITH CHECK (is_shop_owner((select chairs.shop_id from chairs where chairs.id = chair_service_stats.chair_id)));

DROP POLICY IF EXISTS "css: owner delete" ON public.chair_service_stats;
CREATE POLICY "css: owner delete" ON public.chair_service_stats FOR DELETE USING (
  is_shop_owner((select chairs.shop_id from chairs where chairs.id = chair_service_stats.chair_id))
);

-- serials
DROP POLICY IF EXISTS "serials: parties read" ON public.serials;
CREATE POLICY "serials: parties read" ON public.serials FOR SELECT
  USING (customer_id = auth.uid() OR is_shop_owner(shop_id));

DROP POLICY IF EXISTS "serials: customer insert" ON public.serials;
CREATE POLICY "serials: customer insert" ON public.serials FOR INSERT
  WITH CHECK (auth.uid() = customer_id AND is_walk_in = false);

DROP POLICY IF EXISTS "serials: owner insert walk-in" ON public.serials;
CREATE POLICY "serials: owner insert walk-in" ON public.serials FOR INSERT
  WITH CHECK (is_shop_owner(shop_id) AND is_walk_in = true);

DROP POLICY IF EXISTS "serials: customer cancel own" ON public.serials;
CREATE POLICY "serials: customer cancel own" ON public.serials FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id AND status = 'CANCELLED');

DROP POLICY IF EXISTS "serials: owner manage" ON public.serials;
CREATE POLICY "serials: owner manage" ON public.serials FOR UPDATE
  USING (is_shop_owner(shop_id)) WITH CHECK (is_shop_owner(shop_id));

-- profiles
DROP POLICY IF EXISTS "profiles: read own" ON public.profiles;
CREATE POLICY "profiles: read own" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;
CREATE POLICY "profiles: update own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
