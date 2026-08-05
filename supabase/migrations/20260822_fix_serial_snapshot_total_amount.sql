-- Fix: bookings (both walk-in and online) were being created with an empty
-- services_snapshot and total_amount = 0 even when a valid, active service
-- was selected — confirmed live via a direct network-level repro (a real
-- Haircut service_id sent to POST /rest/v1/serials came back with
-- services_snapshot: [] and total_amount: 0.00, no error).
--
-- The captured baseline (20260730_capture_baseline_queue_engine.sql)'s copy
-- of serial_before_insert() reads correctly on paper — the snapshot query's
-- `join public.services s on s.id = sid` should never silently drop a row
-- that the validation check just above it already confirmed exists. Since
-- this project has repeatedly seen the live database drift from what's
-- captured in migrations (see 20260819/20260821's comments), the live
-- function is presumed to have diverged from this file. This migration
-- re-asserts the known-correct logic via CREATE OR REPLACE (overwrites
-- whatever is live, whatever it turned out to be) and adds a safety net:
-- if the snapshot ever again ends up short of the requested services, the
-- insert now fails loudly with a clear error instead of silently recording
-- a real job as a ৳0 booking.
--
-- Run this once in the Supabase dashboard's SQL editor. Safe to re-run.

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

  -- Safety net: the snapshot must cover every requested service. If it ever
  -- comes up short again (whatever the cause), fail loudly instead of
  -- silently recording a real job at ৳0.
  if jsonb_array_length(new.services_snapshot) <> cardinality(new.service_ids) then
    raise exception 'could not price all selected services — please try again';
  end if;

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
