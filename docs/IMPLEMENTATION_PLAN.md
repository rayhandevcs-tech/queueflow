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

**স্ট্যাটাস:** Sprint 0 ✅ · Sprint 1 ✅ · Sprint 2 শুরু হয়নি — ইউজারের কনফার্মেশনের অপেক্ষায়।

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

> **⚠️ Sprint 0-এর দুটো ভুল সংশোধন (Sprint 1-এ ধরা পড়েছে)।** উপরের তালিকার শেষ দুটো লাইন
> প্রথমে অন্যভাবে লেখা ছিল, আর সেটা ভুল ছিল — কারণ grep-টা চলেছিল পুরনো ব্রাঞ্চে, `main`-এ
> সুইচ করার আগে:
>
> 1. **`useTerms` আগে থেকেই আছে।** `src/lib/business-terms.ts` কমিট `bd70c90` থেকে
>    বিদ্যমান — ৬টা টার্ম কী, তিন জায়গায় ব্যবহৃত (ProviderSidebar, chairs পেজ, কাস্টমার
>    ShopDetailView)। Sprint 0-এ "কোথাও নেই" লেখা হয়েছিল, যা ভুল। Sprint 1-এ তাই স্তরটা
>    **তৈরি করা হয়নি, বাড়ানো হয়েছে**।
> 2. **এক্সপ্লোর `business_type` দিয়ে ফিল্টার করে না।** `FilterSheet.tsx`-এ স্পষ্ট
>    সিদ্ধান্ত লেখা আছে: *"Business type is deliberately absent: it decides which product a
>    shop runs, not something a customer browsing nearby shops wants to slice by."* সেই
>    সিদ্ধান্ত বহাল রাখা হয়েছে — `women_only` আলাদা অক্ষ, তাই সেটাই ফিল্টারে যোগ হয়েছে।

**অর্থ:** ইউজারের প্রস্তাবিত "Sprint 1 — Business Type System"-এর ডেটা-স্তর প্রায় সম্পূর্ণ,
কিন্তু **আসল কাজটা** (রাউটিং ফর্ক + পরিভাষা স্তর) পুরোটাই বাকি। Sprint 1 তাই ছোট হবে না,
শুধু আকার বদলাবে — মাইগ্রেশন কম, ব্রাঞ্চিং বেশি।

### ১.৬ যা নেই (গ্যাপ)

| যা দরকার | অবস্থা |
|---|---|
| `appointments` টেবিল / স্লট ইঞ্জিন | নেই — শূন্য থেকে |
| পরিভাষা রেজলভার (`useTerms`) | ~~নেই~~ → **আছে** (`src/lib/business-terms.ts`), শুধু বাড়াতে হবে |
| `service_categories` DB টেবিল | নেই — `src/config/constants.ts`-এ হার্ডকোডেড ৭টা, `business_type` ট্যাগ ছাড়া। **তবে ক্যাটাগরি অক্ষটাই সুপ্ত** — সার্ভিস ফর্মে কোনো পিকার নেই, প্রতিটা সার্ভিস হার্ডকোড `"OTHER"` (§৬ Sprint 1 নোট দেখো) |
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

## ২. নতুন কনফার্মড সিদ্ধান্ত (২৭–৪৮)

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
37. **(Sprint 1) পার্লারের ড্যাশবোর্ডে লাইভ সিরিয়াল থাকবে না — একটুও নয়।** পার্লার
    অ্যাপয়েন্টমেন্টের ব্যবসা; ট্রানজিশনের নামে দ্বিতীয় একটা স্ববিরোধী স্ক্রিন রাখলে
    মালিক শিখবেন ভুল প্রোডাক্টটা। তাই পার্লারের ড্যাশবোর্ড = অ্যাপয়েন্টমেন্ট হোম, ব্যস।

    > **ইতিহাস (স্বচ্ছতার জন্য):** প্রথম বাস্তবায়নে দ্বিতীয় ট্যাবে লাইভ সিরিয়াল রাখা
    > হয়েছিল — যুক্তি ছিল "আজ যে পার্লার সিরিয়ালে বাস্তব কাস্টমার সামলাচ্ছে তার বোর্ড
    > কেড়ে নেওয়া যাবে না"। **Sprint 1 রিপোর্টের পর ইউজার সেটা নাকচ করেছেন**, এবং তাঁর
    > মূল Sprint 1 ব্রিফও তা-ই বলেছিল: "Beauty Parlour account-এ login করলে যেন আর Live Queue
    > dashboard না আসে"। ফলাফল নিচের **স্বীকৃত ফাঁক**।

    **স্বীকৃত ফাঁক:** Sprint 4–5-এ অ্যাপয়েন্টমেন্ট ইঞ্জিন না আসা পর্যন্ত পার্লারের কোনো
    **কার্যকর অপারেশনাল বোর্ড নেই** — ড্যাশবোর্ড read-only (গণনা + সেটআপ লিঙ্ক)। কিউয়ের
    ডেটা বা রুট কিছুই মোছা হয়নি, শুধু পার্লারের ড্যাশবোর্ড থেকে দেখানো বন্ধ; সিদ্ধান্ত
    বদলালে ফিরিয়ে আনা এক কমিটের কাজ। এটাই Sprint 4-কে এই ফেজের সবচেয়ে জরুরি আইটেম করে।
