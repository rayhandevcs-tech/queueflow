-- ---------------------------------------------------------------------------
-- একবার চালানোর স্ক্রিপ্ট: একটা বিদ্যমান অ্যাকাউন্টকে SUPER_ADMIN বানানো
-- ---------------------------------------------------------------------------
-- এটা মাইগ্রেশন নয়। Supabase → SQL Editor-এ পুরোটা পেস্ট করে একবার Run করো।
-- চালানোর আগে 20260901_admin_identity.sql চলে থাকতে হবে।
--
-- কেন স্ক্রিপ্ট, প্যানেল নয়: প্যানেল থেকে এডমিন বানাতে আগে থেকেই একজন
-- SUPER_ADMIN লাগে। প্রথম SUPER_ADMIN-কে বসাতে হয় এখান থেকেই — এর পর বাকি
-- সবাইকে Admin Panel → টিম থেকে বানানো যাবে।
--
-- আগে যা করতে হবে: p_email-এর অ্যাকাউন্টটা থাকতে হবে। না থাকলে অ্যাপের
-- /register থেকে ওই ইমেইলে একবার সাইন আপ করো (যেকোনো পাসওয়ার্ড) — ইমেইল
-- ভেরিফাই করার দরকার নেই, স্ক্রিপ্টটা নিজেই ভেরিফাই করে দেয়।
--
-- নিরাপত্তা: যে অ্যাকাউন্টের নামে দোকান আছে, স্ক্রিপ্ট সেটাকে এডমিন বানাতে
-- অস্বীকার করবে — এডমিন দোকানদার হতে পারে না, আর ভুল ইমেইল বসিয়ে দিলে
-- দোকানের ডেটা নষ্ট হবে না।

do $$
declare
  -- ↓↓↓ এই দুটো লাইনই শুধু বদলাতে হয় ↓↓↓
  p_email     text := 'rayhan.dev.cs@gmail.com';
  p_full_name text := 'Rayhan';
  -- ↑↑↑ -------------------------------- ↑↑↑

  v_uid       uuid;
  v_shop_name text;
begin
  p_email := lower(trim(p_email));

  select id into v_uid from auth.users where lower(email) = p_email;

  if v_uid is null then
    raise exception '% — এই ইমেইলে কোনো অ্যাকাউন্ট নেই। অ্যাপের /register থেকে এই ইমেইলে একবার সাইন আপ করো, তারপর স্ক্রিপ্টটা আবার চালাও।', p_email;
  end if;

  -- দোকানদারকে কখনো এডমিন বানানো হবে না।
  select sh.name into v_shop_name from public.shops sh where sh.owner_id = v_uid;
  if v_shop_name is not null then
    raise exception '% অ্যাকাউন্টের নামে দোকান আছে (%) — দোকানদার অ্যাকাউন্ট এডমিন বানানো যাবে না। আলাদা ইমেইল ব্যবহার করো।', p_email, v_shop_name;
  end if;

  -- ১) মেম্বারশিপ। আগে থেকে থাকলে SUPER_ADMIN + ACTIVE করে দেওয়া হয়।
  insert into public.admin_users (user_id, level, full_name, email, status)
  values (v_uid, 'SUPER_ADMIN', p_full_name, p_email, 'ACTIVE')
  on conflict (user_id) do update
    set level     = 'SUPER_ADMIN',
        status    = 'ACTIVE',
        full_name = coalesce(excluded.full_name, admin_users.full_name),
        email     = excluded.email;

  -- ২) middleware-এর জন্য দাবিটা টোকেনে বসাও, আর ইমেইল কনফার্ম করে দাও —
  --    মেইল না গেলেও যেন লগইন আটকে না থাকে।
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('is_admin', true),
         email_confirmed_at = coalesce(email_confirmed_at, now())
   where id = v_uid;

  -- ৩) এডমিন গ্রাহক নয় — তাই profiles সারিটা থাকার কথা নয়। পুরোনো অ্যাকাউন্টে
  --    ইতিহাস থাকলে FK আটকে দিতে পারে; সেটা মারাত্মক কিছু নয়, তাই ধরে নিয়ে
  --    এগোনো হয় (তখন অ্যাকাউন্টটা দ্বৈত-পরিচয় থাকে, লগইন ঠিকই কাজ করে)।
  begin
    delete from public.profiles where id = v_uid;
    raise notice 'profiles সারি মুছে ফেলা হয়েছে — অ্যাকাউন্টটি আর গ্রাহক নয়।';
  exception when foreign_key_violation then
    raise notice 'profiles সারি রাখা হলো (অ্যাকাউন্টটির পুরোনো ইতিহাস আছে) — লগইনে সমস্যা হবে না।';
  end;

  raise notice E'\n  হয়ে গেছে। % এখন SUPER_ADMIN।\n  /admin/login-এ ওই ইমেইল ও পাসওয়ার্ড দিয়ে ঢোকো।\n', p_email;
end $$;

-- যাচাই: এখন কারা এডমিন
select a.email, a.full_name, a.level, a.status, u.last_sign_in_at
  from public.admin_users a
  left join auth.users u on u.id = a.user_id
 order by a.level, a.created_at;

-- ---------------------------------------------------------------------------
-- ধাপ ২ — পুরোনো এডমিনটি সরানো (নতুনটা দিয়ে লগইন করে দেখার পরেই!)
-- ---------------------------------------------------------------------------
-- দোকান-অ্যাকাউন্টকে এডমিন বানানো হয়েছিল আগে। নতুন এডমিনে ঢোকা নিশ্চিত হলে
-- নিচের দুটো লাইনের কমেন্ট তুলে চালাও — এর আগে নয়, ফিরে আসার আর পথ থাকবে না।
--
-- delete from public.admin_users
--  where user_id = (select id from auth.users where lower(email) = 'rayhan.mohammadd@gmail.com');
--
-- update auth.users
--    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'is_admin'
--  where lower(email) = 'rayhan.mohammadd@gmail.com';
