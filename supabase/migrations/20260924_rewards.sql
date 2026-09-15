-- ফেজ ৬ / Sprint 9 — রিওয়ার্ড ও রিডেম্পশন
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
--   8. 20260923_referral.sql                 ✅  ← এটাও
--   9. 20260924_rewards.sql                  ← এই ফাইল
--
-- ===========================================================================
-- এই ফাইল কী করে, আর কী করে না
-- ===========================================================================
-- করে: দুটো নতুন টেবিল (`rewards`, `reward_redemptions`), তাদের RLS, ছয়টা
--      RPC, আর **দুটো নতুন BEFORE UPDATE ট্রিগার** — একটা serials-এ, একটা
--      appointments-এ। Sprint 7-এর `loyalty_transactions`-এ একটা কলাম আর
--      একটা নতুন `kind` যোগ হয়।
--
-- করে না: **কোনো আলাদা পয়েন্ট বা ব্যালেন্স তৈরি করে না।** পয়েন্ট খরচ হয়
--         Sprint 7-এর `loyalty_accounts`/`loyalty_transactions`-এই — একই
--         লেজার, একই ইনভ্যারিয়েন্ট (ব্যালেন্স = লেজারের যোগফল)।
--         **কোনো বিদ্যমান ফাংশন বা ট্রিগার `create or replace` করা হয়নি** —
--         `serial_before_update`, `appointment_before_update`,
--         `serials_after_update`, `appointments_after_update`,
--         `loyalty_award`, `loyalty_adjust`, `points_for_bill`,
--         `loyalty_after_done`, `referral_convert`, `referral_after_done` —
--         একটাও ছোঁয়া হয়নি। `serials`, `appointments`, `services` — কোনো
--         বিদ্যমান টেবিলে ALTER নেই।
--
-- ===========================================================================
-- বিলে ছাড় বসে **নতুন একটা BEFORE ট্রিগারে**, কোর ট্রিগার বদলে নয় (সিদ্ধান্ত ৬৩)
-- ===========================================================================
-- সমস্যাটা ছিল দুই ইঞ্জিনের অসমতা:
--
--   · সেলুনের সিরিয়ালে `total_amount` **একটাই ট্রানজিশনে** লেখা যায় —
--     IN_PROGRESS → DONE (20260912, "কাজ শেষে বাস্তবে ৳১২০ বা ৳৮০ হতে পারে")।
--   · পার্লারের অ্যাপয়েন্টমেন্টে `appointment_before_update()` প্রতিবার
--     `new.total_amount := old.total_amount` লেখে — সবসময় জমাট।
--
-- অর্থাৎ ছাড় সেলুনে বসত, পার্লারে বসত না। আর পার্লারই এই পুরো ফেজের কারণ।
--
-- সমাধান: `appointment_before_update()` **বদলানো হয়নি**। বদলে একটা নতুন
-- BEFORE UPDATE ট্রিগার বসানো হয়েছে, নাম `zz_` দিয়ে — Postgres একই ইভেন্টের
-- ট্রিগার **নামের বর্ণানুক্রমে** চালায়, তাই `appointments_zz_reward_discount`
-- চলে `appointments_before_update`-এর **পরে**, আর ওর জমাট-করা মানটার উপর
-- ছাড়টা বিয়োগ করতে পারে।
--
-- এতে যা রক্ষা পায়: ক্লায়েন্ট এখনো অ্যাপয়েন্টমেন্টের দাম বদলাতে পারে না
-- (কোর ট্রিগার আগের মতোই জমাট করে); নতুন ট্রিগার শুধু একটা **লিপিবদ্ধ**
-- ছাড় বিয়োগ করে, যেটা একটা USED রিডেম্পশন সারিতে লেখা আছে, আর শুধু DONE-এ
-- ঢোকার মুহূর্তে। ঐতিহাসিক অখণ্ডতা অটুট, কোর ইঞ্জিন অটুট।
--
-- **পার্শ্বপ্রতিক্রিয়া, ইচ্ছাকৃত:** লয়্যালটির AFTER ট্রিগার `new.total_amount`
-- পড়ে, তাই পয়েন্ট জমে **ছাড়ের পরের** বিলে — কাস্টমার যা সত্যিই দিয়েছে তার
-- উপর। ওটাই সৎ হিসাব।
--
-- সিদ্ধান্ত ৬২–৬৫ — বিস্তারিত docs/IMPLEMENTATION_PLAN.md-এ।
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- ১) rewards — দোকানের রিওয়ার্ড ক্যাটালগ
-- ---------------------------------------------------------------------------
-- নিয়ম ৩: পয়েন্ট/রিওয়ার্ড ধরে রাখে এমন কোনো টেবিলে `shop_id` ছাড়া কিছু নেই।
-- এখানে PK `id`, কিন্তু প্রতিটা সারিতে `shop_id` বাধ্যতামূলক আর প্রতিটা
-- পলিসি, RPC ও ইনডেক্স ওটা দিয়েই স্কোপড।
--
-- কোনো দোকানে রিওয়ার্ড **সিড করা হয়নি** (মেম্বারশিপ টিয়ার, লয়্যালটি সেটিংস
-- আর রেফারেল কোডের মতোই, সিদ্ধান্ত ৫৩): যে মালিক কখনো একটা রিওয়ার্ড বানায়নি
-- তার ক্যাটালগ খালি, আর কাস্টমার এমন কিছু "রিডিম" করতে পারে না যার কথা মালিক
-- জানেই না।
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),

  shop_id uuid not null references public.shops(id) on delete cascade,

  name text not null check (length(btrim(name)) between 1 and 60),
  description text check (description is null or length(description) <= 300),

  -- প্ল্যানের তিনটেই, ঠিক তিনটেই। `reward_kind` enum টাইপ বানানো হয়নি —
  -- এই স্কিমায় কোনো Postgres enum নেই (সিদ্ধান্ত ৪৫), সব স্ট্যাটাস/প্রকার
  -- `text` + CHECK।
  kind text not null check (kind in ('DISCOUNT_FLAT', 'DISCOUNT_PCT', 'FREE_SERVICE')),

  -- কত পয়েন্টে। ০ অর্থহীন — যা বিনামূল্যে, সেটা রিওয়ার্ড নয়, অফার।
  points_cost integer not null check (points_cost between 1 and 1000000),

  -- DISCOUNT_FLAT → টাকা · DISCOUNT_PCT → ১–১০০ · FREE_SERVICE → null
  value numeric(10, 2) check (value is null or value >= 0),

  -- FREE_SERVICE-এর সার্ভিস। `restrict`, কারণ যে সার্ভিস একটা রিওয়ার্ডে
  -- বিক্রি হচ্ছে সেটা মুছে ফেলা মানে ইস্যু করা কুপনের অর্থ হারিয়ে যাওয়া
  -- (`customer_memberships_tier_id_fkey`-র একই যুক্তি — "বন্ধ করো, মুছো না")।
  service_id uuid references public.services(id) on delete restrict,

  -- null = সীমাহীন। সংখ্যা = আর কতটা ইস্যু করা যাবে।
  stock integer check (stock is null or stock >= 0),

  -- অফারটা কবে পর্যন্ত। ইস্যু হওয়া কুপনের মেয়াদও এটাই (নিচে দেখো)।
  valid_until timestamptz,

  is_active boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- প্রতিটা প্রকারের নিজের আকৃতি। এটা ছাড়া "৫০% ফ্ল্যাট ছাড়" বা "মূল্যহীন
  -- ফ্রি সার্ভিস" জাতীয় অর্থহীন সারি তৈরি করা যেত।
  constraint rewards_value_matches_kind check (
    (kind = 'DISCOUNT_FLAT'
       and value is not null and value > 0 and service_id is null)
    or
    (kind = 'DISCOUNT_PCT'
       and value is not null and value > 0 and value <= 100 and service_id is null)
    or
    (kind = 'FREE_SERVICE'
       and service_id is not null and value is null)
  )
);

