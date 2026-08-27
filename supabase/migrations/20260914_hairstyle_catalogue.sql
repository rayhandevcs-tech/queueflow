-- Sprint 47: হেয়ারস্টাইল ক্যাটালগ আর কাস্টমারের পছন্দ
-- Run this once in the Supabase SQL editor, AFTER 20260913.
--
-- ---------------------------------------------------------------------------
-- কী বানানো হচ্ছে
-- ---------------------------------------------------------------------------
-- কাস্টমার নিজের ছবি দিয়ে দেখবে কোন স্টাইল তার মুখের সাথে মানায়, পছন্দ হলে
-- সেটা দোকানদারকে জানাবে। দুটো টেবিল লাগছে:
--
--   hairstyles                — স্টাইলের তালিকা (প্ল্যাটফর্ম-ব্যাপী, এডমিন সামলায়)
--   serial_style_preferences  — কোন সিরিয়ালে কাস্টমার কোন স্টাইল চেয়েছে
--
-- ---------------------------------------------------------------------------
-- কেন serials-এ কলাম যোগ করা হলো না
-- ---------------------------------------------------------------------------
-- সোজা পথ ছিল serials-এ একটা preferred_style_id বসানো। কিন্তু serials-এর
-- before-insert আর before-update ট্রিগার দুটো বড়, আর সেগুলোয় কোন কলাম
-- অপরিবর্তনীয় তার তালিকা হাতে লেখা — নতুন কলাম যোগ করা মানে ওই একশো লাইনের
-- ফাংশন আবার লেখা। এই সেশনেই একবার সেটা করতে গিয়ে admin_shop_detail ভেঙেছিল।
--
-- আলাদা টেবিলে রাখলে ওই ট্রিগারগুলো ছুঁতেই হয় না, আর সম্পর্কটাও বেশি সৎ:
-- পছন্দটা বুকিংয়ের অবিচ্ছেদ্য অংশ নয়, কাস্টমার পরেও বদলাতে পারে।

-- ---------------------------------------------------------------------------
-- ১) স্টাইলের তালিকা
-- ---------------------------------------------------------------------------
create table if not exists public.hairstyles (
  id uuid primary key default gen_random_uuid(),
  -- 'HAIR' না 'BEARD' — কাস্টমার আলাদা ট্যাবে দেখবে, আর AI-ও জানে কোনটা
  -- মাথার আর কোনটা মুখের।
  kind text not null check (kind in ('HAIR', 'BEARD')),
  -- slug দিয়েই সিড আবার চালানো নিরাপদ (on conflict do nothing)।
  slug text not null unique,
  name_bn text not null,
  name_en text not null,
  -- AI এই বর্ণনাটাই পড়ে। ছবি নয় — ছবি ছাড়াই সুপারিশ কাজ করা দরকার, কারণ
  -- ছবি যোগ হতে সময় লাগবে।
  description_bn text not null,
  description_en text not null,
  -- "লম্বাটে মুখে ভালো লাগে" জাতীয় ইঙ্গিত, AI-এর জন্য।
  suits_notes_en text not null,
  -- রেফারেন্স ছবি — দোকানদারকে দেখানোর জন্য।
  reference_image_url text,
  -- স্বচ্ছ PNG — কাস্টমারের ছবির উপর বসানোর জন্য। দুটোই পরে আপলোড হবে।
  overlay_image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists hairstyles_kind_sort_idx
  on public.hairstyles (kind, sort_order, name_en);

alter table public.hairstyles enable row level security;

-- ক্যাটালগ সবার জন্য খোলা — লগইন ছাড়াও দেখা যাবে, ঠিক দোকানের তালিকার মতো।
drop policy if exists "hairstyles: public read" on public.hairstyles;
create policy "hairstyles: public read"
  on public.hairstyles for select
  using (is_active or public.is_platform_admin());

-- লেখা কেবল এডমিনের। দোকানদার নিজের মতো স্টাইল যোগ করতে পারলে একই স্টাইল
-- বিশ ভাবে বিশ জায়গায় লেখা হতো, আর AI-এর তালিকাটা অকেজো হয়ে যেত।
drop policy if exists "hairstyles: admin write" on public.hairstyles;
create policy "hairstyles: admin write"
  on public.hairstyles for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- ২) কাস্টমারের পছন্দ, সিরিয়ালের সাথে
