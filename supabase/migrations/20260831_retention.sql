-- Sprint 32: bringing a customer back — wait alerts and self-reminders.
--
-- Run this once in the Supabase SQL editor, AFTER 20260830_commission_and_expenses.sql.
--
-- Both features exist because the app currently has no reason to be opened by
-- someone who isn't booking right now. Favourites are an inert bookmark, and
-- the only reminders in the system are the shop's, which read as marketing.
-- These two are the customer's own decisions, which is why they don't.

-- ---------------------------------------------------------------------------
-- 1) favourites become a standing request
-- ---------------------------------------------------------------------------
-- NULL = an ordinary bookmark, exactly as before. A number means "tell me when
-- the wait at this shop drops to that" — opt-in per shop, because a customer
-- has a different tolerance for the place next door than for one across town.
alter table public.favorites
  add column if not exists wait_alert_min integer,
  add column if not exists alerted_at     timestamptz;

alter table public.favorites drop constraint if exists favorites_wait_alert_range;
alter table public.favorites add constraint favorites_wait_alert_range
  check (wait_alert_min is null or (wait_alert_min >= 5 and wait_alert_min <= 120));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'SERIAL_CONFIRMED', 'QUEUE_UPDATE', 'YOUR_TURN',
    'CANCELLED', 'PROMO', 'REMINDER', 'SYSTEM',
    'NEW_BOOKING', 'LEAVE_NOW', 'DAILY_SUMMARY', 'WAIT_ALERT'
  ));

-- ---------------------------------------------------------------------------
-- 2) shop_current_wait — the same number the Explore card shows
-- ---------------------------------------------------------------------------
-- Minutes until the earliest chair frees up. Extracted as its own function so
-- the alert below and any future caller agree on what "the wait" means.
create or replace function public.shop_current_wait(p_shop_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    coalesce(
      ceil(extract(epoch from (
        greatest(
          (select min(free_at) from (
             select max(q.estimated_start_at
                        + make_interval(mins => q.estimated_duration_min)) as free_at
               from public.queue_public q
               join public.chairs c on c.id = q.chair_id
              where c.shop_id = p_shop_id
                and c.is_active = true
                and q.status in ('WAITING', 'IN_PROGRESS')
              group by q.chair_id
           ) lanes),
          now()
        ) - now()
      )) / 60),
      0
    )
  )::int;
$$;

-- ---------------------------------------------------------------------------
-- 3) notify_shop_wait_drop — fires when the queue actually gets shorter
-- ---------------------------------------------------------------------------
-- No scheduler, for the same reason as the "leave now" nudge (decision 26):
-- the only moment this alert could be true and useful is the moment a serial
-- leaves the queue, and that is already a trigger. Checking on a timer would
-- both cost more and say less.
--
-- Rate limited to once a day per (customer, shop). A favourite that hovers
-- around the threshold would otherwise fire every time anyone finished a
-- haircut, which is how a useful signal becomes spam within an afternoon.
create or replace function public.notify_shop_wait_drop(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wait integer;
  v_shop record;
  f      record;
begin
  select name, is_open, accepting_new, break_until
    into v_shop
    from public.shops
   where id = p_shop_id and status = 'ACTIVE';

  -- Pointless to send someone to a shop that can't take them.
  if v_shop is null
     or not v_shop.is_open
     or not v_shop.accepting_new
     or (v_shop.break_until is not null and v_shop.break_until > now()) then
    return;
  end if;

  v_wait := public.shop_current_wait(p_shop_id);

  for f in
    select fav.id, fav.customer_id
      from public.favorites fav
     where fav.shop_id = p_shop_id
       and fav.wait_alert_min is not null
       and v_wait <= fav.wait_alert_min
       and (fav.alerted_at is null or fav.alerted_at < now() - interval '20 hours')
       -- Nobody needs to be told a shop is quiet while they're already in a queue.
       and not exists (
         select 1 from public.serials s
          where s.customer_id = fav.customer_id
            and s.status in ('WAITING', 'IN_PROGRESS')
       )
  loop
    if public.notification_enabled(f.customer_id, 'WAIT_ALERT') then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        f.customer_id,
        'WAIT_ALERT',
        v_shop.name || ' এখন ফাঁকা',
        'এখন গেলে প্রায় ' || v_wait || ' মিনিট অপেক্ষা — সিরিয়াল নিয়ে নাও।',
        jsonb_build_object('shop_id', p_shop_id, 'wait_min', v_wait)
      );
    end if;
    -- Stamped either way, so a muted customer isn't re-scanned all day.
    update public.favorites set alerted_at = now() where id = f.id;
  end loop;
