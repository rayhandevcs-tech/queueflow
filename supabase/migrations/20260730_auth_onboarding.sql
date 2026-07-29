-- Sprint 3: Auth + অনবোর্ডিং সম্পূর্ণ
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query),
-- paste, run. Safe to run once; re-running will error on existing objects (harmless).

-- ---------------------------------------------------------------------------
-- profiles: onboarding fields (gender, avatar, completion marker)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column gender text check (gender in ('male', 'female', 'other')),
  add column avatar_url text,
  add column onboarding_completed_at timestamptz;

-- No new RLS policy needed here: profiles already has a row-level
-- "users update own profile" policy (proven by ProfileForm's existing
-- full_name/phone updates), and RLS is row-level, not column-level — it
-- already covers these new columns. Verify the policy still exists after
-- running this migration (Database → Policies → profiles) before relying on it.

-- ---------------------------------------------------------------------------
-- avatars storage bucket: user profile photos, one folder per user
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "anyone can view avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "users upload to own avatar folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update own avatar folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own avatar folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
