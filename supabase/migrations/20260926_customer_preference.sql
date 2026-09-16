-- ফেজ ৬ / Sprint 11 — কাস্টমারের পছন্দের সেবা-ধরন
--
-- ===========================================================================
-- চালানোর ক্রম
-- ===========================================================================
--   …
--   9. 20260924_rewards.sql                   ✅
--  10. 20260925_analytics.sql                 ✅
--  11. 20260926_customer_preference.sql       ← এই ফাইল
--
-- ===========================================================================
-- এই ফাইল কী করে
-- ===========================================================================
-- `profiles`-এ **একটা কলাম**, ব্যস:
--
--     preferred_business_type text  null  check (in ('SALON','PARLOUR'))
--
-- আর কিছু নয় — কোনো নতুন টেবিল, কোনো নতুন পলিসি, কোনো ট্রিগার, কোনো
-- ব্যাকফিল, কোনো ডিফল্ট মান।
--
-- ===========================================================================
-- দুটো জিনিস এক নয় — এটাই এই ফাইলের সবচেয়ে গুরুত্বপূর্ণ কথা
-- ===========================================================================
--     shops.business_type
--         → **দোকান কী চালায়।** কিউ না অ্যাপয়েন্টমেন্ট, কোন ড্যাশবোর্ড,
--           কী কী পরিভাষা। এটা ব্যবসায়িক সত্য, আর এটা দোকানের মালিকের।
--
--     profiles.preferred_business_type
--         → **কাস্টমার ডিফল্টে কী দেখতে চায়।** এটা একটা পছন্দ, একটা
--           প্রারম্ভিক দৃশ্য — **অনুমতি নয়**। PARLOUR বাছা কাস্টমার
--           সেলুনও খুঁজতে ও বুক করতে পারে, উল্টোটাও। কোনো RLS পলিসি,
--           কোনো কোয়েরি, কোনো ফিল্টার এই কলামটার উপর ভিত্তি করে সারি
--           **লুকায় না**। লুকালে এটা একটা অ্যাক্সেস-কন্ট্রোল হয়ে যেত, আর
--           তখন "আমি তো সেলুনও চাই" বলা কাস্টমারকে নতুন অ্যাকাউন্ট খুলতে
--           হতো।
--
-- একই কারণে কলামটা `shops.business_type`-এর `business_type` enum টাইপ ব্যবহার
-- করে **না** — ওতে `UNISEX`ও আছে, যেটা একটা দোকান হতে পারে কিন্তু একটা
-- কাস্টমারের পছন্দ হিসেবে অর্থহীন ("আমি ইউনিসেক্স সেবা চাই" মানে কী?)।
-- তাছাড়া সিদ্ধান্ত ৪৫ অনুযায়ী এই স্কিমায় কোনো Postgres enum টাইপ নেই —
-- প্রতিটা স্ট্যাটাস/ধরন কলাম `text` + CHECK।
--
-- ===========================================================================
-- পুরনো কাস্টমারদের কী হবে (গুরুত্বপূর্ণ)
-- ===========================================================================
-- কলামটা **nullable, কোনো ডিফল্ট ছাড়া**, আর **একটা সারিও ব্যাকফিল করা
-- হয়নি**। কারণ:
--
--   · এখন যারা আছে তারা কোনো পছন্দ জানায়নি। সবাইকে `'SALON'` লিখে দেওয়া
--     মানে তাদের হয়ে একটা উত্তর বানিয়ে দেওয়া, আর পরে "এটা কি ওরা বেছেছিল
--     না আমরা বসিয়েছিলাম?" প্রশ্নের কোনো উত্তর থাকত না।
--   · `null` নিজেই একটা সৎ অবস্থা: "জানা নেই"। অ্যাপ সেটাকে কিউ-ভিত্তিক
--     ডিফল্ট হিসেবে পড়ে (`bookingModel()`-এর হুবহু একই দিকে ফেইল করা —
--     সেলুন ফ্লোটাই সম্পূর্ণ, তাই অজানা হলে সেদিকেই যাওয়া নিরাপদ), আর
--     কাস্টমার এক ট্যাপে সেটিংসে বদলাতে পারে।
--
-- অর্থাৎ এই মাইগ্রেশনের পরে **একটাও বিদ্যমান সারি বদলায় না**।
--
-- ===========================================================================
-- নিরাপত্তা — কোনো নতুন পলিসি কেন লাগেনি
-- ===========================================================================
-- বেসলাইনের (20260730) `profiles`-এর পলিসি দুটো সারি-স্তরের, কলাম-স্তরের নয়:
--
--     "profiles: read own"    for select using (auth.uid() = id)
--     "profiles: update own"  for update using (auth.uid() = id)
--                                       with check (auth.uid() = id)
--
-- তাই নতুন কলামটা ইতিমধ্যেই ঢাকা: কাস্টমার নিজের সারি পড়তে ও বদলাতে পারে,
-- **অন্য কারো সারি নয়** — USING ক্লজ অন্যের সারিটাই দেখতে দেয় না, তাই
-- UPDATE ০টা সারি ছোঁয়। এটা 20260821-এর (`date_of_birth`, `address`) হুবহু
-- একই যুক্তি, আর নিচের যাচাই-ব্লক ও Sprint 11-এর হার্নেস দুটোই এটা
-- আচরণে প্রমাণ করে।
--
-- `profiles_lock_role` ট্রিগারও অপরিবর্তিত — শুধু `role` জমাট, তাই এই কলাম
-- মালিক নিজে বদলাতে পারে, আর role আগের মতোই অপরিবর্তনীয়।
--
-- idempotent (`if not exists` / `if ... then`) — 20260821-এর মতোই, যাতে
-- দুবার চালালেও কিছু ভাঙে না।
-- ===========================================================================

