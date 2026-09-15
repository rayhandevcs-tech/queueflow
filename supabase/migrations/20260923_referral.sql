-- ফেজ ৬ / Sprint 8 — রেফারেল সিস্টেম
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
--   7. 20260922_loyalty.sql                  ✅  ← এটা আগে চালাতে হবে
--   8. 20260923_referral.sql                 ← এই ফাইল
--
-- ===========================================================================
-- এই ফাইল কী করে, আর কী করে না
-- ===========================================================================
-- করে: দুটো নতুন টেবিল (`referral_codes`, `referrals`), তাদের RLS, পাঁচটা
--      RPC, আর **দুটো নতুন AFTER UPDATE ট্রিগার** — একটা serials-এ, একটা
--      appointments-এ। Sprint 7-এর `loyalty_settings`-এ তিনটে কলাম আর
--      `loyalty_transactions`-এ একটা কলাম যোগ হয়।
--
-- করে না: **কোনো আলাদা পয়েন্ট বা রিওয়ার্ড ব্যালেন্স তৈরি করে না।** রেফারেলের
--         পুরস্কার Sprint 7-এর `loyalty_accounts`/`loyalty_transactions`-এই
--         বসে — একই লেজার, একই ইনভ্যারিয়েন্ট (ব্যালেন্স = লেজারের যোগফল)।
--         `loyalty_award`, `loyalty_adjust`, `points_for_bill`,
--         `my_loyalty_accounts`, `loyalty_after_done` — Sprint 7-এর একটা
--         ফাংশনও `create or replace` করা হয়নি। সেলুনের বা অ্যাপয়েন্টমেন্টের
--         কোনো বিদ্যমান ট্রিগারও ছোঁয়া হয়নি। নতুন ট্রিগার দুটোর নাম
--         `zz_referral_convert` — `zz_loyalty_award`-এর ঠিক পরে চলে (Postgres
--         একই ইভেন্টের ট্রিগার নামের বর্ণানুক্রমে চালায়), তাই কাজের নিজের
--         পয়েন্ট আগে বসে, রেফারেল বোনাস তার উপরে।
--
-- **সবচেয়ে গুরুত্বপূর্ণ নিয়ম (সিদ্ধান্ত ৫৫-এর ধারাবাহিকতা):** রেফারেলের কোনো
-- ব্যর্থতা কখনো একটা কাজ শেষ করা আটকাবে না। ট্রিগারটা পুরোটা
-- `exception when others then` দিয়ে ঘেরা।
--
-- ===========================================================================
-- সিদ্ধান্ত ৩৪-এর সংশোধন — কোড **দোকান-ভিত্তিক**, গ্লোবাল নয়
-- ===========================================================================
-- প্ল্যানের সিদ্ধান্ত ৩৪ বলেছিল "কোড গ্লোবাল (`referral_codes.customer_id`
-- PK), পুরস্কার শপ-স্কোপড"। এই স্প্রিন্টে PK `(shop_id, customer_id)` —
-- অর্থাৎ প্রতিটা দোকানে কাস্টমারের আলাদা কোড। কারণ তিনটে:
--
--   ১. **আইসোলেশন একটাই স্তরে থাকে না।** গ্লোবাল কোড হলে "A দোকানের কোড B
--      দোকানে কাজ করবে না" কথাটা শুধু `claim_referral`-এর ভেতরের একটা `if`।
--      দোকান-ভিত্তিক কোড হলে B দোকানে A-র কোড **নেই** — খুঁজেই পাওয়া যায় না।
--   ২. **রেজিস্ট্রেশনে কোড নেওয়ার দরকার ফুরিয়ে যায়।** সাইন-আপের সময় কোন
--      দোকানের রেফারেল সেটা জানার উপায় নেই, তাই গ্লোবাল কোড হলে হয় auth
--      ফ্লোতে হাত দিতে হতো, নয় একটা "কোড ধরে রাখা" pending স্টেট বানাতে হতো।
--      দোকান-ভিত্তিক কোডে দাবির জায়গাটা স্বাভাবিকভাবেই দোকানের পাতা — auth
--      ফ্লো অপরিবর্তিত।
--   ৩. সিদ্ধান্ত ৩৪-এর **দ্বিতীয়ার্ধ পুরোটাই অক্ষত**: পুরস্কার সেই দোকানের
--      `loyalty_accounts`-এ, আর এক দোকানে এক রেফার্ড কাস্টমারের জন্য একবারই
--      (`unique (shop_id, referred_id)`)।
--
-- দাম: তিন দোকানের নিয়মিত কাস্টমারের তিনটে কোড। UI-তে কোডটা সবসময় দোকানের
-- নামের পাশে দেখানো হয়, তাই বিভ্রান্তির জায়গা নেই।
--
-- **স্ট্যাটাস দুটোই — `PENDING` আর `CONVERTED`।** প্ল্যানের স্কেচে চারটে ছিল
-- (`PENDING/QUALIFIED/REWARDED/VOID`)। `QUALIFIED` আর `REWARDED` আলাদা রাখার
-- মানে হতো যদি পুরস্কার পরে কোনো কাজে বসত — কিন্তু এখানে যোগ্যতা আর পুরস্কার
-- **একই ট্রানজেকশনে**, তাই দুটো আলাদা স্ট্যাটাস কখনো আলাদা হতে পারত না, শুধু
-- মিথ্যে বলার সুযোগ থাকত। `VOID` বাদ, কারণ Sprint 8-এ কিছুই ওটা বসায় না — আর
-- যে স্ট্যাটাস কেউ বসাতে পারে না সেটা না থাকার চেয়ে খারাপ (Sprint 7-এ
-- `REDEEM` kind বাদ দেওয়ার হুবহু একই যুক্তি)।
--
-- এই স্কিমায় **কোনো Postgres enum টাইপ নেই** (সিদ্ধান্ত ৪৫) — সব স্ট্যাটাস
-- `text` + CHECK। প্ল্যানের `create type referral_status as enum` তাই
-- অক্ষরে-অক্ষরে অনুসরণ করা হয়নি, কনভেনশন অনুসরণ করা হয়েছে।
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- ১) loyalty_settings — রেফারেলের নিয়ম এখানেই, নতুন টেবিলে নয়
-- ---------------------------------------------------------------------------
-- রেফারেলের পুরস্কার লয়্যালটি পয়েন্ট, তাই তার নিয়মও লয়্যালটির সেটিংসেই
-- থাকা উচিত — একটা সমান্তরাল `referral_settings` টেবিল মানে দুটো জায়গায়
-- একই দোকানের এক প্রোগ্রামের নিয়ম, আর দুটো RLS পলিসি সেট ঠিক রাখার দায়।
--
-- বিদ্যমান দুটো পলিসি (owner manage · browse enabled) এই কলামগুলোও ঢেকে দেয়,
-- তাই কোনো নতুন পলিসি লাগছে না — কাস্টমার চালু দোকানের নিয়ম দেখতে পায়
-- ("তোমার কোডে বন্ধু এলে তুমি ১০ পয়েন্ট"), অন্য কেউ কিছুই পায় না।
alter table public.loyalty_settings
  add column if not exists referral_enabled boolean not null default false;