-- কাস্টমারের দেখা ক্যাটালগ, আর মালিকের নিজের তালিকা।
create index if not exists rewards_shop_idx
  on public.rewards (shop_id, is_active, sort_order, created_at);

-- এক দোকানে একই নামের দুটো রিওয়ার্ড বিভ্রান্তিকর — কুপনে শুধু নামটাই থাকে।
-- `membership_tiers_shop_name_idx`-এর একই প্যাটার্ন।
create unique index if not exists rewards_shop_name_idx
  on public.rewards (shop_id, lower(btrim(name)));

alter table public.rewards enable row level security;

drop policy if exists "rewards: owner manage" on public.rewards;
create policy "rewards: owner manage" on public.rewards
  for all
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

-- কাস্টমার সক্রিয় দোকানের **চালু** রিওয়ার্ডগুলোই দেখে। বন্ধ করা রিওয়ার্ড
-- ক্যাটালগে নেই, তাই রিডিমও করা যায় না (সিদ্ধান্ত ৩৬-এর একই যুক্তি)।
drop policy if exists "rewards: browse active" on public.rewards;
create policy "rewards: browse active" on public.rewards
  for select
  using (
    is_active = true
    and exists (
      select 1 from public.shops sh
       where sh.id = shop_id and sh.status = 'ACTIVE'
    )
  );

-- ---------------------------------------------------------------------------
-- ক্রস-শপ সার্ভিস **ডেটাবেসেই** আটকায়
-- ---------------------------------------------------------------------------
-- একটা CHECK কনস্ট্রেইন্ট সাবকোয়েরি করতে পারে না, আর `services`-এ একটা নতুন
-- কম্পোজিট ইউনিক কনস্ট্রেইন্ট যোগ করা মানে একটা কোর টেবিলে হাত দেওয়া —
-- তাই চেকটা এই টেবিলের **নিজের** ট্রিগারে। ট্রিগার সবসময় চলে, এমনকি একটা
-- SECURITY DEFINER ফাংশনের ভেতর থেকেও, তাই গ্যারান্টিটা কম্পোজিট FK-র সমান।
create or replace function public.rewards_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- একটা রিওয়ার্ড কখনো অন্য দোকানে চলে যেতে পারে না।
    new.shop_id    := old.shop_id;
    new.created_at := old.created_at;
  end if;

  if new.service_id is not null then
    if not exists (
      select 1 from public.services s
       where s.id = new.service_id and s.shop_id = new.shop_id
    ) then
      raise exception 'reward_service_wrong_shop';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rewards_before_write on public.rewards;
create trigger rewards_before_write
  before insert or update on public.rewards
  for each row execute function public.rewards_before_write();


-- ---------------------------------------------------------------------------
-- ২) reward_redemptions — ইস্যু করা কুপন, অপরিবর্তনীয় ইতিহাস
-- ---------------------------------------------------------------------------
create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),

  shop_id     uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  -- `restrict`: যে রিওয়ার্ড কেউ রিডিম করেছে সেটা মুছে ইতিহাস অর্থহীন করা যাবে না।
  reward_id   uuid not null references public.rewards(id) on delete restrict,

  -- রিডিমের মুহূর্তের রিওয়ার্ডটা, হুবহু। দোকান পরে দাম/শর্ত বদলালেও এই
  -- কুপনটা নিজে থেকেই ব্যাখ্যাযোগ্য (`services_snapshot`/`tier_snapshot`-এর
  -- একই কনভেনশন)।
  reward_snapshot jsonb not null,

  -- কত পয়েন্ট আসলে কাটা হয়েছে। লেজারের সারিটার সাথে মিলতেই হবে।
  points_spent integer not null check (points_spent > 0),

  -- কাউন্টারে দেখানোর কোড। বড় হাতের অক্ষর আর সংখ্যা, বিভ্রান্তিকর
  -- ০/O/১/I/L বাদ (রেফারেল কোডের একই বর্ণমালা)।
  code text not null check (code ~ '^[A-Z0-9]{6,12}$'),

  -- প্ল্যানের চারটের মধ্যে তিনটে। `CANCELLED` বাদ — Sprint 9-এ কিছুই ওটা
  -- বসায় না, আর যে স্ট্যাটাস কেউ বসাতে পারে না সেটা না থাকার চেয়ে খারাপ
  -- (Sprint 7-এ `REDEEM` kind আর Sprint 8-এ `VOID` বাদ দেওয়ার একই যুক্তি)।
  -- পয়েন্ট ফেরত দেওয়া একটা আলাদা ফিচার, ব্যাকলগে।
  status text not null default 'ISSUED'
    check (status in ('ISSUED', 'USED', 'EXPIRED')),

  issued_at timestamptz not null default now(),

  -- কোন কাজে খরচ হলো। প্ল্যানের (type, id) জোড়া — এখানে পলিমরফিক রাখা
  -- হয়েছে ইচ্ছাকৃতভাবে, কারণ দুটো আলাদা nullable FK হলে `serials`-এ আর
  -- `appointments`-এ দুটো আলাদা কলাম লাগত আর ট্রিগারটা দুবার লিখতে হতো।
  -- ইন্টেগ্রিটি আসে `mark_redemption_used()`-এর চেক থেকে।
  used_at              timestamptz,
  used_on_booking_type text check (used_on_booking_type in ('SERIAL', 'APPOINTMENT')),
  used_on_booking_id   uuid,

  -- বিল থেকে যত টাকা বাদ গেছে। স্ন্যাপশট নয় — **হিসাবের ফলাফল**, তাই
  -- ট্রিগারটা এটাই বিয়োগ করে, রিওয়ার্ডের নিয়ম আবার কষে নয়।
  discount_amount numeric(10, 2) check (discount_amount is null or discount_amount >= 0),

  -- কুপনের মেয়াদ। উৎস একটাই: রিওয়ার্ডের `valid_until`। আলাদা কোনো
  -- "কত দিনে মেয়াদ শেষ" কলাম বানানো হয়নি — প্ল্যানে নেই।
  expires_at timestamptz,

  created_at timestamptz not null default now(),

  -- একটা সারি হয় সম্পূর্ণ ISSUED, নয় সম্পূর্ণ USED (সময় + কাজ + ছাড়, তিনটেই),
  -- নয় EXPIRED — মাঝামাঝি কোনো আকৃতি সম্ভব নয়। তাই "ব্যবহৃত হয়েছে কিন্তু
  -- কোথায় জানা নেই" বা "ছাড় দেওয়া হয়েছে কিন্তু কত জানা নেই" বলে কোনো সারি
  -- থাকতে পারে না।
  constraint reward_redemptions_status_shape check (
    (status = 'ISSUED'
       and used_at is null and used_on_booking_type is null
       and used_on_booking_id is null and discount_amount is null)
    or
    (status = 'USED'
       and used_at is not null and used_on_booking_type is not null
       and used_on_booking_id is not null and discount_amount is not null)
    or
    (status = 'EXPIRED'
       and used_at is null and used_on_booking_type is null
       and used_on_booking_id is null and discount_amount is null)
  )
);