end; $$;

-- ---------------------------------------------------------------------------
-- 4) serial_after_update — hook the drop check onto the existing recalc
-- ---------------------------------------------------------------------------
-- Copy of the baseline (20260730) with ONE added block, marked below. The
-- check runs only when a serial LEAVES the queue, which is the only direction
-- the wait moves down.
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

    -- NEW (Sprint 32): the queue just got shorter — the one moment a
    -- "your favourite shop is quiet" alert can be both true and useful.
    if new.status in ('DONE', 'CANCELLED', 'NO_SHOW') then
      perform public.notify_shop_wait_drop(new.shop_id);
    end if;
  end if;

  return new;
end; $function$;

-- ---------------------------------------------------------------------------
-- 5) customer_reminders — the customer's own nudge, not the shop's
-- ---------------------------------------------------------------------------
-- Shops can already remind their regulars, and that reads as marketing however
-- politely it's worded. This is the same mechanism pointed the other way: the
-- customer decides the interval, so it lands as their own note to self.
create table if not exists public.customer_reminders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  -- Optional: "remind me to get a haircut" is a perfectly good reminder with
  -- no shop attached; with one, the notification can deep-link straight there.
  shop_id uuid references public.shops(id) on delete set null,
  interval_days integer not null check (interval_days between 3 and 180),
  next_at date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- One standing reminder per customer. More than one is a to-do list, which
  -- this is not, and two competing intervals would just fight each other.
  unique (customer_id)
);

create index if not exists customer_reminders_due_idx
  on public.customer_reminders (next_at) where active;

alter table public.customer_reminders enable row level security;

drop policy if exists "customers manage own reminder" on public.customer_reminders;
create policy "customers manage own reminder"
  on public.customer_reminders for all
  to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6) send_customer_reminders — run nightly alongside the shop summaries
-- ---------------------------------------------------------------------------
-- Daily granularity is exactly right here: "every three weeks" has no opinion
-- about the hour. Rolls `next_at` forward in the same statement it sends on,
-- so a double-fired cron can't send twice.
create or replace function public.send_customer_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_sent  integer := 0;
  r       record;
  v_shop  text;
begin
  for r in
    select cr.*
      from public.customer_reminders cr
     where cr.active
       and cr.next_at <= v_today
  loop
    -- Move the schedule on first: if the insert below fails for one customer,
    -- the loop must not retry them forever on every subsequent night.
    update public.customer_reminders
       set next_at = v_today + r.interval_days
     where id = r.id;

    if public.notification_enabled(r.customer_id, 'REMINDER') then
      select name into v_shop from public.shops
       where id = r.shop_id and status = 'ACTIVE';

      insert into public.notifications (user_id, type, title, body, data)
      values (
        r.customer_id,
        'REMINDER',
        'তোমার নিজের রিমাইন্ডার',
        case
          when v_shop is not null
            then v_shop || '-এ যাওয়ার সময় হয়েছে — তুমিই মনে করিয়ে দিতে বলেছিলে।'
          else 'সেলুনে যাওয়ার সময় হয়েছে — তুমিই মনে করিয়ে দিতে বলেছিলে।'
        end,
        jsonb_build_object('shop_id', r.shop_id, 'self_reminder', true)
      );
      v_sent := v_sent + 1;
    end if;
  end loop;

  return v_sent;
end; $$;

-- Service-role only, same as send_daily_summaries: it walks every customer.
revoke execute on function public.send_customer_reminders() from public;
