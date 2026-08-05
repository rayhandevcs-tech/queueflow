-- Sprint 22: customer profile new fields — date of birth + saved address.
--
-- The address isn't just profile trivia — it's the fallback source for
-- "distance to shop" when a customer hasn't granted live GPS this session
-- (see useUserLocation()/the explore page). address_lat/address_lng are
-- saved alongside the free-text address so distance math never needs to
-- re-geocode it client-side.
--
-- No RLS change needed: "profiles: update own" (20260730 baseline) is a
-- plain row-level `auth.uid() = id` check with no per-column restriction,
-- so these new columns are already covered.
--
-- Written idempotent on purpose: a live read-only check during this sprint
-- found all four columns already present on `profiles` (200, not the 400
-- PostgREST gives for a truly-missing column) even though no migration in
-- this repo ever added them — same unexplained pattern as Sprint 18's
-- `shops.accepted_payment_methods`. `add column if not exists` makes this
-- safe to run whether or not they're already there.
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query).

alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists address text,
  add column if not exists address_lat double precision,
  add column if not exists address_lng double precision;
