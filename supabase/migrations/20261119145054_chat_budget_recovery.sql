-- Do not create empty sessions after global exhaustion or on a conflicting turn ID.
create or replace function private.begin_chat(p_hash text,p_id uuid,p_text text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.chat_sessions; t private.chat_turns; d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date; hits integer;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_id is null or length(btrim(coalesce(p_text,''))) not between 1 and 1000 then return jsonb_build_object('error','invalid'); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat:'||p_hash,0));
 select * into s from private.chat_sessions where token_hash=p_hash;
 if found and s.expires_at<=now() then return jsonb_build_object('error','expired'); end if;
 select * into t from private.chat_turns where id=p_id;
 if found then
  if s.id is null or t.session_id<>s.id or t.customer_text<>btrim(p_text) then return jsonb_build_object('error','conflict'); end if;
  if t.status='done' then return jsonb_build_object('done',true,'history',private.chat_history(p_hash)); end if;
  if t.lease_until>now() then return jsonb_build_object('error','busy'); end if;
  update private.chat_turns set status='done',mode='fallback',assistant_text='Lượt tư vấn trước bị gián đoạn. Bạn có thể hỏi tiếp hoặc liên hệ Zalo của shop.' where id=p_id;
  return jsonb_build_object('done',true,'history',private.chat_history(p_hash));
 end if;
 if exists(select 1 from private.chat_turns where session_id=s.id and status='pending' and lease_until>now()) then return jsonb_build_object('error','busy'); end if;
 if (select count(*) from private.chat_turns where session_id=s.id and created_at>now()-interval '1 hour')>=20 then return jsonb_build_object('error','quota'); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat-global-budget',0));
 select turns into hits from private.chat_budgets where day=d;
 if coalesce(hits,0)>=200 then return jsonb_build_object('error','quota'); end if;
 if s.id is null then insert into private.chat_sessions(token_hash) values(p_hash) returning * into s; end if;
 insert into private.chat_budgets(day,turns) values(d,1) on conflict(day) do update set turns=private.chat_budgets.turns+1;
 update private.chat_turns set status='done',mode='fallback',assistant_text='Phiên phản hồi bị gián đoạn. Vui lòng liên hệ Zalo nếu cần hỗ trợ ngay.' where session_id=s.id and status='pending';
 insert into private.chat_turns(id,session_id,customer_text) values(p_id,s.id,btrim(p_text)) returning * into t;
 update private.chat_sessions set last_message_at=now() where id=s.id;
 return jsonb_build_object('lease',t.lease,'history',private.chat_history(p_hash));
end; $$;
alter table private.chat_turns add constraint chat_done_mode check(status<>'done' or mode is not null);
create function private.retry_failed_notifications() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not public.is_admin() then raise exception 'forbidden'; end if;
 with failed as(select id from private.notification_outbox where sent_at is null and attempts>=5 and (lease_until is null or lease_until<=now()) order by created_at limit 5 for update skip locked)
 update private.notification_outbox o set attempts=0,next_attempt_at=now(),last_error=null,lease=null,lease_until=null from failed where o.id=failed.id;
 get diagnostics n=row_count; return n;
end; $$;
create function public.retry_failed_notifications() returns integer language sql security invoker set search_path='' as $$select private.retry_failed_notifications();$$;
revoke all on function private.retry_failed_notifications(),public.retry_failed_notifications() from public,anon,authenticated,service_role;
grant execute on function private.retry_failed_notifications(),public.retry_failed_notifications() to authenticated;
