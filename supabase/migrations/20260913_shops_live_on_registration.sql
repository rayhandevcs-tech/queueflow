-- Sprint 46: দোকান রেজিস্ট্রেশনেই লাইভ, এডমিনের অনুমোদনের অপেক্ষায় নয়
-- Run this once in the Supabase SQL editor, AFTER 20260912.
--
-- ---------------------------------------------------------------------------
-- কেন বদলানো হচ্ছে
-- ---------------------------------------------------------------------------
-- 20260824-এ shops.status ডিফল্ট 'PENDING' করা হয়েছিল, আর "shops: public read"
-- পলিসি শুধু ACTIVE দোকান দেখায়। অর্থাৎ কেউ দোকান খুললে একজন এডমিন এসে
-- অনুমোদন না দেওয়া পর্যন্ত সেটা কোনো কাস্টমারের চোখে পড়ত না।
--
-- একজন-দুজনের টিমে এটা কাজ করে না। দোকান যখন-তখন রেজিস্ট্রার হতে পারে, আর
-- এডমিন প্যানেল সারাক্ষণ খোলা রাখা হয় না — ফলে নতুন দোকানদার সাইন আপ করে
-- অপেক্ষা করে বসে থাকে, বুঝতেও পারে না কেন কিছু হচ্ছে না। যে দরজা পাহারা
-- দেওয়ার কেউ নেই, সেটা দরজা নয়, শুধু বন্ধ পথ।
--
-- তাই নিয়ন্ত্রণটা **আগে থেকে সরিয়ে পরে** নেওয়া হচ্ছে: দোকান সঙ্গে সঙ্গেই লাইভ,
-- আর এডমিন পরে দেখে সন্দেহজনক কিছু পেলে SUSPEND বা REJECT করে। এডমিনের
-- ক্ষমতা এক বিন্দুও কমছে না — শুধু সেটা আর প্রত্যেক নতুন দোকানের পথ আটকে
-- দাঁড়িয়ে থাকে না।

-- ---------------------------------------------------------------------------
-- ১) ডিফল্ট ACTIVE
-- ---------------------------------------------------------------------------
alter table public.shops alter column status set default 'ACTIVE';

-- ---------------------------------------------------------------------------
-- ২) INSERT-এর সময় যাচাই-ফিল্ডগুলো জোর করে বসানো
-- ---------------------------------------------------------------------------
-- শুধু ডিফল্ট যথেষ্ট নয়। lock_shop_status() কেবল BEFORE UPDATE-এ চলে, তাই
-- INSERT-এ মালিক নিজেই status/is_featured যা খুশি পাঠাতে পারত — আগে সেটা দিয়ে
-- বড়জোর নিজেকে PENDING করা যেত, এখন কেউ নিজেকে "ফিচার্ড" বানিয়ে ফেলতে পারত।
-- তাই নতুন দোকানের এই ফিল্ডগুলো ক্লায়েন্ট যা-ই পাঠাক, এখানেই ঠিক করে দেওয়া হয়।
create or replace function public.set_new_shop_live()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.status        := 'ACTIVE';
  new.verified_at   := now();
  -- verified_by null: কোনো মানুষ যাচাই করেনি, আর করেছে বলে দাবি করাও উচিত নয়।
  -- অডিটে "কে অনুমোদন দিল" প্রশ্নের সৎ উত্তর হলো "কেউ না, স্বয়ংক্রিয়"।
  new.verified_by   := null;
  new.status_reason := null;
  new.is_featured   := false;
  return new;
end;
$$;

drop trigger if exists shops_set_live_on_insert on public.shops;
create trigger shops_set_live_on_insert
  before insert on public.shops
  for each row
  execute function public.set_new_shop_live();

-- ---------------------------------------------------------------------------
-- ৩) যারা অপেক্ষায় আটকে আছে
-- ---------------------------------------------------------------------------
-- এই মুহূর্তে PENDING হয়ে বসে থাকা দোকানগুলো — নতুন নিয়মে এরা কেউই অপেক্ষা
-- করত না। REJECTED বা SUSPENDED ছোঁয়া হয় না: ওগুলো এডমিনের সচেতন সিদ্ধান্ত,
-- আর সেই সিদ্ধান্ত এই মাইগ্রেশন ফিরিয়ে দেবে না।
do $$
declare v_freed integer;
begin
  update public.shops
     set status = 'ACTIVE',
         verified_at = coalesce(verified_at, now())
   where status = 'PENDING';

  get diagnostics v_freed = row_count;
  raise notice 'দোকান লাইভ করা হলো: % টা', v_freed;
end $$;

