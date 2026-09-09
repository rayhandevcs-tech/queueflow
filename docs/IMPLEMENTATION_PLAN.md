# ফেজ ৬ — পার্লার, অ্যাপয়েন্টমেন্ট, মেম্বারশিপ ও লয়্যালটি

> **এটা কী:** `DEVELOPMENT.md`-এর ৩গ ধারায় ফেজ ৫-এর যে **স্কেচ** ছিল, এটা তার সম্পূর্ণ,
> কার্যকর প্ল্যান — Sprint তালিকা, নির্ভরতা, ডেটাবেস/API/UI পরিবর্তন, ঝুঁকি ও ব্যাকলগ সহ।
>
> **সোর্স অব ট্রুথ অপরিবর্তিত:** `DEVELOPMENT.md` এখনো পুরো প্রজেক্টের একমাত্র সোর্স অব ট্রুথ
> (`AGENTS.md` দেখো)। এই ফাইলটা তার **একটা ফেজের বিস্তারিত পরিশিষ্ট** — নতুন কোনো নিয়ম বা
> সিদ্ধান্ত এখানে তৈরি হয় না যা `DEVELOPMENT.md`-এর সাথে সাংঘর্ষিক। প্রতিটা Sprint শেষে
> `DEVELOPMENT.md`-এও এক প্যারার সারাংশ যোগ হবে।
>
> **নাম্বারিং:** `DEVELOPMENT.md` লেখা আছে Sprint 39 পর্যন্ত। এই ফেজের স্প্রিন্টগুলো
> ইউজারের দেওয়া নামে **Sprint 0–11** হিসেবেই থাকবে, বিভ্রান্তি এড়াতে সবসময় `ফেজ ৬ /`
> উপসর্গ সহ।

**স্ট্যাটাস:** Sprint 0 (বিশ্লেষণ ও পরিকল্পনা) ✅ সম্পন্ন। Sprint 1 শুরু হয়নি — ইউজারের কনফার্মেশনের অপেক্ষায়।

---

## ০. এই ফেজের অলঙ্ঘনীয় নিয়ম

ইউজারের দেওয়া ১৮টা নিয়ম নিচের ৬টা কার্যকর বাধ্যবাধকতায় নামানো হলো। প্রতিটা Sprint-এর
Definition of Done-এ এগুলো যাচাই হবে:

1. **এক সময়ে এক Sprint।** আগেরটা সম্পূর্ণ ও ভেরিফাই না হলে পরেরটা শুরু নয়। নতুন আইডিয়া
   → §৯ ব্যাকলগে, চলতি Sprint-এর স্কোপে নয়।
2. **সেলুনের লাইভ কিউ ভাঙা যাবে না।** `serials`, কিউ ইঞ্জিনের ফাংশন/ট্রিগার, কিউ বোর্ড ও
   লাইভ ট্র্যাকিং — এগুলোর আচরণ এই পুরো ফেজে অপরিবর্তিত থাকবে। অ্যাপয়েন্টমেন্ট আলাদা টেবিলে
   (সিদ্ধান্ত ২৪)।
3. **লয়্যালটি পয়েন্ট কখনো গ্লোবাল নয়।** কাস্টমার অ্যাকাউন্ট গ্লোবাল, পয়েন্ট নয়। *A দোকানের
   পয়েন্ট শুধু A দোকানে।* কাঠামোগত গ্যারান্টি: **পয়েন্ট/মেম্বারশিপ/রিওয়ার্ড ধরে রাখে এমন
   কোনো টেবিলে `shop_id` ছাড়া প্রাইমারি কী থাকবে না।**
4. **এক ব্যবসা অন্য ব্যবসার ডেটা দেখতে পাবে না।** প্রতিটা নতুন টেবিলে RLS, এবং শপ-স্কোপড
   পড়া/লেখা সবসময় বিদ্যমান `is_shop_owner(shop_id)` হেল্পার দিয়ে। Sprint 11-এ প্রতিটা নতুন
   টেবিলের জন্য "B দোকানের মালিক A-র সারি পড়তে পারে না" — এই অ্যাসারশন লিখিত টেস্ট হবে।
5. **একই ব্র্যান্ড, একই ডিজাইন সিস্টেম, ভিন্ন ওয়ার্কফ্লো।** নতুন কোনো কালার/টাইপোগ্রাফি/
   কম্পোনেন্ট লাইব্রেরি নয় — `src/components/ui/`-এর ৩৮টা কম্পোনেন্ট আর `globals.css`-এর
   টোকেনই ব্যবহার হবে। নতুন ভারী ডিপেন্ডেন্সি নয় (সিদ্ধান্ত ৬)।
6. **প্রতিটা `[x]`-এর মানে:** কোড লেখা হয়েছে · `npm test` সবুজ · `npm run build` সবুজ ·
   `npm run lint` সবুজ · মাইগ্রেশন লেখা ও ইউজার SQL এডিটরে চালিয়ে ভেরিফাই করেছে · পুরনো
   ফিচারে রিগ্রেশন নেই · ডকুমেন্টেশন আপডেট। এর একটাও বাদ থাকলে বক্সটা `[ ]` থাকবে।

---

## ১. Sprint 0 — বিশ্লেষণের ফলাফল

### ১.১ স্ট্যাক ও আর্কিটেকচার

| স্তর | যা আছে |
|---|---|
| ফ্রেমওয়ার্ক | Next.js 16.2.10 App Router (Turbopack), React 19, TypeScript |
| স্টাইল | Tailwind 4, CSS-first টোকেন `src/app/globals.css`-এ |
| ব্যাকএন্ড | Supabase — Auth (PKCE, `@supabase/ssr`), Postgres + RLS, Realtime, Storage |
| সার্ভার স্টেট | TanStack Query, কী কেন্দ্রীভূত `src/lib/query/keys.ts`-এ |
| ভাষা | কাস্টম bilingual i18n — ফিচার-প্রতি `lib/i18n.ts`, `{bn,en} satisfies Dict`, `useT()` / `translate()` |
| ম্যাপ | Leaflet + OSM |
| AI | `@anthropic-ai/sdk`, শুধু সার্ভারে (`src/lib/anthropic/client.ts`, `import "server-only"`) |
| শিডিউলার | Vercel Cron — `vercel.json` → `/api/cron/nightly`, দিনে একবার (১৬:০০ UTC) |
| টেস্ট | ২০টা ফাইল, বিশুদ্ধ-ফাংশন ইউনিট টেস্ট (`src/lib/*.test.ts`, `src/features/*/lib/*.test.ts`) |

**লেয়ারিং `eslint-plugin-boundaries` দিয়ে জোরপূর্বক:**

```
app  →  feature, shared
feature  →  shared, নিজেই
shared  →  shared
```

**ফিচার ফিচারকে import করতে পারে না।** ক্রস-ফিচার কম্পোজিশন app স্তরে slot prop দিয়ে হয়
(যেমন `QueueBoard`-এর `breakSlot` / `voiceSlot`)। এই ফেজে অ্যাপয়েন্টমেন্ট + লয়্যালটি +
মেম্বারশিপ একে অন্যকে ছোঁবে — **এটাই এই ফেজের প্রধান আর্কিটেকচারাল চাপ**, §৮ ঝুঁকি দেখো।

### ১.২ ডেটাবেস — যা আছে

