-- Sprint 5: favorites (♥ toggle on shop cards + shop detail)
-- Run this once in the Supabase dashboard's SQL editor.

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, shop_id)
);

create index favorites_customer_id_idx on public.favorites (customer_id);

alter table public.favorites enable row level security;

create policy "customers manage own favorites" on public.favorites for all to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());
