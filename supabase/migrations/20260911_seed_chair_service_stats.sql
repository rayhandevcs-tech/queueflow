-- Sprint 44: নতুন স্টাফ কোনো সার্ভিসই করতে পারত না
-- Run this once in the Supabase SQL editor, AFTER 20260910.
--
-- ---------------------------------------------------------------------------
-- বাগটা
-- ---------------------------------------------------------------------------
-- রহিম বা করিমকে বেছে "কিউতে যোগ করো" চাপলে:
--
--   {"code": "P0001", "message": "selected chair cannot perform all requested services"}
--
-- অথচ ক্যাটালগের ম্যাট্রিক্সে ওই ঘরগুলোয় সবুজ টিক দেখাচ্ছিল।
--
-- কে যোগ্য, সেটা DB ঠিক করে chair_service_stats থেকে:
--
--   exists (select 1 from chair_service_stats
--            where chair_id = ... and service_id = ... and can_perform = true)
--
-- অর্থাৎ **সারি না থাকা = পারে না**। আর কোড দুই জায়গায় ধরে নিয়েছিল সারিগুলো
-- আপনাআপনি তৈরি হয়:
--
--   chairs.api.ts   → "DB trigger auto-seeds chair_service_stats for every service"
--   services.api.ts → "DB trigger auto-seeds chair_service_stats for every chair"
--
-- **সেই ট্রিগার দুটো কোথাও ছিল না।** পুরো স্কিমায় chair_service_stats-এ একটাই
-- insert — serial_after_update()-এর শেখার লুপে, অর্থাৎ ওই চেয়ারে ওই সার্ভিসের
-- একটা সিরিয়াল DONE হওয়ার **পরে**। তাই:
--
--   * রায়হান চেয়ারটা কাজ করত — ওখানে আগে সিরিয়াল সম্পন্ন হয়েছে, সারি তৈরি হয়ে গেছে।
--   * রহিম আর করিম নতুন — একটাও সারি নেই, তাই কিছুই করতে পারে না।
--
-- UI-টা উল্টো দিকে ভুল করছিল: CanPerformMatrix সারি না পেলে `?? true` ধরে,
-- অর্থাৎ **সারি না থাকা = পারে** দেখাত। দুই পক্ষ একই শূন্যতাকে ঠিক উল্টো
-- অর্থে পড়ছিল — দোকানদার সবুজ টিক দেখে, DB "পারে না" বলে।
--
-- আরেকটা ফল: ম্যাট্রিক্সের টিক টেপাও কাজ করত না। setCanPerform() একটা UPDATE
-- চালায়; সারি না থাকলে শূন্য সারি বদলায়, আর PostgREST শূন্য-সারি UPDATE-কে
-- এরর বলে না — তাই নিঃশব্দে কিছুই হতো না।

-- ---------------------------------------------------------------------------
-- ১) নতুন চেয়ার → দোকানের প্রতিটা সার্ভিসের সারি
-- ---------------------------------------------------------------------------
-- ডিফল্ট true: নতুন স্টাফ নিয়োগের পর দোকানদারের প্রত্যাশা "এ সব কাজ পারে",
-- ব্যতিক্রম থাকলে ম্যাট্রিক্স থেকে টিক তুলে দেবে। উল্টোটা — সবকিছু বন্ধ অবস্থায়
-- শুরু — মানে নতুন স্টাফ যোগ করার পর কেউ বুঝতেই পারবে না কেন তাকে বেছে নেওয়া
-- যাচ্ছে না, যেটা ঠিক এই বাগটাই।
create or replace function public.seed_stats_for_new_chair()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('queueflow.stats_write', 'on', true);

  insert into public.chair_service_stats (chair_id, service_id, can_perform)
  select new.id, s.id, true
    from public.services s
   where s.shop_id = new.shop_id
  on conflict (chair_id, service_id) do nothing;

  return new;
end;
$$;

drop trigger if exists chairs_seed_service_stats on public.chairs;
create trigger chairs_seed_service_stats
  after insert on public.chairs
  for each row
  execute function public.seed_stats_for_new_chair();

-- ---------------------------------------------------------------------------
-- ২) নতুন সার্ভিস → দোকানের প্রতিটা চেয়ারের সারি
-- ---------------------------------------------------------------------------
create or replace function public.seed_stats_for_new_service()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('queueflow.stats_write', 'on', true);

  insert into public.chair_service_stats (chair_id, service_id, can_perform)
  select c.id, new.id, true
    from public.chairs c
   where c.shop_id = new.shop_id
  on conflict (chair_id, service_id) do nothing;

  return new;
end;
$$;

drop trigger if exists services_seed_chair_stats on public.services;
create trigger services_seed_chair_stats
  after insert on public.services
  for each row
  execute function public.seed_stats_for_new_service();

-- ---------------------------------------------------------------------------
-- ৩) ব্যাকফিল — এখন যে জোড়াগুলোর সারি নেই
-- ---------------------------------------------------------------------------
-- উপরের ট্রিগার দুটো এখন থেকে কাজ করবে, কিন্তু ইতিমধ্যে যোগ করা প্রতিটা চেয়ার
-- (রহিম, করিম সহ) এখনো শূন্য। প্রতিটা দোকানের চেয়ার × সার্ভিস জোড়ার জন্য
-- অনুপস্থিত সারিগুলো এখানে তৈরি হয়।
--
-- `on conflict do nothing` — যেসব জোড়ার সারি আছে, তাদের can_perform ছোঁয়া হয়
-- না। দোকানদার ইচ্ছে করে কোনো টিক তুলে রাখলে সেটা যেন ফিরে না আসে।
do $$
declare v_added integer;
begin
  perform set_config('queueflow.stats_write', 'on', true);

  insert into public.chair_service_stats (chair_id, service_id, can_perform)
  select c.id, s.id, true
    from public.chairs c
    join public.services s on s.shop_id = c.shop_id
  on conflict (chair_id, service_id) do nothing;

  get diagnostics v_added = row_count;
  raise notice 'chair_service_stats: % টা নতুন সারি যোগ হলো', v_added;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- যাচাই — শূন্য সারি ফিরলে ঠিক আছে (কোনো জোড়া আর বাদ নেই)
-- ---------------------------------------------------------------------------
--   select sh.name as shop, c.staff_name, s.name as service
--     from public.chairs c
--     join public.services s on s.shop_id = c.shop_id
--     join public.shops sh on sh.id = c.shop_id
--    where not exists (
--      select 1 from public.chair_service_stats css
--       where css.chair_id = c.id and css.service_id = s.id);
