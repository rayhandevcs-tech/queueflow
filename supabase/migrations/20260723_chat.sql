-- Sprint: customer <-> shop-owner chat
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query),
-- paste, run. Safe to run once; re-running will error on the existing table (harmless).
--
-- Scope: chat is only allowed between a customer and a shop they have actually
-- booked at (>=1 row in `serials`, any status) — not open user-to-user messaging.
-- A thread is keyed by (shop_id, customer_id); `sender_id` says who wrote a
-- given row (either the customer or that shop's owner).
--
-- After running, enable Realtime for this table in Database → Replication if
-- it isn't already on for all tables in this project (other realtime tables
-- like `serials` don't have an explicit publication statement in these
-- migrations either, so this follows the same project convention).

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) > 0 and char_length(content) <= 2000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_thread_idx on public.messages (shop_id, customer_id, created_at);

alter table public.messages enable row level security;

-- Either participant (the customer, or the shop's owner) may read a thread.
create policy "participants read thread"
  on public.messages for select
  to authenticated
  using (
    customer_id = auth.uid()
    or exists (
      select 1 from public.shops sh
      where sh.id = shop_id and sh.owner_id = auth.uid()
    )
  );

-- Either participant may post into a thread, but only if the customer has
-- actually booked at that shop at least once.
create policy "participants send in a booked thread"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      customer_id = auth.uid()
      or exists (
        select 1 from public.shops sh
        where sh.id = shop_id and sh.owner_id = auth.uid()
      )
    )
    and exists (
      select 1 from public.serials s
      where s.shop_id = shop_id and s.customer_id = customer_id
    )
  );

-- Either participant may mark thread messages read.
create policy "participants mark thread read"
  on public.messages for update
  to authenticated
  using (
    customer_id = auth.uid()
    or exists (
      select 1 from public.shops sh
      where sh.id = shop_id and sh.owner_id = auth.uid()
    )
  )
  with check (
    customer_id = auth.uid()
    or exists (
      select 1 from public.shops sh
      where sh.id = shop_id and sh.owner_id = auth.uid()
    )
  );
