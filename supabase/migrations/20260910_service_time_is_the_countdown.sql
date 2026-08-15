-- Sprint 44: সার্ভিসে যে সময় সেট করা, লাইভ সিরিয়ালে ঠিক সেই সময়ই কাউন্টডাউন হবে
-- Run this once in the Supabase SQL editor, AFTER 20260909.
--
-- ---------------------------------------------------------------------------
-- আসল কারণ — একটাই coalesce
-- ---------------------------------------------------------------------------
-- estimate_duration_on_chair() বেসলাইন থেকেই এভাবে লেখা:
--
--     coalesce(css.rolling_avg_duration_min, s.default_duration_min)
--
-- অর্থাৎ চেয়ার-প্রতি **শেখা গড়টাই আগে**, দোকানদারের সেট করা সময় কেবল ফলব্যাক।
-- গড়টা শেখায় serial_after_update(): সিরিয়াল DONE হলে সত্যিকারের সময় নিয়ে
-- ৭০/৩০ অনুপাতে rolling_avg_duration_min আপডেট করে।
--
-- Sprint 40 (20260904) এটা ঠিক করার চেষ্টা করেছিল — সার্ভিসের সময় বদলালে শেখা
-- গড় মুছে দেওয়া হতো। কিন্তু ওটা যথেষ্ট নয়: গড়টা মুছলেও **পরের DONE সিরিয়ালেই
-- আবার তৈরি হয়ে যায়**। টেস্ট করার সময় সিরিয়াল শুরু করে কয়েক সেকেন্ডে শেষ
-- করলে actual = ১ মিনিট, আর দু-তিনবারেই গড় ১–৩ মিনিটে নেমে আসে। তাই ৪০ মিনিট
-- সেট করা সার্ভিসেও কাউন্টডাউন আবার ৩ মিনিট হয়ে যায় — স্ক্রিনশটে ঠিক এটাই।
--
-- ---------------------------------------------------------------------------
-- সিদ্ধান্ত — কে চূড়ান্ত
-- ---------------------------------------------------------------------------
-- দোকানদার যখন সার্ভিসে "৪০ মিনিট" লেখে, সেটা অনুমান নয় — সেটা সে কাস্টমারকে
-- যে প্রতিশ্রুতি দিচ্ছে। কাস্টমারের ফোনে যে ঘড়িটা ঘোরে, সেটা ওই সংখ্যাটাই
-- দেখাবে। কয়েকটা রানের গড় তার উপরে বসতে পারে না।
--
-- তাই estimate_duration_on_chair() এখন শুধু default_duration_min ধরে।
--
-- শেখার ব্যবস্থাটা **মুছে ফেলা হয়নি** — serial_after_update() আগের মতোই
-- rolling_avg_duration_min আর completed_count লিখে যাবে। ওটা সত্যিকারের তথ্য,
-- পরে "তোমার সার্ভিসটা আসলে গড়ে ২৫ মিনিট নেয়, সময়টা বদলাবে?" — এমন পরামর্শ
-- দেখানোর কাজে লাগবে। শুধু সেটা আর নিজে থেকে দোকানদারের সংখ্যাকে ছাপিয়ে যাবে না।

