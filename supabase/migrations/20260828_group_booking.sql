-- Sprint 29: group booking — "একসাথে কয়জন?"
--
-- Run this once in the Supabase SQL editor, AFTER 20260827_wait_reality.sql.
--
-- The problem: one_active_serial_per_customer is global, so a father cannot
-- take a serial for himself and his two sons — the single most ordinary scene
-- in a barbershop. Until now the only way through was to walk in and have the
-- owner add them by hand, which is precisely the errand the app exists to
-- remove.
--
-- The shape of the fix:
--   * a party is N ordinary serial rows sharing a group_id, numbered by
--     party_seq. They stay ordinary rows on purpose — the board, the ETA
--     formula, income, reviews and the due ledger all keep working with no
--     knowledge of groups at all.
--   * the "one active booking per customer" rule survives intact, just
--     re-expressed: it now applies to the party LEAD (party_seq = 1). One
--     lead per customer ⇒ one party per customer. Same index name, same
--     violation text, so every client-side translation still matches.
--   * creation goes through create_group_booking() rather than N inserts
--     from the browser, because a party half-created by a dropped connection
--     is worse than no party at all.

-- ---------------------------------------------------------------------------
-- 1) columns
-- ---------------------------------------------------------------------------
alter table public.serials
  add column if not exists group_id           uuid,
  add column if not exists party_seq          integer,
  add column if not exists party_member_name  text;

comment on column public.serials.group_id is
  'Shared by every serial booked together in one party. NULL = a solo booking,
   which behaves exactly as it did before Sprint 29.';
comment on column public.serials.party_seq is
  '1-based position within the party. 1 = the lead, the row that carries the
   one-active-booking-per-customer rule for the whole group.';
comment on column public.serials.party_member_name is
  'Who this row is for ("ছেলে", "ভাই"). customer_name stays the booker
   throughout, so phone, chat and history keep pointing at the real account.';

create index if not exists serials_group_id_idx
  on public.serials (group_id) where group_id is not null;

-- ---------------------------------------------------------------------------
-- 2) the one-active-booking rule, re-expressed
-- ---------------------------------------------------------------------------
-- Deliberately the same index NAME as the baseline's: db-errors.ts matches on
-- that string to produce "you already have a serial running", and a party that
-- tripped this should still say exactly that.
drop index if exists public.one_active_serial_per_customer;

create unique index one_active_serial_per_customer on public.serials
  using btree (customer_id)
  where (status = any (array['WAITING'::serial_status, 'IN_PROGRESS'::serial_status])
         and customer_id is not null
         and coalesce(party_seq, 1) = 1);

-- ---------------------------------------------------------------------------
-- 3) serial_before_insert — party integrity
-- ---------------------------------------------------------------------------
-- Copy of 20260827's version with ONE added block, marked below.
--
-- The index above only guards leads. Without this check, a hand-written
-- request could set party_seq = 2 and book unlimited serials, since nothing
-- would be unique about it. So a follower must prove its lead exists: same
-- group, same customer, same shop, still active.
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

  if not v_shop.accepting_new and not coalesce(new.is_walk_in, false) then
    raise exception 'shop is not accepting new bookings';
  end if;

  -- NEW (Sprint 29): a party follower is only legitimate next to its lead.
  if new.group_id is not null then
    if coalesce(new.party_seq, 0) < 1 or new.party_seq > 5 then
      raise exception 'invalid_party_size';
    end if;
    if new.party_seq > 1 and not exists (
      select 1 from public.serials
       where group_id    = new.group_id
         and party_seq   = 1
         and customer_id is not distinct from new.customer_id
         and shop_id     = new.shop_id
         and status in ('WAITING', 'IN_PROGRESS')
    ) then
      raise exception 'party_lead_missing';
    end if;
    new.party_member_name := nullif(btrim(coalesce(new.party_member_name, '')), '');
  else
    new.party_seq         := null;
    new.party_member_name := null;
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

  -- customer_name stays the account holder's even for a party member: it is
  -- what the phone number, the chat thread and the history all belong to.
  -- party_member_name is the display override, applied in the UI.
  if new.is_walk_in = false then
    select full_name, phone
      into new.customer_name, new.customer_phone
      from public.profiles
     where id = new.customer_id;
  end if;

  return new;
end; $function$;

