-- Sprint 14: payment confirmation sheet (payment_method), manual time-extension
-- (extended_min), and customer avatar snapshot (customer_avatar_url) on serials.
--
-- Reconstructed during Sprint 17 prep: this file existed (correct filename,
-- referenced by DEVELOPMENT.md's Sprint 14 hand-off note) but was somehow
-- committed with no actual SQL in it (git history confirms — 1 byte, just
-- whitespace). That means these three columns most likely were never created
-- on the live project either, since there was nothing to run. Rebuilt from
-- the Sprint 14 notes + the current serial_before_insert/serial_after_update
-- bodies in 20260730_capture_baseline_queue_engine.sql.
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query).

alter table public.serials
  add column payment_method text,
  add column extended_min integer not null default 0,
  add column customer_avatar_url text;

-- serial_before_insert: snapshot the customer's avatar alongside the existing
-- name/phone snapshot — same cross-user-profile-read-avoidance reasoning as
-- customer_name/customer_phone (profiles RLS stays auth.uid() = id only).
-- Full function body reproduced (only the SELECT ... INTO line changes).
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
    select full_name, phone, avatar_url
      into new.customer_name, new.customer_phone, new.customer_avatar_url
      from public.profiles
     where id = new.customer_id;
  end if;

  return new;
end; $function$;

-- serial_after_update: also re-run the ETA formula when a running serial's
-- estimated_duration_min changes (manual time-extension, +5/+10/custom) —
-- previously only fired on status exit or chair move, so an extension left
-- every later customer's ETA stale until something else nudged it. Full
-- function body reproduced (only the new estimated_duration_min block at
-- the end is new).
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

  if new.estimated_duration_min is distinct from old.estimated_duration_min then
    perform public.recalc_queue_estimates(new.chair_id);
  end if;

  return new;
end; $function$;
