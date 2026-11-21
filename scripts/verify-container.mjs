import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
const name = `trumpkeys-m7-${randomUUID()}`,
  image = `trumpkeys-web:m7-${randomUUID()}`;
const origin = "https://trumpkeys.publice.io.vn";
function docker(args, { inherit = false } = {}) {
  const r = spawnSync("docker", args, {
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe",
    timeout: 15 * 60 * 1000,
  });
  if (r.status !== 0)
    throw new Error(
      `Docker ${args[0]} failed; inspect local Docker, no application credentials supplied.`,
    );
  return r.stdout?.trim() ?? "";
}
let started = false;
try {
  docker(["build", "-t", image, "."], { inherit: true });
  docker([
    "run",
    "-d",
    "--name",
    name,
    "--label",
    "trumpkeys.task=m7-smoke",
    "--memory",
    "512m",
    "--cpus",
    "1",
    "--pids-limit",
    "128",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges:true",
    "-p",
    "127.0.0.1::3000",
    "-e",
    `APP_ORIGIN=${origin}`,
    "-e",
    "GEMINI_ENABLED=false",
    "-e",
    "TELEGRAM_ENABLED=false",
    "-e",
    "TRUSTED_PROXY=cloudflare",
    image,
  ]);
  started = true;
  const port = docker(["port", name, "3000/tcp"]).split(":").at(-1),
    base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let n = 0; n < 30; n++) {
    try {
      const r = await fetch(`${base}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.ok(ready, "Local container liveness");
  // Node fetch can override the Host header; the native HTTP client sends it verbatim.
  const get = (path, host = "trumpkeys.publice.io.vn", extra = {}) =>
    new Promise((resolve, reject) => {
      const q = request(
        base + path,
        { headers: { Host: host, "cf-connecting-ip": "203.0.113.10", ...extra } },
        (r) => {
          const chunks = [];
          r.on("data", (c) => chunks.push(c));
          r.on("end", () =>
            resolve(
              new Response(Buffer.concat(chunks), {
                status: r.statusCode,
                headers: r.headers,
              }),
            ),
          );
        },
      );
      q.setTimeout(12000, () => q.destroy(new Error("Container HTTP timeout")));
      q.on("error", reject);
      q.end();
    });
  for (const path of [
    "/",
    "/shop",
    "/guide",
    "/privacy",
    "/manifest.json",
    "/icons/icon-192.png",
    "/offline.html",
    "/sw.js",
  ]) {
    const r = await get(path);
    assert.equal(r.status, 200, `production ${path}`);
  }
  for (const path of ["/admin/readiness", "/admin/reports"]) {
    const r = await get(path);
    const body = await r.text();
    // Streaming can commit the loading shell before redirect() sets a status.
    if (r.status === 200) assert.match(body, /NEXT_REDIRECT;replace;\/admin\/login;307;/);
    else {
      assert.ok([303, 307].includes(r.status));
      assert.match(r.headers.get("location") ?? "", /\/admin\/login/);
    }
    assert.match(r.headers.get("cache-control") ?? "", /no-store/);
  }
  assert.equal((await get("/", "invalid.example")).status, 400);
  assert.equal((await get("/healthz", "127.0.0.1")).status, 503, "readiness fails closed without backend credentials");
  assert.equal((await get("/", "trumpkeys.publice.io.vn", {"cf-connecting-ip":""})).status, 403);
  assert.equal(
    (
      await get("/", "trumpkeys.publice.io.vn", {
        "x-forwarded-host": "invalid.example",
      })
    ).status,
    400,
  );
  const track = await get("/track/not-a-valid-code");
  const assertNotFound = async (r) => {
    if (r.status === 200) assert.match(await r.text(), /NEXT_HTTP_ERROR_FALLBACK;404/);
    else assert.equal(r.status, 404);
  };
  await assertNotFound(track);
  assert.match(track.headers.get("cache-control") ?? "", /no-store/);
  for (let i=1;i<30;i++) await assertNotFound(await get("/track/not-a-valid-code"));
  const limited = await get("/track/not-a-valid-code", "trumpkeys.publice.io.vn", {"x-forwarded-for":"198.51.100.99"});
  assert.equal(limited.status, 429, "forged XFF cannot reset quota");
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  await assertNotFound(await get("/track/not-a-valid-code", "trumpkeys.publice.io.vn", {"cf-connecting-ip":"203.0.113.11"}));
  assert.equal(
    docker(["exec", name, "node", "-p", "String(process.getuid())"]),
    "1000",
  );
  const files = docker([
    "exec",
    name,
    "node",
    "--input-type=module",
    "-e",
    "import{existsSync}from'node:fs';console.log(JSON.stringify({env:existsSync('/app/.env.local'),worker:existsSync('/app/scripts/notification-worker.mjs'),policy:existsSync('/app/src/lib/shop-policies.ts')}))",
  ]);
  assert.deepEqual(JSON.parse(files), {
    env: false,
    worker: true,
    policy: true,
  });
  const worker = docker([
    "exec",
    name,
    "node",
    "--experimental-strip-types",
    "scripts/notification-worker.mjs",
    "--once",
  ]);
  assert.match(worker, /chưa bật\/thiếu cấu hình/);
  const refused = spawnSync("docker", ["run", "--rm", "--network", "none", "-e", "DEPLOYMENT_TARGET=hp", image], {encoding:"utf8",timeout:15000});
  assert.equal(refused.status, 1, "HP cannot start with missing production configuration");
  assert.match(refused.stderr ?? "", /HP startup refused/);
  console.log(
    "PASS: Linux production image, non-root/512MB, public policies/assets, private redirects/no-store, host guards, isolated worker dependencies and no local env in runtime.",
  );
  console.log(`Local verification image retained: ${image}`);
} finally {
  if (started) docker(["rm", "-f", name]);
}
