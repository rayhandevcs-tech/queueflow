-- Sprint 45: আসল বিলটা কাজ শেষে ঠিক করা, আর কাস্টমারের ছবি ফিরিয়ে আনা
-- Run this once in the Supabase SQL editor, AFTER 20260911.
--
-- ---------------------------------------------------------------------------
-- ১) সার্ভিসের দাম অনুমান, চূড়ান্ত বিল নয়
-- ---------------------------------------------------------------------------
-- দোকানদার সার্ভিসে ৳১০০ লিখে রাখে, কিন্তু কাজ শেষে বাস্তবে ৳১২০ বা ৳৮০ হতে
-- পারে — একটু বেশি কাজ লাগল, বা পরিচিত কাউকে ছাড় দিল। এতদিন সেটা লেখার কোনো
-- জায়গা ছিল না, কারণ serial_before_update() প্রতিটা আপডেটে লিখত:
--
--     new.total_amount := old.total_amount;
--
-- অর্থাৎ বুকিংয়ের সময়কার হিসাবটাই চিরস্থায়ী। এটা ইচ্ছাকৃত ছিল, আর বেশিরভাগ
-- ক্ষেত্রে ঠিকও — চলতি সিরিয়ালের দাম কেউ বদলাতে পারবে না। কিন্তু **কাজ সম্পন্ন
-- করার মুহূর্তটা** ব্যতিক্রম: ওটাই একমাত্র সময় যখন আসল টাকার অঙ্কটা জানা যায়।
--
-- তাই তালাটা শুধু ওই এক ট্রানজিশনে খোলা হচ্ছে — IN_PROGRESS → DONE। বাকি
-- প্রতিটা আপডেটে আগের মতোই অপরিবর্তনীয়। ঋণাত্মক অঙ্ক greatest(0, ...) দিয়ে
-- আটকানো।
--
-- নিচেরটা 20260910-এর serial_before_update()-এর হুবহু কপি, শুধু চিহ্নিত
-- ব্লকটুকু বদলানো।
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

      -- Sprint 44: ঘড়িটা এখন চালু হচ্ছে, তাই সময়টা এই মুহূর্তের সার্ভিস থেকে
      -- নেওয়া হয় — বুকিংয়ের সময়কার পুরোনো সংখ্যা থেকে নয়।
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

  -- CHANGED (Sprint 45): কাজ শেষ করার মুহূর্তে চূড়ান্ত বিল লেখা যাবে।
  -- services_snapshot উপরে অপরিবর্তিতই থাকছে — ওটা কী কী কাজ কত দরে বলা
  -- হয়েছিল তার রেকর্ড, আর total_amount শেষে কত নেওয়া হলো। দুটো আলাদা তথ্য,
  -- দুটোই রাখা দরকার।
  if old.status = 'IN_PROGRESS'
     and new.status = 'DONE'
     and new.total_amount is not null then
    new.total_amount := greatest(0, new.total_amount);
  else
    new.total_amount := old.total_amount;
  end if;

  new.travel_min        := old.travel_min;
  new.group_id          := old.group_id;
  new.party_seq         := old.party_seq;
  new.party_member_name := old.party_member_name;

  return new;
end; $function$;

-- ---------------------------------------------------------------------------
-- ২) কাস্টমারের ছবি আবার সংরক্ষিত হবে
-- ---------------------------------------------------------------------------
-- serials.customer_avatar_url কলামটা 20260808-এ যোগ হয়েছিল, আর তখনকার
-- serial_before_insert() সেটা ভরত। কিন্তু 20260828 (গ্রুপ বুকিং) ফাংশনটা নতুন
-- করে লেখার সময় ওই লাইনটা বাদ পড়ে যায় — এরপর থেকে প্রতিটা নতুন সিরিয়ালে
-- ছবিটা null। প্রোভাইডার সরাসরি profiles পড়তে পারে না (RLS), তাই এই স্ন্যাপশটই
-- দোকানের দিকে কাস্টমারের ছবি দেখানোর একমাত্র উৎস।
--
-- বড় ফাংশনটা আবার নতুন করে লেখা হচ্ছে না — একটা মাত্র কলামের জন্য একশো লাইন
-- আবার টাইপ করা মানে অন্য কিছু হারানোর ঝুঁকি নেওয়া। বদলে একটা আলাদা ছোট
-- ট্রিগার, যেটা মূলটার **পরে** চলে (PostgreSQL একই ইভেন্টের ট্রিগার নামের
-- বর্ণানুক্রমে চালায়, আর 'serials_z...' > 'serials_before_insert')।
create or replace function public.fill_customer_avatar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is not null and new.customer_avatar_url is null then
    select avatar_url into new.customer_avatar_url
      from public.profiles where id = new.customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists serials_z_fill_customer_avatar on public.serials;
create trigger serials_z_fill_customer_avatar
  before insert on public.serials
  for each row
  execute function public.fill_customer_avatar();

-- ---------------------------------------------------------------------------
-- ৩) ব্যাকফিল — 20260828-এর পর তৈরি হওয়া সিরিয়ালগুলোর ছবি
-- ---------------------------------------------------------------------------
do $$
declare v_filled integer;
begin
  update public.serials s
     set customer_avatar_url = p.avatar_url
    from public.profiles p
   where p.id = s.customer_id
     and s.customer_avatar_url is null
     and p.avatar_url is not null;

  get diagnostics v_filled = row_count;
  raise notice 'customer_avatar_url: % টা সিরিয়ালে ছবি বসানো হলো', v_filled;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- যাচাই
-- ---------------------------------------------------------------------------
-- ১) চূড়ান্ত বিল লেখার অনুমতি বসেছে (true আসার কথা):
--
--    select pg_get_functiondef(oid) like '%greatest(0, new.total_amount)%' as ok
--      from pg_proc where oid = to_regprocedure('public.serial_before_update()');
--
-- ২) ছবির ট্রিগার আছে (এক সারি আসার কথা):
--
--    select tgname from pg_trigger
--     where tgname = 'serials_z_fill_customer_avatar' and not tgisinternal;
