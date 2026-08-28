-- ---------------------------------------------------------------------------
-- কোন মাইগ্রেশনগুলো আসলে চালানো হয়েছে?
-- ---------------------------------------------------------------------------
-- এই প্রজেক্টের মাইগ্রেশনগুলো Supabase CLI দিয়ে নয়, হাতে SQL এডিটরে চালানো
-- হয়েছে। তাই `supabase migration list` কাজে আসবে না — ওটা CLI-এর নিজের
-- হিসাবের টেবিল (`supabase_migrations.schema_migrations`) দেখে, আর সেখানে
-- হাতে চালানো কিছুই লেখা থাকে না। ওটা চালালে সব ফাইলকেই "not applied" দেখাবে,
-- যদিও অনেকগুলোই চালানো আছে — অর্থাৎ উত্তরটা ভুল হবে।
--
-- তাই এখানে হিসাবের খাতা নয়, **ডেটাবেসকে সরাসরি জিজ্ঞেস করা হয়**: প্রতিটা
-- মাইগ্রেশন যে জিনিসটা তৈরি করার কথা, সেটা সত্যিই আছে কি না।
--
-- Supabase → SQL Editor-এ পুরোটা পেস্ট করে Run করো। ✅ মানে চালানো হয়েছে,
-- ❌ মানে ওই ফাইলটা এখনো চালানো বাকি — তারিখের ক্রমে চালাও।

