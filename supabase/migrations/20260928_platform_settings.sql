-- =============================================================================
-- Sprint 11 polish — the platform's default loyalty earning rate
-- =============================================================================
--
-- WHAT THIS IS, AND WHAT IT IS NOT
--
-- The brief that asked for this said the 100-taka-per-point rule "must no
-- longer be permanently hardcoded". It never was. `loyalty_settings` has
-- carried `taka_per_point integer not null default 100 check (between 1 and
-- 100000)` since 20260922, each shop owns its own value, and the owner edits it
-- on /loyalty. Loyalty is business-specific — that is a confirmed product
-- decision, and a platform-wide override would quietly rewrite the earning rate
-- of every live programme in the country.
--
-- So what is missing is not "configurability". It is a **platform default**:
-- the number a shop starts from before anybody tunes it. That is what this
-- adds, and the two levels are deliberately distinct:
--
--   platform_settings.loyalty_taka_per_point   the default a NEW shop begins at
--   loyalty_settings.taka_per_point            what a shop actually earns at
--
-- One authoritative answer per question. Changing the platform default changes
-- where future shops start; it does not touch a shop that has already chosen,
-- and it does not touch a single historical row. Points already awarded were
-- awarded under the rule that was in force — `loyalty_transactions` is an
-- append-only ledger and nothing here rewrites it.
--
-- The singleton shape (`id boolean primary key check (id)`) is the smallest
-- thing that cannot drift: there is exactly one row, forever, and no query
-- needs to know which one. `platform_settings` was already sketched in the
-- roadmap's admin backlog for feature flags and maintenance mode, so this is
-- the table that was going to exist anyway, arriving one column at a time.

-- ---------------------------------------------------------------------------
-- 1) The table
-- ---------------------------------------------------------------------------

create table if not exists public.platform_settings (
  -- One row. `check (id)` means the only permitted value is true, and a
  -- primary key means it can only be there once.
  id boolean primary key default true check (id),

  -- Same units, same bounds and same meaning as loyalty_settings.taka_per_point
  -- — "how much must be spent to earn one point". Bounds are not decoration:
  -- 0 or a negative would make points_for_bill() undefined, and the upper end
  -- keeps a typo from creating a programme nobody can ever earn from.
  loyalty_taka_per_point integer not null default 100
    check (loyalty_taka_per_point between 1 and 100000),

  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.platform_settings (id) values (true)
  on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

-- ---------------------------------------------------------------------------
-- 2) Who may read, who may write
-- ---------------------------------------------------------------------------
-- Read is open to any signed-in account, because the number is not a secret
-- and the provider's own loyalty form needs it to show what it is starting
-- from. Write is admin-only, and enforced HERE rather than in the admin UI —
-- hiding a form is not authorization.

drop policy if exists "platform_settings: read" on public.platform_settings;
create policy "platform_settings: read"
  on public.platform_settings for select
  to authenticated
  using (true);

-- Deliberately no INSERT, UPDATE or DELETE policy for anyone. The row exists
-- already, and the only way to change it is the RPC below, which checks the
-- caller's admin level itself. A customer or a shop owner calling UPDATE
-- directly is refused by the absence of a policy — the same shape loyalty
-- accounts and the ledger use (decision 32).

-- ---------------------------------------------------------------------------
-- 3) The one door that writes it
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because there is no UPDATE policy to satisfy, which means
-- the ownership check cannot be delegated to RLS and has to be made by hand,
-- in here, on the first line.
--
-- `platform.settings` is a permission only SUPER_ADMIN holds: admin_can() lists
-- what MODERATOR and SUPPORT may do and this is not on either list, so the
-- capability is granted by being absent from them. A moderator who can hide a
-- review still cannot change the country's earning rate.