-- ---------------------------------------------------------------------------
-- কোড দোকানের ভেতরে ইউনিক — প্ল্যানের `reward_redemptions_code`
-- ---------------------------------------------------------------------------
-- `(shop_id, code)`, গ্লোবাল নয়। অর্থাৎ A দোকানের কোড B দোকানে **নেই** —
-- যাচাই করতে গেলে "পাওয়া যায়নি", কোনো `if` নয় (প্ল্যানের নামধারী আইসোলেশন
-- টেস্ট)। রেফারেল কোডের ঠিক উল্টো পছন্দ, আর কারণটাও উল্টো: রেফারেল কোড
-- শেয়ার হয়, তাই একটা স্ট্রিং দুজনকে দেখানো চলে না; কুপন কোড শুধু
-- কাউন্টারে পড়া হয়, তাই দোকানের ভেতরে ইউনিক হওয়াই যথেষ্ট আর বেশি বিচ্ছিন্ন।
create unique index if not exists reward_redemptions_code
  on public.reward_redemptions (shop_id, code);

-- মালিকের তালিকা, আর কাস্টমারের নিজের কুপন।
create index if not exists reward_redemptions_shop_idx
  on public.reward_redemptions (shop_id, status, issued_at desc);
create index if not exists reward_redemptions_customer_idx
  on public.reward_redemptions (customer_id, issued_at desc);

-- ---------------------------------------------------------------------------
-- এক কাজে একটাই রিওয়ার্ড — **ডেটাবেসেই**
-- ---------------------------------------------------------------------------
-- প্রি-চেক নয় (সিদ্ধান্ত ৪৩-এর একই যুক্তি)। এটা ছাড়া দুটো কুপন একই বিলে
-- বসিয়ে ছাড় স্ট্যাক করা যেত, আর ট্রিগারের `sum()` দুটোই বিয়োগ করত।
create unique index if not exists reward_redemptions_one_per_booking_idx
  on public.reward_redemptions (used_on_booking_type, used_on_booking_id)
  where used_on_booking_id is not null;

alter table public.reward_redemptions enable row level security;

-- ---------------------------------------------------------------------------
-- **এখানে কোনো INSERT/UPDATE/DELETE পলিসি নেই** (সিদ্ধান্ত ৩২-এর একই যুক্তি)
-- ---------------------------------------------------------------------------
-- কুপন ইস্যু করে শুধু `redeem_reward()`, খরচ করে শুধু
-- `mark_redemption_used()`, মেয়াদ শেষ করে শুধু `expire_redemptions()` —
-- তিনটেই SECURITY DEFINER। তাই কাস্টমার নিজের নামে একটা কুপন বানাতে পারে না,
-- নিজের কুপনকে "ব্যবহৃত" বলতে পারে না, পয়েন্টের খরচ বদলাতে পারে না, আর
-- ইতিহাস মুছতেও পারে না। SELECT-ই একমাত্র সরাসরি অধিকার।
drop policy if exists "reward_redemptions: customer or owner read" on public.reward_redemptions;
create policy "reward_redemptions: customer or owner read" on public.reward_redemptions
  for select
  using (customer_id = auth.uid() or public.is_shop_owner(shop_id));

-- ---------------------------------------------------------------------------
-- ইতিহাস জমাট — DEFINER ফাংশনগুলোর জন্যও
-- ---------------------------------------------------------------------------
-- উপরে কোনো UPDATE পলিসি নেই, তাই ক্লায়েন্ট এখানে পৌঁছায়ই না। এটা তার
-- **উপরের** স্তর: ভবিষ্যতের কোনো DEFINER ফাংশনও যাতে একটা খরচ হয়ে যাওয়া
-- কুপন ফিরিয়ে আনতে বা পয়েন্টের অঙ্ক বদলাতে না পারে।
create or replace function public.reward_redemptions_freeze()
returns trigger
language plpgsql
as $$
begin
  new.id              := old.id;
  new.shop_id         := old.shop_id;
  new.customer_id     := old.customer_id;
  new.reward_id       := old.reward_id;
  new.reward_snapshot := old.reward_snapshot;
  new.points_spent    := old.points_spent;
  new.code            := old.code;
  new.issued_at       := old.issued_at;
  new.expires_at      := old.expires_at;
  new.created_at      := old.created_at;

  if old.status = 'USED' then
    -- খরচ চূড়ান্ত। পয়েন্ট কাটা হয়ে গেছে, বিল থেকে টাকা বাদ গেছে —
    -- পিছিয়ে যাওয়ার কোনো সৎ উপায় নেই।
    if new.status is distinct from 'USED' then
      raise exception 'redemption_use_is_final';
    end if;
    new.used_at              := old.used_at;
    new.used_on_booking_type := old.used_on_booking_type;
    new.used_on_booking_id   := old.used_on_booking_id;
    new.discount_amount      := old.discount_amount;
  elsif old.status = 'EXPIRED' then
    if new.status is distinct from 'EXPIRED' then
      raise exception 'redemption_expiry_is_final';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reward_redemptions_freeze on public.reward_redemptions;
create trigger reward_redemptions_freeze
  before update on public.reward_redemptions
  for each row execute function public.reward_redemptions_freeze();


-- ---------------------------------------------------------------------------
-- ৩) loyalty_transactions — খরচও **একই লেজারে**
-- ---------------------------------------------------------------------------
-- Sprint 7 ইচ্ছাকৃতভাবে `REDEEM` kind যোগ করেনি, এই কারণে: "যে kind কিছুই
-- honour করতে পারে না সেটা না থাকার চেয়ে খারাপ"। Sprint 9-ই সেই honour
-- করার স্প্রিন্ট, তাই kind-টা এখন আসছে — এটা একটা সংশোধন নয়, পরিকল্পিত
-- ধারাবাহিকতা।
alter table public.loyalty_transactions
  add column if not exists source_redemption_id uuid
    references public.reward_redemptions(id) on delete set null;

-- `drop ... if exists` + `add` — কনস্ট্রেইন্ট বদলানোর একমাত্র উপায়, আর এটা
-- সম্প্রসারণ: পুরনো পাঁচটা মান এখনো বৈধ, তাই কোনো বিদ্যমান সারি এই ALTER-এ
-- ব্যর্থ হতে পারে না।
alter table public.loyalty_transactions
  drop constraint if exists loyalty_transactions_kind_check;
