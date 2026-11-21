import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, realpath, lstat, readdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, relative, isAbsolute, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
export const workspace = fileURLToPath(new URL("../", import.meta.url));
export const backupRoot = resolve(workspace, "output/backups/trumpkeys-local");
export const container = "supabase_db_trumpkeys-local",
  dbRole = "supabase_admin";
export const schemas = [
  "public",
  "private",
  "auth",
  "storage",
  "supabase_migrations",
];
export function containedPath(root, ...parts) {
  if (parts.some((p) => p.split(/[\\/]/).includes("..")))
    throw new Error("Parent traversal is not a backup path.");
  const target = resolve(root, ...parts),
    rel = relative(resolve(root), target);
  if (
    !rel ||
    rel === ".." ||
    rel.startsWith("..\\") ||
    rel.startsWith("../") ||
    isAbsolute(rel)
  )
    throw new Error("Backup path must stay inside its own directory.");
  return target;
}
export function drillDatabaseName(id) {
  if (!/^[a-f0-9]{32}$/.test(id))
    throw new Error("Invalid restore drill identifier.");
  return `trumpkeys_restore_${id}`;
}
export function assertDrillDatabase(name) {
  if (!/^trumpkeys_restore_[a-f0-9]{32}$/.test(name))
    throw new Error("Restore target must be a generated drill database.");
  return name;
}
export function sqlIdent(value) {
  return '"' + value.replaceAll('"', '""') + '"';
}
export function sqlLiteral(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}
export function archiveEntry(name) {
  if (
    !name ||
    isAbsolute(name) ||
    /^[A-Za-z]:/.test(name) ||
    /[\\\r\n\0]/.test(name) ||
    name.split("/").includes("..")
  )
    throw new Error("Unsafe source archive entry.");
  return name;
}
export async function sourceFiles() {
  const roots = [
    "src",
    "public",
    "scripts",
    "tests",
    "docs",
    ".github",
    "supabase/migrations",
    "supabase/seed.sql",
    "supabase/config.toml",
    "supabase/.env.example",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "eslint.config.mjs",
    "Dockerfile",
    "compose.yaml",
    ".dockerignore",
    ".gitignore",
    ".gitattributes",
    ".nvmrc",
    ".env.example",
    ".env.local.example",
    "README.md",
    "AGENTS.md",
    "SPEC.original.txt",
  ];
  const files = [];
  async function visit(name) {
    const leaf=basename(name);
    if(((leaf===".env"||leaf.startsWith(".env."))&&!leaf.endsWith(".example"))||/\.(pem|key)$/i.test(leaf))return;
    archiveEntry(name);
    const p = resolve(workspace, name),
      s = await lstat(p);
    if (s.isSymbolicLink())
      throw new Error("Source backup does not follow symlinks.");
    if (s.isDirectory()) {
      for (const entry of await readdir(p)) await visit(name + "/" + entry);
    } else if (s.isFile())
      files.push({ file: name, bytes: s.size, sha256: await fileHash(p) });
    else throw new Error("Unexpected source file type.");
  }
  for (const name of roots) await visit(name);
  return files.sort((a, b) => a.file.localeCompare(b.file));
}
export function run(command, args, input) {
  const r = spawnSync(command, args, {
    cwd: workspace,
    input,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 120000,
  });
  if (r.status !== 0)
    throw Object.assign(
      new Error(`${command} failed; diagnostic payload suppressed.`),
      { diagnostic: r.stderr?.slice(0, 64000) ?? "" },
    );
  return r.stdout.trim();
}
export function sql(database, statement, snapshot) {
  if (database !== "postgres") assertDrillDatabase(database);
  if (snapshot && !/^[A-F0-9]+-[A-F0-9]+-[0-9]+$/.test(snapshot))
    throw new Error("Invalid database snapshot.");
  const prefix = snapshot
    ? `begin isolation level repeatable read read only;set transaction snapshot '${snapshot}';`
    : "";
  return run(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-XqAt",
      "-U",
      dbRole,
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "VERBOSITY=sqlstate",
    ],
    `${prefix}\nset search_path=public,extensions;set statement_timeout='60s';\n${statement}\n${snapshot ? "commit;" : ""}`,
  );
}
export function localConfig() {
  const cli = fileURLToPath(
    new URL("../node_modules/supabase/dist/supabase.js", import.meta.url),
  );
  const c = JSON.parse(
    run(process.execPath, [cli, "status", "--output", "json"]),
  );
  if (
    c.API_URL !== "http://127.0.0.1:54321" ||
    !c.DB_URL ||
    new URL(c.DB_URL).hostname !== "127.0.0.1" ||
    new URL(c.DB_URL).port !== "54322"
  )
    throw new Error("Only the fixed TRUMP Keys local stack is supported.");
  if (sql("postgres", "select current_database();") !== "postgres")
    throw new Error("Unexpected local database.");
  return c;
}
export async function protectedDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  if (process.platform === "win32") {
    const sid = run("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
    ]);
    if (!/^S-1-[0-9-]+$/.test(sid))
      throw new Error("Could not identify backup owner.");
    run("icacls", [
      path,
      "/inheritance:r",
      "/grant:r",
      `*${sid}:(OI)(CI)F`,
      "*S-1-5-18:(OI)(CI)F",
    ]);
  }
}
export async function existingBackup(path) {
  const root = await realpath(backupRoot),
    target = await realpath(path);
  containedPath(root, target);
  if (!(await lstat(target)).isDirectory())
    throw new Error("Expected a local backup directory.");
  return target;
}
export async function checkedFile(root, name) {
  const target = containedPath(root, name);
  const stat = await lstat(target);
  if (stat.isSymbolicLink() || !stat.isFile())
    throw new Error("Backup input must be a regular file.");
  const actual = await realpath(target);
  containedPath(await realpath(root), actual);
  return actual;
}
export async function fileHash(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export async function exportSnapshot() {
  const child = spawn(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-XqAt",
      "-U",
      dbRole,
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "VERBOSITY=sqlstate",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  child.stderr.resume();
  child.stdin.on("error",()=>{});
  const id = await new Promise((resolveId, reject) => {
    let text = "";
    const timer = setTimeout(
      () => reject(new Error("Snapshot export timed out.")),
      10000,
    );
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("Snapshot process failed."));
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("Snapshot ended early."));
    });
    child.stdout.on("data", (c) => {
      text += c;
      const match = text.match(/(?:^|\n)([A-F0-9]+-[A-F0-9]+-[0-9]+)\r?\n/);
      if (match) {
        clearTimeout(timer);
        resolveId(match[1]);
      }
    });
    child.stdin.write(
      "begin isolation level repeatable read read only;set idle_in_transaction_session_timeout='5min';select pg_export_snapshot();\n",
    );
  }).catch((error) => {
    child.stdin.end("rollback;\n\\q\n");
    throw error;
  });
  let closed = false;
  return {
    id,
    close: async () => {
      if (closed) return;
      closed = true;
      if (child.exitCode !== null)
        throw new Error("Exported snapshot expired before backup finished.");
      await new Promise((resolveClose) => {
        child.once("exit", resolveClose);
        child.stdin.end("commit;\n\\q\n");
      });
    },
  };
}
export function streamCommand(args, { input, output }) {
  return new Promise((resolveDone, reject) => {
    const child = spawn("docker", args, {
      stdio: [input ? "pipe" : "ignore", output ? "pipe" : "ignore", "pipe"],
    });
    let diagnostic = "";
    child.stderr.on("data", (c) => {
      if (diagnostic.length < 64000) diagnostic += c;
    });
    let streamError = false;
    const fail = () => {
      streamError = true;
      child.kill();
    };
    const timer = setTimeout(fail, 120000);
    if (input) {
      input.once("error", fail);
      input.pipe(child.stdin);
      child.stdin.on("error", () => {});
    }
    if (output) {
      output.once("error", fail);
      child.stdout.pipe(output);
    }
    child.once("error", () => {
      clearTimeout(timer);reject(new Error("Database archive process failed."));
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0 || streamError)
        reject(
          Object.assign(
            new Error(
              "Database archive operation failed; target was isolated.",
            ),
            { diagnostic },
          ),
        );
      else if (output && !output.writableFinished)
        output.once("finish", resolveDone);
      else resolveDone();
    });
  });
}
export function inventory(database, snapshot) {
  // One psql transaction for all tables avoids a process/connection per table.
  const rows = sql(
    database,
    `select format($query$select json_build_object('schema',%L,'table',%L,'rows',count(*)::text,'sha256',encode(sha256(convert_to(coalesce(string_agg(h,'' order by h),''),'UTF8')),'hex')) from(select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h from %I.%I t) r;$query$,schemaname,tablename,schemaname,tablename) from pg_tables where schemaname in (${schemas.map(sqlLiteral).join(",")}) order by schemaname,tablename
\\gexec
`,
    snapshot,
  );
  const tables = rows ? rows.split(/\r?\n/).map((row) => JSON.parse(row)) : [];
  const structure = JSON.parse(
    sql(
      database,
      `select json_build_object(
 'relations',(select coalesce(json_agg(json_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'acl',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) order by a.grantor,a.grantee,a.privilege_type,a.is_grantable) from aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 's'::\"char\" else 'r'::\"char\" end,c.relowner))) a)) order by n.nspname,c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','storage','supabase_migrations') and c.relkind in ('r','p','S','v')),
 'columns',(select coalesce(json_agg(json_build_object('schema',table_schema,'table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable,'default',column_default,'identity',identity_generation) order by table_schema,table_name,ordinal_position),'[]') from information_schema.columns where table_schema in ('public','private','auth','storage','supabase_migrations')),
 'policies',(select coalesce(json_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]') from pg_policies p where schemaname in ('public','private','auth','storage')),
 'functions',(select coalesce(json_agg(json_build_object('schema',n.nspname,'name',p.proname,'definition',pg_get_functiondef(p.oid),'acl',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) order by a.grantor,a.grantee,a.privilege_type,a.is_grantable) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),'owner',pg_get_userbyid(p.proowner)) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','auth','storage') and p.prokind in ('f','p')),
 'constraints',(select coalesce(json_agg(json_build_object('schema',n.nspname,'name',c.conname,'table',r.relname,'definition',pg_get_constraintdef(c.oid)) order by n.nspname,r.relname,c.conname),'[]') from pg_constraint c join pg_namespace n on n.oid=c.connamespace join pg_class r on r.oid=c.conrelid where n.nspname in ('public','private','auth','storage')),
 'indexes',(select coalesce(json_agg(to_jsonb(i) order by schemaname,tablename,indexname),'[]') from pg_indexes i where schemaname in ('public','private','auth','storage')),
 'triggers',(select coalesce(json_agg(json_build_object('schema',n.nspname,'table',r.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by n.nspname,r.relname,t.tgname),'[]') from pg_trigger t join pg_class r on r.oid=t.tgrelid join pg_namespace n on n.oid=r.relnamespace where not t.tgisinternal and n.nspname in ('public','private','auth','storage'))
 );`,
      snapshot,
    ),
  );
  const sequences = JSON.parse(
    sql(
      database,
      "select coalesce(json_agg(json_build_object('schema',schemaname,'name',sequencename,'start',start_value::text,'increment',increment_by::text,'last',last_value::text) order by schemaname,sequencename),'[]') from pg_sequences where schemaname in ('public','private','auth','storage','supabase_migrations');",
      snapshot,
    ),
  );
  return {
    tables,
    structure,
    structureHash: createHash("sha256")
      .update(JSON.stringify(structure))
      .digest("hex"),
    sequences,
  };
}
export function ensureParent(path) {
  return mkdir(dirname(path), { recursive: true, mode: 0o700 });
}
