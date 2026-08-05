-- Sprint 28: "অপেক্ষার বাস্তবতা" — make the app's one promise ("you don't have to
-- sit in the shop and wait") actually true.
--
-- Run this once in the Supabase dashboard's SQL editor, AFTER the three admin
-- migrations (20260824 → 20260825 → 20260826).
--
-- Five things, all aimed at the same failure mode — the no-show:
--   1. the owner is finally told an online booking happened at all
--   2. the customer is told when to LEAVE, not just when their turn is
--   3. the customer can say "I'm here", so the owner stops guessing
--   4. NO_SHOW stops being a hair-trigger: you must call first, then wait
--   5. a late customer can be bumped one step back instead of destroyed
--
-- Design note (why no cron): every ETA in this system is recomputed by
-- recalc_queue_estimates() on each queue event, and notify_serial_event()
-- already re-scans a whole lane on every serial write. The "time to leave"
-- test rides along in that same scan, so this migration adds no scheduler,
-- no edge function and no new moving parts. The trade-off is honest and
-- documented: the check only runs when *something happens* in the lane
-- (a start, a done, a cancel, a time-extension), not on a wall-clock tick.
-- In a live shop those events land every few minutes, which is well inside
-- the tolerance of a "leave now" nudge.

-- ---------------------------------------------------------------------------
-- 1) columns
-- ---------------------------------------------------------------------------
alter table public.serials
  add column if not exists arrived_at        timestamptz,
  add column if not exists called_at         timestamptz,
  add column if not exists travel_min        integer,
  add column if not exists notified_leave_at timestamptz;

comment on column public.serials.arrived_at is
  'Customer tapped "I have arrived" — set only via mark_serial_arrived().';
comment on column public.serials.called_at is
  'Provider tapped "called" — starts the grace window before NO_SHOW unlocks.';
comment on column public.serials.travel_min is
  'Minutes from the customer to the shop, captured at booking time from their
   device location. NULL = location was unavailable, so no leave-now nudge.';

-- Three shop states instead of two. is_open stays the master switch
-- (closed = invisible to customers, unchanged); accepting_new is the softer
-- "finish who is already here, take nobody new" that shop owners actually
-- need at closing time, and break_until is the prayer/lunch pause that has
-- to push every ETA in the shop back.
alter table public.shops
  add column if not exists accepting_new boolean not null default true,
  add column if not exists break_until   timestamptz,
  add column if not exists break_reason  text;

-- ---------------------------------------------------------------------------
-- 2) notification types
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'SERIAL_CONFIRMED', 'QUEUE_UPDATE', 'YOUR_TURN',
    'CANCELLED', 'PROMO', 'REMINDER', 'SYSTEM',
    'NEW_BOOKING', 'LEAVE_NOW'
  ));

-- ---------------------------------------------------------------------------
-- 3) recalc_queue_estimates — now break-aware
-- ---------------------------------------------------------------------------
-- Verbatim copy of 20260820's version with ONE change: the cursor starts at
-- (and never falls behind) the shop's break_until, so a 20-minute prayer break
-- pushes the whole lane back by itself. A job already running is unaffected —
-- the break applies to what has not started yet.
CREATE OR REPLACE FUNCTION public.recalc_queue_estimates(p_chair_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r            record;
  v_resume_at  timestamptz;
  cursor_time  timestamptz;
begin
  -- NEW (Sprint 28): a shop on break cannot start anyone before it is back.
  select greatest(now(), coalesce(sh.break_until, now()))
    into v_resume_at
    from public.chairs c
    join public.shops  sh on sh.id = c.shop_id
   where c.id = p_chair_id;

  cursor_time := coalesce(v_resume_at, now());

  for r in
    select id, status, estimated_duration_min, started_at
    from public.serials
    where chair_id = p_chair_id
      and status in ('IN_PROGRESS', 'WAITING')
    order by position
  loop
    if r.status = 'IN_PROGRESS' then
      update public.serials
         set estimated_start_at = coalesce(r.started_at, now())
       where id = r.id;
      cursor_time := greatest(
        coalesce(r.started_at, now())
          + make_interval(mins => r.estimated_duration_min),
        now() + interval '1 minute',
        cursor_time);
    else
      update public.serials
         set estimated_start_at = cursor_time
       where id = r.id;
      cursor_time := cursor_time + make_interval(mins => r.estimated_duration_min);
    end if;
  end loop;
end; $function$;

-- ---------------------------------------------------------------------------
-- 4) serial_before_insert — honour accepting_new, sanitise travel_min
-- ---------------------------------------------------------------------------
-- Verbatim copy of the current version (20260822, which added the ৳0-snapshot
-- safety net) with TWO changes, both marked below.
CREATE OR REPLACE FUNCTION public.serial_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
  v_shop  record;