38. **(Sprint 2) পরিভাষা নয়, গোটা বাক্য আলাদা হলে `byModel()`।** সিদ্ধান্ত ২৮ বলে বিশেষ্য
    (চেয়ার/সিট, স্টাফ/বিউটিশিয়ান) আসবে `business-terms.ts` থেকে, আর কম্পোনেন্টে
    `if (parlour)` লেখা নিষিদ্ধ। কিন্তু কিছু জায়গায় পার্থক্যটা বিশেষ্যের নয়, **ব্যাখ্যার** —
    "প্রতিটা চেয়ার বোর্ডে একটা লেন" বনাম "প্রতিটা সিট সময়সূচিতে একটা কলাম"। এর জন্য
    `byModel(type, { QUEUE, APPOINTMENT })` — দুই শাখাই বাধ্যতামূলক, তাই ভবিষ্যতে তৃতীয়
    মডেল যোগ হলে প্রতিটা কল সাইটে কম্পাইল এরর হবে, নীরবে একটা শাখা বাদ পড়বে না।
    এখন ব্যবহৃত: ৩ জায়গায় (`/chairs` বর্ণনা, স্টাফ ছবির হিন্ট, রঙের লেবেল)।
39. **(Sprint 2) বোর্ড আগে, ইঞ্জিন পরে — সিমটা একটা টাইপ আর একটা হুক।**
    `AppointmentCard` (ভিউ মডেল) + `useTodayAppointments()` — Sprint 4-এ `appointments`
    টেবিল এলে **শুধু ওই হুকের `queryFn`-এর বডি** বদলাবে, স্ক্রিনের একটা লাইনও নয়।
    হুকটা ইচ্ছাকৃতভাবে আসল `useQuery`, খালি `return []` নয়: তাতে `isPending`/`isError`
    স্টেট আজই লেখা ও পরীক্ষিত হলো, Sprint 4 গিয়ে আবিষ্কার করতে হলো না যে স্ক্রিনটার
    লোডিং বা এরর অবস্থা কখনো ভাবাই হয়নি। ভিউ মডেল ইচ্ছাকৃতভাবে DB সারির নকল নয় —
    টাকার কলাম, `services_snapshot`, `reschedule_of` তখনই ঢুকবে যখন কোনো স্ক্রিন পড়বে।
40. **(Sprint 3) সার্ভিস ক্যাটাগরি কোড-লেভেল তালিকা, `service_categories` টেবিল নয়।**
    §৩-এর মূল খসড়ায় একটা টেবিল + `services.category_id` FK ছিল। কোড পড়ে সিদ্ধান্ত
    বদলানো হলো, কারণ:
    - **আইকন যেভাবেই হোক কোডে থাকতে হবে** (`service-category-icon.ts`)। Postgres-এ
      বসানো একটা নতুন সারি আইকন সঙ্গে আনতে পারে না — সে কার্ডে ফাঁকা রেন্ডার করবে।
      অর্থাৎ ক্যাটাগরি এমন ডেটা নয় যা বাইরে থেকে গ্রহণ করা যায়।
    - **টাইপ নিরাপত্তা:** এক্সপ্লোরের শর্টকাট সারি, ফিল্টার আর আইকন ম্যাপ — তিনটেই
      `ServiceCategory` ইউনিয়নের উপর দাঁড়ানো। টেবিল মানে রানটাইম স্ট্রিং, পাঁচটা
      ফাইলে টাইপ নিরাপত্তা হারানো।
    - **খরচ:** এক্সপ্লোর সব দোকানের সব সক্রিয় সার্ভিস একবারে আনে
      (`getAllActiveServices`)। ওই কোয়েরিতে একটা join বসানোর দাম আছে, লাভ নেই।
    - **কেউ চালাবে না:** ক্যাটাগরি CRUD-এর এডমিন স্ক্রিন নেই, আর সেটা এই ফেজের
      স্কোপেও নেই।

    **যা হারানো হয়নি:** ভবিষ্যতে টেবিল দরকার হলে আজকের text কলামই ব্যাকফিলের উৎস —
    ঠিক যে দুই-ধাপের পথ মূল প্ল্যানে লেখা ছিল। অর্থাৎ সিদ্ধান্তটা স্থগিত, বন্ধ নয়।
42. **(Sprint 4) দাম ও সময় বুকিংয়ের মুহূর্তে জমাট।** `appointments.services_snapshot`
    আর `total_amount` ইনসার্ট ট্রিগারে বসে, এবং আপডেট ট্রিগার প্রতিবার সেগুলো
    পুরনো মানে ফিরিয়ে দেয়। রেট বদলালে গত মাসের অ্যাপয়েন্টমেন্টের হিসাব বদলাবে
    না — `serials` ঠিক এই নিয়মেই চলে।

    একটা সূক্ষ্ম পার্থক্য আছে: স্লটের দৈর্ঘ্য নেওয়া হয়
    `services.default_duration_min` থেকে, চেয়ারের **শেখা গড়** থেকে নয়। শেখা গড়
    কিউয়ের জিনিস — সেখানে অনুমান যত ভালো তত ভালো। অ্যাপয়েন্টমেন্টে দোকানদার যে
    সময় বলে স্লটটা বেচেছে, সেটাই কাস্টমারের সঙ্গে চুক্তি; পেছনে গড় বদলে গেলে
    বুক করা স্লট নিজে থেকে লম্বা বা ছোট হয়ে যেতে পারে না।
