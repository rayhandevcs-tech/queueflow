-- ফেজ ৬ / Sprint 6 — মেম্বারশিপ
--
-- ===========================================================================
-- চালানোর ক্রম
-- ===========================================================================
--   1. 20260916_parlour_foundation.sql       ✅
--   2. 20260917_service_categories.sql       ✅
--   3. 20260918_appointment_core.sql         ✅
--   4. 20260919_appointment_availability.sql ✅
--   5. 20260920_appointment_money.sql        ✅
--   6. 20260921_membership.sql               ← এই ফাইল
--
-- ===========================================================================
-- এই ফাইল কী করে, আর কী করে না
-- ===========================================================================
-- করে: দুটো নতুন টেবিল (`membership_tiers`, `customer_memberships`), তাদের RLS,
--      দুটো ট্রিগার, তিনটে ফাংশন, একটা পার্শিয়াল ইউনিক ইনডেক্স।
--
-- করে না: কোনো বিদ্যমান টেবিলে ALTER নেই। serials / appointments / services /
--         chairs / shops / manual_entries / shop_expenses — একটাও ছোঁয়া হয়নি।
--         **সেলুনের কিউ, পার্লারের অ্যাপয়েন্টমেন্ট আর টাকার হিসাব — তিনটেই
--         এই ফাইলের বাইরে।** মেম্বারশিপ ওদের পাশে দাঁড়ায়, ওদের ভেতরে ঢোকে না।
--
-- একটাই মডেল, দুই ব্যবসার জন্য। `SalonMembership`/`ParlourMembership` নেই —
-- মেম্বারশিপ **ব্যবসা-স্কোপড**, বুকিং-মডেল-স্কোপড নয়। সেলুন কিউ চালায়, পার্লার
-- অ্যাপয়েন্টমেন্ট; কিন্তু "এই দোকানের সদস্য" কথাটার মানে দুই জায়গায় একই।
--
-- সিদ্ধান্ত ৪৯–৫৩ — বিস্তারিত docs/IMPLEMENTATION_PLAN.md-এ।
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- ১) বেনিফিটের আকৃতি যাচাই
-- ---------------------------------------------------------------------------
-- বেনিফিট jsonb, কিন্তু "যা খুশি jsonb" নয়। এই স্প্রিন্টে **শুধু definition** —
-- redemption ইঞ্জিন Sprint 7+-এর কাজ (স্কোপে স্পষ্ট নিষেধ)। তাই আকৃতিটা
-- এখনই আটকে দেওয়া হলো, যাতে পরে redemption লেখার সময় পুরনো সারিগুলো
-- অনুমান না হয়ে ডেটা থাকে।
--
-- IMMUTABLE হতেই হবে — CHECK কনস্ট্রেইন্টে ব্যবহার হচ্ছে।
create or replace function public.membership_benefits_valid(p_benefits jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(p_benefits) = 'array'
    and jsonb_array_length(p_benefits) <= 12
    and not exists (
      select 1
        from jsonb_array_elements(p_benefits) as b
       where jsonb_typeof(b.value) <> 'object'
          or b.value->>'kind' is null
          or b.value->>'kind' not in (
               'DISCOUNT', 'FREE_SERVICE', 'PRIORITY_BOOKING',
               'COMPLIMENTARY', 'SPECIAL_OFFER'
             )
          or coalesce(length(trim(b.value->>'label')), 0) = 0
          or length(b.value->>'label') > 80
          -- value থাকলে সংখ্যা হতে হবে; DISCOUNT-এ শতকরা, বাকিতে ঐচ্ছিক গণনা
          or (b.value ? 'value'
              and jsonb_typeof(b.value->'value') not in ('number', 'null'))
    );
$$;

comment on function public.membership_benefits_valid(jsonb) is
  'Shape guard for membership_tiers.benefits: an array of at most 12 '
  '{kind, label, value?} objects with a known kind and a non-empty label.';


-- ---------------------------------------------------------------------------
-- ২) membership_tiers — দোকানের নিজের প্রোগ্রাম
-- ---------------------------------------------------------------------------
-- Silver/Gold/Platinum/Diamond এখানে **হার্ডকোড করা হয়নি**, আর কোনো দোকানের
-- জন্য সিডও করা হয়নি — সিদ্ধান্ত ৩৬: দোকান নিজে টিয়ার না বানালে কোথাও
-- মেম্বারশিপের কোনো UI নেই। চারটে ডিফল্ট টিয়ার অ্যাপে এক ট্যাপের প্রিসেট
-- হিসেবে আছে (`TIER_PRESETS`), তাই মালিক চাইলেই পায়, না চাইলে তার দোকানে
-- মেম্বারশিপ অস্তিত্বহীন থাকে।
create table if not exists public.membership_tiers (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  name          text not null check (length(trim(name)) between 2 and 40),
  description   text check (description is null or length(description) <= 300),
  price         numeric(10, 2) not null check (price >= 0 and price <= 1000000),
  -- দিনে, মাসে নয়: "৩০ দিন" আর "১ মাস" দুটো আলাদা জিনিস, আর মাস ধরলে
  -- ফেব্রুয়ারিতে কত দিন সে প্রশ্নটা প্রতিবার হিসাব করতে হতো।
  duration_days integer not null check (duration_days between 1 and 3650),
  benefits      jsonb not null default '[]'::jsonb
                  check (public.membership_benefits_valid(benefits)),
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- এক দোকানে একই নামের দুটো টিয়ার থাকলে সদস্য কোনটা কিনল সেটা মালিক নিজেই
-- বলতে পারবে না। কেস-ইনসেনসিটিভ, কারণ "Gold" আর "gold" একই টিয়ার।
create unique index if not exists membership_tiers_shop_name_idx
  on public.membership_tiers (shop_id, lower(trim(name)));

-- কাস্টমারের শপ-পাতা সক্রিয় টিয়ারগুলো ক্রম অনুযায়ী পড়ে।
create index if not exists membership_tiers_shop_order_idx
  on public.membership_tiers (shop_id, sort_order, created_at);

alter table public.membership_tiers enable row level security;

-- মালিকের সব অধিকার, is_shop_owner() দিয়ে — প্রজেক্টের প্রতিটা শপ-স্কোপড
-- পলিসি এই হেল্পারের উপরেই দাঁড়ানো (20260817-এর কমেন্ট দেখো)।
drop policy if exists "membership_tiers: owner manage" on public.membership_tiers;
create policy "membership_tiers: owner manage" on public.membership_tiers
  for all
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

-- কাস্টমার সক্রিয় দোকানের সক্রিয় টিয়ার দেখে। offers-এর মতো `is_open` নয়:
-- রাতে বন্ধ দোকানও মেম্বারশিপ বেচে, তাই "এখন খোলা" এখানে ভুল প্রশ্ন।
drop policy if exists "membership_tiers: browse active" on public.membership_tiers;
create policy "membership_tiers: browse active" on public.membership_tiers
  for select
  using (
    is_active = true
    and exists (
      select 1 from public.shops sh
       where sh.id = shop_id and sh.status = 'ACTIVE'
    )
  );

create or replace function public.membership_tier_touch()
returns trigger
language plpgsql
as $$
begin
  -- shop_id বদলানো = টিয়ারটা অন্য দোকানে সরিয়ে দেওয়া, যা তার সদস্যদের
  -- ইতিহাসকে মিথ্যে বানাত।
  if tg_op = 'UPDATE' then
    new.shop_id    := old.shop_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists membership_tiers_touch on public.membership_tiers;
create trigger membership_tiers_touch
  before update on public.membership_tiers
  for each row execute function public.membership_tier_touch();


-- ---------------------------------------------------------------------------
-- ৩) customer_memberships — কে কোন দোকানের সদস্য
-- ---------------------------------------------------------------------------
-- স্ট্যাটাস `text` + CHECK, Postgres enum নয় — সিদ্ধান্ত ৪৫: **এই স্কিমায়
-- একটাও enum নেই**, সব text + CHECK। (Sprint 4-এ enum ধরে নিয়ে একবার
-- মাইগ্রেশন ভেঙেছিল।)
--
-- PENDING কেন আছে: এই অ্যাপে **কোনো আসল পেমেন্ট গেটওয়ে নেই** —
-- `src/lib/payment/mock-gateway.ts` সিমুলেশন, এক টাকাও সরে না। তাই কাস্টমার
-- নিজে "সদস্য হয়ে গেলাম" বলতে পারলে সেটা না-দেওয়া টাকার সদস্যপদ হতো।
-- কাস্টমার **অনুরোধ** করে (PENDING), মালিক টাকা নিয়ে চালু করে (ACTIVE)।
-- মালিক নিজে কাউন্টারে বসে সরাসরি ACTIVE-ও করতে পারে।
create table if not exists public.customer_memberships (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  -- restrict: যে টিয়ারে সদস্য আছে সেটা মুছে ফেলা যাবে না। মালিকের UI
  -- নিষ্ক্রিয় করার পথই দেখায়; সদস্যহীন টিয়ার মোছা যায়।
  tier_id     uuid not null references public.membership_tiers(id) on delete restrict,

  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED')),

  -- ---- কাস্টমারের পরিচয়ের স্ন্যাপশট ----
  -- `profiles`-এ ক্রস-ইউজার SELECT পলিসি নেই — নিজের সারি ছাড়া কেউ কারো
  -- প্রোফাইল পড়তে পারে না। তাই মালিকের সদস্য-তালিকা profiles-এ join করতে
  -- পারবে না; serials আর appointments ঠিক এই কারণেই নাম/ফোন/ছবি নিজের
  -- সারিতে রাখে (20260918-এর ৩৩৭ লাইন)। একই কনভেনশন, একই কারণ।
  customer_name       text not null default '',
  customer_phone      text,
  customer_avatar_url text,

  -- ---- ঐতিহাসিক স্ন্যাপশট (ব্রিফের ৫ নম্বর শর্ত) ----
  -- টিয়ারের নাম/দাম/মেয়াদ/বেনিফিট পরে বদলালেও এই সারি অপরিবর্তিত থাকে।
  -- serials.services_snapshot + total_amount-এর হুবহু একই কনভেনশন: jsonb-তে
  -- পুরোটা, আর যেগুলো নিয়ে কোয়েরি হয় সেগুলো আলাদা কলামেও।
  tier_snapshot jsonb not null default '{}'::jsonb,
  price         numeric(10, 2) not null default 0,
  duration_days integer not null default 30,

  -- ---- টাকা ----
  -- serials/appointments-এর একই শব্দভাণ্ডার (সিদ্ধান্ত ২৯), যাতে পরে কোনো
  -- রিপোর্ট এদের একসাথে পড়তে চাইলে দ্বিতীয় ভাষা শিখতে না হয়।
  payment_status text not null default 'DUE'
    check (payment_status in ('PAID', 'DUE')),
  payment_method text
    check (payment_method is null or payment_method in ('cash','bkash','nagad','rocket','card')),
  paid_at timestamptz,

  -- ---- মেয়াদ ----
  -- চালু হওয়ার আগে দুটোই null: PENDING সদস্যপদের কোনো মেয়াদ শুরু হয়নি।
  started_at timestamptz,
  expires_at timestamptz,

  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancel_reason text check (cancel_reason is null or length(cancel_reason) <= 200),

  note       text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- চালু সদস্যপদের মেয়াদ থাকতেই হবে; বাতিল/মেয়াদোত্তীর্ণে দরকার নেই।
  constraint customer_memberships_active_dates check (
    status <> 'ACTIVE' or (started_at is not null and expires_at is not null)
  ),
  constraint customer_memberships_window check (
    expires_at is null or started_at is null or expires_at > started_at
  )
);

