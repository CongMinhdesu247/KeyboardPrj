create function private.guard_account_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'active' and exists(select 1 from public.admin_members where user_id=new.user_id) then raise exception 'Protected admin' using errcode='42501'; end if;
 return new;
end; $$;
create trigger guard_account_status before update of status on private.accounts for each row execute function private.guard_account_status();
create function private.guard_account_promotion() returns trigger language plpgsql security definer set search_path='' as $$
declare state text;
begin
 select status into state from private.accounts where user_id=new.user_id for update;
 if state is not null and state<>'active' then raise exception 'Account restricted' using errcode='42501'; end if;
 return new;
end; $$;
create trigger guard_account_promotion before insert or update on public.admin_members for each row execute function private.guard_account_promotion();
revoke all on function private.guard_account_status(),private.guard_account_promotion() from public,anon,authenticated;

create or replace function private.submit_account_order(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; owner uuid; state text; request uuid:=(p->>'requestId')::uuid;
begin
 select status into state from private.accounts where user_id=auth.uid() for share;
 if state is distinct from 'active' or not private.has_live_session() or not private.google_verified(auth.uid()) then raise exception 'Account required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('checkout:'||request::text,0));
 if exists(select 1 from private.checkout_submissions where request_id=request) then
  select o.customer_user_id into owner from private.checkout_submissions s join private.orders o on o.id=s.order_id where s.request_id=request;
  if owner is distinct from auth.uid() then raise exception 'Order ownership conflict' using errcode='42501'; end if;
 end if;
 result:=private.submit_customer_order(p);
 if (result->>'ok')::boolean then update private.orders set customer_user_id=auth.uid() where code=result->>'code' and customer_user_id is null; end if;
 return result;
end; $$;

create function private.customer_orders(p_user uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(v)) from (select id,code,customer_name,keyboard,stage,total_vnd,cancelled_at,created_at,customer_user_id from private.orders where customer_user_id=p_user order by created_at desc,id desc limit 200) v),'[]'::jsonb);
end; $$;
create function public.customer_orders(p_user uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.customer_orders(p_user); $$;
revoke all on function private.customer_orders(uuid),public.customer_orders(uuid) from public,anon,authenticated;
grant execute on function private.customer_orders(uuid),public.customer_orders(uuid) to authenticated;
