-- ফেজ ৬ / Sprint 7 — লয়্যালটি পয়েন্ট
--
-- ===========================================================================
-- চালানোর ক্রম
-- ===========================================================================
--   1. 20260916_parlour_foundation.sql       ✅
--   2. 20260917_service_categories.sql       ✅
--   3. 20260918_appointment_core.sql         ✅
--   4. 20260919_appointment_availability.sql ✅
--   5. 20260920_appointment_money.sql        ✅
--   6. 20260921_membership.sql               ✅
--   7. 20260922_loyalty.sql                  ← এই ফাইল
--
-- ===========================================================================
-- এই ফাইল কী করে, আর কী করে না
-- ===========================================================================
-- করে: তিনটে নতুন টেবিল (`loyalty_settings`, `loyalty_accounts`,
--      `loyalty_transactions`), তাদের RLS, তিনটে RPC, একটা পয়েন্ট-গণনা
--      ফাংশন, আর **দুটো নতুন AFTER UPDATE ট্রিগার** — একটা serials-এ, একটা
--      appointments-এ।
--
-- করে না: কোনো বিদ্যমান টেবিলে ALTER নেই। **কোনো বিদ্যমান ফাংশন বা ট্রিগার
--         `create or replace` করা হয়নি** — `serial_before_update`,
--         `serials_after_update`, `appointment_before_update`,
--         `appointments_after_update`, `recalc_queue_estimates`,
--         `notify_serial_event` — একটাও ছোঁয়া হয়নি। নতুন ট্রিগার দুটোর নাম
--         `zz_` দিয়ে শুরু, তাই Postgres ওদের **সবার শেষে** চালায়: কিউ বা
--         অ্যাপয়েন্টমেন্টের নিজের কাজ আগে সম্পূর্ণ হয়, তারপর পয়েন্ট বসে।
--
-- **সবচেয়ে গুরুত্বপূর্ণ নিয়ম:** লয়্যালটির কোনো ব্যর্থতা কখনো একটা কাজ শেষ
-- করা আটকাবে না। ট্রিগারটা পুরোটা `exception when others then` দিয়ে ঘেরা —
-- পয়েন্ট বসাতে না পারলে একটা WARNING যায়, কিন্তু DONE ট্রানজিশন সফলই থাকে।
-- সেলুনের চলতি ব্যবসা একটা ঐচ্ছিক ফিচারের বাগে থেমে যেতে পারে না।
--
-- সিদ্ধান্ত ৩২, ৩৩, ৩৬ এবং নতুন ৫৪–৫৭ — বিস্তারিত docs/IMPLEMENTATION_PLAN.md-এ।
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- ১) loyalty_settings — দোকান-প্রতি প্রোগ্রাম
-- ---------------------------------------------------------------------------
-- সিদ্ধান্ত ৩৬: `is_enabled = false` মানে ফিচারটা ওই দোকানে **অদৃশ্য**।
-- সারি না থাকা আর `is_enabled = false` — দুটোরই একই মানে, তাই কোনো দোকানে
-- সারি সিড করা হয়নি (মেম্বারশিপ টিয়ারের মতোই)।
create table if not exists public.loyalty_settings (
  shop_id uuid primary key references public.shops(id) on delete cascade,

  is_enabled boolean not null default false,

  -- "কত টাকা খরচে ১ পয়েন্ট" — দোকানদার এভাবেই ভাবে ("প্রতি ১০০ টাকায় ১")।
  -- উল্টোটা (`points_per_taka`) ভগ্নাংশ পয়েন্ট তৈরি করত, আর পয়েন্ট
  -- পূর্ণসংখ্যা হওয়াই উচিত — আধা পয়েন্ট কেউ খরচ করতে পারে না।
  taka_per_point integer not null default 100
    check (taka_per_point between 1 and 100000),

  -- এর নিচের বিল পয়েন্ট পায় না। ০ = সব বিলই পায়।
  min_bill_taka numeric(10, 2) not null default 0
    check (min_bill_taka >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.loyalty_settings enable row level security;

drop policy if exists "loyalty_settings: owner manage" on public.loyalty_settings;
create policy "loyalty_settings: owner manage" on public.loyalty_settings
  for all
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

-- কাস্টমার সক্রিয় দোকানের চালু প্রোগ্রামের নিয়ম দেখতে পারে ("প্রতি ১০০
-- টাকায় ১ পয়েন্ট") — নইলে তার পয়েন্ট কার্ডের সংখ্যাটা ব্যাখ্যাহীন থাকত।
drop policy if exists "loyalty_settings: browse enabled" on public.loyalty_settings;
create policy "loyalty_settings: browse enabled" on public.loyalty_settings
  for select
  using (
    is_enabled = true
    and exists (
      select 1 from public.shops sh
       where sh.id = shop_id and sh.status = 'ACTIVE'
    )
  );

create or replace function public.loyalty_settings_touch()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.shop_id    := old.shop_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists loyalty_settings_touch on public.loyalty_settings;
create trigger loyalty_settings_touch
  before update on public.loyalty_settings
  for each row execute function public.loyalty_settings_touch();


-- ---------------------------------------------------------------------------
-- ২) loyalty_accounts — পয়েন্টের মালিক (দোকান, কাস্টমার) জোড়া
-- ---------------------------------------------------------------------------
-- সিদ্ধান্ত ৩৩: প্রাইমারি কী `(shop_id, customer_id)`। কোনো ভিউ, RPC বা API
-- কখনো `shop_id` ছাড়া পয়েন্ট যোগ করে দেখাবে না — কারণ ৫০ পয়েন্ট এক দোকানে
-- যা কেনে, অন্য দোকানে কিছুই কেনে না। মোট সংখ্যা দেখানো মানে কাস্টমারকে
-- ভুল বোঝানো।
create table if not exists public.loyalty_accounts (
  shop_id     uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,

  -- ব্যালেন্স = লেজারের যোগফল, সবসময়। এটা ক্যাশ, সত্য নয় — সত্যটা
  -- `loyalty_transactions`-এ। নিচের RPC দুটো একই লেনদেনে দুটোই লেখে।
  balance         integer not null default 0 check (balance >= 0),
  -- কখনো কমে না — "এই কাস্টমার মোট কত কামিয়েছে", খরচ বাদ দিয়ে নয়।
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (shop_id, customer_id)
);

-- কাস্টমারের প্রোফাইল পাতা: "আমার সব দোকানের কার্ড"।
create index if not exists loyalty_accounts_customer_idx
  on public.loyalty_accounts (customer_id);

-- মালিকের তালিকা: সবচেয়ে বেশি পয়েন্ট আগে।
create index if not exists loyalty_accounts_shop_balance_idx
  on public.loyalty_accounts (shop_id, balance desc);

alter table public.loyalty_accounts enable row level security;

-- ---------------------------------------------------------------------------
-- সিদ্ধান্ত ৩২ — **এখানে কোনো UPDATE পলিসি নেই। কোনো INSERT পলিসিও নেই।**
-- ---------------------------------------------------------------------------
-- ব্যালেন্স বদলায় শুধু নিচের SECURITY DEFINER RPC-র ভেতরে, প্রতিবার একটা
-- লেজার সারি সহ। কাস্টমার নিজের ব্যালেন্স বাড়াতে পারবে না, মালিকও সরাসরি
-- একটা সংখ্যা বসিয়ে দিতে পারবে না — তাকে `loyalty_adjust()` ডাকতে হবে,
-- যেটা কারণসহ লেজারে লিখে রাখে। SELECT-ই একমাত্র সরাসরি অধিকার।
drop policy if exists "loyalty_accounts: customer or owner read" on public.loyalty_accounts;
create policy "loyalty_accounts: customer or owner read" on public.loyalty_accounts
  for select
  using (customer_id = auth.uid() or public.is_shop_owner(shop_id));


-- ---------------------------------------------------------------------------
-- ৩) loyalty_transactions — লেজার, একমাত্র সত্য
-- ---------------------------------------------------------------------------
create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),

  shop_id     uuid not null,
  customer_id uuid not null,
  -- কম্পোজিট FK: লেজার সারি কখনো অ্যাকাউন্ট ছাড়া থাকতে পারে না।
  foreign key (shop_id, customer_id)
    references public.loyalty_accounts (shop_id, customer_id) on delete cascade,

  -- ধনাত্মক = জমা, ঋণাত্মক = খরচ/সংশোধন। ০ অর্থহীন, তাই নিষিদ্ধ।
  points integer not null check (points <> 0),

  -- Sprint 7-এ তিনটেই: কিউ থেকে জমা, অ্যাপয়েন্টমেন্ট থেকে জমা, হাতে সংশোধন।
  -- **REDEEM নেই** — রিডেম্পশন ইঞ্জিন ইচ্ছাকৃতভাবে পরের স্প্রিন্টের কাজ।
  kind text not null check (kind in ('EARN_SERIAL', 'EARN_APPOINTMENT', 'ADJUST')),

  -- কোন কাজ থেকে পয়েন্টটা এলো। দুটো আলাদা nullable FK, পলিমরফিক
  -- (kind, id) জোড়া নয় — এভাবে ডেটাবেসই রেফারেন্সিয়াল ইন্টেগ্রিটি ধরে।
  source_serial_id      uuid references public.serials(id) on delete set null,
  source_appointment_id uuid references public.appointments(id) on delete set null,

  -- ---- স্ন্যাপশট: এই সারিটা নিজে থেকেই ব্যাখ্যাযোগ্য ----
  -- কত টাকার বিলে, কোন হারে। পরে দোকান হার বদলালেও পুরনো সারি বোঝা যায়।
  -- `services_snapshot`/`tier_snapshot`-এর একই কনভেনশন।
  bill_amount    numeric(10, 2),
  taka_per_point integer,

  note       text check (note is null or length(note) <= 200),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  -- জমার সারিতে উৎস থাকতেই হবে, সংশোধনে থাকবে না — নইলে "এই পয়েন্ট কোথা
  -- থেকে এলো" প্রশ্নের উত্তর হারিয়ে যায়।
  constraint loyalty_tx_source_matches_kind check (
    (kind = 'EARN_SERIAL'      and source_serial_id is not null and source_appointment_id is null) or
    (kind = 'EARN_APPOINTMENT' and source_appointment_id is not null and source_serial_id is null) or
    (kind = 'ADJUST'           and source_serial_id is null and source_appointment_id is null)
  )
);

