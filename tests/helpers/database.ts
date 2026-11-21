import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";

// Chỉ fixture kiểm thử: mô phỏng schema hệ thống Supabase, không phải Auth thay thế.
export async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}', created_at timestamptz not null default now());
    create table auth.identities(user_id uuid references auth.users, provider text, identity_data jsonb);
    create table auth.sessions(id uuid primary key, user_id uuid references auth.users);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated, service_role;
    grant select on storage.objects to anon;
    grant select, insert, update, delete on storage.objects to authenticated;
  `);
  const root = new URL("../../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(root))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(file, root), "utf8"));
  await db.exec(
    await readFile(new URL("../../supabase/seed.sql", import.meta.url), "utf8"),
  );
  return db;
}