begin
  select is_open, accepting_new into v_shop
    from public.shops where id = new.shop_id;

  if v_shop is null or not v_shop.is_open then
    raise exception 'shop is not open';
  end if;

  -- CHANGED (Sprint 28): "not accepting new" stops online bookings only. The
  -- owner adding a walk-in is exactly what this state is for — he is working
  -- through the people already in front of him.
  if not v_shop.accepting_new and not coalesce(new.is_walk_in, false) then
    raise exception 'shop is not accepting new bookings';
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

  -- CHANGED (Sprint 28): travel_min arrives from the client, so clamp it.
  -- A junk value here would mean a leave-now nudge at the wrong moment, or
  -- one fired the instant the booking lands.
  if new.travel_min is not null then
    new.travel_min := least(greatest(new.travel_min, 0), 240);
  end if;
  new.arrived_at        := null;
  new.called_at         := null;
  new.notified_leave_at := null;

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

  -- Safety net (20260822): the snapshot must cover every requested service.
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

-- ---------------------------------------------------------------------------
-- 5) serial_before_update — NO_SHOW needs a call first; travel_min is frozen
-- ---------------------------------------------------------------------------
-- Verbatim copy of 20260826's version (which itself copied the baseline and
-- added the admin anonymisation exception) with TWO changes, marked below.
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

    -- CHANGED (Sprint 28): a no-show is a claim about the customer's
    -- behaviour, and it costs them their trust score — so it has to be
    -- earned. You must have called them, and the grace window must have
    -- run out. "I know they aren't coming" is a CANCELLED, not a NO_SHOW.
    if new.status = 'NO_SHOW' then
      if old.called_at is null then
        raise exception 'no_show_requires_call';
      end if;
      if now() < old.called_at + interval '5 minutes' then
        raise exception 'no_show_grace_period';
      end if;
    end if;

    if new.status = 'IN_PROGRESS' then
      new.started_at := coalesce(new.started_at, now());
    elsif new.status = 'DONE' then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  end if;

  new.shop_id           := old.shop_id;
  -- customer_id stays immutable for everyone except a platform admin clearing
  -- it — that is the account-deletion anonymisation path (Sprint 27).
  if not (new.customer_id is null
          and old.customer_id is not null
          and public.is_platform_admin()) then
    new.customer_id := old.customer_id;
  end if;
  new.is_walk_in        := old.is_walk_in;
  new.booked_at         := old.booked_at;
  new.service_ids       := old.service_ids;
  new.services_snapshot := old.services_snapshot;
  new.total_amount      := old.total_amount;
  -- CHANGED (Sprint 28): distance is a booking-time fact, not something a
  -- later write may quietly re-state.
  new.travel_min        := old.travel_min;

  return new;
end; $function$;

-- ---------------------------------------------------------------------------
-- 6) notify_serial_event — the owner gets told, and "leave now" rides along
-- ---------------------------------------------------------------------------
-- Copy of 20260807's version with TWO additions, marked below.
create or replace function public.notify_serial_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ahead_count integer;
  r           record;
  v_owner     uuid;
  v_shop_name text;