alter table public.loyalty_settings
  add column if not exists referral_referrer_points integer not null default 0;

alter table public.loyalty_settings
  add column if not exists referral_referred_points integer not null default 0;

-- `add column ... check (...)` নাম-ছাড়া কনস্ট্রেইন্ট বানায়, আর `add
-- constraint` নিজে idempotent নয় — তাই নামসহ, DO ব্লকে।
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'loyalty_settings_referrer_points_range') then
    alter table public.loyalty_settings
      add constraint loyalty_settings_referrer_points_range
      check (referral_referrer_points between 0 and 100000);
  end if;

  if not exists (select 1 from pg_constraint
                  where conname = 'loyalty_settings_referred_points_range') then
    alter table public.loyalty_settings
      add constraint loyalty_settings_referred_points_range
      check (referral_referred_points between 0 and 100000);
  end if;
end
$$;

-- **রেফারেল চালু মানে লয়্যালটিও চালু।** এটা CHECK কনস্ট্রেইন্ট করা হয়নি
-- ইচ্ছাকৃতভাবে: তাহলে মালিক লয়্যালটি সাময়িকভাবে বন্ধ করতে গেলে UPDATE-টাই
-- ব্যর্থ হতো, একটা দুর্বোধ্য এররসহ। বদলে নিয়মটা **রানটাইমে** — নিচের তিনটে
-- RPC আর ট্রিগার সবাই `is_enabled and referral_enabled` দুটোই দেখে, আর UI
-- সুইচটা লয়্যালটি বন্ধ থাকলে দেখায়ই না।
comment on column public.loyalty_settings.referral_enabled is
  'Referral rewards are loyalty points, so referral is live only when '
  'is_enabled AND referral_enabled are both true. Enforced at runtime in '
  'my_referral_code/claim_referral/referral_convert, not by a CHECK.';


-- ---------------------------------------------------------------------------
-- ২) referral_codes — দোকান-প্রতি, কাস্টমার-প্রতি একটা কোড
-- ---------------------------------------------------------------------------
create table if not exists public.referral_codes (
  shop_id     uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,

  -- বড় হাতের অক্ষর আর সংখ্যা — মুখে বলা যায়, WhatsApp-এ লেখা যায়। সব
  -- তুলনা `upper(btrim(...))` করে হয়, তাই কেউ ছোট হাতে লিখলেও চলে।
  code text not null unique
    check (code ~ '^[A-Z0-9]{6,12}$'),

  created_at timestamptz not null default now(),

  primary key (shop_id, customer_id)
);

-- "আমার সব দোকানের কোড" — কাস্টমারের প্রোফাইল/শপ পাতা।
create index if not exists referral_codes_customer_idx
  on public.referral_codes (customer_id);

alter table public.referral_codes enable row level security;

-- ---------------------------------------------------------------------------
-- **এখানে কোনো INSERT/UPDATE/DELETE পলিসি নেই** (সিদ্ধান্ত ৩২-এর একই যুক্তি)
-- ---------------------------------------------------------------------------
-- কোড তৈরি হয় শুধু `my_referral_code()`-এর ভেতরে, যেখানে `auth.uid()`
-- হার্ডকোড। তাই কেউ নিজের পছন্দের কোড বসাতে পারে না, অন্য কারো নামে কোড
-- বানাতে পারে না, আর কোড মুছে ইতিহাস ভাঙতেও পারে না। SELECT-ই একমাত্র
-- সরাসরি অধিকার।
drop policy if exists "referral_codes: owner or self read" on public.referral_codes;
create policy "referral_codes: owner or self read" on public.referral_codes
  for select
  using (customer_id = auth.uid() or public.is_shop_owner(shop_id));