-- ---------------------------------------------------------------------------
-- একই কাজে দুবার পয়েন্ট নয় — **ডেটাবেসেই** (সিদ্ধান্ত ৫৬)
-- ---------------------------------------------------------------------------
-- একটা সিরিয়াল/অ্যাপয়েন্টমেন্ট একবারই পয়েন্ট দেয়। প্রি-চেক নয় (সিদ্ধান্ত
-- ৪৩-এর একই যুক্তি): দুটো সমান্তরাল UPDATE-এর মধ্যে কোনটা টিকবে ইনডেক্স ঠিক
-- করে। AFTER UPDATE ট্রিগার একই সারিতে দুবার চললেও (স্ট্যাটাস DONE-এ বসার পর
-- আরেকটা আপডেট) দ্বিতীয়বার এখানে আটকায়।
create unique index if not exists loyalty_tx_one_per_serial_idx
  on public.loyalty_transactions (source_serial_id)
  where source_serial_id is not null;

create unique index if not exists loyalty_tx_one_per_appointment_idx
  on public.loyalty_transactions (source_appointment_id)
  where source_appointment_id is not null;

-- ব্যালেন্স = যোগফল যাচাই করার হট পাথ, আর কাস্টমারের কার্ডের ইতিহাস।
create index if not exists loyalty_tx_account_idx
  on public.loyalty_transactions (shop_id, customer_id, created_at desc);

