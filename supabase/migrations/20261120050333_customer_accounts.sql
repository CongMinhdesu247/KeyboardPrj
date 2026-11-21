create table private.accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null, display_name text not null default '',
 status text not null default 'active' check(status in ('active','banned','deleted')),
 registered_at timestamptz not null default now(), last_seen_at timestamptz,
 version integer not null default 1, reason text not null default '' check(length(reason)<=500)
);
alter table private.accounts enable row level security;
revoke all on private.accounts from public,anon,authenticated;
create index accounts_registered on private.accounts(registered_at);
create index accounts_last_seen on private.accounts(last_seen_at) where status='active';
alter table private.orders add column customer_user_id uuid references auth.users(id) on delete set null;
create index orders_customer_user on private.orders(customer_user_id,created_at desc);

create function private.register_google_account() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.google_verified(new.user_id) then
  insert into private.accounts(user_id,email,display_name,registered_at)
   select u.id,u.email,left(coalesce(u.raw_user_meta_data->>'full_name',''),120),u.created_at from auth.users u where u.id=new.user_id
  on conflict(user_id) do update set email=excluded.email,display_name=excluded.display_name where accounts.status='active';
 end if;
 return new;
end; $$;
revoke all on function private.register_google_account() from public,anon,authenticated;
create trigger register_google_account after insert or update on auth.identities for each row execute function private.register_google_account();
insert into private.accounts(user_id,email,display_name,registered_at)
 select id,email,left(coalesce(raw_user_meta_data->>'full_name',''),120),created_at from auth.users where private.google_verified(id);

-- Account restrictions are checked against DB on every privileged operation, including stale JWTs.
create or replace function private.has_live_session() returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from auth.sessions s where s.user_id=(select auth.uid()) and s.id::text=((select auth.jwt())->>'session_id'))
 and not exists(select 1 from private.accounts a where a.user_id=(select auth.uid()) and a.status<>'active');
$$;
create function private.touch_account() returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.accounts;
begin
 if not private.google_verified(auth.uid()) or not exists(select 1 from auth.sessions s where s.user_id=auth.uid() and s.id::text=(auth.jwt()->>'session_id')) then raise exception 'Session required' using errcode='42501'; end if;
 insert into private.accounts(user_id,email,display_name,registered_at)
 select id,email,left(coalesce(raw_user_meta_data->>'full_name',''),120),created_at from auth.users where id=auth.uid() on conflict do nothing;
 update private.accounts set last_seen_at=now() where user_id=auth.uid() and status='active' and (last_seen_at is null or last_seen_at<now()-interval '5 minutes');
 select * into a from private.accounts where user_id=auth.uid();
 return jsonb_build_object('id',a.user_id,'email',a.email,'name',a.display_name,'status',a.status,'role',case when exists(select 1 from public.admin_members where user_id=a.user_id) then 'admin' else 'customer' end);
end; $$;

