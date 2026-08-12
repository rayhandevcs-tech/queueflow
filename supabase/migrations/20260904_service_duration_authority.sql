-- Sprint 40: দোকানদার যে সময় সেট করে, সেটাই চূড়ান্ত — আর চেয়ার সত্যিই ডিলিট হবে
-- Run this once in the Supabase SQL editor, AFTER 20260903_account_delete_fix.sql.
--
-- ---------------------------------------------------------------------------
-- ১) "সার্ভিসে ৪০ মিনিট দিলাম, কিউতে ৫ মিনিট দেখায়" — কেন
-- ---------------------------------------------------------------------------
-- estimate_duration_on_chair() লেখা আছে এভাবে (বেসলাইন কিউ ইঞ্জিন):
--
--     coalesce(css.rolling_avg_duration_min, s.default_duration_min)
--
-- অর্থাৎ চেয়ার-প্রতি **শেখা গড়টাই আগে**, দোকানদারের সেট করা সময় কেবল ফলব্যাক।
-- গড়টা শেখায় serial_after_update(): একটা সিরিয়াল DONE হলে সত্যিকারের সময় নিয়ে
-- ৭০/৩০ অনুপাতে rolling_avg_duration_min আপডেট করে।
--
-- টেস্ট করার সময় সিরিয়াল শুরু করে সেকেন্ডের মধ্যে DONE করলে actual = ১ মিনিট,
-- আর কয়েকবারেই গড়টা ১–৫ মিনিটে নেমে যায়। এরপর সার্ভিসের সময় ৪০ করে দিলেও
-- **কিছুই বদলায় না** — coalesce শেখা গড়টাকেই বেছে নেয়। স্ক্রিনশটে চেয়ারের
-- ব্যাকলগ "১০ মিনিট" মানে দুটো Hair Cutting-এর প্রত্যেকটা ৫ মিনিট ধরা হচ্ছে।
--
-- শেখার ব্যবস্থাটা ভুল নয় — একটা দোকানে একটা সার্ভিস সত্যিই কত সময় নেয়, সেটা
-- বাস্তব থেকে শেখাই ঠিক। ভুল হলো **অগ্রাধিকার**: দোকানদার যখন নিজে হাতে সময়
-- বদলায়, সে তখন সরাসরি বলছে সঠিক সংখ্যাটা কত। কয়েকটা রানের অনুমান তার উপরে
-- বসতে পারে না। তাই সময় বদলালেই শেখা গড় মুছে যাবে, আর নতুন সংখ্যা থেকে আবার
-- শেখা শুরু হবে।
--
-- estimate_duration_on_chair()-এ হাত দেওয়া হয়নি ইচ্ছে করেই — শেখা গড় কাজে লাগে,
-- এটা শুধু ঠিক করে কখন সেটা বাতিল।

create or replace function public.reset_learned_duration_on_service_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.default_duration_min is distinct from old.default_duration_min then
    -- The learning trigger holds this unlock while it writes; the protective
    -- trigger on chair_service_stats rejects the write without it.
    perform set_config('queueflow.stats_write', 'on', true);

    update public.chair_service_stats
       set rolling_avg_duration_min = null,
           completed_count = 0,
           updated_at = now()
     where service_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists services_reset_learned_duration on public.services;
create trigger services_reset_learned_duration
  after update on public.services
  for each row
  execute function public.reset_learned_duration_on_service_change();

-- ---------------------------------------------------------------------------
-- ২) একবারের সংশোধন — এখনকার শেখা গড়গুলো মুছে দাও
-- ---------------------------------------------------------------------------
-- উপরের ট্রিগার এখন থেকে কাজ করবে, কিন্তু ইতিমধ্যে জমে থাকা ভুল গড়গুলো
-- (টেস্ট সিরিয়াল সেকেন্ডে শেষ করার ফল) এমনিতে যাবে না। এই একটা স্টেটমেন্ট
-- সবগুলো ভুলিয়ে দেয়; প্রতিটা সার্ভিস আবার তার নিজের সেট করা সময় থেকে শুরু
-- করবে, আর আসল কাজ থেকে আবার শিখবে।
--
-- can_perform ছোঁয়া হয়নি — ওটা কোন চেয়ার কী পারে তার কনফিগারেশন, শেখা কিছু নয়।
do $$
begin
  perform set_config('queueflow.stats_write', 'on', true);
  update public.chair_service_stats
     set rolling_avg_duration_min = null,
         completed_count = 0,
         updated_at = now()
   where rolling_avg_duration_min is not null;
end $$;

-- চলমান/অপেক্ষমাণ সিরিয়ালগুলো বুকিংয়ের সময়কার সংখ্যা নিয়ে বসে আছে, তাই
-- সেগুলোকে নতুন করে হিসাব করিয়ে দাও — নাহলে বোর্ডে পুরোনো ৫ মিনিটই থেকে যাবে।
do $$
declare c record;
begin
  for c in
    select distinct chair_id from public.serials
     where status in ('WAITING', 'IN_PROGRESS')
  loop
    update public.serials
       set estimated_duration_min =
             public.estimate_duration_on_chair(chair_id, service_ids)
     where chair_id = c.chair_id
       and status = 'WAITING';

    perform public.recalc_queue_estimates(c.chair_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- ৩) চেয়ার (স্টাফ) ডিলিট — নীতিগুলো সত্যিই আছে কিনা নিশ্চিত করা
-- ---------------------------------------------------------------------------
-- ক্লায়েন্ট-সাইডের দুটো কারণ Sprint 39-এ ঠিক হয়েছে (chair_service_stats আগে
-- মোছা, আর "শূন্য সারি মোছা"-কে সফল না ধরা)। কিন্তু DELETE পলিসিটা লাইভ
-- ডেটাবেসে আদৌ আছে কিনা সেটা যাচাই করা যায়নি — বেসলাইন ক্যাপচার মাইগ্রেশনে
-- আছে, আর ওটা চালানো হয়েছে কিনা জানা নেই। পলিসি না থাকলে PostgREST কোনো এরর
-- দেয় না, চুপচাপ শূন্য সারি মোছে — ঠিক যে আচরণটা "ডিলিট হয় না" বলে মনে হয়।
--
-- নিচেরটা idempotent: থাকলে কিছু বদলায় না, না থাকলে বসিয়ে দেয়।
drop policy if exists "chairs: owner delete" on public.chairs;
create policy "chairs: owner delete" on public.chairs
  for delete to authenticated
  using (public.is_shop_owner(shop_id));

drop policy if exists "chair_service_stats: owner delete" on public.chair_service_stats;
create policy "chair_service_stats: owner delete" on public.chair_service_stats
  for delete to authenticated
  using (
    public.is_shop_owner(
      (select c.shop_id from public.chairs c where c.id = chair_service_stats.chair_id)
    )
  );

-- ---------------------------------------------------------------------------
-- যাচাই
-- ---------------------------------------------------------------------------
-- ১) কোনো শেখা গড় আর নেই (0 আসার কথা):
--    select count(*) from public.chair_service_stats
--     where rolling_avg_duration_min is not null;
--
-- ২) অপেক্ষমাণ সিরিয়ালগুলো এখন সার্ভিসের সেট করা সময় ধরছে:
--    select s.position, se.name, s.estimated_duration_min, se.default_duration_min
--      from public.serials s
--      join public.services se on se.id = s.service_ids[1]
--     where s.status = 'WAITING';
