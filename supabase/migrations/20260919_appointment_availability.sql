-- ফেজ ৬ / Sprint 5 — অ্যাপয়েন্টমেন্ট অ্যাভেইলেবিলিটি ও লাইফসাইকেল
--
-- ===========================================================================
-- চালানোর ক্রম
-- ===========================================================================
--   1. 20260916_parlour_foundation.sql    ✅
--   2. 20260917_service_categories.sql    ✅
--   3. 20260918_appointment_core.sql      ✅
--   4. 20260919_appointment_availability.sql   ← এই ফাইল
--
-- ===========================================================================
-- কী করে / কী করে না
-- ===========================================================================
-- করে:  ৩টা নতুন টেবিল (staff_working_hours, staff_time_off,
--        appointment_reschedules), তাদের RLS, একটা হেল্পার ফাংশন,
--        ২টা নতুন RPC, আর বিদ্যমান ২টা ফাংশন `create or replace`।
--
-- করে না: কোনো সারি মোছে না, রিসেট করে না। `appointments`-এ কোনো কলাম ড্রপ
--         বা টাইপ পরিবর্তন নেই। serials / chairs / services / shops-এ
--         একটাও ALTER নেই — কিউ ইঞ্জিন এই ফাইলে অনুপস্থিত।
--
-- একটাই লেখা: প্রতিটা বিদ্যমান chair-এর জন্য staff_working_hours সিড করা হয়,
-- দোকানের নিজের সময় থেকে (নিচে "সিডিং" দেখো)। এতে **আচরণ অপরিবর্তিত থাকে** —
-- আজ যে স্লট পাওয়া যেত, কাল সেটাই পাওয়া যাবে।
--
-- সবটাই পুনরায় চালানো নিরাপদ।
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- ০) হেল্পার — এই চেয়ারটা কি আমার দোকানের?
-- ---------------------------------------------------------------------------
-- is_shop_owner()-এর ঠিক সমতুল্য, এক ধাপ ঘুরে। staff_working_hours আর
-- staff_time_off-এ shop_id কলাম নেই (চেয়ার থেকেই জানা যায়), তাই তাদের RLS-এর
-- জন্য এটা লাগে। SECURITY DEFINER + প্যারামিটারাইজড, ইনজেকশনের সুযোগ নেই।
create or replace function public.is_chair_owner(p_chair_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select exists (
    select 1
      from public.chairs c
      join public.shops s on s.id = c.shop_id
     where c.id = p_chair_id and s.owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- ১) প্রতি-স্টাফ কর্মঘণ্টা
-- ---------------------------------------------------------------------------
-- weekday = isodow: ১ = সোমবার … ৭ = রবিবার। পুরো ফেজ ৬-এ এই একটাই ম্যাপিং
-- (weekly_hours-এর mon..sun ক্রমের সঙ্গেও মেলে)।
--
-- **সারি না থাকা মানে ওই দিন কাজ করে না** — দোকানের সময় ধরে নেওয়া হয় না।
-- এটাই সিদ্ধান্ত ৪৬-এর মূল কথা: একজন বিউটিশিয়ান দোকানে আছে বলেই দোকানের
-- পুরো সময় জুড়ে তাকে বেচে দেওয়া যায় না। নিচের সিডিং এটাকে নিরাপদ করে।
create table if not exists public.staff_working_hours (
  chair_id uuid not null references public.chairs(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (chair_id, weekday),
  constraint staff_hours_order check (end_time > start_time)
);

comment on table public.staff_working_hours is
  'Per-beautician weekly schedule. A missing (chair, weekday) row means that '
  'person does not work that day — shop hours are never assumed for them. '
  'weekday is isodow: 1 = Monday .. 7 = Sunday.';

create index if not exists staff_hours_chair_idx
  on public.staff_working_hours (chair_id);

alter table public.staff_working_hours enable row level security;

-- মালিক ছাড়া কেউ পড়ে না। কাস্টমারের এটা পড়ার দরকার নেই — সে খালি স্লট দেখে,
-- আর সেটা shop_available_slots() (DEFINER) হিসাব করে দেয়।
drop policy if exists "staff hours: owner read" on public.staff_working_hours;
create policy "staff hours: owner read" on public.staff_working_hours
  for select using (public.is_chair_owner(chair_id));

drop policy if exists "staff hours: owner insert" on public.staff_working_hours;
create policy "staff hours: owner insert" on public.staff_working_hours
  for insert with check (public.is_chair_owner(chair_id));

drop policy if exists "staff hours: owner update" on public.staff_working_hours;
create policy "staff hours: owner update" on public.staff_working_hours
  for update using (public.is_chair_owner(chair_id))
  with check (public.is_chair_owner(chair_id));

drop policy if exists "staff hours: owner delete" on public.staff_working_hours;
create policy "staff hours: owner delete" on public.staff_working_hours
  for delete using (public.is_chair_owner(chair_id));

-- ---------------------------------------------------------------------------
-- সিডিং — কেন এটা ছাড়া মাইগ্রেশনটা ধ্বংসাত্মক হতো
-- ---------------------------------------------------------------------------
-- "সারি নেই = কাজ করে না" নিয়মটা আজ চালু করলে, আজ পর্যন্ত যোগ হওয়া প্রতিটা
-- বিউটিশিয়ান রাতারাতি অদৃশ্য হয়ে যেত এবং কোনো পার্লার আর বুকিং নিতে পারত না।
-- তাই প্রত্যেকের জন্য দোকানের নিজের সময় থেকে সারি বসিয়ে দেওয়া হচ্ছে — এরপর
-- মালিক ইচ্ছেমতো সংকুচিত করবেন।
--
-- `on conflict do nothing`: মালিক আগেই কারো সময় ঠিক করে থাকলে সেটা অক্ষত থাকে,
-- তাই ফাইলটা বারবার চালানো নিরাপদ।
insert into public.staff_working_hours (chair_id, weekday, start_time, end_time)
select
  c.id,
  d.weekday,
  (s.weekly_hours -> d.key ->> 'open')::time,
  (s.weekly_hours -> d.key ->> 'close')::time
from public.chairs c
join public.shops s on s.id = c.shop_id
cross join (values
  (1,'mon'),(2,'tue'),(3,'wed'),(4,'thu'),(5,'fri'),(6,'sat'),(7,'sun')
) as d(weekday, key)
where s.weekly_hours is not null
  and jsonb_typeof(s.weekly_hours -> d.key) = 'object'
  and coalesce((s.weekly_hours -> d.key ->> 'closed')::boolean, false) = false
  and nullif(s.weekly_hours -> d.key ->> 'open', '') is not null
  and nullif(s.weekly_hours -> d.key ->> 'close', '') is not null
  and (s.weekly_hours -> d.key ->> 'close')::time
      > (s.weekly_hours -> d.key ->> 'open')::time
on conflict (chair_id, weekday) do nothing;

-- একই যুক্তিতে নতুন চেয়ারও দোকানের সময় নিয়ে শুরু করে। এটা "স্বয়ংক্রিয়ভাবে
-- দোকানের সময় ধরে নেওয়া" নয় — সারিগুলো আসল, সম্পাদনযোগ্য ডেটা; শুধু শুরুর
-- মানটা যুক্তিসঙ্গত, যাতে নতুন বিউটিশিয়ান নীরবে অবুকযোগ্য হয়ে না থাকে।
create or replace function public.seed_staff_hours_for_new_chair()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff_working_hours (chair_id, weekday, start_time, end_time)
  select
    new.id, d.weekday,
    (s.weekly_hours -> d.key ->> 'open')::time,
    (s.weekly_hours -> d.key ->> 'close')::time
  from public.shops s
  cross join (values
    (1,'mon'),(2,'tue'),(3,'wed'),(4,'thu'),(5,'fri'),(6,'sat'),(7,'sun')
  ) as d(weekday, key)
  where s.id = new.shop_id
    and s.weekly_hours is not null
    and jsonb_typeof(s.weekly_hours -> d.key) = 'object'
    and coalesce((s.weekly_hours -> d.key ->> 'closed')::boolean, false) = false
    and nullif(s.weekly_hours -> d.key ->> 'open', '') is not null
    and nullif(s.weekly_hours -> d.key ->> 'close', '') is not null
    and (s.weekly_hours -> d.key ->> 'close')::time
        > (s.weekly_hours -> d.key ->> 'open')::time
  on conflict (chair_id, weekday) do nothing;
  return new;
end;
$$;

drop trigger if exists chairs_seed_staff_hours on public.chairs;
create trigger chairs_seed_staff_hours
  after insert on public.chairs
  for each row execute function public.seed_staff_hours_for_new_chair();

-- ---------------------------------------------------------------------------
-- ২) ছুটি
-- ---------------------------------------------------------------------------
-- একটা সময়ের পরিসর, তাই পুরো দিন আর দিনের একটা অংশ — দুটোই একই আকৃতিতে ধরা
-- যায়। আলাদা `is_full_day` পতাকা রাখা হয়নি: "০০:০০ থেকে ২৪:০০" আর "পুরো দিন"
-- একই কথা, আর দুটো উপস্থাপনা থাকলে সেগুলো একদিন দ্বিমত করত।
create table if not exists public.staff_time_off (
  id uuid primary key default gen_random_uuid(),
  chair_id uuid not null references public.chairs(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint time_off_order check (ends_at > starts_at)
);

comment on table public.staff_time_off is
  'A period one beautician is unavailable. Full-day leave is just a range '
  'covering the day; there is deliberately no separate all-day flag.';

create index if not exists staff_time_off_chair_idx
  on public.staff_time_off (chair_id, starts_at);

-- একই ব্যক্তির দুটো ছুটি ওভারল্যাপ করার কোনো অর্থ নেই, আর ওভারল্যাপিং সারি
-- থাকলে "কতদিন ছুটি" ধরনের যেকোনো হিসাব ভুল হতো।
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'staff_time_off_no_overlap') then
    alter table public.staff_time_off
      add constraint staff_time_off_no_overlap
      exclude using gist (
        chair_id with =,
        tstzrange(starts_at, ends_at) with &&
      );
  end if;
end $$;

alter table public.staff_time_off enable row level security;

drop policy if exists "time off: owner read" on public.staff_time_off;
create policy "time off: owner read" on public.staff_time_off
  for select using (public.is_chair_owner(chair_id));

-- এখানেই "অন্য দোকানের স্টাফের জন্য ছুটি বানানো যাবে না" শর্তটা বসে।
drop policy if exists "time off: owner insert" on public.staff_time_off;
create policy "time off: owner insert" on public.staff_time_off
  for insert with check (public.is_chair_owner(chair_id));

drop policy if exists "time off: owner update" on public.staff_time_off;
create policy "time off: owner update" on public.staff_time_off
  for update using (public.is_chair_owner(chair_id))
  with check (public.is_chair_owner(chair_id));

drop policy if exists "time off: owner delete" on public.staff_time_off;
create policy "time off: owner delete" on public.staff_time_off
  for delete using (public.is_chair_owner(chair_id));

-- ---------------------------------------------------------------------------
-- ৩) রিশিডিউলের ইতিহাস
-- ---------------------------------------------------------------------------
-- সিদ্ধান্ত ৪৭: অ্যাপয়েন্টমেন্টের সারিটাই থাকে, id বদলায় না — কিন্তু প্রতিটা
-- সরানোর আগের-পরের অবস্থা এখানে লেখা থাকে, তাই ইতিহাস হারায় না।
create table if not exists public.appointment_reschedules (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  from_starts_at timestamptz not null,
  from_ends_at timestamptz not null,
  from_staff_id uuid not null,
  to_starts_at timestamptz not null,
  to_ends_at timestamptz not null,
  to_staff_id uuid not null,
  moved_by uuid references public.profiles(id) on delete set null,
  moved_at timestamptz not null default now(),
  reason text
);