-- ---------------------------------------------------------------------------
-- ৩) referrals — কে কাকে এনেছে, কোন দোকানে
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),

  shop_id     uuid not null references public.shops(id) on delete cascade,
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,

  -- যে কোডটা আসলে ব্যবহার হয়েছিল — স্ন্যাপশট (`services_snapshot`/
  -- `tier_snapshot`-এর একই কনভেনশন)। কোড বদলালেও ইতিহাস বোঝা যায়।
  code text not null,

  status text not null default 'PENDING'
    check (status in ('PENDING', 'CONVERTED')),

  -- কোন কাজটা রেফারেলটাকে যোগ্য করল। দুটো আলাদা nullable FK, পলিমরফিক
  -- (type, id) জোড়া নয় — `loyalty_transactions`-এর একই প্যাটার্ন।
  qualifying_serial_id      uuid references public.serials(id) on delete set null,
  qualifying_appointment_id uuid references public.appointments(id) on delete set null,

  -- কত পয়েন্ট বসেছিল, দুই পাশে — স্ন্যাপশট। দোকান পরে হার বদলালেও পুরনো
  -- সারি নিজে থেকেই ব্যাখ্যাযোগ্য।
  referrer_points integer check (referrer_points is null or referrer_points >= 0),
  referred_points integer check (referred_points is null or referred_points >= 0),

  converted_at timestamptz,
  created_at   timestamptz not null default now(),

  -- নিজেকে রেফার করা যায় না — **ডেটাবেসেই**, শুধু RPC-র ভেতরের `if` নয়।
  constraint referrals_no_self_referral check (referrer_id <> referred_id),

  -- একটা সারি হয় সম্পূর্ণ PENDING (কোনো পুরস্কার, কোনো উৎস নেই), নয়
  -- সম্পূর্ণ CONVERTED (সময়, দুই পাশের পয়েন্ট, আর ঠিক একটা উৎস) — মাঝামাঝি
  -- কোনো আকৃতি সম্ভব নয়, তাই "রূপান্তর হয়েছে কিন্তু পয়েন্ট জানা নেই" বলে
  -- কোনো সারি থাকতে পারে না।
  constraint referrals_conversion_shape check (
    (status = 'PENDING'
      and converted_at is null
      and qualifying_serial_id is null
      and qualifying_appointment_id is null
      and referrer_points is null
      and referred_points is null)
    or
    (status = 'CONVERTED'
      and converted_at is not null
      and referrer_points is not null
      and referred_points is not null
      -- ঠিক একটা উৎস — XOR
      and ((qualifying_serial_id is not null) <> (qualifying_appointment_id is not null)))
  ),

  -- ---------------------------------------------------------------------
  -- একই-দোকান সম্পর্ক, **কম্পোজিট FK দিয়ে**
  -- ---------------------------------------------------------------------
  -- রেফারারের ওই দোকানে একটা কোড থাকতেই হবে। এটা `claim_referral`-এর
  -- ভেতরের চেকের নকল নয়, তার **নিচের স্তর**: কোনো পথে (ভবিষ্যতের কোনো RPC,
  -- হাতে চালানো SQL) অন্য দোকানের রেফারারকে বসানো ডেটাবেসই আটকায়।
  foreign key (shop_id, referrer_id)
    references public.referral_codes (shop_id, customer_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- এক দোকানে একজন রেফার্ড কাস্টমার একবারই (সিদ্ধান্ত ৩৪)
-- ---------------------------------------------------------------------------
-- প্রি-চেক নয় (সিদ্ধান্ত ৪৩-এর একই যুক্তি): দুটো সমান্তরাল দাবির মধ্যে কোনটা
-- টিকবে ইনডেক্স ঠিক করে, কোনো `if exists` নয়।
create unique index if not exists referrals_one_per_shop
  on public.referrals (shop_id, referred_id);

-- মালিকের "কে কতজন এনেছে" আর কাস্টমারের নিজের তালিকা।
create index if not exists referrals_referrer_idx
  on public.referrals (shop_id, referrer_id, created_at desc);

-- ট্রিগারের হট পাথ: "এই কাস্টমারের এই দোকানে PENDING রেফারেল আছে?"
create index if not exists referrals_pending_idx
  on public.referrals (shop_id, referred_id)
  where status = 'PENDING';

alter table public.referrals enable row level security;

-- ---------------------------------------------------------------------------
-- পড়া যায়, লেখা যায় না — **কোনো INSERT/UPDATE/DELETE পলিসি নেই**
-- ---------------------------------------------------------------------------
-- দাবি বসায় শুধু `claim_referral()`, রূপান্তর করে শুধু `referral_convert()` —
-- দুটোই SECURITY DEFINER। তাই কেউ নিজের নামে একটা CONVERTED সারি বানিয়ে
-- পয়েন্ট আদায় করতে পারে না, আর ইতিহাস মুছতেও পারে না।
drop policy if exists "referrals: parties or owner read" on public.referrals;
create policy "referrals: parties or owner read" on public.referrals
  for select
  using (
    referrer_id = auth.uid()
    or referred_id = auth.uid()
    or public.is_shop_owner(shop_id)
  );

-- ---------------------------------------------------------------------------
-- ইতিহাস জমাট — DEFINER ফাংশনগুলোর জন্যও
-- ---------------------------------------------------------------------------
-- উপরে কোনো UPDATE পলিসি নেই, তাই ক্লায়েন্ট এখানে পৌঁছায়ই না। এটা তার
-- **উপরের** স্তর: ভবিষ্যতের কোনো DEFINER ফাংশনও যাতে সম্পর্কটা বদলাতে বা
-- রূপান্তরটা উল্টে দিতে না পারে (মেম্বারশিপের `customer_memberships` ট্রিগারের
-- একই প্যাটার্ন)।
create or replace function public.referrals_freeze_history()
returns trigger
language plpgsql
as $$
begin
  new.id          := old.id;
  new.shop_id     := old.shop_id;
  new.referrer_id := old.referrer_id;
  new.referred_id := old.referred_id;
  new.code        := old.code;
  new.created_at  := old.created_at;

  if old.status = 'CONVERTED' then
    -- রূপান্তর চূড়ান্ত। পয়েন্ট বসে গেছে, লেজারে সারি আছে — পিছিয়ে যাওয়ার
    -- কোনো সৎ উপায় নেই।
    if new.status is distinct from 'CONVERTED' then
      raise exception 'referral_conversion_is_final';
    end if;
    new.qualifying_serial_id      := old.qualifying_serial_id;
    new.qualifying_appointment_id := old.qualifying_appointment_id;
    new.referrer_points           := old.referrer_points;
    new.referred_points           := old.referred_points;
    new.converted_at              := old.converted_at;
  end if;

  return new;
end;
$$;

drop trigger if exists referrals_freeze_history on public.referrals;
create trigger referrals_freeze_history
  before update on public.referrals
  for each row execute function public.referrals_freeze_history();


-- ---------------------------------------------------------------------------
-- ৪) loyalty_transactions — রেফারেলের পুরস্কার **একই লেজারে**
-- ---------------------------------------------------------------------------
-- আলাদা `referral_rewards` টেবিল হলে "কাস্টমারের কত পয়েন্ট" প্রশ্নের দুটো
-- উত্তর থাকত, আর Sprint 7-এর ইনভ্যারিয়েন্ট (ব্যালেন্স = লেজারের যোগফল)
-- ভেঙে যেত। তাই লেজারটাই **সম্প্রসারিত** হচ্ছে, নকল হচ্ছে না।
alter table public.loyalty_transactions
  add column if not exists source_referral_id uuid
    references public.referrals(id) on delete set null;

-- দুটো নতুন kind। `drop ... if exists` + `add` — কনস্ট্রেইন্ট বদলানোর
-- একমাত্র উপায়, আর এটা সম্প্রসারণ: পুরনো তিনটে মান এখনো বৈধ, তাই কোনো
-- বিদ্যমান সারি এই ALTER-এ ব্যর্থ হতে পারে না।
alter table public.loyalty_transactions
  drop constraint if exists loyalty_transactions_kind_check;
alter table public.loyalty_transactions
  add constraint loyalty_transactions_kind_check
  check (kind in (
    'EARN_SERIAL', 'EARN_APPOINTMENT', 'ADJUST',
    'REFERRAL_REFERRER',   -- যে এনেছে
    'REFERRAL_REFERRED'    -- যে এসেছে
  ));

-- উৎস আর kind-এর মিল — তিনটে পুরনো শাখা হুবহু অপরিবর্তিত, একটা নতুন যোগ।
alter table public.loyalty_transactions
  drop constraint if exists loyalty_tx_source_matches_kind;
alter table public.loyalty_transactions
  add constraint loyalty_tx_source_matches_kind check (
    (kind = 'EARN_SERIAL'
       and source_serial_id is not null
       and source_appointment_id is null
       and source_referral_id is null)
    or
    (kind = 'EARN_APPOINTMENT'
       and source_appointment_id is not null
       and source_serial_id is null
       and source_referral_id is null)
    or
    (kind = 'ADJUST'
       and source_serial_id is null
       and source_appointment_id is null
       and source_referral_id is null)
    or
    (kind in ('REFERRAL_REFERRER', 'REFERRAL_REFERRED')
       and source_referral_id is not null
       and source_serial_id is null
       and source_appointment_id is null)
  );

