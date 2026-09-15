-- ফেজ ৬ / Sprint 10 — অ্যানালিটিক্স
--
-- ===========================================================================
-- চালানোর ক্রম
-- ===========================================================================
--   1. 20260916_parlour_foundation.sql       ✅
--   …
--   7. 20260922_loyalty.sql                  ✅
--   8. 20260923_referral.sql                 ✅
--   9. 20260924_rewards.sql                  ✅
--  10. 20260925_analytics.sql                ← এই ফাইল
--
-- ===========================================================================
-- এই ফাইল কী করে, আর কী করে না
-- ===========================================================================
-- করে: একটা গেট-ফাংশন (`analytics_scope`) আর **এগারোটা শুধু-পড়ার RPC**।
--      সাথে একটা ইনডেক্স, যেটা এই স্প্রিন্টের আগেই দরকার ছিল।
--
-- করে না: **একটাও নতুন টেবিল নেই।** কোনো `analytics_events`, কোনো সারাংশ
--         টেবিল, কোনো materialized view — লেনদেনের টেবিলগুলোই একমাত্র সত্য
--         থাকছে (সিদ্ধান্ত ৬৭)। কোনো বিদ্যমান ফাংশন, ট্রিগার বা পলিসি
--         `create or replace` করা হয়নি — `shop_membership_summary`,
--         `shop_referral_stats`, `loyalty_award`, `redeem_reward` সহ একটাও
--         ছোঁয়া হয়নি। **কোনো লেখার পথ নেই:** প্রতিটা ফাংশন `stable`, তাই
--         Postgres নিজেই একটা INSERT/UPDATE চেষ্টা প্রত্যাখ্যান করবে।
--
-- ===========================================================================
-- তিনটে নিয়ম, প্রতিটা RPC-তে একইভাবে
-- ===========================================================================
-- **এক — SECURITY INVOKER, তার উপরে একটা স্পষ্ট মালিক-গার্ড (সিদ্ধান্ত ৬৬)।**
-- INVOKER মানে RLS-ই সিদ্ধান্ত নেয়, তাই অন্য দোকানের সারি যোগফলে ঢোকার কোনো
-- পথই নেই — গার্ডটা ভুল করেও বাদ পড়লেও ডেটা ফাঁস হয় না। আর গার্ডটা থাকে
-- কারণ **শূন্য আর "তোমার দোকান নয়" এক জিনিস নয়**: একটা ড্যাশবোর্ড যেটা অন্যের
-- দোকানের জন্য চুপচাপ শূন্য দেখায়, সেটা "ডেটা নেই" থেকে আলাদা করা যায় না।
--
-- **দুই — তারিখের একটাই ব্যাখ্যা।** প্রতিটা RPC `(p_shop_id, p_from, p_to)`
-- নেয়, দুটোই **Asia/Dhaka-র ক্যালেন্ডার তারিখ, দুই প্রান্তই ইনক্লুসিভ** —
-- "১ থেকে ৭" মানে সাতটা দিন। `analytics_scope()` ওটাকে একটা half-open
-- tstzrange-এ বদলায়, আর **সেটাই একমাত্র জায়গা** যেখানে এই রূপান্তরটা লেখা
-- আছে (সিদ্ধান্ত ৬৮)।
--
-- **তিন — যা নির্ভরযোগ্যভাবে হিসাব করা যায় না, সেটা ফেরানো হয় না।**
-- `appointments`-এ `started_at` কলামই নেই, তাই অ্যাপয়েন্টমেন্টের **আসল**
-- সময় কোথাও থেকে বের করা যায় না — শুধু **নির্ধারিত** সময় (`ends_at -
-- starts_at`)। কলামটার নাম তাই `avg_scheduled_min`, আর "actual" নামে কোনো
-- কলাম নেই। ইউটিলাইজেশনের হরও বানানো নয়: `staff_working_hours` থেকে আসে,
-- আর যে সিটের কর্মঘণ্টা সেট করা নেই তার ইউটিলাইজেশন `null` (সিদ্ধান্ত ৬৯)।
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- ০) একটা ইনডেক্স, যা এই স্প্রিন্টের আগেই দরকার ছিল
-- ---------------------------------------------------------------------------
-- `appointments`-এ `(shop_id, completed_at)` ইনডেক্স আছে (20260920), কিন্তু
-- `serials`-এ নেই — অথচ ইনকামের পাতা এক বছরের জানালা, AI ব্রিফ ছয় মাসের,
-- আর পুরনো অ্যানালিটিক্স ৯০ দিনের জানালা ঠিক এই দুটো কলাম দিয়েই ছাঁকে।
-- নিচের প্রতিটা সিরিয়াল-অ্যাগ্রিগেটও তাই করে। অর্থাৎ ইনডেক্সটা এই স্প্রিন্টের
-- জন্য নয়, **চারটে বিদ্যমান কোয়েরি প্যাটার্নের জন্য** — অন্ধভাবে যোগ করা নয়।
--
-- পার্শিয়াল, কারণ `completed_at` শুধু DONE সারিতেই বসে: ইনডেক্সটা তাই
-- শেষ-হওয়া কাজের সমান বড়, পুরো টেবিলের সমান নয়।
create index if not exists serials_shop_completed_idx
  on public.serials (shop_id, completed_at)
  where completed_at is not null;


-- ---------------------------------------------------------------------------
-- ১) analytics_scope — একটাই গেট: মালিকানা, তারিখ, আর সীমা
-- ---------------------------------------------------------------------------
-- প্রতিটা RPC-র প্রথম লাইন এটাই। একটা কলে চারটে জিনিস হয়, তাই কোনোটা ভুলে
-- যাওয়ার সুযোগ নেই:
--
--   · `p_shop_id` null নয়
--   · কলার এই দোকানের মালিক (`is_shop_owner`) — নইলে `not your shop`
--   · তারিখ দুটো আছে, আর `p_to >= p_from`
--   · জানালাটা ৩ বছরের মধ্যে — একটা আনবাউন্ডেড রেঞ্জ পুরো টেবিল স্ক্যান করত
--
-- আর ফেরায় সেই একটাই tstzrange, যেটা সব RPC ব্যবহার করে।
create or replace function public.analytics_scope(
  p_shop_id uuid,
  p_from    date,
  p_to      date
)
returns tstzrange
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_shop_id is null then
    raise exception 'analytics_shop_required';
  end if;

  -- `is_shop_owner` নিজে SECURITY DEFINER, তাই INVOKER ফাংশনের ভেতর থেকেও
  -- সঠিক উত্তর দেয়।
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'not your shop';
  end if;

  if p_from is null or p_to is null then
    raise exception 'analytics_range_required';
  end if;

  if p_to < p_from then
    raise exception 'analytics_range_reversed';
  end if;

  if (p_to - p_from) > 1095 then
    raise exception 'analytics_range_too_wide';
  end if;

  -- দুই প্রান্তই ইনক্লুসিভ ক্যালেন্ডার তারিখ → `[from 00:00, to+1 00:00)`।
  -- শেষ দিনটা পুরোপুরি ভেতরে, আর সীমানায় কোনো সারি দুবার গোনা হয় না।
  return tstzrange(
    (p_from::timestamp at time zone 'Asia/Dhaka'),
    ((p_to + 1)::timestamp at time zone 'Asia/Dhaka'),
    '[)'
  );
end;
$$;

