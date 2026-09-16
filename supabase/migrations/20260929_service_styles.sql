-- =============================================================================
-- Sprint 11 polish — which styles a shop offers for a given service
-- =============================================================================
--
-- THE DECISION THIS FILE TURNS ON
--
-- The brief asked for per-shop style lists: shop A's haircut offers Classic,
-- Low Fade and Mid Fade while shop B's offers Classic, High Fade and Undercut,
-- and the customer sees the right list for the shop and service they picked.
--
-- It also sketched a "+ Add Style" field, which would mean each shop typing its
-- own style names. That part is NOT what this does, and the reason is written
-- into 20260914, which built the style catalogue in the first place:
--
--     "লেখা কেবল এডমিনের। দোকানদার নিজের মতো স্টাইল যোগ করতে পারলে একই স্টাইল
--      বিশ ভাবে বিশ জায়গায় লেখা হতো, আর AI-এর তালিকাটা অকেজো হয়ে যেত।"
--
-- Free-typed names give you "Low Fade", "low fade", "Lo-fade" and "লো ফেড" as
-- four different styles, and the Style Studio — which matches a customer's
-- photo against this catalogue and reads `description_*` and `suits_notes_en`
-- to do it — stops working, because a shop-typed string has none of that.
--
-- So the vocabulary stays platform-owned and the OFFERING becomes shop-owned.
-- A shop picks from the catalogue which styles it does for each service, and
-- orders them. That satisfies the actual requirement — different shops show
-- different lists — without splitting one concept into two.
--
-- What a shop cannot do is invent a style nobody has named. If that turns out
-- to matter, the honest next step is a request queue into the admin catalogue
-- (/admin/styles already exists), not a free-text column here.
--
-- HISTORY, WHICH THE BRIEF WAS RIGHT TO INSIST ON
--
-- "The customer's selected historical style must remain meaningful even if the
-- provider later changes available styles." It did not, and that was a real
-- hole. `serial_style_preferences` stored only `hairstyle_id`, with
-- `on delete cascade` — so renaming a catalogue style silently rewrote what
-- every past customer had asked for, and deleting one erased the record
-- outright. Section 2 fixes that with a name snapshot and a non-destructive
-- delete rule. Nothing about a finished haircut should change afterwards.
--
-- SALON ONLY, FOR NOW
--
-- Styles hang off `services`, which both business types have, so nothing here
-- forbids a parlour from using them later. But the customer-side picker is
-- wired into the queue flow only, as the brief asked — a parlour's appointment
-- sheet is untouched.

-- ---------------------------------------------------------------------------
-- 1) The offering: shop + service + style
-- ---------------------------------------------------------------------------
-- `shop_id` is deliberately NOT a column here. It would be derivable from
-- `service_id` and therefore able to disagree with it, which is the one thing a
-- multi-tenant table must never allow. Isolation comes from the service's own
-- shop, looked up in the policies below.

create table if not exists public.service_styles (
  service_id   uuid not null references public.services(id)   on delete cascade,
  hairstyle_id uuid not null references public.hairstyles(id) on delete cascade,

  -- The shop's own running order. Ties break on the catalogue's name so the
  -- list is never arbitrary — a list that reshuffles between page loads reads
  -- as a bug.
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),

  -- Answers "does this shop do this style for this service", which can only
  -- have one answer. The PK is also the index for the read below, so the
  -- offering list for one service is a single index scan.
  primary key (service_id, hairstyle_id)
);

-- Reverse lookup: "which services offer this style", for the catalogue side.
create index if not exists service_styles_hairstyle_idx
  on public.service_styles (hairstyle_id);

alter table public.service_styles enable row level security;

-- Read is open to any signed-in account. A customer has to see the list BEFORE
-- they have a serial, so it cannot be gated on owning one — and it is the same
-- shape as "anyone can browse chair capabilities" in 20260731, which exists for
-- exactly this reason on exactly this kind of table.
drop policy if exists "service_styles: browse" on public.service_styles;
create policy "service_styles: browse"
  on public.service_styles for select
  to authenticated
  using (true);

-- Write belongs to the shop that owns the service, and to nobody else. The
-- subquery is the isolation: shop A's owner cannot name shop B's service_id,
-- because is_shop_owner() is then asked about shop B and says no.
--
-- Split into the three commands rather than FOR ALL so that `using` and
-- `with check` are unambiguous on each — an UPDATE that moved a row from one
-- shop's service to another's has to fail both halves, not one.
drop policy if exists "service_styles: owner insert" on public.service_styles;
create policy "service_styles: owner insert"
  on public.service_styles for insert
  to authenticated
  with check (
    public.is_shop_owner((select s.shop_id from public.services s where s.id = service_id))
  );

drop policy if exists "service_styles: owner update" on public.service_styles;
create policy "service_styles: owner update"
  on public.service_styles for update
  to authenticated
  using (
    public.is_shop_owner((select s.shop_id from public.services s where s.id = service_id))
  )
  with check (
    public.is_shop_owner((select s.shop_id from public.services s where s.id = service_id))
  );

drop policy if exists "service_styles: owner delete" on public.service_styles;
create policy "service_styles: owner delete"
  on public.service_styles for delete
  to authenticated
  using (
    public.is_shop_owner((select s.shop_id from public.services s where s.id = service_id))
  );