-- ---------------------------------------------------------------------------
-- 4) serial_before_update — party columns are booking-time facts
-- ---------------------------------------------------------------------------
-- Copy of 20260827's version with ONE added line group, marked below.
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
  new.travel_min        := old.travel_min;
  -- CHANGED (Sprint 29): party membership is decided once, at booking. A row
  -- that could drift between groups would let the lead rule be sidestepped.
  new.group_id          := old.group_id;
  new.party_seq         := old.party_seq;
  new.party_member_name := old.party_member_name;

  return new;
end; $function$;

-- ---------------------------------------------------------------------------
-- 5) notify_serial_event — one party, one set of messages
-- ---------------------------------------------------------------------------
-- Copy of 20260827's version with the group guards marked below.
--
-- Without these, booking for three people would fire three "serial confirmed"
-- pushes at the booker and three "new booking" pushes at the owner, for what
-- both of them experience as a single event. create_group_booking() sends the
-- one message each instead, once the whole party is in.
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
  v_is_lead   boolean;
begin
  select sh.owner_id, sh.name into v_owner, v_shop_name
    from public.shops sh where sh.id = new.shop_id;

  if TG_OP = 'INSERT' then
    -- CHANGED (Sprint 29): party rows are announced by create_group_booking()
    -- as one event, not row by row.
    if new.group_id is null then
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
    end if;

  elsif new.customer_id is not null then
    if new.status = 'IN_PROGRESS' and old.status is distinct from 'IN_PROGRESS'
       and new.notified_turn_at is null then
      if public.notification_enabled(new.customer_id, 'YOUR_TURN') then
        insert into public.notifications (user_id, type, title, body, data)
        values (
          new.customer_id,
          'YOUR_TURN',
          case when new.party_member_name is not null
               then new.party_member_name || '-এর পালা এসেছে'
               else 'এখন তোমার পালা' end,
          'সিরিয়াল #' || new.position || ' — এখন সার্ভিস শুরু হচ্ছে।',
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
          coalesce(new.party_member_name || '-এর সিরিয়াল #', 'সিরিয়াল #')
            || new.position || ' বাতিল হয়ে গেছে।',
          jsonb_build_object('serial_id', new.id, 'shop_id', new.shop_id)
        );
      end if;

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
      and (s.notified_two_ahead_at is null
        or s.notified_turn_at is null
        or s.notified_leave_at is null)
  loop
    -- CHANGED (Sprint 29): a party travels together and queues together, so
    -- the "2 ahead" and "time to leave" nudges belong to the lead alone.
    -- Followers get their guards stamped so they leave the scan set. (A
    -- "your turn" is still per person — that one is genuinely each member's.)
    v_is_lead := (r.group_id is null or r.party_seq = 1);

    select count(*) into ahead_count
    from public.serials s2
    where s2.shop_id = r.shop_id
      and s2.chair_id = r.chair_id
      and s2.id <> r.id
      and s2.status in ('WAITING', 'IN_PROGRESS')
      and s2.position < r.position;

    if r.notified_leave_at is null
       and r.travel_min is not null
       and r.estimated_start_at is not null
       and r.estimated_start_at - now() <= make_interval(mins => r.travel_min + 5)
    then
      if v_is_lead and public.notification_enabled(r.customer_id, 'LEAVE_NOW') then
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
      if v_is_lead and public.notification_enabled(r.customer_id, 'QUEUE_UPDATE') then
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
          case when r.party_member_name is not null
               then r.party_member_name || '-এর পালা এসেছে'
               else 'এখন তোমার পালা' end,
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
-- 6) create_group_booking — the whole party, or none of it
-- ---------------------------------------------------------------------------
-- p_members: [{"name": "ছেলে", "service_ids": ["uuid", ...]}, ...]
--
-- Each member is inserted separately and, when no chair was requested, each
-- one runs assign_best_chair against the queue as it stands after the previous
-- insert. That spreads a family across free chairs instead of stacking them
-- behind one another, which is what a shop with three barbers would actually
-- do — the party finishes in a third of the time.
create or replace function public.create_group_booking(
  p_shop_id    uuid,
  p_members    jsonb,
  p_chair_id   uuid    default null,
  p_travel_min integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_group_id   uuid := gen_random_uuid();
  v_size       integer;
  v_owner      uuid;
  v_name       text;
  v_member     jsonb;
  v_seq        integer := 0;
  v_service_id text;
  v_services   uuid[];
  v_first_pos  integer;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  v_size := jsonb_array_length(p_members);
  if v_size is null or v_size < 2 or v_size > 5 then
    raise exception 'invalid_party_size';
  end if;

  -- One party at a time per customer. The unique index on leads is the real
  -- guarantee; this lock just turns a double-tap into a clean second attempt
  -- instead of a half-inserted party rolled back mid-loop.
  perform pg_advisory_xact_lock(hashtext('party:' || v_uid::text));

  select owner_id into v_owner from public.shops where id = p_shop_id;

  for v_member in select * from jsonb_array_elements(p_members)
  loop
    v_seq := v_seq + 1;

    v_services := array(
      select (value #>> '{}')::uuid
      from jsonb_array_elements(v_member -> 'service_ids')
    );
    if coalesce(array_length(v_services, 1), 0) = 0 then
      raise exception 'invalid service selection for this shop';
    end if;

    insert into public.serials (
      shop_id, customer_id, service_ids, is_walk_in, chair_id,
      travel_min, group_id, party_seq, party_member_name
    ) values (
      p_shop_id, v_uid, v_services, false, p_chair_id,
      p_travel_min, v_group_id, v_seq,
      nullif(btrim(coalesce(v_member ->> 'name', '')), '')
    );
  end loop;

  select min(position) into v_first_pos
    from public.serials where group_id = v_group_id;

  select full_name into v_name from public.profiles where id = v_uid;

  -- One booking, so one confirmation and one alert to the shop — however many
  -- chairs the party ended up spread across.
  if public.notification_enabled(v_uid, 'SERIAL_CONFIRMED') then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_uid,
      'SERIAL_CONFIRMED',
      v_size || ' জনের সিরিয়াল কনফার্ম হয়েছে',
      'তোমাদের সবার বুকিং কনফার্ম হয়েছে — লাইভ ট্র্যাকিংয়ে সবার সময় দেখা যাবে।',
      jsonb_build_object('group_id', v_group_id, 'shop_id', p_shop_id)
    );
  end if;

  if v_owner is not null and public.notification_enabled(v_owner, 'NEW_BOOKING') then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_owner,
      'NEW_BOOKING',
      v_size || ' জনের নতুন অনলাইন সিরিয়াল',
      coalesce(v_name, 'একজন কাস্টমার') || ' ' || v_size
        || ' জনের জন্য সিরিয়াল নিয়েছে (#' || coalesce(v_first_pos, 0) || ' থেকে)।',
      jsonb_build_object('group_id', v_group_id, 'shop_id', p_shop_id)
    );
  end if;

  return v_group_id;