-- ---------------------------------------------------------------------------
create table if not exists public.serial_style_preferences (
  serial_id uuid primary key references public.serials(id) on delete cascade,
  hairstyle_id uuid not null references public.hairstyles(id) on delete cascade,
  -- "একটু ছোট করে" — কাস্টমারের নিজের কথা।
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists serial_style_pref_style_idx
  on public.serial_style_preferences (hairstyle_id);

alter table public.serial_style_preferences enable row level security;

-- পড়তে পারবে দুজন: যে সিরিয়ালটা যার, আর যে দোকানে সিরিয়ালটা।
-- মাঝখানে কেউ নয়।
drop policy if exists "style pref: customer or shop read" on public.serial_style_preferences;
create policy "style pref: customer or shop read"
  on public.serial_style_preferences for select
  to authenticated
  using (
    exists (
      select 1 from public.serials s
       where s.id = serial_id
         and (s.customer_id = auth.uid() or public.is_shop_owner(s.shop_id))
    )
  );

-- লিখতে পারে কেবল কাস্টমার নিজে — দোকানদার কাস্টমারের হয়ে পছন্দ "ঠিক করে
-- দিতে" পারবে না।
drop policy if exists "style pref: customer write" on public.serial_style_preferences;
create policy "style pref: customer write"
  on public.serial_style_preferences for insert
  to authenticated
  with check (
    exists (
      select 1 from public.serials s
       where s.id = serial_id and s.customer_id = auth.uid()
    )
  );

drop policy if exists "style pref: customer update" on public.serial_style_preferences;
create policy "style pref: customer update"
  on public.serial_style_preferences for update
  to authenticated
  using (
    exists (
      select 1 from public.serials s
       where s.id = serial_id and s.customer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.serials s
       where s.id = serial_id and s.customer_id = auth.uid()
    )
  );

drop policy if exists "style pref: customer delete" on public.serial_style_preferences;
create policy "style pref: customer delete"
  on public.serial_style_preferences for delete
  to authenticated
  using (
    exists (
      select 1 from public.serials s
       where s.id = serial_id and s.customer_id = auth.uid()
    )
  );

drop trigger if exists serial_style_pref_updated_at on public.serial_style_preferences;
create trigger serial_style_pref_updated_at
  before update on public.serial_style_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ৩) শুরুর তালিকা
-- ---------------------------------------------------------------------------
-- বাংলাদেশের সেলুনে আসলে যেগুলো চাওয়া হয়, সেগুলোই। ছবি এখনো নেই — সেটা
-- ইচ্ছাকৃত: AI বর্ণনা পড়ে সুপারিশ করে, তাই ছবি আপলোডের অপেক্ষায় ফিচারটা
-- আটকে থাকে না। ছবি যোগ হলে ট্রাই-অন আর রেফারেন্স দুটোই চালু হয়ে যাবে।
--
-- suits_notes_en ইংরেজিতে, কারণ ওটা কেবল AI পড়ে — কোনো পর্দায় দেখানো হয় না।
insert into public.hairstyles
  (kind, slug, name_bn, name_en, description_bn, description_en, suits_notes_en, sort_order)