43. **(Sprint 4) ওভারল্যাপ ঠেকায় শুধু EXCLUDE কনস্ট্রেইন্ট — কোনো প্রি-চেক নয়।**
    `book_appointment()` "আগে দেখি খালি আছে কিনা" করে না, সরাসরি ইনসার্ট করে।
    কারণ চেক আর ইনসার্টের মাঝখানে সবসময় একটা উইন্ডো থাকে; দুটো ব্রাউজার ওই
    উইন্ডোতে ঢুকলে দুজনেই "খালি" দেখে। `exclude using gist (staff_id with =,
    tstzrange(starts_at, ends_at) with &&)` ইনসার্টের মুহূর্তেই সিদ্ধান্ত নেয়,
    তাই হারানোর মতো কোনো উইন্ডো নেই। UI-র স্লট গ্রিড একটা **স্ন্যাপশট, রিজার্ভেশন
    নয়** — এই পার্থক্যটাই `slot_taken` বার্তাটার কারণ।
45. **(Sprint 4) মাইগ্রেশন হাতে চালানোর আগে লোকাল Postgres-এ চালিয়ে দেখা হবে।**
    এই প্রজেক্টে মাইগ্রেশন SQL এডিটরে হাতে চলে, অর্থাৎ **একজন মানুষ চালানোর আগে
    ফাইলটা কখনো চলে না** — আর যে ফাইল কখনো চলেনি সেটা কোড নয়, অনুমান।
    `supabase/tests/run-local-checks.sh` একটা অস্থায়ী ক্লাস্টার বানিয়ে আসল
    ফাইলটাই চালায়।

    **এটা তত্ত্ব নয় — Sprint 4-এই কাজে লেগেছে:** প্রথম ড্রাফটে
    `payment_status public.payment_status` লেখা ছিল, কারণ `database.types.ts`-এর
    `Enums` ব্লক দেখে ধরে নিয়েছিলাম ওগুলো আসল Postgres enum। **এই স্কিমায়
    একটাও enum টাইপ নেই** — সব `text` + CHECK। ইউজারের ডেটাবেসে চালাতে গিয়ে
    `type "public.payment_status" does not exist` এসেছিল; এখন হার্নেসটা এই
    শ্রেণির ভুল আগেই ধরবে।

44. **(Sprint 4) `book_appointment()` SECURITY INVOKER, `shop_available_slots()`
    SECURITY DEFINER — এবং এটা উল্টো নয়।** বুকিং ইনভোকারের অধিকারে চলে, তাই RLS
    পলিসিগুলোই আইসোলেশনের গ্যারান্টি; DEFINER করলে গ্যারান্টিটা ফাংশনের নিজের
    কোডের উপর নির্ভরশীল হতো। স্লট ফাংশনটা DEFINER হতেই হয় — কোন সময় ভরা সেটা
    জানতে অন্য কাস্টমারের সারি দেখা লাগে, যা RLS-এ নিষিদ্ধ — কিন্তু সে **কখনো কে
    বুক করেছে তা ফেরায় না**, শুধু ফাঁকা সময় ফেরায়।

41. **(Sprint 3) সময়ের একক মিনিট — একটাই, সব জায়গায়।** ঘণ্টা+মিনিট শুধু **ইনপুট আর
    ডিসপ্লের** ধারণা; সংরক্ষণ হয় `services.default_duration_min`-এ একটাই সংখ্যা।
    কারণ `chair_service_stats.rolling_avg_duration_min`, `estimate_duration_on_chair()`
    আর `20260904`-এর শেখার ট্রিগার — সবই মিনিট গোনে। স্টোরেজ ভাগ করা মানে কিউ
    ইঞ্জিনে হাত দেওয়া, যেটা একটা পার্লার ফিচারের কাজ নয়।

46. **(Sprint 5) স্টাফের সারি না থাকা মানে সে ওই দিন কাজ করে না।**
    `staff_working_hours`-এ (chair, weekday) সারি না থাকলে ওই দিন তার কোনো স্লট
    নেই — দোকানের সময় ধরে নেওয়া হয় **না**। কারণ একজন বিউটিশিয়ান দোকানে
    নিবন্ধিত আছে বলেই দোকানের পুরো সময় জুড়ে তাকে বেচে দেওয়া যায় না।

    নিয়মটা নিজে থেকে ধ্বংসাত্মক হতো — চালু করার দিনই সব স্টাফ অদৃশ্য হয়ে যেত।
    তাই মাইগ্রেশন **প্রতিটা বিদ্যমান চেয়ারের জন্য দোকানের সময় থেকে সারি সিড
    করে**, আর নতুন চেয়ারও একটা ট্রিগারে একইভাবে শুরু করে। ফলে আচরণ প্রথম দিন
    অপরিবর্তিত, আর মালিক এরপর প্রত্যেকের সময় সংকুচিত করেন। সিড করা সারিগুলো
    আসল, সম্পাদনযোগ্য ডেটা — অন্তর্নিহিত অনুমান নয়, সেটাই পার্থক্য।

    "ওই দিন ছুটি" আলাদা `is_working` পতাকা দিয়ে নয়, **সারি না থাকা** দিয়েই বোঝানো
    হয় — একই তথ্যের দুটো বানান থাকলে তারা একদিন দ্বিমত করত।
47. **(Sprint 5) রিশিডিউলে সারি থাকে, ইতিহাস আলাদা টেবিলে।** দুটো পথ ছিল:
    (ক) পুরনোটা বাতিল করে নতুন সারি (`reschedule_of` FK), (খ) সারিটা রেখে
    আলাদা অডিট টেবিল। **(খ) নেওয়া হলো**, কারণ id স্থির থাকলে কাস্টমারের লিঙ্ক,
    নোটিফিকেশন আর "আমার অ্যাপয়েন্টমেন্ট" সব একই জিনিস দেখাতে থাকে; আর UPDATE-এ
    EXCLUDE কনস্ট্রেইন্ট এমনিতেই আবার যাচাই করে, তাই ওভারল্যাপের জন্য নতুন কোড
    লাগে না।

    ইতিহাস হারানোর ঝুঁকিটা এভাবে বন্ধ: সময়/স্টাফ কলাম সাধারণ UPDATE-এ জমাট
    (`queueflow.reschedule` সেশন ফ্ল্যাগ ছাড়া বদলায় না — 20260904-এর
    `queueflow.stats_write`-এর একই কৌশল), আর সারিটা সরলেই একটা **AFTER UPDATE
    ট্রিগার** আগের-পরের অবস্থা `appointment_reschedules`-এ লিখে দেয়। টেবিলটায়
    কোনো INSERT পলিসি নেই, তাই ইতিহাস বাদ পড়াও যায় না, বানানোও যায় না।