end; $$;

grant execute on function public.create_group_booking(uuid, jsonb, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) cancel_my_group — leaving as a party
-- ---------------------------------------------------------------------------
-- Cancelling members one at a time already works through the ordinary
-- per-row policy; this is for "we're not coming at all", which otherwise
-- means three separate confirmations for one decision.
create or replace function public.cancel_my_group(p_group_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer := 0;
  r       record;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  for r in
    select id from public.serials
     where group_id = p_group_id
       and customer_id = v_uid
       and status = 'WAITING'
     order by party_seq desc
  loop
    update public.serials set status = 'CANCELLED' where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end; $$;

grant execute on function public.cancel_my_group(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) settle_group_dues — one wallet, one payment
-- ---------------------------------------------------------------------------
-- A party is billed as separate jobs because that is what they are: different
-- chairs, different services, finishing at different times. But one person
-- pays for all of them at the counter. This lets the owner clear whatever the
-- rest of the party still owes at the moment he takes that payment, instead
-- of chasing each row through the due ledger afterwards.
create or replace function public.settle_group_dues(
  p_group_id uuid,
  p_method   text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
  v_count   integer;
begin
  select shop_id into v_shop_id
    from public.serials where group_id = p_group_id limit 1;

  if v_shop_id is null then
    raise exception 'group not found';
  end if;
  if not public.is_shop_owner(v_shop_id) then
    raise exception 'not your shop';
  end if;

  with settled as (
    update public.serials
       set payment_status   = 'PAID',
           payment_method   = p_method,
           due_amount       = 0,
           due_collected_at = now()
     where group_id = p_group_id
       and status = 'DONE'
       and payment_status = 'DUE'
    returning 1
  )
  select count(*) into v_count from settled;

  return coalesce(v_count, 0);
end; $$;

grant execute on function public.settle_group_dues(uuid, text) to authenticated;
