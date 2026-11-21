create table public.products_services (
  id bigint generated always as identity primary key,
  category_slug text not null references public.service_categories(slug) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  type text not null check (type in ('service','product')),
  unit text not null check (unit in ('phím','bộ','gói')),
  price_vnd bigint check (price_vnd between 0 and 1000000000),
  stock_quantity integer,
  lube_package text check (lube_package in ('switch_33','switch_37','switch_60','switch_68','layout_75','layout_90','layout_100','layout_full')),
  image_path text check (image_path is null or image_path ~ '^[a-f0-9-]{36}\.webp$'),
  active boolean not null default false,
  archived_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((type='service' and stock_quantity is null) or (type='product' and stock_quantity between 0 and 1000000)),
  check (lube_package is null or (type='service' and category_slug='lube' and unit='gói')),
  check (not active or (price_vnd is not null and archived_at is null))
);
create index products_category on public.products_services(category_slug);
create index products_public on public.products_services(category_slug,id) where active and archived_at is null;
create table private.product_costs (
  item_id bigint primary key references public.products_services(id) on delete restrict,
  cost_vnd bigint not null default 0 check (cost_vnd between 0 and 1000000000)
);
create table private.inventory_movements (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.products_services(id) on delete restrict,
  delta integer not null check (delta <> 0 and delta between -1000000 and 1000000),
  balance_after integer not null check (balance_after >= 0),
  reason text not null check (char_length(btrim(reason)) between 3 and 300),
  actor_id uuid not null references public.admin_members(user_id),
  request_id uuid not null unique,
  created_at timestamptz not null default now()
);
create index inventory_item_date on private.inventory_movements(item_id,created_at desc);
create index inventory_actor on private.inventory_movements(actor_id);
alter table public.products_services enable row level security;
alter table private.product_costs enable row level security;
alter table private.inventory_movements enable row level security;
revoke all on public.products_services from public,anon,authenticated;
grant select on public.products_services to anon,authenticated;
revoke all on private.product_costs,private.inventory_movements from public,anon,authenticated;
revoke all on sequence public.products_services_id_seq,private.inventory_movements_id_seq from public,anon,authenticated;
create policy catalog_read on public.products_services for select to anon,authenticated
  using ((active and archived_at is null and exists(select 1 from public.service_categories c where c.slug=category_slug and c.active)) or (select private.is_admin()));

create function private.save_catalog_item(p_item jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id bigint; v_old public.products_services; v_row public.products_services;
  v_category text; v_type text; v_package text; v_price bigint; v_cost bigint; v_name text; v_description text; v_unit text; v_image text; v_active boolean;
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  v_id := nullif(p_item->>'id','')::bigint;
  v_category:=p_item->>'category'; v_type:=p_item->>'type'; v_package:=nullif(p_item->>'lubePackage','');
  v_price:=nullif(p_item->>'price','')::bigint; v_cost:=coalesce(nullif(p_item->>'cost','')::bigint,0);
  v_name:=btrim(p_item->>'name'); v_description:=coalesce(p_item->>'description',''); v_unit:=p_item->>'unit';
  v_image:=nullif(p_item->>'imagePath',''); v_active:=coalesce((p_item->>'active')::boolean,false);
  if v_id is not null then
    select * into v_old from public.products_services where id=v_id for update;
    if not found or v_old.archived_at is not null then return jsonb_build_object('ok',false,'code','not_found'); end if;
    if v_old.version is distinct from (p_item->>'version')::integer then return jsonb_build_object('ok',false,'code','conflict'); end if;
    if v_old.type is distinct from v_type then return jsonb_build_object('ok',false,'code','immutable_type'); end if;
    update public.products_services set category_slug=v_category,name=v_name,description=v_description,unit=v_unit,
      price_vnd=v_price,lube_package=v_package,image_path=v_image,active=v_active,version=version+1,updated_at=now()
      where id=v_id returning * into v_row;
  else
    insert into public.products_services(category_slug,name,description,type,unit,price_vnd,stock_quantity,lube_package,image_path,active)
      values(v_category,v_name,v_description,v_type,v_unit,v_price,case when v_type='product' then 0 else null end,v_package,v_image,v_active)
      returning * into v_row;
  end if;
  insert into private.product_costs(item_id,cost_vnd) values(v_row.id,v_cost) on conflict(item_id) do update set cost_vnd=excluded.cost_vnd;
  insert into private.admin_audit_events(actor_id,action,target_id) values(auth.uid(),case when v_id is null then 'catalog_created' else 'catalog_updated' end,v_row.id::text);
  return jsonb_build_object('ok',true,'id',v_row.id::text);
end; $$;

create function private.archive_catalog_item(p_id bigint,p_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  update public.products_services set active=false,archived_at=now(),version=version+1,updated_at=now()
    where id=p_id and version=p_version and archived_at is null;
  if not found then return jsonb_build_object('ok',false,'code','conflict'); end if;
  insert into private.admin_audit_events(actor_id,action,target_id) values(auth.uid(),'catalog_archived',p_id::text);
  return jsonb_build_object('ok',true);
end; $$;

create function private.adjust_inventory(p_id bigint,p_delta integer,p_reason text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.products_services; v_existing private.inventory_movements; v_balance integer;
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_request_id is null or p_delta is null or p_delta=0 or abs(p_delta::bigint)>1000000 or char_length(btrim(coalesce(p_reason,''))) not between 3 and 300 then
    raise exception 'Invalid inventory input' using errcode='22023';
  end if;
  -- Idempotency lock trước row lock, hai request retry cùng ID không tạo movement trùng.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into v_existing from private.inventory_movements where request_id=p_request_id;
  if found then
    if v_existing.item_id<>p_id or v_existing.delta<>p_delta or v_existing.reason<>btrim(p_reason) or v_existing.actor_id<>auth.uid() then
      return jsonb_build_object('ok',false,'code','request_conflict');
    end if;
    return jsonb_build_object('ok',true,'balance',v_existing.balance_after);
  end if;
  select * into v_row from public.products_services where id=p_id for update;
  if not found or v_row.type<>'product' or v_row.archived_at is not null then return jsonb_build_object('ok',false,'code','not_product'); end if;
  v_balance:=v_row.stock_quantity+p_delta;
  if v_balance not between 0 and 1000000 then return jsonb_build_object('ok',false,'code','stock_limit'); end if;
  update public.products_services set stock_quantity=v_balance,version=version+1,updated_at=now() where id=p_id;
  insert into private.inventory_movements(item_id,delta,balance_after,reason,actor_id,request_id)
    values(p_id,p_delta,v_balance,btrim(p_reason),auth.uid(),p_request_id);
  return jsonb_build_object('ok',true,'balance',v_balance);
end; $$;

create function private.list_catalog_admin() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(i) || jsonb_build_object('id',i.id::text,'cost_vnd',coalesce(c.cost_vnd,0)) order by i.id desc)
    from public.products_services i left join private.product_costs c on c.item_id=i.id where i.archived_at is null),'[]'::jsonb);
