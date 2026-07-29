-- Third fix for 20260729_notifications.sql, found via live testing (with
-- network response inspection — the client-facing error was a generic
-- fallback, but the raw Postgres error was a foreign-key violation).
-- Run this once in the Supabase dashboard's SQL editor.
--
-- broadcast_shop_notification's batch insert picked up serials.customer_id
-- values that no longer exist in auth.users (a serial left behind by a
-- since-deleted account from earlier testing in this project). That one bad
-- row made the entire multi-row insert fail with a 23503 foreign-key
-- violation on notifications_user_id_fkey, so every broadcast attempt
-- errored out immediately, before rate-limiting even mattered. Fix: inner
-- join against auth.users so orphaned customer_ids are silently skipped.

create or replace function public.broadcast_shop_notification(
  p_shop_id uuid,
  p_target text,
  p_title text,
  p_body text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  sent_count integer;
begin
  if p_target not in ('recent', 'regulars') then
    raise exception 'অজানা টার্গেট';
  end if;

  if not exists (
    select 1 from public.shops sh where sh.id = p_shop_id and sh.owner_id = auth.uid()
  ) then
    raise exception 'এই দোকানের মালিক তুমি না';
  end if;

  if exists (
    select 1 from public.notifications n
    where n.type = 'PROMO'
      and (n.data ->> 'shop_id') = p_shop_id::text
      and n.created_at::date = current_date
  ) then
    raise exception 'আজকে একবার ব্রডকাস্ট পাঠানো হয়ে গেছে — আগামীকাল আবার চেষ্টা করো';
  end if;

  if p_target = 'recent' then
    insert into public.notifications (user_id, type, title, body, data)
    select distinct s.customer_id, 'PROMO', p_title, p_body,
           jsonb_build_object('shop_id', p_shop_id)
    from public.serials s
    join auth.users u on u.id = s.customer_id
    where s.shop_id = p_shop_id
      and s.booked_at >= now() - interval '30 days';
  else
    insert into public.notifications (user_id, type, title, body, data)
    select customer_id, 'PROMO', p_title, p_body, jsonb_build_object('shop_id', p_shop_id)
    from (
      select s.customer_id, count(*) as visit_count
      from public.serials s
      join auth.users u on u.id = s.customer_id
      where s.shop_id = p_shop_id
        and s.status = 'DONE'
      group by s.customer_id
      having count(*) >= 2
    ) regulars;
  end if;

  get diagnostics sent_count = row_count;
  return sent_count;
end;
$$;
