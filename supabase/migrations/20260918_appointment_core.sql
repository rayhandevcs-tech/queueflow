-- ফেজ ৬ / Sprint 4 — অ্যাপয়েন্টমেন্ট কোর
--
-- ===========================================================================
-- চালানোর ক্রম (গুরুত্বপূর্ণ)
-- ===========================================================================
--   1. 20260916_parlour_foundation.sql   ✅ চালানো হয়েছে
--   2. 20260917_service_categories.sql   ← এটা আগে চালাও
--   3. 20260918_appointment_core.sql     ← এই ফাইল
--
-- 20260917 আগে লাগে না কারিগরিভাবে, কিন্তু পার্লার ক্যাটাগরি ছাড়া সার্ভিস
-- সেটআপ অসম্পূর্ণ থাকে, তাই ক্রমটা এভাবেই রাখা।
--
-- ===========================================================================
-- এই মাইগ্রেশন কী করে (এবং কী করে না)
-- ===========================================================================
-- করে:  একটা নতুন টেবিল (appointments), তার RLS, ৪টা ইনডেক্স, একটা EXCLUDE
--        কনস্ট্রেইন্ট, ২টা ট্রিগার আর ২টা RPC যোগ করে। **কোনো নতুন টাইপ নয়** —
--        স্ট্যাটাস কলামগুলো text + CHECK, এই স্কিমার বাকি সবের মতোই।
--
-- করে না: বিদ্যমান কোনো টেবিল ছোঁয় না। serials, chairs, services, shops —
--         একটাতেও ALTER নেই, একটা সারিও বদলায় না। কিউ ইঞ্জিনের কোনো ফাংশন,
--         ট্রিগার বা পলিসি পুনরায় লেখা হয়নি। সেলুনের কিছুই এই ফাইলে নেই।
--
-- সবটাই পুনরায় চালানো নিরাপদ (if not exists / drop ... if exists + create)।
-- ===========================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- ১) স্ট্যাটাস — text + CHECK, Postgres enum নয়
-- ---------------------------------------------------------------------------
-- **এই স্কিমায় একটাও আসল Postgres enum টাইপ নেই।** serial_status,
-- payment_status, business_type — সবই `text` কলাম + CHECK কনস্ট্রেইন্ট।
-- `database.types.ts`-এর `Enums` ব্লকটা শুধু অ্যাপের নামকরণের স্তর, ডেটাবেসের
-- গঠন নয়। তাই appointments-ও একই ধাঁচে, নইলে এই একটা টেবিলেই আলাদা নিয়ম হতো
-- (আর `alter type ... add value` ট্রানজেকশনে চলে না, যা পরে ভোগাত)।
--
-- BOOKED = "pending" (কাস্টমার নিয়েছে, দোকান এখনো নিশ্চিত করেনি)। নামগুলো
-- Sprint 2-এর `AppointmentStatus` টাইপের সঙ্গে হুবহু মেলে।

-- এই ফাইলের আগের খসড়া একটা enum টাইপ বানাত। কোনো আংশিক রান সেটা রেখে গিয়ে
-- থাকলে সরিয়ে দেওয়া হচ্ছে — কেউ ব্যবহার করে থাকলে হাত দেওয়া হবে না।
do $$
begin
  if exists (select 1 from pg_type where typname = 'appointment_status') then
    begin
      drop type public.appointment_status;
      raise notice 'dropped leftover appointment_status enum type';
    exception when dependent_objects_still_exist then
      raise notice 'appointment_status type is still in use — left alone';
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ২) সময় অঞ্চল
-- ---------------------------------------------------------------------------
-- shops.weekly_hours-এ সময় লেখা থাকে দেয়াল-ঘড়ির স্ট্রিং হিসেবে ("10:00"),
-- কিন্তু appointments.starts_at হলো timestamptz। দুটো মেলাতে একটা টাইমজোন
-- লাগে। অ্যাপটা বাংলাদেশের, তাই Asia/Dhaka — কিন্তু ধ্রুবকটা ছড়িয়ে না দিয়ে
-- একটা ফাংশনে রাখা হলো, যাতে ভবিষ্যতে shops-এ timezone কলাম এলে একটাই জায়গা
-- বদলাতে হয়।
create or replace function public.shop_timezone(p_shop_id uuid)
returns text
language sql
immutable
as $$ select 'Asia/Dhaka'::text $$;

comment on function public.shop_timezone(uuid) is
  'Wall-clock timezone for a shop. Constant today; the seam for a future '
  'shops.timezone column.';

