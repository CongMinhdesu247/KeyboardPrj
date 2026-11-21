alter table private.accounts
 add column phone text not null default '' check(phone='' or phone ~ '^\+?[0-9]{9,15}$'),
 add column address text not null default '' check(length(address)<=1000);

-- Google owns authentication/email. An identity refresh must not overwrite the shop profile name.
create or replace function private.register_google_account() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.google_verified(new.user_id) then
  insert into private.accounts(user_id,email,display_name,registered_at)
   select u.id,u.email,left(coalesce(u.raw_user_meta_data->>'full_name',''),120),u.created_at from auth.users u where u.id=new.user_id
  on conflict(user_id) do update set email=excluded.email where accounts.status='active';
 end if;
 return new;
end; $$;

create or replace function private.touch_account() returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.accounts;
begin
 if not private.google_verified(auth.uid()) or not exists(select 1 from auth.sessions s where s.user_id=auth.uid() and s.id::text=(auth.jwt()->>'session_id')) then raise exception 'Session required' using errcode='42501'; end if;
 insert into private.accounts(user_id,email,display_name,registered_at)
 select id,email,left(coalesce(raw_user_meta_data->>'full_name',''),120),created_at from auth.users where id=auth.uid() on conflict do nothing;
 update private.accounts set last_seen_at=now() where user_id=auth.uid() and status='active' and (last_seen_at is null or last_seen_at<now()-interval '5 minutes');
 select * into a from private.accounts where user_id=auth.uid();
 return jsonb_build_object('id',a.user_id,'email',a.email,'name',a.display_name,'phone',a.phone,'address',a.address,'version',a.version,'status',a.status,'role',case when exists(select 1 from public.admin_members where user_id=a.user_id) then 'admin' else 'customer' end);
end; $$;

create function private.update_customer_profile(p_name text,p_phone text,p_address text,p_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.accounts;
begin
 select * into a from private.accounts where user_id=auth.uid() for update;
 if not found or a.status<>'active' or not private.has_live_session() or not private.google_verified(auth.uid()) then raise exception 'Account required' using errcode='42501'; end if;
 p_name:=btrim(coalesce(p_name,''));p_phone:=regexp_replace(coalesce(p_phone,''),'[[:space:]().-]','','g');p_address:=btrim(coalesce(p_address,''));
 if length(p_name) not between 1 and 120 or (p_phone<>'' and p_phone !~ '^\+?[0-9]{9,15}$') or length(p_address)>1000 then return jsonb_build_object('ok',false,'code','invalid_input'); end if;
 if a.display_name=p_name and a.phone=p_phone and a.address=p_address then return jsonb_build_object('ok',true,'version',a.version,'profile',jsonb_build_object('name',a.display_name,'phone',a.phone,'address',a.address)); end if;
 if p_version is null or a.version<>p_version then return jsonb_build_object('ok',false,'code','conflict'); end if;
 update private.accounts set display_name=p_name,phone=p_phone,address=p_address,version=version+1 where user_id=auth.uid() returning * into a;
 return jsonb_build_object('ok',true,'version',a.version,'profile',jsonb_build_object('name',a.display_name,'phone',a.phone,'address',a.address));
end; $$;
create function public.update_customer_profile(p_name text,p_phone text,p_address text,p_version integer) returns jsonb language sql security invoker set search_path='' as $$ select private.update_customer_profile(p_name,p_phone,p_address,p_version); $$;
revoke all on function private.update_customer_profile(text,text,text,integer),public.update_customer_profile(text,text,text,integer) from public,anon,authenticated;
grant execute on function private.update_customer_profile(text,text,text,integer),public.update_customer_profile(text,text,text,integer) to authenticated;
