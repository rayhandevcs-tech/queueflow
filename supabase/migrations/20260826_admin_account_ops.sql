-- Sprint 27: অ্যাকাউন্ট অপারেশন — এডমিন থেকে অ্যাকাউন্ট ঠিক করা ও মুছে ফেলা
-- Run this once in the Supabase dashboard's SQL editor, AFTER
-- 20260824_admin_panel.sql and 20260825_admin_users_moderation.sql.
--
-- Two capabilities:
--
--   1) REPAIR — an admin can correct a user's own data (name, phone, gender,
--      date of birth, address) and can force-cancel a stuck serial. The
--      auth-level fixes that must not be hand-written into the auth schema
--      (confirm email, change email, send a password-reset mail) go through
--      /api/admin/account instead, using Supabase's Admin API.
--
--   2) DELETE — a full, permanent account deletion that frees the email so
--      the same person can register again from scratch.
--
-- WHY DELETION IS SPELLED OUT ROW BY ROW BELOW
-- The baseline schema (profiles/shops/serials) predates this repo's migration
-- history, so the exact ON DELETE behaviour of serials.customer_id and
-- shops.owner_id isn't knowable from these files. Rather than trust a cascade
-- we can't see, admin_delete_user() tears everything down explicitly and in a
-- deliberate order. That also lets us make one product decision the FK could
-- never make for us: a deleted customer's serials are ANONYMISED, not deleted,
-- so the shop's income history and daily counts stay intact.

-- ---------------------------------------------------------------------------
-- 1) serial_before_update: one narrow exception to customer_id immutability
-- ---------------------------------------------------------------------------
-- Verbatim copy of the baseline function (20260730_capture_baseline_queue_engine.sql)
-- with a single change, marked below. Without it, anonymising a serial is
-- impossible: the trigger force-restores customer_id on every UPDATE, so the
-- account deletion would either fail on the foreign key or silently keep
-- pointing at a user row that no longer exists.
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

    if new.status = 'IN_PROGRESS' then
      new.started_at := coalesce(new.started_at, now());
    elsif new.status = 'DONE' then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  end if;

  new.shop_id           := old.shop_id;
  -- CHANGED (Sprint 27): customer_id stays immutable for everyone except a
  -- platform admin clearing it — that is the account-deletion anonymisation
  -- path, and it can only ever set it to NULL, never re-point it at someone
  -- else. Every other update still snaps back to the booking-time value.
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

  return new;
end; $function$;

