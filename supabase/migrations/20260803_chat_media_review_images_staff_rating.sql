-- Sprint 7: চ্যাট ২.০ (ছবি পাঠানো) + রিভিউ ২.০ (ছবি, স্টাফ অটো-ট্যাগ, per-staff রেটিং)
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query),
-- paste, run. Safe to run once; re-running will error on existing objects (harmless).

-- ---------------------------------------------------------------------------
-- messages: allow image-only messages (content becomes optional)
-- ---------------------------------------------------------------------------
alter table public.messages add column image_url text;
alter table public.messages alter column content drop not null;
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_or_image_check
  check (
    image_url is not null
    or (content is not null and char_length(btrim(content)) > 0 and char_length(content) <= 2000)
  );

-- chat-media storage bucket: images sent inside a chat thread.
-- Path shape: {shopId}/{customerId}/{timestamp}.{ext}
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

create policy "anyone can view chat media"
  on storage.objects for select
  to public
  using (bucket_id = 'chat-media');

create policy "thread participants upload chat media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1 from public.shops sh
        where sh.id = ((storage.foldername(name))[1])::uuid and sh.owner_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- reviews: multiple images + auto-tagged staff (chair) from the reviewed serial
-- ---------------------------------------------------------------------------
alter table public.reviews add column images text[] not null default '{}';
alter table public.reviews add column chair_id uuid references public.chairs(id) on delete set null;

create index reviews_chair_id_idx on public.reviews (chair_id);

-- Per-staff rating aggregate, same pattern as shop_rating_summary
-- (20260802_offers_and_categories.sql) — reviews are already publicly
-- browsable (see "anyone can browse shop reviews" policy), so this view
-- needs no new RLS, just a select grant.
create view public.chair_rating_summary as
select chair_id, avg(rating)::numeric(3,2) as avg_rating, count(*)::int as review_count
from public.reviews
where chair_id is not null
group by chair_id;

grant select on public.chair_rating_summary to authenticated;

-- review-media storage bucket: photos attached to a review.
-- Path shape: {customerId}/{timestamp}.{ext} — same shape/policy as `avatars`.
insert into storage.buckets (id, name, public)
values ('review-media', 'review-media', true)
on conflict (id) do nothing;

create policy "anyone can view review media"
  on storage.objects for select
  to public
  using (bucket_id = 'review-media');

create policy "users upload to own review-media folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'review-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