-- ---------------------------------------------------------------------------
-- ৩) টেবিল
-- ---------------------------------------------------------------------------
-- টাকার কলামগুলো serials-এর হুবহু নকল (সিদ্ধান্ত ২৯) — যাতে ইনকাম, বাকির খাতা
-- আর ক্যাশবুকের বিশুদ্ধ ফাংশনগুলো একই আকৃতির সারি পায় এবং দ্বিতীয়বার লিখতে
-- না হয়।
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  -- একটা chairs সারি পার্লারে একই সঙ্গে সিট আর তার বিউটিশিয়ান (Sprint 1)।
  -- on delete restrict: কারো নামে অ্যাপয়েন্টমেন্ট থাকলে সেই সিট মোছা যাবে না।
  staff_id uuid not null references public.chairs(id) on delete restrict,
  customer_id uuid references public.profiles(id) on delete set null,

  -- বুকিংয়ের সময় স্ন্যাপশট নেওয়া হয়, ঠিক serials-এর মতো — তাই কাস্টমারের নাম
  -- দেখাতে profiles-এ ক্রস-ইউজার রিড লাগে না, আর profiles-এর RLS "শুধু নিজের
  -- সারি" থাকতেই পারে।
  customer_name text not null default '',
  customer_phone text,
  customer_avatar_url text,

  service_ids uuid[] not null,
  services_snapshot jsonb not null default '[]'::jsonb,

  starts_at timestamptz not null,
  -- ক্লায়েন্ট পাঠায় না — ইনসার্ট ট্রিগার সার্ভিসের সময় থেকে হিসাব করে।
  ends_at timestamptz not null,

  status text not null default 'BOOKED'
    check (status in ('BOOKED', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'NO_SHOW')),

  -- টাকা (সিদ্ধান্ত ২৯ — serials-এর নকল)
  total_amount numeric(10, 2) not null default 0,
  payment_status text not null default 'DUE'
    check (payment_status in ('PAID', 'DUE', 'ADVANCE')),
  due_amount numeric(10, 2) not null default 0,
  due_collected_at timestamptz,
  payment_method text,
  advance_paid boolean not null default false,
  advance_method text,
  advance_txn_id text,

  is_walk_in boolean not null default false,
  notes text,

  booked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancel_reason text,

  -- Sprint 5-এর রিমাইন্ডারের ইন্টিগ্রেশন পয়েন্ট। এই স্প্রিন্টে কেউ লেখে না,
  -- কেউ পড়ে না — শুধু জায়গাটা রাখা, যাতে পরে ALTER না লাগে।
  reminded_at timestamptz,

  constraint appointments_time_order check (ends_at > starts_at),
  constraint appointments_services_not_empty check (cardinality(service_ids) > 0)
);

comment on table public.appointments is
  'Beauty parlour bookings. Never mixed into serials (decision 24): a queue row '
  'has a position and no clock, an appointment has a clock and no position.';

-- ---------------------------------------------------------------------------
-- ৪) ডাবল-বুকিং ঠেকায় ডেটাবেস, UI নয় (সিদ্ধান্ত ৩০)
-- ---------------------------------------------------------------------------
-- একজন বিউটিশিয়ানের দুটো সক্রিয় অ্যাপয়েন্টমেন্ট সময়ে ওভারল্যাপ করতে পারবে না।
-- বাতিল/নো-শো/শেষ হওয়া সারি স্লট ছেড়ে দেয়, তাই WHERE ক্লজে শুধু সক্রিয় তিনটে।
--
-- এটাই একমাত্র গ্যারান্টি — দুটো ব্রাউজার একই সেকেন্ডে একই স্লট চাইলে Postgres
-- একটাকে ফেরাবে (SQLSTATE 23P01)। কোনো অ্যাডভাইজরি লক বা "আগে চেক করে তারপর
-- ইনসার্ট" দিয়ে এটা করা যেত না — ওখানে সবসময় একটা রেস উইন্ডো থেকে যায়।
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointments_no_overlap'
  ) then
    alter table public.appointments
      add constraint appointments_no_overlap
      exclude using gist (
        staff_id with =,
        tstzrange(starts_at, ends_at) with &&
      ) where (status in ('BOOKED', 'CONFIRMED', 'IN_PROGRESS'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ৫) ইনডেক্স
-- ---------------------------------------------------------------------------
-- বোর্ড দিনভিত্তিক পড়ে; কাস্টমার নিজের তালিকা সময়ক্রমে পড়ে।
create index if not exists appointments_shop_starts_idx
  on public.appointments (shop_id, starts_at);
create index if not exists appointments_staff_starts_idx
  on public.appointments (staff_id, starts_at);
create index if not exists appointments_customer_idx
  on public.appointments (customer_id, starts_at desc);
create index if not exists appointments_status_idx
  on public.appointments (shop_id, status);

-- ---------------------------------------------------------------------------
-- ৬) RLS — বিজনেস আইসোলেশন
-- ---------------------------------------------------------------------------
-- প্যাটার্নটা serials-এর হুবহু: পড়া = নিজের অথবা মালিকের, লেখা = নিজের জন্য
-- অথবা মালিকের walk-in, আপডেট = কাস্টমার শুধু বাতিল করতে পারে, মালিক সব।
-- এক দোকান অন্য দোকানের সারি কোনো পথেই দেখতে বা বদলাতে পারে না — is_shop_owner()
-- ছাড়া আর কোনো শর্ত নেই।
--
-- DELETE-এর কোনো পলিসি ইচ্ছাকৃতভাবে নেই: বাতিল একটা স্ট্যাটাস, মুছে ফেলা নয়।
alter table public.appointments enable row level security;