-- ---------------------------------------------------------------------------
-- এক সময়ে একটাই জীবিত সদস্যপদ — **ডেটাবেসেই**
-- ---------------------------------------------------------------------------
-- সিদ্ধান্ত ৫০। পার্শিয়াল ইউনিক ইনডেক্স, প্রি-চেক নয় — সিদ্ধান্ত ৪৩-এর একই
-- যুক্তি: দুটো সমান্তরাল রিকোয়েস্টের মধ্যে কোনটা টিকবে তা কনস্ট্রেইন্ট ঠিক
-- করবে, অ্যাপ নয়।
--
-- প্রেডিকেটে `expires_at > now()` লেখা **যায় না** — ইনডেক্স প্রেডিকেট
-- IMMUTABLE হতে হয়, `now()` কেবল STABLE। তার মানে মধ্যরাতে মেয়াদ শেষ হওয়া
-- একটা ACTIVE সারি cron চলা পর্যন্ত নতুন সদস্যপদ আটকে রাখত। সমাধান নিচের
-- BEFORE INSERT ট্রিগারে: ইনসার্টের ঠিক আগে ওই কাস্টমারের মেয়াদোত্তীর্ণ
-- সারিগুলো EXPIRED করে দেওয়া হয় (অলস মেয়াদোত্তরণ), তারপর ইনডেক্সই আসল
-- সিদ্ধান্ত নেয়। ফলে নবায়ন আটকায় না, অথচ গ্যারান্টিটা রেসপ্রুফ থাকে।
create unique index if not exists customer_memberships_one_live_idx
  on public.customer_memberships (shop_id, customer_id)
  where status in ('PENDING', 'ACTIVE');

