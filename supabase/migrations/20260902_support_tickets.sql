-- Sprint 36: সাপোর্ট টিকিট — গ্রাহক ও দোকানদারের সমস্যা, এডমিনের সাপোর্ট সেন্টার
-- Run this once in the Supabase dashboard's SQL editor, AFTER
-- 20260901_admin_identity.sql.
--
-- ---------------------------------------------------------------------------
-- SHAPE
-- ---------------------------------------------------------------------------
-- A ticket is a thread, not a form submission: the opening message is just the
-- first row in support_ticket_messages. That is what makes a back-and-forth
-- possible without a second table later, and it means "reply" and "the
-- original problem" are rendered by the same component.
--
-- Internal notes live in the same message table behind is_internal. Keeping
-- them out of a separate table is deliberate — an admin note belongs in the
-- chronology of the conversation it annotates. The RLS policy below is what
-- keeps them from ever reaching the person who opened the ticket, so the
-- privacy boundary is enforced by the database rather than by remembering to
-- filter in every query.

-- ---------------------------------------------------------------------------
-- 1) Tables
-- ---------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  category        text not null
                  check (category in ('BOOKING', 'PAYMENT', 'ACCOUNT', 'SHOP', 'TECHNICAL', 'OTHER')),
  subject         text not null check (length(btrim(subject)) between 3 and 120),
  status          text not null default 'PENDING'
                  check (status in ('PENDING', 'IN_PROGRESS', 'SOLVED', 'CLOSED')),
  assigned_to     uuid references auth.users(id) on delete set null,
  -- Denormalised so the admin list can sort by "most recently active" without
  -- a correlated subquery over every ticket's messages.
  last_message_at timestamptz not null default now(),
  -- Set when an admin opens the thread, so the customer's own new messages
  -- don't clear the unread mark for staff.
  admin_read_at   timestamptz,
  user_read_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists support_tickets_user_idx
  on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_idx
  on public.support_tickets (status, last_message_at desc);

create table if not exists public.support_ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  sender_id   uuid references auth.users(id) on delete set null,
  -- Who is speaking, recorded at write time. Derived rather than trusted:
  -- both writer RPCs set it themselves.
  is_staff    boolean not null default false,
  -- An admin-only note. Never visible to the ticket owner (see RLS below).
  is_internal boolean not null default false,
  body        text not null check (length(btrim(body)) > 0),
  images      text[] not null default '{}',
  created_at  timestamptz not null default now(),
  constraint support_message_internal_is_staff
    check (is_internal = false or is_staff = true)
);

create index if not exists support_ticket_messages_ticket_idx
  on public.support_ticket_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

-- ---------------------------------------------------------------------------
-- 2) RLS
-- ---------------------------------------------------------------------------
-- Reads are direct (the owner reads their own thread; an admin reads all).
-- Writes all go through the RPCs below, so no client picks its own is_staff,
-- is_internal or status.
drop policy if exists "support_tickets: own read" on public.support_tickets;
create policy "support_tickets: own read"
  on public.support_tickets for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "support_tickets: admin read" on public.support_tickets;
create policy "support_tickets: admin read"
  on public.support_tickets for select
  to authenticated
  using (public.is_platform_admin());