alter table public.loyalty_transactions enable row level security;

-- লেজার পড়া যায়, লেখা যায় না — কোনো INSERT/UPDATE/DELETE পলিসি নেই।
-- শুধু DEFINER RPC লেখে, তাই ইতিহাস বানানোও যায় না, বাদ দেওয়াও যায় না
-- (`appointment_reschedules`-এর একই প্যাটার্ন)।
drop policy if exists "loyalty_tx: customer or owner read" on public.loyalty_transactions;
create policy "loyalty_tx: customer or owner read" on public.loyalty_transactions
  for select
  using (customer_id = auth.uid() or public.is_shop_owner(shop_id));


-- ---------------------------------------------------------------------------
-- ৪) points_for_bill — একটাই সূত্র, একটাই জায়গা
-- ---------------------------------------------------------------------------
-- IMMUTABLE, তাই ট্রিগার আর RPC দুজনেই নিশ্চিন্তে ডাকে। হুবহু এই সূত্রের
-- নকল আছে `src/features/loyalty/lib/loyalty.ts`-এ, UI-র প্রিভিউ আর ইউনিট
-- টেস্টের জন্য — দুটো একসাথে বদলাতে হবে।
create or replace function public.points_for_bill(
  p_bill           numeric,
  p_taka_per_point integer,
  p_min_bill       numeric default 0
)
returns integer
language sql
immutable
as $$
  select case
           when p_bill is null or p_taka_per_point is null then 0
           when p_taka_per_point <= 0 then 0
           when p_bill < coalesce(p_min_bill, 0) then 0
           -- floor: ভগ্নাংশ পয়েন্ট নেই। ৯৯ টাকায় ১০০-হারে ০ পয়েন্ট, আর
           -- সেটাই সৎ — দোকান "প্রতি ১০০ টাকায় ১" বলেছে।
           else greatest(0, floor(p_bill / p_taka_per_point)::integer)
         end;
