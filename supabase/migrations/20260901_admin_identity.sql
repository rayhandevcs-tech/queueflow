-- Sprint 36: এডমিন আলাদা পরিচয় — নিজস্ব লগইন, নিজস্ব ইমেইল, দোকান/গ্রাহক নয়
-- Run this once in the Supabase dashboard's SQL editor, AFTER
-- 20260831_retention.sql.
--
-- ---------------------------------------------------------------------------
-- WHAT "SEPARATE AUTHENTICATION" MEANS HERE — AND WHAT IT DELIBERATELY DOESN'T
-- ---------------------------------------------------------------------------
-- The requirement is that an admin is not a customer and not a shop owner:
-- separate login screen, separate email, separate password, no profile, no
-- shop. That is what this migration delivers.
--
-- What it does NOT do is stand up a second credential store next to
-- auth.users. Every RLS policy and every SECURITY DEFINER RPC in this project
-- authorises against auth.uid(). A hand-rolled admin session — own table, own
-- password hashing, own cookie — would be invisible to auth.uid(), so the
-- entire admin panel would have to bypass RLS through the service role. That
-- trades one login page for a second, unaudited authorisation system, which is
-- exactly the failure mode RLS exists to prevent.
--
-- So: Supabase Auth stays the credential store, and the SEPARATION is made
-- real at the identity layer instead —
--
--   * an admin account is provisioned only by a SUPER_ADMIN, through
--     /api/admin/admins, never through public signup
--   * it has NO row in public.profiles, so it is not a customer and cannot
--     own a shop (the panel reads its name and email from admin_users)
--   * it signs in at /admin/login, which refuses any account that is not in
--     admin_users
--   * middleware bounces admins out of the customer and provider apps, and
--     bounces non-admins out of /admin
--
-- ---------------------------------------------------------------------------
-- MIGRATING THE EXISTING SEEDED ADMIN
-- ---------------------------------------------------------------------------
-- Admins seeded by hand before this sprint still have a profiles row and a
-- customer/provider role. They keep working, but they are dual-identity
-- accounts, which is what this sprint moves away from. To convert one, create
-- a fresh admin from Admin Panel → টিম, then drop the old membership:
--
--   delete from public.admin_users where user_id = '<old-uuid>';
--   update auth.users
--      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'is_admin'
--    where id = '<old-uuid>';
--
-- Do that only once the new admin can sign in — there is no other way back in.

-- ---------------------------------------------------------------------------
-- 1) admin_users grows into a real identity row
-- ---------------------------------------------------------------------------
-- Name and email are stored here rather than read from profiles precisely
-- because an admin has no profiles row. They are a denormalised copy of
-- auth.users.email, kept in step by admin_provision_admin() — the only writer.
alter table public.admin_users
  add column if not exists full_name  text,
  add column if not exists email      text,
  add column if not exists status     text not null default 'ACTIVE',
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'admin_users_status_check'
  ) then
    alter table public.admin_users
      add constraint admin_users_status_check
      check (status in ('ACTIVE', 'DISABLED'));
  end if;
end $$;

-- Backfill the identity columns for admins seeded before this migration, so
-- the team page never shows a nameless row.
update public.admin_users a
   set email     = coalesce(a.email, u.email::text),
       full_name = coalesce(
         a.full_name,
         nullif(u.raw_user_meta_data ->> 'full_name', ''),
         split_part(u.email::text, '@', 1)
       )
  from auth.users u
 where u.id = a.user_id
   and (a.email is null or a.full_name is null);

-- ---------------------------------------------------------------------------
-- 2) A disabled admin is not an admin
-- ---------------------------------------------------------------------------
-- This is the single most important line in the file: is_platform_admin() is
-- what every admin RLS policy and every admin RPC calls, so narrowing it here
-- makes "status = DISABLED" an immediate, total revocation across the whole
-- panel — no policy-by-policy audit, nothing left behind.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
     where user_id = auth.uid()
       and status = 'ACTIVE'
  );
$$;

create or replace function public.admin_level()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select level from public.admin_users
   where user_id = auth.uid() and status = 'ACTIVE';
$$;