-- মালিকের সদস্য-তালিকা: দোকানের সবাই, নতুন আগে।
create index if not exists customer_memberships_shop_idx
  on public.customer_memberships (shop_id, created_at desc);

-- কাস্টমারের নিজের সদস্যপদগুলো (প্রোফাইল পাতা)।
create index if not exists customer_memberships_customer_idx
  on public.customer_memberships (customer_id, created_at desc);

-- নাইটলি মেয়াদোত্তরণ শুধু চালু ও মেয়াদ-পেরোনো সারি খোঁজে।
create index if not exists customer_memberships_expiry_idx
  on public.customer_memberships (expires_at)
  where status = 'ACTIVE';

alter table public.customer_memberships enable row level security;

-- ---------------------------------------------------------------------------
-- ৪) RLS — টেন্যান্ট আইসোলেশন ডেটাবেসেই
-- ---------------------------------------------------------------------------
-- appointments-এর পাঁচটা পলিসির হুবহু আকৃতি। ফ্রন্টএন্ডের `shop_id` ফিল্টার
-- এখানে কেবল ইনডেক্সের জন্য — একটাও পলিসি ওটার উপর নির্ভর করে না।
drop policy if exists "memberships: customer or owner read" on public.customer_memberships;
create policy "memberships: customer or owner read" on public.customer_memberships
  for select
  using (customer_id = auth.uid() or public.is_shop_owner(shop_id));

