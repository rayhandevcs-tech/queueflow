-- Sprint 17: ম্যানুয়াল কাজের এন্ট্রি — সিরিয়াল ছাড়া (walk-in বুকিং ছাড়াই) করা কাজের হিসাব।
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query).

create table public.manual_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  chair_id uuid references public.chairs(id) on delete set null,
  amount numeric not null check (amount >= 0),
  payment_method text check (payment_method in ('cash', 'bkash', 'nagad', 'rocket', 'card')),
  payment_status text not null default 'PAID' check (payment_status in ('PAID', 'DUE')),
  note text,
  created_at timestamptz not null default now()
);

-- Income page's hot path: shop's entries, newest first, trailing-12-month window.
create index manual_entries_shop_created_idx on public.manual_entries (shop_id, created_at desc);

alter table public.manual_entries enable row level security;

-- Owner-only, all the way through — same is_shop_owner() helper every other
-- owner-check policy in this project uses (see 20260817's comment for why
-- a raw inline EXISTS subquery is worth avoiding).
create policy "manual_entries: owner select"
  on public.manual_entries for select
  to authenticated
  using (public.is_shop_owner(shop_id));

create policy "manual_entries: owner insert"
  on public.manual_entries for insert
  to authenticated
  with check (public.is_shop_owner(shop_id));

create policy "manual_entries: owner update"
  on public.manual_entries for update
  to authenticated
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

create policy "manual_entries: owner delete"
  on public.manual_entries for delete
  to authenticated
  using (public.is_shop_owner(shop_id));