$$;

comment on function public.points_for_bill(numeric, integer, numeric) is
  'Points a bill earns: floor(bill / taka_per_point), 0 below min_bill. '
  'Mirrored in src/features/loyalty/lib/loyalty.ts — change both together.';


-- ---------------------------------------------------------------------------
-- ৫) loyalty_award — জমা দেওয়ার একমাত্র দরজা
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, কারণ `loyalty_accounts`/`loyalty_transactions`-এ কারো
-- INSERT/UPDATE পলিসি নেই (সিদ্ধান্ত ৩২)। তাই মালিকানা-চেকটা **এখানে হাতে**
-- করতে হয় — RLS নিজে থেকে আটকাবে না।
--
-- অন্য দোকানের `shop_id` দিয়ে ডাকলে ব্যর্থ হয় (প্ল্যানের আইসোলেশন টেস্ট গ),
-- আর সেটা ট্রিগার পথেও সঠিক: DONE ট্রানজিশন RLS অনুযায়ী শুধু মালিকই করতে
-- পারে, তাই ট্রিগারের ভেতরে `auth.uid()` সবসময় সেই দোকানের মালিক।
create or replace function public.loyalty_award(
  p_shop_id        uuid,
  p_customer_id    uuid,
  p_points         integer,
  p_kind           text,
  p_serial_id      uuid    default null,
  p_appointment_id uuid    default null,
  p_bill_amount    numeric default null,
  p_taka_per_point integer default null,
  p_note           text    default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'not your shop';
  end if;

  if p_points is null or p_points <= 0 then
    raise exception 'loyalty_points_must_be_positive';
  end if;

  if p_kind not in ('EARN_SERIAL', 'EARN_APPOINTMENT') then
    raise exception 'loyalty_award_kind_invalid';
  end if;

  if p_customer_id is null then
    raise exception 'loyalty_needs_a_customer';
  end if;

  -- অ্যাকাউন্ট না থাকলে এখানেই তৈরি হয়। on conflict do nothing, তাই দুটো
  -- সমান্তরাল প্রথম-জমা একটাই অ্যাকাউন্ট বানায়।
  insert into public.loyalty_accounts (shop_id, customer_id)
  values (p_shop_id, p_customer_id)
  on conflict (shop_id, customer_id) do nothing;

  -- লেজার আগে। এখানে ইউনিক ইনডেক্স আটকালে (একই কাজে দ্বিতীয়বার) পুরো
  -- ফাংশনটা ব্যর্থ হয় আর ব্যালেন্সে হাত পড়ে না — অর্থাৎ দুটো কখনো
  -- আলাদা হয়ে যেতে পারে না।
  insert into public.loyalty_transactions (
    shop_id, customer_id, points, kind,
    source_serial_id, source_appointment_id,
    bill_amount, taka_per_point, note, created_by
  ) values (
    p_shop_id, p_customer_id, p_points, p_kind,
    p_serial_id, p_appointment_id,
    p_bill_amount, p_taka_per_point, p_note, auth.uid()
  );

  update public.loyalty_accounts
     set balance         = balance + p_points,
         lifetime_earned = lifetime_earned + p_points,
         updated_at      = now()
   where shop_id = p_shop_id and customer_id = p_customer_id
  returning balance into v_balance;

  return v_balance;
end;
$$;

comment on function public.loyalty_award is
  'The only door for adding points. SECURITY DEFINER because the tables have '
  'no INSERT/UPDATE policy (decision 32); checks is_shop_owner() by hand. '
  'Writes the ledger row first, so balance can never drift from the ledger.';


-- ---------------------------------------------------------------------------
-- ৬) loyalty_adjust — মালিকের হাতে সংশোধন
-- ---------------------------------------------------------------------------
-- ধনাত্মক বা ঋণাত্মক, দুটোই। ব্যালেন্স শূন্যের নিচে নামানো যাবে না — CHECK
-- কনস্ট্রেইন্টই আটকাবে, কিন্তু আগেই একটা পড়ার মতো বার্তা দেওয়া হলো।
-- **রিডেম্পশন নয়** — এটা "ভুল হয়েছিল, ঠিক করে দাও"। পয়েন্ট খরচ করে
-- পুরস্কার নেওয়ার ইঞ্জিন পরের স্প্রিন্টের কাজ।
create or replace function public.loyalty_adjust(
  p_shop_id     uuid,
  p_customer_id uuid,
  p_points      integer,
  p_note        text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'not your shop';
  end if;

  if p_points is null or p_points = 0 then
    raise exception 'loyalty_points_must_not_be_zero';
  end if;

  insert into public.loyalty_accounts (shop_id, customer_id)
  values (p_shop_id, p_customer_id)
  on conflict (shop_id, customer_id) do nothing;

  select balance into v_balance
    from public.loyalty_accounts
   where shop_id = p_shop_id and customer_id = p_customer_id
   for update;

  if v_balance + p_points < 0 then
    raise exception 'loyalty_balance_cannot_go_negative';
  end if;

  insert into public.loyalty_transactions (
    shop_id, customer_id, points, kind, bill_amount, note, created_by
  ) values (
    p_shop_id, p_customer_id, p_points, 'ADJUST', null, p_note, auth.uid()
  );

  update public.loyalty_accounts
     set balance = balance + p_points,
         -- ধনাত্মক সংশোধনও "কামানো" — ঋণাত্মকটা lifetime থেকে বাদ যায় না,
         -- কারণ lifetime_earned কখনো কমে না (উপরের কমেন্ট)।
         lifetime_earned = lifetime_earned + greatest(p_points, 0),
         updated_at = now()
   where shop_id = p_shop_id and customer_id = p_customer_id
  returning balance into v_balance;

  return v_balance;
end;
$$;


-- ---------------------------------------------------------------------------
-- ৭) my_loyalty_accounts — কাস্টমারের কার্ডের তালিকা
-- ---------------------------------------------------------------------------
-- সিদ্ধান্ত ৩৩: **তালিকা, মোট সংখ্যা নয়।** প্রতিটা সারিতে দোকানের নাম ও
-- লোগো আছে, যাতে "এই পয়েন্ট কোথায় খরচ হবে" প্রশ্নই না ওঠে — প্ল্যানের
-- স্পষ্ট শর্ত।
--
-- SECURITY DEFINER, কারণ `shops`-এ join করতে হয় আর কাস্টমার শুধু নিজের
-- সারিগুলো পাবে — `where customer_id = auth.uid()` হার্ডকোড, প্যারামিটার
-- নেই, তাই অন্য কারো কার্ড চাওয়ার কোনো উপায়ও নেই।
create or replace function public.my_loyalty_accounts()
returns table (
  shop_id         uuid,
  shop_name       text,
  shop_logo_url   text,
  business_type   text,
  balance         integer,
  lifetime_earned integer,
  taka_per_point  integer,
  is_enabled      boolean,
  last_earned_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.shop_id,
    s.name,
    s.logo_url,
    s.business_type::text,
    a.balance,
    a.lifetime_earned,
    coalesce(ls.taka_per_point, 100),
    coalesce(ls.is_enabled, false),
    (select max(t.created_at) from public.loyalty_transactions t
      where t.shop_id = a.shop_id and t.customer_id = a.customer_id and t.points > 0)
  from public.loyalty_accounts a
  join public.shops s on s.id = a.shop_id
  left join public.loyalty_settings ls on ls.shop_id = a.shop_id
 where a.customer_id = auth.uid()
 order by a.balance desc, s.name;
$$;

comment on function public.my_loyalty_accounts is
  'The signed-in customer''s point cards, one row per shop, never a total '
  '(decision 33). auth.uid() is hard-coded, so no one else''s cards are '
  'reachable through it.';


-- ---------------------------------------------------------------------------
-- ৮) DONE → পয়েন্ট, দুটো টেবিলেই
-- ---------------------------------------------------------------------------
-- একটাই ট্রিগার ফাংশন, দুটো টেবিলে বসানো। `tg_table_name` দিয়ে জানে সে
-- কিউয়ের সারিতে আছে না অ্যাপয়েন্টমেন্টে — দুটো প্রায়-একই ফাংশন রাখার
-- চেয়ে এটা কম ঝুঁকিপূর্ণ (একটাতে বাগ সারালে অন্যটায় সারানো ভুলে যাওয়া যায়)।
--
-- **পুরোটা exception-handler দিয়ে ঘেরা।** লয়্যালটি একটা ঐচ্ছিক ফিচার;
-- ওটার কোনো ব্যর্থতা কখনো একজন দোকানদারের কাজ শেষ করা আটকাতে পারে না।
-- ব্যর্থ হলে WARNING যায়, DONE ট্রানজিশন সফলই থাকে (সিদ্ধান্ত ৫৫)।
create or replace function public.loyalty_after_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s        public.loyalty_settings%rowtype;
  v_points integer;