alter table public.loyalty_transactions
  add constraint loyalty_transactions_kind_check
  check (kind in (
    'EARN_SERIAL', 'EARN_APPOINTMENT', 'ADJUST',
    'REFERRAL_REFERRER', 'REFERRAL_REFERRED',
    'REDEEM'                -- পয়েন্ট খরচ — সবসময় ঋণাত্মক, নিচের CHECK দেখো
  ));

-- উৎস আর kind-এর মিল — আগের চারটে শাখা হুবহু অপরিবর্তিত, একটা নতুন যোগ।
alter table public.loyalty_transactions
  drop constraint if exists loyalty_tx_source_matches_kind;
alter table public.loyalty_transactions
  add constraint loyalty_tx_source_matches_kind check (
    (kind = 'EARN_SERIAL'
       and source_serial_id is not null
       and source_appointment_id is null
       and source_referral_id is null
       and source_redemption_id is null)
    or
    (kind = 'EARN_APPOINTMENT'
       and source_appointment_id is not null
       and source_serial_id is null
       and source_referral_id is null
       and source_redemption_id is null)
    or
    (kind = 'ADJUST'
       and source_serial_id is null
       and source_appointment_id is null
       and source_referral_id is null
       and source_redemption_id is null)
    or
    (kind in ('REFERRAL_REFERRER', 'REFERRAL_REFERRED')
       and source_referral_id is not null
       and source_serial_id is null
       and source_appointment_id is null
       and source_redemption_id is null)
    or
    (kind = 'REDEEM'
       and source_redemption_id is not null
       and source_serial_id is null
       and source_appointment_id is null
       and source_referral_id is null)
  );

-- খরচের সারি সবসময় ঋণাত্মক, জমার সারি সবসময় ধনাত্মক। এটা ছাড়া একটা
-- `REDEEM` সারি পয়েন্ট **বাড়িয়ে** দিতে পারত।
alter table public.loyalty_transactions
  drop constraint if exists loyalty_tx_redeem_is_negative;
alter table public.loyalty_transactions
  add constraint loyalty_tx_redeem_is_negative check (
    (kind = 'REDEEM' and points < 0) or (kind <> 'REDEEM')
  );

-- এক কুপনে একবারই পয়েন্ট কাটা — Sprint 7/8-এর per-source ইনডেক্সের একই ভূমিকা।
create unique index if not exists loyalty_tx_one_per_redemption_idx
  on public.loyalty_transactions (source_redemption_id)
  where source_redemption_id is not null;


-- ---------------------------------------------------------------------------
-- ৪) reward_discount_for — ছাড়ের একটাই সূত্র, একটাই জায়গা
-- ---------------------------------------------------------------------------
-- IMMUTABLE, তাই RPC আর ট্রিগার দুজনেই নিশ্চিন্তে ডাকে। হুবহু এই সূত্রের
-- নকল আছে `src/features/rewards/lib/rewards.ts`-এ, UI-র প্রিভিউয়ের জন্য —
-- দুটো একসাথে বদলাতে হবে (`points_for_bill`-এর একই ব্যবস্থা)।
--
-- ছাড় কখনো বিলের চেয়ে বেশি নয়: `least(..., p_total)`। নইলে একটা ৳৫০০ ফ্ল্যাট
-- ছাড় ৳৩০০-র বিলে ঋণাত্মক বিল বানাত, অর্থাৎ দোকান টাকা ফেরত দিত।
create or replace function public.reward_discount_for(
  p_kind       text,
  p_value      numeric,
  p_service_id uuid,
  p_total      numeric,
  p_snapshot   jsonb
)
returns numeric
language sql
immutable
as $$
  -- `numeric(10,2)` বাইরে একবারই — নইলে একেকটা শাখা একেক স্কেলে ফিরত
  -- (`least(100, 800)` দেয় `100`, আর `round(..., 2)` দেয় `85.00`), আর
  -- `discount_amount` কলামটা `numeric(10,2)`। এক জায়গায় কাস্ট মানে UI-তে
  -- আর টেস্টে সবসময় একই আকৃতি।
  select (case
    when p_total is null or p_total <= 0 then 0::numeric
    when p_kind = 'DISCOUNT_FLAT' then
      least(greatest(coalesce(p_value, 0), 0), p_total)
    when p_kind = 'DISCOUNT_PCT' then
      least(round(p_total * least(greatest(coalesce(p_value, 0), 0), 100) / 100, 2), p_total)
    when p_kind = 'FREE_SERVICE' then
      -- দাম আসে **বুকিংয়ের নিজের স্ন্যাপশট** থেকে, সার্ভিসের চলতি রেট থেকে
      -- নয় — কাস্টমারকে যে দাম বলা হয়েছিল সেটাই ছাড়ের অঙ্ক।
      least(
        coalesce((
          select max((e->>'rate')::numeric)
            from jsonb_array_elements(coalesce(p_snapshot, '[]'::jsonb)) e
           where e->>'service_id' = p_service_id::text
        ), 0),
        p_total
      )
    else 0::numeric
  end)::numeric(10, 2);
$$;

comment on function public.reward_discount_for(text, numeric, uuid, numeric, jsonb) is
  'Taka off a bill for one reward. Never more than the bill itself. '
  'FREE_SERVICE reads the rate from the booking''s own services_snapshot. '
  'Mirrored in src/features/rewards/lib/rewards.ts — change both together.';


