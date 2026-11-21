create table private.custom_requests (
 id uuid primary key, category text not null check(category in ('keycap','stab')),
 customer_name text not null check(length(btrim(customer_name)) between 1 and 120), phone text not null check(phone ~ '^\+?[0-9]{9,15}$'),
 budget_vnd bigint not null check(budget_vnd between 0 and 1000000000), reference_url text not null default '' check(length(reference_url)<=500 and (reference_url='' or reference_url ~ '^https://[^[:space:]]+$')),
 note text not null default '' check(length(note)<=2000), image_path text check(image_path ~ '^[a-f0-9-]{36}\.webp$'),
 payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'), status text not null default 'pending' check(status in ('pending','contacted','done')),
 internal_note text not null default '' check(length(internal_note)<=2000), version integer not null default 1,
 updated_by uuid references public.admin_members(user_id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(reference_url<>'' or image_path is not null)
);
create index requests_status_created on private.custom_requests(status,created_at desc);
create index requests_updated_by on private.custom_requests(updated_by);
alter table private.custom_requests enable row level security;
revoke all on private.custom_requests from public,anon,authenticated;
create table private.request_budgets(bucket text not null, hour timestamptz not null, hits integer not null, primary key(bucket,hour));
alter table private.request_budgets enable row level security;
revoke all on private.request_budgets from public,anon,authenticated;

create function private.consume_request_budget(p_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare h timestamptz:=date_trunc('hour',now()); local_hits integer; global_hits integer;
begin
 if p_key !~ '^[a-f0-9]{64}$' then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('request-budget',0));
 delete from private.request_budgets where hour<now()-interval '2 days';
 select hits into global_hits from private.request_budgets where bucket='global' and hour=h;
 select hits into local_hits from private.request_budgets where bucket=p_key and hour=h;
 if coalesce(global_hits,0)>=100 or coalesce(local_hits,0)>=10 then return false; end if;
 insert into private.request_budgets values('global',h,1),(p_key,h,1) on conflict(bucket,hour) do update set hits=private.request_budgets.hits+1;
 return true;
end; $$;
create function private.lookup_request_submission(p_id uuid,p_hash text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('ok',true,'id',id,'imagePath',image_path) from private.custom_requests where id=p_id and payload_hash=p_hash;
$$;
create function private.submit_custom_request(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing private.custom_requests; rid uuid:=(p->>'id')::uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(rid::text,0));
 select * into existing from private.custom_requests where id=rid;
 if found then
  if existing.payload_hash<>p->>'hash' then return jsonb_build_object('ok',false,'code','request_conflict'); end if;
  return jsonb_build_object('ok',true,'id',rid,'duplicate',true);
 end if;
 insert into private.custom_requests(id,category,customer_name,phone,budget_vnd,reference_url,note,image_path,payload_hash)
 values(rid,p->>'category',btrim(p->>'customerName'),p->>'phone',(p->>'budget')::bigint,coalesce(p->>'referenceUrl',''),coalesce(p->>'note',''),nullif(p->>'imagePath',''),p->>'hash');
 return jsonb_build_object('ok',true,'id',rid);
end; $$;
create function private.list_custom_requests() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r)-'payload_hash' order by r.created_at desc) from (select * from private.custom_requests order by created_at desc limit 200) r),'[]');
end; $$;
create function private.update_custom_request(p_id uuid,p_version integer,p_status text,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 update private.custom_requests set status=p_status,internal_note=btrim(p_note),version=version+1,updated_at=now(),updated_by=auth.uid() where id=p_id and version=p_version;
 if not found then return jsonb_build_object('ok',false,'code','conflict'); end if;
 insert into private.admin_audit_events(actor_id,action,target_id) values(auth.uid(),'request_updated',p_id::text);
 return jsonb_build_object('ok',true);
end; $$;

create table private.portfolio_items (
 id uuid primary key, title text not null check(length(btrim(title)) between 1 and 120), keyboard text not null check(length(btrim(keyboard)) between 1 and 200),
 mods text not null default '' check(length(mods)<=2000), description text not null default '' check(length(description)<=2000),
 video_url text not null default '' check(length(video_url)<=500 and (video_url='' or video_url ~ '^https://(www\.)?(youtube\.com|youtu\.be|tiktok\.com)/[^[:space:]]+$')),
 image_path text check(image_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.webp$'), published boolean not null default false, archived_at timestamptz,
 version integer not null default 1, actor_id uuid not null references public.admin_members(user_id), created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(not published or (image_path is not null and archived_at is null))
);
create index portfolio_actor on private.portfolio_items(actor_id);
create index portfolio_published on private.portfolio_items(updated_at desc) where published and archived_at is null;
alter table private.portfolio_items enable row level security;
revoke all on private.portfolio_items from public,anon,authenticated;
create function private.list_portfolio_admin() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(i) order by i.updated_at desc) from (select * from private.portfolio_items where archived_at is null order by updated_at desc limit 200) i),'[]');
end; $$;
create function private.save_portfolio(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.portfolio_items; pid uuid:=(p->>'id')::uuid; pv integer:=(p->>'version')::integer; publish boolean:=coalesce((p->>'published')::boolean,false);
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pid::text,0));
 select * into old from private.portfolio_items where id=pid for update;
 if (found and (old.version<>pv or old.archived_at is not null)) or (not found and pv<>0) then return jsonb_build_object('ok',false,'code','conflict'); end if;
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
create function private.read_published_portfolio() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'keyboard',i.keyboard,'mods',i.mods,'description',i.description,'videoUrl',i.video_url,'imagePath',i.image_path) order by i.updated_at desc),'[]') from (select * from private.portfolio_items where published and archived_at is null order by updated_at desc limit 60) i;
$$;
create function public.consume_request_budget(p_key text) returns boolean language sql security invoker set search_path='' as $$select private.consume_request_budget(p_key);$$;
create function public.lookup_request_submission(p_id uuid,p_hash text) returns jsonb language sql security invoker set search_path='' as $$select private.lookup_request_submission(p_id,p_hash);$$;
create function public.submit_custom_request(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.submit_custom_request(p);$$;
create function public.list_custom_requests() returns jsonb language sql security invoker set search_path='' as $$select private.list_custom_requests();$$;
create function public.update_custom_request(p_id uuid,p_version integer,p_status text,p_note text) returns jsonb language sql security invoker set search_path='' as $$select private.update_custom_request(p_id,p_version,p_status,p_note);$$;
create function public.list_portfolio_admin() returns jsonb language sql security invoker set search_path='' as $$select private.list_portfolio_admin();$$;
create function public.save_portfolio(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.save_portfolio(p);$$;
create function public.read_published_portfolio() returns jsonb language sql security invoker set search_path='' as $$select private.read_published_portfolio();$$;
revoke all on function private.consume_request_budget(text),public.consume_request_budget(text),private.lookup_request_submission(uuid,text),public.lookup_request_submission(uuid,text),private.submit_custom_request(jsonb),public.submit_custom_request(jsonb),private.read_published_portfolio(),public.read_published_portfolio() from public,anon,authenticated;
grant execute on function private.consume_request_budget(text),public.consume_request_budget(text),private.lookup_request_submission(uuid,text),public.lookup_request_submission(uuid,text),private.submit_custom_request(jsonb),public.submit_custom_request(jsonb),private.read_published_portfolio(),public.read_published_portfolio() to service_role;
revoke all on function private.list_custom_requests(),public.list_custom_requests(),private.update_custom_request(uuid,integer,text,text),public.update_custom_request(uuid,integer,text,text),private.list_portfolio_admin(),public.list_portfolio_admin(),private.save_portfolio(jsonb),public.save_portfolio(jsonb) from public,anon,authenticated;
grant execute on function private.list_custom_requests(),public.list_custom_requests(),private.update_custom_request(uuid,integer,text,text),public.update_custom_request(uuid,integer,text,text),private.list_portfolio_admin(),public.list_portfolio_admin(),private.save_portfolio(jsonb),public.save_portfolio(jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('portfolio-media','portfolio-media',false,5242880,array['image/webp']);
create policy portfolio_media_read on storage.objects for select to authenticated using(bucket_id='portfolio-media' and (select private.is_admin()));
create policy portfolio_media_insert on storage.objects for insert to authenticated with check(bucket_id='portfolio-media' and (select private.is_admin()));
create policy portfolio_media_delete on storage.objects for delete to authenticated using(bucket_id='portfolio-media' and (select private.is_admin()));