48. **(Sprint 5) একটাই টাইমজোন, একটাই জায়গায়: `shop_timezone()`।**
    `starts_at` timestamptz, আর `weekly_hours`/`staff_working_hours`-এ সময় লেখা
    দেয়াল-ঘড়ির স্ট্রিং — দুটো মেলাতে টাইমজোন লাগে। কোডবেসে আগে থেকেই
    `'Asia/Dhaka'` হার্ডকোড ছিল (`send_customer_reminders`), তাই নতুন কনভেনশন
    বানানো হয়নি; শুধু ধ্রুবকটা একটা ফাংশনে জড়ো করা হয়েছে, যাতে ভবিষ্যতে
    `shops.timezone` কলাম এলে একটাই জায়গা বদলাতে হয়।

    ব্রাউজারে কোনো টাইমজোন রূপান্তর নেই — timestamptz-কে ডিভাইসের লোকাল সময়ে
    দেখানো হয়। বাংলাদেশে দুটো এক, তাই মালিক আর কাস্টমার একই ঘড়ি দেখেন।
    **সীমা:** বিদেশ থেকে খোলা অ্যাপে সময় তার নিজের জোনে দেখাবে; সেটা সমাধান হবে
    যেদিন `shops.timezone` আসবে (ব্যাকলগ)।

---

## ৩. ডেটাবেস পরিবর্তনের সম্পূর্ণ তালিকা

> প্রতিটা মাইগ্রেশন `supabase/migrations/`-এ, তারিখ-ক্রমে `20260916`+ থেকে শুরু। প্রতিটাই
> পুনরায় চালানো নিরাপদ (`create ... if not exists`, `drop policy if exists` + `create`)।

### Sprint 1 — ✅ চালানো হয়েছে (`20260916_parlour_foundation.sql`)
```
alter table shops add column women_only boolean not null default false;
```

### Sprint 3 — ✅ লেখা হয়েছে (`20260917_service_categories.sql`), চালানো বাকি
```
-- services.category-র CHECK ৭ → ১২ ভ্যালু। অ-ধ্বংসাত্মক: নতুন সেট পুরনোর সুপারসেট।
alter table services drop constraint <পুরনো ইনলাইন check>;   -- নাম খুঁজে নেওয়া হয়
alter table services add constraint services_category_check
  check (category is null or category in (
    'HAIRCUT','SHAVE','COLOR','FACIAL','SPA',
    'THREADING','WAXING','MEHENDI','MAKEUP','NAILS','BRIDAL','OTHER'));
```
> ~~`create table service_categories` + `services.category_id` FK~~ — **বাতিল,
> সিদ্ধান্ত ৪০**। ক্যাটাগরি এখন `src/config/constants.ts`-এ কোড-লেভেল তালিকা।
> ভবিষ্যতে টেবিল লাগলে এই text কলামই ব্যাকফিলের উৎস, তাই পথ বন্ধ হয়নি।
>
> সময়ের জন্য **কোনো DB পরিবর্তন নেই** — `default_duration_min` (মিনিট) একই থাকল,
> সিদ্ধান্ত ৪১।

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

### ✅ ফেজ ৬ / Sprint 1 — বিজনেস টাইপ সিস্টেম (ভিত্তি)

**নির্ভরতা:** কিছু নেই। **সবগুলোর পূর্বশর্ত।**

- [x] `src/lib/business-model.ts` — `bookingModel()` রেজলভার (সিদ্ধান্ত ২৭) + ৬টা ইউনিট টেস্ট
- [x] ~~`src/lib/terms.ts` তৈরি~~ → **বিদ্যমান `src/lib/business-terms.ts` বাড়ানো হয়েছে**
      (`board` টার্ম যোগ) + ৮টা ইউনিট টেস্ট — §১.৫-এর সংশোধন দেখো
- [x] `/dashboard`-এ ব্রাঞ্চিং পয়েন্ট: পার্লার → `ParlourDashboard`, সেলুন → `QueueBoard`
- [x] নতুন স্লাইস `provider-appointments` — পার্লারের হোম স্ক্রিন (foundation, ইঞ্জিন নয়)
- [x] প্রোভাইডার সাইডবার `bookingModel` অনুযায়ী: পার্লারে লেবেল "অ্যাপয়েন্টমেন্ট",
      ক্যালেন্ডার আইকন, লাইভ-কাউন্ট ব্যাজ বন্ধ
- [x] মাইগ্রেশন `20260916_parlour_foundation.sql` — `shops.women_only`
- [x] শপ সেটিংসে "শুধু মহিলাদের জন্য" টগল (`WomenOnlyToggle`)
- [x] এক্সপ্লোরে `women_only` ফিল্টার + শপ কার্ডে ব্যাজ
- [x] মিডলওয়্যার প্রিফিক্স যাচাই — এই Sprint-এ নতুন রুট নেই, তাই কোনো পরিবর্তন লাগেনি
- [x] রিগ্রেশন: সেলুনের রেন্ডার পাথ অপরিবর্তিত; সাইডবার লেবেল অক্ষরে অক্ষরে এক
      (টেস্টে লক করা)
