-- Sprint 37: অ্যাকাউন্ট মুছলে ইমেইলটা সত্যিই খালি হবে
-- Run this once in the Supabase dashboard's SQL editor, AFTER
-- 20260902_support_tickets.sql.
--
-- ---------------------------------------------------------------------------
-- THE BUG
-- ---------------------------------------------------------------------------
-- admin_delete_user() ended with a plain `delete from auth.users`. Its comment
-- claimed that freed the address for re-registration. It does not.
--
-- The row password sign-in actually resolves against is auth.identities, and
-- an account also owns rows in auth.sessions, auth.refresh_tokens,
-- auth.mfa_factors and auth.one_time_tokens. Those are GoTrue's tables, kept
-- consistent by GoTrue's own delete path — whether a raw DELETE cascades into
-- all of them depends on the FKs the project happened to be created with, and
-- on this project it did not. So the users row went, the identity stayed, and
-- signing up again with the same address came back "already registered"
-- against a user that no longer existed. Deleting an account left the email
-- permanently unusable.
--
-- ---------------------------------------------------------------------------
-- THE FIX
-- ---------------------------------------------------------------------------
-- Split the job at the schema boundary — the same rule /api/admin/account has
-- followed since Sprint 27 for email changes, now applied to deletion too:
--
--   * public schema  -> this function (one transaction, real auth.uid(), audit)
--   * auth schema    -> Supabase's Admin API, from /api/admin/account
--
-- So the function below is the Sprint 27 body with exactly two changes, both
-- marked: it deletes the profiles row itself (that used to happen by FK
-- cascade from auth.users), and it no longer touches auth.users at all.
--
-- Everything else is unchanged: a deleted customer's serials are still
-- ANONYMISED rather than deleted, so shop income and daily counts stay intact.

create or replace function public.admin_delete_user(
  p_user_id uuid,
  p_reason  text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_shop    shops%rowtype;
  v_email   text;
  v_serials_anonymised integer := 0;
  v_shop_serials integer := 0;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'cannot delete yourself';
  end if;
  if exists (select 1 from admin_users where user_id = p_user_id) then
    raise exception 'cannot delete a platform admin';
  end if;

  select * into v_profile from profiles where id = p_user_id;
  if not found then
    raise exception 'user not found';
  end if;

  select email into v_email from auth.users where id = p_user_id;

  -- (a) Their shop, if any — teardown in dependency order.
  select * into v_shop from shops where owner_id = p_user_id;
  if found then
    select count(*) into v_shop_serials from serials where shop_id = v_shop.id;

    delete from reviews             where shop_id = v_shop.id;
    delete from serials             where shop_id = v_shop.id;
    delete from manual_entries      where shop_id = v_shop.id;
    delete from offers              where shop_id = v_shop.id;
    delete from shop_gallery_images where shop_id = v_shop.id;
    delete from favorites           where shop_id = v_shop.id;
    delete from messages            where shop_id = v_shop.id;
    delete from regular_reminders   where shop_id = v_shop.id;
    delete from chair_service_stats
      where chair_id in (select id from chairs where shop_id = v_shop.id);
    delete from chairs              where shop_id = v_shop.id;
    delete from services            where shop_id = v_shop.id;
    delete from queue_public        where shop_id = v_shop.id;
    delete from shops               where id = v_shop.id;
  end if;

  -- (b) Anonymise the serials they booked as a customer elsewhere. Active ones
  -- are cancelled first so no shop is left with a ghost in its live queue.
  update serials set status = 'CANCELLED'
   where customer_id = p_user_id and status in ('WAITING', 'IN_PROGRESS');

  update serials set customer_id = null where customer_id = p_user_id;
  get diagnostics v_serials_anonymised = row_count;

  -- (c) Everything that is genuinely theirs.
  delete from reviews            where customer_id = p_user_id;
  delete from favorites          where customer_id = p_user_id;
  delete from messages           where customer_id = p_user_id or sender_id = p_user_id;
  delete from notifications      where user_id = p_user_id;
  delete from push_subscriptions where user_id = p_user_id;
  delete from regular_reminders  where customer_id = p_user_id;
  delete from reports            where reporter_id = p_user_id;

  -- Support tickets, added in 20260902. Guarded so this migration still runs
  -- on a database where that one hasn't been applied yet.
  if to_regclass('public.support_tickets') is not null then
    delete from support_ticket_messages
     where ticket_id in (select id from support_tickets where user_id = p_user_id);
    delete from support_tickets where user_id = p_user_id;
  end if;

  -- (d) Audit BEFORE the delete: admin_audit_log.actor_id survives, and
  -- target_id has no FK, so the row outlives the user it describes.
  perform public.admin_log(
    'USER_DELETED', 'user', p_user_id,
    jsonb_build_object(
      'email', v_email,
      'full_name', v_profile.full_name,
      'phone', v_profile.phone,
      'role', v_profile.role,
      'shop_name', v_shop.name,
      'shop_serials_deleted', v_shop_serials,
      'serials_anonymised', v_serials_anonymised,
      'reason', p_reason
    )
  );

  -- (e) CHANGED (Sprint 37): the profiles row is deleted here, explicitly. It
  -- used to disappear by FK cascade when auth.users went — and auth.users is
  -- no longer deleted from SQL.
  delete from profiles where id = p_user_id;

  -- CHANGED (Sprint 37): `delete from auth.users where id = p_user_id;` was
  -- here. It now happens in /api/admin/account through the Admin API, which is
  -- the only thing that removes the identity, sessions and one-time tokens
  -- along with the user — i.e. the only thing that actually frees the email.

  return json_build_object(
    'email', v_email,
    'shop_deleted', v_shop.id is not null,
    'shop_serials_deleted', v_shop_serials,
    'serials_anonymised', v_serials_anonymised
  );
end; $$;

grant execute on function public.admin_delete_user(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_my_account: the same bug, on the self-serve path
-- ---------------------------------------------------------------------------
-- "সেটিংস → অ্যাকাউন্ট মুছে ফেলো" ended in the same `delete from auth.users`,
-- so a customer who deleted their own account could never sign up again with
-- that address either. Same split, and here it can be a clean one: everything
-- a customer owns is already FK-cascaded to auth.users, so nothing needs
-- deleting in the public schema at all.
--
-- What is left is the precondition — a shop owner may not self-delete —
-- and that is all this function does now. /api/account/delete calls it first
-- and only then removes the account through the Admin API.
--
-- Checking and not deleting is deliberate: if the Admin API call fails, the
-- account is untouched and the user simply sees an error, instead of being
-- left with half an account and no way back.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'লগইন করা নেই';
  end if;

  if exists (select 1 from public.shops sh where sh.owner_id = v_uid) then
    raise exception 'তোমার নামে দোকান আছে — অ্যাকাউন্ট মুছার আগে সাপোর্টে যোগাযোগ করো';
  end if;

  if exists (select 1 from public.admin_users a where a.user_id = v_uid) then
    raise exception 'এডমিন অ্যাকাউন্ট এভাবে মোছা যাবে না';
  end if;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
