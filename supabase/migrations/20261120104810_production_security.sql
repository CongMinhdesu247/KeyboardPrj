-- Public authenticated RPCs must enforce abuse limits themselves.
create or replace function private.submit_account_order(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; owner uuid; state text; request uuid:=(p->>'requestId')::uuid;
begin
 select status into state from private.accounts where user_id=auth.uid() for share;
 if state is distinct from 'active' or not private.has_live_session() or not private.google_verified(auth.uid()) then raise exception 'Account required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('checkout:'||request::text,0));
 if exists(select 1 from private.checkout_submissions where request_id=request) then
  select o.customer_user_id into owner from private.checkout_submissions s join private.orders o on o.id=s.order_id where s.request_id=request;
  if owner is distinct from auth.uid() then raise exception 'Order ownership conflict' using errcode='42501'; end if;
 else
  -- Enforced at the exposed RPC boundary; a caller cannot reset this key via cookie/payload.
  -- MD5 here only derives a fixed-length bucket ID, never a password or capability.
  if not private.consume_request_budget(pg_catalog.md5('account-checkout:'||auth.uid()::text)||pg_catalog.md5('account-checkout-2:'||auth.uid()::text)) then
   return jsonb_build_object('ok',false,'error','quota');
  end if;
 end if;
 result:=private.submit_customer_order(p);
 if (result->>'ok')::boolean then update private.orders set customer_user_id=auth.uid() where code=result->>'code' and customer_user_id is null; end if;
 return result;
end; $$;