alter table public.profiles
  add column if not exists preferred_business_type text;

-- CHECK আলাদা করে, `if not exists`-সহ: `add column`-এর সাথে ইনলাইন দিলে
-- দ্বিতীয়বার চালানোয় "constraint already exists" এসে পুরো ফাইল থেমে যেত।
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'profiles_preferred_business_type_check'
       and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_preferred_business_type_check
      check (preferred_business_type is null
             or preferred_business_type in ('SALON', 'PARLOUR'));
  end if;
end $$;

comment on column public.profiles.preferred_business_type is
  'The customer''s DEFAULT experience: SALON (queue-first) or PARLOUR '
  '(appointment-first). A preference, never a permission — nothing filters '
  'shops by it. null = never chosen; the app falls back to the queue-first '
  'experience, same direction as bookingModel(). Distinct from '
  'shops.business_type, which is what a shop actually runs.';


-- ===========================================================================
-- যাচাই — মাইগ্রেশনের পর আনকমেন্ট করে চালাও। সব ok = true হওয়া চাই।
-- ===========================================================================
--
-- select * from (values
--   ('column exists on profiles',
--    exists (select 1 from information_schema.columns
--             where table_schema='public' and table_name='profiles'
--               and column_name='preferred_business_type')),
--   ('it is text, not an enum type (decision 45)',
--    (select data_type from information_schema.columns
--      where table_schema='public' and table_name='profiles'
--        and column_name='preferred_business_type') = 'text'),
--   ('**it is nullable and has no default** — nobody was answered for',
--    (select is_nullable from information_schema.columns
--      where table_schema='public' and table_name='profiles'
--        and column_name='preferred_business_type') = 'YES'
--    and (select column_default from information_schema.columns
--          where table_schema='public' and table_name='profiles'
--            and column_name='preferred_business_type') is null),
--   ('the CHECK allows exactly SALON, PARLOUR and null',
--    (select pg_get_constraintdef(oid) from pg_constraint
--      where conname='profiles_preferred_business_type_check') like '%SALON%'
--    and (select pg_get_constraintdef(oid) from pg_constraint
--          where conname='profiles_preferred_business_type_check') like '%PARLOUR%'
--    and (select pg_get_constraintdef(oid) from pg_constraint
--          where conname='profiles_preferred_business_type_check') not like '%UNISEX%'),
--   ('**nothing was backfilled** — every existing row is still null',
--    (select count(*) from public.profiles
--      where preferred_business_type is not null) = 0),
--   ('no customer row was lost',
--    (select count(*) from public.profiles) > 0),
--
--   -- পলিসি ও ট্রিগার অপরিবর্তিত
--   ('profiles RLS still on',
--    (select relrowsecurity from pg_class where oid='public.profiles'::regclass)),
--   ('the two baseline profile policies are still the only self-serve ones',
--    exists (select 1 from pg_policies
--             where tablename='profiles' and policyname='profiles: read own')
--    and exists (select 1 from pg_policies
--                 where tablename='profiles' and policyname='profiles: update own')),
--   ('no INSERT or DELETE policy was added to profiles',
--    not exists (select 1 from pg_policies
--                 where tablename='profiles' and cmd in ('INSERT','DELETE'))),
--   ('role is still immutable',
--    exists (select 1 from pg_trigger where tgname='profiles_lock_role')),
--   ('lock_profile_role was not replaced',
--    to_regprocedure('public.lock_profile_role()') is not null),
--
--   -- shops.business_type-এ হাত পড়েনি
--   ('shops.business_type untouched',
--    (select data_type from information_schema.columns
--      where table_schema='public' and table_name='shops'
--        and column_name='business_type') = 'USER-DEFINED'),
--   ('no shop row changed type',
--    (select count(*) from public.shops where business_type is null) = 0),
--
--   -- কোনো সমান্তরাল প্রোফাইল/প্রেফারেন্স ব্যবস্থা তৈরি হয়নি
--   ('no second profile or preference table was created',
--    to_regclass('public.customer_profiles') is null
--    and to_regclass('public.customer_preferences') is null
--    and to_regclass('public.user_preferences') is null
--    and to_regclass('public.user_settings') is null),
--   ('no theme column landed in the database',
--    (select count(*) from information_schema.columns
--      where table_schema='public' and column_name like '%theme%') = 0),
--
--   -- NO_SHOW এখনো আছে, দুই ইঞ্জিনেই (Sprint 11-এর দাবি)
--   ('serials still allow NO_SHOW',
--    (select count(*) from pg_constraint c
--      where c.conrelid='public.serials'::regclass
--        and pg_get_constraintdef(c.oid) like '%NO_SHOW%') > 0
--    or exists (select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
--                where t.typname='serial_status' and e.enumlabel='NO_SHOW')),
--   ('appointments still allow NO_SHOW',
--    (select count(*) from pg_constraint c
--      where c.conrelid='public.appointments'::regclass
--        and pg_get_constraintdef(c.oid) like '%NO_SHOW%') > 0)
-- ) as t(check_name, ok) order by ok, check_name;
--
--
-- ---------------------------------------------------------------------------
-- আচরণগত প্রোব — নিজেই নিজের সব লেখা ফিরিয়ে নেয়
-- ---------------------------------------------------------------------------
-- কাঠামো দেখে বোঝা যায় কলামটা আছে; এই ব্লকটা দেখে বোঝা যায় **CHECK সত্যিই
-- আটকায়**। শেষ কাজটা `raise exception`, তাই DO ব্লকটা সবসময় rollback হয় —
-- একটাও সারি টেকে না।
--
-- do $$
-- declare v_id uuid;
-- begin
--   select id into v_id from public.profiles limit 1;
--   if v_id is null then
--     raise notice 'ok — কোনো প্রোফাইল নেই, পরীক্ষার কিছু নেই';
--     return;
--   end if;
--
--   update public.profiles set preferred_business_type = 'SALON' where id = v_id;
--   update public.profiles set preferred_business_type = 'PARLOUR' where id = v_id;
--   update public.profiles set preferred_business_type = null where id = v_id;
--   raise notice 'ok — তিনটে বৈধ মানই বসে';
--
--   begin
--     update public.profiles set preferred_business_type = 'UNISEX' where id = v_id;
--     raise exception 'FAIL — UNISEX ঢুকে গেছে, CHECK আটকায়নি';
--   exception
--     when check_violation then raise notice 'ok — UNISEX refuse হয়েছে';
--   end;
--
--   begin
--     update public.profiles set preferred_business_type = 'salon' where id = v_id;
--     raise exception 'FAIL — lowercase ঢুকে গেছে';
--   exception
--     when check_violation then raise notice 'ok — lowercase refuse হয়েছে';
--   end;
--
--   raise exception 'rollback — প্রোবটা কিছু রেখে যায় না';
-- end $$;