-- ---------------------------------------------------------------------------
-- 3) A permission model that can grow without touching call sites
-- ---------------------------------------------------------------------------
-- Levels are coarse today (three of them). Rather than scatter
-- `admin_level() = 'SUPER_ADMIN'` through every RPC — which is what makes a
-- fourth role expensive to add later — callers ask for a named CAPABILITY and
-- this one function decides which levels hold it. Adding a role, or moving a
-- capability between roles, is then a single edit here.
create or replace function public.admin_can(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.admin_level()
    when 'SUPER_ADMIN' then true                       -- holds every capability
    when 'MODERATOR'   then p_permission in (
      'shops.review', 'shops.status', 'users.moderate',
      'reports.resolve', 'support.handle'
    )
    when 'SUPPORT'     then p_permission in (
      'support.handle'
    )
    else false
  end;
$$;

grant execute on function public.admin_can(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Provisioning — the only way an admin account comes into existence
-- ---------------------------------------------------------------------------
-- The auth.users row itself is created by /api/admin/admins with Supabase's
-- Admin API (creating a user with a password is not something SQL should be
-- doing by hand). This function finishes the job atomically: it takes the
-- fresh user id, records the membership, and DELETES the profiles row that the
-- baseline signup trigger will have created for it — that deletion is what
-- makes the account "not a customer".
--
-- p_actor is passed in rather than read from auth.uid() because the caller is
-- the service role, which has no session. The route authenticates the human
-- first; this function still re-checks that the actor is a SUPER_ADMIN, so a
-- leaked service key alone cannot mint an admin without also naming a real
-- super admin as its actor.
create or replace function public.admin_provision_admin(
  p_actor     uuid,
  p_user_id   uuid,
  p_full_name text,
  p_email     text,
  p_level     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.admin_users
     where user_id = p_actor and level = 'SUPER_ADMIN' and status = 'ACTIVE'
  ) then
    raise exception 'not authorized';
  end if;

  if p_level not in ('SUPER_ADMIN', 'MODERATOR', 'SUPPORT') then
    raise exception 'unknown admin level';
  end if;

  insert into public.admin_users (user_id, level, full_name, email, status, created_by)
  values (p_user_id, p_level, p_full_name, lower(p_email), 'ACTIVE', p_actor);

  -- Not a customer, not a shop owner: no profile row, so nothing in the
  -- customer or provider app has anything to hang off.
  delete from public.profiles where id = p_user_id;

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, meta)
  values (p_actor, 'ADMIN_CREATE', 'admin', p_user_id,
          jsonb_build_object('level', p_level, 'email', lower(p_email)));
end;
$$;

-- service_role only: this is called from the server route, never from a
-- browser. `authenticated` is deliberately NOT granted.
revoke all on function public.admin_provision_admin(uuid, uuid, text, text, text) from public;
grant execute on function public.admin_provision_admin(uuid, uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5) Roster reads and lifecycle writes
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_admins()
returns table (
  user_id      uuid,
  full_name    text,
  email        text,
  level        text,
  status       text,
  created_at   timestamptz,
  created_by   uuid,
  last_sign_in timestamptz
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
    a.user_id,
    a.full_name,
    coalesce(a.email, u.email::text),
    a.level,
    a.status,
    a.created_at,
    a.created_by,
    u.last_sign_in_at
  from public.admin_users a
  left join auth.users u on u.id = a.user_id
  order by
    case a.level when 'SUPER_ADMIN' then 0 when 'MODERATOR' then 1 else 2 end,
    a.created_at;
end;
$$;

grant execute on function public.admin_list_admins() to authenticated;

-- Status and level changes share one guard: SUPER_ADMIN only, and never on
-- yourself. Self-edit is blocked because both directions are traps — demoting
-- or disabling the last super admin locks everyone out of the panel, and there
-- is no recovery path short of the SQL editor.
create or replace function public.admin_set_admin_status(
  p_user_id uuid,
  p_status  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_can('admins.manage') then
    raise exception 'not authorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot change your own admin status';
  end if;
  if p_status not in ('ACTIVE', 'DISABLED') then
    raise exception 'unknown status';
  end if;

  update public.admin_users
     set status = p_status, updated_at = now()
   where user_id = p_user_id;

  perform public.admin_log(
    'ADMIN_SET_STATUS', 'admin', p_user_id, jsonb_build_object('status', p_status)
  );
end;
$$;

grant execute on function public.admin_set_admin_status(uuid, text) to authenticated;

create or replace function public.admin_set_admin_level(
  p_user_id uuid,
  p_level   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_can('admins.manage') then
    raise exception 'not authorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot change your own role';
  end if;
  if p_level not in ('SUPER_ADMIN', 'MODERATOR', 'SUPPORT') then
    raise exception 'unknown admin level';
  end if;

  update public.admin_users
     set level = p_level, updated_at = now()
   where user_id = p_user_id;

  perform public.admin_log(
    'ADMIN_SET_LEVEL', 'admin', p_user_id, jsonb_build_object('level', p_level)
  );
end;
$$;

grant execute on function public.admin_set_admin_level(uuid, text) to authenticated;

-- Revoking membership leaves the auth.users row alone on purpose: deleting the
-- login here would orphan the audit trail's actor_id. The account simply stops
-- being an admin, and /admin/login stops letting it in.
create or replace function public.admin_revoke_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_can('admins.manage') then
    raise exception 'not authorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot revoke your own access';
  end if;

  delete from public.admin_users where user_id = p_user_id;

  perform public.admin_log('ADMIN_REVOKE', 'admin', p_user_id, '{}'::jsonb);
end;
$$;

grant execute on function public.admin_revoke_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Who am I — the panel's replacement for useMyProfile()
-- ---------------------------------------------------------------------------
-- An admin has no profiles row, so the shell needs somewhere else to read its
-- own name from. Returns nothing for a non-admin, which is also how the
-- /admin/login screen tells "wrong password" apart from "not an admin".
create or replace function public.my_admin_identity()
returns table (
  user_id   uuid,
  full_name text,
  email     text,
  level     text,
  status    text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.user_id, a.full_name, coalesce(a.email, u.email::text), a.level, a.status
    from public.admin_users a
    left join auth.users u on u.id = a.user_id
   where a.user_id = auth.uid()
     and a.status = 'ACTIVE';
$$;

grant execute on function public.my_admin_identity() to authenticated;
