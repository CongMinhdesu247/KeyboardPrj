import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
function signature(value: string, secret: string, scope = "find") {
  return createHmac("sha256", secret)
    .update(
      `${scope === "checkout" ? "trumpkeys-checkout-v1" : scope === "chat" ? "trumpkeys-chat-v1" : "trumpkeys-request-v1"}:${value}`,
    )
    .digest("hex");
}
export function issueRequestToken(
  secret: string,
  now = Date.now(),
  scope = "find",
) {
  const body = `${randomUUID()}.${Math.floor(now / 1000) + 3600}`;
  return `${body}.${signature(body, secret, scope)}`;
}
export function verifyRequestToken(
  token: string,
  secret: string,
  now = Date.now(),
  scope = "find",
) {
  const match = /^([a-f0-9-]{36})\.([0-9]{10})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return null;
  const expiry = Number(match[2]),
    seconds = Math.floor(now / 1000);
  if (expiry < seconds || expiry > seconds + 3600) return null;
  return timingSafeEqual(
    Buffer.from(match[3], "hex"),
    Buffer.from(signature(`${match[1]}.${match[2]}`, secret, scope), "hex"),
  )
    ? match[1]
    : null;
}