begin
  select sh.owner_id, sh.name into v_owner, v_shop_name
    from public.shops sh where sh.id = new.shop_id;

  if TG_OP = 'INSERT' then
    if new.customer_id is not null
       and public.notification_enabled(new.customer_id, 'SERIAL_CONFIRMED') then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        new.customer_id,
        'SERIAL_CONFIRMED',
        'তোমার সিরিয়াল কনফার্ম হয়েছে',
        'সিরিয়াল #' || new.position || ' — বুকিং কনফার্ম হয়েছে।',
        jsonb_build_object('serial_id', new.id, 'shop_id', new.shop_id)
      );
    end if;

    -- NEW (Sprint 28): tell the shop owner. Until now nothing did — the owner
    -- had to keep the dashboard open to learn that an online booking existed,
    -- which is impossible while he is cutting hair. Walk-ins are excluded:
    -- he is the one who just typed it in.
    if not new.is_walk_in and v_owner is not null
       and public.notification_enabled(v_owner, 'NEW_BOOKING') then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        v_owner,
        'NEW_BOOKING',
        'নতুন অনলাইন সিরিয়াল',
        coalesce(new.customer_name, 'একজন কাস্টমার') || ' সিরিয়াল #'
          || new.position || ' নিয়েছে।',
        jsonb_build_object('serial_id', new.id, 'shop_id', new.shop_id)
      );
    end if;

  elsif new.customer_id is not null then
    if new.status = 'IN_PROGRESS' and old.status is distinct from 'IN_PROGRESS'
       and new.notified_turn_at is null then
      if public.notification_enabled(new.customer_id, 'YOUR_TURN') then
        insert into public.notifications (user_id, type, title, body, data)
        values (
          new.customer_id,
          'YOUR_TURN',
          'এখন তোমার পালা',
          'সিরিয়াল #' || new.position || ' — এখন তোমার সার্ভিস শুরু হচ্ছে।',
          jsonb_build_object('serial_id', new.id, 'shop_id', new.shop_id)
        );
      end if;
      update public.serials set notified_turn_at = now() where id = new.id;
    elsif new.status in ('CANCELLED', 'NO_SHOW') and old.status is distinct from new.status then
      if public.notification_enabled(new.customer_id, 'CANCELLED') then
        insert into public.notifications (user_id, type, title, body, data)
        values (
          new.customer_id,
          'CANCELLED',
          'সিরিয়াল বাতিল হয়েছে',
          'সিরিয়াল #' || new.position || ' বাতিল হয়ে গেছে।',
          jsonb_build_object('serial_id', new.id, 'shop_id', new.shop_id)
        );
      end if;

      -- NEW (Sprint 28): a customer walking away from the queue is news the
      -- owner can act on (call the next person in early). Only when the
      -- customer themselves did it — the owner cancelling doesn't need to be
      -- told he cancelled.
      if new.status = 'CANCELLED' and v_owner is not null
         and auth.uid() is not distinct from new.customer_id
         and public.notification_enabled(v_owner, 'NEW_BOOKING') then
        insert into public.notifications (user_id, type, title, body, data)
        values (
          v_owner,
          'NEW_BOOKING',
          'একটা সিরিয়াল বাতিল হয়েছে',
          coalesce(new.customer_name, 'একজন কাস্টমার') || ' সিরিয়াল #'
            || new.position || ' বাতিল করেছে।',
          jsonb_build_object('serial_id', new.id, 'shop_id', new.shop_id)
        );
      end if;
    end if;
  end if;

  for r in
    select s.*
    from public.serials s
    where s.shop_id = new.shop_id
      and s.chair_id = new.chair_id
      and s.status = 'WAITING'
      and s.customer_id is not null
      -- CHANGED (Sprint 28): notified_leave_at joins the guard set, otherwise
      -- a row that already got both queue nudges would never be tested for
      -- "time to leave".
      and (s.notified_two_ahead_at is null
        or s.notified_turn_at is null
        or s.notified_leave_at is null)
  loop
    select count(*) into ahead_count
    from public.serials s2
    where s2.shop_id = r.shop_id
      and s2.chair_id = r.chair_id
      and s2.id <> r.id
      and s2.status in ('WAITING', 'IN_PROGRESS')
      and s2.position < r.position;

    -- NEW (Sprint 28): the whole point of the product. Knowing "you're 3rd"
    -- is useless on its own — what a customer needs is "start walking now".
    -- travel_min + a 5-minute buffer, fired once.
    if r.notified_leave_at is null
       and r.travel_min is not null
       and r.estimated_start_at is not null
       and r.estimated_start_at - now() <= make_interval(mins => r.travel_min + 5)
    then
      if public.notification_enabled(r.customer_id, 'LEAVE_NOW') then
        insert into public.notifications (user_id, type, title, body, data)
        values (
          r.customer_id,
          'LEAVE_NOW',
          'এখন রওনা দাও',
          coalesce(v_shop_name, 'দোকান') || ' পৌঁছাতে তোমার প্রায় '
            || r.travel_min || ' মিনিট লাগবে — সিরিয়াল #' || r.position
            || ' এর পালা প্রায় চলে এসেছে।',
          jsonb_build_object('serial_id', r.id, 'shop_id', r.shop_id)
        );
      end if;
      update public.serials set notified_leave_at = now() where id = r.id;
    end if;

    if ahead_count = 2 and r.notified_two_ahead_at is null then
      if public.notification_enabled(r.customer_id, 'QUEUE_UPDATE') then
        insert into public.notifications (user_id, type, title, body, data)
        values (
          r.customer_id,
          'QUEUE_UPDATE',
          'তোমার আগে আর ২ জন',
          'সিরিয়াল #' || r.position || ' — শীঘ্রই তোমার পালা আসছে।',
          jsonb_build_object('serial_id', r.id, 'shop_id', r.shop_id)
        );
      end if;
      update public.serials set notified_two_ahead_at = now() where id = r.id;
    end if;

    if ahead_count = 0 and r.notified_turn_at is null then
      if public.notification_enabled(r.customer_id, 'YOUR_TURN') then
        insert into public.notifications (user_id, type, title, body, data)
        values (
          r.customer_id,
          'YOUR_TURN',
          'এখন তোমার পালা',
          'সিরিয়াল #' || r.position || ' — এখন গিয়ে দেখাও।',
          jsonb_build_object('serial_id', r.id, 'shop_id', r.shop_id)
        );
      end if;
      update public.serials set notified_turn_at = now() where id = r.id;
    end if;
  end loop;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) mark_serial_arrived — the customer says "I'm here"