-- ---------------------------------------------------------------------------
-- এক রেফারেলে এক পাশে একবারই পুরস্কার — **ডেটাবেসেই**
-- ---------------------------------------------------------------------------
-- `(source_referral_id, kind)` জোড়া ইউনিক, তাই একই রেফারেলের রেফারার-পাশ আর
-- রেফার্ড-পাশ দুটো আলাদা সারি পায়, কিন্তু একই পাশ দুবার পায় না। Sprint 7-এর
-- per-serial/per-appointment ইনডেক্সের হুবহু একই ভূমিকা (সিদ্ধান্ত ৫৬)।
create unique index if not exists loyalty_tx_one_per_referral_side_idx
  on public.loyalty_transactions (source_referral_id, kind)
  where source_referral_id is not null;

create index if not exists loyalty_tx_referral_idx
  on public.loyalty_transactions (source_referral_id)
  where source_referral_id is not null;


-- ---------------------------------------------------------------------------
-- ৫) referral_is_live — একটাই জায়গায় "চালু আছে কি"
-- ---------------------------------------------------------------------------
-- রেফারেল চালু = লয়্যালটি চালু **এবং** রেফারেল চালু। এই দুই শর্ত চারটে
-- জায়গায় লাগে (দুটো RPC, ট্রিগার, আর মালিকের ভিউ), তাই একটাই ফাংশন — নইলে
-- একদিন একটা জায়গায় শর্তটা বদলাত, অন্যগুলোয় নয়।
create or replace function public.referral_is_live(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select ls.is_enabled and ls.referral_enabled
       from public.loyalty_settings ls
      where ls.shop_id = p_shop_id),
    false
  );
$$;

comment on function public.referral_is_live(uuid) is
  'Referral rewards are loyalty points, so a shop''s referral programme is '
  'live only when both is_enabled and referral_enabled are true.';


