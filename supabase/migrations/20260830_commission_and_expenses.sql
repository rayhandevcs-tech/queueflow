-- Sprint 31: staff commission, the expense ledger, and the nightly summary.
--
-- Run this once in the Supabase SQL editor, AFTER 20260829_display_and_review_reply.sql.
--
-- The theme is the owner's real accounts. Income tracking already showed what
-- came in; none of it showed what he keeps, or what he owes his staff at the
-- end of the month — the two numbers he actually writes in a notebook.

-- ---------------------------------------------------------------------------
-- 1) chairs.commission_pct
-- ---------------------------------------------------------------------------
-- Salon staff are usually paid a cut, not a wage ("৫০-৫০", "৪০%"). Every
-- ingredient was already here — each serial carries chair_id and total_amount
-- — so this one column turns data the app has been collecting all along into
-- the payroll the owner keeps by hand.
--
-- 0 = a salaried chair, which is why it is the default: existing shops must
-- not suddenly appear to owe anyone anything.
alter table public.chairs
  add column if not exists commission_pct numeric(5, 2) not null default 0;

alter table public.chairs drop constraint if exists chairs_commission_pct_range;
alter table public.chairs add constraint chairs_commission_pct_range
  check (commission_pct >= 0 and commission_pct <= 100);

-- ---------------------------------------------------------------------------
-- 2) shop_expenses
-- ---------------------------------------------------------------------------
-- Income minus expenses is the only number that answers "did the shop make
-- money this month". Modelled on manual_entries (20260818) down to the RLS
-- and the realtime publication, because it is the same kind of thing: a row
-- the owner types in himself about business that happened off-queue.
create table if not exists public.shop_expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category text not null check (
    category in ('RENT', 'UTILITY', 'SUPPLIES', 'STAFF', 'OTHER')
  ),
  amount numeric not null check (amount >= 0),
  note text,
  -- Separate from created_at: rent paid late still belongs to the month it
  -- was for, and the owner will enter most of these after the fact.
  spent_on date not null default (now() at time zone 'Asia/Dhaka')::date,
  created_at timestamptz not null default now()
);

create index if not exists shop_expenses_shop_spent_idx
  on public.shop_expenses (shop_id, spent_on desc);

alter table public.shop_expenses enable row level security;

drop policy if exists "shop_expenses: owner select" on public.shop_expenses;
create policy "shop_expenses: owner select"
  on public.shop_expenses for select
  to authenticated
  using (public.is_shop_owner(shop_id));

drop policy if exists "shop_expenses: owner insert" on public.shop_expenses;
create policy "shop_expenses: owner insert"
  on public.shop_expenses for insert
  to authenticated
  with check (public.is_shop_owner(shop_id));

drop policy if exists "shop_expenses: owner update" on public.shop_expenses;
create policy "shop_expenses: owner update"
  on public.shop_expenses for update
  to authenticated
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

drop policy if exists "shop_expenses: owner delete" on public.shop_expenses;
create policy "shop_expenses: owner delete"
  on public.shop_expenses for delete
  to authenticated
  using (public.is_shop_owner(shop_id));

-- Live updates on the income page without a refresh, same as manual_entries.
do $$
begin
  alter publication supabase_realtime add table public.shop_expenses;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 3) DAILY_SUMMARY notification type
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'SERIAL_CONFIRMED', 'QUEUE_UPDATE', 'YOUR_TURN',
    'CANCELLED', 'PROMO', 'REMINDER', 'SYSTEM',
    'NEW_BOOKING', 'LEAVE_NOW', 'DAILY_SUMMARY'
  ));

