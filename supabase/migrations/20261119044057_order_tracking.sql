-- M3: all business writes are atomic commands. Public capability reads are server-only.
create table private.orders (
 id uuid primary key default gen_random_uuid(), code text unique not null check(code ~ '^TK-[A-F0-9]{32}$'),
 customer_name text not null check(length(customer_name) between 1 and 120),
 phone text not null check(phone ~ '^\+?[0-9]{9,15}$'), keyboard text not null check(length(keyboard) between 1 and 200),
 internal_note text not null default '' check(length(internal_note)<=2000), shipping_note text not null default '' check(length(shipping_note)<=500),
 plan text not null check(plan in ('deposit_cod','transfer_full')), total_vnd bigint not null check(total_vnd between 1 and 1000000000000),
 deposit_vnd bigint generated always as ((total_vnd+4)/5) stored,
 stage integer not null default 0 check(stage between 0 and 2), stock_committed boolean not null default false,
 cancelled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 actor_id uuid not null references public.admin_members(user_id)
);
create index orders_created on private.orders(created_at desc);
create index orders_actor on private.orders(actor_id);
create table private.order_lines (
 order_id uuid not null references private.orders(id), item_id bigint not null references public.products_services(id),
 name text not null, type text not null check(type in ('service','product')), unit text not null,
 quantity integer not null check(quantity between 1 and 999), price_vnd bigint not null, cost_vnd bigint not null,
 primary key(order_id,item_id)
);
create index order_lines_item on private.order_lines(item_id);
create table private.order_payments (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references private.orders(id),
 kind text not null check(kind in ('receipt','refund')), amount_vnd bigint not null check(amount_vnd>0),
 method text not null check(method in ('bank','cod')), reference text not null check(length(reference) between 3 and 300),
 actor_id uuid not null references public.admin_members(user_id), created_at timestamptz not null default now()
);
create index order_payments_order on private.order_payments(order_id,created_at);
create index order_payments_actor on private.order_payments(actor_id);
create table private.order_events (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references private.orders(id),
 kind text not null check(kind in ('created','stage','proof','cancel')), stage integer not null check(stage between 0 and 2),
 note text not null default '' check(length(note)<=1000), path text, video_url text,
 actor_id uuid not null references public.admin_members(user_id), created_at timestamptz not null default now()
);
create index order_events_order on private.order_events(order_id,created_at);
create index order_events_actor on private.order_events(actor_id);
create table private.order_commands (
 request_id uuid primary key, order_id uuid not null references private.orders(id), actor_id uuid not null references public.admin_members(user_id),
 payload jsonb not null, created_at timestamptz not null default now()
);
create index order_commands_order on private.order_commands(order_id);
create index order_commands_actor on private.order_commands(actor_id);
alter table private.inventory_movements add column order_id uuid references private.orders(id);
create index inventory_order on private.inventory_movements(order_id) where order_id is not null;
alter table private.orders enable row level security;
alter table private.order_lines enable row level security;
alter table private.order_payments enable row level security;
alter table private.order_events enable row level security;
alter table private.order_commands enable row level security;
revoke all on private.orders,private.order_lines,private.order_payments,private.order_events,private.order_commands from public,anon,authenticated;

