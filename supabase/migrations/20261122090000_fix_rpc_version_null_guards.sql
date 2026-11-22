-- Replace private implementations; public invoker wrappers and existing ACLs stay intact.
create or replace function private.save_portfolio(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.portfolio_items; pid uuid:=(p->>'id')::uuid; pv integer; publish boolean:=coalesce((p->>'published')::boolean,false);
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if jsonb_typeof(p->'version') is distinct from 'number' or (p->>'version') !~ '^[0-9]+$' then return jsonb_build_object('ok',false,'code','invalid_input'); end if;
 begin
  pv:=(p->>'version')::integer;
 exception when numeric_value_out_of_range then return jsonb_build_object('ok',false,'code','invalid_input');
 end;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pid::text,0));
 select * into old from private.portfolio_items where id=pid for update;
 if (found and (old.version is distinct from pv or old.archived_at is not null)) or (not found and pv is distinct from 0) then return jsonb_build_object('ok',false,'code','conflict'); end if;
 if p->>'action'='archive' then
  if old.id is null then return jsonb_build_object('ok',false,'code','conflict'); end if;
  update private.portfolio_items set archived_at=now(),published=false,version=version+1,updated_at=now() where id=pid;
 else
  if publish and (coalesce((p->>'approved')::boolean,false) is not true or nullif(p->>'imagePath','') is null) then return jsonb_build_object('ok',false,'code','approval_required'); end if;
  if nullif(p->>'imagePath','') is not null and p->>'imagePath' !~ ('^'||pid::text||'/[a-f0-9-]{36}\.webp$') then raise exception 'Invalid portfolio image' using errcode='22023'; end if;
  insert into private.portfolio_items(id,title,keyboard,mods,description,video_url,image_path,published,actor_id)
  values(pid,btrim(p->>'title'),btrim(p->>'keyboard'),coalesce(p->>'mods',''),coalesce(p->>'description',''),coalesce(p->>'videoUrl',''),nullif(p->>'imagePath',''),publish,auth.uid())
  on conflict(id) do update set title=excluded.title,keyboard=excluded.keyboard,mods=excluded.mods,description=excluded.description,video_url=excluded.video_url,image_path=excluded.image_path,published=excluded.published,version=private.portfolio_items.version+1,updated_at=now();
 end if;
 insert into private.admin_audit_events(actor_id,action,target_id) values(auth.uid(),case when p->>'action'='archive' then 'portfolio_archived' when publish then 'portfolio_published' else 'portfolio_saved' end,pid::text);
 return jsonb_build_object('ok',true,'id',pid);
end; $$;

create or replace function private.manage_account(p_id uuid,p_version integer,p_action text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.accounts; next_status text;
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if p_version is null or p_version < 1 then return jsonb_build_object('ok',false,'code','invalid_input'); end if;
 if p_id=auth.uid() or exists(select 1 from public.admin_members where user_id=p_id) then return jsonb_build_object('ok',false,'code','protected_admin'); end if;
 if p_action not in ('ban','unban','delete') or length(btrim(coalesce(p_reason,''))) not between 3 and 500 then return jsonb_build_object('ok',false,'code','invalid_input'); end if;
 select * into a from private.accounts where user_id=p_id for update;
 if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
 next_status:=case p_action when 'ban' then 'banned' when 'unban' then 'active' else 'deleted' end;
 if a.status=next_status then return jsonb_build_object('ok',true); end if;
 if a.status='deleted' or a.version is distinct from p_version then return jsonb_build_object('ok',false,'code','conflict'); end if;
 update private.accounts set status=next_status,version=version+1,reason=btrim(p_reason) where user_id=p_id;
 if next_status<>'active' then delete from auth.sessions where user_id=p_id; end if;
 insert into private.admin_audit_events(actor_id,action,target_id) values(auth.uid(),'account_'||p_action,p_id::text);
 return jsonb_build_object('ok',true);
end; $$;
