-- Additive gallery metadata. Existing cover paths and business snapshots are preserved.
create function private.valid_catalog_images(paths text[]) returns boolean
language sql immutable set search_path='' as $$
  select paths is not null and coalesce(array_ndims(paths),1)=1
    and cardinality(paths)<=10
    and not exists(select 1 from unnest(paths) p where p is null or p !~ '^[a-f0-9-]{36}\.webp$')
    and cardinality(paths)=(select count(distinct p) from unnest(paths) p);
$$;
revoke all on function private.valid_catalog_images(text[]) from public,anon,authenticated;

alter table public.products_services
  add column image_paths text[] not null default '{}',
  add column video_path text check(video_path is null or video_path ~ '^[a-f0-9-]{36}\.mp4$'),
  add column video_url text not null default '' check(length(video_url)<=500 and
    (video_url='' or video_url ~ '^https://(www\.)?(youtube\.com|youtu\.be|tiktok\.com)/[^[:space:]]+$'));
update public.products_services set image_paths=array[image_path] where image_path is not null;
alter table public.products_services
  add constraint catalog_images_valid check(private.valid_catalog_images(image_paths)),
  add constraint catalog_one_sound_test check(video_path is null or video_url='');

create function private.sync_catalog_cover() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if cardinality(new.image_paths)=0 and new.image_path is not null then new.image_paths:=array[new.image_path]; end if;
  elsif new.image_path is distinct from old.image_path and new.image_paths is not distinct from old.image_paths then
    new.image_paths:=array_remove(old.image_paths,old.image_path);
    if new.image_path is not null then new.image_paths:=array_prepend(new.image_path,array_remove(new.image_paths,new.image_path)); end if;
  end if;
  new.image_path:=new.image_paths[1];
  return new;
end; $$;
revoke all on function private.sync_catalog_cover() from public,anon,authenticated;
create trigger catalog_cover_sync before insert or update of image_path,image_paths on public.products_services
  for each row execute function private.sync_catalog_cover();

create function private.set_catalog_media(p_id bigint,p_version integer,p_images text[],p_video_path text,p_video_url text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.products_services; p text;
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select * into r from public.products_services where id=p_id for update;
  if not found or r.archived_at is not null then return jsonb_build_object('ok',false,'code','not_found'); end if;
  if not private.valid_catalog_images(p_images) or p_version is null or p_version<1 then
    return jsonb_build_object('ok',false,'code','invalid_media');
  end if;
  p_video_path:=nullif(p_video_path,''); p_video_url:=coalesce(p_video_url,'');
  if (p_video_path is not null and p_video_path !~ '^[a-f0-9-]{36}\.mp4$')
    or length(p_video_url)>500 or (p_video_url<>'' and p_video_url !~ '^https://(www\.)?(youtube\.com|youtu\.be|tiktok\.com)/[^[:space:]]+$')
    or (p_video_path is not null and p_video_url<>'') then return jsonb_build_object('ok',false,'code','invalid_media'); end if;
  if r.image_paths=p_images and r.video_path is not distinct from p_video_path and r.video_url=p_video_url then
    return jsonb_build_object('ok',true,'id',r.id::text,'version',r.version,'images',r.image_paths,'videoPath',r.video_path,'videoUrl',r.video_url);
  end if;
  if r.version<>p_version then return jsonb_build_object('ok',false,'code','conflict'); end if;
  foreach p in array p_images loop
    if not(p=any(r.image_paths)) and not exists(select 1 from storage.objects where bucket_id='catalog-images' and name=p) then
      return jsonb_build_object('ok',false,'code','invalid_media');
    end if;
  end loop;
  if p_video_path is not null and p_video_path is distinct from r.video_path and
    not exists(select 1 from storage.objects where bucket_id='catalog-videos' and name=p_video_path) then
    return jsonb_build_object('ok',false,'code','invalid_media');
  end if;
  update public.products_services set image_paths=p_images,image_path=p_images[1],video_path=p_video_path,
    video_url=p_video_url,version=version+1,updated_at=now() where id=p_id returning * into r;
  insert into private.admin_audit_events(actor_id,action,target_id) values(auth.uid(),'catalog_media_updated',r.id::text);
  return jsonb_build_object('ok',true,'id',r.id::text,'version',r.version,'images',r.image_paths,'videoPath',r.video_path,'videoUrl',r.video_url);
end; $$;
create function public.set_catalog_media(p_id bigint,p_version integer,p_images text[],p_video_path text,p_video_url text)
returns jsonb language sql security invoker set search_path='' as $$
  select private.set_catalog_media(p_id,p_version,p_images,p_video_path,p_video_url);
$$;
revoke all on function private.set_catalog_media(bigint,integer,text[],text,text),public.set_catalog_media(bigint,integer,text[],text,text) from public,anon,authenticated;
grant execute on function private.set_catalog_media(bigint,integer,text[],text,text),public.set_catalog_media(bigint,integer,text[],text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('catalog-videos','catalog-videos',true,10485760,array['video/mp4']);
create policy catalog_videos_admin_read on storage.objects for select to authenticated using(bucket_id='catalog-videos' and (select private.is_admin()));
create policy catalog_videos_admin_insert on storage.objects for insert to authenticated with check(bucket_id='catalog-videos' and (select private.is_admin()));
create policy catalog_videos_admin_delete on storage.objects for delete to authenticated using(bucket_id='catalog-videos' and (select private.is_admin()));
