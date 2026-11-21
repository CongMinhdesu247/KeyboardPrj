import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createTestDatabase } from "./helpers/database.ts";

test("optional platform auto-RLS helper loses client execution without losing its event trigger", async () => {
  const db = await createTestDatabase();
  try {
    await db.exec(`create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $$ begin return; end $$;
      create event trigger test_auto_rls on ddl_command_end execute function public.rls_auto_enable();
      grant execute on function public.rls_auto_enable() to public,anon,authenticated;`);
    await db.exec(await readFile(new URL("../supabase/migrations/20261120115119_restrict_auto_rls_function.sql",import.meta.url),"utf8"));
    const row = (await db.query<{anon:boolean;authenticated:boolean;enabled:string}>(`select has_function_privilege('anon','public.rls_auto_enable()','execute') as anon,
      has_function_privilege('authenticated','public.rls_auto_enable()','execute') as authenticated,
      (select evtenabled from pg_event_trigger where evtname='test_auto_rls') as enabled`)).rows[0];
    assert.deepEqual(row,{anon:false,authenticated:false,enabled:"O"});
    // DDL still invokes the helper after its API grants have been removed.
    await db.exec("create table public.auto_rls_fixture(id integer)");
  } finally { await db.close(); }
});
