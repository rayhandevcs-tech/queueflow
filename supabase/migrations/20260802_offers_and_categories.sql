-- Sprint 6: অফার + সার্ভিস ক্যাটাগরি + ক্রস-শপ রেটিং সামারি
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query),
-- paste, run. Safe to run once; re-running will error on existing objects (harmless).

-- ---------------------------------------------------------------------------
-- offers: শপ-প্রতি ডিসকাউন্ট অফার, দোকানদার তৈরি/বন্ধ করে
-- ---------------------------------------------------------------------------
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null,
  description text,
  discount_pct smallint not null check (discount_pct between 1 and 90),
  valid_until timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index offers_shop_id_idx on public.offers (shop_id);

alter table public.offers enable row level security;

create policy "owners manage own shop offers"
  on public.offers for all
  to authenticated
  using (
    exists (select 1 from public.shops sh where sh.id = shop_id and sh.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.shops sh where sh.id = shop_id and sh.owner_id = auth.uid())
  );

-- Customers browse active, unexpired offers at open shops (banner carousel).
create policy "anyone can browse active offers"
  on public.offers for select
  to authenticated
  using (
    active = true
    and valid_until >= now()
    and exists (select 1 from public.shops sh where sh.id = shop_id and sh.is_open = true)
  );

-- ---------------------------------------------------------------------------
-- services: optional category, powers the explore-page category shortcut row
-- ---------------------------------------------------------------------------
alter table public.services
  add column category text
  check (category in ('HAIRCUT', 'SHAVE', 'COLOR', 'FACIAL', 'SPA', 'BRIDAL', 'OTHER'));

-- ---------------------------------------------------------------------------
-- shop_rating_summary: cross-shop avg rating + count, for the "top-rated"
-- sort. `reviews` already has "anyone can browse shop reviews" (using true,
-- from the Sprint 4 migration) so this view carries the same visibility —
-- no ownership check needed here.
-- ---------------------------------------------------------------------------
create or replace view public.shop_rating_summary as
select shop_id, avg(rating)::numeric(3, 2) as avg_rating, count(*)::int as review_count
from public.reviews
group by shop_id;

grant select on public.shop_rating_summary to authenticated;