-- ---------------------------------------------------------------------------
-- ৬) my_referral_code — কাস্টমারের কোড, প্রথম চাওয়ায় তৈরি
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, কারণ `referral_codes`-এ কোনো INSERT পলিসি নেই। `auth.uid()`
-- হার্ডকোড — প্যারামিটারে কাস্টমার নেওয়া হয় না, তাই অন্য কারো নামে কোড
-- বানানোর কোনো উপায়ও নেই।
--
-- কোনো দোকানে কোড **সিড করা হয়নি** (মেম্বারশিপ টিয়ার আর লয়্যালটি সেটিংসের
-- মতোই): যে কাস্টমার কখনো শেয়ার করতে চায়নি তার কোড থাকার দরকার নেই।
create or replace function public.my_referral_code(p_shop_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  -- বিভ্রান্তিকর অক্ষর বাদ: 0/O, 1/I/L. কোডটা মুখে বলা হবে, WhatsApp-এ
  -- লেখা হবে, হাতে টাইপ হবে — "শূন্য না ও?" প্রশ্নটা এখানেই মারা যাক।
  k_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_me       uuid := auth.uid();
  v_code     text;
  v_existing text;
begin
  if v_me is null then
    raise exception 'referral_requires_login';
  end if;

  if not public.referral_is_live(p_shop_id) then
    raise exception 'referral_not_enabled';
  end if;

  select code into v_existing
    from public.referral_codes
   where shop_id = p_shop_id and customer_id = v_me;
  if v_existing is not null then
    return v_existing;
  end if;

  -- ৩১^৬ ≈ ৮৮ কোটি — সংঘর্ষ বিরল, কিন্তু "বিরল" মানে "কখনো নয়" নয়, তাই
  -- চেষ্টা ২০ বার। প্রি-চেক নয়: ইউনিক ইনডেক্সই বিচারক।
  for _attempt in 1..20 loop
    v_code := '';
    for _i in 1..6 loop
      v_code := v_code || substr(k_alphabet, 1 + floor(random() * length(k_alphabet))::int, 1);
    end loop;

    begin
      insert into public.referral_codes (shop_id, customer_id, code)
      values (p_shop_id, v_me, v_code);
      return v_code;
    exception
      when unique_violation then
        -- দুটো কারণ হতে পারে: কোডের সংঘর্ষ (আবার চেষ্টা), অথবা দুটো
        -- সমান্তরাল প্রথম-চাওয়ার একটা আগে পৌঁছে গেছে (ওটারই কোড ফেরাও)।
        select code into v_existing
          from public.referral_codes
         where shop_id = p_shop_id and customer_id = v_me;
        if v_existing is not null then
          return v_existing;
        end if;
    end;
  end loop;

  raise exception 'referral_code_generation_failed';
end;
$$;

comment on function public.my_referral_code(uuid) is
  'The signed-in customer''s referral code at one shop, minted on first ask. '
  'auth.uid() is hard-coded, so no code can be created in anyone else''s name.';


-- ---------------------------------------------------------------------------
-- ৭) claim_referral — কোড দেওয়া। **পুরস্কার এখানে বসে না।**
-- ---------------------------------------------------------------------------
-- এটাই এই স্প্রিন্টের সবচেয়ে গুরুত্বপূর্ণ সীমারেখা: কোড লিখলেই পয়েন্ট নয়।
-- এই ফাংশন শুধু একটা **PENDING সম্পর্ক** তৈরি করে। পুরস্কার বসে তখনই, যখন
-- রেফার্ড কাস্টমারের একটা কাজ সত্যিই DONE হয় (নিচের ট্রিগার) — নইলে যে কেউ
-- একটা কোড লিখে পয়েন্ট নিয়ে চলে যেতে পারত।
create or replace function public.claim_referral(
  p_shop_id uuid,
  p_code    text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me   uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_referrer uuid;
  v_id   uuid;
begin
  if v_me is null then
    raise exception 'referral_requires_login';
  end if;

  if not public.referral_is_live(p_shop_id) then
    raise exception 'referral_not_enabled';
  end if;

  if v_code = '' then
    raise exception 'referral_code_invalid';
  end if;

  -- ---- আইসোলেশনের প্রথম স্তর ----
  -- `shop_id = p_shop_id` শর্তটা এখানেই। অন্য দোকানের কোড এই দোকানে "ভুল
  -- পাসওয়ার্ড" নয়, **অস্তিত্বহীন** — আর সেটাই সৎ উত্তর।
  select customer_id into v_referrer
    from public.referral_codes
   where shop_id = p_shop_id and code = v_code;

  if v_referrer is null then
    raise exception 'referral_code_not_found';
  end if;

  if v_referrer = v_me then
    raise exception 'referral_self_not_allowed';
  end if;

  -- ---- "নতুন কাস্টমার" মানে সত্যিই নতুন ----
  -- যোগ্যতার শর্ত হলো রেফার্ড কাস্টমারের **প্রথম সম্পন্ন বুকিং**। যার এই
  -- দোকানে আগেই সম্পন্ন কাজ আছে, তার ক্ষেত্রে শর্তটা আর কখনো পূরণ হবে না —
  -- তাই দাবিটা নিলে একটা চিরকালীন PENDING সারি তৈরি হতো, যেটা কাস্টমারকে
  -- মিথ্যে আশা দেখাত। এখানেই "না" বলা সৎ।
  if exists (select 1 from public.serials
              where shop_id = p_shop_id and customer_id = v_me and status = 'DONE')
     or exists (select 1 from public.appointments
                 where shop_id = p_shop_id and customer_id = v_me and status = 'DONE')
  then
    raise exception 'referral_not_a_new_customer';
  end if;

  -- দ্বিতীয় দাবি আটকায় `referrals_one_per_shop` — প্রি-চেক নয়, ইনডেক্স
  -- (সিদ্ধান্ত ৪৩)। তাই দুটো সমান্তরাল দাবির মধ্যেও ঠিক একটা টেকে।
  begin
    insert into public.referrals (shop_id, referrer_id, referred_id, code)
    values (p_shop_id, v_referrer, v_me, v_code)
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'referral_already_claimed';
  end;

  return v_id;
end;
$$;

comment on function public.claim_referral(uuid, text) is
  'Records a PENDING referral relationship. Deliberately awards nothing: the '
  'reward lands only when the referred customer actually completes a booking '
  '(referral_after_done). Entering a code is not earning a reward.';


-- ---------------------------------------------------------------------------
-- ৮) referral_award_points — পুরস্কারের একমাত্র দরজা
-- ---------------------------------------------------------------------------
-- Sprint 7-এর `loyalty_award`-কে `create or replace` করা হয়নি ইচ্ছাকৃতভাবে:
-- ওটার স্বাক্ষর বদলালে পুরনো কলগুলো ভাঙত, আর নতুন প্যারামিটার যোগ করলে
-- একটা overload তৈরি হতো যেখানে `null` কোন দিকে গেল বোঝা কঠিন। বদলে এই
-- ফাংশনটা **হুবহু একই শৃঙ্খলা** মানে: লেজার আগে, তারপর ব্যালেন্স — তাই
-- দুটো কখনো আলাদা হতে পারে না।
--
-- **কোনো পরিমাণ বা কাস্টমার প্যারামিটারে নেওয়া হয় না।** দুটোই রেফারেল সারি
-- থেকে পড়া হয়। অর্থাৎ মালিক নিজে এটা ডাকলেও শুধু ওই রেফারেলের নিজের দুই
-- পক্ষকে, ওই সারিতে লেখা পরিমাণটাই, একবার দিতে পারে — বেশি নয়, অন্য কাউকে নয়।
create or replace function public.referral_award_points(
  p_referral_id uuid,
  p_side        text
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r          public.referrals%rowtype;
  v_customer uuid;
  v_points   integer;
  v_kind     text;
begin
  select * into r from public.referrals where id = p_referral_id;
  if r.id is null then
    raise exception 'referral_not_found';
  end if;

  -- `loyalty_award`-এর একই কারণে হাতে চেক: টেবিলগুলোয় কোনো INSERT/UPDATE
  -- পলিসি নেই, তাই RLS নিজে থেকে কিছুই আটকাবে না (সিদ্ধান্ত ৩২)।
  if not public.is_shop_owner(r.shop_id) then
    raise exception 'not your shop';
  end if;

  if r.status <> 'CONVERTED' then
    raise exception 'referral_not_converted';
  end if;

  if p_side = 'REFERRER' then
    v_customer := r.referrer_id; v_points := r.referrer_points; v_kind := 'REFERRAL_REFERRER';
  elsif p_side = 'REFERRED' then
    v_customer := r.referred_id; v_points := r.referred_points; v_kind := 'REFERRAL_REFERRED';
  else
    raise exception 'referral_side_invalid';
  end if;

  if coalesce(v_points, 0) <= 0 then
    return 0;                    -- দোকান ওই পাশে কিছু দেয় না — ব্যর্থতা নয়
  end if;

  insert into public.loyalty_accounts (shop_id, customer_id)
  values (r.shop_id, v_customer)
  on conflict (shop_id, customer_id) do nothing;

  -- লেজার আগে। `loyalty_tx_one_per_referral_side_idx` এখানে আটকালে পুরো
  -- ফাংশনটা ব্যর্থ হয় আর ব্যালেন্সে হাত পড়ে না — দুবার পুরস্কার অসম্ভব,
  -- আর অর্ধেক পুরস্কারও অসম্ভব।
  insert into public.loyalty_transactions (
    shop_id, customer_id, points, kind, source_referral_id,
    bill_amount, taka_per_point, note, created_by
  ) values (
    r.shop_id, v_customer, v_points, v_kind, r.id,
    null, null, null, auth.uid()
  );

  update public.loyalty_accounts
     set balance         = balance + v_points,
         lifetime_earned = lifetime_earned + v_points,
         updated_at      = now()
   where shop_id = r.shop_id and customer_id = v_customer;

  return v_points;
end;
$$;

comment on function public.referral_award_points(uuid, text) is
  'Credits one side of a converted referral into THAT shop''s loyalty account '
  '(decision 34). Takes no amount and no customer — both are read from the '
  'referral row, so even the shop owner cannot inflate or redirect a reward. '
  'Ledger row first, then balance, exactly as loyalty_award does.';


-- ---------------------------------------------------------------------------
-- ৯) referral_convert — যোগ্যতা + দুই পাশের পুরস্কার, এক ট্রানজেকশনে
-- ---------------------------------------------------------------------------
-- **অ্যাটমিক**: পুরোটা একটা ফাংশন, তাই একটাই ট্রানজেকশন — স্ট্যাটাস
-- CONVERTED হয়ে গেছে কিন্তু পয়েন্ট বসেনি, এমন অবস্থা তৈরি হতে পারে না।
-- **আইডেমপোটেন্ট**: দুটো স্তরে। এক, `where ... and status = 'PENDING'` —
-- দ্বিতীয় কল ০ সারি আপডেট করে আর সেখানেই থামে। দুই, লেজারের ইউনিক ইনডেক্স —
-- প্রথম স্তরটা কোনোভাবে ফাঁকি দিলেও পুরস্কার দুবার বসতে পারে না।
create or replace function public.referral_convert(
  p_referral_id    uuid,
  p_serial_id      uuid default null,
  p_appointment_id uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r        public.referrals%rowtype;
  s        public.loyalty_settings%rowtype;
  v_ref    integer;
  v_new    integer;
  v_locked uuid;
begin
  -- সারিটা লক করে নাও: দুটো কাজ একই মুহূর্তে DONE হলে একটাই রূপান্তর হবে।
  select id into v_locked from public.referrals where id = p_referral_id for update;
  if v_locked is null then
    raise exception 'referral_not_found';
  end if;

  select * into r from public.referrals where id = p_referral_id;

  if not public.is_shop_owner(r.shop_id) then
    raise exception 'not your shop';
  end if;

  if r.status <> 'PENDING' then
    return 0;                    -- আগেই রূপান্তরিত — চুপচাপ, ব্যর্থতা নয়
  end if;

  if (p_serial_id is not null) = (p_appointment_id is not null) then
    raise exception 'referral_needs_exactly_one_qualifying_booking';
  end if;

  select * into s from public.loyalty_settings where shop_id = r.shop_id;
  if s.shop_id is null or not s.is_enabled or not s.referral_enabled then
    raise exception 'referral_not_enabled';
  end if;

  v_ref := coalesce(s.referral_referrer_points, 0);
  v_new := coalesce(s.referral_referred_points, 0);

  update public.referrals
     set status                    = 'CONVERTED',
         converted_at              = now(),
         qualifying_serial_id      = p_serial_id,
         qualifying_appointment_id = p_appointment_id,
         referrer_points           = v_ref,
         referred_points           = v_new
   where id = r.id and status = 'PENDING';

  if not found then
    return 0;                    -- কেউ আগে পৌঁছে গেছে
  end if;

  -- দুই পাশ, একই ট্রানজেকশনে। কোনোটা ০ হলে ফাংশনটা নিজেই কিছুই লেখে না।
  perform public.referral_award_points(r.id, 'REFERRER');
  perform public.referral_award_points(r.id, 'REFERRED');

  return v_ref + v_new;
end;
$$;

comment on function public.referral_convert(uuid, uuid, uuid) is
  'Qualifies a PENDING referral against one completed booking and credits '
  'both sides in the same transaction. Idempotent twice over: the PENDING '
  'guard in the UPDATE, and the ledger''s per-referral-side unique index.';


-- ---------------------------------------------------------------------------
-- ১০) DONE → রেফারেল রূপান্তর, দুটো টেবিলেই
-- ---------------------------------------------------------------------------
-- যোগ্যতার শর্ত **বিদ্যমান সম্পন্ন-কাজের লাইফসাইকেলেই** বসানো হয়েছে — কোনো
-- নতুন স্ট্যাটাস, কোনো নতুন কলাম, কোনো নতুন cron নেই। একটাই ট্রিগার ফাংশন,
-- দুটো টেবিলে, `tg_table_name` দিয়ে জানে সে কোথায় আছে (Sprint 7-এর
-- `loyalty_after_done`-এর একই প্যাটার্ন)।
--
-- **পুরোটা exception-handler দিয়ে ঘেরা** (সিদ্ধান্ত ৫৫)। রেফারেল একটা
-- ঐচ্ছিক ফিচার; ওটার কোনো ব্যর্থতা কখনো একজন দোকানদারের কাজ শেষ করা আটকাতে
-- পারে না।
create or replace function public.referral_after_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s    public.loyalty_settings%rowtype;
  v_id uuid;