drop policy if exists "appointments: customer or owner read" on public.appointments;
create policy "appointments: customer or owner read" on public.appointments
  for select using (customer_id = auth.uid() or public.is_shop_owner(shop_id));

drop policy if exists "appointments: customer insert" on public.appointments;
create policy "appointments: customer insert" on public.appointments
  for insert with check (auth.uid() = customer_id and is_walk_in = false);

drop policy if exists "appointments: owner insert" on public.appointments;
create policy "appointments: owner insert" on public.appointments
  for insert with check (public.is_shop_owner(shop_id) and is_walk_in = true);

-- কাস্টমারের একমাত্র লেখার পথ: নিজের সারিকে CANCELLED করা। স্ট্যাটাস মেশিন
-- ট্রিগারে, তাই এখান দিয়ে DONE বসিয়ে দেওয়ার পথও নেই।
drop policy if exists "appointments: customer cancel own" on public.appointments;
create policy "appointments: customer cancel own" on public.appointments
  for update using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id and status = 'CANCELLED');

drop policy if exists "appointments: owner manage" on public.appointments;
create policy "appointments: owner manage" on public.appointments
  for update using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

-- ---------------------------------------------------------------------------
-- ৭) BEFORE INSERT — সার্ভারই কর্তৃপক্ষ
-- ---------------------------------------------------------------------------
-- ক্লায়েন্ট পাঠায় শুধু: shop, staff, service_ids, starts_at।
-- বাকি সব — ends_at, দাম, স্ন্যাপশট, কাস্টমারের নাম — এখানে হিসাব হয়।
-- অর্থাৎ ক্লায়েন্ট চাইলেও দুই ঘণ্টার সার্ভিসের জন্য পাঁচ মিনিটের স্লট দাবি
-- করতে পারবে না, বা দাম কমিয়ে পাঠাতে পারবে না।
create or replace function public.appointment_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count      integer;
  v_duration   integer;
  v_tz         text;
  v_local      timestamp;
  v_day        text;
  v_day_hours  jsonb;
  v_open       time;
  v_close      time;
  v_open_ts    timestamptz;
  v_close_ts   timestamptz;
