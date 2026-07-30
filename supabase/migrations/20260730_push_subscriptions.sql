-- Backlog: Web Push notifications.
-- Run this once in the Supabase dashboard's SQL editor. Safe to run once; re-running the
-- trigger part is harmless (it's idempotent), but the `create table`/`create policy`
-- statements will error on the existing objects if run twice (harmless, same as other
-- migrations in this repo).
--
-- Before running: replace <PUSH_WEBHOOK_SECRET> below with the actual secret value
-- (handed to you alongside this file) — it must match the app's PUSH_WEBHOOK_SECRET
-- Vercel environment variable exactly, or every push send will 401 silently.

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: manage own" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Webhook: every new notifications row calls the app's /api/push/send route,
-- which looks up that user's push_subscriptions and delivers a real browser push.
-- supabase_functions.http_request is Supabase's built-in pg_net-backed helper —
-- no Edge Function or Dashboard webhook config needed, this trigger is the whole thing.
-- ---------------------------------------------------------------------------
drop trigger if exists notifications_push_webhook on public.notifications;
create trigger notifications_push_webhook after insert on public.notifications
  for each row execute function supabase_functions.http_request(
    'https://queueflow-delta.vercel.app/api/push/send',
    'POST',
    '{"Content-type":"application/json","x-push-webhook-secret":"<PUSH_WEBHOOK_SECRET>"}',
    '{}',
    '5000'
  );