values
  ('HAIR', 'crew-cut', 'ক্রু কাট', 'Crew Cut',
   'পাশ ও পিছন ছোট, উপরে অল্প লম্বা। সবচেয়ে সহজে সামলানো যায়।',
   'Short back and sides with a little length on top. The lowest-maintenance cut there is.',
   'Suits almost every face shape. Especially good for round faces because the height on top lengthens the face. Works with thinning hair.', 10),

  ('HAIR', 'fade-low', 'লো ফেড', 'Low Fade',
   'নিচের দিক থেকে ধীরে ধীরে ছোট হয়ে আসে, উপরে ভলিউম থাকে।',
   'Tapers gradually from low down, keeping volume on top.',
   'Good for square and oval faces. Softer than a high fade, so it does not exaggerate a long face.', 20),

  ('HAIR', 'fade-high', 'হাই ফেড', 'High Fade',
   'কানের উপর থেকেই ছোট, উপরটা স্পষ্ট আলাদা দেখায়।',
   'Short from above the ear, giving a sharp contrast with the top.',
   'Adds apparent height, so it flatters round and square faces. Avoid on long or narrow faces — it makes them look longer.', 30),

  ('HAIR', 'textured-crop', 'টেক্সচার্ড ক্রপ', 'Textured Crop',
   'উপরে এলোমেলো টেক্সচার, সামনে ছোট ফ্রিঞ্জ।',
   'Choppy texture on top with a short fringe forward.',
   'Very forgiving. Good for high foreheads and receding hairlines because the fringe covers the front. Works best with straight to wavy hair.', 40),

  ('HAIR', 'pompadour', 'পম্পাডোর', 'Pompadour',
   'সামনের চুল উপরে-পিছনে তোলা, ভলিউম বেশি।',
   'Front swept up and back with plenty of volume.',
   'Adds height, so it suits round and square faces. Needs thick hair and daily styling.', 50),

  ('HAIR', 'side-part', 'সাইড পার্ট', 'Side Part',
   'এক পাশে সিঁথি, পরিপাটি ও আনুষ্ঠানিক।',
   'A clean parting on one side — tidy and formal.',
   'A safe, professional choice for nearly any face shape. Particularly good for oval faces.', 60),

  ('HAIR', 'buzz-cut', 'বাজ কাট', 'Buzz Cut',
   'পুরো মাথা সমান ছোট। কোনো স্টাইলিং লাগে না।',
   'One short length all over. No styling at all.',
   'Needs a well-shaped head and strong jawline — it hides nothing. Excellent for thinning hair.', 70),

  ('HAIR', 'undercut', 'আন্ডারকাট', 'Undercut',
   'পাশ খুব ছোট, উপরটা লম্বা ও আলাদা।',
   'Very short sides with a long, disconnected top.',
   'Strong contrast suits angular faces. On a round face it can look top-heavy unless the top is styled back.', 80),

  ('HAIR', 'quiff', 'কুইফ', 'Quiff',
   'সামনের দিকটা তুলে দেওয়া, পিছন তুলনায় ছোট।',
   'Front lifted upward, shorter through the back.',
   'Lengthens a round face. Needs medium to thick hair and a little product.', 90),

  ('HAIR', 'layered-medium', 'মিডিয়াম লেয়ার', 'Medium Layered',
   'কান ঢাকা মাঝারি লম্বা, হালকা লেয়ার করা।',
   'Medium length over the ears with soft layers.',
   'Softens sharp jawlines. Good for thick hair that needs weight removed; poor for very fine hair.', 100),

  ('HAIR', 'butter-cut', 'বাটার কাট', 'Butter Cut',
   'সামনে নরম ফ্রিঞ্জ, মাঝখানে হালকা সিঁথি — এখনকার তরুণদের পছন্দ।',
   'A soft fringe with a light middle parting — currently popular with younger customers.',
   'Best with straight, medium-thick hair. Suits oval and long faces; makes a round face look rounder.', 110),

  ('HAIR', 'mullet-modern', 'মডার্ন মালেট', 'Modern Mullet',
   'সামনে ও পাশ ছোট, পিছনে লম্বা।',
   'Short at the front and sides, long at the back.',
   'A deliberate, fashion-forward look. Suits narrow faces; needs confidence more than a particular face shape.', 120),

  ('BEARD', 'clean-shave', 'ক্লিন শেভ', 'Clean Shave',
   'সম্পূর্ণ কামানো।',
   'Completely shaved.',
   'Shows the jaw fully — best when the jawline is already defined. Makes a round face look rounder.', 200),

  ('BEARD', 'stubble', 'স্টাবল', 'Stubble',
   'অল্প খোঁচা দাড়ি, কয়েক দিনের।',
   'A few days of growth, kept even.',
   'Almost universally flattering. Adds definition to a soft jawline without adding bulk to the cheeks.', 210),

  ('BEARD', 'goatee', 'গোটি', 'Goatee',
   'শুধু থুতনিতে দাড়ি, গাল কামানো।',
   'Chin only, cheeks shaved.',
   'Lengthens a round face by drawing the eye down. Not ideal for an already long face.', 220),

  ('BEARD', 'french-cut', 'ফ্রেঞ্চ কাট', 'French Cut',
   'থুতনি ও গোঁফ মিলিয়ে সরু রেখা।',
   'A narrow line joining the moustache and chin.',
   'Neat and low-effort. Works on most faces; needs even growth around the mouth to look sharp.', 230),

  ('BEARD', 'full-beard', 'ফুল বিয়ার্ড', 'Full Beard',
   'পুরো গাল ও থুতনিতে দাড়ি, সমান করে ছাঁটা।',
   'Full growth over the cheeks and chin, trimmed even.',
   'Squares off a thin or oval face. Adds visible width, so it overwhelms an already round face.', 240),

  ('BEARD', 'boxed-beard', 'বক্সড বিয়ার্ড', 'Boxed Beard',
   'ছোট রাখা ফুল দাড়ি, ধারগুলো স্পষ্ট করে কাটা।',
   'A short full beard with sharply defined edges.',
   'The tidiest of the full beards. The clean cheek line adds structure to a round face where a full beard would not.', 250)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- যাচাই
-- ---------------------------------------------------------------------------
-- ১৮টা সারি আসার কথা (১২টা HAIR, ৬টা BEARD):
--
--   select kind, count(*) from public.hairstyles group by kind order by kind;