comment on table public.service_styles is
  'Which catalogue styles a shop offers for one of its services. The style '
  'vocabulary stays admin-owned in public.hairstyles (see 20260914); only the '
  'offering and its order are the shop''s. No shop_id column on purpose — it '
  'comes from the service, so it cannot disagree with it.';

-- ---------------------------------------------------------------------------
-- 2) A customer's pick has to survive the shop changing its mind
-- ---------------------------------------------------------------------------
-- Additive: two nullable columns, and a delete rule that keeps the row instead
-- of destroying it. Every existing row is preserved exactly as it is; the
-- backfill below fills in the names they should always have had, reading them
-- from the catalogue as it stands today (the best available answer — the name
-- at pick time was not recorded, which is the bug).

alter table public.serial_style_preferences
  add column if not exists style_name_bn text,
  add column if not exists style_name_en text;

-- `hairstyle_id` has to become nullable for `on delete set null` to be possible.
-- Dropping NOT NULL only widens what is allowed, so no stored row is affected
-- and nothing that inserts today can break.
alter table public.serial_style_preferences
  alter column hairstyle_id drop not null;

do $$
declare
  v_con text;
begin
  select conname into v_con
    from pg_constraint
   where conrelid = 'public.serial_style_preferences'::regclass
     and contype = 'f'
     and conkey = array[
       (select attnum from pg_attribute
         where attrelid = 'public.serial_style_preferences'::regclass
           and attname = 'hairstyle_id')
     ]::smallint[];

  if v_con is not null then
    execute format('alter table public.serial_style_preferences drop constraint %I', v_con);
  end if;

  -- SET NULL, not CASCADE: if an admin removes a style from the catalogue, the
  -- record that a customer once asked for it must not vanish with it. The name
  -- snapshot is what keeps the row meaningful afterwards.
  alter table public.serial_style_preferences
    add constraint serial_style_preferences_hairstyle_id_fkey
    foreign key (hairstyle_id) references public.hairstyles(id) on delete set null;
end $$;

-- Fill the snapshot for rows that predate it.
update public.serial_style_preferences p
   set style_name_bn = h.name_bn,
       style_name_en = h.name_en
  from public.hairstyles h
 where h.id = p.hairstyle_id
   and (p.style_name_bn is null or p.style_name_en is null);

-- And take the snapshot automatically from now on, so no caller can forget.
-- `zz_` prefix so it runs after anything 20260914 put on this table.
create or replace function public.zz_style_pref_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.hairstyle_id is not null
     and (new.style_name_bn is null or new.style_name_en is null) then
    select h.name_bn, h.name_en
      into new.style_name_bn, new.style_name_en
      from public.hairstyles h
     where h.id = new.hairstyle_id;
  end if;
  return new;
end $$;

drop trigger if exists zz_style_pref_snapshot on public.serial_style_preferences;
create trigger zz_style_pref_snapshot
  before insert or update on public.serial_style_preferences
  for each row execute function public.zz_style_pref_snapshot();

comment on column public.serial_style_preferences.style_name_bn is
  'The style''s name as it read when the customer chose it. Frozen on purpose: '
  'the catalogue may be renamed or the style withdrawn, and neither should '
  'change what a past customer is recorded as having asked for.';

-- ---------------------------------------------------------------------------
-- 3) Handover verification — uncomment and run in the SQL editor
-- ---------------------------------------------------------------------------
-- Every row should read `t`.
--
-- select 'service_styles exists' as check,
--        exists (select 1 from information_schema.tables
--                 where table_schema='public' and table_name='service_styles') as ok
-- union all select 'rls enabled',
--        (select relrowsecurity from pg_class where oid='public.service_styles'::regclass)
-- union all select 'four policies (1 read + 3 write)',
--        (select count(*) = 4 from pg_policies where tablename='service_styles')
-- union all select 'no shop_id column (isolation comes from the service)',
--        not exists (select 1 from information_schema.columns
--                     where table_name='service_styles' and column_name='shop_id')
-- union all select 'composite primary key',
--        exists (select 1 from pg_constraint
--                 where conrelid='public.service_styles'::regclass and contype='p')
-- union all select 'snapshot columns added',
--        (select count(*) = 2 from information_schema.columns
--          where table_name='serial_style_preferences'
--            and column_name in ('style_name_bn','style_name_en'))
-- union all select 'hairstyle_id is now nullable',
--        (select is_nullable = 'YES' from information_schema.columns
--          where table_name='serial_style_preferences' and column_name='hairstyle_id')
-- union all select 'delete rule is SET NULL, not CASCADE',
--        (select confdeltype = 'n' from pg_constraint
--          where conname='serial_style_preferences_hairstyle_id_fkey')
-- union all select 'snapshot trigger installed',
--        exists (select 1 from pg_trigger
--                 where tgname='zz_style_pref_snapshot' and not tgisinternal)
-- union all select 'every existing pick now carries its name',
--        (select count(*) = 0 from public.serial_style_preferences
--          where hairstyle_id is not null and style_name_en is null)
-- union all select 'no serial row was touched',
--        (select count(*) = 0 from public.serials
--          where updated_at > now() - interval '1 minute');
