-- Sprint 26: ইউজার ম্যানেজমেন্ট + মডারেশন (এডমিন প্যানেল, ফেজ ৩)
-- Run this once in the Supabase dashboard's SQL editor, AFTER 20260824_admin_panel.sql
-- (this file depends on is_platform_admin() and admin_log() from that migration).
--
-- Three capabilities, same design rules as Sprint 24/25: admin reads come from
-- SECURITY DEFINER RPCs rather than opened-up RLS, every privileged write is an
-- RPC that audits itself, and enforcement lives in the database (a trigger), not
-- in the client that happens to call it.
--
--   1) blocking a user      — they keep their account but can't book/review/message
--   2) reporting content    — customers flag a review/shop/message, admins triage
--   3) hiding a review      — moderation without deleting someone's words

-- ---------------------------------------------------------------------------
-- 1) profiles: moderation columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column blocked_at     timestamptz,
  add column blocked_reason text,
  add column blocked_by     uuid references auth.users(id) on delete set null;

create index profiles_blocked_idx on public.profiles (blocked_at)
  where blocked_at is not null;

-- "profiles: update own" lets a user write their own row, so without this a
-- blocked user could simply clear their own block. Same hardening shape as the
-- existing lock_profile_role() trigger.
create or replace function public.lock_profile_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.blocked_at     is distinct from old.blocked_at
   or new.blocked_reason is distinct from old.blocked_reason
   or new.blocked_by     is distinct from old.blocked_by)
   and not public.is_platform_admin() then
    raise exception 'moderation fields are admin-controlled';
  end if;
  return new;
end; $$;

drop trigger if exists profiles_lock_moderation on public.profiles;
create trigger profiles_lock_moderation
  before update on public.profiles
  for each row execute function public.lock_profile_moderation();

create or replace function public.is_user_blocked(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and blocked_at is not null
  );
$$;

grant execute on function public.is_user_blocked(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Enforcement: what "blocked" actually costs
-- ---------------------------------------------------------------------------
-- Triggers rather than edits to the existing RLS policies: the booking /
-- review / chat policies encode real product rules (one active serial, only
-- after a DONE serial, only inside a booked thread) and are not worth
-- re-litigating for this. A blocked user keeps read access — they can still
-- see their history and their dues — they just can't create anything new.
--
-- The error strings below are matched by src/lib/supabase/db-errors.ts, which
-- turns them into a Bangla/English message. Keep them in sync.
create or replace function public.reject_blocked_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Walk-ins are created by the shop owner for someone standing in the shop;
  -- customer_id is null there, so there is nobody to block.
  if new.customer_id is not null and public.is_user_blocked(new.customer_id) then
    raise exception 'account_blocked';
  end if;
  return new;
end; $$;

drop trigger if exists serials_reject_blocked on public.serials;
create trigger serials_reject_blocked
  before insert on public.serials
  for each row execute function public.reject_blocked_customer();

create or replace function public.reject_blocked_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_user_blocked(auth.uid()) then
    raise exception 'account_blocked';
  end if;
  return new;
end; $$;

drop trigger if exists reviews_reject_blocked on public.reviews;
create trigger reviews_reject_blocked
  before insert on public.reviews
  for each row execute function public.reject_blocked_author();

drop trigger if exists messages_reject_blocked on public.messages;
create trigger messages_reject_blocked
  before insert on public.messages
  for each row execute function public.reject_blocked_author();

-- ---------------------------------------------------------------------------
-- 3) reviews: hide instead of delete
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column hidden_at     timestamptz,
  add column hidden_reason text,
  add column hidden_by     uuid references auth.users(id) on delete set null;

-- The public browse path stops showing a hidden review. The author's own
-- "customers read own reviews" policy and the owner's "owners read shop
-- reviews" policy are left alone on purpose: hiding is a public-visibility
-- action, not an erasure, and both of those screens show the hidden state.
drop policy if exists "anyone can browse shop reviews" on public.reviews;
create policy "anyone can browse shop reviews"
  on public.reviews for select
  to authenticated
  using (hidden_at is null);

