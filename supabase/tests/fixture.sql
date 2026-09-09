-- A minimal stand-in for the parts of the real schema 20260918 touches.
create extension if not exists pgcrypto;

create schema if not exists auth;
-- Supabase's auth.uid() reads the JWT; locally it reads a session setting so
-- the RLS policies can be exercised as different people.
create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid
  $$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  phone text,
  avatar_url text
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null,
  business_type text not null default 'SALON',
  status text not null default 'ACTIVE',
  is_open boolean not null default true,
  weekly_hours jsonb
);

create table public.chairs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  label text not null,
  staff_name text not null default '',
  is_active boolean not null default true,
  sort_order int not null default 0,
  staff_avatar_url text
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  rate numeric(10,2) not null default 0,
  default_duration_min int not null default 30,
  is_active boolean not null default true,
  category text,
  created_at timestamptz not null default now()
);

create table public.chair_service_stats (
  chair_id uuid not null references public.chairs(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  can_perform boolean not null default true,
  primary key (chair_id, service_id)
);

create or replace function public.is_shop_owner(p_shop_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from public.shops where id = p_shop_id and owner_id = auth.uid()) $$;

-- ---------------------------------------------------------------------------
-- Notification infrastructure the appointment reminder writes into.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- The real one reads profiles.notification_prefs (opt-out model).
create or replace function public.notification_enabled(p_user_id uuid, p_type text)
  returns boolean language sql stable as $$ select true $$;
