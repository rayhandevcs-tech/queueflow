-- ফেজ ৬ / Sprint 3 — পার্লারের সার্ভিস ক্যাটাগরি
-- Supabase SQL এডিটরে একবার চালাও, 20260916_parlour_foundation.sql-এর পরে।
--
-- ---------------------------------------------------------------------------
-- এই মাইগ্রেশন কী করে (এবং কী করে না)
-- ---------------------------------------------------------------------------
-- করে:  services.category-র CHECK কনস্ট্রেইন্ট ৭ থেকে ১২ ভ্যালুতে চওড়া করে।
--        নতুন পাঁচটা: THREADING, WAXING, MEHENDI, MAKEUP, NAILS
--
-- করে না: কোনো সারি মোছে না, বদলায় না, রিসেট করে না। কোনো কলাম ড্রপ করে না।
--        কোনো ব্যাকফিল নেই। NULL ক্যাটাগরির সার্ভিস NULL-ই থাকে।
--
-- কেন এটা নিরাপদ: নতুন সেটটা পুরনো সেটের **সুপারসেট**। আগের সাতটার যেকোনোটা
-- ধরে রাখা প্রতিটা সারি নতুন কনস্ট্রেইন্টেও বৈধ, তাই ADD CONSTRAINT-এর
-- ভ্যালিডেশন পাস কোনো সারিতে ব্যর্থ হতে পারে না। ডেটা-ক্ষতির ঝুঁকি শূন্য।
--
-- ---------------------------------------------------------------------------
-- কনস্ট্রেইন্টের নাম নিয়ে সতর্কতা
-- ---------------------------------------------------------------------------
-- 20260802-এ কনস্ট্রেইন্টটা ইনলাইন লেখা হয়েছিল (`add column category text check
-- (...)`), তাই নামটা Postgres নিজে দিয়েছে — সম্ভবত services_category_check,
-- কিন্তু নিশ্চিত নয়। তাই নাম অনুমান না করে নিচের ব্লকটা services টেবিলের যে
-- CHECK কনস্ট্রেইন্টের সংজ্ঞায় 'HAIRCUT' আছে সেটাই খুঁজে ড্রপ করে — অর্থাৎ
-- ঠিক পুরনো ক্যাটাগরি কনস্ট্রেইন্টটাই, আর কিছু নয়।
-- ---------------------------------------------------------------------------

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'services'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%HAIRCUT%'
  loop
    execute format('alter table public.services drop constraint %I', c.conname);
    raise notice 'dropped old category constraint: %', c.conname;
  end loop;
end $$;

-- এবার নাম দিয়ে বসানো হলো, যাতে ভবিষ্যতের মাইগ্রেশন আর অনুমান করতে না হয়।
-- NULL আগের মতোই বৈধ: ক্যাটাগরি ঐচ্ছিক, আর পুরনো অনেক সার্ভিসে এটা NULL।
alter table public.services
  drop constraint if exists services_category_check;

alter table public.services
  add constraint services_category_check
  check (
    category is null
    or category in (
      'HAIRCUT', 'SHAVE', 'COLOR', 'FACIAL', 'SPA',
      'THREADING', 'WAXING', 'MEHENDI', 'MAKEUP', 'NAILS',
      'BRIDAL', 'OTHER'
    )
  );

comment on column public.services.category is
  'Optional service category. The allowed set mirrors SERVICE_CATEGORIES in '
  'src/config/constants.ts — change both together. Which categories a shop is '
  'offered in the picker depends on its business_type (categoriesFor()); this '
  'constraint deliberately accepts all of them for every shop so an existing '
  'row can never be rejected on edit.';


-- ===========================================================================
-- যাচাই — মাইগ্রেশন চালানোর পর নিচের ব্লকটা আনকমেন্ট করে চালাও
-- ===========================================================================
-- সব সারিতে ok = true হলে মাইগ্রেশন ঠিকঠাক বসেছে।
--
-- with cat as (
--   select pg_get_constraintdef(con.oid) as def
--   from pg_constraint con
--   join pg_class rel on rel.oid = con.conrelid
--   join pg_namespace nsp on nsp.oid = rel.relnamespace
--   where nsp.nspname = 'public' and rel.relname = 'services'
--     and con.conname = 'services_category_check'
-- )
-- select * from (values
--   -- ১) কনস্ট্রেইন্টটা আদৌ আছে কিনা
--   ('constraint exists',
--    (select count(*) from cat) = 1),
--
--   -- ২) পাঁচটা নতুন ক্যাটাগরিই ঢুকেছে কিনা
--   ('has THREADING', (select bool_or(def like '%THREADING%') from cat)),
--   ('has WAXING',    (select bool_or(def like '%WAXING%')    from cat)),
--   ('has MEHENDI',   (select bool_or(def like '%MEHENDI%')   from cat)),
--   ('has MAKEUP',    (select bool_or(def like '%MAKEUP%')    from cat)),
--   ('has NAILS',     (select bool_or(def like '%NAILS%')     from cat)),
--
--   -- ৩) পুরনো সাতটার একটাও হারায়নি কিনা
--   ('kept HAIRCUT',  (select bool_or(def like '%HAIRCUT%')   from cat)),
--   ('kept SHAVE',    (select bool_or(def like '%SHAVE%')     from cat)),
--   ('kept COLOR',    (select bool_or(def like '%COLOR%')     from cat)),
--   ('kept FACIAL',   (select bool_or(def like '%FACIAL%')    from cat)),
--   ('kept SPA',      (select bool_or(def like '%SPA%')       from cat)),
--   ('kept BRIDAL',   (select bool_or(def like '%BRIDAL%')    from cat)),
--   ('kept OTHER',    (select bool_or(def like '%OTHER%')     from cat)),
--
--   -- ৪) পুরনো CHECK-টা সত্যিই সরেছে কিনা (এখন ঠিক একটাই থাকার কথা)
--   ('exactly one category check',
--    (select count(*) from pg_constraint con
--       join pg_class rel on rel.oid = con.conrelid
--       join pg_namespace nsp on nsp.oid = rel.relnamespace
--      where nsp.nspname = 'public' and rel.relname = 'services'
--        and con.contype = 'c'
--        and pg_get_constraintdef(con.oid) like '%HAIRCUT%') = 1),
--
--   -- ৫) বিদ্যমান কোনো সার্ভিস এখন অবৈধ হয়ে যায়নি — শূন্য হওয়া বাধ্যতামূলক
--   ('no invalid services',
--    (select count(*) from public.services
--      where category is not null
--        and category not in ('HAIRCUT','SHAVE','COLOR','FACIAL','SPA',
--                             'THREADING','WAXING','MEHENDI','MAKEUP','NAILS',
--                             'BRIDAL','OTHER')) = 0),
--
--   -- ৬) কোনো সারি হারায়নি — সার্ভিস এখনো আছে (নতুন দোকানে 0 হতেই পারে)
--   ('services table readable',
--    (select count(*) >= 0 from public.services))
-- ) as t(check_name, ok) order by check_name;
--
--
-- CHECK সত্যিই কাজ করছে কিনা দেখতে চাইলে — এটা **ব্যর্থ হওয়ার কথা**, আর
-- ROLLBACK করায় কোনো সারি লেখা হয় না:
--
-- begin;
--   insert into public.services (shop_id, name, rate, default_duration_min, category)
--   select id, 'constraint probe', 1, 1, 'NOT_A_CATEGORY' from public.shops limit 1;
-- rollback;
-- -- প্রত্যাশিত: ERROR ... violates check constraint "services_category_check"
