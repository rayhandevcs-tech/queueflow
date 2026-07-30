-- Sprint 9: per-type notification on/off + self-serve delete account.
-- Run this once in the Supabase dashboard's SQL editor.

-- ---------------------------------------------------------------------------
-- notification_prefs: jsonb on profiles, keyed by notification_type, value
-- false = muted. Missing key / missing row / any non-'false' value = enabled
-- (opt-out model, so existing users default to "everything on" with no
-- backfill needed).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column notification_prefs jsonb not null default '{}'::jsonb;

create or replace function public.notification_enabled(p_user_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (p.notification_prefs ->> p_type) is distinct from 'false'
     from public.profiles p
     where p.id = p_user_id),
    true
  );
$$;

grant execute on function public.notification_enabled(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- notify_serial_event: same logic as 20260729c, each insert now gated on the
-- recipient's own preference for that notification type.
-- ---------------------------------------------------------------------------
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
-- broadcast_shop_notification: same logic as 20260729d, recipients filtered
-- to those who haven't muted PROMO.
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_shop_notification(
  p_shop_id uuid,
  p_target text,
  p_title text,
  p_body text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  sent_count integer;
begin
  if p_target not in ('recent', 'regulars') then
    raise exception 'অজানা টার্গেট';
  end if;

  if not exists (
    select 1 from public.shops sh where sh.id = p_shop_id and sh.owner_id = auth.uid()
  ) then
    raise exception 'এই দোকানের মালিক তুমি না';
  end if;

  if exists (
    select 1 from public.notifications n
    where n.type = 'PROMO'
      and (n.data ->> 'shop_id') = p_shop_id::text
      and n.created_at::date = current_date
  ) then
    raise exception 'আজকে একবার ব্রডকাস্ট পাঠানো হয়ে গেছে — আগামীকাল আবার চেষ্টা করো';
  end if;

  if p_target = 'recent' then
    insert into public.notifications (user_id, type, title, body, data)
    select distinct s.customer_id, 'PROMO', p_title, p_body,
           jsonb_build_object('shop_id', p_shop_id)
    from public.serials s
    join auth.users u on u.id = s.customer_id
    where s.shop_id = p_shop_id
      and s.booked_at >= now() - interval '30 days'
      and public.notification_enabled(s.customer_id, 'PROMO');
  else
    insert into public.notifications (user_id, type, title, body, data)
    select customer_id, 'PROMO', p_title, p_body, jsonb_build_object('shop_id', p_shop_id)
    from (
      select s.customer_id, count(*) as visit_count
      from public.serials s
      join auth.users u on u.id = s.customer_id
      where s.shop_id = p_shop_id
        and s.status = 'DONE'
        and public.notification_enabled(s.customer_id, 'PROMO')
      group by s.customer_id
      having count(*) >= 2
    ) regulars;
  end if;

  get diagnostics sent_count = row_count;
  return sent_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- notify_regular_reminder: same logic as 20260729, gated on REMINDER pref.
-- ---------------------------------------------------------------------------
create or replace function public.notify_regular_reminder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is not null
     and public.notification_enabled(new.customer_id, 'REMINDER') then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.customer_id,
      'REMINDER',
      'তোমার জন্য একটা রিমাইন্ডার',
      'অনেকদিন দেখা নেই — আবার সিরিয়াল দিয়ে ঘুরে যাও।',
      jsonb_build_object('shop_id', new.shop_id)
    );
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- send_due_reminder: same logic as 20260806, now also respects the
-- customer's REMINDER preference (raises so the provider sees why nothing
-- was sent, unlike the silent "already reminded today" case).
-- ---------------------------------------------------------------------------
create or replace function public.send_due_reminder(p_serial_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serial public.serials;
begin
  select s.* into v_serial
  from public.serials s
  join public.shops sh on sh.id = s.shop_id
  where s.id = p_serial_id and sh.owner_id = auth.uid()
  for update of s;

  if not found then
    raise exception 'এই দোকানের সিরিয়াল না';
  end if;

  if v_serial.payment_status <> 'DUE' then
    raise exception 'এই সিরিয়ালে বাকি নেই';
  end if;

  if v_serial.customer_id is null
     or not exists (select 1 from auth.users u where u.id = v_serial.customer_id) then
    raise exception 'এই কাস্টমারকে রিমাইন্ডার পাঠানো যাবে না';
  end if;

  if v_serial.due_reminded_at is not null and v_serial.due_reminded_at > now() - interval '1 day' then
    raise exception 'আজকে একবার রিমাইন্ডার পাঠানো হয়ে গেছে';
  end if;

  if not public.notification_enabled(v_serial.customer_id, 'REMINDER') then
    raise exception 'এই কাস্টমার রিমাইন্ডার নোটিফিকেশন বন্ধ রেখেছে';
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_serial.customer_id,
    'REMINDER',
    'তোমার একটা বাকি আছে',
    '৳' || trim(to_char(v_serial.due_amount, 'FM999999999')) || ' বাকি আছে — সুবিধামতো পরিশোধ করে দিও।',
    jsonb_build_object('serial_id', v_serial.id, 'shop_id', v_serial.shop_id)
  );

  update public.serials set due_reminded_at = now() where id = v_serial.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_my_account: self-serve account deletion. Customers: cascades handle
-- favorites/reviews/messages/regular_reminders/notifications (all FK
-- "on delete cascade" to auth.users, see 20260722/20260723/20260729/20260801).
-- Providers who still own a shop are blocked — tearing down an entire shop's
-- chairs/services/serials/reviews safely is out of scope for a self-serve
-- button; they're pointed at support instead.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'লগইন করা নেই';
  end if;

  if exists (select 1 from public.shops sh where sh.owner_id = v_uid) then
    raise exception 'তোমার নামে দোকান আছে — অ্যাকাউন্ট মুছার আগে সাপোর্টে যোগাযোগ করো';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