-- কাস্টমারের একমাত্র ইনসার্ট: নিজের নামে, PENDING হিসেবে। দাম বা স্ন্যাপশট
-- সে পাঠাতে পারে না — নিচের ট্রিগার ওগুলো টিয়ার থেকে নিজে বসায়।
drop policy if exists "memberships: customer request" on public.customer_memberships;
create policy "memberships: customer request" on public.customer_memberships
  for insert
  with check (customer_id = auth.uid() and status = 'PENDING');

-- মালিক কাউন্টারে বসে সরাসরি সদস্য করতে পারে (PENDING বা ACTIVE, দুটোই)।
drop policy if exists "memberships: owner enroll" on public.customer_memberships;
create policy "memberships: owner enroll" on public.customer_memberships
  for insert
  with check (public.is_shop_owner(shop_id));

-- কাস্টমারের একমাত্র লেখার পথ: নিজের সদস্যপদ বাতিল করা। স্ট্যাটাস মেশিন
-- ট্রিগারে, তাই এই দরজা দিয়ে ACTIVE বসিয়ে দেওয়ার পথও নেই।
drop policy if exists "memberships: customer cancel own" on public.customer_memberships;
create policy "memberships: customer cancel own" on public.customer_memberships
  for update
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid() and status = 'CANCELLED');

drop policy if exists "memberships: owner manage" on public.customer_memberships;
create policy "memberships: owner manage" on public.customer_memberships
  for update
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

-- DELETE-এর কোনো পলিসি নেই, কোনো পক্ষের জন্যই — সদস্যপদ ইতিহাস। ভুল হলে
-- CANCELLED, মুছে ফেলা নয়। (loyalty_accounts-এ UPDATE পলিসি না রাখার একই
-- যুক্তি, সিদ্ধান্ত ৩২।)


