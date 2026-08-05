-- Hotfix: shop owners can't upload chat images.
-- "thread participants upload chat media" (20260803_chat_media_review_images_staff_rating.sql)
-- lets a shop owner upload via a raw inline
--   exists (select 1 from public.shops sh where sh.id = ... and sh.owner_id = auth.uid())
-- which live-tested as failing with "new row violates row-level security policy" for a
-- confirmed real shop owner, even though public.shops itself has an unrestricted
-- "shops: public read" policy. Every other owner-check policy in this project
-- (shops/services/chairs/serials/chair_service_stats) goes through the SECURITY DEFINER
-- public.is_shop_owner(uuid) helper instead of an inline subquery — switching this policy
-- to use that same proven helper fixes it without depending on exactly why the raw
-- subquery form failed inside a storage policy's WITH CHECK evaluation.
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query).

drop policy if exists "thread participants upload chat media" on storage.objects;
create policy "thread participants upload chat media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_shop_owner(((storage.foldername(name))[1])::uuid)
    )
  );
