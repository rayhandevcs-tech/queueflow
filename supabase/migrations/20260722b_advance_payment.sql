-- Sprint 9: advance payment (mocked bKash/Nagad) tracking on serials
-- Run this once in the Supabase dashboard's SQL editor, same as the previous migration.

alter table public.serials
  add column advance_paid boolean not null default false,
  add column advance_method text check (advance_method in ('bkash', 'nagad')),
  add column advance_txn_id text;