begin
  -- শুধু DONE-এ ঢোকার মুহূর্তে। DONE সারির পরের যেকোনো আপডেটে (বাকি
  -- কালেক্ট, রিমাইন্ডার) status অপরিবর্তিত, তাই এখানে কিছুই হয় না।
  if new.status is distinct from 'DONE' or old.status is not distinct from 'DONE' then
    return null;
  end if;

  if new.customer_id is null then
    -- অফলাইন/ওয়াক-ইন কাস্টমারের অ্যাকাউন্ট নেই, তাই পয়েন্ট বসানোর জায়গাও
    -- নেই। এটা ব্যর্থতা নয়, স্বাভাবিক।
    return null;
  end if;

  select * into s from public.loyalty_settings where shop_id = new.shop_id;
  if s.shop_id is null or not s.is_enabled then
    return null;               -- সিদ্ধান্ত ৩৬: চালু না থাকলে কিছুই হয় না
  end if;

  v_points := public.points_for_bill(new.total_amount, s.taka_per_point, s.min_bill_taka);
  if v_points <= 0 then
    return null;
  end if;

  begin
    perform public.loyalty_award(
      new.shop_id,
      new.customer_id,
      v_points,
      case when tg_table_name = 'serials' then 'EARN_SERIAL' else 'EARN_APPOINTMENT' end,
      case when tg_table_name = 'serials' then new.id else null end,
      case when tg_table_name = 'serials' then null else new.id end,
      new.total_amount,
      s.taka_per_point,
      null
    );
  exception
    when unique_violation then
      -- এই কাজে আগেই পয়েন্ট বসেছে। সম্পূর্ণ স্বাভাবিক, চুপচাপ পাশ কাটাও।
      null;
    when others then
      -- আর সব কিছু: লগ করো, কিন্তু কাজ শেষ করা আটকাবে না।
      raise warning 'loyalty award skipped for % %: %', tg_table_name, new.id, sqlerrm;
  end;

  return null;