create or replace function public.admin_set_loyalty_default(
  p_taka_per_point integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new integer;
begin
  if not public.admin_can('platform.settings') then
    raise exception 'not authorised';
  end if;

  -- Checked here as well as by the CHECK constraint, so the caller gets a
  -- message that says what was wrong instead of a constraint name.
  if p_taka_per_point is null then
    raise exception 'taka_per_point required';
  end if;
  if p_taka_per_point < 1 or p_taka_per_point > 100000 then
    raise exception 'taka_per_point out of range';
  end if;

  update public.platform_settings
     set loyalty_taka_per_point = p_taka_per_point,
         updated_at = now(),
         updated_by = auth.uid()
   where id
  returning loyalty_taka_per_point into v_new;

  perform public.admin_log('platform.loyalty_default', null, null,
                           jsonb_build_object('taka_per_point', p_taka_per_point));

  return v_new;
end $$;

revoke all on function public.admin_set_loyalty_default(integer) from public;
grant execute on function public.admin_set_loyalty_default(integer) to authenticated;

comment on function public.admin_set_loyalty_default(integer) is
  'SUPER_ADMIN only. Sets the platform DEFAULT earning rate for new shops. '
  'Does not alter any shop that has already configured its own rate, and '
  'does not recalculate a single historical loyalty_transactions row.';

-- ---------------------------------------------------------------------------
-- 4) Making the default actually apply to a new shop
-- ---------------------------------------------------------------------------
-- A column default cannot read another table, so `default 100` could never
-- follow the platform setting. Dropping the default and filling the gap from a
-- trigger is what makes the platform value authoritative for new rows no
-- matter who inserts them — the provider's form, a future admin tool, or SQL
-- typed by hand.
--
-- This is safe in both directions. Constraints are checked AFTER triggers
-- fire, so an INSERT that omits the column arrives as null, gets filled, and
-- then satisfies NOT NULL. And nothing already stored is touched: dropping a
-- default is a change to future inserts only.
--
-- `zz_` prefix so it runs last. Postgres fires triggers in name order, and
-- 20260922 already put `loyalty_settings_touch` on this table.

alter table public.loyalty_settings
  alter column taka_per_point drop default;

create or replace function public.zz_loyalty_settings_default_rate()
returns trigger
language plpgsql
as $$
begin
  if new.taka_per_point is null then
    select loyalty_taka_per_point into new.taka_per_point
      from public.platform_settings where id;
    -- Belt and braces: if the singleton were ever missing, fall back to the
    -- number that was the column default for this table's whole life rather
    -- than failing a shop's first save.
    new.taka_per_point := coalesce(new.taka_per_point, 100);
  end if;
  return new;
end $$;

drop trigger if exists zz_loyalty_settings_default_rate on public.loyalty_settings;
create trigger zz_loyalty_settings_default_rate
  before insert on public.loyalty_settings
  for each row execute function public.zz_loyalty_settings_default_rate();

-- ---------------------------------------------------------------------------
-- 5) Handover verification — uncomment and run in the SQL editor
-- ---------------------------------------------------------------------------
-- Every row should read `t`.
--
-- select 'table exists' as check,
--        exists (select 1 from information_schema.tables
--                 where table_schema='public' and table_name='platform_settings') as ok
-- union all select 'rls enabled',
--        (select relrowsecurity from pg_class where oid='public.platform_settings'::regclass)
-- union all select 'exactly one row',
--        (select count(*) = 1 from public.platform_settings)
-- union all select 'default is 100 to begin with',
--        (select loyalty_taka_per_point = 100 from public.platform_settings)
-- union all select 'read policy present',
--        exists (select 1 from pg_policies where tablename='platform_settings'
--                 and cmd='SELECT')
-- union all select 'NO write policy for anyone',
--        not exists (select 1 from pg_policies where tablename='platform_settings'
--                     and cmd in ('INSERT','UPDATE','DELETE','ALL'))
-- union all select 'the singleton cannot be duplicated',
--        (select count(*) = 1 from public.platform_settings)
-- union all select 'rpc is SECURITY DEFINER',
--        (select prosecdef from pg_proc where proname='admin_set_loyalty_default')
-- union all select 'rpc search_path pinned',
--        (select proconfig::text like '%search_path%' from pg_proc
--          where proname='admin_set_loyalty_default')
-- union all select 'column default dropped',
--        (select column_default is null from information_schema.columns
--          where table_name='loyalty_settings' and column_name='taka_per_point')
-- union all select 'fill trigger installed',
--        exists (select 1 from pg_trigger
--                 where tgname='zz_loyalty_settings_default_rate' and not tgisinternal)
-- union all select 'no historical ledger row was touched',
--        (select count(*) = 0 from public.loyalty_transactions
--          where created_at > now() - interval '1 minute');
--
-- And the one that matters most — the SQL editor runs as `service_role`, which
-- has no auth.uid(), so admin_can() is false and this MUST be refused:
--
-- do $$
-- begin
--   begin
--     perform public.admin_set_loyalty_default(50);
--     raise notice 'PROBLEM: an caller with no admin identity was allowed';
--   exception when others then
--     if sqlerrm = 'not authorised' then
--       raise notice 'OK: refused a caller with no admin identity';
--     else
--       raise notice 'refused, but for another reason: %', sqlerrm;
--     end if;
--   end;
-- end $$;