-- ---------------------------------------------------------------------------
-- 4) send_daily_summaries — one notification per shop per day
-- ---------------------------------------------------------------------------
-- "আজ ১৪ জন · ৳৩,২০০ · সবচেয়ে ব্যস্ত ৬-৮টা": a reason to open the app every
-- evening, built entirely from rows that already exist.
--
-- Everything is computed in Asia/Dhaka, not UTC — at 22:00 Dhaka a UTC day
-- boundary would still be reporting the middle of the afternoon.
--
-- Idempotent by design: it checks for an existing DAILY_SUMMARY for that shop
-- and date before inserting. A cron that fires twice, or a manual re-run after
-- a failure, therefore costs nothing. That guard is what makes it safe to call
-- from an HTTP endpoint that anything could retry.
create or replace function public.send_daily_summaries(p_day date default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day       date := coalesce(p_day, (now() at time zone 'Asia/Dhaka')::date);
  v_start     timestamptz := (v_day::timestamp at time zone 'Asia/Dhaka');
  v_end       timestamptz := ((v_day + 1)::timestamp at time zone 'Asia/Dhaka');
  v_sent      integer := 0;
  s           record;
  v_jobs      integer;
  v_income    numeric;
  v_due       numeric;
  v_expenses  numeric;
  v_peak      integer;
  v_body      text;
begin
  for s in
    select sh.id, sh.owner_id
      from public.shops sh
     where sh.status = 'ACTIVE'
  loop
    -- Skip a shop that did nothing today rather than sending "৳0" — a summary
    -- that arrives on a closed day trains the owner to ignore the channel.
    select count(*), coalesce(sum(total_amount), 0),
           coalesce(sum(total_amount) filter (where payment_status = 'DUE'), 0)
      into v_jobs, v_income, v_due
      from public.serials
     where shop_id = s.id
       and status = 'DONE'
       and completed_at >= v_start
       and completed_at <  v_end;

    -- Manual entries are the same day's work by another route.
    select v_jobs + count(*), v_income + coalesce(sum(amount), 0)
      into v_jobs, v_income
      from public.manual_entries
     where shop_id = s.id
       and created_at >= v_start
       and created_at <  v_end;

    if v_jobs = 0 then
      continue;
    end if;

    if exists (
      select 1 from public.notifications n
       where n.user_id = s.owner_id
         and n.type = 'DAILY_SUMMARY'
         and n.data ->> 'day' = v_day::text
    ) then
      continue;
    end if;

    select coalesce(sum(amount), 0) into v_expenses
      from public.shop_expenses
     where shop_id = s.id and spent_on = v_day;

    -- Busiest hour of the day, in local time — the one genuinely new fact in
    -- the message, and the one that changes how a shop staffs its evening.
    select extract(hour from (completed_at at time zone 'Asia/Dhaka'))::int
      into v_peak
      from public.serials
     where shop_id = s.id
       and status = 'DONE'
       and completed_at >= v_start
       and completed_at <  v_end
     group by 1
     order by count(*) desc, 1
     limit 1;

    v_body := v_jobs || ' জন · আয় ৳' || round(v_income);
    if v_due > 0 then
      v_body := v_body || ' (বাকি ৳' || round(v_due) || ')';
    end if;
    if v_expenses > 0 then
      v_body := v_body || ' · খরচ ৳' || round(v_expenses)
                       || ' · লাভ ৳' || round(v_income - v_expenses);
    end if;
    if v_peak is not null then
      v_body := v_body || ' · সবচেয়ে ব্যস্ত ' || v_peak || '-' || (v_peak + 1) || 'টা';
    end if;

    if public.notification_enabled(s.owner_id, 'DAILY_SUMMARY') then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        s.owner_id,
        'DAILY_SUMMARY',
        'আজকের হিসাব',
        v_body,
        jsonb_build_object('shop_id', s.id, 'day', v_day::text)
      );
      v_sent := v_sent + 1;
    end if;
  end loop;

  return v_sent;
end; $$;

-- Deliberately NOT granted to `authenticated`: this walks every shop on the
-- platform. It is called by the nightly job through the service role only.
revoke execute on function public.send_daily_summaries(date) from public;
