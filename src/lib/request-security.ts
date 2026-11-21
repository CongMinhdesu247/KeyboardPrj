import { isIP } from "node:net";
import { createHash } from "node:crypto";

// Only enable behind the loopback-only Cloudflare Tunnel ingress. Never trust XFF.
export function clientAddress(headers: Pick<Headers, "get">, mode: string | undefined) {
  if (mode !== "cloudflare") return "local";
  const value = headers.get("cf-connecting-ip")?.trim() ?? "";
  const family = isIP(value);
  if (!family) return null;
  return family === 6 ? new URL(`http://[${value}]`).hostname.toLowerCase() : value;
}

export function sameOriginWrite(method: string, origin: string | null, canonical: string) {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  // Browser forms and Server Actions send Origin. Missing Origin fails closed too.
  return origin === new URL(canonical).origin;
}

export function createRequestLimiter(maxEntries = 4000) {
  const windows = new Map<string, { count: number; until: number }>();
  return (address: string, scope: string, limit: number, now = Date.now()) => {
    for (const [key, entry] of windows) if (entry.until <= now) windows.delete(key);
    // No raw IPs in memory keys, logs or response payloads.
    const key = createHash("sha256").update(`${scope}:${address}`).digest("hex");
    let entry = windows.get(key);
    if (!entry) {
      if (windows.size >= maxEntries) return 60;
      entry = { count: 0, until: now + 60000 };
      windows.set(key, entry);
    }
    return ++entry.count > limit ? Math.max(1, Math.ceil((entry.until - now) / 1000)) : 0;
  };
}
