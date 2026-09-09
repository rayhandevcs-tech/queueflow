-- Phase 6 / Sprint 1 — business-type foundation.
--
-- One column. `shops.women_only` — for a beauty parlour this is not a
-- marketing label, it is the first thing a customer needs to know before
-- walking in, and it is the kind of thing that is worse than useless if it is
-- only in the About text where nobody filters on it.
--
-- A flag rather than a business_type value on purpose: a salon can be
-- women-only too, and business_type already decides the booking model
-- (decision 27). Overloading one enum with a second, unrelated meaning is how
-- enums stop being usable.
--
-- No RLS change needed: `shops` is already world-readable for browsing and
-- owner-writable through the existing policies, and this column rides both.
--
-- Safe to re-run.

alter table public.shops
  add column if not exists women_only boolean not null default false;

comment on column public.shops.women_only is
  'Shop serves women only. Independent of business_type: a salon can be women-only too.';
