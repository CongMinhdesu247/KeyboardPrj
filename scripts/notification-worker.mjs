import { createClient } from "@supabase/supabase-js";
import { sendTelegram, telegramConfigured } from "../src/lib/integrations.ts";
// Explicit operator command. No external requests when disabled or incomplete.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* Deployment injects environment. */
}
if (process.env.PREFER_IPV4 === "true") {
  const { setDefaultResultOrder } = await import("node:dns");
  setDefaultResultOrder("ipv4first");
}
if (!telegramConfigured(process.env)) {
  console.log(
    "Telegram chưa bật/thiếu cấu hình. Không gửi và không tiêu lượt thử.",
  );
  process.exit(0);
}
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Thiếu cấu hình database server.");
  process.exit(1);
}
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
do {
  try {
    const claim = await client.rpc("claim_notifications");
    if (claim.error) throw new Error("claim");
    let sent = 0;
    for (const n of claim.data ?? []) {
      const r = await sendTelegram(process.env, n);
      const ack = await client.rpc("finish_notification", {
        p_id: n.id,
        p_lease: n.lease,
        p_error: r.error,
        p_retry: r.retry,
      });
      if (!ack.error && ack.data && !r.error) sent++;
    }
    console.log(
      `Telegram: ${sent}/${claim.data.length} thông báo xác nhận đã gửi.`,
    );
  } catch {
    console.error(
      "Lượt xử lý lỗi. Hàng đợi giữ nguyên để thử sau; không in payload hoặc secret.",
    );
    if (process.argv.includes("--once")) process.exitCode = 1;
  }
  if (process.argv.includes("--once") || stopped) break;
  await new Promise((resolve) => setTimeout(resolve, 30000));
} while (!stopped);
