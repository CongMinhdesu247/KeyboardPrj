import nft from "next/dist/compiled/@vercel/nft/index.js";
import { copyFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
// Next bundles the SDK into web chunks; the independent worker needs native ESM files.
// Reuse Next's own tracer so transitive dependencies follow the installed lockfile.
const root = process.cwd();
const traced = await nft.nodeFileTrace(
  [resolve(root, "node_modules/@supabase/supabase-js/dist/index.mjs")],
  { base: root, conditions: ["node", "import"] },
);
if (traced.warnings.size)
  throw new Error("Worker dependency tracing has unresolved imports.");
const files = new Set([
  ...traced.fileList,
  "node_modules/@supabase/supabase-js/package.json",
]);
for (const file of files) {
  if (!file.startsWith("node_modules/") && !file.startsWith("node_modules\\"))
    continue;
  const target = resolve(root, "output/worker-runtime", file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(root, file), target);
}
console.log(
  `Packaged ${files.size} traced worker dependency files; no env or application data.`,
);