create index if not exists appointment_reschedules_appt_idx
  on public.appointment_reschedules (appointment_id, moved_at desc);

alter table public.appointment_reschedules enable row level security;

-- অ্যাপয়েন্টমেন্টটা যে দেখতে পায়, সে তার ইতিহাসও দেখতে পায় — এক পয়সা বেশি নয়।
drop policy if exists "reschedules: same as the appointment" on public.appointment_reschedules;
create policy "reschedules: same as the appointment" on public.appointment_reschedules
  for select using (
    exists (
      select 1 from public.appointments a
       where a.id = appointment_id
         and (a.customer_id = auth.uid() or public.is_shop_owner(a.shop_id))
    )
  );

-- INSERT/UPDATE/DELETE-এর কোনো পলিসি নেই। সারিটা লেখে নিচের AFTER UPDATE
-- ট্রিগার, যেটা SECURITY DEFINER — অর্থাৎ ইতিহাস লেখা হয় **যে ঘটনাটা সময়
-- বদলায় ঠিক তার সঙ্গে**, আলাদা কোনো ধাপে নয়। ফলে ইতিহাস বাদ পড়া বা ভুল হওয়া
-- অসম্ভব, আর হাতে বানানো সারিও ঢোকানো যায় না।

-- ---------------------------------------------------------------------------
-- ৪) একজন স্টাফ একটা নির্দিষ্ট সময়ে কাজ করে কিনা
-- ---------------------------------------------------------------------------
-- একটাই জায়গা, যাতে ইনসার্ট ট্রিগার, রিশিডিউল আর স্লট RPC তিনজনেই **হুবহু এক**
-- নিয়ম মানে। তিন জায়গায় তিনবার লিখলে একদিন তারা দ্বিমত করত, আর তখন UI বলত
-- "খালি" যেখানে DB বলত "না"।
create or replace function public.staff_is_available(
  p_chair_id  uuid,
  p_starts_at timestamptz,
  p_ends_at   timestamptz
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz     text;
  v_shop   uuid;
  v_local  timestamp;
  v_dow    int;
  v_day    text;
  v_dh     jsonb;
  v_open   time;
  v_close  time;
  v_ws     time;
  v_we     time;
  v_from   timestamptz;
  v_to     timestamptz;
begin
  select shop_id into v_shop from public.chairs
   where id = p_chair_id and is_active = true;
  if v_shop is null then
    return 'staff_inactive';
  end if;

  v_tz    := public.shop_timezone(v_shop);
  v_local := p_starts_at at time zone v_tz;
  v_dow   := extract(isodow from v_local)::int;
  v_day   := (array['mon','tue','wed','thu','fri','sat','sun'])[v_dow];

  -- ক) দোকান সেদিন খোলা?
  select weekly_hours -> v_day into v_dh from public.shops where id = v_shop;
  if v_dh is not null and jsonb_typeof(v_dh) = 'object' then
    if coalesce((v_dh ->> 'closed')::boolean, false) then
      return 'shop_closed_that_day';
    end if;
    v_open  := nullif(v_dh ->> 'open', '')::time;
    v_close := nullif(v_dh ->> 'close', '')::time;
  end if;

  -- খ) স্টাফ সেদিন কাজ করে?
  select start_time, end_time into v_ws, v_we
    from public.staff_working_hours
   where chair_id = p_chair_id and weekday = v_dow;
  if v_ws is null then
    return 'staff_not_working_that_day';
  end if;

  -- গ) দুটোর ছেদ — দোকানের সময় জানা থাকলে সেটাই বাইরের সীমা
  if v_open is not null and v_close is not null and v_close > v_open then
    v_ws := greatest(v_ws, v_open);
    v_we := least(v_we, v_close);
    if v_we <= v_ws then
      return 'staff_not_working_that_day';
    end if;
  end if;

  v_from := (v_local::date + v_ws) at time zone v_tz;
  v_to   := (v_local::date + v_we) at time zone v_tz;
  if p_starts_at < v_from or p_ends_at > v_to then
    return 'outside_working_hours';
  end if;

  -- ঘ) ছুটি?
  if exists (
    select 1 from public.staff_time_off t
     where t.chair_id = p_chair_id
       and tstzrange(t.starts_at, t.ends_at) && tstzrange(p_starts_at, p_ends_at)
  ) then
    return 'staff_on_leave';
  end if;

  return 'ok';