end;
$$;

-- `zz_` প্রিফিক্স ইচ্ছাকৃত: Postgres একই ইভেন্টের ট্রিগারগুলো **নামের
-- বর্ণানুক্রমে** চালায়, তাই এটা `serials_after_update`,
-- `serials_sync_queue_public`, `notify_serial_event_trigger`,
-- `appointments_after_update` — সবার পরে চলে। কিউ বা অ্যাপয়েন্টমেন্টের
-- নিজের কাজ আগে সম্পূর্ণ হয়, পয়েন্ট তার উপরে বসে।
drop trigger if exists serials_zz_loyalty_award on public.serials;
create trigger serials_zz_loyalty_award
  after update of status on public.serials
  for each row execute function public.loyalty_after_done();

drop trigger if exists appointments_zz_loyalty_award on public.appointments;
create trigger appointments_zz_loyalty_award
  after update of status on public.appointments
  for each row execute function public.loyalty_after_done();


-- ===========================================================================
-- যাচাই — মাইগ্রেশনের পর আনকমেন্ট করে চালাও। সব ok = true হওয়া চাই।
-- ===========================================================================
--
-- select * from (values
--   ('loyalty_settings exists',      to_regclass('public.loyalty_settings') is not null),
--   ('loyalty_accounts exists',      to_regclass('public.loyalty_accounts') is not null),
--   ('loyalty_transactions exists',  to_regclass('public.loyalty_transactions') is not null),
--   ('settings RLS on',
--    (select relrowsecurity from pg_class where oid='public.loyalty_settings'::regclass)),
--   ('accounts RLS on',
--    (select relrowsecurity from pg_class where oid='public.loyalty_accounts'::regclass)),
--   ('ledger RLS on',
--    (select relrowsecurity from pg_class where oid='public.loyalty_transactions'::regclass)),
--
--   -- সিদ্ধান্ত ৩২ — ব্যালেন্সে সরাসরি হাত দেওয়ার কোনো পথ নেই
--   ('accounts has exactly 1 policy, and it is SELECT',
--    (select count(*) from pg_policies where tablename='loyalty_accounts') = 1
--    and (select cmd from pg_policies where tablename='loyalty_accounts') = 'SELECT'),
--   ('accounts has NO update policy',
--    not exists (select 1 from pg_policies where tablename='loyalty_accounts' and cmd='UPDATE')),
--   ('accounts has NO insert policy',
--    not exists (select 1 from pg_policies where tablename='loyalty_accounts' and cmd='INSERT')),
--   ('ledger has exactly 1 policy, and it is SELECT',
--    (select count(*) from pg_policies where tablename='loyalty_transactions') = 1
--    and (select cmd from pg_policies where tablename='loyalty_transactions') = 'SELECT'),
--   ('ledger is append-only to clients (no INSERT policy)',
--    not exists (select 1 from pg_policies where tablename='loyalty_transactions' and cmd='INSERT')),
--   ('2 settings policies', (select count(*) from pg_policies where tablename='loyalty_settings') = 2),
--
--   -- সিদ্ধান্ত ৩৩ — (shop, customer) জোড়াই প্রাইমারি কী
--   ('accounts PK is (shop_id, customer_id)',
--    (select array_agg(a.attname::text order by k.ord)
--       from pg_constraint c
--       join unnest(c.conkey) with ordinality as k(attnum, ord) on true
--       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
--      where c.conrelid = 'public.loyalty_accounts'::regclass and c.contype = 'p')
--    = array['shop_id','customer_id']),
--
--   -- সিদ্ধান্ত ৫৬ — একই কাজে দুবার পয়েন্ট নয়
--   ('one-per-serial unique index',
--    exists (select 1 from pg_indexes where indexname='loyalty_tx_one_per_serial_idx')),
--   ('one-per-appointment unique index',
--    exists (select 1 from pg_indexes where indexname='loyalty_tx_one_per_appointment_idx')),
--   ('source matches kind constraint',
--    exists (select 1 from pg_constraint where conname='loyalty_tx_source_matches_kind')),
--
--   -- RPC
--   ('points_for_bill exists',
--    to_regprocedure('public.points_for_bill(numeric,integer,numeric)') is not null),
--   ('points_for_bill is IMMUTABLE',
--    (select provolatile from pg_proc
--      where oid='public.points_for_bill(numeric,integer,numeric)'::regprocedure) = 'i'),
--   ('loyalty_award exists and is DEFINER',
--    (select prosecdef from pg_proc where oid = (
--       select oid from pg_proc where proname='loyalty_award' and pronamespace='public'::regnamespace limit 1))),
--   ('loyalty_adjust exists and is DEFINER',
--    (select prosecdef from pg_proc where oid = (
--       select oid from pg_proc where proname='loyalty_adjust' and pronamespace='public'::regnamespace limit 1))),
--   ('my_loyalty_accounts exists and is DEFINER',
--    (select prosecdef from pg_proc where oid='public.my_loyalty_accounts()'::regprocedure)),
--
--   -- ট্রিগার দুটোই আছে, আর নাম zz_ দিয়ে শুরু (সবার শেষে চলে)
--   ('serials loyalty trigger exists',
--    exists (select 1 from pg_trigger where tgname='serials_zz_loyalty_award')),
--   ('appointments loyalty trigger exists',
--    exists (select 1 from pg_trigger where tgname='appointments_zz_loyalty_award')),
--
--   -- সিদ্ধান্ত ৩৬ — কোনো দোকানে প্রোগ্রাম চালু করা হয়নি
--   ('no shop had loyalty switched on', (select count(*) from public.loyalty_settings where is_enabled) = 0),
--
--   -- ব্যালেন্স = লেজারের যোগফল (শুরুতে দুটোই খালি, তাই তুচ্ছভাবে সত্য)
--   ('balance equals ledger sum everywhere',
--    not exists (
--      select 1 from public.loyalty_accounts a
--       where a.balance <> coalesce((select sum(t.points) from public.loyalty_transactions t
--                                     where t.shop_id=a.shop_id and t.customer_id=a.customer_id), 0))),
--
--   -- আগের স্প্রিন্টগুলো অক্ষত: একটাও বিদ্যমান ট্রিগার/ফাংশন replace হয়নি
--   ('serials_before_update still there',
--    exists (select 1 from pg_trigger where tgname='serials_before_update')),
--   ('serials_after_update still there',
--    exists (select 1 from pg_trigger where tgname='serials_after_update')),
--   ('serials_sync_queue_public still there',
--    exists (select 1 from pg_trigger where tgname='serials_sync_queue_public')),
--   ('appointments_before_update still there',
--    exists (select 1 from pg_trigger where tgname='appointments_before_update')),
--   ('appointments_after_update still there',
--    exists (select 1 from pg_trigger where tgname='appointments_after_update')),
--   ('appointment overlap constraint still there',
--    exists (select 1 from pg_constraint where conname='appointments_no_overlap')),
--   ('5 appointment policies still there',
--    (select count(*) from pg_policies where tablename='appointments') = 5),
--   ('5 membership policies still there',
--    (select count(*) from pg_policies where tablename='customer_memberships') = 5),
--   ('membership_is_active still there',
--    to_regprocedure('public.membership_is_active(uuid,uuid)') is not null),
--   ('nightly RPCs all still there',
--    to_regprocedure('public.send_daily_summaries(date)') is not null
--    and to_regprocedure('public.send_customer_reminders()') is not null
--    and to_regprocedure('public.send_appointment_reminders(integer)') is not null
--    and to_regprocedure('public.expire_memberships()') is not null)
-- ) as t(check_name, ok) order by ok, check_name;
--
--
-- ---------------------------------------------------------------------------
-- আচরণগত প্রোব — নিজে থেকেই ROLLBACK হয়, কোনো সারি থাকে না
-- ---------------------------------------------------------------------------
-- Sprint 6-এর প্রোবের মতোই: শেষ কাজটা `raise exception`, তাই DO ব্লকটা
-- সবসময় নিজের সব লেখা ফিরিয়ে নেয়। সম্পূর্ণ প্রোব SQL রিপোর্টে আলাদা করে
-- দেওয়া আছে — ওটা চালালে দেখা যায়:
--   · হার অনুযায়ী পয়েন্ট বসে (৮০০ টাকা, ১০০ হার → ৮ পয়েন্ট)
--   · একই কাজে দ্বিতীয়বার পয়েন্ট বসে না (unique_violation)
--   · `is_enabled = false` হলে কিছুই হয় না
--   · min_bill-এর নিচের বিল ০ পয়েন্ট পায়
--   · ব্যালেন্স = লেজারের যোগফল
--   · সরাসরি `update loyalty_accounts set balance = 9999` **কোনো কাজ করে না**
--   · অন্য দোকানের shop_id দিয়ে `loyalty_award` ডাকলে `not your shop`
