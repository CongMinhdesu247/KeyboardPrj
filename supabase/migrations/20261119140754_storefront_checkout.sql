alter table public.service_categories drop constraint service_categories_slug_check;
alter table public.service_categories add constraint service_categories_slug_check check(slug in ('lube','stab','keycap','sound_mod','keyboard','switch','accessory'));
insert into public.service_categories(slug,title,description,position) values
 ('keyboard','Bàn phím','Bàn phím và kit có sẵn.',4),('switch','Switch','Switch cho cảm giác gõ bạn thích.',5),('accessory','Phụ kiện','Phụ kiện cho góc bàn phím.',6);
alter table private.orders alter column actor_id drop not null;
alter table private.orders add column source text not null default 'admin' check(source in ('admin','web'));
alter table private.orders add column shipping_address text not null default '' check(length(shipping_address)<=1000);
alter table private.orders add column customer_note text not null default '' check(length(customer_note)<=2000);
alter table private.orders add column delivery_method text not null default 'pickup' check(delivery_method in ('ship','pickup'));
alter table private.orders add constraint orders_actor_source check(source='web' or actor_id is not null);
alter table private.order_events alter column actor_id drop not null;
alter table private.order_events add constraint order_event_actor check(actor_id is not null or kind='created');
create table private.checkout_submissions(request_id uuid primary key,order_id uuid unique not null references private.orders(id),payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default now());
alter table private.checkout_submissions enable row level security;
revoke all on private.checkout_submissions from public,anon,authenticated;

create function private.lookup_checkout(p_request uuid,p_hash text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('ok',true,'code',o.code) from private.checkout_submissions s join private.orders o on o.id=s.order_id where s.request_id=p_request and s.payload_hash=p_hash;
$$;
create function private.submit_customer_order(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare request uuid:=(p->>'requestId')::uuid; previous private.checkout_submissions; o private.orders; product public.products_services;
 item jsonb; qty integer; total bigint:=0; snapshot jsonb:='[]'; names text:=''; has_service boolean:=false;
begin
 if request is null or p->>'hash' is null or octet_length(p::text)>30000 then raise exception 'invalid_input'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('checkout:'||request::text,0));
 select * into previous from private.checkout_submissions where request_id=request;
 if found then
  if previous.payload_hash<>p->>'hash' then raise exception 'request_conflict'; end if;
  return (select jsonb_build_object('ok',true,'code',code) from private.orders where id=previous.order_id);
 end if;
 if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') not between 1 and 30 then raise exception 'invalid_items'; end if;
 if (select count(distinct x->>'itemId') from jsonb_array_elements(p->'items') x)<>jsonb_array_length(p->'items') then raise exception 'invalid_items'; end if;
 for item in select x from jsonb_array_elements(p->'items') x order by (x->>'itemId')::bigint loop
  qty:=(item->>'quantity')::integer;
  if qty is null or qty not between 1 and 99 then raise exception 'invalid_items'; end if;
  select * into product from public.products_services where id=(item->>'itemId')::bigint for update;
  if not found or not product.active or product.archived_at is not null or product.price_vnd is null or not exists(select 1 from public.service_categories c where c.slug=product.category_slug and c.active) then raise exception 'unavailable'; end if;
  if product.price_vnd is distinct from (item->>'expectedPrice')::bigint then raise exception 'price_changed'; end if;
  if product.type='product' and coalesce(product.stock_quantity,0)<qty then raise exception 'insufficient_stock'; end if;
  has_service:=has_service or product.type='service';
  names:=names||case when names='' then '' else ', ' end||product.name;
  total:=total+product.price_vnd*qty;
  snapshot:=snapshot||jsonb_build_array(jsonb_build_object('item_id',product.id,'name',product.name,'type',product.type,'unit',product.unit,'quantity',qty,'price_vnd',product.price_vnd,'cost_vnd',coalesce((select cost_vnd from private.product_costs where item_id=product.id),0)));
 end loop;
 if has_service and length(btrim(coalesce(p->>'keyboard',''))) not between 1 and 200 then raise exception 'keyboard_required'; end if;
 if p->>'delivery' not in ('ship','pickup') or p->>'plan' not in ('deposit_cod','transfer_full') then raise exception 'invalid_input'; end if;
 if p->>'delivery'='ship' and length(btrim(coalesce(p->>'address',''))) not between 10 and 1000 then raise exception 'address_required'; end if;
 insert into private.orders(code,customer_name,phone,keyboard,plan,total_vnd,actor_id,source,shipping_address,customer_note,delivery_method,shipping_note)
 values(p->>'code',btrim(p->>'customerName'),p->>'phone',case when has_service then btrim(p->>'keyboard') else left('Đơn mua hàng · '||names,200) end,p->>'plan',total,null,'web',case when p->>'delivery'='ship' then btrim(p->>'address') else '' end,coalesce(p->>'note',''),p->>'delivery',case when p->>'delivery'='ship' then 'Chưa gồm phí ship; shop xác nhận riêng trước khi gửi.' else 'Khách nhận tại shop, liên hệ để hẹn.' end) returning * into o;
 insert into private.order_lines select o.id,s.item_id,s.name,s.type,s.unit,s.quantity,s.price_vnd,s.cost_vnd from jsonb_to_recordset(snapshot) as s(item_id bigint,name text,type text,unit text,quantity integer,price_vnd bigint,cost_vnd bigint);
 insert into private.order_events(order_id,kind,stage,note,actor_id) values(o.id,'created',0,'Shop đã nhận đơn đặt từ website, chờ xác nhận thanh toán.',null);
 insert into private.checkout_submissions(request_id,order_id,payload_hash) values(request,o.id,p->>'hash');
 return jsonb_build_object('ok',true,'code',o.code);
exception when raise_exception then return jsonb_build_object('ok',false,'error',sqlerrm);
 when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('ok',false,'error','invalid_input');
end; $$;
create function public.lookup_checkout(p_request uuid,p_hash text) returns jsonb language sql security invoker set search_path='' as $$select private.lookup_checkout(p_request,p_hash);$$;
create function public.submit_customer_order(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.submit_customer_order(p);$$;
revoke all on function private.lookup_checkout(uuid,text),public.lookup_checkout(uuid,text),private.submit_customer_order(jsonb),public.submit_customer_order(jsonb) from public,anon,authenticated;
grant execute on function private.lookup_checkout(uuid,text),public.lookup_checkout(uuid,text),private.submit_customer_order(jsonb),public.submit_customer_order(jsonb) to service_role;
