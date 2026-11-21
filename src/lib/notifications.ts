import "server-only";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  sendTelegram,
  telegramConfigured,
  type Notification,
} from "@/lib/integrations";
export async function dispatchNotifications() {
  if (!telegramConfigured(process.env))
    return { sent: 0, failed: 0, configured: false };
  const client = createServiceClient();
  const claim = await client.rpc("claim_notifications");
  if (claim.error) throw new Error("Chưa lấy được hàng đợi thông báo.");
  let sent = 0,
    failed = 0;
  // At most five sequential requests, each 8s, within the DB's 90s fencing lease.
  for (const n of claim.data as unknown as Notification[]) {
    const r = await sendTelegram(process.env, n);
    const ack = await client.rpc("finish_notification", {
      p_id: n.id,
      p_lease: n.lease,
      p_error: r.error ?? undefined,
      p_retry: r.retry,
    });
    if (ack.error || !ack.data || r.error) failed++;
    else sent++;
  }
  return { sent, failed, configured: true };
}
export function scheduleNotifications() {
  if (telegramConfigured(process.env))
    after(async () => {
      try {
        await dispatchNotifications();
      } catch {
        /* Durable outbox remains for worker/admin retry. */
      }
    });
}