begin
  -- শুধু DONE-এ ঢোকার মুহূর্তে। DONE সারির পরের যেকোনো আপডেটে status
  -- অপরিবর্তিত, তাই এখানে কিছুই হয় না।
  if new.status is distinct from 'DONE' or old.status is not distinct from 'DONE' then
    return null;
  end if;

  if new.customer_id is null then
    return null;                 -- ওয়াক-ইন: কোনো অ্যাকাউন্ট নেই, স্বাভাবিক
  end if;

  -- সেটিংস এখানেই দেখা হয়, `referral_convert`-এর এররের উপর ভরসা করে নয় —
  -- নইলে রেফারেল বন্ধ থাকা দোকানের প্রতিটা DONE-এ একটা অর্থহীন WARNING যেত।
  select * into s from public.loyalty_settings where shop_id = new.shop_id;
  if s.shop_id is null or not s.is_enabled or not s.referral_enabled then
    return null;
  end if;

  begin
    select id into v_id
      from public.referrals
     where shop_id = new.shop_id
       and referred_id = new.customer_id
       and status = 'PENDING'
     limit 1;

    if v_id is null then
      return null;               -- এই কাস্টমার কারো রেফারেলে আসেনি
    end if;

    perform public.referral_convert(
      v_id,
      case when tg_table_name = 'serials' then new.id else null end,
      case when tg_table_name = 'serials' then null else new.id end
    );
  exception
    when unique_violation then
      -- এই রেফারেলে আগেই পুরস্কার বসেছে। স্বাভাবিক, চুপচাপ পাশ কাটাও।
      null;
    when others then
      raise warning 'referral conversion skipped for % %: %', tg_table_name, new.id, sqlerrm;
  end;

  return null;
end;
$$;

-- `zz_` প্রিফিক্স ইচ্ছাকৃত, আর নামটা `zz_loyalty_award`-এর **পরে** পড়ে
-- বর্ণানুক্রমে (loyalty < referral): তাই কাজের নিজের পয়েন্ট আগে বসে, রেফারেল
-- বোনাস তার উপরে — লেজারে ক্রমটাও তাই পড়ার মতো হয়।
drop trigger if exists serials_zz_referral_convert on public.serials;
create trigger serials_zz_referral_convert
  after update of status on public.serials
  for each row execute function public.referral_after_done();

drop trigger if exists appointments_zz_referral_convert on public.appointments;
create trigger appointments_zz_referral_convert
  after update of status on public.appointments
  for each row execute function public.referral_after_done();