-- A hidden review must not keep dragging a shop's (or a staff member's) star
-- average down — recreate both aggregates with the same shape plus the filter.
create or replace view public.shop_rating_summary as
select shop_id, avg(rating)::numeric(3, 2) as avg_rating, count(*)::int as review_count
from public.reviews
where hidden_at is null
group by shop_id;

grant select on public.shop_rating_summary to authenticated;

drop view if exists public.chair_rating_summary;
create view public.chair_rating_summary as
select chair_id, avg(rating)::numeric(3, 2) as avg_rating, count(*)::int as review_count
from public.reviews
where chair_id is not null and hidden_at is null
group by chair_id;

grant select on public.chair_rating_summary to authenticated;

-- ---------------------------------------------------------------------------
-- 4) reports — the moderation inbox
-- ---------------------------------------------------------------------------
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references auth.users(id) on delete cascade,
  target_type  text not null check (target_type in ('REVIEW', 'SHOP', 'MESSAGE', 'USER')),
  target_id    uuid not null,
  reason       text not null check (reason in (
                 'SPAM', 'ABUSE', 'FAKE', 'INAPPROPRIATE', 'OTHER')),
  note         text,
  status       text not null default 'OPEN'
               check (status in ('OPEN', 'RESOLVED', 'DISMISSED')),
  resolved_by  uuid references auth.users(id) on delete set null,
  resolved_at  timestamptz,
  resolution_note text,
  created_at   timestamptz not null default now()
);

-- One person can't flood the queue with the same complaint twice.
create unique index reports_one_open_per_reporter_idx
  on public.reports (reporter_id, target_type, target_id)
  where status = 'OPEN';

create index reports_status_created_idx on public.reports (status, created_at desc);
create index reports_target_idx on public.reports (target_type, target_id);

alter table public.reports enable row level security;

-- Anyone signed in can report, as themselves, and can see what they reported
-- (so the UI can say "already reported"). Blocked users cannot report — that
-- is the same "can't create anything new" rule as above.
create policy "reports: insert own"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid() and not public.is_user_blocked(auth.uid()));

create policy "reports: read own"
  on public.reports for select
  to authenticated
  using (reporter_id = auth.uid());

create policy "reports: admin read"
  on public.reports for select
  to authenticated
  using (public.is_platform_admin());