end; $$;
create function private.list_inventory_movements(p_id bigint) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(m) || jsonb_build_object('id',m.id::text,'item_id',m.item_id::text) order by m.id desc)
    from (select * from private.inventory_movements where item_id=p_id order by id desc limit 100) m),'[]'::jsonb);
end; $$;

create function public.save_catalog_item(p_item jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.save_catalog_item(p_item); $$;
create function public.archive_catalog_item(p_id bigint,p_version integer) returns jsonb language sql security invoker set search_path='' as $$ select private.archive_catalog_item(p_id,p_version); $$;
create function public.adjust_inventory(p_id bigint,p_delta integer,p_reason text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.adjust_inventory(p_id,p_delta,p_reason,p_request_id); $$;
create function public.list_catalog_admin() returns jsonb language sql security invoker set search_path='' as $$ select private.list_catalog_admin(); $$;
create function public.list_inventory_movements(p_id bigint) returns jsonb language sql security invoker set search_path='' as $$ select private.list_inventory_movements(p_id); $$;
revoke all on function private.save_catalog_item(jsonb),private.archive_catalog_item(bigint,integer),private.adjust_inventory(bigint,integer,text,uuid),private.list_catalog_admin(),private.list_inventory_movements(bigint) from public,anon,authenticated;
revoke all on function public.save_catalog_item(jsonb),public.archive_catalog_item(bigint,integer),public.adjust_inventory(bigint,integer,text,uuid),public.list_catalog_admin(),public.list_inventory_movements(bigint) from public,anon,authenticated;
grant execute on function private.save_catalog_item(jsonb),private.archive_catalog_item(bigint,integer),private.adjust_inventory(bigint,integer,text,uuid),private.list_catalog_admin(),private.list_inventory_movements(bigint) to authenticated;
grant execute on function public.save_catalog_item(jsonb),public.archive_catalog_item(bigint,integer),public.adjust_inventory(bigint,integer,text,uuid),public.list_catalog_admin(),public.list_inventory_movements(bigint) to authenticated;

-- Ảnh catalog là tài sản công khai riêng biệt, KHÔNG đổi private bucket ảnh đơn/yêu cầu.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('catalog-images','catalog-images',true,5242880,array['image/webp']);
create policy catalog_images_admin_read on storage.objects for select to authenticated using(bucket_id='catalog-images' and (select private.is_admin()));
create policy catalog_images_admin_insert on storage.objects for insert to authenticated with check(bucket_id='catalog-images' and (select private.is_admin()));
create policy catalog_images_admin_delete on storage.objects for delete to authenticated using(bucket_id='catalog-images' and (select private.is_admin()));

-- Chỉ tạo gói nháp, KHÔNG gán giá mẫu hoặc nhập tồn giả.
-- Migration phải chạy được trước seed.sql trên database sạch.
insert into public.service_categories(slug,title,description,position) values
  ('lube','Lube & switch','Lube theo số switch hoặc nhóm layout.',0),
  ('stab','Stabilizer','Cân chỉnh stabilizer.',1),
  ('keycap','Keycap & đặt tìm','Keycap có sẵn và tìm mẫu theo yêu cầu.',2),
  ('sound_mod','Tiêu âm & mod','Tinh chỉnh vật liệu tiêu âm.',3)
on conflict(slug) do nothing;
insert into public.products_services(category_slug,name,type,unit,lube_package) values
  ('lube','Lube 33 switch','service','gói','switch_33'),
  ('lube','Lube 37 switch','service','gói','switch_37'),
  ('lube','Lube 60 switch','service','gói','switch_60'),
  ('lube','Lube 68 switch','service','gói','switch_68'),
  ('lube','Lube layout 75','service','gói','layout_75'),
  ('lube','Lube layout 90','service','gói','layout_90'),
  ('lube','Lube layout 100','service','gói','layout_100'),
  ('lube','Lube layout full','service','gói','layout_full');