**২৬টা টেবিল/ভিউ:** `profiles` · `shops` · `services` · `offers` · `shop_rating_summary` ·
`chairs` · `chair_service_stats` · `shop_gallery_images` · `favorites` · `push_subscriptions` ·
`serials` · `hairstyles` · `serial_style_preferences` · `manual_entries` · `customer_reminders` ·
`shop_expenses` · `queue_public` (ভিউ) · `reviews` · `chair_rating_summary` ·
`regular_reminders` · `messages` · `notifications` · `admin_users` · `support_tickets` ·
`support_ticket_messages` · `reports` · `admin_audit_log`

**৫০টা মাইগ্রেশন** `supabase/migrations/`-এ, তারিখ-ক্রমে। **CLI নেই — ইউজার নিজে Supabase
SQL এডিটরে চালান**, আর `supabase/scripts/check_migrations.sql` ডেটাবেসকে জিজ্ঞেস করে যাচাই করে।

**আইসোলেশনের বিদ্যমান প্যাটার্ন (এই ফেজে হুবহু অনুসরণ করা হবে):**

```sql
CREATE FUNCTION public.is_shop_owner(p_shop_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select exists (select 1 from public.shops
                     where id = p_shop_id and owner_id = auth.uid()); $$;
```

প্রতিটা শপ-স্কোপড টেবিলের নীতি এই হেল্পারের উপর দাঁড়ানো — `services`, `chairs`,
`chair_service_stats`, `serials`, `manual_entries`, `shop_expenses`, সবগুলো। কাস্টমারের নিজের
সারি `customer_id = auth.uid()` দিয়ে। **নতুন কোনো টেবিলে ইনলাইন সাবকোয়েরি লেখা হবে না** —
একই হেল্পার, যাতে আইসোলেশনের সংজ্ঞা এক জায়গায় থাকে।

### ১.৩ অথ, রোল ও রাউটিং

- `user_role` enum: `customer | provider` — **শুধু দুটো**। এডমিন আলাদা মেম্বারশিপ
  (`admin_users`), তৃতীয় রোল নয়।
- রোল আসে `user_metadata.role` থেকে; এডমিন ফ্ল্যাগ **ইচ্ছাকৃতভাবে** `app_metadata.is_admin`
  থেকে (user_metadata ইউজার নিজে লিখতে পারে)।
- `src/lib/supabase/middleware.ts` — প্রিফিক্স-ভিত্তিক গার্ড: `PROVIDER_PREFIXES` (১৪টা),
  `CUSTOMER_PREFIXES` (৬টা), `CUSTOMER_EXACT`, `ADMIN_PREFIXES`, `AUTH_REQUIRED_PREFIXES`।
- রুট গ্রুপ: `(admin)` · `(customer)` · `(provider)` + স্ট্যান্ডঅ্যালোন (`login`, `register`,
  `account`, `display`, `help`, `api`…)। মোট **৫৫টা পেজ**।
- শেল: `ProviderShell`+`ProviderSidebar` · `CustomerShell`+`CustomerBottomNav`+
  `CustomerSidebarPanel` · `AdminShell`+`AdminSidebar`।

### ১.৪ বিদ্যমান ফিচার ম্যাপ (২৫টা স্লাইস)

```
account · admin · auth · chat · customer-booking · customer-explore · customer-help
customer-profile · customer-style · notifications · onboarding · provider-ai
provider-analytics · provider-catalog · provider-due-ledger · provider-income
provider-offers · provider-queue · provider-regulars · provider-reviews
provider-setup · provider-transactions · provider-voice · shop-display · support
```

**যা হুবহু রিইউজ হবে, নতুন করে লেখা হবে না:** auth ও রোল রাউটিং · শপ প্রোফাইল/গ্যালারি/
About/Working Hours · সার্ভিস ক্যাটালগ · স্টাফ (`chairs`) · রিভিউ ও রেটিং · চ্যাট ·
নোটিফিকেশন ইনফ্রা (`notifications` + Web Push) · ইনকাম/বাকির খাতা/খরচ/ক্যাশবুক ·
সম্পূর্ণ এডমিন প্যানেল · এক্সপ্লোর/ম্যাপ/সার্চ/ফিল্টার · i18n · সব শেয়ার্ড UI কম্পোনেন্ট ·
AI সহকারী · ছবি কম্প্রেশন (`src/lib/image-compress.ts`)।

### ১.৫ 🔴 সবচেয়ে গুরুত্বপূর্ণ আবিষ্কার — `business_type` এখন কিছুই ব্রাঞ্চ করে না

`business_type` enum (`SALON | PARLOUR | UNISEX`) **ইতিমধ্যে আছে** এবং:

- রেজিস্ট্রেশনে সংগ্রহ করা হয় (`register.schema.ts` → `auth.api.ts:55` → user_metadata)
- `ShopSettingsForm`-এ প্রি-ফিল হয়
- এক্সপ্লোরে ফিল্টার করে (`explore/page.tsx`)
- লেবেল দেখায় (`BUSINESS_TYPE_LABEL`, `businessTypeT`)

**এটুকুই।** এটা কোনো ওয়ার্কফ্লো ব্রাঞ্চ করে না — পার্লারে লগইন করলেও এখন কিউ বোর্ডই আসে।

**অর্থ:** ইউজারের প্রস্তাবিত "Sprint 1 — Business Type System"-এর ডেটা-স্তর প্রায় সম্পূর্ণ,
কিন্তু **আসল কাজটা** (রাউটিং ফর্ক + পরিভাষা স্তর) পুরোটাই বাকি। Sprint 1 তাই ছোট হবে না,
শুধু আকার বদলাবে — মাইগ্রেশন কম, ব্রাঞ্চিং বেশি।

### ১.৬ যা নেই (গ্যাপ)

| যা দরকার | অবস্থা |
|---|---|
| `appointments` টেবিল / স্লট ইঞ্জিন | নেই — শূন্য থেকে |
| পরিভাষা রেজলভার (`useTerms`) | **নেই** — "চেয়ার"/"স্টাফ" ডজনখানেক ডিকশনারিতে হার্ডকোডেড |
| `service_categories` DB টেবিল | নেই — `src/config/constants.ts`-এ হার্ডকোডেড ৭টা, `business_type` ট্যাগ ছাড়া |
| `shops.women_only` ফ্ল্যাগ | নেই |
| স্টাফের কর্মঘণ্টা / ছুটি | নেই — শুধু শপ-লেভেল `weekly_hours` |
| লয়্যালটি / মেম্বারশিপ / রেফারেল / রিওয়ার্ড | কিছুই নেই |
| দিনে একবারের বেশি cron | নেই — `vercel.json`-এ একটা নাইটলি জব |
| `btree_gist` এক্সটেনশন | যাচাই করা হয়নি — অ্যাপয়েন্টমেন্ট ওভারল্যাপ কনস্ট্রেইন্টের পূর্বশর্ত |

### ১.৭ দুটো হাউসকিপিং সমস্যা (এই ফেজের বাইরে, কিন্তু জানা থাকা দরকার)

- **`DEVELOPMENT.md` Sprint 39-এ থেমে আছে**, অথচ তার পরে ১৪টা কমিট হয়েছে (এডমিন প্যানেল
  সম্প্রসারণ, ৫টা AI ফিচার, স্টাইল স্টুডিও, ভয়েস কমান্ড, ক্যাশবুক, ফ্লোটিং চ্যাটবট)।
  এগুলোর কোনো Sprint নোট লেখা হয়নি। → §৯ ব্যাকলগ।
