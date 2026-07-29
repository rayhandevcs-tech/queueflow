-- Fix for 20260729_notifications.sql, applied right after it.
-- Run this once in the Supabase dashboard's SQL editor.
--
-- Bug found via live testing: notify_serial_event_trigger was a BEFORE
-- trigger. This table's existing chair/position/ETA-assignment trigger(s)
-- (defined outside these migration files) also fire BEFORE INSERT, and
-- Postgres runs same-timing triggers in alphabetical order by trigger name
-- — unknown/unpredictable relative to ours. That let our trigger read
-- new.position while it was still unset, producing a NULL notification
-- body, which violated the `body text not null` constraint and made every
-- new booking fail with "কিছু একটা ভুল হয়েছে".
--
-- Fix: switch to an AFTER trigger (always sees the row's fully-resolved
-- final values) and persist the guard columns via a self-referencing
-- UPDATE instead of mutating NEW (which only works in BEFORE triggers).
-- That UPDATE recursively re-fires this trigger once, but the guard column
-- is already set by then, so the `is null` check stops it immediately.

drop trigger if exists notify_serial_event_trigger on public.serials;

create or replace function public.notify_serial_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ahead_count integer;
begin
  if TG_OP = 'INSERT' then
    if new.customer_id is not null then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        new.customer_id,
        'SERIAL_CONFIRMED',
        'তোমার সিরিয়াল কনফার্ম হয়েছে',
        'সিরিয়াল #' || new.position || ' — বুকিং কনফার্ম হয়েছে।',
        jsonb_build_object('serial_id', new.id, 'shop_id', new.shop_id)
      );
    end if;
    return new;
  end if;

  -- TG_OP = 'UPDATE'
  if new.customer_id is null then
    return new;
  end if;

  if new.status = 'WAITING' then
    select count(*) into ahead_count
    from public.serials s
    where s.shop_id = new.shop_id
      and s.chair_id = new.chair_id
      and s.id <> new.id
      and s.status in ('WAITING', 'IN_PROGRESS')
      and s.position < new.position;

    if ahead_count = 2 and new.notified_two_ahead_at is null then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        new.customer_id,
        'QUEUE_UPDATE',
        'তোমার আগে আর ২ জন',
        'সিরিয়াল #' || new.position || ' — শীঘ্রই তোমার পালা আসছে।',
        jsonb_build_object('serial_id', new.id, 'shop_id', new.shop_id)
      );
      update public.serials set notified_two_ahead_at = now() where id = new.id;
    end if;

    if ahead_count = 0 and new.notified_turn_at is null then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        new.customer_id,
        'YOUR_TURN',
        'এখন তোমার পালা',
        'সিরিয়াল #' || new.position || ' — এখন গিয়ে দেখাও।',
        jsonb_build_object('serial_id', new.id, 'shop_id', new.shop_id)
      );
      update public.serials set notified_turn_at = now() where id = new.id;
    end if;

  elsif new.status = 'IN_PROGRESS' and old.status is distinct from 'IN_PROGRESS'
        and new.notified_turn_at is null then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.customer_id,
      'YOUR_TURN',
      'এখন তোমার পালা',
      'সিরিয়াল #' || new.position || ' — এখন তোমার সার্ভিস শুরু হচ্ছে।',
      jsonb_build_object('serial_id', new.id, 'shop_id', new.shop_id)
    );
    update public.serials set notified_turn_at = now() where id = new.id;

  elsif new.status in ('CANCELLED', 'NO_SHOW') and old.status is distinct from new.status then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.customer_id,
      'CANCELLED',
      'সিরিয়াল বাতিল হয়েছে',
      'সিরিয়াল #' || new.position || ' বাতিল হয়ে গেছে।',
      jsonb_build_object('serial_id', new.id, 'shop_id', new.shop_id)
    );
  end if;

  return new;
end;
$$;

create trigger notify_serial_event_trigger
  after insert or update on public.serials
  for each row
  execute function public.notify_serial_event();