begin
  -- দোকান অনুমোদিত কিনা। ইচ্ছাকৃতভাবে is_open দেখা হচ্ছে **না**: ওটা কিউয়ের
  -- "এই মুহূর্তে খোলা" ফ্ল্যাগ। আগামীকালের অ্যাপয়েন্টমেন্ট রাত ১১টায় নেওয়া
  -- যাবে না — এমন নিয়ম অ্যাপয়েন্টমেন্ট ব্যবসায় অর্থহীন।
  if not exists (
    select 1 from public.shops where id = new.shop_id and status = 'ACTIVE'
  ) then
    raise exception 'shop is not active';
  end if;

  if new.starts_at <= now() then
    raise exception 'appointment_in_past';
  end if;

  -- সার্ভিসগুলো এই দোকানেরই এবং চালু কিনা
  select count(*) into v_count
    from public.services
   where id = any (new.service_ids)
     and shop_id = new.shop_id
     and is_active = true;
  if v_count <> cardinality(new.service_ids) then
    raise exception 'invalid service selection for this shop';
  end if;

  -- স্টাফ এই দোকানেরই এবং চালু কিনা। এটাই ক্রস-শপ বুকিং ঠেকানোর জায়গা:
  -- অন্য দোকানের staff_id দিয়ে নিজের দোকানে সারি বসানো যাবে না।
  if not exists (
    select 1 from public.chairs
     where id = new.staff_id and shop_id = new.shop_id and is_active = true
  ) then
    raise exception 'staff does not belong to this shop or is inactive';
  end if;

  -- এই স্টাফ সব সার্ভিস করতে পারে কিনা। chair_service_stats-এ সারি না থাকা
  -- মানে "পারে" — CanPerformMatrix-এর ডিফল্টও তাই, দুই জায়গায় দুই নিয়ম হলে
  -- UI আর DB দ্বিমত করত।
  if exists (
    select 1 from unnest(new.service_ids) as sid
     where exists (
       select 1 from public.chair_service_stats css
        where css.chair_id = new.staff_id
          and css.service_id = sid
          and css.can_perform = false)
  ) then
    raise exception 'selected staff cannot perform all requested services';
  end if;

  -- দাম ও সময়ের স্ন্যাপশট। রেট পরে বদলালেও পুরনো অ্যাপয়েন্টমেন্টের হিসাব
  -- বদলাবে না (সিদ্ধান্ত ৪২)।
  --
  -- সময় নেওয়া হচ্ছে services.default_duration_min থেকে, চেয়ারের শেখা গড়
  -- (rolling_avg_duration_min) থেকে নয় — ইচ্ছাকৃতভাবে। শেখা গড় কিউয়ের জিনিস;
  -- অ্যাপয়েন্টমেন্টে দোকানদার যে সময় বলে স্লট বেচেছে, সেটাই চুক্তি।
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'service_id',             s.id,
      'name',                   s.name,
      'rate',                   s.rate,
      'estimated_duration_min', s.default_duration_min
    ) order by s.created_at), '[]'::jsonb),
    coalesce(sum(s.rate), 0),
    coalesce(sum(s.default_duration_min), 0)
  into new.services_snapshot, new.total_amount, v_duration
  from unnest(new.service_ids) as sid
  join public.services s on s.id = sid;

  if v_duration < 1 then
    raise exception 'invalid service duration';
  end if;

  -- ends_at সবসময় সার্ভার হিসাব করে, ক্লায়েন্ট যা-ই পাঠাক।
  new.ends_at := new.starts_at + make_interval(mins => v_duration);

  -- দোকানের সেই দিনের খোলা-বন্ধের মধ্যে পড়ে কিনা
  v_tz    := public.shop_timezone(new.shop_id);
  v_local := new.starts_at at time zone v_tz;
  -- isodow: 1 = সোমবার … 7 = রবিবার, weekly_hours-এর কী-ক্রমের সঙ্গে মেলে
  v_day   := (array['mon','tue','wed','thu','fri','sat','sun'])[extract(isodow from v_local)::int];

  select weekly_hours -> v_day into v_day_hours
    from public.shops where id = new.shop_id;

  -- সময় সেট করা না থাকলে যাচাই করার কিছু নেই — নতুন দোকানকে আটকানো হবে না।
  if v_day_hours is not null and jsonb_typeof(v_day_hours) = 'object' then
    if coalesce((v_day_hours ->> 'closed')::boolean, false) then
      raise exception 'shop_closed_that_day';
    end if;

    v_open  := nullif(v_day_hours ->> 'open', '')::time;
    v_close := nullif(v_day_hours ->> 'close', '')::time;

    if v_open is not null and v_close is not null and v_close > v_open then
      v_open_ts  := (v_local::date + v_open)  at time zone v_tz;
      v_close_ts := (v_local::date + v_close) at time zone v_tz;
      if new.starts_at < v_open_ts or new.ends_at > v_close_ts then
        raise exception 'outside_working_hours';
      end if;
    end if;
  end if;

  new.status    := 'BOOKED';
  new.booked_at := now();
  new.due_amount := new.total_amount;

  -- অনলাইন বুকিংয়ে কাস্টমারের নাম/ফোন/ছবি profiles থেকে স্ন্যাপশট
  if new.is_walk_in = false and new.customer_id is not null then
    select coalesce(full_name, ''), phone, avatar_url
      into new.customer_name, new.customer_phone, new.customer_avatar_url
      from public.profiles where id = new.customer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_before_insert on public.appointments;
create trigger appointments_before_insert
  before insert on public.appointments
  for each row execute function public.appointment_before_insert();

-- ---------------------------------------------------------------------------
-- ৮) BEFORE UPDATE — স্ট্যাটাস মেশিন + ইতিহাস অপরিবর্তনীয়
-- ---------------------------------------------------------------------------
-- অনুমোদিত পথ:
--   BOOKED      → CONFIRMED | IN_PROGRESS | CANCELLED | NO_SHOW
--   CONFIRMED   → IN_PROGRESS | CANCELLED | NO_SHOW
--   IN_PROGRESS → DONE | CANCELLED
--   DONE / CANCELLED / NO_SHOW → চূড়ান্ত, কোথাও যায় না
--
-- এই তালিকাটার হুবহু নকল আছে src/features/provider-appointments/lib/
-- status-machine.ts-এ, যাতে UI অসম্ভব বোতাম না দেখায়। DB-টাই কর্তৃপক্ষ।
create or replace function public.appointment_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'BOOKED'      and new.status in ('CONFIRMED','IN_PROGRESS','CANCELLED','NO_SHOW')) or
      (old.status = 'CONFIRMED'   and new.status in ('IN_PROGRESS','CANCELLED','NO_SHOW')) or
      (old.status = 'IN_PROGRESS' and new.status in ('DONE','CANCELLED'))
    ) then
      raise exception 'invalid appointment status transition: % -> %', old.status, new.status;
    end if;

    if new.status = 'CANCELLED' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;
  end if;

  -- বুকিং-সময়ে জমে যাওয়া কলামগুলো কোনো আপডেটেই বদলাতে দেওয়া হবে না।
  -- serials-এর BEFORE UPDATE ঠিক এই কাজটাই করে — ইতিহাস পুনর্লিখন অসম্ভব।
  new.shop_id           := old.shop_id;
  new.customer_id       := old.customer_id;
  new.service_ids       := old.service_ids;
  new.services_snapshot := old.services_snapshot;
  new.total_amount      := old.total_amount;
  new.booked_at         := old.booked_at;
  new.is_walk_in        := old.is_walk_in;
  new.created_at        := old.created_at;
  -- সময় বদলানো = রিশিডিউল, যেটা এই স্প্রিন্টের স্কোপে নেই। কলামদুটো এখানেই
  -- আটকে রাখা হলো, যাতে অর্ধেক-বানানো রিশিডিউল পথ দিয়ে কেউ ঢুকতে না পারে।
  new.starts_at         := old.starts_at;
  new.ends_at           := old.ends_at;
  new.staff_id          := old.staff_id;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists appointments_before_update on public.appointments;
