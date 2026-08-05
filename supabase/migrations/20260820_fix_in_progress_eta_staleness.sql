-- Sprint 21: fix stale wait-time shown to customers for IN_PROGRESS serials.
--
-- Root cause: recalc_queue_estimates() computes cursor_time for an
-- IN_PROGRESS row (started_at + duration) but never writes it back to
-- serials.estimated_start_at — only the WAITING branch does. So once a
-- serial transitions to IN_PROGRESS, its estimated_start_at stays frozen at
-- whatever it was while still queued. queue_public (what customers' map/shop
-- detail read) syncs that stale value, and chairFreeAtMs() in
-- src/lib/queue-wait.ts computes freeAt = estimated_start_at + duration,
-- which can already be in the past — minutesUntil() clamps negatives to 0,
-- showing "~0 min" even while the job (and others behind it) are genuinely
-- still running. The provider board is unaffected — NowServingCard reads
-- started_at directly, not estimated_start_at.
--
-- Fix: for an IN_PROGRESS row, estimated_start_at is a known fact
-- (started_at), not an estimate — write it through so estimated_start_at +
-- estimated_duration_min matches the existing client-side formula. No
-- client code changes needed. Full function body reproduced (only the new
-- `update` line inside the IN_PROGRESS branch is new).
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query).

CREATE OR REPLACE FUNCTION public.recalc_queue_estimates(p_chair_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r            record;
  cursor_time  timestamptz := now();
begin
  for r in
    select id, status, estimated_duration_min, started_at
    from public.serials
    where chair_id = p_chair_id
      and status in ('IN_PROGRESS', 'WAITING')
    order by position
  loop
    if r.status = 'IN_PROGRESS' then
      update public.serials
         set estimated_start_at = coalesce(r.started_at, now())
       where id = r.id;
      cursor_time := greatest(
        coalesce(r.started_at, now())
          + make_interval(mins => r.estimated_duration_min),
        now() + interval '1 minute');
    else
      update public.serials
         set estimated_start_at = cursor_time
       where id = r.id;
      cursor_time := cursor_time + make_interval(mins => r.estimated_duration_min);
    end if;
  end loop;
end; $function$;