end;
$$;

comment on function public.staff_is_available(uuid, timestamptz, timestamptz) is
  'The single availability rule: shop hours ∩ staff hours, minus time off. '
  'Returns ''ok'' or the reason it is not. Existing appointments are NOT '
  'checked here — the exclusion constraint owns that (decision 43).';

-- ---------------------------------------------------------------------------
-- ৫) ইনসার্ট ট্রিগার — এখন স্টাফের নিজের সময়ও দেখে
-- ---------------------------------------------------------------------------
-- 20260918-এর সংস্করণ শুধু দোকানের সময় দেখত। বাকিটা হুবহু আগের মতো।
create or replace function public.appointment_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count    integer;
  v_duration integer;
  v_verdict  text;
begin
  if not exists (
    select 1 from public.shops where id = new.shop_id and status = 'ACTIVE'
  ) then
    raise exception 'shop is not active';
  end if;

  if new.starts_at <= now() then
    raise exception 'appointment_in_past';
  end if;

  select count(*) into v_count
    from public.services
   where id = any (new.service_ids)
     and shop_id = new.shop_id
     and is_active = true;
  if v_count <> cardinality(new.service_ids) then
    raise exception 'invalid service selection for this shop';
  end if;

  if not exists (
    select 1 from public.chairs
     where id = new.staff_id and shop_id = new.shop_id and is_active = true
  ) then
    raise exception 'staff does not belong to this shop or is inactive';
  end if;

  if exists (
    select 1 from unnest(new.service_ids) as sid
     where exists (
       select 1 from public.chair_service_stats css
        where css.chair_id = new.staff_id
          and css.service_id = sid
          and css.can_perform = false)
  ) then
    raise exception 'selected staff cannot perform all requested services';
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'service_id',             s.id,
      'name',                   s.name,
      'rate',                   s.rate,
      'estimated_duration_min', s.default_duration_min
    ) order by s.created_at), '[]'::jsonb),
    coalesce(sum(s.rate), 0),
    coalesce(sum(s.default_duration_min), 0)
  into new.services_snapshot, new.total_amount, v_duration
  from unnest(new.service_ids) as sid
  join public.services s on s.id = sid;

  if v_duration < 1 then
    raise exception 'invalid service duration';
  end if;

  new.ends_at := new.starts_at + make_interval(mins => v_duration);

  -- Sprint 5: দোকানের সময়, স্টাফের সময় আর ছুটি — তিনটেই একটা ফাংশনে।
  v_verdict := public.staff_is_available(new.staff_id, new.starts_at, new.ends_at);
  if v_verdict <> 'ok' then
    raise exception '%', v_verdict;
  end if;

  new.status     := 'BOOKED';
  new.booked_at  := now();
  new.due_amount := new.total_amount;

  if new.is_walk_in = false and new.customer_id is not null then
    select coalesce(full_name, ''), phone, avatar_url
      into new.customer_name, new.customer_phone, new.customer_avatar_url
      from public.profiles where id = new.customer_id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- ৬) আপডেট ট্রিগার — সময় বদলানোর একটাই দরজা