-- ---------------------------------------------------------------------------
-- ১) সময়ের একমাত্র উৎস — সার্ভিসের নিজের সেট করা সময়
-- ---------------------------------------------------------------------------
create or replace function public.estimate_duration_on_chair(
  p_chair_id uuid, p_service_ids uuid[]
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  -- p_chair_id আর ব্যবহার হয় না, কিন্তু সিগনেচারটা রাখা হয়েছে: এটা ছয় জায়গা
  -- থেকে ডাকা হয়, আর "কোন চেয়ারে কত সময়" ভবিষ্যতে আবার লাগতে পারে।
  select greatest(coalesce(sum(s.default_duration_min), 0), 1)::integer
  from unnest(p_service_ids) as sid
  join public.services s on s.id = sid;
$$;

-- ---------------------------------------------------------------------------
-- ২) কাজ শুরুর মুহূর্তে সময়টা আবার মিলিয়ে নেওয়া
-- ---------------------------------------------------------------------------
-- estimated_duration_min লেখা হয় **বুকিংয়ের সময়**। সিরিয়ালটা কিউতে বসে থাকা
-- অবস্থায় দোকানদার যদি সার্ভিসের সময় বদলায়, ওই সারিটা পুরোনো সংখ্যা নিয়েই
-- বসে থাকত — আর "শুরু" চাপলে ভুল কাউন্টডাউন চালু হতো।
--
-- তাই WAITING → IN_PROGRESS মুহূর্তে সংখ্যাটা আরেকবার সার্ভিস থেকে নেওয়া হয়।
-- হাতে বাড়ানো সময় (+৫/+১০/কাস্টম) থাকলে ছোঁয়া হয় না — সেটা দোকানদারের
-- সচেতন সিদ্ধান্ত, তার উপরে স্বয়ংক্রিয় কিছু বসবে না।
--
-- নিচেরটা 20260828-এর serial_before_update()-এর হুবহু কপি, শুধু চিহ্নিত
-- ব্লকটুকু যোগ করা।
CREATE OR REPLACE FUNCTION public.serial_before_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.chair_id is distinct from old.chair_id then
    if old.status <> 'WAITING' or new.status <> 'WAITING' then
      raise exception 'only WAITING serials can be moved between chairs';
    end if;

    if not exists (
      select 1 from public.chairs
      where id = new.chair_id and shop_id = old.shop_id and is_active = true
    ) then
      raise exception 'target chair does not belong to this shop or is inactive';
    end if;

    if exists (
      select 1 from unnest(old.service_ids) as sid
      where not exists (
        select 1 from public.chair_service_stats css
        where css.chair_id = new.chair_id
          and css.service_id = sid
          and css.can_perform = true)
    ) then
      raise exception 'target chair cannot perform this serial''s services';
    end if;

    perform pg_advisory_xact_lock(hashtext('chair:' || new.chair_id::text));

    select coalesce(max(position), 0) + 1
      into new.position
      from public.serials
     where chair_id = new.chair_id
       and status in ('WAITING', 'IN_PROGRESS');

    new.estimated_duration_min :=
      public.estimate_duration_on_chair(new.chair_id, old.service_ids);
    new.assignment_mode := 'MANUAL';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'WAITING'     and new.status in ('IN_PROGRESS','CANCELLED','NO_SHOW')) or
      (old.status = 'IN_PROGRESS' and new.status in ('DONE','CANCELLED'))
    ) then
      raise exception 'invalid status transition: % -> %', old.status, new.status;
    end if;

    if new.status = 'NO_SHOW' then
      if old.called_at is null then
        raise exception 'no_show_requires_call';
      end if;
      if now() < old.called_at + interval '5 minutes' then
        raise exception 'no_show_grace_period';
      end if;
    end if;

    if new.status = 'IN_PROGRESS' then
      new.started_at := coalesce(new.started_at, now());

      -- CHANGED (Sprint 44): ঘড়িটা এখন চালু হচ্ছে, তাই সময়টা এই মুহূর্তের
      -- সার্ভিস থেকে নেওয়া হয় — বুকিংয়ের সময়কার পুরোনো সংখ্যা থেকে নয়।
      -- old.service_ids ব্যবহার করা হয়েছে ইচ্ছে করেই: service_ids বুকিংয়ের
      -- সময়ই চূড়ান্ত, আর সেটা নিচে old থেকেই ফিরিয়ে দেওয়া হয়।
      if coalesce(old.extended_min, 0) = 0 then
        new.estimated_duration_min :=
          public.estimate_duration_on_chair(new.chair_id, old.service_ids);
      end if;
    elsif new.status = 'DONE' then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  end if;

  new.shop_id           := old.shop_id;
  if not (new.customer_id is null
          and old.customer_id is not null
          and public.is_platform_admin()) then
    new.customer_id := old.customer_id;
  end if;
  new.is_walk_in        := old.is_walk_in;
  new.booked_at         := old.booked_at;
  new.service_ids       := old.service_ids;
  new.services_snapshot := old.services_snapshot;
  new.total_amount      := old.total_amount;
  new.travel_min        := old.travel_min;
  new.group_id          := old.group_id;
  new.party_seq         := old.party_seq;
  new.party_member_name := old.party_member_name;

  return new;
end; $function$;

