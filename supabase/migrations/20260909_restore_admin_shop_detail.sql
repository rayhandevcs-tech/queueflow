-- Sprint 43: admin_shop_detail() পুরোনো, সঠিক সংস্করণে ফিরিয়ে আনা
-- Run this once in the Supabase SQL editor, AFTER 20260908.
--
-- ---------------------------------------------------------------------------
-- কী হয়েছিল
-- ---------------------------------------------------------------------------
-- এডমিন প্যানেলে যেকোনো দোকানে ক্লিক করলে 400 আসছিল। SQL এডিটরে ফাংশনটা
-- সরাসরি চালিয়ে আসল বার্তাটা পাওয়া গেল:
--
--   ERROR: 42703: column o.is_active does not exist
--   HINT:  Perhaps you meant to reference the column "o.active".
--
-- এররের সাথে ছাপা বডিটা দেখে বোঝা গেল ডেটাবেসে যে ফাংশনটা বসে আছে সেটা
-- 20260824_admin_panel.sql-এর মূল ফাংশন নয় — একটা খসড়া, যেটা স্মৃতি থেকে লেখা
-- হয়েছিল এবং মূল থেকে সরে গিয়েছিল। খসড়াটা ফাইল থেকে মুছে ফেলা হলেও ততক্ষণে
-- ডেটাবেসে চালানো হয়ে গিয়েছিল, তাই সঠিক ফাংশনটা ওটার নিচে চাপা পড়ে যায়।
--
-- খসড়াটায় যা যা ভুল ছিল:
--
--   1. `offers o ... o.is_active` — কলামটার নাম আসলে `o.active`। এটাই 400-এর
--      সরাসরি কারণ; প্রতিটা দোকানেই ফাংশনটা এখানে এসে থেমে যেত।
--   2. `owner_email` কী-টা ছিল না — email-টা `owner` অবজেক্টের ভেতরে ঢুকে
--      গিয়েছিল, অথচ UI আলাদা `owner_email` পড়ে।
--   3. `readiness` ব্লকটা পুরোপুরি অনুপস্থিত — যাচাই-চেকলিস্ট এটাই পড়ে।
--   4. `recent_reviews` অনুপস্থিত।
--   5. `revenue_30d` `sr.created_at` ধরে হিসাব করত, `sr.completed_at` নয়।
--   6. `audit`-এ limit 10-এর বদলে 20।
--
-- ---------------------------------------------------------------------------
-- এখানে কী করা হচ্ছে
-- ---------------------------------------------------------------------------
-- নিচের বডিটা 20260824_admin_panel.sql থেকে **হুবহু** নেওয়া — অনুমান করে
-- লেখা নয়। তার উপর শুধু 20260908-এর সংশোধনটা বসানো: রেটিং দুটোয় coalesce
-- সাব-কোয়েরির ভেতরে নয়, বাইরে (রিভিউবিহীন দোকানের কোনো সারিই থাকে না, তখন
-- গোটা সাব-কোয়েরিই NULL হয়ে যায়)।
--
-- অর্থাৎ এই একটা ফাইল চালালেই 20260824-এর মূল ফাংশন + 20260908-এর ফিক্স —
-- দুটোই একসাথে বসে যায়। 20260908 আলাদা করে আবার চালানোর দরকার নেই।

create or replace function public.admin_shop_detail(p_shop_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_result json;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  select json_build_object(
    'shop', to_jsonb(s.*),
    'owner', (
      select json_build_object(
        'id', p.id, 'full_name', p.full_name, 'phone', p.phone,
        'avatar_url', p.avatar_url, 'created_at', p.created_at)
      from profiles p where p.id = s.owner_id
    ),
    'owner_email', (select u.email from auth.users u where u.id = s.owner_id),
    'stats', json_build_object(
      'chairs',        (select count(*) from chairs c where c.shop_id = s.id),
      'services',      (select count(*) from services sv where sv.shop_id = s.id),
      'gallery',       (select count(*) from shop_gallery_images g where g.shop_id = s.id),
      'offers_active', (select count(*) from offers o where o.shop_id = s.id and o.active),
      'serials_total', (select count(*) from serials sr where sr.shop_id = s.id),
      'serials_30d',   (select count(*) from serials sr
                         where sr.shop_id = s.id and sr.created_at >= now() - interval '30 days'),
      'serials_live',  (select count(*) from serials sr
                         where sr.shop_id = s.id and sr.status in ('WAITING', 'IN_PROGRESS')),
      'no_shows_30d',  (select count(*) from serials sr
                         where sr.shop_id = s.id and sr.status = 'NO_SHOW'
                           and sr.created_at >= now() - interval '30 days'),
      'revenue_30d',   (select coalesce(sum(sr.total_amount), 0) from serials sr
                         where sr.shop_id = s.id and sr.status = 'DONE'
                           and sr.payment_status = 'PAID'
                           and sr.completed_at >= now() - interval '30 days'),
      'due_total',     (select coalesce(sum(sr.due_amount), 0) from serials sr
                         where sr.shop_id = s.id and sr.payment_status = 'DUE'),
      -- 20260908-এর ফিক্স: coalesce সাব-কোয়েরির বাইরে, ভেতরে নয়।
      'avg_rating',    coalesce((select avg_rating from shop_rating_summary where shop_id = s.id), 0),
      'review_count',  coalesce((select review_count from shop_rating_summary where shop_id = s.id), 0),
      'last_serial_at',(select max(sr.created_at) from serials sr where sr.shop_id = s.id)
    ),
    -- The verification checklist reads these: a shop with no chair or no
    -- service cannot actually serve anyone, so it should not be approved.
    'readiness', json_build_object(
      'has_location', s.latitude is not null and s.longitude is not null,
      'has_phone',    coalesce(s.phone, '') <> '',
      'has_cover',    coalesce(s.cover_image_url, '') <> '',
      'has_about',    coalesce(s.about, '') <> '',
      'has_hours',    s.weekly_hours is not null,
      'has_chair',    exists (select 1 from chairs c where c.shop_id = s.id and c.is_active),
      'has_service',  exists (select 1 from services sv where sv.shop_id = s.id and sv.is_active)
    ),
    'recent_reviews', (
      select coalesce(json_agg(r), '[]'::json) from (
        select rv.id, rv.rating, rv.comment, rv.created_at,
               (select full_name from profiles where id = rv.customer_id) as customer_name
        from reviews rv where rv.shop_id = s.id
        order by rv.created_at desc limit 5
      ) r
    ),
    'audit', (
      select coalesce(json_agg(a), '[]'::json) from (
        select al.id, al.action, al.meta, al.created_at,
               (select full_name from profiles where id = al.actor_id) as actor_name
        from admin_audit_log al
        where al.target_type = 'shop' and al.target_id = s.id
        order by al.created_at desc limit 10
      ) a
    )
  ) into v_result
  from shops s
  where s.id = p_shop_id;

  return v_result;
end; $$;

grant execute on function public.admin_shop_detail(uuid) to authenticated;

-- PostgREST-এর ফাংশন-ক্যাশ পুরোনো থেকে গেলে ঠিক ফাংশনও 400 দিতে পারে।
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- যাচাই — তিনটেই true এলে ঠিক আছে
-- ---------------------------------------------------------------------------
--   select pg_get_functiondef(oid) like '%o.active)%'        as offers_ok,
--          pg_get_functiondef(oid) like '%''readiness''%'    as readiness_ok,
--          pg_get_functiondef(oid) like '%coalesce((select avg_rating%' as rating_ok
--     from pg_proc where oid = to_regprocedure('public.admin_shop_detail(uuid)');
