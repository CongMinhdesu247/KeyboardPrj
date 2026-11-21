-- Bank reference is distinct from the private tracking capability. Existing orders get one too.
create sequence private.order_payment_reference_seq as bigint maxvalue 9999999999;
alter table private.orders add column payment_reference text not null default ('TK'||lpad(nextval('private.order_payment_reference_seq')::text,10,'0')) unique;
alter table private.orders add constraint order_payment_reference_format check(payment_reference ~ '^TK[0-9]{10}$');
revoke all on sequence private.order_payment_reference_seq from public,anon,authenticated,service_role;
create or replace function private.track_order(p_code text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('code',o.code,'keyboard',o.keyboard,
 'customerDisplayName',split_part(o.customer_name,' ',1)||' ***','customerPhoneMasked','*******'||right(o.phone,3),
 'stage',o.stage,'cancelled',o.cancelled_at is not null,'updatedAt',o.updated_at,
 'paymentLabel',case when (select coalesce(sum(case when p.kind='receipt' then p.amount_vnd else -p.amount_vnd end),0) from private.order_payments p where p.order_id=o.id)>=o.total_vnd then 'Đã thanh toán đủ' when o.stock_committed then 'Đã nhận cọc' else 'Chưa nhận cọc' end,
 'payment',jsonb_build_object('plan',o.plan,'total',o.total_vnd,'deposit',o.deposit_vnd,'reference',o.payment_reference,'received',(select coalesce(sum(case when p.kind='receipt' then p.amount_vnd else -p.amount_vnd end),0) from private.order_payments p where p.order_id=o.id)),
 'services',(select jsonb_agg(l.name||' × '||l.quantity order by l.item_id) from private.order_lines l where l.order_id=o.id),
 'events',coalesce((select jsonb_agg(jsonb_build_object('kind',e.kind,'stage',e.stage,'note',e.note,'path',e.path,'videoUrl',e.video_url,'createdAt',e.created_at) order by e.created_at,e.id) from private.order_events e where e.order_id=o.id),'[]'))
 from private.orders o where o.code=p_code and p_code ~ '^TK-[A-F0-9]{32}$';
$$;