-- ---------------------------------------------------------------------------
-- 2) admin_update_user_profile — the everyday "fix my details" repair
-- ---------------------------------------------------------------------------
-- NULL means "leave this field alone"; clearing a field is done by passing an
-- empty string, which lands as NULL in the nullable columns.
create or replace function public.admin_update_user_profile(
  p_user_id       uuid,
  p_full_name     text default null,
  p_phone         text default null,
  p_gender        text default null,
  p_date_of_birth date default null,
  p_address       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_before profiles%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_before from profiles where id = p_user_id;
  if not found then
    raise exception 'user not found';
  end if;

  update profiles
     set full_name     = coalesce(nullif(trim(p_full_name), ''), full_name),
         phone         = case when p_phone is null then phone
                              else nullif(trim(p_phone), '') end,
         gender        = case when p_gender is null then gender
                              else nullif(trim(p_gender), '') end,
         date_of_birth = coalesce(p_date_of_birth, date_of_birth),
         address       = case when p_address is null then address
                              else nullif(trim(p_address), '') end
   where id = p_user_id;

  perform public.admin_log(
    'USER_PROFILE_EDITED', 'user', p_user_id,
    jsonb_build_object(
      'before', jsonb_build_object(
        'full_name', v_before.full_name, 'phone', v_before.phone,
        'gender', v_before.gender, 'date_of_birth', v_before.date_of_birth,
        'address', v_before.address),
      'after', (select jsonb_build_object(
        'full_name', p.full_name, 'phone', p.phone,
        'gender', p.gender, 'date_of_birth', p.date_of_birth,
        'address', p.address) from profiles p where p.id = p_user_id)
    )
  );
end; $$;

grant execute on function public.admin_update_user_profile(uuid, text, text, text, date, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3) admin_force_cancel_serial — the single most common "my account is stuck"
-- ---------------------------------------------------------------------------
-- one_active_serial_per_customer means a serial left hanging in WAITING or
-- IN_PROGRESS (shop closed without finishing it, customer walked away, a
-- half-broken row) blocks that customer from ever booking again. Support can
-- now clear it without touching SQL.
create or replace function public.admin_force_cancel_serial(
  p_serial_id uuid,
  p_reason    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_serial serials%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_serial from serials where id = p_serial_id;
  if not found then
    raise exception 'serial not found';
  end if;
  if v_serial.status not in ('WAITING', 'IN_PROGRESS') then
    raise exception 'only an active serial can be force-cancelled';
  end if;

  -- WAITING -> CANCELLED and IN_PROGRESS -> CANCELLED are both legal moves in
  -- the existing state machine, so this goes through the normal trigger path:
  -- queue positions compact, queue_public syncs, ETAs recalculate, exactly as
  -- they would if the shop had cancelled it.
  update serials set status = 'CANCELLED' where id = p_serial_id;

  perform public.admin_log(
    'SERIAL_FORCE_CANCELLED', 'user', v_serial.customer_id,
    jsonb_build_object('serial_id', p_serial_id, 'shop_id', v_serial.shop_id,
                       'reason', p_reason)
  );

  if v_serial.customer_id is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_serial.customer_id, 'SYSTEM', 'তোমার আটকে থাকা সিরিয়ালটি বাতিল করা হয়েছে',
      coalesce(nullif(p_reason, ''),
        'সাপোর্ট টিম সিরিয়ালটি বাতিল করেছে — এখন তুমি আবার নতুন সিরিয়াল নিতে পারবে।'),
      jsonb_build_object('serial_id', p_serial_id)
    );
  end if;
end; $$;

grant execute on function public.admin_force_cancel_serial(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) admin_delete_user — permanent, and re-registration-safe
-- ---------------------------------------------------------------------------
-- After this runs, the same email address (and phone number) can sign up
-- again as a brand-new account: the auth.users row is gone, so nothing is
-- holding the address, and profiles.phone went with the profile row.
--
-- What survives on purpose:
--   * the shop's serial history, with customer_id nulled and the
--     customer_name/customer_phone snapshot left in place — a shop's income,
--     analytics and daily counts must not change because a customer left
--
-- What is destroyed (unavoidable, and stated in the UI before confirming):
--   * for a PROVIDER: their whole shop — chairs, services, offers, gallery,
--     every serial ever taken there and every review of it. Other customers
--     lose their booking history at that shop too.
--   * for anyone: their reviews, favourites, chat messages, notifications
create or replace function public.admin_delete_user(
  p_user_id uuid,
  p_reason  text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_shop    shops%rowtype;
  v_email   text;
  v_serials_anonymised integer := 0;
  v_shop_serials integer := 0;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'cannot delete yourself';
  end if;
  if exists (select 1 from admin_users where user_id = p_user_id) then
    raise exception 'cannot delete a platform admin';
  end if;

  select * into v_profile from profiles where id = p_user_id;
  if not found then
    raise exception 'user not found';
  end if;

  select email into v_email from auth.users where id = p_user_id;

  -- (a) Their shop, if any — teardown in dependency order.
  select * into v_shop from shops where owner_id = p_user_id;
  if found then
    select count(*) into v_shop_serials from serials where shop_id = v_shop.id;

    delete from reviews             where shop_id = v_shop.id;
    delete from serials             where shop_id = v_shop.id;
    delete from manual_entries      where shop_id = v_shop.id;
    delete from offers              where shop_id = v_shop.id;
    delete from shop_gallery_images where shop_id = v_shop.id;
    delete from favorites           where shop_id = v_shop.id;
    delete from messages            where shop_id = v_shop.id;
    delete from regular_reminders   where shop_id = v_shop.id;
    delete from chair_service_stats
      where chair_id in (select id from chairs where shop_id = v_shop.id);
    delete from chairs              where shop_id = v_shop.id;
    delete from services            where shop_id = v_shop.id;
    delete from queue_public        where shop_id = v_shop.id;
    delete from shops               where id = v_shop.id;
  end if;

  -- (b) Anonymise the serials they booked as a customer elsewhere. Active ones
  -- are cancelled first so no shop is left with a ghost in its live queue.
  update serials set status = 'CANCELLED'
   where customer_id = p_user_id and status in ('WAITING', 'IN_PROGRESS');

  update serials set customer_id = null where customer_id = p_user_id;
  get diagnostics v_serials_anonymised = row_count;

  -- (c) Everything that is genuinely theirs. Most of these have an ON DELETE
  -- CASCADE to auth.users already; doing it explicitly keeps the outcome the
  -- same whether or not that cascade exists.
  delete from reviews            where customer_id = p_user_id;
  delete from favorites          where customer_id = p_user_id;
  delete from messages           where customer_id = p_user_id or sender_id = p_user_id;
  delete from notifications      where user_id = p_user_id;
  delete from push_subscriptions where user_id = p_user_id;
  delete from regular_reminders  where customer_id = p_user_id;
  delete from reports            where reporter_id = p_user_id;

  -- (d) Audit BEFORE the delete: admin_audit_log.actor_id survives, and
  -- target_id has no FK, so the row outlives the user it describes.
  perform public.admin_log(
    'USER_DELETED', 'user', p_user_id,
    jsonb_build_object(
      'email', v_email,
      'full_name', v_profile.full_name,
      'phone', v_profile.phone,
      'role', v_profile.role,
      'shop_name', v_shop.name,
      'shop_serials_deleted', v_shop_serials,
      'serials_anonymised', v_serials_anonymised,
      'reason', p_reason
    )
  );

  -- (e) The account itself. profiles goes with it (FK cascade from the
  -- baseline schema, same path self-serve deletion already relies on), and
  -- the email address is free again from this moment.
  delete from auth.users where id = p_user_id;

  return json_build_object(
    'email', v_email,
    'shop_deleted', v_shop.id is not null,
    'shop_serials_deleted', v_shop_serials,
    'serials_anonymised', v_serials_anonymised
  );
end; $$;

grant execute on function public.admin_delete_user(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) admin_user_detail: carry the active serials so the UI can offer the fix
-- ---------------------------------------------------------------------------
-- Same body as 20260825's version plus 'active_serials' and the email
-- confirmation state (the repair panel needs both).
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
    'email_confirmed', (select u.email_confirmed_at is not null
                          from auth.users u where u.id = p.id),
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
    'active_serials', (
      select coalesce(json_agg(x), '[]'::json) from (
        select s.id, s.status, s.position, s.created_at,
               (select name from shops where id = s.shop_id) as shop_name
        from serials s
        where s.customer_id = p.id and s.status in ('WAITING', 'IN_PROGRESS')
        order by s.created_at desc
      ) x
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