- **৭টা মাইগ্রেশন (`20260909`–`20260915`) এখনো লাইভ ডেটাবেসে চালানো বাকি** (ইউজারের হাতে),
  এবং `ANTHROPIC_API_KEY` Vercel-এ বসানো বাকি। ফেজ ৬-এর কোনো Sprint এগুলোর উপর নির্ভরশীল
  নয়, কিন্তু Sprint 1-এর মাইগ্রেশন এদের **পরে** চলতে হবে (তারিখ-ক্রম)।

---

## ২. নতুন কনফার্মড সিদ্ধান্ত (২৭–৩৬)

`DEVELOPMENT.md`-এর সিদ্ধান্ত ১–২৬ অপরিবর্তিত ও প্রযোজ্য। এই ফেজে যোগ হলো:

27. **`business_type` → বুকিং মডেল, একটাই জায়গায়।** `src/lib/business-model.ts`-এ একটা
    ম্যাপ: `SALON → QUEUE`, `PARLOUR → APPOINTMENT`, `UNISEX → QUEUE`। অ্যাপের আর কোথাও
    `businessType === "PARLOUR"` লেখা হবে না — সবাই `bookingModel(shop)` জিজ্ঞেস করবে।
    কারণ: ভবিষ্যতে তৃতীয় ভার্টিক্যাল এলে একটা ফাইল বদলালেই হবে।
28. **পরিভাষা ডেটা, শর্ত নয়।** `src/lib/terms.ts` — `useTerms(businessType)` একটা রেজলভড
    dict দেয় (`chair`, `staff`, `booking`, `queue`…)। কম্পোনেন্টে `if (parlour) "সিট" else
    "চেয়ার"` লেখা নিষিদ্ধ। i18n-এর বিদ্যমান `{bn,en}` প্যাটার্নের **উপরে** বসবে, বদলে নয়।
29. **অ্যাপয়েন্টমেন্ট `serials`-এ ঢুকবে না** (সিদ্ধান্ত ২৪-এর পুনর্ব্যক্তি)। কিন্তু
    `appointments` টেবিলের **টাকা-সংক্রান্ত কলামগুলো `serials`-এর হুবহু নকল** হবে
    (`total_amount`, `payment_status`, `due_amount`, `payment_method`, `advance_*`), যাতে
    ইনকাম/বাকির খাতা/ক্যাশবুক/ট্রানজেকশন একই আকৃতির সারি পায় এবং তাদের বিশুদ্ধ ফাংশন
    (`compute-income`, `compute-due-ledger`, `build-transactions`) দ্বিতীয়বার লিখতে না হয়।
30. **ওভারল্যাপ ঠেকাবে ডেটাবেস, UI নয়।** `EXCLUDE USING gist` কনস্ট্রেইন্ট — ঠিক যেভাবে
    কিউয়ের `one_in_progress_per_chair` কাজ করে। ক্লায়েন্ট-সাইড চেক শুধু ভদ্র বার্তার জন্য।
31. **স্লট হিসাব সার্ভারে।** `shop_available_slots()` RPC — কিউয়ের `assign_best_chair` /
    `chair_backlog_min` যে কারণে সার্ভারে, ঠিক সেই কারণে (সব ক্লায়েন্টে এক উত্তর)।
32. **লয়্যালটি ব্যালেন্স কখনো সরাসরি UPDATE হবে না।** `loyalty_accounts`-এ কোনো UPDATE RLS
    পলিসি **থাকবেই না**; ব্যালেন্স বদলায় শুধু SECURITY DEFINER RPC-র ভেতরে, প্রতিবার একটা
    `loyalty_transactions` লেজার সারি সহ। ব্যালেন্স = লেজারের যোগফল, সবসময় মিলবে।
33. **পয়েন্টের মালিক (দোকান, কাস্টমার) জোড়া — কাস্টমার একা নয়।** `loyalty_accounts`-এর
    প্রাইমারি কী `(shop_id, customer_id)`। কোনো ভিউ, RPC বা API কখনো `shop_id` ছাড়া পয়েন্ট
    যোগ করে দেখাবে না। কাস্টমার তার প্রোফাইলে দোকান-ভিত্তিক **তালিকা** দেখবে, একটা মোট
    সংখ্যা নয়।
34. **রেফারেল কোড গ্লোবাল, রেফারেল পুরস্কার শপ-স্কোপড।** কাস্টমারের একটাই কোড
    (`referral_codes.customer_id` PK), কিন্তু পুরস্কার জমা হয় সেই দোকানের
    `loyalty_accounts`-এ যেখানে রেফার্ড কাস্টমার প্রথম বুকিং সম্পন্ন করেছে। এক দোকানে
    একজন রেফার্ড কাস্টমারের জন্য একবারই (`unique (shop_id, referred_id)`)।
35. **রিমাইন্ডারের জন্য নতুন ইনফ্রা নয় — বিদ্যমান Vercel Cron বাড়বে।** সিদ্ধান্ত ২৬ বলেছিল
    ফেজ ৫-এ আলাদা সিদ্ধান্ত লাগবে; সিদ্ধান্তটা হলো: `/api/cron/nightly`-র প্যাটার্ন
    (service-role + idempotent SQL RPC) কপি করে `/api/cron/appointments` হবে। **যাচাই করতে
    হবে** Vercel প্ল্যান দিনে একাধিকবার cron দেয় কিনা; না দিলে আগের দিনের রিমাইন্ডার
    নাইটলিতেই যাবে আর "২ ঘণ্টা আগে" রিমাইন্ডার ব্যাকলগে যাবে (§৮ ঝুঁকি R4)।
36. **মেম্বারশিপ ও লয়্যালটি ঐচ্ছিক ফিচার।** দোকান চালু না করলে কোনো UI দেখাবে না — অফারের
    মতো (সিদ্ধান্ত ১২)। `loyalty_settings.is_enabled` / `membership_plans` খালি = ফিচার
    অদৃশ্য, সেলুন-পার্লার দুই ধরনেই।

---

## ৩. ডেটাবেস পরিবর্তনের সম্পূর্ণ তালিকা

> প্রতিটা মাইগ্রেশন `supabase/migrations/`-এ, তারিখ-ক্রমে `20260916`+ থেকে শুরু। প্রতিটাই
> পুনরায় চালানো নিরাপদ (`create ... if not exists`, `drop policy if exists` + `create`)।

### Sprint 1
```
alter table shops add column women_only boolean not null default false;
create table service_categories (id, slug unique, name_bn, name_en,
       business_types business_type[], sort_order, is_active);
  -- সিড: বিদ্যমান ৭টা ক্যাটাগরি + পার্লার-স্পেসিফিক (ব্রাইডাল, মেহেদি, থ্রেডিং, ওয়্যাক্স…)
alter table services add column category_id uuid references service_categories;
  -- পুরনো text category কলাম ব্যাকফিল হবে, তারপরই বাদ (দুই ধাপে, এক মাইগ্রেশনে নয়)
RLS: service_categories — সবাই পড়তে পারে, লেখা শুধু প্ল্যাটফর্ম এডমিন
```