-- ---------------------------------------------------------------------------
-- ৫) redeem_reward — পয়েন্ট খরচের একমাত্র দরজা, এক ট্রানজেকশনে
-- ---------------------------------------------------------------------------
-- **এই স্প্রিন্টের সবচেয়ে গুরুত্বপূর্ণ ফাংশন।** সবটা একটা ট্রানজেকশনে:
-- ব্যালেন্স দেখা, স্টক কমানো, কুপন ইস্যু, লেজারে খরচ, ব্যালেন্স কমানো।
-- একটা ধাপ ব্যর্থ হলে **কিছুই থাকে না** — পয়েন্টও যায় না, অনাথ কুপনও থাকে না।
--
-- SECURITY DEFINER, কারণ `loyalty_accounts`/`loyalty_transactions`-এ কারো
-- INSERT/UPDATE পলিসি নেই (সিদ্ধান্ত ৩২), আর `reward_redemptions`-এও নেই।
-- `auth.uid()` **হার্ডকোড** — কাস্টমার প্যারামিটারে নেওয়া হয় না, তাই অন্য
-- কারো পয়েন্ট খরচ করার কোনো উপায়ও নেই।
--
-- **লকের ক্রম সবসময় এক:** রিওয়ার্ড → অ্যাকাউন্ট। তাই দুটো সমান্তরাল রিডিম
-- সারিবদ্ধ হয়, ডেডলক হয় না। দ্বিতীয়টা অপেক্ষা করে, তারপর কমে যাওয়া
-- ব্যালেন্স দেখে — আর `balance >= 0` CHECK শেষ রক্ষাকবচ।
create or replace function public.redeem_reward(
  p_shop_id   uuid,
  p_reward_id uuid
)
returns table (
  redemption_id uuid,
  redemption_code text,
  points_spent integer,
  balance_after integer,
  valid_until timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  -- রেফারেল কোডের একই বর্ণমালা: বিভ্রান্তিকর 0/O/1/I/L বাদ, কারণ কোডটা
  -- কাউন্টারে মুখে বলা হবে আর হাতে টাইপ হবে।
  k_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_me      uuid := auth.uid();
  r         public.rewards%rowtype;
  v_balance integer;
  v_code    text;
  v_id      uuid;
begin
  if v_me is null then
    raise exception 'reward_requires_login';
  end if;

  -- ---- ১–৪: কাস্টমার, দোকান, রিওয়ার্ডের মালিকানা, সক্রিয়তা ----
  -- `and shop_id = p_shop_id` এখানেই আইসোলেশনের প্রথম স্তর: অন্য দোকানের
  -- রিওয়ার্ড এই দোকানে "নিষিদ্ধ" নয়, **অস্তিত্বহীন**।
  select * into r
    from public.rewards
   where id = p_reward_id and shop_id = p_shop_id
   for update;

  if r.id is null then
    raise exception 'reward_not_found';
  end if;

  if not r.is_active then
    raise exception 'reward_inactive';
  end if;

  if r.valid_until is not null and r.valid_until < now() then
    raise exception 'reward_offer_expired';
  end if;

  -- ---- ৫: স্টক ----
  if r.stock is not null and r.stock <= 0 then
    raise exception 'reward_out_of_stock';
  end if;

  -- ---- ৬–৭: **সেই দোকানের** ব্যালেন্স, লক করে ----
  select balance into v_balance
    from public.loyalty_accounts
   where shop_id = p_shop_id and customer_id = v_me
   for update;

  if v_balance is null or v_balance < r.points_cost then
    raise exception 'reward_insufficient_points';
  end if;

  if r.stock is not null then
    update public.rewards
       set stock = stock - 1
     where id = r.id;
  end if;

  -- ---- ৯: কুপন ----
  -- ৩১^৬ ≈ ৮৮ কোটি, আর ইউনিকনেস দোকানের ভেতরে — সংঘর্ষ বিরল, কিন্তু
  -- "বিরল" মানে "কখনো নয়" নয়। প্রি-চেক নয়: ইনডেক্সই বিচারক।
  for _attempt in 1..20 loop
    v_code := '';
    for _i in 1..6 loop
      v_code := v_code || substr(k_alphabet, 1 + floor(random() * length(k_alphabet))::int, 1);
    end loop;

    begin
      insert into public.reward_redemptions (
        shop_id, customer_id, reward_id, reward_snapshot,
        points_spent, code, expires_at
      ) values (
        p_shop_id, v_me, r.id,
        jsonb_build_object(
          'name',        r.name,
          'description', r.description,
          'kind',        r.kind,
          'value',       r.value,
          'service_id',  r.service_id,
          'points_cost', r.points_cost
        ),
        r.points_cost, v_code, r.valid_until
      )
      returning id into v_id;
      exit;
    exception
      when unique_violation then
        v_id := null;      -- কোডের সংঘর্ষ, আবার চেষ্টা
    end;
  end loop;

  if v_id is null then
    raise exception 'reward_code_generation_failed';
  end if;

  -- ---- ৮: **লেজারের ভেতর দিয়েই** পয়েন্ট কাটা ----
  -- লেজার আগে, ব্যালেন্স পরে — `loyalty_award()`-এর হুবহু একই শৃঙ্খলা
  -- (সিদ্ধান্ত ৫৬)। ইউনিক ইনডেক্স বা CHECK আটকালে পুরো ফাংশন ব্যর্থ হয় আর
  -- ব্যালেন্সে হাত পড়ে না, তাই দুটো কখনো আলাদা হতে পারে না।
  insert into public.loyalty_transactions (
    shop_id, customer_id, points, kind, source_redemption_id, created_by
  ) values (
    p_shop_id, v_me, -r.points_cost, 'REDEEM', v_id, v_me
  );

  update public.loyalty_accounts
     set balance    = balance - r.points_cost,
         -- `lifetime_earned` ছোঁয়া হয় না: খরচ করা মানে কামানোটা মিথ্যে হয়ে
         -- যাওয়া নয় (Sprint 7-এর কমেন্ট)।
         updated_at = now()
   where shop_id = p_shop_id and customer_id = v_me
  returning balance into v_balance;

  -- ---- ১০: UI-র যা দরকার ----
  return query select v_id, v_code, r.points_cost, v_balance, r.valid_until;
end;
$$;

comment on function public.redeem_reward(uuid, uuid) is
  'The only door for spending points. One transaction: balance check, stock, '
  'coupon, ledger, balance. auth.uid() is hard-coded, so nobody can spend '
  'anyone else''s points. Locks reward then account, always in that order.';


-- ---------------------------------------------------------------------------
-- ৬) mark_redemption_used — মালিকের যাচাই ও "ব্যবহৃত" চিহ্ন
-- ---------------------------------------------------------------------------
-- মালিক ছাড়া কেউ পারে না, আর **কাস্টমার নিজের কুপন নিজে খরচ করতে পারে না** —
-- নইলে কুপনটা দেখানোর আগেই "ব্যবহৃত" করে ফেলা যেত, আর কাউন্টারে যাচাইয়ের
-- কোনো মানে থাকত না।
--
-- অন্য দোকানের কোড এখানে "ভুল" নয়, **অস্তিত্বহীন**: খোঁজাটাই
-- `where shop_id = p_shop_id and code = ...` (প্ল্যানের নামধারী আইসোলেশন
-- টেস্ট — "A-র কোড B দোকানে যাচাই করলে পাওয়া যায়নি")।
create or replace function public.mark_redemption_used(
  p_shop_id      uuid,
  p_code         text,
  p_booking_type text,
  p_booking_id   uuid
)
returns table (
  redemption_id   uuid,
  reward_name     text,
  discount_amount numeric,
  bill_before     numeric,
  bill_after      numeric
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  d          public.reward_redemptions%rowtype;
  v_code     text := upper(btrim(coalesce(p_code, '')));
  v_customer uuid;
  v_total    numeric;
  v_snapshot jsonb;
  v_kind     text;
  v_service  uuid;
  v_disc     numeric;
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'not your shop';
  end if;

  if p_booking_type is null or p_booking_type not in ('SERIAL', 'APPOINTMENT') then
    raise exception 'redemption_booking_type_invalid';
  end if;

  if v_code = '' then
    raise exception 'redemption_code_invalid';
  end if;

  select * into d
    from public.reward_redemptions
   where shop_id = p_shop_id and code = v_code
   for update;

  if d.id is null then
    raise exception 'redemption_not_found';
  end if;

  if d.status = 'USED' then
    raise exception 'redemption_already_used';
  end if;

  if d.status = 'EXPIRED' then
    raise exception 'redemption_expired';
  end if;

  -- মেয়াদ এখানেই দেখা হয়, `expire_redemptions()`-এর রাতের ঝাড়ুর অপেক্ষায়
  -- নয় — নইলে মেয়াদোত্তীর্ণ একটা কুপন সকালে কাজ করত। স্ট্যাটাসটা এখানে
  -- বসানো হয় না ইচ্ছাকৃতভাবে: এই raise পুরো ট্রানজেকশন ফিরিয়ে নেয়, তাই
  -- লেখাটা টিকত না। রাতের ঝাড়ুই খাতাটা মেলায়।
  if d.expires_at is not null and d.expires_at < now() then
    raise exception 'redemption_expired';
  end if;

  -- ---- কাজটা এই দোকানের, আর এই কাস্টমারেরই ----
  if p_booking_type = 'SERIAL' then
    select customer_id, total_amount, services_snapshot
      into v_customer, v_total, v_snapshot
      from public.serials
     where id = p_booking_id and shop_id = p_shop_id;
  else
    select customer_id, total_amount, services_snapshot
      into v_customer, v_total, v_snapshot
      from public.appointments
     where id = p_booking_id and shop_id = p_shop_id;
  end if;

  if v_total is null then
    raise exception 'redemption_booking_not_found';
  end if;

  -- রুমির কুপন নাদিয়ার বিলে বসানো যাবে না।
  if v_customer is null or v_customer is distinct from d.customer_id then
    raise exception 'redemption_wrong_customer';
  end if;

  v_kind    := d.reward_snapshot->>'kind';
  v_service := nullif(d.reward_snapshot->>'service_id', '')::uuid;

  -- একটা ফ্রি-ফেসিয়াল কুপন এমন বিলে বসতে পারে না যেখানে ফেসিয়াল নেই।
  if v_kind = 'FREE_SERVICE' and not exists (
    select 1
      from jsonb_array_elements(coalesce(v_snapshot, '[]'::jsonb)) e
     where e->>'service_id' = v_service::text
  ) then
    raise exception 'redemption_service_not_in_booking';
  end if;

  v_disc := public.reward_discount_for(
    v_kind,
    nullif(d.reward_snapshot->>'value', '')::numeric,
    v_service,
    v_total,
    v_snapshot
  );

  -- `and status = 'ISSUED'` — `for update` ইতিমধ্যেই সারিবদ্ধ করেছে, এটা
  -- তার উপরের স্তর: দুটো সমান্তরাল যাচাইয়ের মধ্যে ঠিক একটা টেকে।
  -- `reward_redemptions_one_per_booking_idx` এখানে আটকালে বোঝা যায় ওই
  -- বিলে আগেই একটা কুপন বসেছে।
  update public.reward_redemptions
     set status               = 'USED',
         used_at              = now(),
         used_on_booking_type = p_booking_type,
         used_on_booking_id   = p_booking_id,
         discount_amount      = v_disc
   where id = d.id and status = 'ISSUED';

  if not found then
    raise exception 'redemption_already_used';
  end if;

  return query
    select d.id,
           d.reward_snapshot->>'name',
           v_disc,
           v_total,
           greatest(0::numeric, v_total - v_disc);
end;
$$;

comment on function public.mark_redemption_used(uuid, text, text, uuid) is
  'Owner-only verification of a coupon against one booking. A customer cannot '
  'consume their own coupon. Records the discount on the redemption; the bill '
  'itself is reduced by the zz_reward_discount trigger at DONE.';


-- ---------------------------------------------------------------------------
-- ৭) expire_redemptions — রাতের ঝাড়ু
-- ---------------------------------------------------------------------------
-- `expire_memberships()`-এর হুবহু একই ভূমিকা আর একই জায়গা: বিদ্যমান
-- `/api/cron/nightly`-তে আরেকটা RPC কল, **কোনো নতুন cron নয়** (সিদ্ধান্ত ৩৫)।
-- এটা না চললেও মেয়াদোত্তীর্ণ কুপন কাজ করে না — `mark_redemption_used()`
-- নিজেই দেখে। এটা শুধু খাতাটা মেলায়।
create or replace function public.expire_redemptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.reward_redemptions
       set status = 'EXPIRED'
     where status = 'ISSUED'
       and expires_at is not null
       and expires_at < now()
    returning 1
  )
  select count(*) into v_count from expired;

  return coalesce(v_count, 0);
