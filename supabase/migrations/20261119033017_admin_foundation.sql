-- M1: chỉ foundation Auth/admin/catalog; không tạo các module đơn/chat trước nhu cầu.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated, service_role;

create table public.admin_members (
  user_id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.admin_members enable row level security;
revoke all on public.admin_members from anon, authenticated;
grant select on public.admin_members to authenticated;

create table private.admin_bootstrap_state (
  id boolean primary key default true check (id),
  completed boolean not null default false
);
insert into private.admin_bootstrap_state(id) values (true);

create table private.admin_invites (
  id bigint generated always as identity primary key,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references public.admin_members(user_id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  used_by uuid references public.admin_members(user_id),
  used_at timestamptz,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check ((used_by is null) = (used_at is null))
);
create index admin_invites_creator on private.admin_invites(created_by);
create index admin_invites_used_by on private.admin_invites(used_by);

create table private.invite_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0)
);
create table private.admin_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null,
  target_id text,
  created_at timestamptz not null default now()
);
create index admin_audit_actor on private.admin_audit_events(actor_id);
alter table private.admin_bootstrap_state enable row level security;
alter table private.admin_invites enable row level security;
alter table private.invite_attempts enable row level security;
alter table private.admin_audit_events enable row level security;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;

-- Tin vào identity Google do Auth quản lý, không tin raw_user_meta_data.
create function private.google_verified(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u join auth.identities i on i.user_id = u.id
    where u.id = p_user_id and u.email_confirmed_at is not null
      and i.provider = 'google'
      and i.identity_data ->> 'email_verified' = 'true'
      and lower(i.identity_data ->> 'email') = lower(u.email)
  );
$$;
create function private.has_live_session() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from auth.sessions s where s.user_id = (select auth.uid())
      and s.id::text = ((select auth.jwt()) ->> 'session_id')
  );
$$;
create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and private.has_live_session()
    and private.google_verified((select auth.uid()))
    and exists (select 1 from public.admin_members where user_id = (select auth.uid()) and active);
$$;
create policy members_read on public.admin_members for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Bootstrap chỉ dành cho operator/service_role; không có route web tự nâng quyền.
create function private.bootstrap_first_admin(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from private.admin_bootstrap_state where id for update;
  if (select completed from private.admin_bootstrap_state where id) then
    raise exception 'Bootstrap already completed' using errcode = '42501';
  end if;
  if not private.google_verified(p_user_id) or not exists (
    select 1 from auth.users where id = p_user_id and lower(email) = 'congminhnguyen0204@gmail.com'
  ) then
    raise exception 'Verified bootstrap identity required' using errcode = '42501';
  end if;
  insert into public.admin_members(user_id, email)
    select id, email from auth.users where id = p_user_id;
  update private.admin_bootstrap_state set completed = true where id;
  insert into private.admin_audit_events(actor_id, action, target_id)
    values (p_user_id, 'bootstrap', p_user_id::text);
  return jsonb_build_object('ok', true);
end;
$$;

create function private.create_admin_invite(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_invite private.admin_invites;
begin
  -- Một shop: serialize thay đổi quyền/mời trên singleton, giữ transaction ngắn.
  perform 1 from private.admin_bootstrap_state where id for update;
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid hash' using errcode = '22023';
  end if;
  if (select count(*) from private.admin_invites where created_by = auth.uid()
      and used_at is null and revoked_at is null and expires_at > now()) >= 10 then
    return jsonb_build_object('ok', false, 'code', 'invite_limit');
  end if;
  insert into private.admin_invites(token_hash, created_by) values (p_token_hash, auth.uid()) returning * into v_invite;
  insert into private.admin_audit_events(actor_id, action, target_id) values (auth.uid(), 'invite_created', v_invite.id::text);
  return jsonb_build_object('ok', true, 'id', v_invite.id::text, 'expiresAt', v_invite.expires_at);
end;
$$;

create function private.redeem_admin_invite(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_invite private.admin_invites; v_attempts integer;
begin
  if not private.has_live_session() or not private.google_verified(auth.uid()) then
    raise exception 'Verified Google identity required' using errcode = '42501';
  end if;
  -- Trả lỗi dạng dữ liệu để bộ đếm thử sai commit, không rollback vì exception.
  insert into private.invite_attempts(user_id, attempts) values (auth.uid(), 1)
  on conflict(user_id) do update set
    attempts = case when private.invite_attempts.window_started_at < now() - interval '15 minutes' then 1 else private.invite_attempts.attempts + 1 end,
    window_started_at = case when private.invite_attempts.window_started_at < now() - interval '15 minutes' then now() else private.invite_attempts.window_started_at end
  returning attempts into v_attempts;
  if v_attempts > 10 then return jsonb_build_object('ok', false, 'code', 'rate_limited'); end if;
  perform 1 from private.admin_bootstrap_state where id for update;
  if private.is_admin() then return jsonb_build_object('ok', true); end if;
  -- Tài khoản bị vô hiệu hóa không được dùng mã mời để tự kích hoạt lại.
  if exists (select 1 from public.admin_members where user_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'code', 'account_disabled');
  end if;
  select * into v_invite from private.admin_invites
    where token_hash = p_token_hash and used_at is null and revoked_at is null and expires_at > now() for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'invalid_invite'); end if;
  insert into public.admin_members(user_id, email) select id, email from auth.users where id = auth.uid();
  update private.admin_invites set used_by = auth.uid(), used_at = now() where id = v_invite.id;
  insert into private.admin_audit_events(actor_id, action, target_id) values (auth.uid(), 'invite_redeemed', v_invite.id::text);
  return jsonb_build_object('ok', true);
end;
$$;

create function private.revoke_admin_invite(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from private.admin_bootstrap_state where id for update;
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  update private.admin_invites set revoked_at = now()
    where id = p_id and used_at is null and revoked_at is null;
  if not found then return jsonb_build_object('ok', false, 'code', 'invalid_invite'); end if;
  insert into private.admin_audit_events(actor_id, action, target_id) values (auth.uid(), 'invite_revoked', p_id::text);
  return jsonb_build_object('ok', true);
end;
$$;

create function private.list_admin_invites() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', i.id::text, 'createdAt', i.created_at,
    'expiresAt', i.expires_at, 'usedAt', i.used_at, 'revokedAt', i.revoked_at) order by i.id desc)
    from (select * from private.admin_invites order by id desc limit 50) i), '[]'::jsonb);
