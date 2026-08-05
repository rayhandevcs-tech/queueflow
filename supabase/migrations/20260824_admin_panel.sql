-- Sprint 24 + 25: প্ল্যাটফর্ম এডমিন প্যানেল — ফাউন্ডেশন + দোকান ভেরিফিকেশন লাইফসাইকেল
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query).
--
-- ---------------------------------------------------------------------------
-- WHY A SEPARATE admin_users TABLE INSTEAD OF A THIRD user_role ENUM VALUE
-- ---------------------------------------------------------------------------
-- Every RLS policy in this project is written around two roles (customer /
-- provider) and the is_shop_owner() helper. Adding 'admin' to the user_role
-- enum would mean re-auditing ~40 policies plus all the role-branching in the
-- app, and one missed policy leaks the whole platform's data. Instead:
--
--   * membership lives in its own table (admin_users)
--   * is_platform_admin() is the exact twin of the existing is_shop_owner()
--   * read access is granted policy-by-policy, only where the panel needs it
--   * every privileged WRITE goes through a SECURITY DEFINER RPC that checks
--     is_platform_admin() itself and writes an audit row in the same
--     transaction — the client never UPDATEs an admin-controlled column
--
-- Nothing that exists today changes behaviour, except that shops now have a
-- verification lifecycle (see part 4).
--
-- ---------------------------------------------------------------------------
-- SEEDING THE FIRST ADMIN (do this by hand, after running this file)
-- ---------------------------------------------------------------------------
-- Two things must be set for a user to be a working admin. Both are
-- server-side only — there is deliberately no UI that can grant admin.
--
--   -- 1) DB membership (this is the real guard — RLS + RPCs read this)
--   insert into public.admin_users (user_id, level)
--   select id, 'SUPER_ADMIN' from auth.users where email = 'you@example.com';
--
--   -- 2) JWT claim, so middleware can route /admin without a DB round-trip
--   update auth.users
--      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--                              || '{"is_admin": true}'::jsonb
--    where email = 'you@example.com';
--
-- NOTE: the claim lands in app_metadata, NEVER user_metadata — user_metadata
-- is writable by the user themselves via supabase.auth.updateUser(), so an
-- admin flag there would be self-serve privilege escalation. app_metadata can
-- only be written with the service role / SQL editor.
--
-- NOTE: the claim only reaches the browser on the next token refresh, so the
-- seeded user must sign out and back in once before /admin opens for them.

-- ---------------------------------------------------------------------------
-- 1) admin_users + helpers
-- ---------------------------------------------------------------------------
create table public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  level      text not null default 'MODERATOR'
             check (level in ('SUPER_ADMIN', 'MODERATOR', 'SUPPORT')),
  note       text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Same shape as public.is_shop_owner(): stable + security definer so it can be
-- called from inside RLS policies without recursing into admin_users' own RLS.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.admin_level()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select level from public.admin_users where user_id = auth.uid();
$$;

grant execute on function public.admin_level() to authenticated;

-- Admins can see the admin roster (Sprint 28 turns this into a team page).
-- No INSERT/UPDATE/DELETE policy at all: granting admin is a SQL-editor
-- operation until the team page ships with its SUPER_ADMIN-gated RPC.
create policy "admin_users: admin read"
  on public.admin_users for select
  to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 2) admin_audit_log — every privileged write lands here, same transaction
-- ---------------------------------------------------------------------------
create table public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   uuid,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);
create index admin_audit_log_target_idx
  on public.admin_audit_log (target_type, target_id, created_at desc);

alter table public.admin_audit_log enable row level security;

create policy "admin_audit_log: admin read"
  on public.admin_audit_log for select
  to authenticated
  using (public.is_platform_admin());

-- Deliberately no INSERT policy — rows are only ever written by the SECURITY
-- DEFINER RPCs below, so the log cannot be forged or back-dated by a client.
create or replace function public.admin_log(
  p_action      text,
  p_target_type text,
  p_target_id   uuid,
  p_meta        jsonb default '{}'
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_meta, '{}'::jsonb));
$$;

-- Internal helper: callable from the definer RPCs below, never from a client.
revoke execute on function public.admin_log(text, text, uuid, jsonb) from public;

