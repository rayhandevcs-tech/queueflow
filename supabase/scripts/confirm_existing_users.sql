-- ---------------------------------------------------------------------------
-- আগে আটকে থাকা অ্যাকাউন্টগুলো কনফার্ম করে দেওয়া
-- ---------------------------------------------------------------------------
-- ড্যাশবোর্ডে "Confirm email" বন্ধ করলে সেটা **শুধু নতুন সাইনআপে** কাজ করে।
-- যারা আগে রেজিস্টার করেছিল কিন্তু কোড/লিংক পায়নি, তাদের `email_confirmed_at`
-- এখনো খালি — তারা টগল বন্ধ করার পরেও লগইন করতে গেলে "Email not confirmed"
-- পাবে। এই স্ক্রিপ্টটা সেই আটকে থাকাদের ছাড়িয়ে দেয়।
--
-- Supabase → SQL Editor-এ চালাও। একবারই যথেষ্ট।

-- ১) আগে দেখে নাও — কারা আটকে আছে
select id, email, created_at
  from auth.users
 where email_confirmed_at is null
 order by created_at desc;

-- ২) সবাইকে কনফার্ম করে দাও
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
 where email_confirmed_at is null;

-- ৩) যাচাই — এখন খালি লিস্ট আসার কথা
select count(*) as still_unconfirmed
  from auth.users
 where email_confirmed_at is null;