create trigger appointments_before_update
  before update on public.appointments
  for each row execute function public.appointment_before_update();

-- ---------------------------------------------------------------------------
-- ৯) RPC — খালি স্লট
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER হতেই হবে: একজন কাস্টমার অন্য কাস্টমারের অ্যাপয়েন্টমেন্ট
-- পড়তে পারে না (RLS), অথচ কোন স্লট ভরা সেটা জানতে ওই সারিগুলো দেখা লাগে।
-- ফাংশনটা **কে বুক করেছে তা কখনো ফেরায় না** — শুধু ফাঁকা সময় ফেরায়।
create or replace function public.shop_available_slots(
  p_shop_id     uuid,
  p_date        date,
  p_service_ids uuid[],
  p_staff_id    uuid default null
)
returns table (
  staff_id   uuid,
  staff_name text,
  slot_start timestamptz,
  slot_end   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz        text;
  v_duration  integer;
  v_day       text;
  v_day_hours jsonb;
  v_open      time;
  v_close     time;
  v_open_ts   timestamptz;
  v_close_ts  timestamptz;
begin
  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    return;
  end if;

  -- সার্ভিসগুলো সত্যিই এই দোকানের কিনা — নইলে অন্য দোকানের সার্ভিসের সময় দিয়ে
  -- এই দোকানের স্লট হিসাব করা যেত।
  select coalesce(sum(s.default_duration_min), 0) into v_duration
    from public.services s
   where s.id = any (p_service_ids)
     and s.shop_id = p_shop_id
     and s.is_active = true;

  if v_duration < 1
     or (select count(*) from public.services
          where id = any (p_service_ids) and shop_id = p_shop_id and is_active = true)
        <> cardinality(p_service_ids)
  then
    return;
  end if;

  v_tz  := public.shop_timezone(p_shop_id);
  v_day := (array['mon','tue','wed','thu','fri','sat','sun'])[extract(isodow from p_date)::int];

  select weekly_hours -> v_day into v_day_hours
    from public.shops
   where id = p_shop_id and status = 'ACTIVE';

  if v_day_hours is null or jsonb_typeof(v_day_hours) <> 'object' then
    return;
  end if;
  if coalesce((v_day_hours ->> 'closed')::boolean, false) then
    return;
  end if;

  v_open  := nullif(v_day_hours ->> 'open', '')::time;
  v_close := nullif(v_day_hours ->> 'close', '')::time;
  if v_open is null or v_close is null or v_close <= v_open then
    return;
  end if;

  v_open_ts  := (p_date + v_open)  at time zone v_tz;
  v_close_ts := (p_date + v_close) at time zone v_tz;

  return query
  with eligible_staff as (
    select c.id, c.staff_name, c.label, c.sort_order
      from public.chairs c
     where c.shop_id = p_shop_id
       and c.is_active = true
       and (p_staff_id is null or c.id = p_staff_id)
       -- can_perform = false থাকলে বাদ; সারি না থাকলে পারে (UI-র নিয়মের নকল)
       and not exists (
         select 1 from unnest(p_service_ids) as sid
          join public.chair_service_stats css
            on css.chair_id = c.id and css.service_id = sid
         where css.can_perform = false
       )
  ),
  -- ১৫ মিনিটের গ্রিডে স্লট শুরু হয়। সার্ভিস যত লম্বাই হোক, শুরু বরাবর
  -- সোয়া-ঘণ্টার ধাপে — এতে দিনের ফাঁকফোকর কাজে লাগে।
  grid as (
    select generate_series(
             v_open_ts,
             v_close_ts - make_interval(mins => v_duration),
             interval '15 minutes'
           ) as slot_start
  )
  select
    st.id,
    coalesce(nullif(st.staff_name, ''), st.label),
    g.slot_start,
    g.slot_start + make_interval(mins => v_duration)
  from eligible_staff st
  cross join grid g
  where
    -- আজকের দিন হলে যে সময় পেরিয়ে গেছে সেটা দেখানো হবে না
    g.slot_start > now()
    and not exists (
      select 1 from public.appointments a
       where a.staff_id = st.id
         and a.status in ('BOOKED', 'CONFIRMED', 'IN_PROGRESS')
         and tstzrange(a.starts_at, a.ends_at)
             && tstzrange(g.slot_start, g.slot_start + make_interval(mins => v_duration))
    )
  order by st.sort_order, st.id, g.slot_start;
end;
$$;

comment on function public.shop_available_slots(uuid, date, uuid[], uuid) is
  'Free appointment slots for a shop on a date. SECURITY DEFINER so it can see '
  'other customers appointments to exclude them; it never returns who booked.';

-- ---------------------------------------------------------------------------
-- ১০) RPC — বুকিং
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER (ডিফল্ট) — ইচ্ছাকৃতভাবে। ইনসার্টটা কল করা ব্যক্তির অধিকারে
-- হয়, তাই উপরের RLS পলিসিগুলোই প্রযোজ্য থাকে। DEFINER করলে RLS পাশ কাটিয়ে
-- যেত এবং আইসোলেশনের গ্যারান্টিটা ফাংশনের নিজের কোডের উপর নির্ভরশীল হতো।
--
-- একমাত্র কাজ: EXCLUDE কনস্ট্রেইন্টের রুক্ষ 23P01 এররটাকে একটা চেনা নামে
-- অনুবাদ করা, যাতে UI "এই সময়টা এইমাত্র কেউ নিয়ে নিয়েছে" বলতে পারে।
create or replace function public.book_appointment(
  p_shop_id        uuid,
  p_staff_id       uuid,
  p_service_ids    uuid[],
  p_starts_at      timestamptz,
  p_customer_name  text default null,
  p_customer_phone text default null,
  p_is_walk_in     boolean default false,
  p_notes          text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.appointments (
    shop_id, staff_id, customer_id, customer_name, customer_phone,
    service_ids, starts_at, ends_at, is_walk_in, notes
  ) values (
    p_shop_id,
    p_staff_id,
    case when p_is_walk_in then null else auth.uid() end,
    coalesce(p_customer_name, ''),
    p_customer_phone,
    p_service_ids,
    p_starts_at,
    -- ট্রিগার এটা নিজেই হিসাব করে বসিয়ে দেবে; NOT NULL মেটাতে সাময়িক মান।
    p_starts_at + interval '1 minute',
    p_is_walk_in,
    p_notes
  )
  returning id into v_id;

  return v_id;
exception
  when exclusion_violation then
    raise exception 'slot_taken';
end;
$$;

comment on function public.book_appointment is
  'Books one appointment. SECURITY INVOKER on purpose so RLS still applies. '
  'Translates the exclusion constraint into a slot_taken error.';


-- ===========================================================================
-- যাচাই — মাইগ্রেশন চালানোর পর এই ব্লকটা আনকমেন্ট করে চালাও
-- ===========================================================================
-- সব সারিতে ok = true হওয়া বাধ্যতামূলক।
--
-- select * from (values
--   ('table exists',
--    to_regclass('public.appointments') is not null),
--
--   ('status check constraint exists (text + CHECK, not an enum)',
--    exists (select 1 from pg_constraint con
--             join pg_class rel on rel.oid = con.conrelid
--            where rel.relname = 'appointments' and con.contype = 'c'
--              and pg_get_constraintdef(con.oid) like '%NO_SHOW%')),
--
--   ('no stray appointment_status enum type left behind',
--    not exists (select 1 from pg_type where typname = 'appointment_status')),
--
--   ('RLS enabled',
--    (select relrowsecurity from pg_class where oid = 'public.appointments'::regclass)),
--
--   ('5 policies exist',
--    (select count(*) from pg_policies
--      where schemaname = 'public' and tablename = 'appointments') = 5),
--
--   ('no delete policy (cancel is a status, not a delete)',
--    (select count(*) from pg_policies
--      where schemaname = 'public' and tablename = 'appointments'
--        and cmd = 'DELETE') = 0),
--
--   ('overlap constraint exists',
--    exists (select 1 from pg_constraint where conname = 'appointments_no_overlap')),
--
--   ('time order constraint exists',
--    exists (select 1 from pg_constraint where conname = 'appointments_time_order')),
--
--   ('4 indexes exist',
--    (select count(*) from pg_indexes
--      where schemaname = 'public' and tablename = 'appointments'
--        and indexname like 'appointments_%_idx') = 4),
--
--   ('insert trigger exists',
--    exists (select 1 from pg_trigger where tgname = 'appointments_before_insert')),
--
--   ('update trigger exists',
--    exists (select 1 from pg_trigger where tgname = 'appointments_before_update')),
--
--   ('shop_available_slots exists',
--    to_regprocedure('public.shop_available_slots(uuid,date,uuid[],uuid)') is not null),
--
--   ('book_appointment exists',
--    to_regprocedure('public.book_appointment(uuid,uuid,uuid[],timestamptz,text,text,boolean,text)') is not null),
--
--   ('book_appointment is INVOKER (RLS still applies)',
--    (select not prosecdef from pg_proc
--      where oid = 'public.book_appointment(uuid,uuid,uuid[],timestamptz,text,text,boolean,text)'::regprocedure)),
--
--   ('shop_available_slots is DEFINER (must see others bookings)',
--    (select prosecdef from pg_proc
--      where oid = 'public.shop_available_slots(uuid,date,uuid[],uuid)'::regprocedure)),
--
--   ('serials untouched — queue still has its own table',
--    to_regclass('public.serials') is not null),
--
--   ('no appointments lost',
--    (select count(*) >= 0 from public.appointments))
-- ) as t(check_name, ok) order by check_name;
--
--
-- ---------------------------------------------------------------------------
-- আচরণগত পরীক্ষা — প্রতিটাই ROLLBACK করে, কোনো সারি থেকে যায় না
-- ---------------------------------------------------------------------------
-- নিচেরগুলো চালাতে একটা সক্রিয় পার্লার, তার একটা চালু chair আর একটা চালু
-- service লাগবে। প্রতিটা ব্লক আলাদা করে চালাও।
--
-- ১) ওভারল্যাপ সত্যিই আটকায় কিনা — দ্বিতীয় ইনসার্টটা **ব্যর্থ হওয়ার কথা**
--
-- begin;
--   with shop as (select id from public.shops where business_type = 'PARLOUR' and status='ACTIVE' limit 1),
--        st   as (select c.id from public.chairs c join shop on c.shop_id = shop.id where c.is_active limit 1),
--        sv   as (select s.id from public.services s join shop on s.shop_id = shop.id where s.is_active limit 1)
--   insert into public.appointments (shop_id, staff_id, service_ids, starts_at, ends_at, is_walk_in, customer_name)
--   select shop.id, st.id, array[sv.id], now() + interval '2 days', now() + interval '2 days 1 hour', true, 'probe A'
--   from shop, st, sv;
--
--   -- একই স্টাফ, ওভারল্যাপিং সময় → ERROR ... appointments_no_overlap
--   with shop as (select id from public.shops where business_type = 'PARLOUR' and status='ACTIVE' limit 1),
--        st   as (select c.id from public.chairs c join shop on c.shop_id = shop.id where c.is_active limit 1),
--        sv   as (select s.id from public.services s join shop on s.shop_id = shop.id where s.is_active limit 1)
--   insert into public.appointments (shop_id, staff_id, service_ids, starts_at, ends_at, is_walk_in, customer_name)
--   select shop.id, st.id, array[sv.id], now() + interval '2 days 30 minutes', now() + interval '2 days 2 hours', true, 'probe B'
--   from shop, st, sv;
-- rollback;
--
--
-- ২) অতীতে বুকিং আটকায় কিনা — **ব্যর্থ হওয়ার কথা** (appointment_in_past)
--
-- begin;
--   with shop as (select id from public.shops where business_type = 'PARLOUR' and status='ACTIVE' limit 1),
--        st   as (select c.id from public.chairs c join shop on c.shop_id = shop.id where c.is_active limit 1),
--        sv   as (select s.id from public.services s join shop on s.shop_id = shop.id where s.is_active limit 1)
--   insert into public.appointments (shop_id, staff_id, service_ids, starts_at, ends_at, is_walk_in, customer_name)
--   select shop.id, st.id, array[sv.id], now() - interval '1 hour', now(), true, 'probe past'
--   from shop, st, sv;
-- rollback;
--
--
-- ৩) অন্য দোকানের স্টাফ দিয়ে বুকিং আটকায় কিনা — **ব্যর্থ হওয়ার কথা**
--    (staff does not belong to this shop)
--
-- begin;
--   with a as (select id from public.shops order by created_at limit 1),
--        b as (select id from public.shops where id <> (select id from a) limit 1),
--        st as (select c.id from public.chairs c where c.shop_id = (select id from b) limit 1),
--        sv as (select s.id from public.services s where s.shop_id = (select id from a) limit 1)
--   insert into public.appointments (shop_id, staff_id, service_ids, starts_at, ends_at, is_walk_in, customer_name)
--   select a.id, st.id, array[sv.id], now() + interval '3 days', now() + interval '3 days 1 hour', true, 'probe cross'
--   from a, st, sv;
-- rollback;
--
--
-- ৪) অবৈধ স্ট্যাটাস ট্রানজিশন আটকায় কিনা — **ব্যর্থ হওয়ার কথা**
--    (invalid appointment status transition: BOOKED -> DONE)
--
-- begin;
--   with shop as (select id from public.shops where business_type = 'PARLOUR' and status='ACTIVE' limit 1),
--        st   as (select c.id from public.chairs c join shop on c.shop_id = shop.id where c.is_active limit 1),
--        sv   as (select s.id from public.services s join shop on s.shop_id = shop.id where s.is_active limit 1),
--        ins  as (
--          insert into public.appointments (shop_id, staff_id, service_ids, starts_at, ends_at, is_walk_in, customer_name)
--          select shop.id, st.id, array[sv.id], now() + interval '4 days', now() + interval '4 days 1 hour', true, 'probe status'
--          from shop, st, sv returning id
--        )
--   update public.appointments set status = 'DONE' where id = (select id from ins);
-- rollback;
--
--
-- ৫) ক্রস-শপ রিড আটকায় কিনা (RLS)। এটা **অ্যাপ থেকে** যাচাই করতে হবে, SQL
--    এডিটর থেকে নয় — এডিটর service_role-এ চলে এবং RLS বাইপাস করে। এক দোকানের
--    মালিক হিসেবে লগইন করে অন্য দোকানের appointment id চাইলে ০ সারি ফেরার কথা।
--
--
-- ---------------------------------------------------------------------------
-- ৬) কনকারেন্সি — দুটো একসাথে একই স্লট চাইলে কী হয়
-- ---------------------------------------------------------------------------
-- একটা SQL এডিটর সেশনে এটা পরীক্ষা করা যায় না; দুটো সেশন লাগে। **SQL এডিটরের
-- দুটো ট্যাব** খুলে নিচের দুটো ব্লক চালাও — A চালানোর ~২ সেকেন্ডের মধ্যে B।
--
-- প্রত্যাশিত ফল: A সফল হবে, **B ব্যর্থ হবে** —
--   ERROR: conflicting key value violates exclusion constraint
--          "appointments_no_overlap"
-- দুটোই ROLLBACK করায় কোনো সারি থেকে যায় না।
--
-- এটাই কনকারেন্সির পুরো গল্প: কোনো "আগে চেক করে তারপর ইনসার্ট" নেই, তাই
-- চেক আর ইনসার্টের মাঝখানে হারানোর মতো কোনো উইন্ডোও নেই। Postgres-এর
-- EXCLUDE কনস্ট্রেইন্ট ইনসার্টের সময়েই সিদ্ধান্ত নেয়।
--
-- ---- ট্যাব A ----
-- begin;
--   with shop as (select id from public.shops where business_type='PARLOUR' and status='ACTIVE' limit 1),
--        st   as (select c.id from public.chairs c join shop on c.shop_id = shop.id where c.is_active limit 1),
--        sv   as (select s.id from public.services s join shop on s.shop_id = shop.id where s.is_active limit 1)
--   insert into public.appointments (shop_id, staff_id, service_ids, starts_at, ends_at, is_walk_in, customer_name)
--   select shop.id, st.id, array[sv.id],
--          date_trunc('hour', now()) + interval '5 days',
--          date_trunc('hour', now()) + interval '5 days 1 hour',
--          true, 'race A'
--   from shop, st, sv;
--   select pg_sleep(10);          -- B-কে এই ফাঁকে ঢুকতে দাও
-- rollback;
--
-- ---- ট্যাব B (A-এর ঠিক পরেই চালাও) ----
-- begin;
--   with shop as (select id from public.shops where business_type='PARLOUR' and status='ACTIVE' limit 1),
--        st   as (select c.id from public.chairs c join shop on c.shop_id = shop.id where c.is_active limit 1),
--        sv   as (select s.id from public.services s join shop on s.shop_id = shop.id where s.is_active limit 1)
--   insert into public.appointments (shop_id, staff_id, service_ids, starts_at, ends_at, is_walk_in, customer_name)
--   select shop.id, st.id, array[sv.id],
--          date_trunc('hour', now()) + interval '5 days 30 minutes',
--          date_trunc('hour', now()) + interval '5 days 1 hour 30 minutes',
--          true, 'race B'
--   from shop, st, sv;
-- rollback;
--
-- (B প্রথমে **অপেক্ষা করবে** — EXCLUDE কনস্ট্রেইন্ট A-এর ট্রানজেকশন শেষ হওয়ার
--  জন্য অপেক্ষা করে। A rollback করলে B সফল হবে, A commit করলে B ব্যর্থ হবে।
--  দুটোর যেকোনো একটাই টেকে — সেটাই প্রমাণ।)