with checks(ord, migration, kind, obj, present) as (
  values
    (1, '20260820_fix_in_progress_eta_staleness',
        'IN_PROGRESS সিরিয়ালের ETA লেখা হয়', 'recalc_queue_estimates()',
        coalesce(
          (select pg_get_functiondef(p.oid) like '%set estimated_start_at = coalesce(r.started_at%'
             from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'recalc_queue_estimates'
            limit 1),
          false)),

    (2, '20260821_profile_dob_address', 'কলাম', 'profiles.date_of_birth',
        to_regclass('public.profiles') is not null and exists (
          select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'profiles'
             and column_name = 'date_of_birth')),

    (3, '20260823_manual_entries_customer_name', 'কলাম', 'manual_entries.customer_name',
        to_regclass('public.manual_entries') is not null and exists (
          select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'manual_entries'
             and column_name = 'customer_name')),

    (4, '20260824_admin_panel', 'টেবিল', 'admin_users',
        to_regclass('public.admin_users') is not null),

    (5, '20260825_admin_users_moderation', 'টেবিল', 'reports',
        to_regclass('public.reports') is not null),

    (6, '20260826_admin_account_ops', 'ফাংশন', 'admin_delete_user()',
        to_regprocedure('public.admin_delete_user(uuid, text)') is not null),

    (7, '20260827_wait_reality', 'ফাংশন', 'bump_serial_back()',
        to_regprocedure('public.bump_serial_back(uuid)') is not null),

    (8, '20260828_group_booking', 'ফাংশন', 'create_group_booking()',
        exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'create_group_booking')),

    (9, '20260829_display_and_review_reply', 'ফাংশন', 'shop_display_board()',
        exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'shop_display_board')),

    (10, '20260830_commission_and_expenses', 'টেবিল', 'shop_expenses',
        to_regclass('public.shop_expenses') is not null),

    (11, '20260831_retention', 'টেবিল', 'customer_reminders',
        to_regclass('public.customer_reminders') is not null),

    (12, '20260901_admin_identity', 'কলাম', 'admin_users.status',
        to_regclass('public.admin_users') is not null and exists (
          select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'admin_users'
             and column_name = 'status')),

    (13, '20260902_support_tickets', 'টেবিল', 'support_tickets',
        to_regclass('public.support_tickets') is not null),

    -- খেয়াল করো: এখানে "auth.users মোছে না" খুঁজলে ভুল উত্তর আসে — ফাংশনের
    -- ভেতরের কমেন্টেই ওই লেখাটা থাকতে পারে, আর pg_get_functiondef কমেন্টসহ
    -- পুরো বডি ফেরত দেয়। তাই **নতুন সংস্করণে যা যোগ হয়েছে** সেটা খোঁজা হয়:
    -- profiles সারিটা এখন ফাংশনটা নিজে মোছে (আগে auth.users-এর cascade-এ যেত)।
    (14, '20260903_account_delete_fix',
         'admin_delete_user() নিজেই profiles মোছে', 'admin_delete_user()',
        coalesce(
          (select pg_get_functiondef(p.oid) like '%delete from profiles where id = p_user_id%'
             from pg_proc p
            where p.oid = to_regprocedure('public.admin_delete_user(uuid, text)')),
          false)),

    (15, '20260904_service_duration_authority',
         'ট্রিগার', 'services_reset_learned_duration',
        exists (select 1 from pg_trigger
                 where tgname = 'services_reset_learned_duration'
                   and not tgisinternal)),

    -- আবারও পজিটিভ মার্কার: নতুন সংস্করণে position অদলবদলের আগে একটা "park"
    -- ধাপ যোগ হয়েছে, পুরোনোটায় ছিল না।
    (16, '20260905_fix_bump_serial_back_swap',
         'পজিশন অদলবদলে park ধাপ', 'bump_serial_back()',
        coalesce(
          (select pg_get_functiondef(p.oid) like '%v_park%'
             from pg_proc p
            where p.oid = to_regprocedure('public.bump_serial_back(uuid)')),
          false)),

    (17, '20260906_delete_chair_rpc', 'ফাংশন', 'delete_chair()',
        to_regprocedure('public.delete_chair(uuid)') is not null),

    (18, '20260907_chairs_owner_read', 'RLS পলিসি', 'chairs: owner read',
        exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'chairs'
                   and policyname = 'chairs: owner read')),

    (19, '20260908_fix_admin_shop_detail_rating',
         'coalesce সাব-কোয়েরিকে মোড়ে', 'admin_shop_detail()',
        coalesce(
          (select pg_get_functiondef(p.oid) like '%coalesce((select avg_rating%'
             from pg_proc p
            where p.oid = to_regprocedure('public.admin_shop_detail(uuid)')),
          false)),

    -- 20260909 মূল ফাংশনটা ফিরিয়ে আনে। তিনটে জিনিস একসাথে থাকলেই সেটা
    -- নিশ্চিত: offers-এ সঠিক কলাম (o.active), readiness ব্লক, আর
    -- recent_reviews — খসড়া সংস্করণে এই তিনটেরই একটাও ছিল না।
    (20, '20260909_restore_admin_shop_detail',
         'মূল বডি ফিরে এসেছে', 'admin_shop_detail()',
        coalesce(
          (select pg_get_functiondef(p.oid) like '%o.active)%'
              and pg_get_functiondef(p.oid) like '%''readiness''%'
              and pg_get_functiondef(p.oid) like '%''recent_reviews''%'
             from pg_proc p
            where p.oid = to_regprocedure('public.admin_shop_detail(uuid)')),
          false)),

    -- নেগেটিভ মার্কার, কারণ এই মাইগ্রেশন একটা জিনিস **সরায়**: অনুমান আর
    -- শেখা গড় দেখে না, শুধু সার্ভিসের সেট করা সময় ধরে।
    (21, '20260910_service_time_is_the_countdown',
         'শেখা গড় আর সময় ঠিক করে না', 'estimate_duration_on_chair()',
        coalesce(
          (select pg_get_functiondef(p.oid) not like '%rolling_avg_duration_min%'
             from pg_proc p
            where p.oid = to_regprocedure('public.estimate_duration_on_chair(uuid, uuid[])')),
          false)),

    (22, '20260911_seed_chair_service_stats', 'ট্রিগার', 'chairs_seed_service_stats',
        exists (select 1 from pg_trigger
                 where tgname = 'chairs_seed_service_stats'
                   and not tgisinternal)),

    -- দুটো অংশ, তাই দুটোই যাচাই: চূড়ান্ত বিল লেখার অনুমতি, আর ছবির ট্রিগার।
    (23, '20260912_final_bill_and_customer_photo',
         'চূড়ান্ত বিল + কাস্টমারের ছবি', 'serial_before_update()',
        coalesce(
          (select pg_get_functiondef(p.oid) like '%greatest(0, new.total_amount)%'
             from pg_proc p
            where p.oid = to_regprocedure('public.serial_before_update()')),
          false)
        and exists (select 1 from pg_trigger
                     where tgname = 'serials_z_fill_customer_avatar'
                       and not tgisinternal)),

    (24, '20260913_shops_live_on_registration',
         'ট্রিগার + দুটো নতুন RPC', 'shops_set_live_on_insert',
        exists (select 1 from pg_trigger
                 where tgname = 'shops_set_live_on_insert'
                   and not tgisinternal)
        and to_regprocedure('public.admin_recent_shops(integer, integer)') is not null
        and to_regprocedure('public.admin_audit_feed(text, integer, integer)') is not null),

    -- টেবিল থাকলেই যথেষ্ট নয় — সিডটাও বসেছে কিনা দেখা হয়, নইলে AI-এর
    -- বেছে নেওয়ার মতো কোনো স্টাইলই থাকবে না।
    (25, '20260914_hairstyle_catalogue', 'টেবিল + সিড', 'hairstyles',
        to_regclass('public.hairstyles') is not null
        and to_regclass('public.serial_style_preferences') is not null
        and coalesce((select count(*) >= 18 from public.hairstyles), false)),

    (26, '20260915_style_media_bucket', 'স্টোরেজ বাকেট', 'style-media',
        exists (select 1 from storage.buckets where id = 'style-media'))
)
select
  case when present then '✅' else '❌' end as ok,
  migration,
  kind,
  obj
from checks
order by ord;
