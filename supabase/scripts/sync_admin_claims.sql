-- ---------------------------------------------------------------------------
-- is_admin দাবিটা admin_users-এর সাথে মিলিয়ে দেওয়া
-- ---------------------------------------------------------------------------
-- `auth.users.raw_app_meta_data.is_admin` হলো middleware-এর জন্য রাখা একটা
-- দাবি (claim) — টোকেনে বসে থাকে, তাই মেম্বারশিপ চলে গেলেও ওটা রয়ে যায়।
-- হাতে সিড করা পুরোনো এডমিন অ্যাকাউন্টে এই ফাঁকটা বাস্তব সমস্যা তৈরি করেছিল।
--
-- Sprint 37-এর পর দাবিটা আর কারও কাছ থেকে অ্যাপ কেড়ে নিতে পারে না (middleware
-- এখন শুধু `/admin` আটকাতে এটা ব্যবহার করে)। তবু দুই দিকেই মিলিয়ে রাখা ভালো:
-- চালু এডমিনের দাবি না থাকলে সে প্যানেলে ঢুকতে পারবে না, আর সাবেক এডমিনের
-- দাবি থেকে গেলে সে `/admin`-এ গিয়ে "এই পাতা তোমার জন্য নয়" দেখবে।
--
-- Supabase → SQL Editor-এ চালাও। এরপর সংশ্লিষ্ট সবাইকে একবার লগআউট করে আবার
-- লগইন করতে হবে — পুরোনো টোকেনে পুরোনো দাবিটাই থাকে।

-- ১) আগে দেখে নাও — কোথায় অমিল
select
  u.id,
  u.email,
  coalesce(u.raw_app_meta_data ->> 'is_admin', 'false') as claim,
  a.level,
  a.status
from auth.users u
left join public.admin_users a on a.user_id = u.id
where (a.user_id is not null and a.status = 'ACTIVE')
   or coalesce(u.raw_app_meta_data ->> 'is_admin', 'false') = 'true'
order by a.level nulls last, u.email;

-- ২) সাবেক/বন্ধ এডমিনের দাবি সরাও
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) - 'is_admin'
 where coalesce(u.raw_app_meta_data ->> 'is_admin', 'false') = 'true'
   and not exists (
     select 1 from public.admin_users a
      where a.user_id = u.id and a.status = 'ACTIVE'
   );

-- ৩) চালু এডমিনের দাবি বসাও
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
                           || jsonb_build_object('is_admin', true)
 where exists (
         select 1 from public.admin_users a
          where a.user_id = u.id and a.status = 'ACTIVE'
       )
   and coalesce(u.raw_app_meta_data ->> 'is_admin', 'false') <> 'true';

-- ৪) আবার দেখে নাও — এখন claim আর status মিলে যাওয়ার কথা
select
  u.email,
  coalesce(u.raw_app_meta_data ->> 'is_admin', 'false') as claim,
  a.level,
  a.status
from auth.users u
left join public.admin_users a on a.user_id = u.id
where (a.user_id is not null)
   or coalesce(u.raw_app_meta_data ->> 'is_admin', 'false') = 'true'
order by a.level nulls last, u.email;
