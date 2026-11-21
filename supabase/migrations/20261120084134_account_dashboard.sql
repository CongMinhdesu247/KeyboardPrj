-- Store only distinct authenticated activity days, never page paths or session tokens.
create table private.account_activity_days (
 user_id uuid not null references private.accounts(user_id) on delete cascade,
 day date not null,
 primary key(day,user_id)
);
alter table private.account_activity_days enable row level security;
revoke all on private.account_activity_days from public,anon,authenticated;
create table private.account_analytics_start (
 singleton boolean primary key default true check(singleton),
 started_on date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date
);
alter table private.account_analytics_start enable row level security;
revoke all on private.account_analytics_start from public,anon,authenticated;
insert into private.account_analytics_start(singleton) values(true);

create function private.record_account_activity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='active' and new.last_seen_at is not null and new.last_seen_at is distinct from old.last_seen_at then
  insert into private.account_activity_days(user_id,day) values(new.user_id,(new.last_seen_at at time zone 'Asia/Ho_Chi_Minh')::date) on conflict do nothing;
 end if;
 return new;
end; $$;
revoke all on function private.record_account_activity() from public,anon,authenticated;
create trigger account_activity_day after update of last_seen_at on private.accounts for each row execute function private.record_account_activity();

create function private.account_growth() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date; coverage date;
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 select started_on into coverage from private.account_analytics_start where singleton;
 return jsonb_build_object(
  'coverage_start',coverage,'as_of',now(),
  'registered',(select count(*) from private.accounts),
  'active30',(select count(*) from private.accounts where status='active' and last_seen_at>=now()-interval '30 days'),
  'new_month',(select count(*) from private.accounts where registered_at>=date_trunc('month',today::timestamp) at time zone 'Asia/Ho_Chi_Minh'),
  'daily',(with registrations as (
    select (registered_at at time zone 'Asia/Ho_Chi_Minh')::date as day,count(*) n from private.accounts group by 1
   ), days as (select d::date as day from generate_series((today-364)::timestamp,today::timestamp,interval '1 day') d)
   select jsonb_agg(jsonb_build_object('date',d.day,'new_registered',coalesce(r.n,0),
    'registered',(select count(*) from private.accounts where registered_at<(d.day+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'),
    'active',case when d.day>coverage then (select count(*) from private.account_activity_days where day=d.day) else null end,
    'active30',case when d.day=today then (select count(*) from private.accounts where status='active' and last_seen_at>=now()-interval '30 days')
      when d.day>=coverage+30 then (select count(distinct user_id) from private.account_activity_days where day between d.day-29 and d.day) else null end
   ) order by d.day) from days d left join registrations r on r.day=d.day)
 );
end; $$;
create function public.account_growth() returns jsonb language sql security invoker set search_path='' as $$ select private.account_growth(); $$;
revoke all on function private.account_growth(),public.account_growth() from public,anon,authenticated;
grant execute on function private.account_growth(),public.account_growth() to authenticated;
