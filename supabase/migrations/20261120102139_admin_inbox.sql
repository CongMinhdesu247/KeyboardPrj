-- Inbox read state is personal; Telegram delivery state is never changed here.
create table private.admin_notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid not null references private.notification_outbox(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(user_id, notification_id)
);
create index admin_notification_reads_notification on private.admin_notification_reads(notification_id);
create index notification_outbox_recent on private.notification_outbox(created_at desc, id desc);
alter table private.admin_notification_reads enable row level security;
revoke all on private.admin_notification_reads from public, anon, authenticated, service_role;

create function private.admin_inbox(p_limit integer default 20, p_offset integer default 0, p_unread boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result jsonb;
begin
  if not private.is_admin() then raise exception 'Admin required'; end if;
  if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset not between 0 and 100000 or p_unread is null then
    raise exception 'Invalid inbox pagination';
  end if;
  select jsonb_build_object(
    'unread', count(*) filter(where r.notification_id is null),
    'total', count(*) filter(where not p_unread or r.notification_id is null),
    'snapshot_at', statement_timestamp(),
    'items', (select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at desc, i.id desc),'[]'::jsonb) from (
      select o2.id, o2.event_type, o2.entity_id, o2.created_at, r2.read_at
      from private.notification_outbox o2
      left join private.admin_notification_reads r2 on r2.notification_id=o2.id and r2.user_id=actor
      where not p_unread or r2.notification_id is null
      order by o2.created_at desc, o2.id desc limit p_limit offset p_offset
    ) i)
  ) into result from private.notification_outbox o
  left join private.admin_notification_reads r on r.notification_id=o.id and r.user_id=actor;
  return result;
end; $$;

create function private.read_admin_notifications(p_ids uuid[] default null, p_before timestamptz default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); affected integer;
begin
  if not private.is_admin() then raise exception 'Admin required'; end if;
  -- Exactly one mode; a watermark avoids swallowing events created after the displayed feed.
  if (p_ids is null) = (p_before is null) or
     (p_ids is not null and (cardinality(p_ids) not between 1 and 50 or array_position(p_ids,null) is not null)) or
     (p_before is not null and (not isfinite(p_before) or p_before > statement_timestamp())) then
    raise exception 'Invalid read request';
  end if;
  insert into private.admin_notification_reads(user_id,notification_id)
  select actor,o.id from private.notification_outbox o
  where (p_ids is not null and o.id=any(p_ids)) or (p_before is not null and o.created_at<=p_before)
  on conflict do nothing;
  get diagnostics affected = row_count;
  return affected;
end; $$;

create function public.admin_inbox(p_limit integer default 20, p_offset integer default 0, p_unread boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$ select private.admin_inbox(p_limit,p_offset,p_unread); $$;
create function public.read_admin_notifications(p_ids uuid[] default null, p_before timestamptz default null)
returns integer language sql security invoker set search_path = '' as $$ select private.read_admin_notifications(p_ids,p_before); $$;
revoke all on function private.admin_inbox(integer,integer,boolean), public.admin_inbox(integer,integer,boolean),
 private.read_admin_notifications(uuid[],timestamptz), public.read_admin_notifications(uuid[],timestamptz)
 from public, anon, authenticated, service_role;
grant execute on function private.admin_inbox(integer,integer,boolean), public.admin_inbox(integer,integer,boolean),
 private.read_admin_notifications(uuid[],timestamptz), public.read_admin_notifications(uuid[],timestamptz) to authenticated;