### Sprint 4 — অ্যাপয়েন্টমেন্ট কোর
```
create extension if not exists btree_gist;
create type appointment_status as enum
  ('BOOKED','CONFIRMED','IN_PROGRESS','DONE','CANCELLED','NO_SHOW');

create table staff_working_hours (chair_id, weekday smallint, start_time time,
       end_time time, primary key (chair_id, weekday));
create table staff_time_off (id, chair_id, starts_at, ends_at, reason);

create table appointments (
  id, shop_id, staff_id (→chairs), customer_id, customer_name, customer_phone,
  service_ids uuid[], services_snapshot jsonb,
  starts_at timestamptz, ends_at timestamptz,
  status appointment_status default 'BOOKED',
  -- সিদ্ধান্ত ২৯: serials-এর হুবহু নকল টাকার কলাম
  total_amount, payment_status, due_amount, due_collected_at, payment_method,
  advance_paid, advance_method, advance_txn_id,
  customer_avatar_url, notes, booked_at, created_at, updated_at,
  cancelled_at, cancelled_by, reschedule_of uuid references appointments
);

alter table appointments add constraint appointments_no_overlap
  exclude using gist (staff_id with =, tstzrange(starts_at, ends_at) with &&)
  where (status in ('BOOKED','CONFIRMED','IN_PROGRESS'));

RLS: select using (customer_id = auth.uid() or is_shop_owner(shop_id))
     insert (কাস্টমার নিজের জন্য) / (মালিক walk-in-এর জন্য)
     update  using (is_shop_owner(shop_id)) + কাস্টমারের সীমিত ক্যানসেল পলিসি

RPC: shop_available_slots(p_shop_id, p_staff_id, p_date, p_service_ids)
     book_appointment(...)  -- ওভারল্যাপ ব্যতিক্রম ধরে বন্ধুসুলভ এরর
     cancel_appointment(p_id, p_reason)
     reschedule_appointment(p_id, p_starts_at, p_staff_id)
ট্রিগার: appointment_notify (serials-এর notify_serial_event-এর সমতুল্য)
```

### Sprint 6 — মেম্বারশিপ
```
create type membership_status as enum ('ACTIVE','EXPIRED','CANCELLED');
create table membership_plans (id, shop_id, name, description, price,
       duration_days, discount_percent, included_service_ids uuid[],
       perks jsonb, is_active, sort_order, created_at);
create table memberships (id, shop_id, customer_id, plan_id,
       plan_snapshot jsonb, starts_at, ends_at, status, purchased_amount,
       payment_method, created_at);
create unique index memberships_one_active
  on memberships (shop_id, customer_id) where status = 'ACTIVE';
RLS: দুটোই is_shop_owner(shop_id); memberships-এ কাস্টমার নিজের সারি পড়তে পারে
```

### Sprint 7 — লয়্যালটি (নিয়ম ৩ ও সিদ্ধান্ত ৩২/৩৩)
```
create table loyalty_settings (shop_id primary key, is_enabled boolean default false,
       points_per_taka numeric, min_spend numeric, redeem_rate numeric,
       points_expiry_days int, updated_at);
create table loyalty_accounts (
  shop_id, customer_id, points_balance int default 0,
  lifetime_earned int default 0, lifetime_redeemed int default 0, updated_at,
  primary key (shop_id, customer_id));          -- ← আইসোলেশনের ভিত্তি
create table loyalty_transactions (id, shop_id, customer_id, delta int,
  reason text check (reason in ('EARN','REDEEM','REFERRAL','ADJUST','EXPIRE')),
  source_type text, source_id uuid, balance_after int, note, created_at, created_by);

RLS: loyalty_accounts — SELECT: customer_id = auth.uid() or is_shop_owner(shop_id)
                        INSERT/UPDATE/DELETE পলিসি নেই (সিদ্ধান্ত ৩২)
     loyalty_transactions — SELECT একই শর্তে; লেখা শুধু RPC-র ভেতরে
RPC (SECURITY DEFINER, সবগুলো p_shop_id নেয় — কখনো শুধু customer_id নয়):
     loyalty_award(p_shop_id, p_customer_id, p_source_type, p_source_id)
     loyalty_adjust(p_shop_id, p_customer_id, p_delta, p_note)   -- মালিক-only
     my_loyalty_accounts()  -- কাস্টমারের দোকান-ভিত্তিক তালিকা, যোগফল নয়
ট্রিগার: serials DONE + appointments DONE → loyalty_award (দোকান চালু রাখলে)
```

### Sprint 8 — রেফারেল
```
create type referral_status as enum ('PENDING','QUALIFIED','REWARDED','VOID');
create table referral_codes (customer_id primary key, code text unique, created_at);
create table referrals (id, shop_id, referrer_id, referred_id, code,
       status referral_status default 'PENDING',
       qualifying_booking_type text, qualifying_booking_id uuid,
       reward_points int, rewarded_at, created_at);
create unique index referrals_one_per_shop on referrals (shop_id, referred_id);
RLS: referral_codes — নিজের সারি; referrals — referrer/referred/is_shop_owner
RPC: my_referral_code() · claim_referral(p_code) · (ট্রিগারে) referral_qualify()
```

### Sprint 9 — রিওয়ার্ড ও রিডেম্পশন
```
create type reward_kind as enum ('DISCOUNT_FLAT','DISCOUNT_PCT','FREE_SERVICE');
create type redemption_status as enum ('ISSUED','USED','EXPIRED','CANCELLED');
create table rewards (id, shop_id, name, description, points_cost, kind,
       value numeric, service_id, stock int, valid_until, is_active, sort_order);
create table reward_redemptions (id, shop_id, customer_id, reward_id,
       reward_snapshot jsonb, points_spent int, code text, status,
       issued_at, used_at, used_on_booking_type, used_on_booking_id, expires_at);
create unique index reward_redemptions_code on reward_redemptions (shop_id, code);
RLS: is_shop_owner(shop_id) + কাস্টমার নিজের রিডেম্পশন
RPC: redeem_reward(p_shop_id, p_reward_id)   -- ব্যালেন্স চেক + লেজার + ইস্যু, এক ট্রানজেকশনে
     mark_redemption_used(p_shop_id, p_code)
```

### Sprint 10
```
নতুন টেবিল নেই — শুধু রিপোর্টিং RPC:
  shop_appointment_stats(p_shop_id, p_from, p_to)
  shop_loyalty_stats(p_shop_id)
  shop_membership_stats(p_shop_id)
সবগুলোর প্রথম লাইন: if not is_shop_owner(p_shop_id) then raise exception ...
```

---

## ৪. API পরিবর্তনের তালিকা

**নতুন Next রুট — শুধু দুটো** (বাকি সব Supabase RPC/টেবিল কল, বিদ্যমান প্যাটার্নে):

| রুট | কী করে | কোন Sprint |
|---|---|---|
| `/api/cron/appointments` | আগামীকালের ও ২ ঘণ্টা পরের অ্যাপয়েন্টমেন্ট রিমাইন্ডার; `CRON_SECRET` + service-role, idempotent | 5 |
| `/api/ai/*` (বিদ্যমান) | `buildShopBrief` সম্প্রসারিত হবে — অ্যাপয়েন্টমেন্ট/লয়্যালটি সংখ্যা যোগ | 10 |

**নতুন ফিচার-লেয়ার API মডিউল** (`src/features/<slice>/api/*.api.ts`, বিদ্যমান কনভেনশনে):
`appointments.api.ts` · `availability.api.ts` · `membership.api.ts` · `loyalty.api.ts` ·
`referral.api.ts` · `rewards.api.ts`

**`src/lib/query/keys.ts`-এ নতুন কী-গ্রুপ:** `appointments` · `availability` · `memberships` ·
`loyalty` · `referrals` · `rewards` — প্রতিটাতে `shopId` কী-এর অংশ, যাতে দোকান বদলালে ক্যাশ
কখনো মিশে না যায় (নিয়ম ৪-এর ক্লায়েন্ট-সাইড প্রতিফলন)।

