-- ফেজ ৬ / Sprint 5.1 (হার্ডেনিং) — অ্যাপয়েন্টমেন্ট টাকার হিসাবে ঢুকল
--
-- ===========================================================================
-- চালানোর ক্রম
-- ===========================================================================
--   1. 20260916_parlour_foundation.sql       ✅
--   2. 20260917_service_categories.sql       ✅
--   3. 20260918_appointment_core.sql         ✅
--   4. 20260919_appointment_availability.sql ✅
--   5. 20260920_appointment_money.sql        ← এই ফাইল
--
-- ===========================================================================
-- কেন এই মাইগ্রেশনটা এত ছোট
-- ===========================================================================
-- সিদ্ধান্ত ২৯ অনুযায়ী Sprint 4-এ appointments-এর টাকার কলামগুলো serials-এর
-- **হুবহু নকল** করে রাখা হয়েছিল — total_amount, payment_status, due_amount,
-- due_collected_at, payment_method। উদ্দেশ্য ছিল ঠিক এই দিনটা: ইনকাম, ক্যাশবুক
-- আর বাকির খাতার বিশুদ্ধ ফাংশনগুলো যেন একই আকৃতির সারি পায়।
--
-- সেই বাজিটা কাজে লেগেছে। তিনটে ফাংশনের যা যা দরকার, সব কলামই ইতিমধ্যে আছে —
-- **দুটো ছাড়া**:
--
--   completed_at      ইনকাম কাজটা কোন *তারিখে* হলো তা দিয়ে গোনে।
--                     appointments-এ ছিল starts_at (নির্ধারিত সময়) আর
--                     updated_at (শেষ যেকোনো পরিবর্তন) — কোনোটাই "কাজটা কখন
--                     সত্যিই শেষ হলো" নয়। starts_at দিয়ে গুনলে দেরিতে বা
--                     আগে শেষ হওয়া কাজের আয় ভুল দিনে বসত।
--
--   due_reminded_at   বাকির খাতা ২৪ ঘণ্টার কুলডাউন এটা দিয়ে মাপে।
--
-- করে না: কোনো সারি মোছে না, বদলায় না, রিসেট করে না। serials / chairs /
--         services / shops / manual_entries / shop_expenses — একটাতেও ALTER
--         নেই। **সেলুনের টাকার কোনো লজিক এই ফাইলে অনুপস্থিত।**
-- ===========================================================================

alter table public.appointments
  add column if not exists completed_at timestamptz,
  add column if not exists due_reminded_at timestamptz;

comment on column public.appointments.completed_at is
  'When the work actually finished — stamped by appointment_before_update on '
  'the move to DONE. This, not starts_at, is the date income counts against.';

comment on column public.appointments.due_reminded_at is
  'Last due reminder sent for this appointment. Mirrors serials.due_reminded_at.';

-- ইনকাম এক বছরের জানালা ধরে পড়ে (getIncomeHistory-র historySince), তাই
-- (shop_id, completed_at)-এ ইনডেক্স।
create index if not exists appointments_completed_idx
  on public.appointments (shop_id, completed_at);

-- বাকির খাতা DONE + DUE সারি খোঁজে।
create index if not exists appointments_due_idx
  on public.appointments (shop_id, payment_status)
  where payment_status = 'DUE';

