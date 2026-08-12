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

    (14, '20260903_account_delete_fix',
         'admin_delete_user() আর auth.users ছোঁয় না', 'admin_delete_user()',
        coalesce(
          (select pg_get_functiondef(p.oid) not like '%delete from auth.users%'
             from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'admin_delete_user'
            limit 1),
          false))
)
select
  case when present then '✅' else '❌' end as ok,
  migration,
  kind,
  obj
from checks
order by ord;