---

## ৫. UI পরিবর্তনের তালিকা

**নতুন ফিচার স্লাইস (৬টা):**

```
provider-appointments   -- ক্যালেন্ডার বোর্ড, স্টাফ কর্মঘণ্টা, অ্যাপয়েন্টমেন্ট ম্যানেজমেন্ট
customer-appointments   -- স্লট পিকার, আমার অ্যাপয়েন্টমেন্ট, রিশিডিউল/ক্যানসেল
provider-membership     -- প্ল্যান CRUD, সদস্য তালিকা
provider-loyalty        -- সেটিংস, রিওয়ার্ড ক্যাটালগ, কাস্টমার পয়েন্ট, রিডেম্পশন স্ক্যান
customer-loyalty        -- দোকান-ভিত্তিক পয়েন্ট কার্ড, রিওয়ার্ড রিডিম, রেফারেল
                        -- (মেম্বারশিপ কেনা এখানেই — আলাদা স্লাইস নয়)
```

**নতুন শেয়ার্ড UI কম্পোনেন্ট (যতটা কম সম্ভব, বিদ্যমান টোকেনেই):**
`DateStrip` (তারিখ স্ট্রিপ) · `SlotGrid` (সময়ের গ্রিড, `ChipGroup`-এর উপর) ·
`DayCalendar` (স্টাফ = কলাম, সময় = সারি) · `PointsBadge`。
বাকি সব `Card` / `BottomSheet` / `ConfirmSheet` / `TabBar` / `StatTile` / `EmptyState` /
`Badge` / `Button` দিয়ে — নিয়ম ৫।

**রাউটিং পরিবর্তন:**

| রুট | পরিবর্তন |
|---|---|
| `/dashboard` | `bookingModel(shop)` দেখে `QueueBoard` অথবা `AppointmentBoard` — **এটাই দুই মডেলের একমাত্র সংযোগস্থল** |
| `/explore/[shopId]` → ServicesTab | কিউ বুকিং শিট অথবা স্লট পিকার |
| `/my-serial` | পার্লার বুকিং থাকলে অ্যাপয়েন্টমেন্ট ভিউ দেখাবে (নাম অপরিবর্তিত, রিডাইরেক্ট নয়) |
| `/chairs` | পার্লারে "সিট/বেড" শিরোনাম + কর্মঘণ্টা ট্যাব |
| **নতুন** `/appointments` | প্রোভাইডারের তালিকা ভিউ (ক্যালেন্ডারের পরিপূরক) — `PROVIDER_PREFIXES`-এ যোগ |
| **নতুন** `/membership`, `/loyalty` | প্রোভাইডার — `PROVIDER_PREFIXES`-এ যোগ |
| **নতুন** `/rewards` | কাস্টমার — `CUSTOMER_PREFIXES`-এ যোগ |

**মিডলওয়্যার:** প্রতিটা নতুন রুট যোগ করার সময় `src/lib/supabase/middleware.ts`-এর সংশ্লিষ্ট
প্রিফিক্স অ্যারেতে যোগ করতেই হবে — না করলে পেজটা যেকোনো রোলের জন্য খোলা থাকে। **প্রতিটা
Sprint-এর চেকলিস্টে এই লাইনটা আলাদা করে আছে।**

---

## ৬. Sprint তালিকা ও চেকলিস্ট

### ✅ ফেজ ৬ / Sprint 0 — বিশ্লেষণ ও আর্কিটেকচার পরিকল্পনা

- [x] সম্পূর্ণ ফ্রন্টএন্ড/ব্যাকএন্ড আর্কিটেকচার পড়া (§১.১)
- [x] ডেটাবেস স্কিমা, ২৬টা টেবিল, ৫০টা মাইগ্রেশন, RLS প্যাটার্ন ম্যাপ করা (§১.২)
- [x] অথ, রোল, মিডলওয়্যার গার্ড, রুট গ্রুপ ম্যাপ করা (§১.৩)
- [x] ২৫টা ফিচার স্লাইস ও রিইউজযোগ্য অংশ চিহ্নিত করা (§১.৪)
- [x] `business_type` আসলে কী ব্রাঞ্চ করে — তদন্ত ও ফলাফল (§১.৫)
- [x] গ্যাপ তালিকা (§১.৬), ডিজাইন সিস্টেম ও টেস্ট ইনভেন্টরি
- [x] এই ফাইল তৈরি + `DEVELOPMENT.md`-এ পয়েন্টার
- [x] ইউজারকে রিপোর্ট, কনফার্মেশনের আগে কোনো ফিচার ইমপ্লিমেন্ট নয়

---

### ⬜ ফেজ ৬ / Sprint 1 — বিজনেস টাইপ সিস্টেম (ভিত্তি)

**নির্ভরতা:** কিছু নেই। **সবগুলোর পূর্বশর্ত।**

- [ ] `src/lib/business-model.ts` — `bookingModel()` রেজলভার (সিদ্ধান্ত ২৭) + ইউনিট টেস্ট
- [ ] `src/lib/terms.ts` — `useTerms(businessType)` পরিভাষা রেজলভার (সিদ্ধান্ত ২৮) + টেস্ট
- [ ] হার্ডকোডেড "চেয়ার"/"স্টাফ" স্ট্রিংগুলো `useTerms`-এ সরানো (প্রথমে provider-queue,
      provider-catalog, customer-booking — বাকিগুলো ব্যবহারের সাথে সাথে)
- [ ] মাইগ্রেশন: `shops.women_only` + `service_categories` টেবিল + সিড + `services.category_id`
- [ ] শপ সেটিংসে "শুধু মহিলাদের জন্য" টগল; এক্সপ্লোরে ফিল্টার চিপ
- [ ] প্রোভাইডার সাইডবার ও কাস্টমার নেভ `bookingModel` অনুযায়ী আইটেম দেখাবে/লুকাবে
- [ ] `/dashboard`-এ ব্রাঞ্চিং পয়েন্ট বসানো (এখনো প্লেসহোল্ডার — Sprint 2-এ ভরাট)
- [ ] মিডলওয়্যার প্রিফিক্স আপডেট (এই Sprint-এ নতুন রুট নেই — যাচাই করে নিশ্চিত হওয়া)
- [ ] রিগ্রেশন: সেলুন অ্যাকাউন্টে কিউ বোর্ড, বুকিং, ETA — সব আগের মতো
- [ ] build ✅ · lint ✅ · test ✅ · মাইগ্রেশন ভেরিফাইড ✅ · ডক আপডেট ✅

**ঝুঁকি:** পরিভাষা রিফ্যাক্টর ডজনখানেক ফাইল ছোঁবে — একবারে সব নয়, তিনটে স্লাইস দিয়ে শুরু।

---

### ⬜ ফেজ ৬ / Sprint 2 — বিউটি পার্লার ড্যাশবোর্ড (শেল)

**নির্ভরতা:** Sprint 1

- [ ] `provider-appointments` স্লাইস তৈরি (খালি স্টেট সহ)
- [ ] `AppointmentBoard` শেল — আজকের দিন, স্টাফ কলাম, খালি স্লট (ডেটা এখনো নেই)
- [ ] পার্লারের ড্যাশবোর্ড কার্ড: আজকের অ্যাপয়েন্টমেন্ট, আজকের আয়, নতুন সদস্য (প্লেসহোল্ডার)
- [ ] `/chairs` পার্লারে "সিট/বেড" পরিভাষায়; স্টাফ কার্ডে বিউটিশিয়ান শব্দ
- [ ] খালি/লোডিং/এরর স্টেট, ৩২০px রেসপনসিভ
- [ ] রিগ্রেশন: সেলুন ড্যাশবোর্ড অপরিবর্তিত
- [ ] build ✅ · lint ✅ · test ✅ · ডক আপডেট ✅