-- ---------------------------------------------------------------------------
-- 20260918-এ starts_at/ends_at/staff_id একেবারে জমাট ছিল। এখন সেগুলো বদলানো
-- যায়, কিন্তু **শুধু reschedule_appointment()-এর ভেতর থেকে**, যে একটা সেশন
-- ফ্ল্যাগ তুলে দেয়। প্যাটার্নটা এই প্রজেক্টেরই — 20260904-এর
-- `queueflow.stats_write` ঠিক এভাবে চেয়ার-স্ট্যাটের সুরক্ষা খোলে।
--
-- অর্থাৎ সাধারণ UPDATE দিয়ে কেউ সময় সরাতে পারবে না, আর ইতিহাসের সারি না লিখে
-- সরানোর কোনো পথও থাকল না।
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
  end if;

  new.shop_id           := old.shop_id;
  new.customer_id       := old.customer_id;
  new.service_ids       := old.service_ids;
  new.services_snapshot := old.services_snapshot;
  new.total_amount      := old.total_amount;
  new.booked_at         := old.booked_at;
  new.is_walk_in        := old.is_walk_in;
  new.created_at        := old.created_at;

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
-- ৬খ) ইতিহাস লেখে ট্রিগার, RPC নয়
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, তাই appointment_reschedules-এ কোনো INSERT পলিসি না রেখেই
-- সারিটা লেখা যায়। শর্তটা লক্ষ করো: সময় বা স্টাফ সত্যিই বদলালে তবেই লেখে —
-- অর্থাৎ যে UPDATE কিছু সরায়নি, সে ইতিহাসে দাগ ফেলে না।
create or replace function public.appointment_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.staff_id is distinct from old.staff_id
  then
    insert into public.appointment_reschedules (
      appointment_id, from_starts_at, from_ends_at, from_staff_id,
      to_starts_at, to_ends_at, to_staff_id, moved_by, reason
    ) values (
      new.id, old.starts_at, old.ends_at, old.staff_id,
      new.starts_at, new.ends_at, new.staff_id, auth.uid(),
      nullif(current_setting('queueflow.reschedule_reason', true), '')
    );
  end if;
  return null;