-- ---------------------------------------------------------------------------
-- 3) notifications: a SYSTEM type for platform → user messages
-- ---------------------------------------------------------------------------
-- Shop approved / rejected / suspended is a platform message, not a queue
-- event. It reuses the whole existing notification pipeline (Notification
-- Center, realtime, web push) but must not be silenced by the REMINDER or
-- PROMO preference — like SERIAL_CONFIRMED it stays always-on, so it is not
-- listed in the notification-settings toggles.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'SERIAL_CONFIRMED', 'QUEUE_UPDATE', 'YOUR_TURN',
    'CANCELLED', 'PROMO', 'REMINDER', 'SYSTEM'
  ));

-- ---------------------------------------------------------------------------
-- 4) shops: verification lifecycle
-- ---------------------------------------------------------------------------
-- Until now "shops: public read" was USING (true) — anyone who signed up as a
-- provider and saved a shop was instantly live in Explore, with no way to keep
-- a fake/incomplete/test shop out. Now a shop is only publicly readable once an
-- admin moves it to ACTIVE; its own owner keeps full visibility throughout, so
-- the provider setup flow is unchanged.
alter table public.shops
  add column status text not null default 'PENDING'
      check (status in ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED')),
  add column verified_at   timestamptz,
  add column verified_by   uuid references auth.users(id) on delete set null,
  add column status_reason text,
  add column is_featured   boolean not null default false;

-- Backfill: everything that exists right now is already live to customers.
-- Flipping it to PENDING would black out the running system, so grandfather
-- every existing shop in as ACTIVE (verified_at = when it was created).
update public.shops
   set status = 'ACTIVE',
       verified_at = coalesce(verified_at, created_at);

create index shops_status_created_idx on public.shops (status, created_at desc);

drop policy if exists "shops: public read" on public.shops;
create policy "shops: public read" on public.shops for select
  using (
    status = 'ACTIVE'
    or auth.uid() = owner_id
    or public.is_platform_admin()
  );

-- The existing "shops: owner update" policy lets an owner write any column, so
-- without this the owner could simply set their own status = 'ACTIVE'. Same
-- hardening idea as lock_profile_role() in the baseline migration.
create or replace function public.lock_shop_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status       is distinct from old.status
   or new.verified_at  is distinct from old.verified_at
   or new.verified_by  is distinct from old.verified_by
   or new.status_reason is distinct from old.status_reason
   or new.is_featured  is distinct from old.is_featured)
   and not public.is_platform_admin() then
    raise exception 'shop verification fields are admin-controlled';
  end if;
  return new;
end; $$;

drop trigger if exists shops_lock_status on public.shops;
create trigger shops_lock_status
  before update on public.shops
  for each row execute function public.lock_shop_status();

-- ---------------------------------------------------------------------------
-- 5) admin read access (only what the panel actually renders)
-- ---------------------------------------------------------------------------
-- shops is already covered by the policy above. Aggregates over serials /
-- reviews are served by the SECURITY DEFINER RPCs below rather than by opening
-- those tables up wholesale — the smaller the admin read surface, the better.
create policy "profiles: admin read"
  on public.profiles for select
  to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 6) admin_overview_stats — the dashboard's single round-trip