-- ---------------------------------------------------------------------------
-- আপডেট ট্রিগার — শুধু completed_at স্ট্যাম্প যোগ হলো
-- ---------------------------------------------------------------------------
-- 20260919-এর সংস্করণের সঙ্গে একটাই পার্থক্য: DONE-এ গেলে completed_at বসে।
-- serials-এর BEFORE UPDATE ঠিক এটাই করে (started_at/completed_at স্ট্যাম্প)।
-- বাকি সব — স্ট্যাটাস মেশিন, জমাট কলাম, রিশিডিউল আনলক — অপরিবর্তিত।
create or replace function public.appointment_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rescheduling boolean := coalesce(current_setting('queueflow.reschedule', true), '') = 'on';
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'BOOKED'      and new.status in ('CONFIRMED','IN_PROGRESS','CANCELLED','NO_SHOW')) or
      (old.status = 'CONFIRMED'   and new.status in ('IN_PROGRESS','CANCELLED','NO_SHOW')) or
      (old.status = 'IN_PROGRESS' and new.status in ('DONE','CANCELLED'))
    ) then
      raise exception 'invalid appointment status transition: % -> %', old.status, new.status;
    end if;

    if new.status = 'CANCELLED' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;

    -- Sprint 5.1: কাজ শেষ হওয়ার প্রকৃত সময়। coalesce রাখা হলো যাতে ক্লায়েন্ট
    -- ইচ্ছে করে অন্য সময় পাঠালেও সেটাই থাকে না — একবার বসলে আর বসে না।
    if new.status = 'DONE' then
      new.completed_at := coalesce(old.completed_at, now());
    end if;
  end if;

  new.shop_id           := old.shop_id;
  new.customer_id       := old.customer_id;
  new.service_ids       := old.service_ids;
  new.services_snapshot := old.services_snapshot;
  new.total_amount      := old.total_amount;
  new.booked_at         := old.booked_at;
  new.is_walk_in        := old.is_walk_in;
  new.created_at        := old.created_at;

  -- ইতিহাসের অখণ্ডতা: একবার বসে যাওয়া completed_at আর সরানো যাবে না। এটা
  -- ছাড়া একটা সাধারণ UPDATE দিয়ে গত মাসের আয় এ মাসে টেনে আনা যেত।
  if old.completed_at is not null then
    new.completed_at := old.completed_at;
  end if;

  if not v_rescheduling then
    new.starts_at := old.starts_at;
    new.ends_at   := old.ends_at;
    new.staff_id  := old.staff_id;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- বকেয়া রিমাইন্ডারের কুলডাউন