-- Resolving goes through admin_resolve_report() so it always audits.
-- ---------------------------------------------------------------------------
-- 5) admin_list_users
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users(
  p_role     text default null,
  p_blocked  boolean default null,
  p_search   text default null,
  p_limit    integer default 50,
  p_offset   integer default 0
)
returns table (
  id             uuid,
  full_name      text,
  role           text,
  phone          text,
  email          text,
  avatar_url     text,
  created_at     timestamptz,
  blocked_at     timestamptz,
  blocked_reason text,
  shop_id        uuid,
  shop_name      text,
  serials_total  bigint,
  no_shows       bigint,
  spend_total    numeric,
  due_total      numeric,
  reviews_count  bigint,
  reports_against bigint,
  last_serial_at timestamptz,
  total_count    bigint
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
    p.id,
    p.full_name,
    p.role::text,
    p.phone,
    u.email::text,
    p.avatar_url,
    p.created_at,
    p.blocked_at,
    p.blocked_reason,
    sh.id,
    sh.name,
    (select count(*) from serials s where s.customer_id = p.id),
    (select count(*) from serials s where s.customer_id = p.id and s.status = 'NO_SHOW'),
    (select coalesce(sum(s.total_amount), 0) from serials s
      where s.customer_id = p.id and s.status = 'DONE' and s.payment_status = 'PAID'),
    (select coalesce(sum(s.due_amount), 0) from serials s
      where s.customer_id = p.id and s.payment_status = 'DUE'),
    (select count(*) from reviews r where r.customer_id = p.id),
    (select count(*) from reports rp
      where rp.status = 'OPEN'
        and ((rp.target_type = 'USER' and rp.target_id = p.id)
          or (rp.target_type = 'REVIEW'
              and rp.target_id in (select r.id from reviews r where r.customer_id = p.id)))),
    (select max(s.created_at) from serials s where s.customer_id = p.id),
    count(*) over ()
  from profiles p
  left join auth.users u on u.id = p.id
  left join shops sh on sh.owner_id = p.id
  where (p_role is null or p.role::text = p_role)
    and (p_blocked is null
      or (p_blocked and p.blocked_at is not null)
      or (not p_blocked and p.blocked_at is null))
    and (
      p_search is null
      or p_search = ''
      or p.full_name ilike '%' || p_search || '%'
      or coalesce(p.phone, '') ilike '%' || p_search || '%'
      or coalesce(u.email::text, '') ilike '%' || p_search || '%'
    )
  order by
    -- Blocked accounts first: they are the ones an admin came here to look at.
    case when p.blocked_at is not null then 0 else 1 end,
    p.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end; $$;

grant execute on function public.admin_list_users(text, boolean, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) admin_user_detail
-- ---------------------------------------------------------------------------
create or replace function public.admin_user_detail(p_user_id uuid)
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
    'profile', to_jsonb(p.*),
    'email', (select u.email from auth.users u where u.id = p.id),
    'last_sign_in_at', (select u.last_sign_in_at from auth.users u where u.id = p.id),
    'shop', (
      select json_build_object('id', sh.id, 'name', sh.name, 'status', sh.status)
      from shops sh where sh.owner_id = p.id
    ),
    'stats', json_build_object(
      'serials_total', (select count(*) from serials s where s.customer_id = p.id),
      'serials_done',  (select count(*) from serials s where s.customer_id = p.id and s.status = 'DONE'),
      'cancelled',     (select count(*) from serials s where s.customer_id = p.id and s.status = 'CANCELLED'),
      'no_shows',      (select count(*) from serials s where s.customer_id = p.id and s.status = 'NO_SHOW'),
      'spend_total',   (select coalesce(sum(s.total_amount), 0) from serials s
                         where s.customer_id = p.id and s.status = 'DONE' and s.payment_status = 'PAID'),
      'due_total',     (select coalesce(sum(s.due_amount), 0) from serials s
                         where s.customer_id = p.id and s.payment_status = 'DUE'),
      'reviews_count', (select count(*) from reviews r where r.customer_id = p.id),
      'favourites',    (select count(*) from favorites f where f.customer_id = p.id),
      'last_serial_at',(select max(s.created_at) from serials s where s.customer_id = p.id)
    ),
    'recent_serials', (
      select coalesce(json_agg(x), '[]'::json) from (
        select s.id, s.status, s.total_amount, s.payment_status, s.created_at,
               (select name from shops where id = s.shop_id) as shop_name
        from serials s where s.customer_id = p.id
        order by s.created_at desc limit 10
      ) x
    ),
    'reports_against', (
      select coalesce(json_agg(x), '[]'::json) from (
        select rp.id, rp.target_type, rp.reason, rp.note, rp.status, rp.created_at
        from reports rp
        where (rp.target_type = 'USER' and rp.target_id = p.id)
           or (rp.target_type = 'REVIEW'
               and rp.target_id in (select r.id from reviews r where r.customer_id = p.id))
        order by rp.created_at desc limit 10
      ) x
    ),
    'audit', (
      select coalesce(json_agg(x), '[]'::json) from (
        select al.id, al.action, al.meta, al.created_at,
               (select full_name from profiles where id = al.actor_id) as actor_name
        from admin_audit_log al
        where al.target_type = 'user' and al.target_id = p.id
        order by al.created_at desc limit 10
      ) x
    )
  ) into v_result
  from profiles p
  where p.id = p_user_id;

  return v_result;
end; $$;