-- The is_internal = false clause is the privacy boundary for admin notes.
drop policy if exists "support_ticket_messages: own read" on public.support_ticket_messages;
create policy "support_ticket_messages: own read"
  on public.support_ticket_messages for select
  to authenticated
  using (
    is_internal = false
    and exists (
      select 1 from public.support_tickets t
       where t.id = ticket_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "support_ticket_messages: admin read" on public.support_ticket_messages;
create policy "support_ticket_messages: admin read"
  on public.support_ticket_messages for select
  to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 3) support-media bucket — screenshots attached to a ticket
-- ---------------------------------------------------------------------------
-- Path shape: {userId}/{timestamp}-{rand}.{ext}. Uploads are keyed to the
-- uploader's own folder, which is all the write rule needs: a ticket is
-- created in the same breath as its images, so there is no ticket id to key on
-- yet, and a stray upload with no ticket is harmless.
insert into storage.buckets (id, name, public)
values ('support-media', 'support-media', true)
on conflict (id) do nothing;

drop policy if exists "anyone can view support media" on storage.objects;
create policy "anyone can view support media"
  on storage.objects for select
  to public
  using (bucket_id = 'support-media');

drop policy if exists "users upload their own support media" on storage.objects;
create policy "users upload their own support media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'support-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 4) Customer / shop-owner side
-- ---------------------------------------------------------------------------
-- Opening a ticket and its first message is one transaction, so a ticket can
-- never exist with nothing in it.
create or replace function public.create_support_ticket(
  p_category text,
  p_subject  text,
  p_body     text,
  p_images   text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_category not in ('BOOKING', 'PAYMENT', 'ACCOUNT', 'SHOP', 'TECHNICAL', 'OTHER') then
    raise exception 'unknown category';
  end if;

  -- One open ticket per person at a time would be too strict, but an unbounded
  -- queue invites accidental double-submits; cap the open ones instead.
  if (
    select count(*) from public.support_tickets
     where user_id = auth.uid() and status in ('PENDING', 'IN_PROGRESS')
  ) >= 10 then
    raise exception 'too many open tickets';
  end if;

  insert into public.support_tickets (user_id, category, subject, user_read_at)
  values (auth.uid(), p_category, btrim(p_subject), now())
  returning id into v_ticket;

  insert into public.support_ticket_messages (ticket_id, sender_id, is_staff, body, images)
  values (v_ticket, auth.uid(), false, btrim(p_body), coalesce(p_images, '{}'));

  return v_ticket;
end;
$$;

grant execute on function public.create_support_ticket(text, text, text, text[]) to authenticated;

create or replace function public.add_support_message(
  p_ticket_id uuid,
  p_body      text,
  p_images    text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg    uuid;
  v_status text;
begin
  select status into v_status
    from public.support_tickets
   where id = p_ticket_id and user_id = auth.uid();

  if v_status is null then
    raise exception 'ticket not found';
  end if;
  if v_status = 'CLOSED' then
    raise exception 'ticket is closed';
  end if;

  insert into public.support_ticket_messages (ticket_id, sender_id, is_staff, body, images)
  values (p_ticket_id, auth.uid(), false, btrim(p_body), coalesce(p_images, '{}'))
  returning id into v_msg;

  -- A reply from the customer reopens a thread that support had marked solved:
  -- "solved" is support's opinion, and the customer is entitled to disagree.
  update public.support_tickets
     set last_message_at = now(),
         updated_at      = now(),
         user_read_at    = now(),
         admin_read_at   = null,
         status          = case when status = 'SOLVED' then 'IN_PROGRESS' else status end
   where id = p_ticket_id;

  return v_msg;
end;
$$;

grant execute on function public.add_support_message(uuid, text, text[]) to authenticated;

create or replace function public.mark_support_ticket_read(p_ticket_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.support_tickets
     set user_read_at = now()
   where id = p_ticket_id and user_id = auth.uid();
$$;

grant execute on function public.mark_support_ticket_read(uuid) to authenticated;

-- The customer's own list, with the reply count and whether staff has said
-- anything since they last looked.
create or replace function public.my_support_tickets()
returns table (
  id              uuid,
  category        text,
  subject         text,
  status          text,
  created_at      timestamptz,
  last_message_at timestamptz,
  message_count   bigint,
  last_preview    text,
  has_unread      boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.category,
    t.subject,
    t.status,
    t.created_at,
    t.last_message_at,
    (select count(*) from public.support_ticket_messages m
      where m.ticket_id = t.id and m.is_internal = false),
    (select m.body from public.support_ticket_messages m
      where m.ticket_id = t.id and m.is_internal = false
      order by m.created_at desc limit 1),
    exists (
      select 1 from public.support_ticket_messages m
       where m.ticket_id = t.id
         and m.is_internal = false
         and m.is_staff = true
         and (t.user_read_at is null or m.created_at > t.user_read_at)
    )
  from public.support_tickets t
  where t.user_id = auth.uid()
  order by t.last_message_at desc;
$$;

grant execute on function public.my_support_tickets() to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Admin side
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_tickets(
  p_status text default null,
  p_search text default null,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id              uuid,
  user_id         uuid,
  user_name       text,
  user_email      text,
  user_role       text,
  category        text,
  subject         text,
  status          text,
  created_at      timestamptz,
  last_message_at timestamptz,
  message_count   bigint,
  last_preview    text,
  needs_reply     boolean,
  total_count     bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.admin_can('support.handle') then
    raise exception 'not authorized';
  end if;

  return query
  with filtered as (
    select t.*
      from public.support_tickets t
      left join public.profiles p on p.id = t.user_id
      left join auth.users u on u.id = t.user_id
     where (p_status is null or t.status = p_status)
       and (
         p_search is null or btrim(p_search) = ''
         or t.subject ilike '%' || p_search || '%'
         or coalesce(p.full_name, '') ilike '%' || p_search || '%'
         or coalesce(u.email::text, '') ilike '%' || p_search || '%'
       )
  )
  select
    f.id,
    f.user_id,
    p.full_name,
    u.email::text,
    p.role::text,
    f.category,
    f.subject,
    f.status,
    f.created_at,
    f.last_message_at,
    (select count(*) from public.support_ticket_messages m
      where m.ticket_id = f.id and m.is_internal = false),
    (select m.body from public.support_ticket_messages m
      where m.ticket_id = f.id and m.is_internal = false
      order by m.created_at desc limit 1),
    -- The last thing said was said by the customer: someone owes them an answer.
    coalesce((select not m.is_staff from public.support_ticket_messages m
               where m.ticket_id = f.id and m.is_internal = false
               order by m.created_at desc limit 1), false),
    (select count(*) from filtered)
  from filtered f
  left join public.profiles p on p.id = f.user_id
  left join auth.users u on u.id = f.user_id
  order by f.last_message_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.admin_list_tickets(text, text, integer, integer) to authenticated;

create or replace function public.admin_ticket_counts()
returns table (pending bigint, in_progress bigint, solved bigint, closed bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.admin_can('support.handle') then
    raise exception 'not authorized';
  end if;

  return query
  select
    count(*) filter (where status = 'PENDING'),
    count(*) filter (where status = 'IN_PROGRESS'),
    count(*) filter (where status = 'SOLVED'),
    count(*) filter (where status = 'CLOSED')
  from public.support_tickets;
end;
$$;

grant execute on function public.admin_ticket_counts() to authenticated;

create or replace function public.admin_reply_ticket(
  p_ticket_id uuid,
  p_body      text,
  p_images    text[] default '{}',
  p_internal  boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg   uuid;
  v_owner uuid;
  v_subj  text;
begin
  if not public.admin_can('support.handle') then
    raise exception 'not authorized';
  end if;

  select user_id, subject into v_owner, v_subj
    from public.support_tickets where id = p_ticket_id;
  if v_owner is null then
    raise exception 'ticket not found';
  end if;

  insert into public.support_ticket_messages
    (ticket_id, sender_id, is_staff, is_internal, body, images)
  values
    (p_ticket_id, auth.uid(), true, p_internal, btrim(p_body), coalesce(p_images, '{}'))
  returning id into v_msg;

  -- An internal note is not activity the customer should see or be pinged
  -- about, so it moves neither the status nor the notification.
  if p_internal then
    update public.support_tickets set updated_at = now() where id = p_ticket_id;
    return v_msg;
  end if;

  update public.support_tickets
     set last_message_at = now(),
         updated_at      = now(),
         admin_read_at   = now(),
         assigned_to     = coalesce(assigned_to, auth.uid()),
         status          = case when status = 'PENDING' then 'IN_PROGRESS' else status end
   where id = p_ticket_id;

  -- Reuses the existing pipeline end to end: Notification Center, realtime and
  -- web push all already handle SYSTEM. The ticket id rides in data so the
  -- notification can deep-link into the thread.
  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_owner,
    'SYSTEM',
    'সাপোর্ট থেকে উত্তর এসেছে',
    v_subj,
    jsonb_build_object('ticket_id', p_ticket_id, 'link', '/help/tickets/' || p_ticket_id)
  );

  perform public.admin_log('SUPPORT_REPLY', 'ticket', p_ticket_id, '{}'::jsonb);
  return v_msg;
end;
$$;

grant execute on function public.admin_reply_ticket(uuid, text, text[], boolean) to authenticated;

create or replace function public.admin_set_ticket_status(
  p_ticket_id uuid,
  p_status    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_can('support.handle') then
    raise exception 'not authorized';
  end if;
  if p_status not in ('PENDING', 'IN_PROGRESS', 'SOLVED', 'CLOSED') then
    raise exception 'unknown status';
  end if;

  update public.support_tickets
     set status = p_status,
         updated_at = now(),
         assigned_to = coalesce(assigned_to, auth.uid())
   where id = p_ticket_id;

  perform public.admin_log(
    'SUPPORT_SET_STATUS', 'ticket', p_ticket_id, jsonb_build_object('status', p_status)
  );
end;
$$;

grant execute on function public.admin_set_ticket_status(uuid, text) to authenticated;

create or replace function public.admin_mark_ticket_read(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_can('support.handle') then
    raise exception 'not authorized';
  end if;
  update public.support_tickets set admin_read_at = now() where id = p_ticket_id;
end;
$$;

grant execute on function public.admin_mark_ticket_read(uuid) to authenticated;
