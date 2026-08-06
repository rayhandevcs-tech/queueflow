-- ---------------------------------------------------------------------------
-- আগে মুছে ফেলা অ্যাকাউন্টের আটকে থাকা ইমেইল খালি করা
-- ---------------------------------------------------------------------------
-- 20260903_account_delete_fix.sql-এর আগে মোছা অ্যাকাউন্টগুলোর ইমেইল আটকে আছে:
-- auth.users সারিটা গেছে, কিন্তু auth.identities-এ ইমেইলটা ধরে রাখা সারিটা রয়ে
-- গেছে — তাই ওই ঠিকানায় আবার সাইন আপ করতে গেলে "already registered" আসে।
--
-- নতুন মাইগ্রেশনের পর মোছা অ্যাকাউন্টে এই সমস্যা আর হবে না। এটা শুধু পুরোনো
-- আটকে থাকাগুলো ছাড়ানোর জন্য — একবার চালালেই হবে।
--
-- Supabase → SQL Editor-এ পেস্ট করে চালাও।

-- ---------------------------------------------------------------------------
-- ১) আগে দেখে নাও — কোন কোন সারি এতিম হয়ে পড়ে আছে
-- ---------------------------------------------------------------------------
select
  i.id,
  i.user_id,
  lower(i.identity_data ->> 'email') as email,
  i.provider,
  i.created_at
from auth.identities i
where not exists (select 1 from auth.users u where u.id = i.user_id)
order by i.created_at desc;

-- একটা নির্দিষ্ট ইমেইলের অবস্থা দেখতে (ইমেইলটা বদলে নাও):
select
  (select count(*) from auth.users u
    where lower(u.email) = lower('someone@example.com'))            as users_row,
  (select count(*) from auth.identities i
    where lower(i.identity_data ->> 'email') = lower('someone@example.com')) as identity_rows,
  (select count(*) from public.profiles p
    join auth.users u on u.id = p.id
   where lower(u.email) = lower('someone@example.com'))             as profile_row;

-- ---------------------------------------------------------------------------
-- ২) এতিম identity সারিগুলো মুছে দাও — এতেই ইমেইল খালি হয়ে যাবে
-- ---------------------------------------------------------------------------
-- শর্তটা লক্ষ করো: যে identity-র auth.users সারি এখনো আছে, সেটা ছোঁয়া হয় না।
-- অর্থাৎ চালু কোনো অ্যাকাউন্টের লগইন এই স্ক্রিপ্টে নষ্ট হওয়ার সুযোগ নেই।
delete from auth.identities i
 where not exists (select 1 from auth.users u where u.id = i.user_id);

-- ---------------------------------------------------------------------------
-- ৩) soft-delete হয়ে পড়ে থাকা auth.users সারি (থাকলে)
-- ---------------------------------------------------------------------------
-- Supabase-এর কিছু সংস্করণে মোছা ইউজার deleted_at বসিয়ে রেখে দেয়; সেগুলোও
-- ইমেইল ধরে রাখে। আগে select দিয়ে দেখে নাও, তারপরই delete চালাও।
select id, email, deleted_at from auth.users where deleted_at is not null;

-- delete from auth.users where deleted_at is not null;

-- ---------------------------------------------------------------------------
-- ৪) প্রোফাইল আছে কিন্তু লগইন নেই — এমন এতিম সারি
-- ---------------------------------------------------------------------------
select p.id, p.full_name, p.phone, p.role
  from public.profiles p
 where not exists (select 1 from auth.users u where u.id = p.id);

-- delete from public.profiles p
--  where not exists (select 1 from auth.users u where u.id = p.id);