end;
$$;

drop trigger if exists appointments_after_update on public.appointments;
create trigger appointments_after_update
  after update on public.appointments
  for each row execute function public.appointment_after_update();

-- ---------------------------------------------------------------------------
-- ৭) RPC — রিশিডিউল
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER (ডিফল্ট), সিদ্ধান্ত ৪৪-এর একই কারণে: UPDATE কল করা ব্যক্তির
-- অধিকারে হয়, তাই `appointments`-এর RLS পলিসিই ঠিক করে কে সরাতে পারে।
--
-- কাস্টমারের UPDATE পলিসি শুধু CANCELLED-এ নামা মানে, তাই কাস্টমার নিজে
-- রিশিডিউল করতে পারে না — মালিক পারেন। ইচ্ছাকৃত: সময় বদলানো দোকানের
-- সিদ্ধান্ত, আর কাস্টমারের হাতে বাতিল করে নতুন বুকিংয়ের পথ খোলাই আছে।
create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_starts_at      timestamptz,
  p_staff_id       uuid default null,
  p_reason         text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  a          public.appointments%rowtype;
  v_staff    uuid;
  v_duration integer;
  v_ends     timestamptz;
  v_verdict  text;
begin
  -- RLS প্রযোজ্য: দেখতে না পেলে এখানেই শেষ।
  select * into a from public.appointments where id = p_appointment_id;
  if a.id is null then
    raise exception 'appointment_not_found';
  end if;

  -- শেষ হয়ে যাওয়া কিছু সরানো যায় না। স্ট্যাটাস মেশিনের সঙ্গে সঙ্গতিপূর্ণ:
  -- CANCELLED/DONE/NO_SHOW চূড়ান্ত, আর চূড়ান্ত জিনিসের ভবিষ্যৎ নেই।
  if a.status not in ('BOOKED', 'CONFIRMED') then
    raise exception 'appointment_not_reschedulable';
  end if;

  v_staff := coalesce(p_staff_id, a.staff_id);

  -- অন্য দোকানের স্টাফের কাছে সরানো যাবে না।
  if not exists (
    select 1 from public.chairs
     where id = v_staff and shop_id = a.shop_id and is_active = true
  ) then
    raise exception 'staff does not belong to this shop or is inactive';
  end if;

  if exists (
    select 1 from unnest(a.service_ids) as sid
     where exists (
       select 1 from public.chair_service_stats css
        where css.chair_id = v_staff and css.service_id = sid and css.can_perform = false)
  ) then
    raise exception 'selected staff cannot perform all requested services';
  end if;

  if p_starts_at <= now() then
    raise exception 'appointment_in_past';
  end if;

  -- দৈর্ঘ্য আসে **বুকিংয়ের স্ন্যাপশট** থেকে, services থেকে নয় (সিদ্ধান্ত ৪২):
  -- সরানোর সময় রেট বা সময় বদলে গেলে গ্রাহকের সঙ্গে করা চুক্তিটাই বদলে যেত।
  select coalesce(sum((e ->> 'estimated_duration_min')::int), 0)
    into v_duration
    from jsonb_array_elements(a.services_snapshot) as e;
  if v_duration < 1 then
    v_duration := greatest(1, (extract(epoch from (a.ends_at - a.starts_at)) / 60)::int);
  end if;
  v_ends := p_starts_at + make_interval(mins => v_duration);

  v_verdict := public.staff_is_available(v_staff, p_starts_at, v_ends);
  if v_verdict <> 'ok' then
    raise exception '%', v_verdict;
  end if;

  -- ওভারল্যাপ এখানেও প্রি-চেক করা হচ্ছে **না**। UPDATE-এর সময় EXCLUDE
  -- কনস্ট্রেইন্ট নিজেই সিদ্ধান্ত নেবে — ইনসার্টে যে কারণে, ঠিক সেই কারণে।
  -- ইতিহাসের সারিটা AFTER UPDATE ট্রিগার লেখে; কারণটা তার কাছে সেশন সেটিং
  -- দিয়ে পৌঁছয়, ঠিক যেভাবে আনলক ফ্ল্যাগটা যায়।
  begin
    perform set_config('queueflow.reschedule', 'on', true);
    perform set_config('queueflow.reschedule_reason', coalesce(p_reason, ''), true);
    update public.appointments
       set starts_at = p_starts_at, ends_at = v_ends, staff_id = v_staff
     where id = p_appointment_id;
    perform set_config('queueflow.reschedule', 'off', true);
    perform set_config('queueflow.reschedule_reason', '', true);
  exception
    when exclusion_violation then
      perform set_config('queueflow.reschedule', 'off', true);
      perform set_config('queueflow.reschedule_reason', '', true);
      raise exception 'slot_taken';
  end;

  return p_appointment_id;