- [x] build ✅ · lint ✅ (বেসলাইনের সমান) · test ✅ · ডক আপডেট ✅
- [x] **মাইগ্রেশন ভেরিফাইড** — ইউজার `20260916` (এবং বকেয়া `20260909`–`20260915`)
      Supabase SQL এডিটরে চালিয়েছেন, সফল
- [x] **ফলো-আপ:** সিদ্ধান্ত ৩৭ ইউজারের নির্দেশে উল্টে দেওয়া হয়েছে — পার্লার
      ড্যাশবোর্ড থেকে লাইভ সিরিয়াল ট্যাব সরানো (§২ সিদ্ধান্ত ৩৭ দেখো)

**⚠️ স্কোপ থেকে বাদ দেওয়া হয়েছে — `service_categories`:**

প্ল্যানে Sprint 1-এ `service_categories` টেবিল + `services.category_id` ছিল। কোড পড়ে দেখা
গেল **ক্যাটাগরি অক্ষটাই এই কোডবেসে সুপ্ত**: `ServiceForm.tsx`-এ কোনো ক্যাটাগরি পিকার নেই
(আগের এক স্প্রিন্টে ইচ্ছাকৃতভাবে সরানো — ফাইলের কমেন্টে লেখা আছে), তাই প্রতিটা সার্ভিস
হার্ডকোড `"OTHER"` হিসেবে সেভ হয়। ফলে:

- DB টেবিল বানালে **কেউ তাতে লিখতে পারবে না** — পিকার নেই।
- কোড-লেভেলে পার্লার ক্যাটাগরি যোগ করলেও **দেখা যাবে না** — পিকার নেই।
- আর `services.category`-তে একটা CHECK কনস্ট্রেইন্ট আছে (20260802), তাই যেকোনো নতুন
  ভ্যালুর জন্য মাইগ্রেশন লাগবেই — অর্থাৎ "সস্তা কোড-লেভেল সংস্করণ" বলে কিছু নেই।

**সিদ্ধান্ত:** পুরো আইটেমটা **Sprint 3-এ সরানো হলো**, যেখানে প্ল্যানের চেকলিস্টে এমনিতেই
"সার্ভিস ফর্মে ক্যাটাগরি পিকার" আছে — পিকার আর ক্যাটাগরির তালিকা একসাথে এলে দুটোই কাজে
লাগবে, আলাদা এলে কোনোটাই না। এতে ইউজারের হাতে একটা অপ্রয়োজনীয় মাইগ্রেশনও চাপানো হলো না।

**ঝুঁকি যা বাস্তবে হয়নি:** "পরিভাষা রিফ্যাক্টর ডজনখানেক ফাইল ছোঁবে" — ছোঁয়নি, কারণ স্তরটা
আগে থেকেই ছিল এবং তিন জায়গায় বসানোও ছিল। শুধু একটা নতুন কী (`board`) লেগেছে।

---

### ✅ ফেজ ৬ / Sprint 2 — বিউটি পার্লার ড্যাশবোর্ড (শেল)

**নির্ভরতা:** Sprint 1

- [x] `provider-appointments` স্লাইস তৈরি (খালি স্টেট সহ) — Sprint 1-এ হয়ে গেছে
- [x] `AppointmentBoard` শেল — বিউটিশিয়ান কলাম × সময় সারি, আজকের দিন
      - কলাম আসে `chairs` থেকে, সময়ের অক্ষ `shops.weekly_hours` থেকে — দুটোই আসল ডেটা
      - বুকিং এখনো নেই (Sprint 4), তাই গ্রিড আঁকা হয় কিন্তু খালি, আর **কেন খালি** সেটা লেখা থাকে
- [x] বিশুদ্ধ সময়-গণিত `lib/schedule.ts` + ২৩টা ইউনিট টেস্ট
- [x] অ্যাপয়েন্টমেন্ট স্টেট ও ভিজ্যুয়াল ট্রিটমেন্ট (`lib/status.ts`) — ছয়টা স্ট্যাটাসই
      বিদ্যমান ব্যাজ টোনে ম্যাপ করা, নতুন রং নয়
- [x] Sprint 4-এর সিম: `lib/types.ts` (`AppointmentCard`) + `hooks/use-today-appointments.ts`
      — টেবিল এলে **শুধু `queryFn`-এর বডি** বদলাবে
- [x] `keys.appointments.byShopDay()` — সেন্ট্রাল কোয়েরি-কী, Sprint 4-এর জন্যও এটাই
- [x] পার্লারের ড্যাশবোর্ড কার্ড: আজকের অ্যাপয়েন্টমেন্ট, আজ চালু সিট, সার্ভিস
      (⚠️ "আজকের আয়" ও "নতুন সদস্য" বাদ — কারণ নিচে)
- [x] `/chairs` পার্লারে সিট/বিউটিশিয়ান পরিভাষায় — ১০টা স্ট্রিং `business-terms.ts` থেকে
      টার্ম নেয়, আর ৩টা বাক্য `byModel()` দিয়ে মডেল-ভিত্তিক