create function private.submit_account_order(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; owner uuid; request uuid:=(p->>'requestId')::uuid;
begin
 if not private.has_live_session() or not private.google_verified(auth.uid()) or not exists(select 1 from private.accounts where user_id=auth.uid() and status='active') then raise exception 'Account required' using errcode='42501'; end if;
 -- Serialize with the existing guest command. Ownership and checkout commit together.
 perform pg_advisory_xact_lock(hashtextextended('checkout:'||request::text,0));
 if exists(select 1 from private.checkout_submissions where request_id=request) then
  select o.customer_user_id into owner from private.checkout_submissions s join private.orders o on o.id=s.order_id where s.request_id=request;
  if owner is distinct from auth.uid() then raise exception 'Order ownership conflict' using errcode='42501'; end if;
 end if;
 result:=private.submit_customer_order(p);
 if (result->>'ok')::boolean then update private.orders set customer_user_id=auth.uid() where code=result->>'code' and customer_user_id is null; end if;
 return result;
end; $$;

create function private.my_orders(p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_live_session() or not private.google_verified(auth.uid()) then raise exception 'Account required' using errcode='42501'; end if;
 if p_offset<0 or p_offset>1000000 then raise exception 'Invalid offset'; end if;
 return jsonb_build_object('total',(select count(*) from private.orders where customer_user_id=auth.uid()),'orders',coalesce((select jsonb_agg(v) from (
 select code,keyboard,total_vnd,stage,cancelled_at,created_at from private.orders where customer_user_id=auth.uid() order by created_at desc,id desc limit 20 offset p_offset) v),'[]'::jsonb));
end; $$;

create function private.account_report(p_query text default '',p_status text default 'all',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if length(p_query)>120 or p_status not in ('all','active','banned','deleted','customer','admin') or p_offset<0 or p_offset>1000000 then raise exception 'Invalid filter'; end if;
 return jsonb_build_object('total',(select count(*) from private.accounts where status<>'deleted'),
 'customers',(select count(*) from private.accounts a where status<>'deleted' and not exists(select 1 from public.admin_members m where m.user_id=a.user_id)),
 'admins',(select count(*) from private.accounts a where status<>'deleted' and exists(select 1 from public.admin_members m where m.user_id=a.user_id)),
 'banned',(select count(*) from private.accounts where status='banned'),
 'deleted',(select count(*) from private.accounts where status='deleted'),
 'active30',(select count(*) from private.accounts where status='active' and last_seen_at>=now()-interval '30 days'),
 'daily',(select jsonb_agg(jsonb_build_object('date',d::date,'count',(select count(*) from private.accounts where registered_at>=d at time zone 'Asia/Ho_Chi_Minh' and registered_at<(d+interval '1 day') at time zone 'Asia/Ho_Chi_Minh'))) from generate_series((today-29)::timestamp,today::timestamp,interval '1 day') d),
 'matched',(select count(*) from private.accounts a where (p_status='all' and status<>'deleted' or p_status=status or p_status='admin' and exists(select 1 from public.admin_members where user_id=a.user_id) or p_status='customer' and not exists(select 1 from public.admin_members where user_id=a.user_id)) and (p_status in ('deleted') or status<>'deleted') and (position(lower(p_query) in lower(email||' '||display_name))>0)),
 'accounts',coalesce((select jsonb_agg(v) from (select a.user_id as id,a.email,a.display_name as name,a.status,a.registered_at,a.last_seen_at,a.version,a.reason,
 case when exists(select 1 from public.admin_members where user_id=a.user_id) then 'admin' else 'customer' end as role,
 (select count(*) from private.orders where customer_user_id=a.user_id) as order_count
 from private.accounts a where (p_status='all' and status<>'deleted' or p_status=status or p_status='admin' and exists(select 1 from public.admin_members where user_id=a.user_id) or p_status='customer' and not exists(select 1 from public.admin_members where user_id=a.user_id)) and (p_status='deleted' or status<>'deleted') and position(lower(p_query) in lower(email||' '||display_name))>0 order by registered_at desc,user_id limit 20 offset p_offset) v),'[]'::jsonb));
end; $$;

create function private.manage_account(p_id uuid,p_version integer,p_action text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.accounts; next_status text;
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if p_id=auth.uid() or exists(select 1 from public.admin_members where user_id=p_id) then return jsonb_build_object('ok',false,'code','protected_admin'); end if;
 if p_action not in ('ban','unban','delete') or length(btrim(coalesce(p_reason,''))) not between 3 and 500 then return jsonb_build_object('ok',false,'code','invalid_input'); end if;
 select * into a from private.accounts where user_id=p_id for update;
 if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
 next_status:=case p_action when 'ban' then 'banned' when 'unban' then 'active' else 'deleted' end;
 if a.status=next_status then return jsonb_build_object('ok',true); end if;
 if a.status='deleted' or a.version<>p_version then return jsonb_build_object('ok',false,'code','conflict'); end if;
 update private.accounts set status=next_status,version=version+1,reason=btrim(p_reason) where user_id=p_id;
 if next_status<>'active' then delete from auth.sessions where user_id=p_id; end if;
 insert into private.admin_audit_events(actor_id,action,target_id) values(auth.uid(),'account_'||p_action,p_id::text);
 return jsonb_build_object('ok',true);
end; $$;

create function public.touch_account() returns jsonb language sql security invoker set search_path='' as $$ select private.touch_account(); $$;
create function public.submit_account_order(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.submit_account_order(p); $$;
create function public.my_orders(p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$ select private.my_orders(p_offset); $$;
create function public.account_report(p_query text default '',p_status text default 'all',p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$ select private.account_report(p_query,p_status,p_offset); $$;
create function public.manage_account(p_id uuid,p_version integer,p_action text,p_reason text) returns jsonb language sql security invoker set search_path='' as $$ select private.manage_account(p_id,p_version,p_action,p_reason); $$;
revoke all on function private.touch_account(),private.submit_account_order(jsonb),private.my_orders(integer),private.account_report(text,text,integer),private.manage_account(uuid,integer,text,text),public.touch_account(),public.submit_account_order(jsonb),public.my_orders(integer),public.account_report(text,text,integer),public.manage_account(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function private.touch_account(),private.submit_account_order(jsonb),private.my_orders(integer),private.account_report(text,text,integer),private.manage_account(uuid,integer,text,text),public.touch_account(),public.submit_account_order(jsonb),public.my_orders(integer),public.account_report(text,text,integer),public.manage_account(uuid,integer,text,text) to authenticated;
