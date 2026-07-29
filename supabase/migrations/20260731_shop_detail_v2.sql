-- Sprint 4: শপ ডিটেইল ২.০ (tabs, gallery, about/hours, public reviews/staff browsing)
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query),
-- paste, run. Safe to run once; re-running will error on existing objects (harmless).

-- ---------------------------------------------------------------------------
-- shops: About text + structured weekly working hours
-- ---------------------------------------------------------------------------
alter table public.shops
  add column about text,
  add column weekly_hours jsonb;

-- weekly_hours shape (client-enforced, not DB-checked):
-- { "mon": {"open":"10:00","close":"20:00","closed":false}, "tue": {...}, ..., "sun": {...} }

-- ---------------------------------------------------------------------------
-- shop_gallery_images: shop photo gallery, owner-managed, publicly browsable
-- ---------------------------------------------------------------------------
create table public.shop_gallery_images (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  path text not null,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index shop_gallery_images_shop_id_idx on public.shop_gallery_images (shop_id);

alter table public.shop_gallery_images enable row level security;

create policy "anyone can browse shop gallery"
  on public.shop_gallery_images for select
  to authenticated
  using (true);

create policy "owners manage own shop gallery"
  on public.shop_gallery_images for all
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

-- ---------------------------------------------------------------------------
-- Public/customer-browsing read policies (rating+staff discovery on the
-- shop-detail page, before any booking exists). Additive — Postgres RLS
-- policies are OR'd, so these can't weaken any existing owner-scoped policy.
-- ---------------------------------------------------------------------------

-- reviews: browsing rating+comment (never joined with customer names/serials
-- from this path, so no other customer's identity is exposed).
create policy "anyone can browse shop reviews"
  on public.reviews for select
  to authenticated
  using (true);

-- chairs: Staff tab needs to show active staff/chairs for any shop.
create policy "anyone can browse active chairs"
  on public.chairs for select
  to authenticated
  using (is_active = true);

-- chair_service_stats: needed to show per-chair "can perform" service chips
-- and to filter eligible chairs for the customer's optional preferred-staff pick.
create policy "anyone can browse chair capabilities"
  on public.chair_service_stats for select
  to authenticated
  using (true);