- [x] খালি/লোডিং/এরর স্টেট: স্টাফ নেই / আজ বন্ধ / সময় সেট নেই / আজ কোনো বুকিং নেই — চারটাই আলাদা
- [x] ৩২০px: এক গ্রিড, সময়ের গাটার পিন করা, কলাম পাশে স্ক্রল (কোড-লেভেল; ডিভাইসে মাপা হয়নি)
- [x] রিগ্রেশন: সেলুন ড্যাশবোর্ড অপরিবর্তিত — `QueueBoard` কম্পোজিশনে হাত পড়েনি
- [x] build ✅ · lint ✅ (বেসলাইন) · test ✅ ২৬৪টা · ডক আপডেট ✅
- [ ] **ব্রাউজার ভেরিফিকেশন** — এই কন্টেইনারে Supabase ক্রেডেনশিয়াল নেই, তাই
      পার্লার/সেলুন দুই অ্যাকাউন্টে ঢুকে দেখা **হয়নি**। ডিপ্লয়ের পর ম্যানুয়াল ধাপ।

**⚠️ প্ল্যান থেকে বিচ্যুতি — দুটো স্ট্যাট কার্ড বাদ:**

চেকলিস্টে ছিল "আজকের অ্যাপয়েন্টমেন্ট, **আজকের আয়**, **নতুন সদস্য** (প্লেসহোল্ডার)"।
আয় হিসাব হয় অ্যাপয়েন্টমেন্টের টাকার কলাম থেকে (Sprint 4), আর সদস্য মানে মেম্বারশিপ
(Sprint 6) — দুটোরই কোনো উৎস আজ নেই। তিনটে শূন্য পাশাপাশি বসালে মালিক ভাববেন আজ কিছু
হয়নি, অথচ আসল কথা হলো ফিচারটাই নেই। তাই ওই দুটোর জায়গায় **আজ চালু সিট** আর **সার্ভিস**
বসানো হলো — দুটোই সত্যিকারের সংখ্যা, আর দুটোই অ্যাপয়েন্টমেন্ট চালুর পূর্বশর্ত।
আয় ও সদস্য কার্ড যথাক্রমে Sprint 4 ও Sprint 6-এ, যখন সংখ্যাটা সত্যি হবে।

---

### ✅ ফেজ ৬ / Sprint 3 — পার্লার সার্ভিস ম্যানেজমেন্ট

**নির্ভরতা:** Sprint 1

- [x] **সার্ভিস ফর্মে ক্যাটাগরি পিকার ফিরিয়ে আনা** — `CategoryPicker` (১২টা পিল)।
      আগে কোনো পিকারই ছিল না, তাই প্রতিটা সার্ভিস `"OTHER"` বা `NULL` হিসেবে সেভ হতো
- [x] পার্লার ক্যাটাগরি (থ্রেডিং, ওয়্যাক্সিং, মেহেদি, মেকআপ, নেইল) + `business_type` ট্যাগ
      — `CATEGORY_TRADES` ম্যাপ + `categoriesFor()`, ১৩টা ইউনিট টেস্ট
- [x] **সিদ্ধান্ত: কোড-লেভেল তালিকা, DB টেবিল নয়** (সিদ্ধান্ত ৪০ — কারণ নিচে)
- [x] মাইগ্রেশন `20260917_service_categories.sql` — CHECK ৭ → ১২ ভ্যালু, অ-ধ্বংসাত্মক,
      শেষে কমেন্ট-করা ভেরিফিকেশন SQL
- [x] দীর্ঘ সার্ভিসের জন্য সময়ের ইনপুট ঘণ্টা+মিনিটে — `DurationField` + ৭টা প্রিসেট।
      **স্টোরেজ মিনিটেই থাকল** (`default_duration_min`), কারণ কিউ ইঞ্জিন ও শেখার
      ট্রিগার ওটাই গোনে (সিদ্ধান্ত ৪১)
- [x] `src/lib/duration.ts` + ১১টা টেস্ট — `splitDuration`/`joinDuration`/`formatDuration`
- [x] ভ্যালিডেশন: দৈর্ঘ্য ১–৪৮০ মিনিট, দাম ০–৯৯৯৯৯, নাম ২–৬০ অক্ষর, ক্যাটাগরি
      শপের অনুমোদিত তালিকার বাইরে হলে reject — UI সবসময় DB-র চেয়ে **কড়া**, ঢিলে নয়
- [x] সার্ভিস-প্রতি "কোন স্টাফ করতে পারে" — `CanPerformMatrix` **আগে থেকেই আছে**
      (`/services` পাতায় রেন্ডার হয়), নতুন কিছু লাগেনি
- [x] প্যাকেজ নয় (ব্যাকলগ) — শুধু একক সার্ভিস
- [x] রিগ্রেশন (কোড-লেভেল): সেলুনের ক্যাটালগে সাতটা পুরনো ক্যাটাগরিই আছে, কিউয়ের সময়
      হিসাবের কোনো ইনপুট বদলায়নি — `default_duration_min` একই কলাম, একই একক
- [x] build ✅ · `tsc --noEmit` ✅ · lint ✅ (বেসলাইন) · test ✅ ২৮৮টা · ডক আপডেট ✅
- [ ] **মাইগ্রেশন ভেরিফাইড** — ইউজারকে `20260917` SQL এডিটরে চালাতে হবে
- [ ] **ব্রাউজার ভেরিফিকেশন** — কন্টেইনারে ক্রেডেনশিয়াল নেই, ম্যানুয়াল ফলো-আপ

**অতিরিক্ত যা পাওয়া গেল (নতুন কাজ নয়):** কাস্টমার এক্সপ্লোরের ক্যাটাগরি শর্টকাট সারি
(`CategoryShortcutRow`) **আগে থেকেই লাইভ** ছিল, কিন্তু পিকার না থাকায় কার্যত খালি।
পিকার ফেরায় মেহেদি/মেকআপ/নেইল দিয়েও এখন দোকান খোঁজা যাবে — কোনো নতুন কোড ছাড়াই।