-- ---------------------------------------------------------------------------
-- ৩) সময় বদলালে অপেক্ষমাণ সিরিয়ালগুলোও সঙ্গে সঙ্গে বদলাবে
-- ---------------------------------------------------------------------------
-- 20260904-এর ট্রিগারটা শুধু শেখা গড় মুছত। এখন সেটা একই লেনদেনে কিউটাও
-- মিলিয়ে দেয়, তাই সার্ভিস সেভ করার সাথে সাথেই বোর্ডে নতুন সংখ্যা দেখা যায় —
-- পরের বুকিং পর্যন্ত অপেক্ষা করতে হয় না।
create or replace function public.reset_learned_duration_on_service_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare c record;
begin
  if new.default_duration_min is distinct from old.default_duration_min then
    -- শেখা গড়টা আর অনুমানে ব্যবহার হয় না, তবু মুছে দেওয়া হয়: পুরোনো সার্ভিসের
    -- গড় দিয়ে নতুন সার্ভিসের পরামর্শ দেখানো ভুল হবে। শেখা নতুন সংখ্যা থেকে
    -- আবার শুরু হবে।
    perform set_config('queueflow.stats_write', 'on', true);

    update public.chair_service_stats
       set rolling_avg_duration_min = null,
           completed_count = 0,
           updated_at = now()
     where service_id = new.id;

    -- NEW (Sprint 44): কিউতে বসে থাকা সারিগুলো বুকিংয়ের সময়কার সংখ্যা ধরে
    -- আছে — সেগুলোকে নতুন সময়ে আনো, তারপর ETA আবার হিসাব করাও।
    -- হাতে বাড়ানো (extended_min > 0) সারি বাদ, চলমান কাজও বাদ: মাঝপথে ঘড়ি
    -- লাফ দিলে দোকানদার আর কাস্টমার দুজনেই বিভ্রান্ত হয়।
    for c in
      select distinct chair_id
        from public.serials
       where status = 'WAITING'
         and new.id = any(service_ids)
    loop
      update public.serials
         set estimated_duration_min =
               public.estimate_duration_on_chair(chair_id, service_ids)
       where chair_id = c.chair_id
         and status = 'WAITING'
         and coalesce(extended_min, 0) = 0;

      perform public.recalc_queue_estimates(c.chair_id);
    end loop;
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
-- ৪) একবারের সংশোধন — এখন কিউতে যা বসে আছে
-- ---------------------------------------------------------------------------
-- উপরের সবকিছু এখন থেকে কাজ করবে, কিন্তু এই মুহূর্তে অপেক্ষমাণ সারিগুলো এখনো
-- শেখা গড় ধরে আছে। এই ব্লকটা সেগুলোকে সার্ভিসের সেট করা সময়ে নিয়ে আসে।
-- চলমান (IN_PROGRESS) কাজ ছোঁয়া হয়নি — চলতে থাকা ঘড়ি মাঝপথে বদলানো হয় না।
do $$
declare c record;
begin
  perform set_config('queueflow.stats_write', 'on', true);
  update public.chair_service_stats
     set rolling_avg_duration_min = null,
         completed_count = 0,
         updated_at = now()
   where rolling_avg_duration_min is not null;

  for c in
    select distinct chair_id from public.serials
     where status in ('WAITING', 'IN_PROGRESS')
  loop
    update public.serials
       set estimated_duration_min =
             public.estimate_duration_on_chair(chair_id, service_ids)
     where chair_id = c.chair_id
       and status = 'WAITING'
       and coalesce(extended_min, 0) = 0;

    perform public.recalc_queue_estimates(c.chair_id);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- যাচাই
-- ---------------------------------------------------------------------------
-- ১) অনুমান আর শেখা গড় দেখে না (false আসার কথা):
--
--    select pg_get_functiondef(oid) like '%rolling_avg_duration_min%' as still_learning
--      from pg_proc where oid = to_regprocedure('public.estimate_duration_on_chair(uuid, uuid[])');
--
-- ২) প্রতিটা অপেক্ষমাণ সিরিয়ালের সময় = সার্ভিসের সেট করা সময়
--    (mismatch কলামে সব false আসার কথা):
--
--    select s.position, se.name,
--           s.estimated_duration_min, se.default_duration_min,
--           s.estimated_duration_min <> se.default_duration_min as mismatch
--      from public.serials s
--      join public.services se on se.id = s.service_ids[1]
--     where s.status = 'WAITING'
--       and cardinality(s.service_ids) = 1
--       and coalesce(s.extended_min, 0) = 0;