---

### ⬜ ফেজ ৬ / Sprint 3 — পার্লার সার্ভিস ম্যানেজমেন্ট

**নির্ভরতা:** Sprint 1

- [ ] সার্ভিস ফর্মে DB ক্যাটাগরি (business_type-ফিল্টার করা), হার্ডকোডেড লিস্ট বাদ
- [ ] দীর্ঘ সার্ভিসের জন্য সময়ের ইনপুট ঘণ্টা+মিনিটে
- [ ] সার্ভিস-প্রতি "কোন স্টাফ করতে পারে" — বিদ্যমান `chair_service_stats` ম্যাট্রিক্স রিইউজ
- [ ] প্যাকেজ নয় (ব্যাকলগ) — শুধু একক সার্ভিস
- [ ] রিগ্রেশন: সেলুনের সার্ভিস ক্যাটালগ ও কিউয়ের সময় হিসাব অপরিবর্তিত
- [ ] build ✅ · lint ✅ · test ✅ · মাইগ্রেশন ভেরিফাইড ✅ · ডক আপডেট ✅

---

### ⬜ ফেজ ৬ / Sprint 4 — অ্যাপয়েন্টমেন্ট সিস্টেম ⭐ (এই ফেজের সবচেয়ে বড়)

**নির্ভরতা:** Sprint 1, 2, 3

- [ ] মাইগ্রেশন: `btree_gist`, `appointment_status`, `staff_working_hours`,
      `staff_time_off`, `appointments` + ওভারল্যাপ কনস্ট্রেইন্ট + RLS (§৩)
- [ ] `shop_available_slots()` RPC + বিশুদ্ধ-ফাংশন ইউনিট টেস্ট (স্লট জেনারেশনের লজিক)
- [ ] `book_appointment()` / `cancel_appointment()` RPC, বন্ধুসুলভ এরর ম্যাপিং
- [ ] প্রোভাইডার: স্টাফ কর্মঘণ্টা ও ছুটির UI
- [ ] কাস্টমার: `DateStrip` + `SlotGrid` স্লট পিকার, `ServicesTab`-এ ব্রাঞ্চড
- [ ] বুকিং কনফার্মেশন + নোটিফিকেশন (বিদ্যমান `notifications` ইনফ্রা)
- [ ] `/my-serial`-এ অ্যাপয়েন্টমেন্ট ভিউ
- [ ] মিডলওয়্যার: নতুন রুট প্রিফিক্স যোগ
- [ ] **রিগ্রেশন (সবচেয়ে গুরুত্বপূর্ণ):** সেলুনের কিউ ইঞ্জিনে একটাও পরিবর্তন হয়নি —
      `serials`-এর ট্রিগার/ফাংশনের `pg_get_functiondef` আগের-পরে মিলিয়ে দেখা
- [ ] build ✅ · lint ✅ · test ✅ · মাইগ্রেশন ভেরিফাইড ✅ · ডক আপডেট ✅

---

### ⬜ ফেজ ৬ / Sprint 5 — অ্যাপয়েন্টমেন্ট ম্যানেজমেন্ট

**নির্ভরতা:** Sprint 4

- [ ] `DayCalendar` — স্টাফ কলাম × সময় সারি, ড্র্যাগ ছাড়া (ট্যাপ → শিট)
- [ ] স্ট্যাটাস ফ্লো: BOOKED → CONFIRMED → IN_PROGRESS → DONE / NO_SHOW / CANCELLED
- [ ] রিশিডিউল (`reschedule_of` চেইন), ক্যানসেলেশন উইন্ডোর নিয়ম
- [ ] কাজ শেষে পেমেন্ট শিট — **কিউয়ের হুবহু একই কম্পোনেন্ট ও একই হ্যাঁ/না প্রশ্ন**
- [ ] ইনকাম/ক্যাশবুক/বাকির খাতা/ট্রানজেকশনে অ্যাপয়েন্টমেন্টের সারি (সিদ্ধান্ত ২৯-এর ফল)
- [ ] `/api/cron/appointments` — আগের দিন + ২ ঘণ্টা আগে রিমাইন্ডার (সিদ্ধান্ত ৩৫)
- [ ] `/appointments` তালিকা পেজ + মিডলওয়্যার প্রিফিক্স
- [ ] রিগ্রেশন: সেলুনের ইনকাম/খাতার অঙ্ক এক পয়সাও বদলায়নি (বিদ্যমান টেস্ট সবুজ)
- [ ] build ✅ · lint ✅ · test ✅ · ডক আপডেট ✅

---

### ⬜ ফেজ ৬ / Sprint 6 — মেম্বারশিপ সিস্টেম

**নির্ভরতা:** Sprint 5 (পেমেন্ট ফ্লো), Sprint 1

- [ ] মাইগ্রেশন: `membership_plans`, `memberships`, RLS, এক-সক্রিয়-সদস্যপদ ইনডেক্স
- [ ] প্রোভাইডার: প্ল্যান CRUD (অফার পেজের প্যাটার্ন রিইউজ), সদস্য তালিকা
- [ ] কাস্টমার: শপ পেজে মেম্বারশিপ কার্ড, কেনা, মেয়াদ দেখা
- [ ] বুকিংয়ে সদস্য ছাড় প্রয়োগ (কিউ ও অ্যাপয়েন্টমেন্ট দুটোতেই)
- [ ] মেয়াদোত্তীর্ণ হওয়া নাইটলি cron-এ (নতুন cron নয়)
- [ ] দোকান প্ল্যান না বানালে কোথাও কোনো UI নেই (সিদ্ধান্ত ৩৬)
- [ ] **আইসোলেশন টেস্ট:** B দোকানের মালিক A-র সদস্য তালিকা পড়তে পারে না
- [ ] build ✅ · lint ✅ · test ✅ · মাইগ্রেশন ভেরিফাইড ✅ · ডক আপডেট ✅

---

### ⬜ ফেজ ৬ / Sprint 7 — লয়্যালটি পয়েন্ট (নিয়ম ৩-এর কেন্দ্র)

**নির্ভরতা:** Sprint 5

- [ ] মাইগ্রেশন: `loyalty_settings`, `loyalty_accounts` (PK `(shop_id, customer_id)`),
      `loyalty_transactions`, RLS — **UPDATE পলিসি ছাড়া** (সিদ্ধান্ত ৩২)
- [ ] `loyalty_award()` / `loyalty_adjust()` / `my_loyalty_accounts()` RPC
- [ ] DONE ট্রিগার → পয়েন্ট (কিউ ও অ্যাপয়েন্টমেন্ট দুটোতেই)
- [ ] প্রোভাইডার: লয়্যালটি সেটিংস, কাস্টমার-ভিত্তিক পয়েন্ট, ম্যানুয়াল অ্যাডজাস্ট
- [ ] কাস্টমার: **দোকান-ভিত্তিক পয়েন্ট কার্ডের তালিকা** — কোথাও মোট সংখ্যা নয় (সিদ্ধান্ত ৩৩)
- [ ] প্রতিটা পয়েন্ট কার্ডে দোকানের নাম ও লোগো, যাতে "এটা কোথায় খরচ হবে" প্রশ্নই না ওঠে
- [ ] **আইসোলেশন টেস্ট (৩টা):** (ক) B-র মালিক A-র `loyalty_accounts` পড়তে পারে না ·
      (খ) কাস্টমার সরাসরি ব্যালেন্স UPDATE করতে পারে না · (গ) `loyalty_award` অন্য দোকানের
      `shop_id` দিয়ে ডাকলে ব্যর্থ হয়