-- ---------------------------------------------------------------------------
-- ১১) my_referrals — কাস্টমারের নিজের তালিকা
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, কারণ `profiles`-এ কারো ক্রস-ইউজার read পলিসি নেই
-- (Sprint 7-এর `getLoyaltyCustomerNames` এই কারণেই serials/appointments থেকে
-- নাম পড়ে)। `referrer_id = auth.uid()` হার্ডকোড — প্যারামিটারে কাস্টমার
-- নেওয়া হয় না।
--
-- নামটা **ছোট করে** ফেরানো হয় (প্রথম শব্দ), কারণ রেফারারের জানার দরকার
-- "কেউ এসেছে কি না", কারো পুরো পরিচয় নয়।
create or replace function public.my_referrals(p_shop_id uuid)
returns table (
  id              uuid,
  referred_name   text,
  status          text,
  points_earned   integer,
  converted_at    timestamptz,
  created_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'অতিথি'),
    r.status,
    coalesce(r.referrer_points, 0),
    r.converted_at,
    r.created_at
  from public.referrals r
  join public.profiles p on p.id = r.referred_id
 where r.shop_id = p_shop_id
   and r.referrer_id = auth.uid()
 order by r.created_at desc;
$$;

comment on function public.my_referrals(uuid) is
  'The signed-in customer''s own referrals at one shop. auth.uid() is '
  'hard-coded; the referred person''s name is shortened to its first word.';


