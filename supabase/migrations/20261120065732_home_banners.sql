-- Fixed slots enforce the five-banner limit without a count-then-insert race.
create table public.home_banners (
 slot smallint primary key check(slot between 1 and 5),
 title text not null default '' check(length(title)<=120),
 subtitle text not null default '' check(length(subtitle)<=240),
 image_path text check(image_path is null or image_path ~ '^[a-f0-9-]{36}\.webp$'),
 product_id bigint references public.products_services(id) on delete set null,
 active boolean not null default false,
 version integer not null default 1 check(version>0),
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 check(not active or (length(btrim(title))>0 and image_path is not null and product_id is not null))
);
create index banners_product on public.home_banners(product_id);
create index banners_actor on public.home_banners(updated_by);
alter table public.home_banners enable row level security;
revoke all on public.home_banners from public,anon,authenticated;
grant select(slot,title,subtitle,image_path,product_id,active,version,updated_at) on public.home_banners to anon,authenticated;
create policy banners_public_read on public.home_banners for select to anon,authenticated using(active and exists(select 1 from public.products_services p join public.service_categories c on c.slug=p.category_slug where p.id=product_id and p.active and p.archived_at is null and p.price_vnd is not null and c.active));
create policy banners_admin_read on public.home_banners for select to authenticated using((select private.is_admin()));
insert into public.home_banners(slot) select generate_series(1,5);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('home-banners','home-banners',true,5242880,array['image/webp']);
create policy home_banners_admin_read on storage.objects for select to authenticated using(bucket_id='home-banners' and (select private.is_admin()));
create policy home_banners_admin_insert on storage.objects for insert to authenticated with check(bucket_id='home-banners' and (select private.is_admin()));
create policy home_banners_admin_delete on storage.objects for delete to authenticated using(bucket_id='home-banners' and (select private.is_admin()));

create function private.save_home_banner(p_slot integer,p_version integer,p_title text,p_subtitle text,p_image text,p_product bigint,p_active boolean,p_clear boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.home_banners;
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 select * into r from public.home_banners where slot=p_slot for update;
 if not found then return jsonb_build_object('ok',false,'code','invalid_slot'); end if;
 if p_version is null or p_version<1 or p_active is null or p_clear is null then return jsonb_build_object('ok',false,'code','invalid_input'); end if;
 p_title:=btrim(coalesce(p_title,''));p_subtitle:=btrim(coalesce(p_subtitle,''));p_image:=nullif(p_image,'');p_product:=nullif(p_product,0);
 if p_clear then p_title:='';p_subtitle:='';p_image:=null;p_product:=null;p_active:=false; end if;
 if length(p_title)>120 or length(p_subtitle)>240 or (p_image is not null and p_image !~ '^[a-f0-9-]{36}\.webp$') then return jsonb_build_object('ok',false,'code','invalid_input'); end if;
 if p_active and (p_title='' or p_image is null or p_product is null) then return jsonb_build_object('ok',false,'code','incomplete'); end if;
 if p_product is not null and not exists(select 1 from public.products_services p join public.service_categories c on c.slug=p.category_slug where p.id=p_product and p.active and p.archived_at is null and p.price_vnd is not null and c.active) then return jsonb_build_object('ok',false,'code','unavailable'); end if;
 if r.title=p_title and r.subtitle=p_subtitle and r.image_path is not distinct from p_image and r.product_id is not distinct from p_product and r.active=p_active then return jsonb_build_object('ok',true,'version',r.version); end if;
 if r.version<>p_version then return jsonb_build_object('ok',false,'code','conflict'); end if;
 if p_image is not null and p_image is distinct from r.image_path and not exists(select 1 from storage.objects where bucket_id='home-banners' and name=p_image) then return jsonb_build_object('ok',false,'code','invalid_image'); end if;
 update public.home_banners set title=p_title,subtitle=p_subtitle,image_path=p_image,product_id=p_product,active=p_active,version=version+1,updated_at=now(),updated_by=auth.uid() where slot=p_slot returning * into r;
 insert into private.admin_audit_events(actor_id,action,target_id) values(auth.uid(),case when p_clear then 'banner_cleared' else 'banner_saved' end,r.slot::text);
 return jsonb_build_object('ok',true,'version',r.version);
end; $$;
create function public.save_home_banner(p_slot integer,p_version integer,p_title text,p_subtitle text,p_image text,p_product bigint,p_active boolean,p_clear boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.save_home_banner(p_slot,p_version,p_title,p_subtitle,p_image,p_product,p_active,p_clear); $$;
revoke all on function private.save_home_banner(integer,integer,text,text,text,bigint,boolean,boolean),public.save_home_banner(integer,integer,text,text,text,bigint,boolean,boolean) from public,anon,authenticated;
grant execute on function private.save_home_banner(integer,integer,text,text,text,bigint,boolean,boolean),public.save_home_banner(integer,integer,text,text,text,bigint,boolean,boolean) to authenticated;
