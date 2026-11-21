"use server";
import { requireAdmin } from "@/lib/auth";
import { dispatchNotifications } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
export async function sendPendingNotifications(): Promise<void> {
  await requireAdmin();
  await dispatchNotifications();
  revalidatePath("/admin/notifications");
}
export async function retryFailedNotifications(): Promise<void> {
  const { client } = await requireAdmin();
  const r = await client.rpc("retry_failed_notifications");
  if (r.error) throw new Error("Chưa đưa được thông báo lỗi về hàng đợi.");
  await dispatchNotifications();
  revalidatePath("/admin/notifications");
}
