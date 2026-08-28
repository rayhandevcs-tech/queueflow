-- Sprint 48: হেয়ারস্টাইলের ছবির জন্য বাকেট
-- Run this once in the Supabase SQL editor, AFTER 20260914.
--
-- ---------------------------------------------------------------------------
-- কেন আলাদা বাকেট
-- ---------------------------------------------------------------------------
-- 20260914-এ ১৮টা স্টাইল সিড করা হয়েছে, কিন্তু ছবির কলাম দুটো খালি — আর ছবি
-- বসানোর কোনো পথও ছিল না। shop-media বাকেটে রাখা যেত না: ওটার RLS দোকান-ভিত্তিক
-- (ফোল্ডারের নাম = shop_id), অথচ এই ছবিগুলো কোনো দোকানের নয়, পুরো প্ল্যাটফর্মের।
--
-- পড়া সবার জন্য খোলা (ক্যাটালগ লগইন ছাড়াও দেখা যায়), কিন্তু **লেখা কেবল
-- এডমিনের** — দোকানদার নিজের ছবি বসাতে পারলে একই স্টাইল বিশ রকম দেখাত।

insert into storage.buckets (id, name, public)
values ('style-media', 'style-media', true)
on conflict (id) do nothing;

drop policy if exists "anyone can view style media" on storage.objects;
create policy "anyone can view style media"
  on storage.objects for select
  to public
  using (bucket_id = 'style-media');

drop policy if exists "admins upload style media" on storage.objects;
create policy "admins upload style media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'style-media' and public.is_platform_admin());

drop policy if exists "admins update style media" on storage.objects;
create policy "admins update style media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'style-media' and public.is_platform_admin())
  with check (bucket_id = 'style-media' and public.is_platform_admin());

drop policy if exists "admins delete style media" on storage.objects;
create policy "admins delete style media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'style-media' and public.is_platform_admin());

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- যাচাই — এক সারি আসার কথা
-- ---------------------------------------------------------------------------
--   select id, public from storage.buckets where id = 'style-media';
