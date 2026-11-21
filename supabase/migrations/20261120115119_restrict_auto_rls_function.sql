-- Dashboard's automatic-RLS helper is an event trigger, not a client API.
-- Existing local stacks may not have this optional platform-created function.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_proc
    where oid = pg_catalog.to_regprocedure('public.rls_auto_enable()')
      and prorettype = 'pg_catalog.event_trigger'::pg_catalog.regtype
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