---

### ✅ ফেজ ৬ / Sprint 4 — অ্যাপয়েন্টমেন্ট সিস্টেম ⭐ (এই ফেজের সবচেয়ে বড়)

**নির্ভরতা:** Sprint 1, 2, 3

- [x] মাইগ্রেশন `20260918_appointment_core.sql`: `btree_gist`, `appointment_status`,
      `appointments` টেবিল, `appointments_no_overlap` EXCLUDE কনস্ট্রেইন্ট, ৫টা RLS
      পলিসি, ৪টা ইনডেক্স, ২টা ট্রিগার, ২টা RPC
- [x] `shop_available_slots()` RPC — দোকানের সাপ্তাহিক সময়, সার্ভিসের দৈর্ঘ্য,
      স্টাফের দক্ষতা, বিদ্যমান বুকিং আর ১৫-মিনিটের গ্রিড একসাথে
- [x] `book_appointment()` RPC — **SECURITY INVOKER**, তাই RLS বহাল; 23P01-কে
      `slot_taken`-এ অনুবাদ করে
- [x] বাতিল: আলাদা RPC নয়, `cancelMySerial`-এর মতোই সরাসরি UPDATE (কাস্টমারের
      পলিসি শুধু CANCELLED গ্রহণ করে, ট্রিগার বাকিটা আটকায়)
- [x] বন্ধুসুলভ এরর ম্যাপিং — ৮টা নতুন বার্তা `db-errors.ts`-এ
- [x] কাস্টমার: `AppointmentBookingSheet` — দিন → বিউটিশিয়ান → সময় → নিশ্চিত।
      `ShopDetailView` বিজনেস টাইপ অনুযায়ী ব্রাঞ্চড; পার্টি সেকশন পার্লারে লুকানো
- [x] `/my-serial`-এ `MyAppointmentsList` — কোনো অ্যাপয়েন্টমেন্ট না থাকলে
      **কিছুই রেন্ডার করে না**, তাই সেলুন কাস্টমারের পাতা হুবহু আগের মতো
- [x] Sprint 2-এর `useTodayAppointments` আসল ডেটায় যুক্ত — শুধু `queryFn`-এর বডি
      বদলেছে, বোর্ডের একটা লাইনও নয় (সিদ্ধান্ত ৩৯ কাজে লেগেছে)
- [x] প্রোভাইডার: `AppointmentDetailSheet` — স্ট্যাটাস লাইফসাইকেল চালানোর UI
- [x] স্ট্যাটাস মেশিন DB-তে + `status-machine.ts`-এ আয়না, ১৩টা টেস্ট
- [x] মিডলওয়্যার: নতুন রুট নেই, তাই পরিবর্তন লাগেনি
- [x] **রিগ্রেশন:** মাইগ্রেশনে `serials`/`chairs`/`services`/`shops`-এ একটাও
      `alter`/`update` নেই; কিউয়ের কোনো ফাংশন বা ট্রিগার পুনরায় লেখা হয়নি
- [x] build ✅ · `tsc --noEmit` ✅ · lint ✅ (বেসলাইন) · test ✅ ৩০১টা · ডক আপডেট ✅
- [x] **মাইগ্রেশন লোকাল Postgres 16-এ চালিয়ে যাচাই করা হয়েছে** —
      `supabase/tests/run-local-checks.sh`, **৪০/৪০ পাস**। গঠন, ইনসার্ট ট্রিগার,
      স্ট্যাটাস মেশিন, RLS আইসোলেশন (আসল non-superuser রোলে), স্লট RPC
- [x] কনকারেন্সি **লোকাল Postgres-এ** যাচাই — ৮টা সমান্তরাল ক্লায়েন্ট একই স্লট
      চেয়েছে, ঠিক ১টা টিকেছে, বাকি ৭টা `appointments_no_overlap`-এ আটকেছে
- [ ] **কনকারেন্সি প্রোব ইউজারের ইনস্ট্যান্সে** — ইউজার নিজে SQL এডিটরের দুই
      ট্যাবে চালাবেন (প্রোবটা `20260918`-এর শেষে)। লোকাল ফল যথেষ্ট ধরা হচ্ছে না
- [x] প্রথম ড্রাফটের বাগ ধরা পড়েছে ও সারানো হয়েছে: `payment_status`/`status`
      Postgres enum ধরে নেওয়া হয়েছিল, অথচ **এই স্কিমায় একটাও enum নেই** —
      সব `text` + CHECK (সিদ্ধান্ত ৪৫)
- [x] **ইউজারের Supabase ইনস্ট্যান্সে চালানো ও যাচাই করা হয়েছে** —
      `20260917` ১৬/১৬ ✅, `20260918` ১৭/১৭ ✅। `serials untouched` আর
      `no stray appointment_status enum type` দুটোই পাস
- [ ] **ব্রাউজার ভেরিফিকেশন** — ক্রেডেনশিয়াল নেই, ম্যানুয়াল ফলো-আপ

**স্কোপে যা ইচ্ছাকৃতভাবে নেওয়া হয়নি (পরের স্প্রিন্টে):**

- `staff_working_hours` / `staff_time_off` — প্রতি-স্টাফ কর্মঘণ্টা ও ছুটি। আজ
  স্লট আসে **দোকানের** সাপ্তাহিক সময় থেকে। ইউজারের Sprint 4 ব্রিফে এটা নেই,
  আর অর্ধেক বানালে "খোলা দেখাচ্ছে কিন্তু ও আজ ছুটিতে" তৈরি হতো। → Sprint 5