-- ---------------------------------------------------------------------------
-- ১২) shop_referral_stats — মালিকের "কে কতজন এনেছে"
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER **প্রথম লাইনেই `is_shop_owner` গার্ড সহ** (প্ল্যানের
-- Sprint 10 রিপোর্টিং RPC-র একই প্যাটার্ন): নাম দেখানোর জন্য `profiles`-এ
-- join করতে হয়, যেটা INVOKER-এ সম্ভব নয়।
--
-- `p_shop_id` ছাড়া কোনো সংস্করণ নেই, আর গার্ডটা প্রথম লাইনে — তাই অন্য
-- দোকানের সংখ্যা এই ফাংশন দিয়ে বের করার কোনো পথ নেই।
create or replace function public.shop_referral_stats(p_shop_id uuid)
returns table (
  referrer_id       uuid,
  referrer_name     text,
  code              text,
  total_referrals   integer,
  converted_count   integer,
  pending_count     integer,
  points_awarded    integer,
  last_referral_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'not your shop';
  end if;

  return query
    select
      rc.customer_id,
      coalesce(nullif(btrim(p.full_name), ''), 'অতিথি'),
      rc.code,
      count(r.id)::integer,
      count(r.id) filter (where r.status = 'CONVERTED')::integer,
      count(r.id) filter (where r.status = 'PENDING')::integer,
      coalesce(sum(r.referrer_points), 0)::integer,
      max(r.created_at)
    from public.referral_codes rc
    join public.profiles p on p.id = rc.customer_id
    left join public.referrals r
           on r.shop_id = rc.shop_id and r.referrer_id = rc.customer_id
   where rc.shop_id = p_shop_id
   group by rc.customer_id, p.full_name, rc.code
   having count(r.id) > 0
   order by count(r.id) filter (where r.status = 'CONVERTED') desc,
            count(r.id) desc,
            max(r.created_at) desc;
end;
$$;

comment on function public.shop_referral_stats(uuid) is
  'Who brought how many, for one shop only. is_shop_owner() is the first '
  'line, and there is no variant without p_shop_id.';


-- ===========================================================================
-- যাচাই — মাইগ্রেশনের পর আনকমেন্ট করে চালাও। সব ok = true হওয়া চাই।
-- ===========================================================================
--
-- select * from (values
--   ('referral_codes exists', to_regclass('public.referral_codes') is not null),
--   ('referrals exists',      to_regclass('public.referrals') is not null),
--   ('referral_codes RLS on',
--    (select relrowsecurity from pg_class where oid='public.referral_codes'::regclass)),
--   ('referrals RLS on',
--    (select relrowsecurity from pg_class where oid='public.referrals'::regclass)),
--
--   -- কোড/সম্পর্ক বানানোর একমাত্র পথ DEFINER RPC — কোনো লেখার পলিসি নেই
--   ('referral_codes has exactly 1 policy, and it is SELECT',
--    (select count(*) from pg_policies where tablename='referral_codes') = 1
--    and (select cmd from pg_policies where tablename='referral_codes') = 'SELECT'),
--   ('referral_codes has NO insert policy',
--    not exists (select 1 from pg_policies where tablename='referral_codes' and cmd='INSERT')),
--   ('referrals has exactly 1 policy, and it is SELECT',
--    (select count(*) from pg_policies where tablename='referrals') = 1
--    and (select cmd from pg_policies where tablename='referrals') = 'SELECT'),
--   ('referrals has NO insert policy',
--    not exists (select 1 from pg_policies where tablename='referrals' and cmd='INSERT')),
--   ('referrals has NO update policy',
--    not exists (select 1 from pg_policies where tablename='referrals' and cmd='UPDATE')),
--
--   -- কোড দোকান-ভিত্তিক (সিদ্ধান্ত ৩৪-এর সংশোধন)
--   ('referral_codes PK is (shop_id, customer_id)',
--    (select array_agg(a.attname::text order by k.ord)
--       from pg_constraint c
--       join unnest(c.conkey) with ordinality as k(attnum, ord) on true
--       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
--      where c.conrelid = 'public.referral_codes'::regclass and c.contype = 'p')
--    = array['shop_id','customer_id']),
--   ('code is globally unique',
--    exists (select 1 from pg_constraint
--             where conrelid='public.referral_codes'::regclass and contype='u')),
--
--   -- এক দোকানে এক রেফার্ড কাস্টমার একবারই
--   ('referrals_one_per_shop unique index',
--    exists (select 1 from pg_indexes where indexname='referrals_one_per_shop')),
--   ('self-referral is refused by the database',
--    exists (select 1 from pg_constraint where conname='referrals_no_self_referral')),
--   ('conversion shape constraint',
--    exists (select 1 from pg_constraint where conname='referrals_conversion_shape')),
--   ('same-shop relationship enforced by composite FK',
--    exists (select 1 from pg_constraint
--             where conrelid='public.referrals'::regclass and contype='f'
--               and confrelid='public.referral_codes'::regclass)),
--   ('history freeze trigger',
--    exists (select 1 from pg_trigger where tgname='referrals_freeze_history')),
--
--   -- Sprint 7-এর লেজারই ব্যবহার হচ্ছে, সমান্তরাল কিছু নয়
--   ('no separate referral points/reward table was created',
--    to_regclass('public.referral_rewards') is null
--    and to_regclass('public.referral_points') is null
--    and to_regclass('public.referral_accounts') is null),
--   ('ledger gained source_referral_id',
--    exists (select 1 from information_schema.columns
--             where table_name='loyalty_transactions' and column_name='source_referral_id')),
--   ('ledger kind now allows both referral sides',
--    (select pg_get_constraintdef(oid) from pg_constraint
--      where conname='loyalty_transactions_kind_check') like '%REFERRAL_REFERRER%'),
--   ('old three kinds are still allowed',
--    (select pg_get_constraintdef(oid) from pg_constraint
--      where conname='loyalty_transactions_kind_check') like '%EARN_SERIAL%'),
--   ('one reward per referral side',
--    exists (select 1 from pg_indexes where indexname='loyalty_tx_one_per_referral_side_idx')),
--   ('loyalty_settings gained the three referral columns',
--    (select count(*) from information_schema.columns
--      where table_name='loyalty_settings'
--        and column_name in ('referral_enabled','referral_referrer_points','referral_referred_points')) = 3),
--   ('still exactly 2 loyalty_settings policies (no new ones needed)',
--    (select count(*) from pg_policies where tablename='loyalty_settings') = 2),
--
--   -- RPC
--   ('referral_is_live exists and is DEFINER',
--    (select prosecdef from pg_proc where oid='public.referral_is_live(uuid)'::regprocedure)),
--   ('my_referral_code exists and is DEFINER',
--    (select prosecdef from pg_proc where oid='public.my_referral_code(uuid)'::regprocedure)),
--   ('claim_referral exists and is DEFINER',
--    (select prosecdef from pg_proc where oid='public.claim_referral(uuid,text)'::regprocedure)),
--   ('referral_convert exists and is DEFINER',
--    (select prosecdef from pg_proc where oid='public.referral_convert(uuid,uuid,uuid)'::regprocedure)),
--   ('referral_award_points exists and is DEFINER',
--    (select prosecdef from pg_proc where oid='public.referral_award_points(uuid,text)'::regprocedure)),
--   ('my_referrals exists and is DEFINER',
--    (select prosecdef from pg_proc where oid='public.my_referrals(uuid)'::regprocedure)),
--   ('shop_referral_stats exists and is DEFINER',
--    (select prosecdef from pg_proc where oid='public.shop_referral_stats(uuid)'::regprocedure)),
--
--   -- ট্রিগার দুটোই আছে, আর লয়্যালটির ঠিক পরে চলে
--   ('serials referral trigger exists',
--    exists (select 1 from pg_trigger where tgname='serials_zz_referral_convert')),
--   ('appointments referral trigger exists',
--    exists (select 1 from pg_trigger where tgname='appointments_zz_referral_convert')),
--   ('loyalty fires before referral on serials',
--    'serials_zz_loyalty_award' <
--    (select tgname::text from pg_trigger where tgname='serials_zz_referral_convert')),
--
--   -- কোনো দোকানে রেফারেল চালু করা হয়নি, কোনো কোড সিড করা হয়নি
--   ('no shop had referral switched on',
--    (select count(*) from public.loyalty_settings where referral_enabled) = 0),
--   ('no referral codes were seeded', (select count(*) from public.referral_codes) = 0),
--   ('no referrals were seeded',      (select count(*) from public.referrals) = 0),
--
--   -- ব্যালেন্স = লেজারের যোগফল, রেফারেলের কলাম যোগ করার পরেও
--   ('balance still equals ledger sum everywhere',
--    not exists (
--      select 1 from public.loyalty_accounts a
--       where a.balance <> coalesce((select sum(t.points) from public.loyalty_transactions t
--                                     where t.shop_id=a.shop_id and t.customer_id=a.customer_id), 0))),
--
--   -- আগের স্প্রিন্টগুলো অক্ষত
--   ('loyalty_award untouched',
--    to_regprocedure('public.loyalty_award(uuid,uuid,integer,text,uuid,uuid,numeric,integer,text)') is not null),
--   ('loyalty_adjust untouched',
--    to_regprocedure('public.loyalty_adjust(uuid,uuid,integer,text)') is not null),
--   ('points_for_bill untouched',
--    to_regprocedure('public.points_for_bill(numeric,integer,numeric)') is not null),
--   ('my_loyalty_accounts untouched',
--    to_regprocedure('public.my_loyalty_accounts()') is not null),
--   ('loyalty triggers untouched',
--    exists (select 1 from pg_trigger where tgname='serials_zz_loyalty_award')
--    and exists (select 1 from pg_trigger where tgname='appointments_zz_loyalty_award')),
--   ('loyalty_accounts still has exactly 1 policy',
--    (select count(*) from pg_policies where tablename='loyalty_accounts') = 1),
--   ('serials_before_update still there',
--    exists (select 1 from pg_trigger where tgname='serials_before_update')),
--   ('serials_after_update still there',
--    exists (select 1 from pg_trigger where tgname='serials_after_update')),
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
--   ('nightly RPCs all still there',
--    to_regprocedure('public.send_daily_summaries(date)') is not null
--    and to_regprocedure('public.send_customer_reminders()') is not null
--    and to_regprocedure('public.send_appointment_reminders(integer)') is not null
--    and to_regprocedure('public.expire_memberships()') is not null),
--   ('no referral column landed on serials',
--    (select count(*) from information_schema.columns
--      where table_name='serials' and column_name like '%referr%') = 0),
--   ('no referral column landed on appointments',
--    (select count(*) from information_schema.columns
--      where table_name='appointments' and column_name like '%referr%') = 0)
-- ) as t(check_name, ok) order by ok, check_name;
--
--
-- ---------------------------------------------------------------------------
-- আচরণগত প্রোব — নিজে থেকেই ROLLBACK হয়, কোনো সারি থাকে না
-- ---------------------------------------------------------------------------
-- Sprint 6/7-এর প্রোবের মতোই: শেষ কাজটা `raise exception`, তাই DO ব্লকটা
-- সবসময় নিজের সব লেখা ফিরিয়ে নেয়। সম্পূর্ণ প্রোব SQL রিপোর্টে আলাদা করে
-- দেওয়া আছে — ওটা চালালে দেখা যায়:
--   · কোড শুধু একবার তৈরি হয়, দ্বিতীয় কল একই কোড ফেরায়
--   · নিজের কোড নিজে দাবি করলে `referral_self_not_allowed`
--   · অন্য দোকানের কোড এই দোকানে `referral_code_not_found`
--   · দ্বিতীয় দাবিতে `referral_already_claimed`
--   · **কোড লিখলেই কোনো পয়েন্ট বসে না** — ব্যালেন্স অপরিবর্তিত
--   · কাজ DONE হলে দুই পাশেই পয়েন্ট বসে, সেই দোকানেই
--   · একই রেফারেলে দ্বিতীয়বার পুরস্কার বসে না
--   · ব্যালেন্স = লেজারের যোগফল, রূপান্তরের পরেও
--   · সরাসরি `insert into referrals ... status='CONVERTED'` **কাজ করে না**