end;
$$;


-- ---------------------------------------------------------------------------
-- ৮) my_redemptions — কাস্টমারের কুপনগুলো
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, কারণ প্রতিটা কুপনের সাথে দোকানের নাম-লোগো লাগে আর
-- কাস্টমার `shops`-এ join করতে পারে না RLS-এর নিচে। `customer_id =
-- auth.uid()` হার্ডকোড, প্যারামিটার নেই — তাই অন্য কারো কুপন চাওয়ার কোনো
-- উপায়ও নেই (`my_loyalty_accounts()`-এর একই প্যাটার্ন)।
--
-- সিদ্ধান্ত ৩৩-এর ধারাবাহিকতা: **তালিকা, যোগফল নয়।** প্রতিটা সারিতে দোকানের
-- নাম আছে, যাতে "এই কুপন কোথায় চলবে" প্রশ্নই না ওঠে।
create or replace function public.my_redemptions()
returns table (
  id              uuid,
  shop_id         uuid,
  shop_name       text,
  shop_logo_url   text,
  reward_name     text,
  reward_kind     text,
  redemption_code text,
  status          text,
  points_spent    integer,
  discount_amount numeric,
  issued_at       timestamptz,
  used_at         timestamptz,
  expires_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.shop_id,
    s.name,
    s.logo_url,
    d.reward_snapshot->>'name',
    d.reward_snapshot->>'kind',
    d.code,
    d.status,
    d.points_spent,
    d.discount_amount,
    d.issued_at,
    d.used_at,
    d.expires_at
  from public.reward_redemptions d
  join public.shops s on s.id = d.shop_id
 where d.customer_id = auth.uid()
 -- যেটা এখনো ব্যবহার করা যায় সেটা আগে — বাকিটা ইতিহাস।
 order by (d.status = 'ISSUED') desc, d.issued_at desc;
$$;

comment on function public.my_redemptions is
  'The signed-in customer''s coupons, one row per redemption, each carrying '
  'its shop''s name so "where does this work" is never a question. '
  'auth.uid() is hard-coded.';


-- ---------------------------------------------------------------------------
-- ৯) DONE → বিল থেকে ছাড় বাদ, দুটো টেবিলেই
-- ---------------------------------------------------------------------------
-- **BEFORE UPDATE**, আর নাম `zz_` দিয়ে শুরু — দুটোই ইচ্ছাকৃত। Postgres একই
-- ইভেন্টের ট্রিগার নামের বর্ণানুক্রমে চালায়, তাই এটা
-- `serials_before_update` আর `appointments_before_update`-এর **পরে** চলে,
-- আর ওদের জমাট-করা `total_amount`-এর উপর ছাড়টা বিয়োগ করতে পারে।
-- কোর ট্রিগার দুটোর একটাও বদলানো হয়নি (সিদ্ধান্ত ৬৩)।
--
-- একটাই ফাংশন, দুটো টেবিলে, `tg_table_name` দিয়ে জানে সে কোথায় —
-- `loyalty_after_done`/`referral_after_done`-এর একই প্যাটার্ন।
create or replace function public.reward_apply_discount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_disc numeric := 0;
begin
  -- শুধু DONE-এ ঢোকার মুহূর্তে। DONE সারির পরের যেকোনো আপডেটে (বাকি কালেক্ট,
  -- রিমাইন্ডার) status অপরিবর্তিত, তাই ছাড় দুবার বসতে পারে না।
  if new.status is distinct from 'DONE' or old.status is not distinct from 'DONE' then
    return new;
  end if;

  begin
    select coalesce(sum(rr.discount_amount), 0) into v_disc
      from public.reward_redemptions rr
     where rr.shop_id = new.shop_id
       and rr.status = 'USED'
       and rr.used_on_booking_type =
             case when tg_table_name = 'serials' then 'SERIAL' else 'APPOINTMENT' end
       and rr.used_on_booking_id = new.id;

    if coalesce(v_disc, 0) > 0 then
      new.total_amount := greatest(0::numeric, new.total_amount - v_disc);
      -- বাকি রাখলে বাকির অঙ্ক বিলের চেয়ে বেশি হতে পারে না। শুধু নামানো হয়,
      -- কখনো বাড়ানো নয়।
      if new.payment_status = 'DUE' then
        new.due_amount := least(coalesce(new.due_amount, 0), new.total_amount);
      end if;
    end if;
  exception
    when others then
      -- সিদ্ধান্ত ৫৫-এর ধারাবাহিকতা: একটা ঐচ্ছিক ফিচারের ব্যর্থতায় কাউন্টারে
      -- দাঁড়ানো দোকানদার আটকে যেতে পারে না। ছাড় না বসলেও USED রিডেম্পশন
      -- সারিটা থেকে যায় — অর্থাৎ কত টাকা পাওনা ছিল তার হিসাব হারায় না।
      raise warning 'reward discount skipped for % %: %', tg_table_name, new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists serials_zz_reward_discount on public.serials;
