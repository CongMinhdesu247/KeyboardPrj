-- Guest capabilities are server-generated; only hashes cross the database boundary.
create table private.chat_sessions (
 id uuid primary key default gen_random_uuid(), token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 days',
 handoff_at timestamptz, last_message_at timestamptz not null default now()
);
create table private.chat_turns (
 id uuid primary key, session_id uuid not null references private.chat_sessions(id),
 customer_text text not null check(length(btrim(customer_text)) between 1 and 1000),
 assistant_text text check(length(assistant_text)<=3000),
 status text not null default 'pending' check(status in ('pending','done')),
 mode text check(mode in ('ai','fallback')), lease uuid not null default gen_random_uuid(),
 lease_until timestamptz not null default now()+interval '45 seconds', created_at timestamptz not null default now(),
 check((status='pending' and assistant_text is null) or (status='done' and assistant_text is not null))
);
create index chat_turns_session_created on private.chat_turns(session_id,created_at,id);
create index chat_sessions_recent on private.chat_sessions(last_message_at desc);
create table private.chat_budgets(day date primary key, turns integer not null check(turns>=0));
create table private.notification_outbox (
 id uuid primary key default gen_random_uuid(), event_key text not null unique,
 event_type text not null check(event_type in ('order_created','order_stage','order_cancel','order_receipt','order_refund','request_created','chat_handoff')),
 entity_id uuid not null, attempts integer not null default 0 check(attempts between 0 and 5),
 next_attempt_at timestamptz not null default now(), lease uuid, lease_until timestamptz,
 sent_at timestamptz, last_error text check(last_error in ('network','provider','rate_limit')),
 created_at timestamptz not null default now()
);
create index notification_due on private.notification_outbox(next_attempt_at) where sent_at is null and attempts<5;
alter table private.chat_sessions enable row level security;
alter table private.chat_turns enable row level security;
alter table private.chat_budgets enable row level security;
alter table private.notification_outbox enable row level security;
revoke all on private.chat_sessions,private.chat_turns,private.chat_budgets,private.notification_outbox from public,anon,authenticated,service_role;

create function private.chat_history(p_hash text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'customer',t.customer_text,'assistant',t.assistant_text,'mode',t.mode,'status',t.status,'createdAt',t.created_at) order by t.created_at,t.id),'[]'::jsonb)
 from (select t.* from private.chat_turns t join private.chat_sessions s on s.id=t.session_id where s.token_hash=p_hash and s.expires_at>now() order by t.created_at desc,t.id desc limit 20) t;