- [ ] ব্যালেন্স = লেজারের যোগফল — এই ইনভ্যারিয়েন্টের টেস্ট
- [ ] build ✅ · lint ✅ · test ✅ · মাইগ্রেশন ভেরিফাইড ✅ · ডক আপডেট ✅

---

### ⬜ ফেজ ৬ / Sprint 8 — রেফারেল সিস্টেম

**নির্ভরতা:** Sprint 7

- [ ] মাইগ্রেশন: `referral_codes`, `referrals`, RLS, `unique (shop_id, referred_id)`
- [ ] `my_referral_code()` · `claim_referral()` · কোয়ালিফাই ট্রিগার
- [ ] কাস্টমার: কোড শেয়ার (WhatsApp ডিপ-লিংক, বিদ্যমান প্যাটার্ন), স্ট্যাটাস তালিকা
- [ ] রেজিস্ট্রেশন/প্রথম বুকিংয়ে কোড দেওয়ার জায়গা
- [ ] পুরস্কার → **সেই দোকানের** `loyalty_accounts`-এ (সিদ্ধান্ত ৩৪)
- [ ] প্রোভাইডার: কোন কাস্টমার কতজন এনেছে
- [ ] **আইসোলেশন টেস্ট:** এক দোকানের রেফারেল অন্য দোকানে পয়েন্ট দেয় না
- [ ] সেলফ-রেফারেল ও ডুপ্লিকেট ঠেকানোর টেস্ট
- [ ] build ✅ · lint ✅ · test ✅ · মাইগ্রেশন ভেরিফাইড ✅ · ডক আপডেট ✅

---

### ⬜ ফেজ ৬ / Sprint 9 — রিওয়ার্ড ও রিডেম্পশন

**নির্ভরতা:** Sprint 7

- [ ] মাইগ্রেশন: `rewards`, `reward_redemptions`, RLS
- [ ] `redeem_reward()` — ব্যালেন্স চেক + লেজার + ইস্যু, এক ট্রানজেকশনে (রেস কন্ডিশন টেস্ট)
- [ ] প্রোভাইডার: রিওয়ার্ড ক্যাটালগ CRUD, রিডেম্পশন কোড যাচাই ও "ব্যবহৃত" চিহ্ন
- [ ] কাস্টমার: দোকানের রিওয়ার্ড তালিকা, রিডিম, কোড দেখানো
- [ ] বুকিংয়ের বিলে রিডেম্পশন প্রয়োগ
- [ ] **আইসোলেশন টেস্ট:** A-র কোড B দোকানে যাচাই করলে "পাওয়া যায়নি"
- [ ] অপর্যাপ্ত পয়েন্ট, মেয়াদোত্তীর্ণ, স্টক শেষ — তিনটে এজ কেসের টেস্ট
- [ ] build ✅ · lint ✅ · test ✅ · মাইগ্রেশন ভেরিফাইড ✅ · ডক আপডেট ✅

---

### ⬜ ফেজ ৬ / Sprint 10 — অ্যানালিটিক্স

**নির্ভরতা:** Sprint 5, 6, 7, 9

- [ ] `shop_appointment_stats` / `shop_loyalty_stats` / `shop_membership_stats` RPC
      (প্রত্যেকটার প্রথম লাইনে `is_shop_owner` গার্ড)
- [ ] `provider-analytics`-এ নতুন ট্যাব — বিদ্যমান চার্ট কম্পোনেন্ট রিইউজ
- [ ] অ্যাপয়েন্টমেন্ট: বুকিং রেট, নো-শো রেট, স্টাফ ইউটিলাইজেশন, পিক স্লট
- [ ] লয়্যালটি/মেম্বারশিপ: ইস্যু বনাম রিডিম, সদস্যের গড় খরচ, রিটেনশন
- [ ] `buildShopBrief` সম্প্রসারণ → AI সহকারী এই সংখ্যাগুলোও দেখবে
- [ ] গণনার লজিক বিশুদ্ধ ফাংশনে + ইউনিট টেস্ট (বিদ্যমান `compute-*.test.ts` প্যাটার্ন)
- [ ] build ✅ · lint ✅ · test ✅ · ডক আপডেট ✅

---

### ⬜ ফেজ ৬ / Sprint 11 — টেস্টিং, আইসোলেশন অডিট ও পলিশ

**নির্ভরতা:** সব

- [ ] **ক্রস-টেন্যান্ট অডিট:** নতুন ৯টা টেবিলের প্রতিটার জন্য "B দোকান A-কে দেখতে পায় না"
      অ্যাসারশন — একটাই ফাইলে, একটাই তালিকায়, যাতে ভবিষ্যতে টেবিল যোগ হলে চোখে পড়ে
- [ ] প্রতিটা নতুন RPC-তে `is_shop_owner` গার্ড আছে কিনা — গ্রেপ-ভিত্তিক চেকলিস্ট
- [ ] TanStack Query কী-তে `shopId` আছে কিনা — ক্যাশ-লিক অডিট
- [ ] মিডলওয়্যার প্রিফিক্স বনাম বাস্তব পেজ তালিকা — অরক্ষিত রুট নেই
- [ ] ৩২০px রেসপনসিভ পাস, লোডিং/খালি/এরর স্টেট পাস
- [ ] সেলুন রিগ্রেশন: কিউ, ETA, ইনকাম, বাকি, রিভিউ, চ্যাট — হাতে-কলমে ভেরিফাই
- [ ] `DEVELOPMENT.md`-এ ফেজ ৬-এর সারাংশ ও সিদ্ধান্ত ২৭–৩৬ যোগ
- [ ] build ✅ · lint ✅ · test ✅ · ডক আপডেট ✅

---

## ৭. নির্ভরতার গ্রাফ

```
Sprint 1 (ভিত্তি: bookingModel + terms + categories)
  ├─→ Sprint 2 (পার্লার ড্যাশবোর্ড শেল)
  ├─→ Sprint 3 (পার্লার সার্ভিস)
  │      └─→ Sprint 4 (অ্যাপয়েন্টমেন্ট কোর) ⭐
  │             └─→ Sprint 5 (অ্যাপয়েন্টমেন্ট ম্যানেজমেন্ট + টাকা)
  │                    ├─→ Sprint 6 (মেম্বারশিপ)
  │                    └─→ Sprint 7 (লয়্যালটি)
  │                           ├─→ Sprint 8 (রেফারেল)
  │                           └─→ Sprint 9 (রিওয়ার্ড)
  └──────────────────────────────────→ Sprint 10 (অ্যানালিটিক্স) → Sprint 11 (অডিট)
```

**সমান্তরাল করা যায়:** 2 ও 3। **করা যায় না:** বাকি সব — 4 হলো সরু গলা, 7 হলো 8/9-এর ভিত্তি।

---

## ৮. ঝুঁকি ও প্রশমন

