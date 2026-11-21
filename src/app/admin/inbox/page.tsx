import { requireAdmin } from "@/lib/auth";
import { AdminInboxView } from "@/components/admin-inbox";
import type { AdminInbox } from "@/lib/inbox-contract";

export default async function AdminInboxPage() {
  const { client } = await requireAdmin();
  const result = await client.rpc("admin_inbox", { p_limit: 20 });
  if (result.error) throw new Error("Chưa tải được thông báo cửa hàng.");
  return <main id="main" className="container page-container"><div className="tracking-heading"><div><h1>Thông báo cửa hàng</h1><p>Mở thông báo để xem và xử lý. Trạng thái đã đọc được lưu riêng cho bạn.</p></div></div><AdminInboxView initial={result.data as unknown as AdminInbox} /></main>;
}