- **রিশিডিউল** — `starts_at`/`ends_at`/`staff_id` আপডেট ট্রিগারে জমাট। ব্রিফে নেই,
  আর অর্ধেক পথ খোলা রাখলে ওভারল্যাপ কনস্ট্রেইন্ট পাশ কাটানোর ফাঁক হতো। → Sprint 5
- **নোটিফিকেশন/রিমাইন্ডার** — ব্রিফে স্পষ্ট নিষেধ। `appointments.reminded_at`
  কলামটা শুধু জায়গা ধরে রাখে; কেউ লেখে না, কেউ পড়ে না
- **ইনকাম/বাকির খাতায় অ্যাপয়েন্টমেন্ট** — টাকার কলামগুলো serials-এর নকল করে
  রাখা হয়েছে (সিদ্ধান্ত ২৯) যাতে পরে যোগ করা সহজ হয়, কিন্তু এই স্প্রিন্টে কোনো
  রিপোর্ট ওগুলো পড়ে না

---

### ✅ ফেজ ৬ / Sprint 5 — অ্যাভেইলেবিলিটি ও লাইফসাইকেল

**নির্ভরতা:** Sprint 4

- [x] মাইগ্রেশন `20260919_appointment_availability.sql` — ৩টা নতুন টেবিল, তাদের
      RLS, ১টা হেল্পার, ২টা নতুন RPC, ২টা বিদ্যমান ফাংশন `create or replace`
- [x] **প্রতি-স্টাফ কর্মঘণ্টা** (`staff_working_hours`) — সারি নেই = ওই দিন কাজ
      করে না (সিদ্ধান্ত ৪৬)। বিদ্যমান সবার জন্য দোকানের সময় থেকে সিড করা, তাই
      চালু করার দিনে কারো স্লট হারায়নি
- [x] **ছুটি** (`staff_time_off`) — পুরো দিন আর দিনের অংশ, দুটোই একই পরিসর হিসেবে;
      একই ব্যক্তির ওভারল্যাপিং ছুটি EXCLUDE কনস্ট্রেইন্টে আটকানো
- [x] **রিশিডিউল** — `reschedule_appointment()` RPC + `appointment_reschedules`
      অডিট টেবিল (সিদ্ধান্ত ৪৭)। সাধারণ UPDATE-এ সময় জমাট; একমাত্র দরজা RPC
- [x] **রিমাইন্ডারের ভিত্তি** — `send_appointment_reminders()` বিদ্যমান নাইটলি
      ক্রনে যুক্ত (সিদ্ধান্ত ৩৫)। `reminded_at` দিয়ে idempotent। বাইরের কোনো
      প্রোভাইডার নয় — অ্যাপের নিজের `notifications` টেবিল
- [x] **`staff_is_available()`** — দোকানের সময় ∩ স্টাফের সময় − ছুটি, একটাই
      ফাংশনে; ইনসার্ট ট্রিগার, রিশিডিউল আর স্লট RPC তিনজনেই এটাই ডাকে
- [x] `shop_available_slots()` বাড়ানো — গ্রিড এখন **স্টাফ-প্রতি**, কারণ প্রত্যেকের
      জানালা আলাদা হতে পারে
- [x] প্রোভাইডার UI: `/chairs`-এ `StaffAvailabilityManager` (সাত দিনের সময় +
      ছুটি), বোর্ডে `RescheduleSheet`
- [x] টাইমজোন একটাই জায়গায় — `shop_timezone()` (সিদ্ধান্ত ৪৮)
- [x] `lib/staff-hours.ts` + ২১টা ইউনিট টেস্ট (মোট ৩২২)
- [x] **প্রি-চেক নয়, কনস্ট্রেইন্টই সিদ্ধান্ত** — রিশিডিউলেও ওভারল্যাপ আগে দেখা হয়
      না; UPDATE-এ EXCLUDE নিজেই ধরে (সিদ্ধান্ত ৪৩ অক্ষত)
- [x] **লোকাল Postgres-এ ৫৪/৫৪ পাস** — `supabase/tests/run-sprint5-checks.sh`:
      সিডিং, অ্যাভেইলেবিলিটি (৭ কেস), রিশিডিউল (৭ কেস), নিরাপত্তা (১০ কেস),
      রিমাইন্ডার (১০ কেস)
- [x] build ✅ · `tsc --noEmit` ✅ · lint ✅ (বেসলাইন) · test ✅ ৩২২টা · ডক ✅
- [ ] **ইউজারের ইনস্ট্যান্সে `20260919` চালানো** — বকেয়া
- [ ] **ব্রাউজার ভেরিফিকেশন** — ক্রেডেনশিয়াল নেই, **হয়নি**

**স্কোপে ইচ্ছাকৃতভাবে নেওয়া হয়নি:** কাজ শেষে পেমেন্ট শিট, ইনকাম/ক্যাশবুক/বাকির
খাতায় অ্যাপয়েন্টমেন্টের সারি, `/appointments` তালিকা পেজ — এগুলো ইউজারের
Sprint 5 ব্রিফে নেই (ব্রিফটা অ্যাভেইলেবিলিটি ও লাইফসাইকেলের), তাই পরের স্প্রিন্টে।
টাকার কলামগুলো সিদ্ধান্ত ২৯ অনুযায়ী `serials`-এর নকল করে রাখা আছে, তাই যোগ করা সহজ।

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
- [ ] `DEVELOPMENT.md`-এ ফেজ ৬-এর সারাংশ ও সিদ্ধান্ত ২৭+ যোগ
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
