-- Second round of fixes for 20260729_notifications.sql / 20260729b, found via
-- live two-browser testing. Run this once in the Supabase dashboard's SQL editor.
--
-- Bug 1 — YOUR_TURN never fired: notify_serial_event only re-checked NEW's
-- own row. But when the person at the front of a chair's queue finishes,
-- everyone else's ahead-count changes even though *their* row was never
-- written — a row-level trigger only fires for the row that changed. Fix:
-- after handling NEW's own transition, re-scan every other still-WAITING
-- row in the same chair and fire QUEUE_UPDATE/YOUR_TURN for whichever ones
-- newly qualify.
--
-- Bug 2 — every broadcast call failed immediately (even the very first of
-- the day, before any rate-limit could apply): SECURITY DEFINER doesn't
-- imply callable — Postgres still checks EXECUTE privilege for the calling
-- role first, and this project revokes the default PUBLIC execute on new
-- functions. Fix: explicit grant to `authenticated`.

create or replace function public.notify_serial_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ahead_count integer;
  r record;
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
  elsif new.customer_id is not null then
    if new.status = 'IN_PROGRESS' and old.status is distinct from 'IN_PROGRESS'
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
  end if;

  for r in
    select s.*
    from public.serials s
    where s.shop_id = new.shop_id
      and s.chair_id = new.chair_id
      and s.status = 'WAITING'
      and s.customer_id is not null
      and (s.notified_two_ahead_at is null or s.notified_turn_at is null)
  loop
    select count(*) into ahead_count
    from public.serials s2
    where s2.shop_id = r.shop_id
      and s2.chair_id = r.chair_id
      and s2.id <> r.id
      and s2.status in ('WAITING', 'IN_PROGRESS')
      and s2.position < r.position;

    if ahead_count = 2 and r.notified_two_ahead_at is null then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        r.customer_id,
        'QUEUE_UPDATE',
        'তোমার আগে আর ২ জন',
        'সিরিয়াল #' || r.position || ' — শীঘ্রই তোমার পালা আসছে।',
        jsonb_build_object('serial_id', r.id, 'shop_id', r.shop_id)
      );
      update public.serials set notified_two_ahead_at = now() where id = r.id;
    end if;

    if ahead_count = 0 and r.notified_turn_at is null then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        r.customer_id,
        'YOUR_TURN',
        'এখন তোমার পালা',
        'সিরিয়াল #' || r.position || ' — এখন গিয়ে দেখাও।',
        jsonb_build_object('serial_id', r.id, 'shop_id', r.shop_id)
      );
      update public.serials set notified_turn_at = now() where id = r.id;
    end if;
  end loop;

  return new;
end;
$$;

grant execute on function public.broadcast_shop_notification(uuid, text, text, text) to authenticated;