comment on function public.analytics_scope(uuid, date, date) is
  'The single gate every analytics RPC opens with: owner check, date '
  'validation, a bounded window, and the one place the Asia/Dhaka '
  'inclusive-date to half-open-tstzrange conversion is written.';


-- ---------------------------------------------------------------------------
-- ২) shop_overview_stats — মালিকের প্রথম স্ক্রিন
-- ---------------------------------------------------------------------------
-- **টাকার উৎস Sprint 5.1-এর সেই একই সংজ্ঞা**, অন্য কিছু নয়: শেষ হওয়া কাজের
-- `total_amount`, `payment_status in ('PAID','DUE')`। "মোট ব্যবসা" =
-- আদায় + বাকি, আর দুটো আলাদা করেও দেখানো হয়। `total_amount` ইতিমধ্যেই
-- Sprint 9-এর ছাড় বাদ দেওয়া **চূড়ান্ত** অঙ্ক (ট্রিগার DONE-এ ওটা বসায়),
-- তাই ছাড় পাওয়া বিল এখানে আপনাআপনি ঠিক আছে — আলাদা কোনো হিসাব লাগে না।
--
-- **তারিখ কোনটা, কেন:**
--   · শেষ হওয়া কাজ → `completed_at`। ইনকামের পাতা এটাই ব্যবহার করে, তাই
--     ড্যাশবোর্ড আর খাতা কখনো আলাদা কথা বলবে না।
--   · বাতিল / নো-শো → সিরিয়ালে `booked_at`, অ্যাপয়েন্টমেন্টে `starts_at`।
--     কারণ ওদের `completed_at` নেই, আর মালিক "এই সপ্তাহের নো-শো" বলতে
--     **যে স্লটটা নষ্ট হলো** সেটাই বোঝায়।
--   · ম্যানুয়াল এন্ট্রি → `created_at` (ওর নিজের একমাত্র তারিখ)।
create or replace function public.shop_overview_stats(
  p_shop_id uuid,
  p_from    date,
  p_to      date
)
returns table (
  jobs_completed        integer,
  serials_total         integer,
  serials_completed     integer,
  serials_cancelled     integer,
  serials_no_show       integer,
  appointments_total    integer,
  appointments_completed integer,
  appointments_cancelled integer,
  appointments_no_show  integer,
  manual_entries        integer,
  revenue_total         numeric,
  revenue_collected     numeric,
  revenue_due           numeric,
  avg_ticket            numeric,
  customers_unique      integer,
  customers_new         integer,
  customers_returning   integer,
  customers_repeat      integer,
  walk_ins              integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  r tstzrange := public.analytics_scope(p_shop_id, p_from, p_to);
begin
  return query
  with done_serials as (
    select s.total_amount, s.payment_status, s.customer_id
      from public.serials s
     where s.shop_id = p_shop_id
       and s.status = 'DONE'
       and s.payment_status in ('PAID', 'DUE')
       and s.completed_at <@ r
  ),
  done_appts as (
    select a.total_amount, a.payment_status, a.customer_id
      from public.appointments a
     where a.shop_id = p_shop_id
       and a.status = 'DONE'
       and a.payment_status in ('PAID', 'DUE')
       and a.completed_at <@ r
  ),
  manual as (
    select m.amount as total_amount, m.payment_status
      from public.manual_entries m
     where m.shop_id = p_shop_id
       and m.created_at <@ r
  ),
  money as (
    select total_amount, payment_status from done_serials
    union all
    select total_amount, payment_status from done_appts
    union all
    select total_amount, payment_status from manual
  ),
  -- Every customer who had work finished inside the window, and whether
  -- they had ever finished anything here BEFORE it. That is what separates a
  -- new customer from a returning one — a real fact, not an estimate.
  served as (
    select customer_id, count(*)::int as jobs
      from (
        select customer_id from done_serials where customer_id is not null
        union all
        select customer_id from done_appts where customer_id is not null
      ) x
     group by customer_id
  ),
  first_seen as (
    select v.customer_id,
           least(
             coalesce((select min(s.completed_at) from public.serials s
                        where s.shop_id = p_shop_id and s.status = 'DONE'
                          and s.customer_id = v.customer_id), 'infinity'::timestamptz),
             coalesce((select min(a.completed_at) from public.appointments a
                        where a.shop_id = p_shop_id and a.status = 'DONE'
                          and a.customer_id = v.customer_id), 'infinity'::timestamptz)
           ) as first_at
      from served v
  )
  select
    (select count(*)::int from money),
    (select count(*)::int from public.serials s
      where s.shop_id = p_shop_id
        and (s.completed_at <@ r or (s.completed_at is null and s.booked_at <@ r))),
    (select count(*)::int from done_serials),
    (select count(*)::int from public.serials s
      where s.shop_id = p_shop_id and s.status = 'CANCELLED' and s.booked_at <@ r),
    (select count(*)::int from public.serials s
      where s.shop_id = p_shop_id and s.status = 'NO_SHOW' and s.booked_at <@ r),
    (select count(*)::int from public.appointments a
      where a.shop_id = p_shop_id and a.starts_at <@ r),
    (select count(*)::int from done_appts),
    (select count(*)::int from public.appointments a
      where a.shop_id = p_shop_id and a.status = 'CANCELLED' and a.starts_at <@ r),
    (select count(*)::int from public.appointments a
      where a.shop_id = p_shop_id and a.status = 'NO_SHOW' and a.starts_at <@ r),
    (select count(*)::int from manual),
    (select coalesce(sum(total_amount), 0) from money),
    (select coalesce(sum(total_amount) filter (where payment_status = 'PAID'), 0) from money),
    (select coalesce(sum(total_amount) filter (where payment_status = 'DUE'), 0) from money),
    -- `nullif` so an empty window reports N/A rather than a division error or
    -- a misleading 0 — "no jobs" has no average ticket.
    (select round(sum(total_amount) / nullif(count(*), 0), 2) from money),
    (select count(*)::int from served),
    (select count(*)::int from first_seen where first_at >= lower(r)),
    (select count(*)::int from first_seen where first_at <  lower(r)),
    (select count(*)::int from served where jobs > 1),
    -- A walk-in is a finished job with no customer account behind it.
    (select count(*)::int from done_serials where customer_id is null)
      + (select count(*)::int from done_appts where customer_id is null)
      + (select count(*)::int from manual);
end;
$$;

comment on function public.shop_overview_stats(uuid, date, date) is
  'The owner''s headline numbers. Revenue uses Sprint 5.1''s definition '
  'exactly (DONE total_amount, PAID or DUE) so the dashboard and the income '
  'ledger can never disagree; total_amount is already post-reward-discount.';


-- ---------------------------------------------------------------------------
-- ৩) shop_revenue_trend — সময়ের সাথে আয় ও কাজের সংখ্যা
-- ---------------------------------------------------------------------------
-- `generate_series` দিয়ে **খালি দিনগুলোও** ফেরানো হয়, শূন্য নিয়ে। নইলে
-- চার্টে ফাঁকা দিন থাকত না আর দুটো ব্যস্ত দিন পাশাপাশি দেখিয়ে ভুল বোঝাত।
--
-- বাকেট `'DAY'` অথবা `'MONTH'`। ৯০ দিনের বেশি জানালায় দিন-ভিত্তিক চার্ট
-- পড়া যায় না, কিন্তু সেই সিদ্ধান্তটা UI-র — এই ফাংশন যা চাওয়া হয় তাই দেয়।
create or replace function public.shop_revenue_trend(
  p_shop_id uuid,
  p_from    date,
  p_to      date,
  p_bucket  text default 'DAY'
)
returns table (
  bucket_start      date,
  revenue_total     numeric,
  revenue_collected numeric,
  jobs              integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  r tstzrange := public.analytics_scope(p_shop_id, p_from, p_to);
  v_step interval;
begin
  if p_bucket is null or p_bucket not in ('DAY', 'MONTH') then
    raise exception 'analytics_bucket_invalid';
  end if;

  v_step := case when p_bucket = 'MONTH' then interval '1 month' else interval '1 day' end;

  return query
  with money as (
    select s.completed_at as at, s.total_amount, s.payment_status
      from public.serials s
     where s.shop_id = p_shop_id and s.status = 'DONE'
       and s.payment_status in ('PAID', 'DUE') and s.completed_at <@ r
    union all
    select a.completed_at, a.total_amount, a.payment_status
      from public.appointments a
     where a.shop_id = p_shop_id and a.status = 'DONE'
       and a.payment_status in ('PAID', 'DUE') and a.completed_at <@ r
    union all
    select m.created_at, m.amount, m.payment_status
      from public.manual_entries m
     where m.shop_id = p_shop_id and m.created_at <@ r
  ),
  bucketed as (
    select
      -- Bucketed in Dhaka local time, so a job finished at 01:00 local counts
      -- on the day the shopkeeper thinks it happened.
      (date_trunc(lower(p_bucket), at at time zone 'Asia/Dhaka'))::date as b,
      total_amount,
      payment_status
    from money
  ),
  spine as (
    select (date_trunc(lower(p_bucket), d))::date as b
      from generate_series(
             p_from::timestamp,
             p_to::timestamp,
             v_step
           ) d
     union
    -- The last partial bucket: a month-bucketed range ending mid-month would
    -- otherwise lose its final month when the step jumped past p_to.
    select (date_trunc(lower(p_bucket), p_to::timestamp))::date
  )
  select
    spine.b,
    coalesce(sum(bucketed.total_amount), 0),
    coalesce(sum(bucketed.total_amount) filter (where bucketed.payment_status = 'PAID'), 0),
    count(bucketed.total_amount)::int
  from spine
  left join bucketed on bucketed.b = spine.b
  group by spine.b
  order by spine.b;
end;
$$;


-- ---------------------------------------------------------------------------
-- ৪) shop_appointment_stats — পার্লারের বুকিং পারফরম্যান্স
-- ---------------------------------------------------------------------------
-- স্লটের তারিখ (`starts_at`) দিয়ে ছাঁকা হয়, `completed_at` দিয়ে নয় — কারণ
-- "এই সপ্তাহের অ্যাপয়েন্টমেন্ট" মানে এই সপ্তাহের স্লটগুলো, আর বাতিল/নো-শো
-- সারির `completed_at`ই নেই।
--
-- **`avg_scheduled_min`, `avg_actual_min` নয়** (সিদ্ধান্ত ৬৯)।
-- `appointments`-এ `started_at` কলাম নেই, তাই কাজটা সত্যিই কত সময় নিল সেটা
-- এই স্কিমা থেকে জানার কোনো উপায় নেই। নির্ধারিত সময়টা সৎভাবে সেই নামেই
-- ফেরানো হয়; আসল সময়ের কলামটা **তৈরিই করা হয়নি**, শূন্য বা অনুমান দিয়ে
-- ভরা হয়নি।
create or replace function public.shop_appointment_stats(
  p_shop_id uuid,
  p_from    date,
  p_to      date
)
returns table (
  total             integer,
  completed         integer,
  cancelled         integer,
  no_show           integer,
  booked            integer,
  confirmed         integer,
  in_progress       integer,
  completion_rate   numeric,
  no_show_rate      numeric,
  cancel_rate       numeric,
  avg_scheduled_min numeric,
  avg_lead_days     numeric,
  walk_ins          integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  r tstzrange := public.analytics_scope(p_shop_id, p_from, p_to);
begin
  return query
  with a as (
    select * from public.appointments
     where shop_id = p_shop_id and starts_at <@ r
  ),
  -- The denominator is deliberately "jobs that reached an outcome": a slot
  -- still BOOKED for tomorrow has not failed to complete, and counting it as
  -- a miss would make every forward-looking week look terrible.
  settled as (
    select count(*)::int as n from a where status in ('DONE', 'CANCELLED', 'NO_SHOW')
  )
  select
    (select count(*)::int from a),
    (select count(*)::int from a where status = 'DONE'),
    (select count(*)::int from a where status = 'CANCELLED'),
    (select count(*)::int from a where status = 'NO_SHOW'),
    (select count(*)::int from a where status = 'BOOKED'),
    (select count(*)::int from a where status = 'CONFIRMED'),
    (select count(*)::int from a where status = 'IN_PROGRESS'),
    (select round(100.0 * (select count(*) from a where status = 'DONE')
                  / nullif((select n from settled), 0), 1)),
    (select round(100.0 * (select count(*) from a where status = 'NO_SHOW')
                  / nullif((select n from settled), 0), 1)),
    (select round(100.0 * (select count(*) from a where status = 'CANCELLED')
                  / nullif((select n from settled), 0), 1)),
    (select round(avg(extract(epoch from (ends_at - starts_at)) / 60)::numeric, 1)
       from a where status = 'DONE'),
    -- How far ahead people book. Real: both timestamps are recorded.
    (select round(avg(extract(epoch from (starts_at - booked_at)) / 86400)::numeric, 1)
       from a),
    (select count(*)::int from a where is_walk_in);
end;
$$;


-- ---------------------------------------------------------------------------
-- ৫) shop_queue_stats — সেলুনের লাইভ কিউ
-- ---------------------------------------------------------------------------
-- এটা অ্যাপয়েন্টমেন্টের নকল **নয়**, আর হতে পারেও না: কিউয়ের নিজের সত্যিকারের
-- দুটো সংখ্যা আছে যা অ্যাপয়েন্টমেন্টে নেই — `started_at` থেকে আসল সার্ভিস
-- সময়, আর `booked_at → started_at` থেকে আসল অপেক্ষা। দুটোই মাপা, অনুমান নয়।
create or replace function public.shop_queue_stats(
  p_shop_id uuid,
  p_from    date,
  p_to      date
)
returns table (
  total           integer,
  completed       integer,
  cancelled       integer,
  no_show         integer,
  walk_ins        integer,
  completion_rate numeric,
  no_show_rate    numeric,
  avg_service_min numeric,
  avg_wait_min    numeric,
  busiest_day     date,
  busiest_day_jobs integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  r tstzrange := public.analytics_scope(p_shop_id, p_from, p_to);
begin
  return query
  with s as (
    -- Finished work is dated by `completed_at` (the income convention);
    -- everything that never finished is dated by `booked_at`, which for a
    -- same-day queue is the day it happened.
    select * from public.serials
     where shop_id = p_shop_id
       and (completed_at <@ r or (completed_at is null and booked_at <@ r))
  ),
  settled as (
    select count(*)::int as n from s where status in ('DONE', 'CANCELLED', 'NO_SHOW')
  ),
  by_day as (
    select (completed_at at time zone 'Asia/Dhaka')::date as d, count(*)::int as jobs
      from s where status = 'DONE' and completed_at is not null
     group by 1 order by jobs desc, d desc limit 1
  )
  select
    (select count(*)::int from s),
    (select count(*)::int from s where status = 'DONE'),
    (select count(*)::int from s where status = 'CANCELLED'),
    (select count(*)::int from s where status = 'NO_SHOW'),
    (select count(*)::int from s where status = 'DONE' and customer_id is null),
    (select round(100.0 * (select count(*) from s where status = 'DONE')
                  / nullif((select n from settled), 0), 1)),
    (select round(100.0 * (select count(*) from s where status = 'NO_SHOW')
                  / nullif((select n from settled), 0), 1)),
    -- Measured, not scheduled: the queue stamps both ends of the job.
    (select round(avg(extract(epoch from (completed_at - started_at)) / 60)::numeric, 1)
       from s where status = 'DONE' and started_at is not null and completed_at > started_at),
    (select round(avg(extract(epoch from (started_at - booked_at)) / 60)::numeric, 1)
       from s where started_at is not null and started_at > booked_at),
    (select d from by_day),
    (select jobs from by_day);
end;
$$;


-- ---------------------------------------------------------------------------
-- ৬) shop_staff_stats — সিট ধরে ধরে, আর **আসল হর দিয়ে** ইউটিলাইজেশন
-- ---------------------------------------------------------------------------
-- সিদ্ধান্ত ৬৯-এর সবচেয়ে গুরুত্বপূর্ণ প্রয়োগ। ইউটিলাইজেশন = বুক হওয়া মিনিট
-- ÷ **কর্মঘণ্টার মিনিট**, আর কর্মঘণ্টা আসে `staff_working_hours` থেকে —
-- জানালার প্রতিটা দিনের isodow মিলিয়ে। যে সিটের কর্মঘণ্টা সেট করা নেই তার
-- হর নেই, তাই তার `working_minutes` আর `utilization_pct` **দুটোই null** —
-- ১০০% বা ০% নয়, কারণ দুটোই মিথ্যে হতো।
--
-- আয়ের ভাগ: সিরিয়ালে `chair_id`, অ্যাপয়েন্টমেন্টে `staff_id` — দুটোই
-- ইনকামের পাতার সাথে হুবহু এক (`computeIncomeSummary`-র `byStaff`)।
create or replace function public.shop_staff_stats(
  p_shop_id uuid,
  p_from    date,
  p_to      date
)
returns table (
  staff_id        uuid,
  staff_label     text,
  staff_name      text,
  is_active       boolean,
  serial_jobs     integer,
  appointment_jobs integer,
  jobs_total      integer,
  revenue_total   numeric,
  cancelled       integer,
  no_show         integer,
  booked_minutes  integer,
  working_minutes integer,
  utilization_pct numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  r tstzrange := public.analytics_scope(p_shop_id, p_from, p_to);
begin
  return query
  with chairs_of_shop as (
    select c.id, c.label, c.staff_name, c.is_active
      from public.chairs c
     where c.shop_id = p_shop_id
  ),
  serial_side as (
    select s.chair_id as id,
           count(*) filter (where s.status = 'DONE')::int as jobs,
           coalesce(sum(s.total_amount) filter (
             where s.status = 'DONE' and s.payment_status in ('PAID', 'DUE')), 0) as revenue,
           count(*) filter (where s.status = 'CANCELLED')::int as cancelled,
           count(*) filter (where s.status = 'NO_SHOW')::int as no_show
      from public.serials s
     where s.shop_id = p_shop_id
       and (s.completed_at <@ r or (s.completed_at is null and s.booked_at <@ r))
     group by s.chair_id
  ),
  appt_side as (
    select a.staff_id as id,
           count(*) filter (where a.status = 'DONE')::int as jobs,
           coalesce(sum(a.total_amount) filter (
             where a.status = 'DONE' and a.payment_status in ('PAID', 'DUE')), 0) as revenue,
           count(*) filter (where a.status = 'CANCELLED')::int as cancelled,
           count(*) filter (where a.status = 'NO_SHOW')::int as no_show,
           coalesce(sum(extract(epoch from (a.ends_at - a.starts_at)) / 60) filter (
             where a.status = 'DONE'), 0)::int as booked_min
      from public.appointments a
     where a.shop_id = p_shop_id and a.starts_at <@ r
     group by a.staff_id
  ),
  -- The real denominator: every configured working day inside the window.
  -- A chair with no rows here contributes nothing, and stays NULL below.
  hours as (
    select swh.chair_id as id,
           sum(extract(epoch from (swh.end_time - swh.start_time)) / 60)::int as working_min
      from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
      join public.staff_working_hours swh
        on swh.weekday = extract(isodow from d)::smallint
      join chairs_of_shop c on c.id = swh.chair_id
     group by swh.chair_id
  )
  select
    c.id,
    c.label,
    c.staff_name,
    c.is_active,
    coalesce(ss.jobs, 0),
    coalesce(aps.jobs, 0),
    coalesce(ss.jobs, 0) + coalesce(aps.jobs, 0),
    coalesce(ss.revenue, 0) + coalesce(aps.revenue, 0),
    coalesce(ss.cancelled, 0) + coalesce(aps.cancelled, 0),
    coalesce(ss.no_show, 0) + coalesce(aps.no_show, 0),
    coalesce(aps.booked_min, 0),
    h.working_min,
    case
      when h.working_min is null or h.working_min = 0 then null
      else round(100.0 * coalesce(aps.booked_min, 0) / h.working_min, 1)
    end
  from chairs_of_shop c
  left join serial_side ss on ss.id = c.id
  left join appt_side aps on aps.id = c.id
  left join hours h on h.id = c.id
  order by (coalesce(ss.jobs, 0) + coalesce(aps.jobs, 0)) desc, c.label;
end;
$$;

comment on function public.shop_staff_stats(uuid, date, date) is
  'Per-seat performance. utilization_pct is booked appointment minutes over '
  'CONFIGURED working minutes from staff_working_hours, and is NULL — not 0 '
  'and not 100 — for a seat whose hours were never set.';


-- ---------------------------------------------------------------------------
-- ৭) shop_peak_slots — কখন ভিড়
-- ---------------------------------------------------------------------------
-- লং-ফরম্যাট: `(bucket_kind, source, bucket, jobs)`। একটাই RPC ঘণ্টা আর
-- বার দুটোই দেয়, আর কিউ ও অ্যাপয়েন্টমেন্ট **আলাদা করে** — কারণ একটা
-- পার্লারের পিক স্লট তার অ্যাপয়েন্টমেন্টে, আর একটা সেলুনের ভিড় তার কিউয়ে।
-- দুটো মিশিয়ে একটা সংখ্যা দিলে ইউনিসেক্স দোকানের মালিক বুঝতে পারত না কোনটা
-- কোন দিক থেকে এলো।
--
-- **বর্ণনামূলক, ভবিষ্যদ্বাণী নয়** — শুধু গোনা হয়েছে, কিছু অনুমান করা হয়নি।
create or replace function public.shop_peak_slots(
  p_shop_id uuid,
  p_from    date,
  p_to      date
)
returns table (
  bucket_kind text,
  source      text,
  bucket      integer,
  jobs        integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  r tstzrange := public.analytics_scope(p_shop_id, p_from, p_to);
begin
  return query
  -- Serials: dated by when the work finished, which is when the shop was busy.
  select 'HOUR'::text, 'SERIAL'::text,
         extract(hour from (s.completed_at at time zone 'Asia/Dhaka'))::int,
         count(*)::int
    from public.serials s
   where s.shop_id = p_shop_id and s.status = 'DONE' and s.completed_at <@ r
   group by 3
  union all
  select 'WEEKDAY'::text, 'SERIAL'::text,
         extract(isodow from (s.completed_at at time zone 'Asia/Dhaka'))::int,
         count(*)::int
    from public.serials s
   where s.shop_id = p_shop_id and s.status = 'DONE' and s.completed_at <@ r
   group by 3
  union all
  -- Appointments: dated by the SLOT, not by completion. The slot is the
  -- demand signal — that is the hour customers actually want.
  -- `<> 'CANCELLED'` rather than a list of live statuses: a no-show slot WAS
  -- demand — somebody wanted that hour and the seat was held for them — while
  -- a cancelled slot was given back and could be resold. Peak times are about
  -- when customers want to come, so the no-show counts and the cancellation
  -- does not.
  select 'HOUR'::text, 'APPOINTMENT'::text,
         extract(hour from (a.starts_at at time zone 'Asia/Dhaka'))::int,
         count(*)::int
    from public.appointments a
   where a.shop_id = p_shop_id and a.starts_at <@ r
     and a.status <> 'CANCELLED'
   group by 3
  union all
  select 'WEEKDAY'::text, 'APPOINTMENT'::text,
         extract(isodow from (a.starts_at at time zone 'Asia/Dhaka'))::int,
         count(*)::int
    from public.appointments a
   where a.shop_id = p_shop_id and a.starts_at <@ r
     and a.status <> 'CANCELLED'
   group by 3
  order by 1, 2, 3;
end;
$$;


-- ---------------------------------------------------------------------------
-- ৮) shop_loyalty_stats — **লেজারই একমাত্র সত্য**
-- ---------------------------------------------------------------------------
-- একটাও পয়েন্ট বুকিং থেকে হিসাব করা হয় না (সিদ্ধান্ত ৬২-র ধারাবাহিকতা):
-- জমা, খরচ, সংশোধন, রেফারেল — চারটেই `loyalty_transactions` থেকে, kind ধরে।
-- আর চলতি অবস্থা (`outstanding_points`) `loyalty_accounts` থেকে, যেটা
-- লেজারের যোগফলেরই ক্যাশ।
--
-- ফ্লো (জমা/খরচ) জানালার ভেতরের, আর অবস্থা (ব্যালেন্স/অ্যাকাউন্ট) **আজকের** —
-- দুটো আলাদা জিনিস, তাই আলাদা কলামে, আর কোথাও যোগ করে দেখানো হয় না।
create or replace function public.shop_loyalty_stats(
  p_shop_id uuid,
  p_from    date,
  p_to      date
)
returns table (
  is_enabled             boolean,
  accounts               integer,
  accounts_with_balance  integer,
  outstanding_points     integer,
  lifetime_points        integer,
  earned_points          integer,
  redeemed_points        integer,
  adjusted_points        integer,
  referral_points        integer,
  transactions           integer,
  earning_customers      integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  r tstzrange := public.analytics_scope(p_shop_id, p_from, p_to);
begin
  return query
  with tx as (
    select * from public.loyalty_transactions
     where shop_id = p_shop_id and created_at <@ r
  )
  select
    coalesce((select ls.is_enabled from public.loyalty_settings ls
               where ls.shop_id = p_shop_id), false),
    (select count(*)::int from public.loyalty_accounts la where la.shop_id = p_shop_id),
    (select count(*)::int from public.loyalty_accounts la
      where la.shop_id = p_shop_id and la.balance > 0),
    (select coalesce(sum(la.balance), 0)::int from public.loyalty_accounts la
      where la.shop_id = p_shop_id),
    (select coalesce(sum(la.lifetime_earned), 0)::int from public.loyalty_accounts la
      where la.shop_id = p_shop_id),
    -- Everything credited in the window, whatever credited it.
    (select coalesce(sum(points) filter (where points > 0), 0)::int from tx),
    -- Spending is stored negative; reported positive, because "500 points
    -- redeemed" is what an owner says.
    (select coalesce(-sum(points) filter (where kind = 'REDEEM'), 0)::int from tx),
    (select coalesce(sum(points) filter (where kind = 'ADJUST'), 0)::int from tx),
    (select coalesce(sum(points) filter (where kind like 'REFERRAL%'), 0)::int from tx),
    (select count(*)::int from tx),
    (select count(distinct customer_id)::int from tx where points > 0);
end;
$$;


-- ---------------------------------------------------------------------------
-- ৯) shop_membership_stats — Sprint 6-এর বাস্তবতা মেনে
-- ---------------------------------------------------------------------------
-- **কোনো রিকারিং রেভিনিউ নেই, কারণ সিস্টেমে রিকারিং বিলিং নেই** (সিদ্ধান্ত
-- ৫১)। নবায়ন মানে একটা নতুন সারি, অটো-রিনিউয়াল নেই, অনলাইন গেটওয়ে নেই।
-- তাই এখানে "MRR" বা "প্রত্যাশিত আয়" জাতীয় কিছু নেই — শুধু **আদায় হওয়া**
-- টাকা (`paid_at` জানালার ভেতরে, `payment_status = 'PAID'`) আর বাকি।
--
-- `shop_membership_summary()` (Sprint 6) ছোঁয়া হয়নি: ওটা মেম্বারশিপ পাতার
-- চলতি-অবস্থার চারটে সংখ্যা, এটা অ্যানালিটিক্সের জানালা-ভিত্তিক হিসাব। দুটো
-- আলাদা প্রশ্ন, তাই দুটো ফাংশন — নকল নয়।
create or replace function public.shop_membership_stats(
  p_shop_id uuid,
  p_from    date,
  p_to      date
)
returns table (
  tiers_total        integer,
  tiers_active       integer,
  active_members     integer,
  pending_members    integer,
  expired_members    integer,
  cancelled_members  integer,
  expiring_soon      integer,
  new_in_range       integer,
  revenue_collected  numeric,
  revenue_due        numeric,
  members_unique     integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  r tstzrange := public.analytics_scope(p_shop_id, p_from, p_to);
begin
  return query
  with cm as (
    select * from public.customer_memberships where shop_id = p_shop_id
  ),
  -- Dated by `created_at`, not `started_at`: Sprint 6 leaves `started_at`
  -- NULL until the owner activates a PENDING request, so dating enrolment by
  -- it would make every pending sale invisible — which is precisely the
  -- number an owner wants to chase.
  sold as (
    select * from cm where created_at <@ r
  )
  select
    (select count(*)::int from public.membership_tiers mt where mt.shop_id = p_shop_id),
    (select count(*)::int from public.membership_tiers mt
      where mt.shop_id = p_shop_id and mt.is_active),
    -- Current state. `expires_at > now()` as well as the status, exactly as
    -- membership_is_active() does — a lapsed row the nightly sweep has not
    -- reached yet is not active.
    (select count(*)::int from cm where status = 'ACTIVE' and expires_at > now()),
    (select count(*)::int from cm where status = 'PENDING'),
    (select count(*)::int from cm
      where status = 'EXPIRED' or (status = 'ACTIVE' and expires_at <= now())),
    (select count(*)::int from cm where status = 'CANCELLED'),
    (select count(*)::int from cm
      where status = 'ACTIVE' and expires_at > now()
        and expires_at <= now() + interval '7 days'),
    (select count(*)::int from sold),
    -- Collected, not promised. Dated by `paid_at`, which is the only date
    -- that says when money actually arrived.
    (select coalesce(sum(price) filter (where payment_status = 'PAID'), 0)
       from cm where paid_at <@ r),
    (select coalesce(sum(price), 0) from sold where payment_status = 'DUE'),
    (select count(distinct customer_id)::int from cm);
end;
$$;


-- ---------------------------------------------------------------------------
-- ১০) shop_referral_summary — Sprint 8-এর রূপান্তরের সংজ্ঞাই ব্যবহার করে
-- ---------------------------------------------------------------------------
-- **একটা কোড লেখা হলেই সেটা রূপান্তর নয়** (সিদ্ধান্ত ৫৯)। রূপান্তর মানে
-- `status = 'CONVERTED'`, যেটা বসে শুধু রেফার্ড কাস্টমারের একটা কাজ সত্যিই
-- DONE হলে। এই ফাংশন সেই কলামটাই গোনে, নিজে কিছু ঠিক করে না।
--
-- নামটা `shop_referral_summary`, কারণ `shop_referral_stats(uuid)` Sprint
-- 8-এই আছে — ওটা প্রতি-রেফারারের তালিকা, এটা দোকানের সারাংশ। পুরনোটা
-- ছোঁয়া হয়নি।
create or replace function public.shop_referral_summary(
  p_shop_id uuid,
  p_from    date,
  p_to      date
)
returns table (
  is_enabled        boolean,
  codes_issued      integer,
  referrals_total   integer,
  referrals_pending integer,
  referrals_converted integer,
  conversion_rate   numeric,
  referrers_active  integer,
  customers_brought integer,
  points_awarded    integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  r tstzrange := public.analytics_scope(p_shop_id, p_from, p_to);
begin
  return query
  with ref as (
    select * from public.referrals
     where shop_id = p_shop_id and created_at <@ r
  )
  select
    coalesce((select ls.is_enabled and ls.referral_enabled
                from public.loyalty_settings ls where ls.shop_id = p_shop_id), false),
    (select count(*)::int from public.referral_codes rc
      where rc.shop_id = p_shop_id and rc.created_at <@ r),
    (select count(*)::int from ref),
    (select count(*)::int from ref where status = 'PENDING'),
    (select count(*)::int from ref where status = 'CONVERTED'),
    (select round(100.0 * (select count(*) from ref where status = 'CONVERTED')
                  / nullif((select count(*) from ref), 0), 1)),
    (select count(distinct referrer_id)::int from ref),
    -- A referral only "brought" a customer once they actually turned up.
    (select count(distinct referred_id)::int from ref where status = 'CONVERTED'),
    (select coalesce(sum(coalesce(referrer_points, 0) + coalesce(referred_points, 0)), 0)::int
       from ref where status = 'CONVERTED');
end;
$$;


-- ---------------------------------------------------------------------------
-- ১১) shop_reward_stats — Sprint 9-এর কুপন
-- ---------------------------------------------------------------------------
-- **রিফান্ড/বাতিলের কোনো হিসাব নেই, কারণ সিস্টেমে ওটা নেই** (সিদ্ধান্ত ৬৫:
-- `CANCELLED` স্ট্যাটাসই তৈরি করা হয়নি)। তিনটে স্ট্যাটাস আছে, তিনটেই গোনা হয়।
--
-- `points_spent` আসে **কুপনের** `points_spent` থেকে, আর সেটা লেজারের
-- `REDEEM` সারির সমান হতেই হবে — হার্নেস দুটো মিলিয়ে দেখে।
create or replace function public.shop_reward_stats(
  p_shop_id uuid,
  p_from    date,
  p_to      date
)
returns table (
  rewards_total      integer,
  rewards_active     integer,
  rewards_available  integer,
  redemptions_total  integer,
  redemptions_issued integer,
  redemptions_used   integer,
  redemptions_expired integer,
  use_rate           numeric,
  points_spent       integer,
  discount_given     numeric,
  redeeming_customers integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  r tstzrange := public.analytics_scope(p_shop_id, p_from, p_to);
begin
  return query
  with rd as (
    select * from public.reward_redemptions
     where shop_id = p_shop_id and issued_at <@ r
  )
  select
    (select count(*)::int from public.rewards rw where rw.shop_id = p_shop_id),
    (select count(*)::int from public.rewards rw
      where rw.shop_id = p_shop_id and rw.is_active),
    -- On the shelf right now: active, in date, in stock — the same three
    -- conditions `isRewardAvailable()` checks on the client.
    (select count(*)::int from public.rewards rw
      where rw.shop_id = p_shop_id and rw.is_active
        and (rw.valid_until is null or rw.valid_until > now())
        and (rw.stock is null or rw.stock > 0)),
    (select count(*)::int from rd),
    (select count(*)::int from rd where status = 'ISSUED'),
    (select count(*)::int from rd where status = 'USED'),
    (select count(*)::int from rd where status = 'EXPIRED'),
    -- Of the coupons that reached an outcome, how many were actually spent.
    -- An ISSUED coupon has not failed — it is simply still in a pocket.
    (select round(100.0 * (select count(*) from rd where status = 'USED')
                  / nullif((select count(*) from rd where status in ('USED', 'EXPIRED')), 0), 1)),
    -- `rd.` qualified deliberately: `points_spent` is also this function's
    -- own OUT parameter, and an unqualified reference is ambiguous.
    (select coalesce(sum(rd.points_spent), 0)::int from rd),
    (select coalesce(sum(rd.discount_amount), 0) from rd where rd.status = 'USED'),
    (select count(distinct rd.customer_id)::int from rd);
end;
$$;


-- ---------------------------------------------------------------------------
-- ১২) shop_analytics_breakdown — একটাই "টপ N" RPC, চারটে মাত্রার জন্য
-- ---------------------------------------------------------------------------
-- চারটে আলাদা ছোট RPC-র বদলে একটা, কারণ চারটেরই আকৃতি এক:
-- `(key, label, jobs, amount)`। মাত্রাগুলো:
--
--   · `SERVICE`         — কোন সার্ভিস কত আনল (বহু-সার্ভিসের বিল সমান ভাগে
--                          ভাগ হয়, নইলে যোগফল দোকানের আয়ের চেয়ে বড় হতো —
--                          `buildShopBrief`-এর একই যুক্তি)
--   · `PAYMENT_METHOD`  — নগদ বনাম মোবাইল ব্যাংকিং বনাম বাকি
--   · `MEMBERSHIP_TIER` — কোন টিয়ার বিক্রি হচ্ছে
--   · `REWARD`          — কোন রিওয়ার্ড নেওয়া হচ্ছে
create or replace function public.shop_analytics_breakdown(
  p_shop_id  uuid,
  p_from     date,
  p_to       date,
  p_dimension text
)
returns table (
  key    text,
  label  text,
  jobs   integer,
  amount numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  r tstzrange := public.analytics_scope(p_shop_id, p_from, p_to);
begin
  if p_dimension is null
     or p_dimension not in ('SERVICE', 'PAYMENT_METHOD', 'MEMBERSHIP_TIER', 'REWARD') then
    raise exception 'analytics_dimension_invalid';
  end if;

  if p_dimension = 'SERVICE' then
    return query
    with done as (
      select s.total_amount, s.services_snapshot
        from public.serials s
       where s.shop_id = p_shop_id and s.status = 'DONE'
         and s.payment_status in ('PAID', 'DUE') and s.completed_at <@ r
      union all
      select a.total_amount, a.services_snapshot
        from public.appointments a
       where a.shop_id = p_shop_id and a.status = 'DONE'
         and a.payment_status in ('PAID', 'DUE') and a.completed_at <@ r
    ),
    split as (
      select
        e->>'service_id' as sid,
        e->>'name'       as sname,
        -- Even split across the bill's services. Counting the whole bill
        -- against each one would make the column add up to more than the
        -- shop earned, which quietly poisons every conclusion drawn from it.
        done.total_amount / greatest(jsonb_array_length(done.services_snapshot), 1) as share
      from done
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(done.services_snapshot) = 'array'
             then done.services_snapshot else '[]'::jsonb end
      ) e
    )
    select coalesce(sid, ''), coalesce(sname, ''), count(*)::int, round(sum(share), 2)
      from split
     group by 1, 2
     order by 4 desc nulls last, 3 desc
     limit 20;

  elsif p_dimension = 'PAYMENT_METHOD' then
    return query
    with paid as (
      select
        case when s.payment_status = 'DUE' then 'due'
             else coalesce(nullif(s.payment_method, ''), 'unknown') end as m,
        s.total_amount
        from public.serials s
       where s.shop_id = p_shop_id and s.status = 'DONE'
         and s.payment_status in ('PAID', 'DUE') and s.completed_at <@ r
      union all
      select
        case when a.payment_status = 'DUE' then 'due'
             else coalesce(nullif(a.payment_method, ''), 'unknown') end,
        a.total_amount
        from public.appointments a
       where a.shop_id = p_shop_id and a.status = 'DONE'
         and a.payment_status in ('PAID', 'DUE') and a.completed_at <@ r
      union all
      -- Manual entries belong here too: the overview counts them as revenue
      -- from the same three sources, so leaving them out would make this
      -- column fail to add up to the shop's own total.
      select
        case when m.payment_status = 'DUE' then 'due'
             else coalesce(nullif(m.payment_method, ''), 'unknown') end,
        m.amount
        from public.manual_entries m
       where m.shop_id = p_shop_id and m.created_at <@ r
    )
    select m, m, count(*)::int, round(sum(total_amount), 2)
      from paid group by 1 order by 4 desc limit 20;

  elsif p_dimension = 'MEMBERSHIP_TIER' then
    return query
    select
      coalesce(cm.tier_snapshot->>'tier_id', cm.tier_id::text),
      coalesce(cm.tier_snapshot->>'name', ''),
      count(*)::int,
      round(coalesce(sum(cm.price) filter (where cm.payment_status = 'PAID'), 0), 2)
      from public.customer_memberships cm
     where cm.shop_id = p_shop_id and cm.created_at <@ r
     group by 1, 2
     order by 3 desc
     limit 20;

  else
    return query
    select
      coalesce(rd.reward_snapshot->>'name', ''),
      coalesce(rd.reward_snapshot->>'name', ''),
      count(*)::int,
      coalesce(sum(rd.points_spent), 0)::numeric
      from public.reward_redemptions rd
     where rd.shop_id = p_shop_id and rd.issued_at <@ r
     group by 1, 2
     order by 3 desc
     limit 20;
  end if;