-- ---------------------------------------------------------------------------
-- ৫) BEFORE INSERT — সার্ভারই কর্তৃপক্ষ
-- ---------------------------------------------------------------------------
-- ক্লায়েন্ট পাঠায় শুধু: shop_id, customer_id, tier_id (+ ঐচ্ছিক note,
-- এবং মালিক হলে status/payment)। দাম, মেয়াদ, স্ন্যাপশট — সব এখানে হিসাব হয়।
-- অর্থাৎ কাস্টমার ৫০০০ টাকার টিয়ার ০ টাকায় দাবি করতে পারবে না।
create or replace function public.membership_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.membership_tiers%rowtype;
begin
  select * into t from public.membership_tiers where id = new.tier_id;
  if t.id is null then
    raise exception 'membership_tier_not_found';
  end if;

  -- ক্রস-শপ ঠেকানো: X দোকানের টিয়ার দিয়ে Y দোকানের সদস্যপদ বানানো যাবে না।
  -- RLS একা এটা ধরত না — মালিক নিজের দোকানে ইনসার্ট করছে, শুধু টিয়ারটা
  -- অন্যের।
  if t.shop_id <> new.shop_id then
    raise exception 'membership_tier_wrong_shop';
  end if;

  if not t.is_active then
    raise exception 'membership_tier_inactive';
  end if;

  -- অলস মেয়াদোত্তরণ (উপরের ইনডেক্স-কমেন্ট দেখো): মেয়াদ পেরিয়ে যাওয়া সারি
  -- যেন নবায়ন আটকে না রাখে। cron না চললেও নবায়ন কাজ করবে।
  update public.customer_memberships
     set status = 'EXPIRED'
   where shop_id = new.shop_id
     and customer_id = new.customer_id
     and status = 'ACTIVE'
     and expires_at <= now();

  -- ---- স্ন্যাপশট: এই সারির নিজের সত্য, টিয়ারের নয় ----
  new.tier_snapshot := jsonb_build_object(
    'tier_id',       t.id,
    'name',          t.name,
    'description',   t.description,
    'price',         t.price,
    'duration_days', t.duration_days,
    'benefits',      t.benefits
  );
  new.price         := t.price;
  new.duration_days := t.duration_days;

  -- কাস্টমারের পরিচয় profiles থেকে, ক্লায়েন্টের পাঠানো নাম থেকে নয় —
  -- appointments-এর একই লাইন।
  select coalesce(full_name, ''), phone, avatar_url
    into new.customer_name, new.customer_phone, new.customer_avatar_url
    from public.profiles where id = new.customer_id;

  -- ক্লায়েন্ট এই কলামগুলো পাঠালেও গোনা হয় না।
  new.cancelled_at := null;
  new.cancelled_by := null;
  new.created_at   := now();
  new.updated_at   := now();

  if new.status not in ('PENDING', 'ACTIVE') then
    raise exception 'membership_must_start_pending_or_active';
  end if;

  if new.status = 'ACTIVE' then
    new.started_at := coalesce(new.started_at, now());
    new.expires_at := new.started_at + make_interval(days => new.duration_days);
  else
    -- PENDING-এর মেয়াদ শুরু হয়নি, তাই কোনো তারিখও নেই।
    new.started_at := null;
    new.expires_at := null;
  end if;

  -- ---- টাকার কথা বলার অধিকার শুধু মালিকের ----
  -- RLS কাস্টমারকে PENDING সারি বানাতে দেয়, কিন্তু ওই একই ইনসার্টে সে
  -- `payment_status='PAID'` পাঠিয়ে দিতে পারত — অর্থাৎ নিজেই নিজের টাকা
  -- দেওয়ার সাক্ষী। এই অ্যাপে কোনো আসল গেটওয়ে নেই, তাই "টাকা এসেছে"
  -- কথাটা একমাত্র মালিকই বলতে পারে।
  if not public.is_shop_owner(new.shop_id) then
    new.payment_status := 'DUE';
    new.payment_method := null;
    new.paid_at        := null;
  end if;

  if new.payment_status = 'PAID' then
    new.paid_at := coalesce(new.paid_at, now());
  else
    new.paid_at        := null;
    new.payment_method := null;
  end if;

  return new;
end;
$$;

drop trigger if exists customer_memberships_before_insert on public.customer_memberships;
create trigger customer_memberships_before_insert
  before insert on public.customer_memberships
  for each row execute function public.membership_before_insert();


