import test from "node:test";
import assert from "node:assert/strict";
import { clientAddress, createRequestLimiter, sameOriginWrite } from "../src/lib/request-security.ts";
import { probeDatabase } from "../src/lib/readiness-probe.ts";
import { isAllowedHost } from "../src/lib/host-policy.ts";

test("trusted tunnel IP rejects missing/list/invalid headers and ignores forged XFF", () => {
  const h = new Headers({ "cf-connecting-ip": "203.0.113.1", "x-forwarded-for": "1.2.3.4" });
  assert.equal(clientAddress(h, "cloudflare"), "203.0.113.1");
  assert.equal(clientAddress(h, undefined), "local");
  for (const value of ["", "203.0.113.1, 1.2.3.4", "attacker", "127.1"])
    assert.equal(clientAddress(new Headers({ "cf-connecting-ip": value }), "cloudflare"), null);
  assert.equal(clientAddress(new Headers({ "cf-connecting-ip": "2001:0db8::1" }), "cloudflare"), "[2001:db8::1]");
});
test("request quota isolates addresses, bounds memory and expires windows", () => {
  const limit = createRequestLimiter(2);
  assert.equal(limit("a", "tracking", 1, 0), 0);
  assert.equal(limit("a", "tracking", 1, 1000), 59);
  assert.equal(limit("b", "tracking", 1, 1000), 0);
  assert.equal(limit("c", "tracking", 1, 1000), 60);
  assert.equal(limit("a", "tracking", 1, 60000), 0);
});
test("writes need exact origin including scheme; loopback is only allowed for health", () => {
  const origin = "https://trumpkeys.publice.io.vn";
  for (const value of [null, "http://trumpkeys.publice.io.vn", "https://evil.example"])
    assert.equal(sameOriginWrite("POST", value, origin), false);
  assert.equal(sameOriginWrite("POST", origin, origin), true);
  assert.equal(isAllowedHost("127.0.0.1:8094", "/healthz", origin), true);
  assert.equal(isAllowedHost("127.0.0.1:8094", "/admin", origin), false);
});
test("readiness fails closed, uses bounded DB query and never returns upstream errors", async () => {
  const env = { APP_ORIGIN: "https://trumpkeys.publice.io.vn", SUPABASE_URL: "https://db.example.test", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", SUPABASE_SECRET_KEY: "test" };
  assert.equal(await probeDatabase({}), false);
  const http = (async (url, options) => {
    assert.equal(String(url), "https://db.example.test/rest/v1/service_categories?select=slug&limit=1");
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal);
    return Response.json([]);
  }) as typeof fetch;
  assert.equal(await probeDatabase(env, http), true);
  assert.equal(await probeDatabase(env, (async () => new Response("private error", { status: 500 })) as typeof fetch), false);
  assert.equal(await probeDatabase(env, (async () => { throw new Error("secret"); }) as typeof fetch), false);
});