$$;
create function private.begin_chat(p_hash text,p_id uuid,p_text text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.chat_sessions; t private.chat_turns; d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date; hits integer;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_id is null or length(btrim(coalesce(p_text,''))) not between 1 and 1000 then return jsonb_build_object('error','invalid'); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat:'||p_hash,0));
 select * into s from private.chat_sessions where token_hash=p_hash;
 if found and s.expires_at<=now() then return jsonb_build_object('error','expired'); end if;
 if s.id is null then insert into private.chat_sessions(token_hash) values(p_hash) returning * into s; end if;
 select * into t from private.chat_turns where id=p_id;
 if found then
  if t.session_id<>s.id or t.customer_text<>btrim(p_text) then return jsonb_build_object('error','conflict'); end if;
  if t.status='done' then return jsonb_build_object('done',true,'history',private.chat_history(p_hash)); end if;
  if t.lease_until>now() then return jsonb_build_object('error','busy'); end if;
  -- A crashed/uncertain model request is never automatically billed again.
  update private.chat_turns set status='done',mode='fallback',assistant_text='Lượt tư vấn trước bị gián đoạn. Bạn có thể hỏi tiếp hoặc liên hệ Zalo của shop.' where id=p_id;
  return jsonb_build_object('done',true,'history',private.chat_history(p_hash));
 end if;
 if exists(select 1 from private.chat_turns where session_id=s.id and status='pending' and lease_until>now()) then return jsonb_build_object('error','busy'); end if;
 if (select count(*) from private.chat_turns where session_id=s.id and created_at>now()-interval '1 hour')>=20 then return jsonb_build_object('error','quota'); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat-global-budget',0));
 select turns into hits from private.chat_budgets where day=d;
 if coalesce(hits,0)>=200 then return jsonb_build_object('error','quota'); end if;
 insert into private.chat_budgets(day,turns) values(d,1) on conflict(day) do update set turns=private.chat_budgets.turns+1;
 -- Finalize abandoned turns so they never pollute a future model conversation.
 update private.chat_turns set status='done',mode='fallback',assistant_text='Phiên phản hồi bị gián đoạn. Vui lòng liên hệ Zalo nếu cần hỗ trợ ngay.' where session_id=s.id and status='pending';
 insert into private.chat_turns(id,session_id,customer_text) values(p_id,s.id,btrim(p_text)) returning * into t;
 update private.chat_sessions set last_message_at=now() where id=s.id;
 return jsonb_build_object('lease',t.lease,'history',private.chat_history(p_hash));
end; $$;
create function private.finish_chat(p_hash text,p_id uuid,p_lease uuid,p_text text,p_mode text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_mode not in ('ai','fallback') or length(btrim(coalesce(p_text,''))) not between 1 and 3000 then return false; end if;
 update private.chat_turns t set assistant_text=btrim(p_text),mode=p_mode,status='done' from private.chat_sessions s
 where t.session_id=s.id and s.token_hash=p_hash and s.expires_at>now() and t.id=p_id and t.lease=p_lease and t.status='pending' and t.lease_until>now();
 return found;
end; $$;
create function private.handoff_chat(p_hash text) returns boolean language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 update private.chat_sessions set handoff_at=now() where token_hash=p_hash and expires_at>now() and handoff_at is null and exists(select 1 from private.chat_turns t where t.session_id=private.chat_sessions.id) returning id into sid;
 if sid is null then return false; end if;
 insert into private.notification_outbox(event_key,event_type,entity_id) values('chat:'||sid::text,'chat_handoff',sid) on conflict do nothing;
 return true;
end; $$;

-- Minimal references only; no address, phone, message body, bank data or tracking capability.
create function private.enqueue_shop_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare typ text; entity uuid;
begin
 if tg_table_name='orders' then typ:='order_created'; entity:=new.id;
 elsif tg_table_name='order_events' then
  if new.kind not in ('stage','cancel') then return new; end if;
  typ:='order_'||new.kind; entity:=new.order_id;
 elsif tg_table_name='order_payments' then typ:='order_'||new.kind; entity:=new.order_id;
 else typ:='request_created'; entity:=new.id; end if;
 insert into private.notification_outbox(event_key,event_type,entity_id) values(tg_table_name||':'||new.id::text,typ,entity) on conflict do nothing;
 return new;
end; $$;
create trigger notify_order after insert on private.orders for each row execute function private.enqueue_shop_notification();
create trigger notify_order_event after insert on private.order_events for each row execute function private.enqueue_shop_notification();
create trigger notify_order_payment after insert on private.order_payments for each row execute function private.enqueue_shop_notification();
create trigger notify_request after insert on private.custom_requests for each row execute function private.enqueue_shop_notification();

create function private.claim_notifications() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with due as (select id from private.notification_outbox where sent_at is null and attempts<5 and next_attempt_at<=now() and (lease_until is null or lease_until<=now()) order by next_attempt_at,id limit 5 for update skip locked),
 claimed as (update private.notification_outbox o set attempts=o.attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '90 seconds' from due where o.id=due.id returning o.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'event',event_type,'entityId',entity_id,'lease',lease,'attempt',attempts)),'[]'::jsonb) into result from claimed;
 return result;
end; $$;
create function private.finish_notification(p_id uuid,p_lease uuid,p_error text,p_retry integer) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_error is not null and p_error not in ('network','provider','rate_limit') then return false; end if;
 update private.notification_outbox set sent_at=case when p_error is null then now() else null end,last_error=p_error,
 next_attempt_at=now()+make_interval(secs=>greatest(30,least(86400,coalesce(p_retry,60)))),lease_until=null,lease=null
 where id=p_id and lease=p_lease and sent_at is null and lease_until>now();
 return found;