-- ---------------------------------------------------------------------------
-- ৬) BEFORE UPDATE — লাইফসাইকেল ও ইতিহাসের অখণ্ডতা
-- ---------------------------------------------------------------------------
-- অনুমোদিত পথ:
--   PENDING → ACTIVE | CANCELLED
--   ACTIVE  → EXPIRED | CANCELLED
--   EXPIRED / CANCELLED → চূড়ান্ত, কোথাও যায় না
--
-- এই তালিকার হুবহু নকল আছে src/features/membership/lib/membership.ts-এ,
-- যাতে UI অসম্ভব বোতাম না দেখায়। DB-টাই কর্তৃপক্ষ।
create or replace function public.membership_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'PENDING' and new.status in ('ACTIVE', 'CANCELLED')) or
      (old.status = 'ACTIVE'  and new.status in ('EXPIRED', 'CANCELLED'))
    ) then
      raise exception 'invalid membership status transition: % -> %', old.status, new.status;
    end if;

    if new.status = 'ACTIVE' then
      new.started_at := coalesce(old.started_at, new.started_at, now());
      new.expires_at := new.started_at + make_interval(days => old.duration_days);
    end if;

    if new.status = 'CANCELLED' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;
  end if;

  -- ---- জমাট কলাম: কেনার সময়ের সত্য পুনর্লিখনযোগ্য নয় ----
  -- serials আর appointments-এর BEFORE UPDATE ঠিক এই কাজটাই করে।
  new.shop_id       := old.shop_id;
  new.customer_id   := old.customer_id;
  new.customer_name := old.customer_name;
  new.customer_phone := old.customer_phone;
  new.customer_avatar_url := old.customer_avatar_url;
  new.tier_id       := old.tier_id;
  new.tier_snapshot := old.tier_snapshot;
  new.price         := old.price;
  new.duration_days := old.duration_days;
  new.created_at    := old.created_at;

  -- একবার শুরু হলে মেয়াদের জানালা আর সরে না — নইলে সাধারণ UPDATE দিয়ে
  -- মেয়াদোত্তীর্ণ সদস্যপদ অনির্দিষ্টকাল বাড়িয়ে নেওয়া যেত। নবায়ন মানে
  -- নতুন সারি, পুরনোটা টেনে লম্বা করা নয়।
  if old.started_at is not null then
    new.started_at := old.started_at;
  end if;
  if old.expires_at is not null and new.status is not distinct from old.status then
    new.expires_at := old.expires_at;
  end if;

  -- ইনসার্টের একই যুক্তি আপডেটেও। কাস্টমারের একমাত্র আপডেট-পথ হলো নিজের
  -- সদস্যপদ বাতিল করা — কিন্তু সেই একই UPDATE-এ সে payment_status='PAID'
  -- জুড়ে দিতে পারত। টাকার কলামগুলো তার জন্য জমাট।
  if not public.is_shop_owner(new.shop_id) then
    new.payment_status := old.payment_status;
    new.payment_method := old.payment_method;
    new.paid_at        := old.paid_at;
  end if;

  if new.payment_status = 'PAID' then
    new.paid_at := coalesce(old.paid_at, new.paid_at, now());
  else
    -- বাকিতে ফিরিয়ে নিলে (মালিক ভুল করে PAID দিয়েছিল) সাক্ষ্যও মুছে যায়।
    new.paid_at        := null;
    new.payment_method := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customer_memberships_before_update on public.customer_memberships;
create trigger customer_memberships_before_update
  before update on public.customer_memberships
  for each row execute function public.membership_before_update();


-- ---------------------------------------------------------------------------
-- ৭) membership_is_active — একটাই দরজা
-- ---------------------------------------------------------------------------
-- "এই লোক কি এই মুহূর্তে এই দোকানের সদস্য?" — Sprint 7+ (লয়্যালটি, রেফারেল,
-- রিওয়ার্ড) এই একটাই ফাংশন ডাকবে, নিজের নিজের কোয়েরি লিখবে না। এখানে
-- **মেয়াদ নিজেও পরীক্ষা হয়**, তাই cron না চললেও মেয়াদোত্তীর্ণ সদস্যপদ
-- কখনো "চালু" গোনা হয় না (ব্রিফের ৫ নম্বর শর্ত)।
--
-- SECURITY DEFINER: কাস্টমারের সারি অন্য কেউ পড়তে পারে না (RLS), অথচ
-- ভবিষ্যতের ট্রিগারগুলোকে হ্যাঁ/না জানতে হবে। **সারি কখনো ফেরায় না** —
-- শুধু boolean।
create or replace function public.membership_is_active(
  p_shop_id     uuid,
  p_customer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.customer_memberships m
     where m.shop_id = p_shop_id
       and m.customer_id = p_customer_id
       and m.status = 'ACTIVE'
       and m.expires_at > now()
  );