grant execute on function public.admin_user_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) admin_set_user_blocked
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_blocked(
  p_user_id uuid,
  p_blocked boolean,
  p_reason  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_profile from profiles where id = p_user_id;
  if not found then
    raise exception 'user not found';
  end if;

  -- An admin locking themselves out of the panel helps nobody.
  if p_blocked and p_user_id = auth.uid() then
    raise exception 'cannot block yourself';
  end if;
  if p_blocked and exists (select 1 from admin_users where user_id = p_user_id) then
    raise exception 'cannot block a platform admin';
  end if;

  if (v_profile.blocked_at is not null) = p_blocked then
    return; -- idempotent
  end if;

  update profiles
     set blocked_at     = case when p_blocked then now() else null end,
         blocked_reason = case when p_blocked then p_reason else null end,
         blocked_by     = case when p_blocked then auth.uid() else null end
   where id = p_user_id;

  perform public.admin_log(
    case when p_blocked then 'USER_BLOCKED' else 'USER_UNBLOCKED' end,
    'user', p_user_id, jsonb_build_object('reason', p_reason)
  );

  insert into public.notifications (user_id, type, title, body, data)
  values (
    p_user_id, 'SYSTEM',
    case when p_blocked then 'তোমার অ্যাকাউন্ট সীমিত করা হয়েছে'
         else 'তোমার অ্যাকাউন্ট আবার চালু করা হয়েছে' end,
    case when p_blocked
      then coalesce(nullif(p_reason, ''),
        'নতুন সিরিয়াল, রিভিউ বা মেসেজ আপাতত পাঠানো যাবে না। বিস্তারিত জানতে সাপোর্টে যোগাযোগ করো।')
      else 'তুমি আবার আগের মতো সিরিয়াল নিতে ও মেসেজ পাঠাতে পারবে।' end,
    jsonb_build_object('blocked', p_blocked)
  );
end; $$;

grant execute on function public.admin_set_user_blocked(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) admin_list_reports — the moderation inbox, with its target inlined
-- ---------------------------------------------------------------------------
-- The inbox is unusable if an admin has to click into each row to find out what
-- was reported, so the target's own content (review text/rating, shop name,
-- message body) comes back with the row.
create or replace function public.admin_list_reports(
  p_status text default 'OPEN',
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id            uuid,
  target_type   text,
  target_id     uuid,
  reason        text,
  note          text,
  status        text,
  created_at    timestamptz,
  resolved_at   timestamptz,
  resolution_note text,
  reporter_id   uuid,
  reporter_name text,
  target_title  text,
  target_body   text,
  target_rating integer,
  target_hidden boolean,
  target_owner_id uuid,
  target_owner_name text,
  shop_id       uuid,
  shop_name     text,
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
    rp.id,
    rp.target_type,
    rp.target_id,
    rp.reason,
    rp.note,
    rp.status,
    rp.created_at,
    rp.resolved_at,
    rp.resolution_note,
    rp.reporter_id,
    rep.full_name,
    case rp.target_type
      when 'REVIEW'  then (select coalesce(pr.full_name, '') from reviews r
                            left join profiles pr on pr.id = r.customer_id
                            where r.id = rp.target_id)
      when 'SHOP'    then (select s.name from shops s where s.id = rp.target_id)
      when 'MESSAGE' then (select coalesce(pm.full_name, '') from messages m
                            left join profiles pm on pm.id = m.sender_id
                            where m.id = rp.target_id)
      when 'USER'    then (select pu.full_name from profiles pu where pu.id = rp.target_id)
    end,
    case rp.target_type
      when 'REVIEW'  then (select r.comment from reviews r where r.id = rp.target_id)
      when 'SHOP'    then (select s.address from shops s where s.id = rp.target_id)
      when 'MESSAGE' then (select m.body from messages m where m.id = rp.target_id)
      else null
    end,
    case rp.target_type
      when 'REVIEW' then (select r.rating from reviews r where r.id = rp.target_id)
      else null
    end,
    case rp.target_type
      when 'REVIEW' then (select r.hidden_at is not null from reviews r where r.id = rp.target_id)
      else null
    end,
    case rp.target_type
      when 'REVIEW'  then (select r.customer_id from reviews r where r.id = rp.target_id)
      when 'MESSAGE' then (select m.sender_id from messages m where m.id = rp.target_id)
      when 'USER'    then rp.target_id
      when 'SHOP'    then (select s.owner_id from shops s where s.id = rp.target_id)
    end,
    case rp.target_type
      when 'REVIEW'  then (select pr.full_name from reviews r
                            join profiles pr on pr.id = r.customer_id where r.id = rp.target_id)
      when 'MESSAGE' then (select pm.full_name from messages m
                            join profiles pm on pm.id = m.sender_id where m.id = rp.target_id)
      when 'USER'    then (select pu.full_name from profiles pu where pu.id = rp.target_id)
      when 'SHOP'    then (select po.full_name from shops s
                            join profiles po on po.id = s.owner_id where s.id = rp.target_id)
    end,
    case rp.target_type
      when 'REVIEW'  then (select r.shop_id from reviews r where r.id = rp.target_id)
      when 'MESSAGE' then (select m.shop_id from messages m where m.id = rp.target_id)
      when 'SHOP'    then rp.target_id
      else null
    end,
    case rp.target_type
      when 'REVIEW'  then (select s.name from shops s
                            where s.id = (select r.shop_id from reviews r where r.id = rp.target_id))
      when 'MESSAGE' then (select s.name from shops s
                            where s.id = (select m.shop_id from messages m where m.id = rp.target_id))
      when 'SHOP'    then (select s.name from shops s where s.id = rp.target_id)
      else null
    end,
    count(*) over ()
  from reports rp
  left join profiles rep on rep.id = rp.reporter_id
  where (p_status is null or rp.status = p_status)
  order by
    case when rp.status = 'OPEN' then 0 else 1 end,
    rp.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end; $$;

grant execute on function public.admin_list_reports(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 9) admin_resolve_report / admin_set_review_hidden
-- ---------------------------------------------------------------------------
create or replace function public.admin_resolve_report(
  p_report_id uuid,
  p_status    text,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;
  if p_status not in ('OPEN', 'RESOLVED', 'DISMISSED') then
    raise exception 'invalid report status: %', p_status;
  end if;

  update reports
     set status          = p_status,
         resolution_note = p_note,
         resolved_by     = case when p_status = 'OPEN' then null else auth.uid() end,
         resolved_at     = case when p_status = 'OPEN' then null else now() end
   where id = p_report_id;

  if not found then
    raise exception 'report not found';
  end if;

  perform public.admin_log(
    'REPORT_' || p_status, 'report', p_report_id, jsonb_build_object('note', p_note)
  );
end; $$;

grant execute on function public.admin_resolve_report(uuid, text, text) to authenticated;

create or replace function public.admin_set_review_hidden(
  p_review_id uuid,
  p_hidden    boolean,
  p_reason    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_review reviews%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_review from reviews where id = p_review_id;
  if not found then
    raise exception 'review not found';
  end if;
  if (v_review.hidden_at is not null) = p_hidden then
    return; -- idempotent
  end if;

  update reviews
     set hidden_at     = case when p_hidden then now() else null end,
         hidden_reason = case when p_hidden then p_reason else null end,
         hidden_by     = case when p_hidden then auth.uid() else null end
   where id = p_review_id;

  perform public.admin_log(
    case when p_hidden then 'REVIEW_HIDDEN' else 'REVIEW_UNHIDDEN' end,
    'review', p_review_id, jsonb_build_object('reason', p_reason, 'shop_id', v_review.shop_id)
  );
end; $$;

grant execute on function public.admin_set_review_hidden(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) admin_overview_stats: add the moderation counters
-- ---------------------------------------------------------------------------
-- Same body as 20260824's version plus open_reports / blocked_users, so the
-- dashboard's "needs attention" block covers moderation too.
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
    'open_reports',     (select count(*) from reports where status = 'OPEN'),
    'blocked_users',    (select count(*) from profiles where blocked_at is not null),
    'hidden_reviews',   (select count(*) from reviews where hidden_at is not null),
    'dormant_shops',    (select count(*) from shops s
                          where s.status = 'ACTIVE'
                            and not exists (
                              select 1 from serials sr
                               where sr.shop_id = s.id
                                 and sr.created_at >= now() - interval '14 days')),
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