end; $$;

create function private.admin_chat(p_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'forbidden'; end if;
 if p_id is null then
  return (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'createdAt',s.created_at,'updatedAt',s.last_message_at,'handoff',s.handoff_at,'preview',(select left(customer_text,100) from private.chat_turns where session_id=s.id order by created_at desc,id desc limit 1)) order by s.last_message_at desc),'[]'::jsonb) from (select * from private.chat_sessions order by last_message_at desc limit 100) s);
 end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'customer',t.customer_text,'assistant',t.assistant_text,'mode',t.mode,'status',t.status,'createdAt',t.created_at) order by t.created_at,t.id),'[]'::jsonb) from (select * from private.chat_turns where session_id=p_id order by created_at desc,id desc limit 100) t);
end; $$;
create function private.admin_notifications() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'forbidden'; end if;
 return (select jsonb_build_object('pending',count(*) filter(where sent_at is null and attempts<5),'failed',count(*) filter(where sent_at is null and attempts>=5),'sent',count(*) filter(where sent_at is not null),'recent',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from(select id,event_type,entity_id,attempts,sent_at,last_error,next_attempt_at from private.notification_outbox order by created_at desc limit 20) r)) from private.notification_outbox);
end; $$;

create function public.chat_history(p_hash text) returns jsonb language sql security invoker set search_path='' as $$ select private.chat_history(p_hash); $$;
create function public.begin_chat(p_hash text,p_id uuid,p_text text) returns jsonb language sql security invoker set search_path='' as $$ select private.begin_chat(p_hash,p_id,p_text); $$;
create function public.finish_chat(p_hash text,p_id uuid,p_lease uuid,p_text text,p_mode text) returns boolean language sql security invoker set search_path='' as $$ select private.finish_chat(p_hash,p_id,p_lease,p_text,p_mode); $$;
create function public.handoff_chat(p_hash text) returns boolean language sql security invoker set search_path='' as $$ select private.handoff_chat(p_hash); $$;
create function public.claim_notifications() returns jsonb language sql security invoker set search_path='' as $$ select private.claim_notifications(); $$;
create function public.finish_notification(p_id uuid,p_lease uuid,p_error text default null,p_retry integer default 60) returns boolean language sql security invoker set search_path='' as $$ select private.finish_notification(p_id,p_lease,p_error,p_retry); $$;
create function public.admin_chat(p_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_chat(p_id); $$;
create function public.admin_notifications() returns jsonb language sql security invoker set search_path='' as $$ select private.admin_notifications(); $$;

revoke all on function private.enqueue_shop_notification() from public,anon,authenticated,service_role;
revoke all on function private.chat_history(text),public.chat_history(text),private.begin_chat(text,uuid,text),public.begin_chat(text,uuid,text),private.finish_chat(text,uuid,uuid,text,text),public.finish_chat(text,uuid,uuid,text,text),private.handoff_chat(text),public.handoff_chat(text),private.claim_notifications(),public.claim_notifications(),private.finish_notification(uuid,uuid,text,integer),public.finish_notification(uuid,uuid,text,integer),private.admin_chat(uuid),public.admin_chat(uuid),private.admin_notifications(),public.admin_notifications() from public,anon,authenticated,service_role;
grant execute on function private.chat_history(text),public.chat_history(text),private.begin_chat(text,uuid,text),public.begin_chat(text,uuid,text),private.finish_chat(text,uuid,uuid,text,text),public.finish_chat(text,uuid,uuid,text,text),private.handoff_chat(text),public.handoff_chat(text),private.claim_notifications(),public.claim_notifications(),private.finish_notification(uuid,uuid,text,integer),public.finish_notification(uuid,uuid,text,integer) to service_role;
grant execute on function private.admin_chat(uuid),public.admin_chat(uuid),private.admin_notifications(),public.admin_notifications() to authenticated;
