-- Sprint 41: চেয়ার (স্টাফ) ডিলিট — ক্লায়েন্ট থেকে নয়, একটা RPC থেকে
-- Run this once in the Supabase SQL editor, AFTER 20260905.
--
-- ---------------------------------------------------------------------------
-- ব্রাউজার কনসোল যা বলল
-- ---------------------------------------------------------------------------
--   DELETE /rest/v1/chairs?id=eq.…  → 409 (Conflict)
--   PATCH  /rest/v1/chairs?id=eq.…  → 403 (Forbidden)
--
-- অর্থাৎ **দুটো ধাপই আলাদাভাবে আটকাচ্ছে**:
--
-- ৪০৯ = foreign key violation. চেয়ারটাকে অন্য কোনো টেবিল এখনো ধরে রেখেছে —
-- প্রায় নিশ্চিতভাবে `serials` (ওই চেয়ারে আগে হওয়া কাজের ইতিহাস), অথবা
-- `chair_service_stats`-এর সারিগুলো, যেগুলো ক্লায়েন্ট আগে মুছতে গিয়েছিল কিন্তু
-- পারেনি।
--
-- ৪০৩ = ফলব্যাকটাও ব্যর্থ। চেয়ার মুছতে না পেরে কোড ওটাকে `is_active = false`
-- করতে যায়, কিন্তু সেই UPDATE-ও RLS/ট্রিগারে আটকে যাচ্ছে। ফলে দোকানদার চেয়ার
-- মুছতেও পারে না, বন্ধও করতে পারে না — কিছুই হয় না।
--
-- ---------------------------------------------------------------------------
-- কেন RPC-ই ঠিক জায়গা
-- ---------------------------------------------------------------------------
-- এই প্রজেক্টে ঝুঁকিপূর্ণ প্রতিটা অপারেশন ইতিমধ্যেই SECURITY DEFINER RPC —
-- অ্যাকাউন্ট ডিলিট, সিরিয়াল পিছানো, গ্রুপ বুকিং, ব্রেক সেট করা। চেয়ার ডিলিট
-- ক্লায়েন্ট থেকে দুটো আলাদা টেবিলে পরপর DELETE মেরে করার চেষ্টা করা হচ্ছিল,
-- যার মানে: কোনো ট্রানজেকশন নেই (প্রথমটা সফল, দ্বিতীয়টা ব্যর্থ = অর্ধেক
-- মোছা), আর প্রতিটা ধাপ আলাদা করে RLS ও ট্রিগারের মুখে পড়ে।
--
-- একটা ফাংশনে আনলে: এক ট্রানজেকশন, একবার মালিকানা যাচাই, আর **সিদ্ধান্তটা
-- ডেটাবেসেই নেওয়া হয়** — ইতিহাস থাকলে মোছা হবে না, না থাকলে হবে। ফলাফলটা
-- স্পষ্ট করে ফেরত আসে, তাই UI-কে আর HTTP কোড দেখে অনুমান করতে হয় না।
--
-- নীতি অপরিবর্তিত: **সিরিয়াল ইতিহাস কখনো মোছা হয় না।** ওই চেয়ারে কাজ হয়ে
-- থাকলে চেয়ারটা বন্ধ করা হয়, মোছা হয় না — দোকানের ইনকাম আর হিসাব অক্ষত থাকে।

create or replace function public.delete_chair(p_chair_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chair   chairs%rowtype;
  v_serials integer;
begin
  select * into v_chair from public.chairs where id = p_chair_id;
  if not found then
    -- আগেই মুছে গেছে। এটা ব্যর্থতা নয় — যা চাওয়া হয়েছিল, তা-ই আছে।
    return json_build_object('deleted', true, 'reason', 'already_gone');
  end if;

  if not public.is_shop_owner(v_chair.shop_id) then
    raise exception 'not your shop';
  end if;

  select count(*) into v_serials
    from public.serials where chair_id = p_chair_id;

  if v_serials > 0 then
    -- ইতিহাস আছে — বন্ধ করো, মুছো না।
    update public.chairs set is_active = false where id = p_chair_id;
    return json_build_object(
      'deleted', false,
      'reason', 'has_history',
      'serials', v_serials
    );
  end if;

  -- can_perform ম্যাট্রিক্স কনফিগারেশন, ইতিহাস নয় — চেয়ারের সাথেই যায়।
  -- শেখা গড় লেখার জন্য যে আনলকটা লাগে, মোছার জন্যও সেটাই লাগে।
  perform set_config('queueflow.stats_write', 'on', true);
  delete from public.chair_service_stats where chair_id = p_chair_id;

  delete from public.chairs where id = p_chair_id;

  return json_build_object('deleted', true, 'reason', 'removed');
end;
$$;

grant execute on function public.delete_chair(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ফলব্যাকটাও যেন কাজ করে: চেয়ার বন্ধ/চালু করার RPC
-- ---------------------------------------------------------------------------
-- PATCH-এ ৪০৩ আসছিল, অর্থাৎ চেয়ার বন্ধ করাও ভাঙা। টগলটা একই পথে আনলে দুটোই
-- একসাথে ঠিক হয়, আর ভবিষ্যতে RLS বদলালেও আলাদা হয়ে যাবে না।
create or replace function public.set_chair_active(
  p_chair_id uuid,
  p_active   boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_shop uuid;
begin
  select shop_id into v_shop from public.chairs where id = p_chair_id;
  if v_shop is null then
    raise exception 'chair not found';
  end if;
  if not public.is_shop_owner(v_shop) then
    raise exception 'not your shop';
  end if;

  update public.chairs set is_active = p_active where id = p_chair_id;
end;
$$;

grant execute on function public.set_chair_active(uuid, boolean) to authenticated;
