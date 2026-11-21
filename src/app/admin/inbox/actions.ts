"use server";
import { requireAdmin } from "@/lib/auth";
import type { AdminInbox } from "@/lib/inbox-contract";

export async function loadAdminInbox(unread = false, offset = 0): Promise<{ data?: AdminInbox; error?: string }> {
  const { client } = await requireAdmin();
  if (typeof unread !== "boolean" || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
    return { error: "Bộ lọc thông báo không hợp lệ." };
  const result = await client.rpc("admin_inbox", { p_limit: 20, p_offset: offset, p_unread: unread });
  if (result.error) return { error: "Chưa tải được thông báo. Hãy thử lại." };
  return { data: result.data as unknown as AdminInbox };
}

export async function readAdminNotifications(input: { ids?: string[]; before?: string }): Promise<{ error?: string }> {
  const { client } = await requireAdmin();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!input || typeof input !== "object" || (input.ids === undefined) === (input.before === undefined))
    return { error: "Thao tác thông báo không hợp lệ." };
  if (input.ids !== undefined && (!Array.isArray(input.ids) || input.ids.length < 1 || input.ids.length > 50 || input.ids.some(id => typeof id !== "string" || !uuid.test(id))))
    return { error: "Danh sách thông báo không hợp lệ." };
  if (input.before !== undefined && (typeof input.before !== "string" || input.before.length > 40 || !Number.isFinite(Date.parse(input.before))))
    return { error: "Mốc thông báo không hợp lệ." };
  const result = await client.rpc("read_admin_notifications", input.ids ? { p_ids: input.ids } : { p_before: input.before! });
  return result.error ? { error: "Chưa đánh dấu được thông báo. Hãy thử lại." } : {};
}