end;
$$;

comment on function public.shop_analytics_breakdown(uuid, date, date, text) is
  'One "top N" RPC for four dimensions, because all four share the shape '
  '(key, label, jobs, amount). A multi-service bill is split evenly across '
  'its services so the column never adds up to more than the shop earned.';


-- ===========================================================================
-- যাচাই — মাইগ্রেশনের পর আনকমেন্ট করে চালাও। সব ok = true হওয়া চাই।
-- ===========================================================================
--
-- select * from (values
--   -- কোনো নতুন টেবিল তৈরি হয়নি (সিদ্ধান্ত ৬৭)
--   ('no analytics table was created',
--    to_regclass('public.analytics_events') is null
--    and to_regclass('public.analytics_daily') is null
--    and to_regclass('public.shop_analytics') is null
--    and to_regclass('public.analytics_snapshots') is null),
--
--   -- গেট
--   ('analytics_scope exists',
--    to_regprocedure('public.analytics_scope(uuid,date,date)') is not null),
--   ('analytics_scope is INVOKER',
--    (select not prosecdef from pg_proc
--      where oid='public.analytics_scope(uuid,date,date)'::regprocedure)),
--
--   -- এগারোটা RPC, সবগুলো INVOKER আর সবগুলো STABLE (অর্থাৎ লিখতে পারে না)
--   ('all 11 analytics RPCs exist',
--    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname in (
--        'shop_overview_stats','shop_revenue_trend','shop_appointment_stats',
--        'shop_queue_stats','shop_staff_stats','shop_peak_slots',
--        'shop_loyalty_stats','shop_membership_stats','shop_referral_summary',
--        'shop_reward_stats','shop_analytics_breakdown')) = 11),
--   ('every analytics RPC is SECURITY INVOKER',
--    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--                 where n.nspname = 'public' and p.prosecdef and p.proname in (
--                   'analytics_scope','shop_overview_stats','shop_revenue_trend',
--                   'shop_appointment_stats','shop_queue_stats','shop_staff_stats',
--                   'shop_peak_slots','shop_loyalty_stats','shop_membership_stats',
--                   'shop_referral_summary','shop_reward_stats',
--                   'shop_analytics_breakdown'))),
--   ('every analytics RPC is read-only (STABLE, never VOLATILE)',
--    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--                 where n.nspname = 'public' and p.provolatile = 'v' and p.proname in (
--                   'analytics_scope','shop_overview_stats','shop_revenue_trend',
--                   'shop_appointment_stats','shop_queue_stats','shop_staff_stats',
--                   'shop_peak_slots','shop_loyalty_stats','shop_membership_stats',
--                   'shop_referral_summary','shop_reward_stats',
--                   'shop_analytics_breakdown'))),
--
--   -- ইনডেক্স
--   ('serials got its (shop_id, completed_at) index',
--    exists (select 1 from pg_indexes where indexname='serials_shop_completed_idx')),
--
--   -- আসল সময় নেই, তাই কলামও নেই (সিদ্ধান্ত ৬৯)
--   ('appointments still has no started_at, so no actual-duration column exists',
--    not exists (select 1 from information_schema.columns
--                 where table_name='appointments' and column_name='started_at')),
--
--   -- আগের স্প্রিন্টগুলো অক্ষত — একটাও ফাংশন replace হয়নি
--   ('shop_membership_summary untouched',
--    to_regprocedure('public.shop_membership_summary(uuid)') is not null),
--   ('shop_referral_stats (Sprint 8, per-referrer) untouched',
--    to_regprocedure('public.shop_referral_stats(uuid)') is not null),
--   ('loyalty_award untouched',
--    to_regprocedure('public.loyalty_award(uuid,uuid,integer,text,uuid,uuid,numeric,integer,text)') is not null),
--   ('redeem_reward untouched',
--    to_regprocedure('public.redeem_reward(uuid,uuid)') is not null),
--   ('mark_redemption_used untouched',
--    to_regprocedure('public.mark_redemption_used(uuid,text,text,uuid)') is not null),
--   ('claim_referral untouched', to_regprocedure('public.claim_referral(uuid,text)') is not null),
--   ('points_for_bill untouched',
--    to_regprocedure('public.points_for_bill(numeric,integer,numeric)') is not null),
--   ('membership_is_active untouched',
--    to_regprocedure('public.membership_is_active(uuid,uuid)') is not null),
--   ('every core trigger still there',
--    exists (select 1 from pg_trigger where tgname='serials_before_update')
--    and exists (select 1 from pg_trigger where tgname='serials_after_update')
--    and exists (select 1 from pg_trigger where tgname='appointments_before_update')
--    and exists (select 1 from pg_trigger where tgname='appointments_after_update')
--    and exists (select 1 from pg_trigger where tgname='serials_zz_loyalty_award')
--    and exists (select 1 from pg_trigger where tgname='appointments_zz_loyalty_award')
--    and exists (select 1 from pg_trigger where tgname='serials_zz_referral_convert')
--    and exists (select 1 from pg_trigger where tgname='appointments_zz_referral_convert')
--    and exists (select 1 from pg_trigger where tgname='serials_zz_reward_discount')
--    and exists (select 1 from pg_trigger where tgname='appointments_zz_reward_discount')),
--   ('appointment overlap constraint still there',
--    exists (select 1 from pg_constraint where conname='appointments_no_overlap')),
--   ('policy counts unchanged',
--    (select count(*) from pg_policies where tablename='appointments') = 5
--    and (select count(*) from pg_policies where tablename='customer_memberships') = 5
--    and (select count(*) from pg_policies where tablename='loyalty_accounts') = 1
--    and (select count(*) from pg_policies where tablename='reward_redemptions') = 1
--    and (select count(*) from pg_policies where tablename='referrals') = 1),
--   ('balance still equals ledger sum everywhere',
--    not exists (
--      select 1 from public.loyalty_accounts a
--       where a.balance <> coalesce((select sum(t.points) from public.loyalty_transactions t
--                                     where t.shop_id=a.shop_id and t.customer_id=a.customer_id), 0))),
--
--   -- গেটটা সত্যিই সব RPC-র প্রথম ধাপ, আর সই মিলিয়ে
--   ('every analytics RPC takes (uuid, date, date) first',
--    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--      where n.nspname='public'
--        and p.proname in ('shop_overview_stats','shop_revenue_trend','shop_appointment_stats',
--                          'shop_queue_stats','shop_staff_stats','shop_peak_slots',
--                          'shop_loyalty_stats','shop_membership_stats','shop_referral_summary',
--                          'shop_reward_stats','shop_analytics_breakdown')
--        and p.proargtypes[0] = 'uuid'::regtype
--        and p.proargtypes[1] = 'date'::regtype
--        and p.proargtypes[2] = 'date'::regtype) = 11),
--   ('every analytics RPC returns a set, never a scalar',
--    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--      where n.nspname='public' and p.proretset
--        and p.proname like 'shop\_%stat%') >= 8),
--   ('every analytics RPC pins search_path',
--    not exists (
--      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--       where n.nspname='public'
--         and p.proname in ('analytics_scope','shop_overview_stats','shop_revenue_trend',
--                           'shop_appointment_stats','shop_queue_stats','shop_staff_stats',
--                           'shop_peak_slots','shop_loyalty_stats','shop_membership_stats',
--                           'shop_referral_summary','shop_reward_stats','shop_analytics_breakdown')
--         and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'))  c
--                          where c like 'search_path=%'))),
--
--   -- ইনডেক্সটা পার্শিয়াল — শেষ-হওয়া কাজের সমান বড়, পুরো টেবিলের নয়
--   ('the new index is partial, not whole-table',
--    (select indexdef from pg_indexes where indexname='serials_shop_completed_idx')
--      like '%WHERE (completed_at IS NOT NULL)%'),
--
--   -- লেনদেনের টেবিলে একটাও কলাম যোগ করা হয়নি (সিদ্ধান্ত ৬৭)
--   ('no analytics column landed on serials',
--    (select count(*) from information_schema.columns
--      where table_name='serials' and column_name like '%analytic%') = 0),
--   ('no analytics column landed on appointments',
--    (select count(*) from information_schema.columns
--      where table_name='appointments' and column_name like '%analytic%') = 0),
--   ('no analytics column landed on the ledger',
--    (select count(*) from information_schema.columns
--      where table_name='loyalty_transactions' and column_name like '%analytic%') = 0),
--   ('no materialized view was created',
--    (select count(*) from pg_matviews where schemaname='public') = 0)
-- ) as t(check_name, ok) order by ok, check_name;
--
--
-- ---------------------------------------------------------------------------
-- গেটটা সত্যিই আটকায় — এটা SQL এডিটরেই চালানো যায়
-- ---------------------------------------------------------------------------
-- উপরের চেকগুলো কাঠামো দেখে; এটা **আচরণ** দেখে, আর ঠিক এই একটা জিনিসই
-- SQL এডিটরে যাচাই করা সম্ভব: এডিটর `service_role`-এ চলে, যার `auth.uid()`
-- নেই, তাই `is_shop_owner()` কখনোই সত্যি হবে না — অর্থাৎ **যেকোনো** shop id
-- দিলেই `not your shop` আসতে হবে। শূন্য সারি এলে গার্ডটা কাজ করছে না।
-- কিছুই লেখে না, তাই rollback লাগে না।
--
-- do $$
-- declare
--   v_shop    uuid;
--   v_msg     text := null;
--   v_allowed boolean := false;
-- begin
--   select id into v_shop from public.shops limit 1;
--   if v_shop is null then
--     raise notice 'ok — কোনো দোকান নেই, পরীক্ষার কিছু নেই';
--     return;
--   end if;
--
--   begin
--     perform 1 from public.shop_overview_stats(v_shop, current_date - 6, current_date);
--     v_allowed := true;   -- গার্ড আটকায়নি
--   exception
--     when others then v_msg := sqlerrm;
--   end;
--
--   if v_allowed then
--     raise exception 'FAIL — গার্ড আটকায়নি: auth.uid() ছাড়াই হিসাব বেরিয়ে এসেছে';
--   elsif v_msg like '%not your shop%' then
--     raise notice 'ok — গার্ড আটকেছে: %', v_msg;
--   else
--     raise exception 'FAIL — অন্য কারণে ব্যর্থ: %', v_msg;
--   end if;
-- end $$;
--
--
-- ---------------------------------------------------------------------------
-- আচরণগত প্রোব — এই ফাইলে কোনোটাই লেখে না, তাই rollback-ও লাগে না
-- ---------------------------------------------------------------------------
-- প্রতিটা RPC `stable`, অর্থাৎ Postgres নিজেই ওদের ভেতর থেকে কোনো লেখা
-- হতে দেবে না। তাই আগের স্প্রিন্টগুলোর মতো `raise exception`-এ মোড়া DO
-- ব্লকের দরকার নেই — একটা `select shop_overview_stats(...)` চালালে কোনো
-- সারি বদলায় না, যোগ হয় না, মুছে যায় না।
--
-- SQL এডিটরে যা চালিয়ে দেখা যায় (নিজের দোকানের id বসিয়ে):
--
--   select * from public.shop_overview_stats('<shop-id>', current_date - 29, current_date);
--   select * from public.shop_revenue_trend('<shop-id>', current_date - 29, current_date, 'DAY');
--   select * from public.shop_staff_stats('<shop-id>', current_date - 29, current_date);
--   select * from public.shop_peak_slots('<shop-id>', current_date - 29, current_date);
--
-- **মনে রাখা দরকার:** SQL এডিটর `service_role`-এ চলে, যা RLS বাইপাস করে আর
-- যার `auth.uid()` নেই — তাই ওখানে `analytics_scope` **`not your shop`
-- দিয়ে ব্যর্থ হবে**, আর সেটাই সঠিক আচরণ। আইসোলেশন প্রমাণ হয় লোকাল
-- হার্নেসে, আসল non-superuser রোলে (`run-sprint10-checks.sh`)।
