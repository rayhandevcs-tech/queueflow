-- Sprint 8: reviews + regular-customer reminders
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query),
-- paste, run. Safe to run once; re-running will error on the existing tables (harmless).

-- ---------------------------------------------------------------------------
-- reviews: one customer review per completed serial
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  serial_id uuid not null references public.serials(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (serial_id)
);

create index reviews_shop_id_idx on public.reviews (shop_id);
create index reviews_customer_id_idx on public.reviews (customer_id);

alter table public.reviews enable row level security;

-- A customer may review only their own DONE serial, once (unique constraint above).
create policy "customers insert own review"
  on public.reviews for insert
  to authenticated
  with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.serials s
      where s.id = serial_id
        and s.customer_id = auth.uid()
        and s.status = 'DONE'
    )
  );

create policy "customers read own reviews"
  on public.reviews for select
  to authenticated
  using (customer_id = auth.uid());

-- Shop owners read every review left for their own shop (review summary screen).
create policy "owners read shop reviews"
  on public.reviews for select
  to authenticated
  using (
    exists (
      select 1 from public.shops sh
      where sh.id = shop_id and sh.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- regular_reminders: persists "reminder sent" so the button state survives
-- a refresh (was in-memory-only in the design prototype)
-- ---------------------------------------------------------------------------
create table public.regular_reminders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references auth.users(id) on delete cascade,
  customer_phone text,
  sent_at timestamptz not null default now()
);

create index regular_reminders_shop_id_idx on public.regular_reminders (shop_id);

alter table public.regular_reminders enable row level security;

-- Only the shop owner may read/send reminders for their own shop.
create policy "owners manage own shop reminders"
  on public.regular_reminders for all
  to authenticated
  using (
    exists (
      select 1 from public.shops sh
      where sh.id = shop_id and sh.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shops sh
      where sh.id = shop_id and sh.owner_id = auth.uid()
    )
  );