end;
$$;

comment on function public.reschedule_appointment is
  'Moves an appointment and records the move. SECURITY INVOKER so the '
  'appointments RLS decides who may. Overlap is still the exclusion '
  'constraint''s call, never a pre-check.';

-- ---------------------------------------------------------------------------
-- ৮) RPC — খালি স্লট, এখন প্রতি-স্টাফ সময় ও ছুটি সহ
-- ---------------------------------------------------------------------------
-- প্রতিটা স্টাফের নিজের জানালা আলাদা হতে পারে, তাই গ্রিডটা এখন **স্টাফ-প্রতি**
-- তৈরি হয় — আগের সংস্করণে একটাই গ্রিড সবার জন্য ছিল।
create or replace function public.shop_available_slots(
  p_shop_id     uuid,
  p_date        date,
  p_service_ids uuid[],
  p_staff_id    uuid default null
)
returns table (
  staff_id   uuid,
  staff_name text,
  slot_start timestamptz,
  slot_end   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tz        text;
  v_duration  integer;
  v_dow       int;
  v_day       text;
  v_dh        jsonb;
  v_open      time;
  v_close     time;
begin
  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    return;
  end if;

  select coalesce(sum(s.default_duration_min), 0) into v_duration
    from public.services s
   where s.id = any (p_service_ids) and s.shop_id = p_shop_id and s.is_active = true;

  if v_duration < 1
     or (select count(*) from public.services
          where id = any (p_service_ids) and shop_id = p_shop_id and is_active = true)
        <> cardinality(p_service_ids)
  then
    return;
  end if;

  v_tz  := public.shop_timezone(p_shop_id);
  v_dow := extract(isodow from p_date)::int;
  v_day := (array['mon','tue','wed','thu','fri','sat','sun'])[v_dow];

  select weekly_hours -> v_day into v_dh
    from public.shops where id = p_shop_id and status = 'ACTIVE';
  if v_dh is null or jsonb_typeof(v_dh) <> 'object' then
    return;
  end if;
  if coalesce((v_dh ->> 'closed')::boolean, false) then
    return;
  end if;

  v_open  := nullif(v_dh ->> 'open', '')::time;
  v_close := nullif(v_dh ->> 'close', '')::time;
  if v_open is null or v_close is null or v_close <= v_open then
    return;
  end if;

  return query
  with windows as (
    -- দোকানের সময় ∩ স্টাফের সময়। staff_working_hours-এ সারি না থাকলে join
    -- এই স্টাফকে বাদ দিয়ে দেয় — "সারি নেই = কাজ করে না" এখানেই কার্যকর।
    select
      c.id            as chair_id,
      coalesce(nullif(c.staff_name, ''), c.label) as label,
      c.sort_order    as sort_order,
      ((p_date + greatest(w.start_time, v_open)) at time zone v_tz) as win_from,
      ((p_date + least(w.end_time, v_close))     at time zone v_tz) as win_to
    from public.chairs c
    join public.staff_working_hours w
      on w.chair_id = c.id and w.weekday = v_dow
    where c.shop_id = p_shop_id
      and c.is_active = true
      and (p_staff_id is null or c.id = p_staff_id)
      and greatest(w.start_time, v_open) < least(w.end_time, v_close)
      and not exists (
        select 1 from unnest(p_service_ids) as sid
         join public.chair_service_stats css
           on css.chair_id = c.id and css.service_id = sid
        where css.can_perform = false
      )
  ),
  slots as (
    -- ১৫ মিনিটের গ্রিড, প্রত্যেকের নিজের জানালার ভেতরে।
    select
      win.chair_id,
      win.label,
      win.sort_order,
      g as slot_from,
      g + make_interval(mins => v_duration) as slot_to
    from windows win
    cross join lateral generate_series(
      win.win_from,
      win.win_to - make_interval(mins => v_duration),
      interval '15 minutes'
    ) as g
  )
  select sl.chair_id, sl.label, sl.slot_from, sl.slot_to
  from slots sl
  where sl.slot_from > now()
    and not exists (
      select 1 from public.staff_time_off t
       where t.chair_id = sl.chair_id
         and tstzrange(t.starts_at, t.ends_at) && tstzrange(sl.slot_from, sl.slot_to)
    )
    and not exists (
      select 1 from public.appointments a
       where a.staff_id = sl.chair_id
         and a.status in ('BOOKED', 'CONFIRMED', 'IN_PROGRESS')
         and tstzrange(a.starts_at, a.ends_at) && tstzrange(sl.slot_from, sl.slot_to)
    )
  order by sl.sort_order, sl.chair_id, sl.slot_from;
end;
$$;

comment on function public.shop_available_slots(uuid, date, uuid[], uuid) is
  'Bookable slots: shop hours ∩ staff hours, minus time off, minus existing '
  'appointments. SECURITY DEFINER so it can see other customers bookings to '
  'exclude them; it never returns who booked. A snapshot, not a reservation.';

-- ---------------------------------------------------------------------------
-- ৯) রিমাইন্ডারের ভিত্তি
-- ---------------------------------------------------------------------------
-- বিদ্যমান নাইটলি ক্রনেই বসে (সিদ্ধান্ত ৩৫), আর send_customer_reminders()-এর
-- হুবহু আকৃতি: SECURITY DEFINER, একটা সংখ্যা ফেরায়, বাইরের কারো execute নেই।
--
-- বাইরের কোনো প্রোভাইডার নেই — অ্যাপের নিজের `notifications` টেবিলেই লেখে,
-- যেটা push আর in-app দুটোই ইতিমধ্যে পড়ে। ইমেইল/SMS যোগ করতে হলে এই একটা
-- ফাংশনের ভেতরে একটা লাইন বসবে, স্ক্রিনের কোথাও নয়।
--
-- দ্বৈত রিমাইন্ডার ঠেকায় `reminded_at`: সারিটা **আগে** স্ট্যাম্প করা হয়, তারপর
-- নোটিফিকেশন লেখা হয় — ঠিক যে ক্রমে send_customer_reminders() নিজের schedule
-- এগিয়ে রাখে, একই কারণে (একটা সারির ব্যর্থতা যেন প্রতি রাতে ফিরে না আসে)।
create or replace function public.send_appointment_reminders(
  p_within_hours integer default 24
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent integer := 0;
  r      record;
  v_shop text;
begin
  for r in
    select a.id, a.customer_id, a.shop_id, a.starts_at, a.status
      from public.appointments a
     where a.customer_id is not null
       and a.reminded_at is null
       -- বাতিল, নো-শো আর শেষ হয়ে যাওয়া কিছু কখনো রিমাইন্ডার পায় না।
       and a.status in ('BOOKED', 'CONFIRMED')
       and a.starts_at > now()
       and a.starts_at <= now() + make_interval(hours => p_within_hours)
     order by a.starts_at
  loop
    update public.appointments set reminded_at = now() where id = r.id;

    if public.notification_enabled(r.customer_id, 'REMINDER') then
      select name into v_shop from public.shops where id = r.shop_id;

      insert into public.notifications (user_id, type, title, body, data)
      values (
        r.customer_id,
        'REMINDER',
        'আগামীকালের অ্যাপয়েন্টমেন্ট',
        coalesce(v_shop, 'তোমার পার্লার') || '-এ '
          || to_char(r.starts_at at time zone public.shop_timezone(r.shop_id), 'HH12:MI AM')
          || ' — অ্যাপয়েন্টমেন্টটা মনে আছে তো?',
        jsonb_build_object('shop_id', r.shop_id, 'appointment_id', r.id)
      );
      v_sent := v_sent + 1;
    end if;
  end loop;

  return v_sent;
end;
$$;

revoke execute on function public.send_appointment_reminders(integer) from public;

comment on function public.send_appointment_reminders(integer) is
  'Nightly appointment reminders. Idempotent through appointments.reminded_at. '
  'Writes to the app''s own notifications table — no external provider, which '
  'is the one line a future email/SMS integration would add here.';


-- ===========================================================================
-- যাচাই — মাইগ্রেশনের পর এই ব্লকটা আনকমেন্ট করে চালাও। সব ok = true হওয়া চাই।
-- ===========================================================================
--
-- select * from (values
--   -- টেবিল ও কনস্ট্রেইন্ট
--   ('staff_working_hours exists', to_regclass('public.staff_working_hours') is not null),
--   ('staff_time_off exists',      to_regclass('public.staff_time_off') is not null),
--   ('appointment_reschedules exists', to_regclass('public.appointment_reschedules') is not null),
--   ('time-off overlap constraint', exists (select 1 from pg_constraint where conname='staff_time_off_no_overlap')),
--   ('appointment overlap constraint still there',
--    exists (select 1 from pg_constraint where conname='appointments_no_overlap')),
--
--   -- RLS
--   ('RLS on staff_working_hours', (select relrowsecurity from pg_class where oid='public.staff_working_hours'::regclass)),
--   ('RLS on staff_time_off',      (select relrowsecurity from pg_class where oid='public.staff_time_off'::regclass)),
--   ('RLS on appointment_reschedules', (select relrowsecurity from pg_class where oid='public.appointment_reschedules'::regclass)),
--   ('staff hours has 4 policies', (select count(*) from pg_policies where tablename='staff_working_hours')=4),
--   ('time off has 4 policies',    (select count(*) from pg_policies where tablename='staff_time_off')=4),
--   ('reschedule history is read-only (1 policy, SELECT)',
--    (select count(*) from pg_policies where tablename='appointment_reschedules')=1
--    and (select count(*) from pg_policies where tablename='appointment_reschedules' and cmd='SELECT')=1),
--
--   -- ফাংশন
--   ('staff_is_available exists', to_regprocedure('public.staff_is_available(uuid,timestamptz,timestamptz)') is not null),
--   ('reschedule_appointment exists', to_regprocedure('public.reschedule_appointment(uuid,timestamptz,uuid,text)') is not null),
--   ('reschedule_appointment is INVOKER (RLS decides who may)',
--    (select not prosecdef from pg_proc where oid='public.reschedule_appointment(uuid,timestamptz,uuid,text)'::regprocedure)),
--   ('send_appointment_reminders exists', to_regprocedure('public.send_appointment_reminders(integer)') is not null),
--   ('is_chair_owner exists', to_regprocedure('public.is_chair_owner(uuid)') is not null),
--   ('reschedule history trigger exists',
--    exists (select 1 from pg_trigger where tgname='appointments_after_update')),
--
--   -- সিডিং: প্রতিটা চালু চেয়ারের অন্তত একটা কর্মদিন আছে কিনা। দোকানের
--   -- সাপ্তাহিক সময় সেট করা না থাকলে ০ হওয়া স্বাভাবিক — তখন নিচের সংখ্যাটা দেখো।
--   ('every active chair in a shop with hours got seeded',
--    not exists (
--      select 1 from public.chairs c
--       join public.shops s on s.id = c.shop_id
--      where c.is_active and s.weekly_hours is not null
--        and not exists (select 1 from public.staff_working_hours w where w.chair_id = c.id)
--    )),
--
--   -- কিছু হারায়নি
--   ('appointments still readable', (select count(*) >= 0 from public.appointments)),
--   ('serials untouched', to_regclass('public.serials') is not null)
-- ) as t(check_name, ok) order by ok, check_name;
--
--
-- কতগুলো সিড হলো, দেখতে চাইলে:
-- select c.label, count(w.weekday) as working_days
--   from public.chairs c
--   left join public.staff_working_hours w on w.chair_id = c.id
--  group by c.id, c.label order by c.label;
--
--
-- ---------------------------------------------------------------------------
-- আচরণগত প্রোব — প্রতিটাই ROLLBACK করে
-- ---------------------------------------------------------------------------
-- ১) ছুটির দিনে বুকিং আটকায় কিনা — ইনসার্টটা **ব্যর্থ হওয়ার কথা** (staff_on_leave)
--
-- begin;
--   with st as (select c.id from public.chairs c join public.shops s on s.id=c.shop_id
--                where s.business_type='PARLOUR' and c.is_active limit 1),
--        sv as (select sv.id, sv.shop_id from public.services sv
--                join st on true join public.chairs c on c.id=st.id
--               where sv.shop_id=c.shop_id and sv.is_active limit 1)
--   insert into public.staff_time_off (chair_id, starts_at, ends_at, reason)
--   select st.id, date_trunc('day', now()) + interval '9 days',
--          date_trunc('day', now()) + interval '10 days', 'probe leave' from st;
--
--   -- ছুটির ভেতরে বুক করার চেষ্টা → ERROR: staff_on_leave
--   with st as (select c.id from public.chairs c join public.shops s on s.id=c.shop_id
--                where s.business_type='PARLOUR' and c.is_active limit 1),
--        sv as (select sv.id, sv.shop_id from public.services sv
--                join public.chairs c on c.shop_id=sv.shop_id
--               where c.id=(select id from st) and sv.is_active limit 1)
--   insert into public.appointments (shop_id, staff_id, service_ids, starts_at, ends_at, is_walk_in, customer_name)
--   select sv.shop_id, st.id, array[sv.id],
--          date_trunc('day', now()) + interval '9 days 12 hours',
--          date_trunc('day', now()) + interval '9 days 13 hours', true, 'probe'
--   from st, sv;
-- rollback;
--
--
-- ২) স্লট RPC ছুটির দিন বাদ দেয় কিনা (সংখ্যা ০ হওয়ার কথা):
-- -- ছুটি বসানোর পর, ওই তারিখে:
-- -- select count(*) from shop_available_slots(<shop>, <ছুটির তারিখ>, array[<service>]);
--
--
-- ৩) রিমাইন্ডার যোগ্যতা — কোনটা পাবে, কোনটা পাবে না:
-- select status, reminded_at is null as never_reminded,
--        starts_at <= now() + interval '24 hours' as due_soon,
--        (status in ('BOOKED','CONFIRMED') and reminded_at is null
--         and starts_at > now() and starts_at <= now() + interval '24 hours') as would_be_sent
--   from public.appointments order by starts_at;
--
-- select public.send_appointment_reminders(24);   -- কতগুলো পাঠাল
-- select public.send_appointment_reminders(24);   -- দ্বিতীয়বার ০ হওয়ার কথা
