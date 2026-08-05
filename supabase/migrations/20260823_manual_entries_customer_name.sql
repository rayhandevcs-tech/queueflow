-- Manual entries get a customer_name field instead of a free-text note —
-- a manual (serial-less) job left as DUE had no way to identify who owes
-- it once it shows up in বাকির খাতা. Optional (a quick cash sale still
-- doesn't need one), but recommended for DUE entries in the UI.
--
-- Written idempotent per this project's established pattern for new
-- columns (see 20260819/20260821's comments on the live-vs-migration
-- drift this repo has repeatedly hit).
-- Run this once in the Supabase dashboard's SQL editor.

alter table public.manual_entries
  add column if not exists customer_name text;
