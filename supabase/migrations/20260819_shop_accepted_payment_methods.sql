-- Sprint 18: per-shop "গ্রহণযোগ্য পেমেন্ট" (accepted payment methods) — real
-- persistence, replacing the hardcoded ENABLED_PAYMENT_METHODS = ["cash"]
-- constant. Card stays app-side "coming soon" only (needs POS hardware, so
-- it's never in this array) — cash/bkash/nagad/rocket are all things a shop
-- can confirm by hand (customer sends money, provider marks it received),
-- no online gateway required.
--
-- Written idempotent on purpose: a live read-only check during this sprint
-- found `shops.accepted_payment_methods` already present on every shop row
-- (default ["cash"], same name/shape as designed here) even though no
-- migration in this repo ever added it — same class of gap as Sprint 11's
-- baseline capture. `add column if not exists` and a guarded constraint
-- make this safe to run whether or not the column is already there.
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query).

alter table public.shops
  add column if not exists accepted_payment_methods text[] not null default array['cash'];

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shops_accepted_payment_methods_valid'
  ) then
    alter table public.shops
      add constraint shops_accepted_payment_methods_valid
      check (accepted_payment_methods <@ array['cash', 'bkash', 'nagad', 'rocket', 'card']::text[]);
  end if;
end $$;