create function private.order_command(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 o private.orders; previous private.order_commands; product public.products_services;
 line record; item jsonb; request uuid; action text; oid uuid; amount bigint; net bigint; total bigint:=0;
 quantity integer; balance integer; returned integer; clean jsonb; snapshot jsonb:='[]';
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 request:=(p->>'requestId')::uuid; action:=p->>'action';
 if request is null or action is null or octet_length(p::text)>30000 then raise exception 'invalid_input'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(request::text,0));
 clean:=p-'code';
 select * into previous from private.order_commands where request_id=request;
 if found then
  if previous.payload<>clean or previous.actor_id<>auth.uid() then raise exception 'request_conflict'; end if;
  return jsonb_build_object('ok',true,'id',previous.order_id);
 end if;
 if action='create' then
  if jsonb_typeof(p->'items')<>'array' or jsonb_array_length(p->'items') not between 1 and 50 then raise exception 'invalid_items'; end if;
  if (select count(distinct x->>'itemId') from jsonb_array_elements(p->'items') x)<>jsonb_array_length(p->'items') then raise exception 'invalid_items'; end if;
  -- Lock in ID order, shared with receipt/cancellation inventory operations.
  for item in select x from jsonb_array_elements(p->'items') x order by (x->>'itemId')::bigint loop
   quantity:=(item->>'quantity')::integer;
   if quantity is null or quantity not between 1 and 999 then raise exception 'invalid_items'; end if;
   select * into product from public.products_services where id=(item->>'itemId')::bigint for update;
   if not found or not product.active or product.archived_at is not null or product.price_vnd is null
    or product.version is distinct from (item->>'version')::integer
    or not exists(select 1 from public.service_categories c where c.slug=product.category_slug and c.active)
    then raise exception 'catalog_changed'; end if;
   total:=total+product.price_vnd*quantity;
   snapshot:=snapshot || jsonb_build_array(jsonb_build_object('item_id',product.id,'name',product.name,'type',product.type,'unit',product.unit,'quantity',quantity,'price_vnd',product.price_vnd,
     'cost_vnd',coalesce((select c.cost_vnd from private.product_costs c where c.item_id=product.id),0)));
  end loop;
  if total not between 1 and 1000000000000 then raise exception 'invalid_total'; end if;
  insert into private.orders(code,customer_name,phone,keyboard,internal_note,shipping_note,plan,total_vnd,actor_id)
  values(p->>'code',btrim(p->>'customerName'),p->>'phone',btrim(p->>'keyboard'),coalesce(p->>'internalNote',''),coalesce(p->>'shippingNote',''),p->>'plan',total,auth.uid()) returning * into o;
  insert into private.order_lines select o.id,s.item_id,s.name,s.type,s.unit,s.quantity,s.price_vnd,s.cost_vnd
   from jsonb_to_recordset(snapshot) as s(item_id bigint,name text,type text,unit text,quantity integer,price_vnd bigint,cost_vnd bigint);
  insert into private.order_events(order_id,kind,stage,actor_id) values(o.id,'created',0,auth.uid());
 else
  oid:=(p->>'orderId')::uuid;
  select * into o from private.orders where id=oid for update;
  if not found then raise exception 'order_missing'; end if;
  select coalesce(sum(case when kind='receipt' then amount_vnd else -amount_vnd end),0) into net from private.order_payments where order_id=o.id;
  if action in ('receipt','refund') then
   amount:=(p->>'amount')::bigint;
   if amount is null or amount<=0 or length(btrim(coalesce(p->>'reference',''))) not between 3 and 300 then raise exception 'invalid_payment'; end if;
   if action='receipt' then
    if o.cancelled_at is not null then raise exception 'cancelled'; end if;
    if (net=0 and (amount<>case when o.plan='deposit_cod' then o.deposit_vnd else o.total_vnd end or p->>'method'<>'bank'))
     or (net>0 and (amount<>o.total_vnd-net or o.stage<>2 or p->>'method'<>'cod' or o.plan<>'deposit_cod')) then raise exception 'payment_rule'; end if;
    if net>=o.total_vnd then raise exception 'already_paid'; end if;
    if not o.stock_committed then
     -- Validate every stock line BEFORE deductions; exception also rolls back the whole command.
     for line in select l.* from private.order_lines l where l.order_id=o.id and l.type='product' order by l.item_id loop
      select * into product from public.products_services where id=line.item_id for update;
      if product.stock_quantity<line.quantity then raise exception 'insufficient_stock'; end if;
     end loop;
     for line in select l.* from private.order_lines l where l.order_id=o.id and l.type='product' order by l.item_id loop
      update public.products_services set stock_quantity=stock_quantity-line.quantity,version=version+1,updated_at=now() where id=line.item_id returning stock_quantity into balance;
      insert into private.inventory_movements(item_id,delta,balance_after,reason,actor_id,request_id,order_id)
       values(line.item_id,-line.quantity,balance,'Nhận tiền đơn hàng',auth.uid(),gen_random_uuid(),o.id);
     end loop;
     update private.orders set stock_committed=true where id=o.id;
    end if;
   else
    if o.cancelled_at is null or amount>greatest(net-o.deposit_vnd,0) or p->>'method'<>'bank' then raise exception 'refund_rule'; end if;
   end if;
   insert into private.order_payments(order_id,kind,amount_vnd,method,reference,actor_id)
    values(o.id,action,amount,p->>'method',btrim(p->>'reference'),auth.uid());
  elsif action='advance' then
   if o.cancelled_at is not null then raise exception 'cancelled'; end if;
   if o.stage is distinct from (p->>'expectedStage')::integer or o.stage=2 then raise exception 'stage_conflict'; end if;
   if net<o.deposit_vnd or not o.stock_committed then raise exception 'deposit_required'; end if;
   update private.orders set stage=stage+1 where id=o.id;
   insert into private.order_events(order_id,kind,stage,note,actor_id) values(o.id,'stage',o.stage+1,coalesce(p->>'note',''),auth.uid());
  elsif action='cancel' then
   if o.cancelled_at is not null or o.stage=2 then raise exception 'cancel_rule'; end if;
   if length(btrim(coalesce(p->>'reason',''))) not between 3 and 1000 then raise exception 'invalid_reason'; end if;
   if jsonb_typeof(p->'returns') is distinct from 'object' then raise exception 'invalid_returns'; end if;
   if exists(select 1 from jsonb_object_keys(p->'returns') k where not exists(select 1 from private.order_lines l where l.order_id=o.id and l.type='product' and l.item_id::text=k)) then raise exception 'invalid_returns'; end if;
   for line in select l.* from private.order_lines l where l.order_id=o.id and l.type='product' order by l.item_id loop
    returned:=coalesce((p->'returns'->>line.item_id::text)::integer,0);
    if returned<0 or returned>line.quantity or (returned>0 and not o.stock_committed) then raise exception 'invalid_returns'; end if;
    if returned>0 then
     select * into product from public.products_services where id=line.item_id for update;
     balance:=product.stock_quantity+returned;
     if balance>1000000 then raise exception 'stock_limit'; end if;
     update public.products_services set stock_quantity=balance,version=version+1,updated_at=now() where id=line.item_id;
     insert into private.inventory_movements(item_id,delta,balance_after,reason,actor_id,request_id,order_id)
      values(line.item_id,returned,balance,'Thu hồi linh kiện shop khi hủy',auth.uid(),gen_random_uuid(),o.id);
    end if;
   end loop;
   update private.orders set cancelled_at=now() where id=o.id;
   insert into private.order_events(order_id,kind,stage,note,actor_id) values(o.id,'cancel',o.stage,'Đơn đã hủy. Liên hệ shop để nhận lại tài sản của khách.',auth.uid());
  elsif action='proof' then
   if o.cancelled_at is not null then raise exception 'cancelled'; end if;
   if (p->>'stage')::integer is null or (p->>'stage')::integer not between 0 and o.stage then raise exception 'stage_conflict'; end if;
   if nullif(p->>'path','') is not null and (p->>'path') !~ ('^'||o.id::text||'/[a-f0-9-]{36}\.(webp|mp4)$') then raise exception 'invalid_media'; end if;
   if nullif(p->>'videoUrl','') is not null and (p->>'videoUrl') !~ '^https://(www\.)?(youtube\.com|youtu\.be|tiktok\.com)/[^[:space:]]{1,500}$' then raise exception 'invalid_media'; end if;
   if length(btrim(coalesce(p->>'note','')))=0 and nullif(p->>'path','') is null and nullif(p->>'videoUrl','') is null then raise exception 'invalid_media'; end if;
   insert into private.order_events(order_id,kind,stage,note,path,video_url,actor_id)
    values(o.id,'proof',(p->>'stage')::integer,coalesce(p->>'note',''),nullif(p->>'path',''),nullif(p->>'videoUrl',''),auth.uid());
  else raise exception 'invalid_action'; end if;
  update private.orders set updated_at=now() where id=o.id;
 end if;
 insert into private.order_commands(request_id,order_id,actor_id,payload) values(request,o.id,auth.uid(),clean);
 insert into private.admin_audit_events(actor_id,action,target_id) values(auth.uid(),'order_'||action,o.id::text);
 return jsonb_build_object('ok',true,'id',o.id);
