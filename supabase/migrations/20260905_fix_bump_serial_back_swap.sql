-- Sprint 40b: "একধাপ পিছাও" ঠিক করা — পজিশন অদলবদলে সংঘর্ষ
-- Run this once in the Supabase SQL editor, AFTER 20260904.
--
-- ---------------------------------------------------------------------------
-- বাগটা কী ছিল
-- ---------------------------------------------------------------------------
-- bump_serial_back() দুটো সারির position অদলবদল করত সরাসরি:
--
--     update serials set position = v_serial.position where id = v_next.id;   -- (১)
--     update serials set position = v_next.position   where id = v_serial.id; -- (২)
--
-- কিন্তু serials-এ (chair_id, position) নিয়ে একটা unique ইনডেক্স আছে। (১)
-- চালানোর মুহূর্তে v_serial **এখনো** ওই position ধরে বসে আছে — অর্থাৎ এক লেনে
-- দুটো সারি একই position চায়। Postgres 23505 (unique_violation) ছোঁড়ে,
-- PostgREST সেটাকে **409 Conflict** করে ফেরত দেয়। ব্রাউজার কনসোলে ঠিক সেটাই
-- দেখা যাচ্ছিল।
--
-- অর্থাৎ ফাংশনটা কখনোই কাজ করেনি — শর্ত ঠিক থাকলেও প্রথম UPDATE-এই মরে যেত।
-- একটা "temporary NULL" ধাপ ছাড়া SQL-এ দুটো unique মান অদলবদল করা যায় না।
--
-- ---------------------------------------------------------------------------
-- সমাধান
-- ---------------------------------------------------------------------------
-- তিন ধাপে: প্রথমে যাকে পেছাবো তাকে লেনের **সবার শেষে** সরিয়ে রাখো (ওখানে কেউ
-- নেই), তারপর পরেরজনকে তার খালি হওয়া জায়গায় আনো, তারপর তাকে পরেরজনের পুরোনো
-- জায়গায় বসাও। প্রতিটা ধাপেই লেনে position ইউনিক থাকে, তাই কোথাও সংঘর্ষ নেই।
--
-- পুরোটা advisory lock-এর ভেতরে (আগেও ছিল), তাই "সবার শেষ" বের করার আর সেটা
-- ব্যবহার করার মাঝখানে অন্য কেউ ঢুকতে পারে না।
--
-- বাকি সব অপরিবর্তিত: একই মালিকানা যাচাই, একই WAITING শর্ত, একই
-- nothing_to_bump, একই recalc, একই নোটিফিকেশন।

create or replace function public.bump_serial_back(p_serial_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serial record;
  v_next   record;
  v_park   integer;
begin
  select * into v_serial from public.serials where id = p_serial_id;
  if not found then
    raise exception 'serial not found';
  end if;
  if not public.is_shop_owner(v_serial.shop_id) then
    raise exception 'not your shop';
  end if;
  if v_serial.status <> 'WAITING' then
    raise exception 'serial is not waiting';
  end if;

  perform pg_advisory_xact_lock(hashtext('chair:' || v_serial.chair_id::text));

  select * into v_next
    from public.serials
   where chair_id = v_serial.chair_id
     and status = 'WAITING'
     and position > v_serial.position
   order by position
   limit 1;

  if v_next is null then
    raise exception 'nothing_to_bump';
  end if;

  -- CHANGED (Sprint 40b): park first, then swap. Assigning v_next straight
  -- into v_serial's position collided with the row still occupying it.
  select coalesce(max(position), 0) + 1
    into v_park
    from public.serials
   where chair_id = v_serial.chair_id;

  update public.serials set position = v_park            where id = v_serial.id;
  update public.serials set position = v_serial.position where id = v_next.id;
  update public.serials set position = v_next.position   where id = v_serial.id;

  perform public.recalc_queue_estimates(v_serial.chair_id);

  if v_serial.customer_id is not null
     and public.notification_enabled(v_serial.customer_id, 'QUEUE_UPDATE') then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_serial.customer_id,
      'QUEUE_UPDATE',
      'তোমার পালা একধাপ পিছিয়েছে',
      'তোমার পালা এসেছিলো — দোকান তোমাকে একধাপ পিছিয়ে দিয়েছে, একটু পরেই ডাকবে।',
      jsonb_build_object('serial_id', v_serial.id, 'shop_id', v_serial.shop_id)
    );
  end if;
end; $$;

grant execute on function public.bump_serial_back(uuid) to authenticated;
