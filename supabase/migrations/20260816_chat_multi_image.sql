-- Sprint 16: মেসেজ ২.০ (একটা মেসেজে একাধিক ছবি) — নতুন image_urls
-- অ্যারে কলাম যোগ হচ্ছে, পুরনো image_url কলাম রয়ে যাচ্ছে (পুরনো মেসেজ
-- ওটাই ব্যবহার করবে, ড্রপ/রিনেম করা হচ্ছে না), নতুন মেসেজ থেকে
-- image_urls অ্যারে ব্যবহার হবে।
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query).

alter table public.messages add column image_urls text[];

alter table public.messages drop constraint if exists messages_content_or_image_check;
alter table public.messages add constraint messages_content_or_image_check
  check (
    image_url is not null
    or (image_urls is not null and array_length(image_urls, 1) > 0)
    or (content is not null and char_length(btrim(content)) > 0 and char_length(content) <= 2000)
  );
