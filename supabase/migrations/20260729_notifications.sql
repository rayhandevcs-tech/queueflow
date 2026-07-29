-- Sprint 2: in-app notification system (Notification Center + realtime + provider broadcast)
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query),
-- paste, run. Safe to run once; re-running will error on the existing objects (harmless).
--
-- After running, enable Realtime for `notifications` in Database → Replication if it
-- isn't already on for all tables in this project (same convention as other tables).
--
-- Design: thin client, smart DB (matches the rest of this codebase — see serial-actions.api.ts
-- comment "the DB transition trigger is the real validator"). All notification rows are
-- inserted by triggers/SECURITY DEFINER functions, never directly by the client — there is
-- deliberately no client-facing INSERT policy on `notifications`.

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (
    type in ('SERIAL_CONFIRMED', 'QUEUE_UPDATE', 'YOUR_TURN', 'CANCELLED', 'PROMO', 'REMINDER')
  ),
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "users read own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "users mark own notifications read"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- serials: guard columns so the queue-position trigger below doesn't
-- re-fire "2 ahead" / "your turn" every time position is recalculated
-- ---------------------------------------------------------------------------
alter table public.serials
  add column notified_two_ahead_at timestamptz,
  add column notified_turn_at timestamptz;

-- ---------------------------------------------------------------------------
-- notify_serial_event: fires on every serial insert/update, regardless of
-- which client path caused it (booking, walk-in, provider start/done/cancel/
-- move) — same guarantee the existing chair/position/ETA triggers rely on.
--
-- AFTER trigger, not BEFORE: the existing chair/position/ETA-assignment
-- trigger(s) on this table aren't defined in these migration files (they
-- predate this repo's migration history), so their relative firing order
-- among same-timing BEFORE triggers is unknown/alphabetical and can't be
-- relied on. An AFTER trigger always sees the row's fully-resolved final
-- values (position, chair_id, etc.), regardless of that ordering.
--
-- "2 ahead" / "your turn" can't be detected only from NEW: when the person
-- at the front of a chair's queue finishes, everyone else's ahead-count
-- changes even though *their own row* was never written — a row-level
-- trigger only fires for the row that actually changed. So after handling
-- NEW's own direct transition, this also re-scans every other still-WAITING
-- row in the same chair and fires QUEUE_UPDATE/YOUR_TURN for any of them
-- that newly qualify. Each qualifying row's guard column is persisted via a
-- plain UPDATE (AFTER triggers can't mutate NEW for other rows anyway),
-- which recursively re-fires this trigger for that row — but its guard
-- column is already set by then, so it's a no-op and recursion terminates.
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

create trigger notify_serial_event_trigger
  after insert or update on public.serials
  for each row
  execute function public.notify_serial_event();

-- ---------------------------------------------------------------------------
-- broadcast_shop_notification: provider "নোটিফিকেশন পাঠান" RPC.
-- p_target: 'recent' (booked in the last 30 days) | 'regulars' (>=2 DONE visits)
-- Daily rate-limit: at most one PROMO broadcast per shop per day.
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

  -- Inner-joined against auth.users so a stale/orphaned customer_id (e.g. a
  -- serial left behind by a since-deleted test account) is silently skipped
  -- instead of failing the whole batch insert on a foreign-key violation.
  if p_target = 'recent' then
    insert into public.notifications (user_id, type, title, body, data)
    select distinct s.customer_id, 'PROMO', p_title, p_body,
           jsonb_build_object('shop_id', p_shop_id)
    from public.serials s
    join auth.users u on u.id = s.customer_id
    where s.shop_id = p_shop_id
      and s.booked_at >= now() - interval '30 days';
  else
    insert into public.notifications (user_id, type, title, body, data)
    select customer_id, 'PROMO', p_title, p_body, jsonb_build_object('shop_id', p_shop_id)
    from (
      select s.customer_id, count(*) as visit_count
      from public.serials s
      join auth.users u on u.id = s.customer_id
      where s.shop_id = p_shop_id
        and s.status = 'DONE'
      group by s.customer_id
      having count(*) >= 2
    ) regulars;
  end if;

  get diagnostics sent_count = row_count;
  return sent_count;
end;
$$;

-- SECURITY DEFINER doesn't imply callable — Postgres still checks EXECUTE
-- privilege for the calling role first. New functions default to PUBLIC
-- execute, but this project revokes that by default, so it must be granted
-- explicitly or every call 403s before the function body ever runs.
grant execute on function public.broadcast_shop_notification(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- regular_reminders → notifications: keeps the existing sendReminder() client
-- code untouched (it only ever inserted into regular_reminders); this trigger
-- delivers the actual in-app notification for that reminder.
-- ---------------------------------------------------------------------------
create or replace function public.notify_regular_reminder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is not null then
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

create trigger notify_regular_reminder_trigger
  after insert on public.regular_reminders
  for each row
  execute function public.notify_regular_reminder();
