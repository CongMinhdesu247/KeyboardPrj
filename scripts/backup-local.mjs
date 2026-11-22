import { createReadStream, createWriteStream } from "node:fs";
import { readFile, writeFile, copyFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve, basename } from "node:path";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import {
  workspace,
  backupRoot,
  container,
  dbRole,
  containedPath,
  drillDatabaseName,
  assertDrillDatabase,
  sql,
  sqlLiteral,
  run,
  localConfig,
  protectedDirectory,
  existingBackup,
  checkedFile,
  fileHash,
  exportSnapshot,
  streamCommand,
  inventory,
  ensureParent,
  sourceFiles as collectSourceFiles,
  archiveEntry,
} from "./local-backup-common.mjs";

process.umask(0o077);
let stage = "validate";
let activeFolder;
const objectList = (database, snapshot) =>
  JSON.parse(
    sql(
      database,
      "select coalesce(json_agg(json_build_object('id',id,'bucket',bucket_id,'name',name,'metadata',metadata,'version',version,'updatedAt',updated_at) order by id),'[]') from storage.objects;",
      snapshot,
    ),
  );
async function backup() {
  const config = localConfig(),
    id = randomUUID(),
    startedAt = new Date().toISOString();
  const folder = containedPath(
    backupRoot,
    `${startedAt.replace(/[:.]/g, "-")}-${id}`,
  );
  await protectedDirectory(backupRoot);
  await protectedDirectory(folder);
  activeFolder = folder;
  const snapshot = await exportSnapshot();
  try {
    stage = "database-dump";
    console.log(
      "Backing up local PostgreSQL from a read-only exported snapshot…",
    );
    const dump = containedPath(folder, "database.dump");
    await streamCommand(
      [
        "exec",
        container,
        "pg_dump",
        "-U",
        dbRole,
        "-d",
        "postgres",
        "--format=custom",
        `--snapshot=${snapshot.id}`,
        "--lock-wait-timeout=10000",
        "--no-subscriptions",
      ],
      { output: createWriteStream(dump, { flags: "wx", mode: 0o600 }) },
    );
    stage = "database-inventory";
    console.log(
      "Recording table fingerprints, permissions and sequence state…",
    );
    const expected = inventory("postgres", snapshot.id),
      objects = objectList("postgres", snapshot.id);
    const client = createClient(
      config.API_URL,
      config.SECRET_KEY ?? config.SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input, init) =>
            fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
        },
      },
    );
    const entries = [];
    const record = async (file) => {
      const p = await checkedFile(folder, file);
      entries.push({
        file,
        bytes: (await stat(p)).size,
        sha256: await fileHash(p),
      });
    };
    await record("database.dump");
    stage = "storage-download";
    console.log(
      `Backing up ${objects.length} Storage objects, including private buckets…`,
    );
    for (const object of objects) {
      if (!/^[a-f0-9-]{36}$/.test(object.id))
        throw new Error("Unexpected Storage identifier.");
      const response = await client.storage
        .from(object.bucket)
        .download(object.name);
      if (response.error || !response.data)
        throw new Error(
          "A Storage object could not be backed up; archive remains incomplete.",
        );
      const file = `objects/${object.id}.bin`,
        path = containedPath(folder, file);
      await ensureParent(path);
      const bytes = Buffer.from(await response.data.arrayBuffer());
      if (
        object.metadata?.size !== undefined &&
        Number(object.metadata.size) !== bytes.length
      )
        throw new Error("Storage bytes changed during backup.");
      await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
      object.file = file;
      await record(file);
    }
    // Cross-service consistency: concurrent object uploads/replacement/deletion invalidates this attempt.
    const comparison = objects.map((o) => {
      const copy = { ...o };
      delete copy.file;
      return copy;
    });
    assert.deepEqual(
      objectList("postgres"),
      comparison,
      "Storage metadata changed; retry during a quiet period.",
    );
    stage = "operator-config";
    const configurations = [
      ".env.local",
      ".env.bootstrap.local",
      "supabase/.env",
      "supabase/config.toml",
      "package.json",
      "package-lock.json",
    ];
    for (let i = 0; i < configurations.length; i++) {
      const source = resolve(workspace, configurations[i]);
      try {
        await stat(source);
      } catch {
        if (configurations[i] === ".env.bootstrap.local") continue;
        throw new Error("Required local configuration is missing.");
      }
      const file = `config/${i}.bin`,
        path = containedPath(folder, file);
      await ensureParent(path);
      await copyFile(source, path);
      await record(file);
    }
    const runtimeFile = containedPath(folder, "local-stack.json");
    await writeFile(runtimeFile, JSON.stringify(config, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    await record("local-stack.json");
    const roles = run("docker", [
      "exec",
      container,
      "pg_dumpall",
      "-U",
      dbRole,
      "--roles-only",
      "--no-role-passwords",
    ]);
    await writeFile(containedPath(folder, "roles-no-passwords.sql"), roles, {
      flag: "wx",
      mode: 0o600,
    });
    await record("roles-no-passwords.sql");
    const sourceFiles = JSON.parse(
      sql(
        "postgres",
        "select coalesce(json_agg(version order by version),'[]') from supabase_migrations.schema_migrations;",
        snapshot.id,
      ),
    );
    stage = "source-archive";
    const source = await collectSourceFiles();
    run(
      "tar",
      [
        "-czf",
        containedPath(folder, "source.tar.gz"),
        "-C",
        workspace,
        "--null",
        "-T",
        "-",
      ],
      source.map((f) => f.file).join("\0") + "\0",
    );
    for (const f of source)
      assert.equal(
        await fileHash(resolve(workspace, f.file)),
        f.sha256,
        "Source changed during backup; retry when quiet.",
      );
    await record("source.tar.gz");
    const manifest = {
      format: "trumpkeys-local-backup-v2",
      id,
      startedAt,
      completedAt: new Date().toISOString(),
      source: {
        container,
        database: "postgres",
        api: config.API_URL,
        postgres: sql("postgres", "show server_version;"),
        image: run("docker", ["inspect", "--format", "{{.Image}}", container]),
        migrationVersions: sourceFiles,
      },
      inventory: expected,
      objects,
      configurations,
      sourceFiles: source,
      files: entries,
    };
    await snapshot.close();
    await writeFile(
      containedPath(folder, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      { flag: "wx", mode: 0o600 },
    );
    console.log(`BACKUP COMPLETE: ${folder}`);
    console.log(
      `Tables checked: ${expected.tables.length}; Storage files: ${objects.length}. Directory is operator-only and gitignored.`,
    );
    return folder;
  } catch (error) {
    await writeFile(
      containedPath(folder, "INCOMPLETE.txt"),
      `Backup did not complete at stage ${stage}. Do not restore this directory.\n`,
      { mode: 0o600 },
    );
    throw error;
  } finally {
    await snapshot.close();
  }
}

async function verify(folder) {
  localConfig();
  folder = await existingBackup(folder);
  activeFolder = folder;
  try{await stat(containedPath(folder,"INCOMPLETE.txt"));throw new Error("Incomplete backup cannot be restored.");}catch(error){if(error.code!=="ENOENT")throw error;}
  const m = JSON.parse(
    await readFile(await checkedFile(folder, "manifest.json"), "utf8"),
  );
  if (
    m.format !== "trumpkeys-local-backup-v2" ||
    m.source?.container !== container ||
    m.source.database !== "postgres" ||
    !Array.isArray(m.files) ||
    !Array.isArray(m.objects) ||
    !m.inventory ||
    !Array.isArray(m.sourceFiles)
  )
    throw new Error("Not a supported local backup.");
  if (!/^[a-f0-9-]{36}$/.test(m.id) || !basename(folder).endsWith(m.id))
    throw new Error("Backup identity does not match its directory.");
  stage = "verify-checksums";
  console.log(
    "Verifying all backup file checksums before creating a restore target…",
  );
  const names = new Set();
  for (const f of m.files) {
    if (names.has(f.file) || !/^[a-f0-9]{64}$/.test(f.sha256))
      throw new Error("Invalid backup file manifest.");
    names.add(f.file);
    const file = await checkedFile(folder, f.file);
    if (
      (await stat(file)).size !== f.bytes ||
      (await fileHash(file)) !== f.sha256
    )
      throw new Error("Backup checksum mismatch. Restore stopped.");
  }
  if (!names.has("database.dump"))
    throw new Error("Database archive is missing.");
  if (!names.has("source.tar.gz"))
    throw new Error("Source archive is missing.");
  const sourceArchive = await checkedFile(folder, "source.tar.gz");
  const listed = run("tar", ["-tzf", sourceArchive])
    .split(/\r?\n/)
    .filter(Boolean)
    .map(archiveEntry)
    .sort();
  assert.deepEqual(
    listed,
    m.sourceFiles.map((f) => archiveEntry(f.file)).sort(),
    "Source archive entries must match the manifest.",
  );
  if (
    run("tar", ["-tvzf", sourceArchive])
      .split(/\r?\n/)
      .filter(Boolean)
      .some((line) => !line.startsWith("-"))
  )
    throw new Error("Only regular source files may be extracted.");
  for (const object of m.objects)
    if (!names.has(object.file) || object.file !== `objects/${object.id}.bin`)
      throw new Error("Storage file manifest is incomplete.");
  const target = assertDrillDatabase(
      drillDatabaseName(randomUUID().replaceAll("-", "")),
    ),
    marker = `TRUMP Keys restore drill ${m.id}`;
  let created = false,
    verified = false;
  const started = new Date().toISOString();
  try {
    stage = "isolated-restore";
    console.log(
      "Restoring into a new, unexposed drill database; source postgres is never a restore target…",
    );
    run("docker", [
      "exec",
      container,
      "createdb",
      "-U",
      dbRole,
      "--maintenance-db=postgres",
      "--template=template0",
      target,
    ]);
    created = true;
    sql(
      "postgres",
      `comment on database ${'"' + target + '"'} is ${sqlLiteral(marker)};`,
    );
    await streamCommand(
      [
        "exec",
        "-i",
        container,
        "pg_restore",
        "-U",
        dbRole,
        "--dbname",
        assertDrillDatabase(target),
        "--single-transaction",
        "--exit-on-error",
        "--no-subscriptions",
      ],
      { input: createReadStream(await checkedFile(folder, "database.dump")) },
    );
    stage = "compare-restored-database";
    console.log(
      "Comparing restored table contents, RLS/grants/functions and sequences…",
    );
    const restored = inventory(target);
    assert.deepEqual(
      restored,
      m.inventory,
      "Restored database fingerprints differ from the backup snapshot.",
    );
    assert.deepEqual(
      objectList(target),
      m.objects.map((o) => {
        const copy = { ...o };
        delete copy.file;
        return copy;
      }),
      "Restored Storage metadata differs.",
    );
    stage = "restore-storage-bytes";
    const restoredFiles = containedPath(folder, `drill-files/${target}`);
    await protectedDirectory(restoredFiles);
    for (const object of m.objects) {
      const input = await checkedFile(folder, object.file),
        output = containedPath(restoredFiles, `${object.id}.bin`);
      await copyFile(input, output);
      assert.equal(
        await fileHash(output),
        m.files.find((f) => f.file === object.file).sha256,
      );
    }
    stage = "restore-source-files";
    const restoredSource = containedPath(folder, `drill-source/${target}`);
    await protectedDirectory(restoredSource);
    run("tar", [
      "-xzf",
      sourceArchive,
      "-C",
      restoredSource,
      "--no-same-owner",
    ]);
    for (const f of m.sourceFiles) {
      const p = await checkedFile(restoredSource, archiveEntry(f.file));
      assert.equal((await stat(p)).size, f.bytes);
      assert.equal(await fileHash(p), f.sha256);
    }
    stage = "permissions-probe";
    // Only the scratch database gets synthetic identities. No real cookies/tokens are used.
    const user = randomUUID(),
      session = randomUUID();
    sql(
      target,
      `insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,created_at) values('${user}','restore-drill@example.test',now(),'{}',now());insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values('${user}','${user}',jsonb_build_object('sub','${user}','email','restore-drill@example.test','email_verified',true),'google',now(),now());insert into auth.sessions(id,user_id,created_at,updated_at,aal) values('${session}','${user}',now(),now(),'aal1');insert into public.admin_members(user_id,email) values('${user}','restore-drill@example.test');`,
    );
    const claims = sqlLiteral(JSON.stringify({ session_id: session }));
    const admin = sql(
      target,
      `begin;set local role authenticated;set local request.jwt.claim.sub='${user}';set local request.jwt.claims=${claims};select public.is_admin();rollback;`,
    );
    assert.equal(admin, "t");
    const reportDate = sql(
      target,
      "select coalesce((max(created_at) at time zone 'Asia/Ho_Chi_Minh')::date,(now() at time zone 'Asia/Ho_Chi_Minh')::date)::text from private.order_payments;",
    );
    const date = sqlLiteral(reportDate);
    const reported = JSON.parse(
      sql(
        target,
        `begin;set local role authenticated;set local request.jwt.claim.sub='${user}';set local request.jwt.claims=${claims};select jsonb_build_object('received',r->>'received','refunded',r->>'refunded') from(select public.cash_report(${date}::date,${date}::date,'day',1) r) t;rollback;`,
      ),
    );
    const expectedMoney = JSON.parse(
      sql(
        target,
        `select json_build_object('received',coalesce(sum(amount_vnd) filter(where kind='receipt'),0)::text,'refunded',coalesce(sum(amount_vnd) filter(where kind='refund'),0)::text) from private.order_payments where created_at>=(${date}::date::timestamp at time zone 'Asia/Ho_Chi_Minh') and created_at<((${date}::date+1)::timestamp at time zone 'Asia/Ho_Chi_Minh');`,
      ),
    );
    assert.deepEqual(
      reported,
      expectedMoney,
      "Restored cash report must reconcile to ledger.",
    );
    const guest = sql(
      target,
      "begin;set local role authenticated;select public.is_admin();rollback;",
    );
    assert.equal(guest, "f");
    const anonRights = sql(
      target,
      "select has_table_privilege('anon','private.orders','SELECT') or has_function_privilege('anon','public.cash_report(date,date,text,integer)','EXECUTE');",
    );
    assert.equal(anonRights, "f");
    const money = JSON.parse(
      sql(
        target,
        "select json_build_object('received',coalesce(sum(amount_vnd) filter(where kind='receipt'),0)::text,'refunded',coalesce(sum(amount_vnd) filter(where kind='refund'),0)::text) from private.order_payments;",
      ),
    );
    const report = {
      format: "trumpkeys-restore-report-v1",
      backupId: m.id,
      startedAt: started,
      verifiedAt: new Date().toISOString(),
      tablesVerified: restored.tables.length,
      objectsRestored: m.objects.length,
      allTableHashesMatch: true,
      permissionsAndFunctionsMatch: true,
      sequencesMatch: true,
      syntheticAdminAllowed: true,
      guestAndAnonymousBlocked: true,
      cashReportReconciles: true,
      sourceFilesRestored: m.sourceFiles.length,
      ledgerTotals: money,
      scope:
        "Local scratch database and filesystem bytes only. Not a new Supabase stack, OAuth or signed Storage API restore.",
      scratchDatabaseRemoved: false,
    };
    await writeFile(
      containedPath(folder, "restore-report.json"),
      JSON.stringify(report, null, 2),
      { mode: 0o600 },
    );
    verified = true;
    console.log(
      `RESTORE VERIFIED: ${restored.tables.length} tables and ${m.objects.length} Storage files. Live database untouched by restore.`,
    );
  } finally {
    if (created) {
      const originalStage = stage;
      stage = "cleanup-drill";
      const actual = sql(
        "postgres",
        `select coalesce(shobj_description(oid,'pg_database'),'') from pg_database where datname=${sqlLiteral(assertDrillDatabase(target))};`,
      );
      if (actual !== marker)
        throw new Error(
          "Drill ownership marker changed; refusing database cleanup.",
        );
      run("docker", [
        "exec",
        container,
        "dropdb",
        "-U",
        dbRole,
        "--maintenance-db=postgres",
        assertDrillDatabase(target),
      ]);
      if (verified) {
        const path = await checkedFile(folder, "restore-report.json"),
          report = JSON.parse(await readFile(path, "utf8"));
        report.scratchDatabaseRemoved = true;
        await writeFile(path, JSON.stringify(report, null, 2), { mode: 0o600 });
      }
      console.log(
        "CLEANUP: removed only this run's marked scratch database; protected backup and restored file copies retained.",
      );
      stage = originalStage;
    }
  }
}

try {
  const [mode, ...args] = process.argv.slice(2);
  if (
    mode === "backup" &&
    (args.length === 0 || (args.length === 1 && args[0] === "--verify"))
  ) {
    const folder = await backup();
    if (args.includes("--verify")) await verify(folder);
  } else if (mode === "verify" && args.length === 2 && args[0] === "--backup")
    await verify(args[1]);
  else
    throw new Error(
      "Use backup [--verify] or verify --backup <local backup directory>.",
    );
} catch (error) {
  if (activeFolder)
    await writeFile(
      containedPath(activeFolder, "diagnostic-private.log"),
      error.diagnostic ?? error.message,
      { mode: 0o600 },
    );
  if (activeFolder && error.actual?.structure && error.expected?.structure)
    await writeFile(
      containedPath(activeFolder, "structure-difference-private.json"),
      JSON.stringify(
        { actual: error.actual.structure, expected: error.expected.structure },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  if (error.actual?.structureHash && error.expected?.structureHash)
    console.error(
      JSON.stringify({
        tableFingerprintsMatch:
          JSON.stringify(error.actual.tables) ===
          JSON.stringify(error.expected.tables),
        structureMatch:
          error.actual.structureHash === error.expected.structureHash,
        sequencesMatch:
          JSON.stringify(error.actual.sequences) ===
          JSON.stringify(error.expected.sequences),
      }),
    );
  console.error(
    `STOPPED at ${stage}. Sensitive SQL, file paths inside Storage, credentials and payloads omitted. Incomplete backups are never reported as successful.`,
  );
  process.exitCode = 1;
}
