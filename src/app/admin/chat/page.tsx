import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/tracking";
export default async function AdminChats() {
  const { client } = await requireAdmin(),
    r = await client.rpc("admin_chat");
  if (r.error) throw new Error("Chưa tải được lịch sử tư vấn.");
  const items = r.data as unknown as {
    id: string;
    createdAt: string;
    updatedAt: string;
    handoff: string | null;
    preview: string | null;
  }[];
  return (
    <main id="main" className="container page-container">
      <div className="tracking-heading">
        <div>
          <h1>Lịch sử tư vấn</h1>
          <p>
            100 phiên mới nhất. Chat AI hỗ trợ bước đầu; trao đổi với người thật
            qua Zalo.
          </p>
        </div>
        <Link className="button button-outline" href="/admin/chat">
          Tải lại dữ liệu
        </Link>
      </div>
      <div className="requests-list">
        {!items.length ? (
          <section className="admin-panel admin-empty">
            <h2>Chưa có cuộc tư vấn</h2>
            <p>Câu hỏi khách gửi ở trang Tư vấn sẽ xuất hiện tại đây.</p>
          </section>
        ) : (
          items.map((s) => (
            <Link
              className="admin-panel chat-session-link"
              href={`/admin/chat/${s.id}`}
              key={s.id}
            >
              <div>
                <span className="badge">
                  {s.handoff ? "Cần hỗ trợ qua Zalo" : "Tư vấn ban đầu"}
                </span>
                <h2>{s.preview || "Phiên chưa có câu hỏi"}</h2>
                <p>
                  Phiên {s.id.slice(0, 8)} · {formatDate(s.updatedAt)}
                </p>
              </div>
              <span aria-hidden="true">Mở phiên →</span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
