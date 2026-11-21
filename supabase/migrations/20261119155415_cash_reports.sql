-- Read-only reports from the payment ledger; no derived balance table or ledger writes.
create index order_payments_created_id on private.order_payments(created_at,id);
create function private.cash_report(p_from date,p_to date,p_group text default 'day',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; start_at timestamptz; end_at timestamptz;
begin
 if not public.is_admin() then raise exception 'forbidden'; end if;
 if p_from is null or p_to is null or p_from<date '1900-01-01' or p_to>date '2100-12-31' or p_to<p_from or p_to-p_from>365 or p_group is null or p_group not in ('day','month') or p_page is null or p_page not between 1 and 1000000 then raise exception 'invalid_report_range'; end if;
 start_at:=p_from::timestamp at time zone 'Asia/Ho_Chi_Minh';
 end_at:=(p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh';
 with period as materialized (
  select p.*,o.payment_reference,o.keyboard,o.cancelled_at from private.order_payments p join private.orders o on o.id=p.order_id
  where p.created_at>=start_at and p.created_at<end_at
 ), totals as (
  select coalesce(sum(amount_vnd) filter(where kind='receipt'),0) received,coalesce(sum(amount_vnd) filter(where kind='refund'),0) refunded,count(*) transactions,count(distinct order_id) orders from period
 ), buckets as (
  select date_trunc(p_group,(created_at at time zone 'Asia/Ho_Chi_Minh'))::date bucket,
   coalesce(sum(amount_vnd) filter(where kind='receipt'),0) received,coalesce(sum(amount_vnd) filter(where kind='refund'),0) refunded,count(*) transactions
  from period group by 1
 ), calendar as (
  select g::date bucket from generate_series(date_trunc(p_group,p_from::timestamp),date_trunc(p_group,p_to::timestamp),case when p_group='day' then interval '1 day' else interval '1 month' end) g
 ), balances as (
  select o.id,o.payment_reference,o.keyboard,o.stage,o.plan,o.total_vnd,o.deposit_vnd,o.cancelled_at,o.created_at,
    coalesce(p.net,0) net
  from private.orders o left join lateral(select sum(case when kind='receipt' then amount_vnd else -amount_vnd end) net from private.order_payments where order_id=o.id) p on true
 ), pending as (
  select *,greatest(total_vnd-net,0) remaining from balances where cancelled_at is null and plan='deposit_cod' and net>=deposit_vnd and net<total_vnd
 ), refund_due as (
  select coalesce(sum(greatest(net-deposit_vnd,0)),0) amount,count(*) filter(where net>deposit_vnd) orders from balances where cancelled_at is not null
 )
 select jsonb_build_object(
  'from',p_from,'to',p_to,'group',p_group,'page',p_page,'pageSize',50,'generatedAt',now(),
  'received',totals.received::text,'refunded',totals.refunded::text,'net',(totals.received-totals.refunded)::text,'transactionCount',totals.transactions,'orderCount',totals.orders,
  'series',(select coalesce(jsonb_agg(jsonb_build_object('bucket',c.bucket,'received',coalesce(b.received,0)::text,'refunded',coalesce(b.refunded,0)::text,'net',(coalesce(b.received,0)-coalesce(b.refunded,0))::text,'transactions',coalesce(b.transactions,0)) order by c.bucket),'[]'::jsonb) from calendar c left join buckets b using(bucket)),
  'transactions',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'orderId',r.order_id,'reference',r.payment_reference,'keyboard',r.keyboard,'kind',r.kind,'amount',r.amount_vnd::text,'at',r.created_at,'cancelled',r.cancelled_at is not null) order by r.created_at desc,r.id desc),'[]'::jsonb) from(select * from period order by created_at desc,id desc limit 50 offset (p_page-1)*50) r),
  'pending',jsonb_build_object(
   'count',(select count(*) from pending),'amount',(select coalesce(sum(remaining),0)::text from pending),
   'readyCount',(select count(*) from pending where stage=2),'readyAmount',(select coalesce(sum(remaining),0)::text from pending where stage=2),
   'refundCount',(select orders from refund_due),'refundAmount',(select amount::text from refund_due),
   'items',(select coalesce(jsonb_agg(jsonb_build_object('orderId',r.id,'reference',r.payment_reference,'keyboard',r.keyboard,'stage',r.stage,'remaining',r.remaining::text) order by r.stage desc,r.created_at,r.id),'[]'::jsonb) from(select * from pending order by stage desc,created_at,id limit 50) r)
  )
 ) into result from totals;
 return result;
end; $$;
create function public.cash_report(p_from date,p_to date,p_group text default 'day',p_page integer default 1) returns jsonb language sql stable security invoker set search_path='' as $$select private.cash_report(p_from,p_to,p_group,p_page);$$;
revoke all on function private.cash_report(date,date,text,integer),public.cash_report(date,date,text,integer) from public,anon,authenticated,service_role;
grant execute on function private.cash_report(date,date,text,integer),public.cash_report(date,date,text,integer) to authenticated;