-- ---------------------------------------------------------------------------
-- serials-এর `send_due_reminder` অ্যাপয়েন্টমেন্ট চেনে না, আর সেটাকে ছোঁয়া
-- হচ্ছে না (সেলুনের পথ অপরিবর্তিত রাখাই এই স্প্রিন্টের শর্ত)। তাই
-- অ্যাপয়েন্টমেন্টের নিজের একটা — একই ২৪ ঘণ্টার নিয়ম, একই বার্তার ধাঁচ।
create or replace function public.send_appointment_due_reminder(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.appointments%rowtype;
  v_shop text;
begin
  select * into a from public.appointments where id = p_appointment_id;
  if a.id is null then
    raise exception 'appointment_not_found';
  end if;

  -- মালিক ছাড়া কেউ পাঠাতে পারবে না। ফাংশনটা DEFINER, তাই চেকটা এখানে
  -- হাতে করতে হয় — RLS নিজে থেকে আটকাবে না।
  if not public.is_shop_owner(a.shop_id) then
    raise exception 'not your shop';
  end if;

  if a.payment_status <> 'DUE' or coalesce(a.due_amount, 0) <= 0 then
    raise exception 'এই অ্যাপয়েন্টমেন্টে বাকি নেই';
  end if;

  if a.due_reminded_at is not null and a.due_reminded_at > now() - interval '24 hours' then
    raise exception 'আজকে একবার রিমাইন্ডার পাঠানো হয়ে গেছে';
  end if;

  if a.customer_id is null then
    raise exception 'এই কাস্টমারের অ্যাকাউন্ট নেই';
  end if;

  update public.appointments set due_reminded_at = now() where id = p_appointment_id;

  if public.notification_enabled(a.customer_id, 'REMINDER') then
    select name into v_shop from public.shops where id = a.shop_id;
    insert into public.notifications (user_id, type, title, body, data)
    values (
      a.customer_id,
      'REMINDER',
      'বাকি টাকার কথা',
      coalesce(v_shop, 'পার্লার') || '-এ ৳' || trim(to_char(a.due_amount, 'FM999999990.00'))
        || ' বাকি আছে।',
      jsonb_build_object('shop_id', a.shop_id, 'appointment_id', a.id, 'due', a.due_amount)
    );
  end if;
end;
$$;

comment on function public.send_appointment_due_reminder(uuid) is
  'Owner-only due reminder for one appointment. Same 24h cooldown as the '
  'queue''s send_due_reminder; kept separate so the salon path is untouched.';


-- ===========================================================================
-- যাচাই — মাইগ্রেশনের পর আনকমেন্ট করে চালাও। সব ok = true হওয়া চাই।
-- ===========================================================================
--
-- select * from (values
--   ('completed_at column exists',
--    exists (select 1 from information_schema.columns
--             where table_schema='public' and table_name='appointments'
--               and column_name='completed_at')),
--   ('due_reminded_at column exists',
--    exists (select 1 from information_schema.columns
--             where table_schema='public' and table_name='appointments'
--               and column_name='due_reminded_at')),
--   ('income index exists',
--    exists (select 1 from pg_indexes where indexname='appointments_completed_idx')),
--   ('due index exists',
--    exists (select 1 from pg_indexes where indexname='appointments_due_idx')),
--   ('due reminder RPC exists',
--    to_regprocedure('public.send_appointment_due_reminder(uuid)') is not null),
--
--   -- আগের স্প্রিন্টগুলো অক্ষত
--   ('overlap constraint still there',
--    exists (select 1 from pg_constraint where conname='appointments_no_overlap')),
--   ('reschedule history trigger still there',
--    exists (select 1 from pg_trigger where tgname='appointments_after_update')),
--   ('5 appointment policies still there',
--    (select count(*) from pg_policies where tablename='appointments')=5),
--
--   -- সেলুন অস্পর্শিত
--   ('serials table untouched', to_regclass('public.serials') is not null),
--   ('serials.completed_at still there',
--    exists (select 1 from information_schema.columns
--             where table_schema='public' and table_name='serials'
--               and column_name='completed_at')),
--   ('queue due reminder still there',
--    to_regprocedure('public.send_due_reminder(uuid)') is not null),
--
--   -- কোনো সারি হারায়নি, আর পুরনো কোনো অ্যাপয়েন্টমেন্টে হাত পড়েনি
--   ('no appointment was retro-stamped',
--    not exists (select 1 from public.appointments
--                 where status <> 'DONE' and completed_at is not null))
-- ) as t(check_name, ok) order by ok, check_name;
--
--
-- ---------------------------------------------------------------------------
-- আচরণগত প্রোব — ROLLBACK করে, কোনো সারি থাকে না
-- ---------------------------------------------------------------------------
-- ১) DONE করলে completed_at বসে, আর দ্বিতীয়বার UPDATE-এ সরে না
--
-- begin;
--   with shop as (select id from public.shops where business_type='PARLOUR' and status='ACTIVE' limit 1),
--        st   as (select c.id from public.chairs c join shop on c.shop_id=shop.id where c.is_active limit 1),
--        sv   as (select s.id from public.services s join shop on s.shop_id=shop.id where s.is_active limit 1),
--        ins  as (
--          insert into public.appointments (shop_id, staff_id, service_ids, starts_at, ends_at, is_walk_in, customer_name)
--          select shop.id, st.id, array[sv.id],
--                 now() + interval '1 day', now() + interval '1 day 1 hour', true, 'money probe'
--          from shop, st, sv returning id
--        )
--   select id from ins;
--   -- উপরের id নিয়ে:
--   -- update public.appointments set status='IN_PROGRESS' where id = '<id>';
--   -- update public.appointments set status='DONE', payment_status='PAID', payment_method='cash', due_amount=0 where id = '<id>';
--   -- select completed_at is not null as stamped from public.appointments where id = '<id>';   -- t
--   -- update public.appointments set completed_at = now() - interval '40 days' where id = '<id>';
--   -- select completed_at > now() - interval '1 hour' as still_today from public.appointments where id = '<id>';  -- t (সরেনি)
-- rollback;
--
--
-- ২) বাকির রিমাইন্ডার কুলডাউন — দ্বিতীয়বার **ব্যর্থ হওয়ার কথা**
--    (এটা অ্যাপ থেকে মালিক হিসেবে লগইন করে যাচাই করতে হবে; SQL এডিটর
--     service_role-এ চলে, তাই is_shop_owner() ওখানে false দেবে।)