$$;

comment on function public.membership_is_active(uuid, uuid) is
  'The one door for "is this person a member of this shop right now". '
  'Checks expires_at itself, so a lapsed row never reads as active even '
  'before the nightly job has flipped it. Returns a boolean, never rows.';


-- ---------------------------------------------------------------------------
-- ৮) expire_memberships — বিদ্যমান নাইটলি ক্রনে
-- ---------------------------------------------------------------------------
-- নতুন কোনো ক্রন সিস্টেম নয় (স্কোপে স্পষ্ট নিষেধ): `/api/cron/nightly`
-- ইতিমধ্যে তিনটে RPC চালায়, এটা চতুর্থ। Idempotent — দ্বিতীয় রান ০ ফেরায়।
--
-- এই ফাংশনটা **সৌন্দর্যের জন্য, শুদ্ধতার জন্য নয়**: `membership_is_active()`
-- আর প্রতিটা রিড-হেল্পার নিজেরাই মেয়াদ দেখে। এটা শুধু তালিকাটা সত্যি
-- দেখায়, যাতে মালিক "চালু" কলামে মেয়াদোত্তীর্ণ নাম না দেখে।
create or replace function public.expire_memberships()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.customer_memberships
       set status = 'EXPIRED'
     where status = 'ACTIVE'
       and expires_at <= now()
    returning 1
  )
  select count(*) into v_count from expired;

  return coalesce(v_count, 0);
end;
$$;

comment on function public.expire_memberships() is
  'Nightly tidy-up: flips lapsed ACTIVE memberships to EXPIRED. Correctness '
  'does not depend on it — every read path checks expires_at itself.';


-- ---------------------------------------------------------------------------
-- ৯) shop_membership_summary — মালিকের ওভারভিউ
-- ---------------------------------------------------------------------------
-- চারটে সংখ্যা এক রাউন্ডট্রিপে। advanced analytics নয় (স্কোপে নিষেধ) —
-- সদস্য-তালিকার মাথায় বসার মতো গোনাগুনি।
create or replace function public.shop_membership_summary(p_shop_id uuid)
returns table (
  active_count   integer,
  pending_count  integer,
  expiring_soon  integer,
  unpaid_count   integer
)
language sql
stable
security invoker
set search_path = public
as $$
  -- SECURITY INVOKER, তাই RLS-ই সিদ্ধান্ত নেয়: অন্য দোকানের মালিক ডাকলে
  -- সারিগুলোই দেখা যায় না, ফলে চারটে শূন্য ফেরে। আলাদা মালিক-চেকের দরকার নেই।
  select
    count(*) filter (where status = 'ACTIVE' and expires_at > now())::int,
    count(*) filter (where status = 'PENDING')::int,
    count(*) filter (
      where status = 'ACTIVE'
        and expires_at > now()
        and expires_at <= now() + interval '7 days'
    )::int,
    count(*) filter (
      where status in ('PENDING', 'ACTIVE') and payment_status = 'DUE'
    )::int
  from public.customer_memberships
 where shop_id = p_shop_id;
$$;