-- ---------------------------------------------------------------------------
-- "Today" is Asia/Dhaka, not UTC: at 01:00 Dhaka time a UTC-based day counter
-- would still be showing yesterday's serials to a Bangladeshi operator.
create or replace function public.admin_overview_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Dhaka')
                             at time zone 'Asia/Dhaka';
  v_result json;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  select json_build_object(
    'shops_total',      (select count(*) from shops),
    'shops_pending',    (select count(*) from shops where status = 'PENDING'),
    'shops_active',     (select count(*) from shops where status = 'ACTIVE'),
    'shops_suspended',  (select count(*) from shops where status = 'SUSPENDED'),
    'shops_rejected',   (select count(*) from shops where status = 'REJECTED'),
    'shops_salon',      (select count(*) from shops where status = 'ACTIVE' and business_type = 'SALON'),
    'shops_parlour',    (select count(*) from shops where status = 'ACTIVE' and business_type = 'PARLOUR'),
    'shops_open_now',   (select count(*) from shops where status = 'ACTIVE' and is_open),
    'customers_total',  (select count(*) from profiles where role = 'customer'),
    'providers_total',  (select count(*) from profiles where role = 'provider'),
    'signups_7d',       (select count(*) from profiles where created_at >= now() - interval '7 days'),
    'serials_today',    (select count(*) from serials where created_at >= v_day_start),
    'serials_live',     (select count(*) from serials where status in ('WAITING', 'IN_PROGRESS')),
    'serials_30d',      (select count(*) from serials where created_at >= now() - interval '30 days'),
    'gmv_30d',          (select coalesce(sum(total_amount), 0) from serials
                          where status = 'DONE'
                            and payment_status = 'PAID'
                            and completed_at >= now() - interval '30 days'),
    'reviews_total',    (select count(*) from reviews),
    -- Shops that were ACTIVE but have taken no serial in 14 days: the churn /
    -- "call this owner" list the growth side of the panel is built around.
    'dormant_shops',    (select count(*) from shops s
                          where s.status = 'ACTIVE'
                            and not exists (
                              select 1 from serials sr
                               where sr.shop_id = s.id
                                 and sr.created_at >= now() - interval '14 days')),
    -- 14-day trend for the dashboard chart (oldest → newest, gap-free).
    'daily', (
      select coalesce(json_agg(t order by t.day), '[]'::json)
      from (
        select
          d::date::text as day,
          (select count(*) from serials sr
            where sr.created_at >= d and sr.created_at < d + interval '1 day') as serials,
          (select count(*) from profiles p
            where p.created_at >= d and p.created_at < d + interval '1 day') as signups
        from generate_series(v_day_start - interval '13 days', v_day_start, interval '1 day') as d
      ) t
    )
  ) into v_result;

  return v_result;
end; $$;

