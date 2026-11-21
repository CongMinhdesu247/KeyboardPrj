import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  containedPath,
  drillDatabaseName,
  assertDrillDatabase,
  sqlIdent,
  sqlLiteral,
  archiveEntry,
} from "../scripts/local-backup-common.mjs";
test("Backup paths cannot escape the private backup directory or name a live restore target", () => {
  const root = resolve("output/backups/test-root");
  assert.equal(
    containedPath(root, "objects/test.bin"),
    resolve(root, "objects/test.bin"),
  );
  for (const path of ["../outside", "..\\outside", root])
    assert.throws(() => containedPath(root, path));
  assert.equal(
    drillDatabaseName("a".repeat(32)),
    "trumpkeys_restore_" + "a".repeat(32),
  );
  for (const name of [
    "postgres",
    "template0",
    "supabase_db_trumpkeys-local",
    "trumpkeys_restore_old",
    "trumpkeys_restore_" + "a".repeat(32) + ";drop database postgres;",
  ])
    assert.throws(() => assertDrillDatabase(name));
  assert.throws(() => drillDatabaseName("../postgres"));
  assert.equal(sqlIdent('a"b'), '"a""b"');
  assert.equal(sqlLiteral("a'b"), "'a''b'");
  for (const name of [
    "../bad",
    "/root/file",
    "C:/secret",
    "src/../../secret",
    "src\\secret",
    "src/file\nnext",
  ])
    assert.throws(() => archiveEntry(name));
  assert.equal(archiveEntry("src/app/page.tsx"), "src/app/page.tsx");
});