-- ---------------------------------------------------------------------------
-- Has to be an RPC: the customer's own UPDATE policy on serials only permits
-- a write whose result is status = 'CANCELLED', so there is deliberately no
-- path for them to set an arbitrary column.
create or replace function public.mark_serial_arrived(p_serial_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serial record;
begin
  select * into v_serial from public.serials where id = p_serial_id;
  if v_serial is null then
    raise exception 'serial not found';
  end if;
  if v_serial.customer_id is distinct from auth.uid() then
    raise exception 'not your serial';
  end if;
  if v_serial.status <> 'WAITING' then
    raise exception 'serial is not waiting';
  end if;

  if v_serial.arrived_at is null then
    update public.serials set arrived_at = now() where id = p_serial_id;
  end if;
end; $$;

grant execute on function public.mark_serial_arrived(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) mark_serial_called — starts the grace window, and tells the customer
-- ---------------------------------------------------------------------------
create or replace function public.mark_serial_called(p_serial_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serial record;
begin
  select * into v_serial from public.serials where id = p_serial_id;
  if v_serial is null then
    raise exception 'serial not found';
  end if;
  if not public.is_shop_owner(v_serial.shop_id) then
    raise exception 'not your shop';
  end if;
  if v_serial.status <> 'WAITING' then
    raise exception 'serial is not waiting';
  end if;

  if v_serial.called_at is null then
    update public.serials set called_at = now() where id = p_serial_id;

    if v_serial.customer_id is not null
       and public.notification_enabled(v_serial.customer_id, 'YOUR_TURN') then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        v_serial.customer_id,
        'YOUR_TURN',
        'দোকান থেকে ডাকা হয়েছে',
        'সিরিয়াল #' || v_serial.position || ' — দোকানে গিয়ে দেখাও।',
        jsonb_build_object('serial_id', v_serial.id, 'shop_id', v_serial.shop_id)
      );
    end if;
  end if;
end; $$;

grant execute on function public.mark_serial_called(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9) bump_serial_back — "he's on his way, you go first"
-- ---------------------------------------------------------------------------
-- What every real shop does for a customer who is two minutes away, and what
-- this system had no way to express: the only tool was NO_SHOW, which ends
-- the booking and marks the customer's record. This swaps the serial with the
-- next waiting one on the same chair and re-runs the ETA formula, so both
-- customers see the truth immediately.
create or replace function public.bump_serial_back(p_serial_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serial record;
  v_next   record;
begin
  select * into v_serial from public.serials where id = p_serial_id;
  if v_serial is null then
    raise exception 'serial not found';
  end if;
  if not public.is_shop_owner(v_serial.shop_id) then
    raise exception 'not your shop';
  end if;
  if v_serial.status <> 'WAITING' then
    raise exception 'serial is not waiting';
  end if;

  perform pg_advisory_xact_lock(hashtext('chair:' || v_serial.chair_id::text));

  select * into v_next
    from public.serials
   where chair_id = v_serial.chair_id
     and status = 'WAITING'
     and position > v_serial.position
   order by position
   limit 1;

  if v_next is null then
    raise exception 'nothing_to_bump';
  end if;

  update public.serials set position = v_serial.position where id = v_next.id;
  update public.serials set position = v_next.position   where id = v_serial.id;

  perform public.recalc_queue_estimates(v_serial.chair_id);

  if v_serial.customer_id is not null
     and public.notification_enabled(v_serial.customer_id, 'QUEUE_UPDATE') then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_serial.customer_id,
      'QUEUE_UPDATE',
      'তোমার পালা একধাপ পিছিয়েছে',
      'তোমার পালা এসেছিলো — দোকান তোমাকে একধাপ পিছিয়ে দিয়েছে, একটু পরেই ডাকবে।',
      jsonb_build_object('serial_id', v_serial.id, 'shop_id', v_serial.shop_id)
    );
  end if;
end; $$;

grant execute on function public.bump_serial_back(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) set_shop_break — pause and resume, with the ETAs following along
-- ---------------------------------------------------------------------------
-- The owner could update shops.break_until directly (his own row, his own
-- policy), but nothing would recompute the queue until the next serial event,
-- so customers would sit on stale ETAs through the entire break. This sets the
-- column and re-runs the formula for every chair in one call.
create or replace function public.set_shop_break(
  p_shop_id uuid,
  p_minutes integer,
  p_reason  text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_until timestamptz;
  c       record;
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'not your shop';
  end if;

  -- 0 (or less) ends the break early.
  if p_minutes is null or p_minutes <= 0 then
    v_until := null;
  else
    v_until := now() + make_interval(mins => least(p_minutes, 480));
  end if;

  update public.shops
     set break_until  = v_until,
         break_reason = case when v_until is null then null else p_reason end
   where id = p_shop_id;

  for c in select id from public.chairs where shop_id = p_shop_id loop
    perform public.recalc_queue_estimates(c.id);
  end loop;

  return v_until;
end; $$;

grant execute on function public.set_shop_break(uuid, integer, text) to authenticated;
