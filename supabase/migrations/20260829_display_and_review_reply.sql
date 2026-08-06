-- Sprint 30: counter display + review replies.
--
-- Run this once in the Supabase SQL editor, AFTER 20260828_group_booking.sql.
--
-- Two unrelated things that share a theme — letting a shop speak for itself:
-- a screen on the counter that shows the queue to people standing in it, and
-- a way for the owner to answer a review instead of watching it sit there.

-- ---------------------------------------------------------------------------
-- 1) shop_display_board — the counter screen's only query
-- ---------------------------------------------------------------------------
-- Deliberately a SECURITY DEFINER RPC rather than a public SELECT policy on
-- queue_public:
--
--   * this page is unauthenticated by design (it runs on a spare phone taped
--     to the wall, with nobody logged in), so it would otherwise depend on the
--     anon read policy of a table whose policies predate this repo's migration
--     history. Handing an anonymous screen a purpose-built read is safer than
--     assuming what those policies say.
--   * it returns exactly what a wall display needs and nothing else — no
--     customer names, no phone numbers, no ids that could be replayed
--     elsewhere. Position numbers and staff names are already visible to
--     anyone standing in the shop.
--   * ACTIVE shops only, so the URL can't be used to probe whether a pending
--     or suspended shop exists.
create or replace function public.shop_display_board(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop   record;
  v_lanes  jsonb;
  v_free   timestamptz;
begin
  select id, name, is_open, accepting_new, break_until, break_reason
    into v_shop
    from public.shops
   where id = p_shop_id
     and status = 'ACTIVE';

  if v_shop is null then
    return null;
  end if;

  select coalesce(jsonb_agg(lane order by lane ->> 'staff_name'), '[]'::jsonb)
    into v_lanes
  from (
    select jsonb_build_object(
             'chair_id',    c.id,
             'staff_name',  coalesce(nullif(btrim(c.staff_name), ''), c.label),
             'avatar_url',  c.staff_avatar_url,
             'now_serving', (select q.position from public.queue_public q
                              where q.chair_id = c.id and q.status = 'IN_PROGRESS'
                              limit 1),
             'next_up',     (select q.position from public.queue_public q
                              where q.chair_id = c.id and q.status = 'WAITING'
                              order by q.position limit 1),
             'waiting',     (select count(*) from public.queue_public q
                              where q.chair_id = c.id and q.status = 'WAITING'),
             'free_at',     (select max(q.estimated_start_at
                                        + make_interval(mins => q.estimated_duration_min))
                               from public.queue_public q
                              where q.chair_id = c.id
                                and q.status in ('WAITING', 'IN_PROGRESS'))
           ) as lane
      from public.chairs c
     where c.shop_id = p_shop_id
       and c.is_active = true
  ) t;

  -- The headline wait is the soonest a walk-in could be seated: the earliest
  -- moment ANY chair frees up, not the average and not the longest.
  select min((lane ->> 'free_at')::timestamptz)
    into v_free
    from jsonb_array_elements(v_lanes) as lane;

  return jsonb_build_object(
    'shop', jsonb_build_object(
      'name',          v_shop.name,
      'is_open',       v_shop.is_open,
      'accepting_new', v_shop.accepting_new,
      'break_until',   v_shop.break_until,
      'break_reason',  v_shop.break_reason
    ),
    'lanes', v_lanes,
    'waiting_total', (
      select count(*) from public.queue_public q
       where q.shop_id = p_shop_id and q.status = 'WAITING'
    ),
    'wait_min', greatest(
      0,
      coalesce(ceil(extract(epoch from (greatest(v_free, now()) - now())) / 60), 0)
    )::int,
    'as_of', now()
  );
end; $$;

grant execute on function public.shop_display_board(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) reviews: the shop's right of reply
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists owner_reply       text,
  add column if not exists owner_replied_at  timestamptz;

comment on column public.reviews.owner_reply is
  'The shop''s public answer. Moderation needs no separate path: a reply lives
   on the review row, so an admin hiding the review hides the reply with it.';

-- An RLS policy can't restrict WHICH columns an update may touch, and the
-- owner has no UPDATE policy on reviews at all today — deliberately, since a
-- shop must never be able to edit the rating or the customer's words. So the
-- reply goes through a function that can only ever write these two columns.
create or replace function public.set_review_reply(
  p_review_id uuid,
  p_reply     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
  v_clean   text;
begin
  select shop_id into v_shop_id from public.reviews where id = p_review_id;
  if v_shop_id is null then
    raise exception 'review not found';
  end if;
  if not public.is_shop_owner(v_shop_id) then
    raise exception 'not your shop';
  end if;

  v_clean := nullif(btrim(coalesce(p_reply, '')), '');
  if v_clean is not null and length(v_clean) > 600 then
    raise exception 'reply_too_long';
  end if;

  update public.reviews
     set owner_reply      = v_clean,
         -- Empty reply = the owner deleted it; clear the timestamp too so the
         -- UI never renders an "answered on…" line with nothing under it.
         owner_replied_at = case when v_clean is null then null else now() end
   where id = p_review_id;
end; $$;

grant execute on function public.set_review_reply(uuid, text) to authenticated;