-- ===========================================================================
-- যাচাই — মাইগ্রেশনের পর আনকমেন্ট করে চালাও। সব ok = true হওয়া চাই।
-- ===========================================================================
--
-- select * from (values
--   ('membership_tiers table exists',      to_regclass('public.membership_tiers') is not null),
--   ('customer_memberships table exists',  to_regclass('public.customer_memberships') is not null),
--   ('tiers RLS on',
--    (select relrowsecurity from pg_class where oid = 'public.membership_tiers'::regclass)),
--   ('memberships RLS on',
--    (select relrowsecurity from pg_class where oid = 'public.customer_memberships'::regclass)),
--   ('2 tier policies',
--    (select count(*) from pg_policies where tablename='membership_tiers') = 2),
--   ('5 membership policies',
--    (select count(*) from pg_policies where tablename='customer_memberships') = 5),
--   ('no DELETE policy on memberships',
--    not exists (select 1 from pg_policies
--                 where tablename='customer_memberships' and cmd='DELETE')),
--   ('one-live partial unique index exists',
--    exists (select 1 from pg_indexes where indexname='customer_memberships_one_live_idx')),
--   ('duplicate tier names blocked',
--    exists (select 1 from pg_indexes where indexname='membership_tiers_shop_name_idx')),
--   ('insert trigger exists',
--    exists (select 1 from pg_trigger where tgname='customer_memberships_before_insert')),
--   ('update trigger exists',
--    exists (select 1 from pg_trigger where tgname='customer_memberships_before_update')),
--   ('membership_is_active exists',
--    to_regprocedure('public.membership_is_active(uuid,uuid)') is not null),
--   ('membership_is_active is DEFINER',
--    (select prosecdef from pg_proc where oid='public.membership_is_active(uuid,uuid)'::regprocedure)),
--   ('expire_memberships exists',
--    to_regprocedure('public.expire_memberships()') is not null),
--   ('shop_membership_summary exists',
--    to_regprocedure('public.shop_membership_summary(uuid)') is not null),
--   ('shop_membership_summary is INVOKER (RLS decides)',
--    not (select prosecdef from pg_proc where oid='public.shop_membership_summary(uuid)'::regprocedure)),
--   ('benefits guard is IMMUTABLE',
--    (select provolatile from pg_proc
--      where oid='public.membership_benefits_valid(jsonb)'::regprocedure) = 'i'),
--
--   -- কোনো দোকানে টিয়ার সিড করা হয়নি (সিদ্ধান্ত ৩৬)
--   ('no tiers were seeded', (select count(*) from public.membership_tiers) = 0),
--
--   -- আগের স্প্রিন্টগুলো অক্ষত
--   ('serials table untouched',        to_regclass('public.serials') is not null),
--   ('appointments table untouched',   to_regclass('public.appointments') is not null),
--   ('appointment overlap constraint still there',
--    exists (select 1 from pg_constraint where conname='appointments_no_overlap')),
--   ('5 appointment policies still there',
--    (select count(*) from pg_policies where tablename='appointments') = 5),
--   ('queue due reminder still there',
--    to_regprocedure('public.send_due_reminder(uuid)') is not null),
--   ('appointment due reminder still there',
--    to_regprocedure('public.send_appointment_due_reminder(uuid)') is not null),
--   ('nightly RPCs all still there',
--    to_regprocedure('public.send_daily_summaries(date)') is not null
--    and to_regprocedure('public.send_customer_reminders()') is not null
--    and to_regprocedure('public.send_appointment_reminders(integer)') is not null)
-- ) as t(check_name, ok) order by ok, check_name;
--
--
-- ---------------------------------------------------------------------------
-- আচরণগত প্রোব — ROLLBACK করে, কোনো সারি থাকে না
-- ---------------------------------------------------------------------------
-- ১) এক সময়ে একটাই জীবিত সদস্যপদ
--
-- begin;
--   with shop as (select id from public.shops where status='ACTIVE' limit 1),
--        cust as (select id from public.profiles where role='customer' limit 1),
--        tier as (
--          insert into public.membership_tiers (shop_id, name, price, duration_days, benefits)
--          select shop.id, 'Probe Gold', 1000, 30,
--                 '[{"kind":"DISCOUNT","label":"১০% ছাড়","value":10}]'::jsonb
--            from shop returning id, shop_id
--        ),
--        first as (
--          insert into public.customer_memberships (shop_id, customer_id, tier_id, status)
--          select tier.shop_id, cust.id, tier.id, 'ACTIVE' from tier, cust returning id
--        )
--   select id from first;
--   -- একই কাস্টমার, একই দোকান, দ্বিতীয়বার — **ব্যর্থ হওয়ার কথা**
--   -- (duplicate key value violates unique constraint
--   --  "customer_memberships_one_live_idx")
-- rollback;
--
-- ২) টিয়ার এডিট করলেও পুরনো সদস্যপদের দাম বদলায় না — উপরের সারিটার
--    price/tier_snapshot টুকে রেখে টিয়ারের price বদলাও, তারপর আবার পড়ো।
