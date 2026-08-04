-- Sprint 15: সার্ভিসের নিজস্ব ছবি (দোকানদার আপলোড করবে, ক্যাটাগরি-ভিত্তিক
-- ভেক্টর আইকন শুধু ফলব্যাক হিসেবে থাকবে যতক্ষণ না ছবি দেওয়া হয়)।
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query).

alter table public.services add column image_url text;

-- No RLS change needed — "services: owner update"/"services: owner delete"
-- (capture_baseline_queue_engine.sql) already cover this column and the
-- new hard-delete path used by Sprint 15's service delete button.