create trigger serials_zz_reward_discount
  before update of status on public.serials
  for each row execute function public.reward_apply_discount();

drop trigger if exists appointments_zz_reward_discount on public.appointments;
create trigger appointments_zz_reward_discount
  before update of status on public.appointments
  for each row execute function public.reward_apply_discount();


-- ===========================================================================
-- যাচাই — মাইগ্রেশনের পর আনকমেন্ট করে চালাও। সব ok = true হওয়া চাই।
-- ===========================================================================
--
-- select * from (values
--   ('rewards exists',            to_regclass('public.rewards') is not null),
--   ('reward_redemptions exists', to_regclass('public.reward_redemptions') is not null),
--   ('rewards RLS on',
--    (select relrowsecurity from pg_class where oid='public.rewards'::regclass)),
--   ('redemptions RLS on',
--    (select relrowsecurity from pg_class where oid='public.reward_redemptions'::regclass)),
--   ('2 rewards policies', (select count(*) from pg_policies where tablename='rewards') = 2),
--
--   -- অপরিবর্তনীয় ইতিহাস: ইস্যু/খরচ শুধু DEFINER RPC-তে
--   ('redemptions has exactly 1 policy, and it is SELECT',
--    (select count(*) from pg_policies where tablename='reward_redemptions') = 1
--    and (select cmd from pg_policies where tablename='reward_redemptions') = 'SELECT'),
--   ('redemptions has NO insert policy',
--    not exists (select 1 from pg_policies where tablename='reward_redemptions' and cmd='INSERT')),
--   ('redemptions has NO update policy',
--    not exists (select 1 from pg_policies where tablename='reward_redemptions' and cmd='UPDATE')),
--   ('redemptions has NO delete policy',
--    not exists (select 1 from pg_policies where tablename='reward_redemptions' and cmd='DELETE')),
--   ('history freeze trigger',
--    exists (select 1 from pg_trigger where tgname='reward_redemptions_freeze')),
--   ('cross-shop service guard trigger',
--    exists (select 1 from pg_trigger where tgname='rewards_before_write')),
--
--   -- কনস্ট্রেইন্ট ও ইনডেক্স
--   ('value matches kind constraint',
--    exists (select 1 from pg_constraint where conname='rewards_value_matches_kind')),
--   ('redemption status shape constraint',
--    exists (select 1 from pg_constraint where conname='reward_redemptions_status_shape')),
--   ('code unique per shop',
--    exists (select 1 from pg_indexes where indexname='reward_redemptions_code')),
--   ('one reward per booking',
--    exists (select 1 from pg_indexes where indexname='reward_redemptions_one_per_booking_idx')),
--   ('reward name unique per shop',
--    exists (select 1 from pg_indexes where indexname='rewards_shop_name_idx')),
--   ('only three redemption statuses (no CANCELLED)',
--    (select pg_get_constraintdef(oid) from pg_constraint
--      where conname='reward_redemptions_status_check') not like '%CANCELLED%'),
--   ('no Postgres enum type was created (decision 45)',
--    (select count(*) from pg_type
--      where typname in ('reward_kind','redemption_status') and typtype='e') = 0),
--
--   -- Sprint 7-এর লেজারই ব্যবহার হচ্ছে, সমান্তরাল কিছু নয়
--   ('no separate points/balance table was created',
--    to_regclass('public.reward_points') is null
--    and to_regclass('public.reward_accounts') is null
--    and to_regclass('public.reward_balances') is null
--    and to_regclass('public.point_balances') is null),
--   ('ledger gained source_redemption_id',
--    exists (select 1 from information_schema.columns
--             where table_name='loyalty_transactions' and column_name='source_redemption_id')),
--   ('ledger kind now allows REDEEM',
--    (select pg_get_constraintdef(oid) from pg_constraint
--      where conname='loyalty_transactions_kind_check') like '%REDEEM%'),
--   ('the five older kinds are still allowed',
--    (select pg_get_constraintdef(oid) from pg_constraint
--      where conname='loyalty_transactions_kind_check') like '%EARN_SERIAL%'
--    and (select pg_get_constraintdef(oid) from pg_constraint
--          where conname='loyalty_transactions_kind_check') like '%REFERRAL_REFERRER%'),
--   ('a REDEEM row must be negative',
--    exists (select 1 from pg_constraint where conname='loyalty_tx_redeem_is_negative')),
--   ('one ledger row per redemption',
--    exists (select 1 from pg_indexes where indexname='loyalty_tx_one_per_redemption_idx')),
--   ('loyalty_accounts still has exactly 1 policy',
--    (select count(*) from pg_policies where tablename='loyalty_accounts') = 1),
--
--   -- RPC
--   ('reward_discount_for is IMMUTABLE',
--    (select provolatile from pg_proc
--      where oid='public.reward_discount_for(text,numeric,uuid,numeric,jsonb)'::regprocedure) = 'i'),
--   ('redeem_reward exists and is DEFINER',
--    (select prosecdef from pg_proc where oid='public.redeem_reward(uuid,uuid)'::regprocedure)),
--   ('mark_redemption_used exists and is DEFINER',
--    (select prosecdef from pg_proc
--      where oid='public.mark_redemption_used(uuid,text,text,uuid)'::regprocedure)),
--   ('expire_redemptions exists and is DEFINER',
--    (select prosecdef from pg_proc where oid='public.expire_redemptions()'::regprocedure)),
--   ('my_redemptions exists and is DEFINER',
--    (select prosecdef from pg_proc where oid='public.my_redemptions()'::regprocedure)),
--
--   -- ট্রিগার দুটোই আছে, আর দুটোই BEFORE (কোর ট্রিগারের পরে নামের ক্রমে)
--   ('serials discount trigger exists',
--    exists (select 1 from pg_trigger where tgname='serials_zz_reward_discount')),
--   ('appointments discount trigger exists',
--    exists (select 1 from pg_trigger where tgname='appointments_zz_reward_discount')),
--   ('both discount triggers are BEFORE',
--    (select count(*) from pg_trigger
--      where tgname in ('serials_zz_reward_discount','appointments_zz_reward_discount')
--        and (tgtype & 2) = 2) = 2),
--   ('core before-triggers run first (name order)',
--    'appointments_before_update' < 'appointments_zz_reward_discount'
--    and 'serials_before_update' < 'serials_zz_reward_discount'),
--
--   -- কোনো দোকানে রিওয়ার্ড সিড করা হয়নি
--   ('no reward was seeded',     (select count(*) from public.rewards) = 0),
--   ('no redemption was seeded', (select count(*) from public.reward_redemptions) = 0),
--
--   -- ব্যালেন্স = লেজারের যোগফল, খরচের কলাম যোগ করার পরেও
--   ('balance still equals ledger sum everywhere',
--    not exists (
--      select 1 from public.loyalty_accounts a
--       where a.balance <> coalesce((select sum(t.points) from public.loyalty_transactions t
--                                     where t.shop_id=a.shop_id and t.customer_id=a.customer_id), 0))),
--
--   -- আগের স্প্রিন্টগুলো অক্ষত — একটাও ফাংশন replace হয়নি
--   ('loyalty_award untouched',
--    to_regprocedure('public.loyalty_award(uuid,uuid,integer,text,uuid,uuid,numeric,integer,text)') is not null),
--   ('loyalty_adjust untouched',
--    to_regprocedure('public.loyalty_adjust(uuid,uuid,integer,text)') is not null),
--   ('points_for_bill untouched',
--    to_regprocedure('public.points_for_bill(numeric,integer,numeric)') is not null),
--   ('my_loyalty_accounts untouched', to_regprocedure('public.my_loyalty_accounts()') is not null),
--   ('claim_referral untouched', to_regprocedure('public.claim_referral(uuid,text)') is not null),
--   ('referral_convert untouched',
--    to_regprocedure('public.referral_convert(uuid,uuid,uuid)') is not null),
--   ('my_referral_code untouched', to_regprocedure('public.my_referral_code(uuid)') is not null),
--   ('membership_is_active untouched',
--    to_regprocedure('public.membership_is_active(uuid,uuid)') is not null),
--   ('loyalty + referral triggers untouched',
--    exists (select 1 from pg_trigger where tgname='serials_zz_loyalty_award')
--    and exists (select 1 from pg_trigger where tgname='appointments_zz_loyalty_award')
--    and exists (select 1 from pg_trigger where tgname='serials_zz_referral_convert')
--    and exists (select 1 from pg_trigger where tgname='appointments_zz_referral_convert')),
--   ('core queue/appointment triggers untouched',
--    exists (select 1 from pg_trigger where tgname='serials_before_update')
--    and exists (select 1 from pg_trigger where tgname='serials_after_update')
--    and exists (select 1 from pg_trigger where tgname='appointments_before_update')
--    and exists (select 1 from pg_trigger where tgname='appointments_after_update')),
--   ('appointment overlap constraint still there',
--    exists (select 1 from pg_constraint where conname='appointments_no_overlap')),
--   ('5 appointment policies still there',
--    (select count(*) from pg_policies where tablename='appointments') = 5),
--   ('5 membership policies still there',
--    (select count(*) from pg_policies where tablename='customer_memberships') = 5),
--   ('referral policies still there',
--    (select count(*) from pg_policies where tablename='referrals') = 1
--    and (select count(*) from pg_policies where tablename='referral_codes') = 1),
--   ('nightly RPCs all still there, and the new one is present',
--    to_regprocedure('public.send_daily_summaries(date)') is not null
--    and to_regprocedure('public.send_customer_reminders()') is not null
--    and to_regprocedure('public.send_appointment_reminders(integer)') is not null
--    and to_regprocedure('public.expire_memberships()') is not null
--    and to_regprocedure('public.expire_redemptions()') is not null),
--   ('no reward column landed on serials',
--    (select count(*) from information_schema.columns
--      where table_name='serials' and (column_name like '%reward%' or column_name like '%redem%')) = 0),
--   ('no reward column landed on appointments',
--    (select count(*) from information_schema.columns
--      where table_name='appointments' and (column_name like '%reward%' or column_name like '%redem%')) = 0),
--   ('no column landed on services',
--    (select count(*) from information_schema.columns
--      where table_name='services' and (column_name like '%reward%' or column_name like '%redem%')) = 0)
-- ) as t(check_name, ok) order by ok, check_name;
--
--
-- ---------------------------------------------------------------------------
-- আচরণগত প্রোব — নিজে থেকেই ROLLBACK হয়, কোনো সারি থাকে না
-- ---------------------------------------------------------------------------
-- Sprint 6/7/8-এর প্রোবের মতোই: শেষ কাজটা `raise exception`, তাই DO ব্লকটা
-- সবসময় নিজের সব লেখা ফিরিয়ে নেয়। সম্পূর্ণ প্রোব SQL রিপোর্টে আলাদা করে
-- দেওয়া আছে — ওটা চালালে দেখা যায়:
--   · পয়েন্ট যথেষ্ট হলে রিডিম হয়, লেজারে একটা ঋণাত্মক `REDEEM` সারি বসে
--   · **ব্যালেন্স = লেজারের যোগফল**, রিডিমের পরেও
--   · পয়েন্ট কম হলে `reward_insufficient_points`, আর ব্যালেন্স অপরিবর্তিত
--   · বন্ধ রিওয়ার্ড, অন্য দোকানের রিওয়ার্ড, স্টক শেষ — তিনটেই refuse
--   · কাস্টমার নিজের কুপন "ব্যবহৃত" করতে পারে না
--   · A দোকানের কোড B দোকানে `redemption_not_found`
--   · একবার ব্যবহৃত কুপন দ্বিতীয়বার চলে না
--   · DONE হলে বিল থেকে ছাড় বাদ যায় — সিরিয়ালে **আর** অ্যাপয়েন্টমেন্টে
--   · সরাসরি `insert into reward_redemptions` **কোনো কাজ করে না**
