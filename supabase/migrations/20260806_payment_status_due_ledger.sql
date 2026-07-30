-- Sprint 8: payment status (PAID/DUE/ADVANCE) + বাকির খাতা (due ledger)
-- Run this once in the Supabase dashboard's SQL editor (Project → SQL Editor → New query),
-- paste, run. Safe to run once; re-running will error on existing objects (harmless).

-- ---------------------------------------------------------------------------
-- serials: payment_status starts life as 'DUE' (nothing collected yet) for
-- every new booking, flips to 'ADVANCE' when the existing mock-gateway
-- advance flow runs, and is finally resolved to 'PAID' or 'DUE' at
-- completion time (provider's "✓ কাজ সম্পন্ন" vs "বাকি রেখে সম্পন্ন করো").
-- ---------------------------------------------------------------------------
alter table public.serials
  add column payment_status text not null default 'DUE'
    check (payment_status in ('PAID', 'DUE', 'ADVANCE')),
  add column due_amount numeric not null default 0,
  add column due_collected_at timestamptz,
  add column due_reminded_at timestamptz;

-- Backfill: every already-completed serial predates this feature and was,
-- under the old model, always treated as fully collected cash revenue
-- (income/analytics summed every DONE row unconditionally) — preserve that,
-- or income history would suddenly zero out for all historical data.
--
-- The trigger is disabled for this one bulk UPDATE: notify_serial_event
-- fires AFTER UPDATE on every touched row and, for each one, re-scans other
-- still-WAITING rows on the same shop/chair to fire queue notifications —
-- entirely unrelated to a payment_status backfill, and it inserts straight
-- into notifications keyed by that other row's customer_id with no
-- existence check. At least one shop/chair pair has a WAITING row left
-- over from a since-deleted test auth account, so leaving the trigger on
-- here aborts the whole migration with a foreign-key violation.
alter table public.serials disable trigger notify_serial_event_trigger;
update public.serials set payment_status = 'PAID' where status = 'DONE';
alter table public.serials enable trigger notify_serial_event_trigger;

-- Provider due-ledger screen's hot path: shop's DONE+DUE rows.
create index serials_due_lookup_idx on public.serials (shop_id, payment_status)
  where status = 'DONE';

-- ---------------------------------------------------------------------------
-- send_due_reminder: provider's "বাকি রিমাইন্ডার" button on a specific due
-- serial. Thin client, smart DB — same reasoning as the other notification
-- RPCs in 20260729_notifications.sql: there's no client-facing INSERT
-- policy on `notifications`, so this is the only way to deliver one.
-- Rate-limited to once per day per serial so repeated taps can't spam.
-- ---------------------------------------------------------------------------
create or replace function public.send_due_reminder(p_serial_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serial public.serials;
begin
  select s.* into v_serial
  from public.serials s
  join public.shops sh on sh.id = s.shop_id
  where s.id = p_serial_id and sh.owner_id = auth.uid()
  for update of s;

  if not found then
    raise exception 'এই দোকানের সিরিয়াল না';
  end if;

  if v_serial.payment_status <> 'DUE' then
    raise exception 'এই সিরিয়ালে বাকি নেই';
  end if;

  if v_serial.customer_id is null
     or not exists (select 1 from auth.users u where u.id = v_serial.customer_id) then
    raise exception 'এই কাস্টমারকে রিমাইন্ডার পাঠানো যাবে না';
  end if;

  if v_serial.due_reminded_at is not null and v_serial.due_reminded_at > now() - interval '1 day' then
    raise exception 'আজকে একবার রিমাইন্ডার পাঠানো হয়ে গেছে';
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_serial.customer_id,
    'REMINDER',
    'তোমার একটা বাকি আছে',
    '৳' || trim(to_char(v_serial.due_amount, 'FM999999999')) || ' বাকি আছে — সুবিধামতো পরিশোধ করে দিও।',
    jsonb_build_object('serial_id', v_serial.id, 'shop_id', v_serial.shop_id)
  );

  update public.serials set due_reminded_at = now() where id = v_serial.id;
end;
$$;

-- SECURITY DEFINER doesn't imply callable — this project revokes the default
-- PUBLIC execute grant, so it must be granted explicitly (see the identical
-- comment on broadcast_shop_notification in 20260729_notifications.sql).
grant execute on function public.send_due_reminder(uuid) to authenticated;