| # | ঝুঁকি | কেন গুরুতর | প্রশমন |
|---|---|---|---|
| R1 | **কিউ ইঞ্জিনে দুর্ঘটনাজনিত রিগ্রেশন** | চালু ব্যবসা এর উপর দাঁড়ানো; এই সেশনেই কিউয়ের সময়-হিসাবে দুটো বাগ ধরা পড়েছে | অ্যাপয়েন্টমেন্ট আলাদা টেবিল (সিদ্ধান্ত ২৪); Sprint 4-এ কিউ ফাংশনের সংজ্ঞা আগে-পরে মিলিয়ে দেখা; প্রতি Sprint-এ সেলুন রিগ্রেশন চেকলিস্ট |
| R2 | **ক্রস-টেন্যান্ট ডেটা লিক** | ইউজারের স্পষ্ট নিরাপত্তা শর্ত; RLS ভুলে গেলে টেবিল নীরবে খোলা থাকে | প্রতিটা টেবিলে RLS **একই মাইগ্রেশনে**; শুধু `is_shop_owner()`; PK-তে `shop_id`; Sprint 11-এর অডিট তালিকা |
| R3 | **ফিচার-বাউন্ডারি সংঘর্ষ** — লয়্যালটি, মেম্বারশিপ, অ্যাপয়েন্টমেন্ট একে অন্যকে দরকার, অথচ ফিচার ফিচারকে import করতে পারে না | eslint লেয়ারিং ভাঙার প্রলোভন | শেয়ার্ড লজিক `src/lib/`-এ বিশুদ্ধ ফাংশন হিসেবে; কম্পোজিশন app স্তরে slot prop দিয়ে — `QueueBoard`-এর `breakSlot` যে প্যাটার্নে |
| R4 | **রিমাইন্ডারের ফ্রিকোয়েন্সি** | Vercel-এর কম প্ল্যানে দিনে একবারের বেশি cron নাও থাকতে পারে | Sprint 5-এর **শুরুতে** প্ল্যান যাচাই; না থাকলে আগের-দিনের রিমাইন্ডার নাইটলিতে, "২ ঘণ্টা আগে" ব্যাকলগে — Sprint আটকাবে না |
| R5 | **`btree_gist` এক্সটেনশন না থাকা** | ওভারল্যাপ কনস্ট্রেইন্টের পূর্বশর্ত | Sprint 4-এর **প্রথম কাজ**: `create extension if not exists` আলাদা ছোট মাইগ্রেশনে, ইউজার আগে চালাবেন; না চললে ফলব্যাক হলো RPC-র ভেতরে `for update` লক (দুর্বল, কিন্তু কাজ চলে) |
| R6 | **পরিভাষা রিফ্যাক্টরের বিস্তার** | "চেয়ার" ডজনখানেক ডিকশনারিতে; একবারে সব বদলালে রিভিউ অসম্ভব | Sprint 1-এ শুধু ৩টা স্লাইস; বাকিগুলো যে Sprint-এ ছোঁয়া হবে সেখানেই |
| R7 | **মাইগ্রেশন হাতে চালানো** | CLI নেই; ইউজার SQL এডিটরে চালান; ৭টা ইতিমধ্যে বকেয়া | প্রতিটা মাইগ্রেশন পুনরায়-চালানো-নিরাপদ; প্রতি Sprint শেষে "কোনগুলো চালাতে হবে" স্পষ্ট তালিকা; `check_migrations.sql` আপডেট |
| R8 | **স্লট ইঞ্জিনের জটিলতা কম আঁচ করা** | কর্মঘণ্টা × ছুটি × বিদ্যমান বুকিং × সার্ভিসের দৈর্ঘ্য × টাইমজোন — কিউয়ের চেয়ে কঠিন | স্লট জেনারেশন বিশুদ্ধ ফাংশনে, RPC-র আগে টেস্ট; সব সময় UTC-তে সংরক্ষণ, রেন্ডারে Asia/Dhaka |
| R9 | **পয়েন্টের রেস কন্ডিশন** | একই সময়ে দুটো রিডিম = ঋণাত্মক ব্যালেন্স | সব মিউটেশন এক RPC-র ভেতরে, `select ... for update`; ঋণাত্মক ব্যালেন্সে CHECK কনস্ট্রেইন্ট |

---

## ৯. ফিউচার ব্যাকলগ (এই ফেজে **নয়**)

**ইউজার স্পষ্ট করে পরে বলেছেন:**
- ভিজিট স্ট্রিক / মাইলস্টোন রিওয়ার্ড
- ব্যক্তিগতকৃত অফার
- জন্মদিনের রিওয়ার্ড
- AI রিকমেন্ডেশন (কোন সার্ভিস পরের বার)
- অ্যাডভান্সড কাস্টমার সেগমেন্টেশন
- অটোমেটেড মার্কেটিং ক্যাম্পেইন

**পরিকল্পনা করতে গিয়ে যা উঠে এসেছে:**
- সার্ভিস প্যাকেজ/বান্ডেল (মেম্বারশিপের `included_service_ids` আংশিক ঢাকে)
- গ্রুপ অ্যাপয়েন্টমেন্ট (কিউয়ের পার্টি বুকিংয়ের অ্যাপয়েন্টমেন্ট-সংস্করণ)
- ওয়েটলিস্ট — স্লট ভরে গেলে
- অ্যাপয়েন্টমেন্টের জন্য ডিপোজিট/অ্যাডভান্স বাধ্যতামূলক করার অপশন
- পয়েন্ট ট্রান্সফার / পারিবারিক অ্যাকাউন্ট
- স্তরভিত্তিক লয়্যালটি (সিলভার/গোল্ড) — এখন সমতল
- এডমিন প্যানেলে প্ল্যাটফর্ম-ব্যাপী লয়্যালটি ওভারভিউ
- **`DEVELOPMENT.md`-এ Sprint 40–45-এর নোট লেখা** (§১.৭)
- `middleware.ts` → `proxy.ts` রিনেম (Next 16 ডিপ্রিকেশন, পূর্ব-বিদ্যমান)

**`DEVELOPMENT.md` §৪-এর পুরনো ব্যাকলগ অপরিবর্তিত ও এখনো প্রযোজ্য** (রিয়েল পেমেন্ট গেটওয়ে,
SMS ভেরিফিকেশন, Google লগইন, মাল্টি-ব্রাঞ্চ, মোবাইল অ্যাপ, অন্য ভার্টিক্যাল…)।

---

## ১০. প্রতি Sprint-এর Definition of Done

একটা বক্স `[x]` হবে **শুধু তখনই** যখন নিচের সবগুলো সত্য:

- [ ] কোড লেখা ও কমিট হয়েছে
- [ ] `npm test` — সব সবুজ, নতুন লজিকের নতুন টেস্ট সহ
- [ ] `npm run build` — সবুজ
- [ ] `npm run lint` — সবুজ (boundaries নিয়ম সহ)
- [ ] মাইগ্রেশন লেখা হয়েছে **এবং** ইউজার SQL এডিটরে চালিয়ে নিশ্চিত করেছেন
- [ ] বিদ্যমান ফিচার হাতে-কলমে যাচাই — বিশেষত সেলুনের কিউ
- [ ] নতুন টেবিলে RLS + আইসোলেশন অ্যাসারশন
- [ ] নতুন রুট মিডলওয়্যারের সঠিক প্রিফিক্স তালিকায়
- [ ] ৩২০px-এ কাজ করে, লোডিং/খালি/এরর স্টেট আছে, সব টেক্সট bn+en
- [ ] এই ফাইলের চেকবক্স + `DEVELOPMENT.md`-এর সারাংশ আপডেট
