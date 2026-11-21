create function private.order_payment_available(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select o.source<>'web' or o.stock_committed or not exists(select 1 from private.order_lines l join public.products_services i on i.id=l.item_id join public.service_categories c on c.slug=i.category_slug where l.order_id=o.id and (i.archived_at is not null or not i.active or not c.active or (l.type='product' and coalesce(i.stock_quantity,0)<l.quantity))) from private.orders o where o.id=p_id;
$$;
revoke all on function private.order_payment_available(uuid) from public,anon,authenticated,service_role;
create or replace function private.read_order(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 select to_jsonb(o)||jsonb_build_object(
  'payment_available',private.order_payment_available(o.id),
  'items',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('item_id',l.item_id::text) order by l.item_id) from private.order_lines l where l.order_id=o.id),'[]'),
  'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at,p.id) from private.order_payments p where p.order_id=o.id),'[]'),
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at,e.id) from private.order_events e where e.order_id=o.id),'[]')) into result from private.orders o where o.id=p_id;
 return result;
end; $$;
create or replace function private.track_order(p_code text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('code',o.code,'keyboard',o.keyboard,
 'customerDisplayName',split_part(o.customer_name,' ',1)||' ***','customerPhoneMasked','*******'||right(o.phone,3),
 'stage',o.stage,'cancelled',o.cancelled_at is not null,'updatedAt',o.updated_at,
 'paymentLabel',case when (select coalesce(sum(case when p.kind='receipt' then p.amount_vnd else -p.amount_vnd end),0) from private.order_payments p where p.order_id=o.id)>=o.total_vnd then 'Đã thanh toán đủ' when o.stock_committed then 'Đã nhận cọc' else 'Chưa nhận cọc' end,
 'payment',jsonb_build_object('plan',o.plan,'total',o.total_vnd,'deposit',o.deposit_vnd,'reference',o.payment_reference,'available',private.order_payment_available(o.id),'received',(select coalesce(sum(case when p.kind='receipt' then p.amount_vnd else -p.amount_vnd end),0) from private.order_payments p where p.order_id=o.id)),
 'services',(select jsonb_agg(l.name||' × '||l.quantity order by l.item_id) from private.order_lines l where l.order_id=o.id),
 'events',coalesce((select jsonb_agg(jsonb_build_object('kind',e.kind,'stage',e.stage,'note',e.note,'path',e.path,'videoUrl',e.video_url,'createdAt',e.created_at) order by e.created_at,e.id) from private.order_events e where e.order_id=o.id),'[]'))
 from private.orders o where o.code=p_code and p_code ~ '^TK-[A-F0-9]{32}$';
$$;