exception when raise_exception then
 return jsonb_build_object('ok',false,'code',sqlerrm);
 when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then
 return jsonb_build_object('ok',false,'code','invalid_input');
end; $$;

create function private.read_order(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 select to_jsonb(o)||jsonb_build_object(
  'items',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('item_id',l.item_id::text) order by l.item_id) from private.order_lines l where l.order_id=o.id),'[]'),
  'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at,p.id) from private.order_payments p where p.order_id=o.id),'[]'),
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at,e.id) from private.order_events e where e.order_id=o.id),'[]')) into result from private.orders o where o.id=p_id;
 return result;
end; $$;
create function private.list_orders() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at desc) from (select id,code,customer_name,keyboard,stage,total_vnd,cancelled_at,created_at from private.orders order by created_at desc limit 200) o),'[]');
end; $$;
create function private.track_order(p_code text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('code',o.code,'keyboard',o.keyboard,
 'customerDisplayName',split_part(o.customer_name,' ',1)||' ***','customerPhoneMasked','*******'||right(o.phone,3),
 'stage',o.stage,'cancelled',o.cancelled_at is not null,'updatedAt',o.updated_at,
 'paymentLabel',case when (select coalesce(sum(case when p.kind='receipt' then p.amount_vnd else -p.amount_vnd end),0) from private.order_payments p where p.order_id=o.id)>=o.total_vnd then 'Đã thanh toán đủ' when o.stock_committed then 'Đã nhận cọc' else 'Chưa nhận cọc' end,
 'services',(select jsonb_agg(l.name||' × '||l.quantity order by l.item_id) from private.order_lines l where l.order_id=o.id),
 'events',coalesce((select jsonb_agg(jsonb_build_object('kind',e.kind,'stage',e.stage,'note',e.note,'path',e.path,'videoUrl',e.video_url,'createdAt',e.created_at) order by e.created_at,e.id) from private.order_events e where e.order_id=o.id),'[]'))
 from private.orders o where o.code=p_code and p_code ~ '^TK-[A-F0-9]{32}$';
$$;
create function public.order_command(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.order_command(p);$$;
create function public.read_order(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.read_order(p_id);$$;
create function public.list_orders() returns jsonb language sql security invoker set search_path='' as $$select private.list_orders();$$;
create function public.track_order(p_code text) returns jsonb language sql security invoker set search_path='' as $$select private.track_order(p_code);$$;
revoke all on function private.order_command(jsonb),private.read_order(uuid),private.list_orders(),private.track_order(text),public.order_command(jsonb),public.read_order(uuid),public.list_orders(),public.track_order(text) from public,anon,authenticated,service_role;
grant execute on function private.order_command(jsonb),private.read_order(uuid),private.list_orders(),public.order_command(jsonb),public.read_order(uuid),public.list_orders() to authenticated;
grant usage on schema private to service_role;
grant execute on function private.track_order(text),public.track_order(text) to service_role;