grant execute on function public.admin_overview_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- 7) admin_list_shops — one query for the shops table + verification queue
-- ---------------------------------------------------------------------------
-- Returns the per-shop aggregates the list renders (owner, size, 30-day
-- activity, rating) so the client doesn't need read access to serials,
-- reviews or every profile. total_count is the pre-pagination count, carried
-- on each row via a window function.
create or replace function public.admin_list_shops(
  p_status        text default null,
  p_business_type text default null,
  p_search        text default null,
  p_limit         integer default 50,
  p_offset        integer default 0
)
returns table (
  id            uuid,
  name          text,
  business_type text,
  address       text,
  status        text,
  is_open       boolean,
  is_featured   boolean,
  logo_url      text,
  phone         text,
  created_at    timestamptz,
  verified_at   timestamptz,
  status_reason text,
  owner_id      uuid,
  owner_name    text,
  owner_phone   text,
  chair_count   bigint,
  service_count bigint,
  serials_30d   bigint,
  revenue_30d   numeric,
  avg_rating    numeric,
  review_count  bigint,
  last_serial_at timestamptz,
  total_count   bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    s.id,
    s.name,
    s.business_type::text,
    s.address,
    s.status,
    s.is_open,
    s.is_featured,
    s.logo_url,
    s.phone,
    s.created_at,
    s.verified_at,
    s.status_reason,
    s.owner_id,
    p.full_name,
    p.phone,
    (select count(*) from chairs c where c.shop_id = s.id),
    (select count(*) from services sv where sv.shop_id = s.id),
    (select count(*) from serials sr
      where sr.shop_id = s.id and sr.created_at >= now() - interval '30 days'),
    (select coalesce(sum(sr.total_amount), 0) from serials sr
      where sr.shop_id = s.id
        and sr.status = 'DONE'
        and sr.payment_status = 'PAID'
        and sr.completed_at >= now() - interval '30 days'),
    coalesce(rs.avg_rating, 0),
    coalesce(rs.review_count, 0)::bigint,
    (select max(sr.created_at) from serials sr where sr.shop_id = s.id),
    count(*) over ()
  from shops s
  left join profiles p on p.id = s.owner_id
  left join shop_rating_summary rs on rs.shop_id = s.id
  where (p_status is null or s.status = p_status)
    and (p_business_type is null or s.business_type::text = p_business_type)
    and (
      p_search is null
      or p_search = ''
      or s.name ilike '%' || p_search || '%'
      or s.address ilike '%' || p_search || '%'
      or coalesce(p.full_name, '') ilike '%' || p_search || '%'
      or coalesce(p.phone, '') ilike '%' || p_search || '%'
    )
  order by
    -- Verification queue first: oldest PENDING shop is the most overdue.
    case when s.status = 'PENDING' then 0 else 1 end,
    case when s.status = 'PENDING' then s.created_at end asc,
    s.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end; $$;

grant execute on function public.admin_list_shops(text, text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) admin_shop_detail — everything the shop detail page shows
-- ---------------------------------------------------------------------------
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
      'avg_rating',    (select coalesce(avg_rating, 0) from shop_rating_summary where shop_id = s.id),
      'review_count',  (select coalesce(review_count, 0) from shop_rating_summary where shop_id = s.id),
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

-- ---------------------------------------------------------------------------
-- 9) admin_set_shop_status — approve / reject / suspend / restore
-- ---------------------------------------------------------------------------
-- Status change + audit row + owner notification in one transaction, so the
-- three can never drift apart.
create or replace function public.admin_set_shop_status(
  p_shop_id uuid,
  p_status  text,
  p_reason  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop   shops%rowtype;
  v_title  text;
  v_body   text;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  if p_status not in ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED') then
    raise exception 'invalid shop status: %', p_status;
  end if;

  select * into v_shop from shops where id = p_shop_id;
  if not found then
    raise exception 'shop not found';
  end if;

  if v_shop.status = p_status then
    return; -- idempotent: no audit noise, no duplicate notification
  end if;

  update shops
     set status        = p_status,
         status_reason = p_reason,
         verified_at   = case when p_status = 'ACTIVE' then coalesce(verified_at, now())
                              else verified_at end,
         verified_by   = case when p_status = 'ACTIVE' then auth.uid() else verified_by end,
         -- A shop that is no longer public must not keep taking serials.
         is_open       = case when p_status = 'ACTIVE' then is_open else false end,
         is_featured   = case when p_status = 'ACTIVE' then is_featured else false end
   where id = p_shop_id;

  perform public.admin_log(
    'SHOP_STATUS', 'shop', p_shop_id,
    jsonb_build_object('from', v_shop.status, 'to', p_status, 'reason', p_reason)
  );

  if p_status = 'ACTIVE' then
    v_title := 'তোমার দোকান অনুমোদিত হয়েছে ✅';
    v_body  := v_shop.name || ' এখন কাস্টমারদের তালিকায় দেখা যাচ্ছে — দোকান খুলে সিরিয়াল নেওয়া শুরু করো।';
  elsif p_status = 'REJECTED' then
    v_title := 'দোকানের আবেদন গ্রহণ করা যায়নি';
    v_body  := coalesce(nullif(p_reason, ''), 'তথ্য যাচাই করে আবার জমা দাও।');
  elsif p_status = 'SUSPENDED' then
    v_title := 'তোমার দোকান সাময়িকভাবে বন্ধ রাখা হয়েছে';
    v_body  := coalesce(nullif(p_reason, ''), 'বিস্তারিত জানতে সাপোর্টে যোগাযোগ করো।');
  else
    v_title := 'তোমার দোকান আবার যাচাইয়ের অপেক্ষায়';
    v_body  := coalesce(nullif(p_reason, ''), 'যাচাই শেষ হলে জানানো হবে।');
  end if;

  -- SYSTEM notifications are always delivered (not gated on notification_enabled):
  -- the owner cannot be allowed to mute the message that explains why their
  -- shop disappeared from Explore.
  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_shop.owner_id, 'SYSTEM', v_title, v_body,
    jsonb_build_object('shop_id', p_shop_id, 'status', p_status)
  );
end; $$;

grant execute on function public.admin_set_shop_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) admin_set_shop_featured — promote a shop on the customer home
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_shop_featured(
  p_shop_id  uuid,
  p_featured boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  select status into v_status from shops where id = p_shop_id;
  if not found then
    raise exception 'shop not found';
  end if;
  if p_featured and v_status <> 'ACTIVE' then
    raise exception 'only an active shop can be featured';
  end if;

  update shops set is_featured = p_featured where id = p_shop_id;

  perform public.admin_log(
    'SHOP_FEATURED', 'shop', p_shop_id, jsonb_build_object('featured', p_featured)
  );
end; $$;

grant execute on function public.admin_set_shop_featured(uuid, boolean) to authenticated;