end;
$$;

create function private.set_admin_active(p_user_id uuid, p_active boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from private.admin_bootstrap_state where id for update;
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_user_id = auth.uid() or p_active is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_member');
  end if;
  update public.admin_members set active = p_active where user_id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'invalid_member'); end if;
  if not p_active then
    update private.admin_invites set revoked_at = now()
      where created_by = p_user_id and used_at is null and revoked_at is null;
  end if;
  insert into private.admin_audit_events(actor_id, action, target_id)
    values (auth.uid(), case when p_active then 'admin_enabled' else 'admin_disabled' end, p_user_id::text);
  return jsonb_build_object('ok', true);
end;
$$;

-- Public API chỉ là invoker wrapper. Quyền và dữ liệu nhạy cảm ở private schema.
create function public.is_admin() returns boolean language sql security invoker set search_path = '' as $$ select private.is_admin(); $$;
create function public.has_live_session() returns boolean language sql security invoker set search_path = '' as $$ select private.has_live_session(); $$;
create function public.bootstrap_first_admin(p_user_id uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.bootstrap_first_admin(p_user_id); $$;
create function public.create_admin_invite(p_token_hash text) returns jsonb language sql security invoker set search_path = '' as $$ select private.create_admin_invite(p_token_hash); $$;
create function public.redeem_admin_invite(p_token_hash text) returns jsonb language sql security invoker set search_path = '' as $$ select private.redeem_admin_invite(p_token_hash); $$;
create function public.revoke_admin_invite(p_id bigint) returns jsonb language sql security invoker set search_path = '' as $$ select private.revoke_admin_invite(p_id); $$;
create function public.list_admin_invites() returns jsonb language sql security invoker set search_path = '' as $$ select private.list_admin_invites(); $$;
create function public.set_admin_active(p_user_id uuid, p_active boolean) returns jsonb language sql security invoker set search_path = '' as $$ select private.set_admin_active(p_user_id, p_active); $$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.has_live_session() to authenticated;
grant execute on function private.bootstrap_first_admin(uuid) to service_role;
grant execute on function private.create_admin_invite(text), private.redeem_admin_invite(text),
  private.revoke_admin_invite(bigint), private.list_admin_invites(), private.set_admin_active(uuid, boolean) to authenticated;
revoke all on function public.is_admin(), public.bootstrap_first_admin(uuid), public.create_admin_invite(text),
  public.redeem_admin_invite(text), public.revoke_admin_invite(bigint), public.list_admin_invites(), public.set_admin_active(uuid, boolean) from public, anon, authenticated;
revoke all on function public.has_live_session() from public, anon, authenticated;
grant execute on function public.has_live_session() to authenticated;
grant execute on function public.bootstrap_first_admin(uuid) to service_role;
grant execute on function public.is_admin(), public.create_admin_invite(text), public.redeem_admin_invite(text),
  public.revoke_admin_invite(bigint), public.list_admin_invites(), public.set_admin_active(uuid, boolean) to authenticated;

create table public.service_categories (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug in ('lube', 'stab', 'keycap', 'sound_mod')),
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '',
  active boolean not null default true,
  position integer not null check (position >= 0)
);
alter table public.service_categories enable row level security;
revoke all on public.service_categories from anon, authenticated;
grant select on public.service_categories to anon, authenticated;
grant insert, update, delete on public.service_categories to authenticated;
grant usage on sequence public.service_categories_id_seq to authenticated;
create policy categories_read on public.service_categories for select to anon, authenticated
  using (active or (select private.is_admin()));
create policy categories_insert on public.service_categories for insert to authenticated with check ((select private.is_admin()));
create policy categories_update on public.service_categories for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy categories_delete on public.service_categories for delete to authenticated using ((select private.is_admin()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('order-media', 'order-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('request-images', 'request-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
create policy admin_media_read on storage.objects for select to authenticated
  using (bucket_id in ('order-media','request-images') and (select private.is_admin()));
create policy admin_media_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('order-media','request-images') and (select private.is_admin()));
create policy admin_media_delete on storage.objects for delete to authenticated
  using (bucket_id in ('order-media','request-images') and (select private.is_admin()));
