-- Sprint 43: রিভিউবিহীন দোকানের রেটিং NULL হয়ে ফিরত
-- Run this once in the Supabase SQL editor, AFTER 20260907.
--
-- ---------------------------------------------------------------------------
-- বাগটা
-- ---------------------------------------------------------------------------
-- admin_shop_detail() রেটিং দুটো ফিল্ড এভাবে বানায়:
--
--   'avg_rating',   (select coalesce(avg_rating, 0)   from shop_rating_summary where shop_id = s.id)
--   'review_count', (select coalesce(review_count, 0) from shop_rating_summary where shop_id = s.id)
--
-- coalesce-টা সাব-কোয়েরির **ভেতরে**। ওটা তখনই চলে যখন সারি পাওয়া গেছে কিন্তু
-- কলামটা NULL। যে দোকানের একটাও রিভিউ নেই, shop_rating_summary-তে তার কোনো
-- সারিই নেই — তখন গোটা সাব-কোয়েরিই NULL, আর coalesce চলার সুযোগ পায় না।
--
-- ফলে JSON-এ দুটোই null যেত, UI-এর `review_count === 0` গার্ড ব্যর্থ হতো, আর
-- `null.toFixed(1)`-এ পুরো এডমিন পাতা সাদা হয়ে যেত।
--
-- ---------------------------------------------------------------------------
-- কেন ফাংশনটা নতুন করে লেখা হয়নি
-- ---------------------------------------------------------------------------
-- admin_shop_detail() বড় — owner, owner_email, stats, readiness, recent_reviews,
-- audit — আর সেটা স্মৃতি থেকে আবার টাইপ করা মানে একটা ফিল্ড বাদ পড়ে যাওয়ার
-- ঝুঁকি। একটা null ঠিক করতে গিয়ে একটা ফিল্ড হারানো খারাপ লেনদেন।
--
-- তাই এই স্ক্রিপ্ট **লাইভ ডেফিনিশন থেকেই শুরু করে**: pg_get_functiondef দিয়ে
-- এখনকার ফাংশনটা তুলে আনে, শুধু ওই দুটো অভিব্যক্তি বদলায়, তারপর সেটাই আবার
-- execute করে। বাকি সব হুবহু যা ছিল তাই থাকে — যা এখানে লেখা নেই, তা ছোঁয়াও
-- হয় না।

do $$
declare
  v_def  text;
  v_new  text;
begin
  select pg_get_functiondef(oid) into v_def
    from pg_proc
   where oid = to_regprocedure('public.admin_shop_detail(uuid)');

  if v_def is null then
    raise exception 'admin_shop_detail(uuid) নেই — আগে 20260824_admin_panel.sql চালাও';
  end if;

  -- হোয়াইটস্পেস-সহনশীল: ফরম্যাটিং যেমনই হোক, অভিব্যক্তিটা ধরা পড়বে।
  v_new := regexp_replace(
    v_def,
    '\(\s*select\s+coalesce\(\s*avg_rating\s*,\s*0\s*\)\s+from\s+shop_rating_summary\s+where\s+shop_id\s*=\s*s\.id\s*\)',
    'coalesce((select avg_rating from shop_rating_summary where shop_id = s.id), 0)',
    'gi'
  );

  v_new := regexp_replace(
    v_new,
    '\(\s*select\s+coalesce\(\s*review_count\s*,\s*0\s*\)\s+from\s+shop_rating_summary\s+where\s+shop_id\s*=\s*s\.id\s*\)',
    'coalesce((select review_count from shop_rating_summary where shop_id = s.id), 0)',
    'gi'
  );

  if v_new = v_def then
    -- আগেই ঠিক করা আছে, অথবা ফাংশনের ভেতরের লেখাটা প্রত্যাশার সাথে মেলেনি।
    -- দ্বিতীয়টা হলে হাতে দেখতে হবে — চুপচাপ "সফল" বলে চলে যাওয়া হয় না।
    raise notice 'কোনো পরিবর্তন হয়নি — হয় আগেই ঠিক করা আছে, নয়তো ফাংশনের লেখা আলাদা। নিচের যাচাই কোয়েরিটা চালাও।';
  else
    execute v_new;
    raise notice 'admin_shop_detail() ঠিক করা হয়েছে।';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- যাচাই
-- ---------------------------------------------------------------------------
-- true এলে ঠিক আছে:
--
--   select pg_get_functiondef(oid) like '%coalesce((select avg_rating%' as fixed
--     from pg_proc where oid = to_regprocedure('public.admin_shop_detail(uuid)');