-- ---------------------------------------------------------------------------
-- ৪) admin_recent_shops — অনুমোদনের সারির বদলে নজরদারির তালিকা
-- ---------------------------------------------------------------------------
-- যাচাই-সারি এখন চিরকাল খালি থাকবে, কিন্তু "সম্প্রতি কারা দোকান খুলল" প্রশ্নটা
-- আগের চেয়ে বেশি জরুরি হয়ে গেল — কারণ এখন কেউ আটকায় না। এই RPC সাম্প্রতিক
-- দোকানগুলো ফেরত দেয়, সাথে প্রস্তুতির অবস্থা, যাতে এডমিন এক নজরে দেখতে পারে
-- কোনটা সত্যিকারের দোকান আর কোনটা ফাঁকা/পরীক্ষামূলক।
--
-- `incomplete` ফিল্ডটাই আসল কাজের জিনিস: চেয়ার নেই বা সার্ভিস নেই মানে দোকানটা
-- আসলে কাউকে সেবা দিতে পারে না — অপব্যবহারের সবচেয়ে সস্তা চিহ্ন।
create or replace function public.admin_recent_shops(
  p_days integer default 30,
  p_limit integer default 100
)
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

  select coalesce(json_agg(row_to_json(r)), '[]'::json) into v_result
  from (
    select
      s.id,
      s.name,
      s.status,
      s.address,
      s.business_type,
      s.logo_url,
      s.created_at,
      (select p.full_name from profiles p where p.id = s.owner_id) as owner_name,
      (select u.email from auth.users u where u.id = s.owner_id)   as owner_email,
      (select count(*) from chairs c    where c.shop_id = s.id and c.is_active)  as chairs,
      (select count(*) from services sv where sv.shop_id = s.id and sv.is_active) as services,
      (select count(*) from serials sr  where sr.shop_id = s.id)                  as serials,
      (
        not exists (select 1 from chairs c where c.shop_id = s.id and c.is_active)
        or not exists (select 1 from services sv where sv.shop_id = s.id and sv.is_active)
        or s.latitude is null
        or s.longitude is null
      ) as incomplete
    from shops s
    where s.created_at >= now() - make_interval(days => greatest(p_days, 1))
    order by s.created_at desc
    limit least(greatest(p_limit, 1), 200)
  ) r;

  return v_result;
end; $$;

grant execute on function public.admin_recent_shops(integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- ৫) admin_audit_feed — কে কী করেছে, এক জায়গায়
-- ---------------------------------------------------------------------------
-- admin_audit_log টেবিলটা শুরু থেকেই লেখা হচ্ছে, কিন্তু পড়ার কোনো পর্দা ছিল না —
-- দেখতে হলে SQL এডিটরে যেতে হতো। স্বয়ংক্রিয় অনুমোদনের পর এটা আরও দরকারি:
-- মানুষের একমাত্র হস্তক্ষেপ এখন সাসপেন্ড/রিজেক্ট, আর কে কেন করল সেটা খুঁজে
-- পাওয়ার জায়গা থাকা চাই।
create or replace function public.admin_audit_feed(
  p_action text default null,
  p_limit  integer default 100,
  p_offset integer default 0
)
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

  select coalesce(json_agg(row_to_json(r)), '[]'::json) into v_result
  from (
    select
      al.id,
      al.action,
      al.target_type,
      al.target_id,
      al.meta,
      al.created_at,
      (select p.full_name from profiles p where p.id = al.actor_id) as actor_name,
      -- 'admin' rows carry a user id too (admin_users.user_id), so they
      -- resolve through profiles like a 'user' row does. review / report /
      -- ticket targets have no name worth showing, and the meta already says
      -- what happened, so they stay null rather than inventing a label.
      case al.target_type
        when 'shop'  then (select sh.name from shops sh where sh.id = al.target_id)
        when 'user'  then (select p2.full_name from profiles p2 where p2.id = al.target_id)
        when 'admin' then (select p3.full_name from profiles p3 where p3.id = al.target_id)
        else null
      end as target_name
    from admin_audit_log al
    where p_action is null or al.action = p_action
    order by al.created_at desc
    limit least(greatest(p_limit, 1), 200)
    offset greatest(p_offset, 0)
  ) r;

  return v_result;
end; $$;

grant execute on function public.admin_audit_feed(text, integer, integer) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- যাচাই
-- ---------------------------------------------------------------------------
-- ১) কোনো দোকান আর অপেক্ষায় নেই (শূন্য আসার কথা):
--    select count(*) from public.shops where status = 'PENDING';
--
-- ২) ডিফল্ট বদলেছে ('ACTIVE'::text আসার কথা):
--    select column_default from information_schema.columns
--     where table_schema = 'public' and table_name = 'shops' and column_name = 'status';
