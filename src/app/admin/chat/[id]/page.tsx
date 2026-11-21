import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/tracking";
import type { ChatTurn } from "@/lib/chat-contract";
export default async function AdminChat({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireAdmin(),
    { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const r = await client.rpc("admin_chat", { p_id: id });
  if (r.error) throw new Error("Chưa tải được cuộc tư vấn.");
  const turns = r.data as unknown as ChatTurn[];
  if (!turns.length) notFound();
  return (
    <main id="main" className="container page-container">
      <Link href="/admin/chat">← Lịch sử tư vấn</Link>
      <div className="tracking-heading">
        <div>
          <h1>Nội dung tư vấn</h1>
          <p>
            Phiên {id.slice(0, 8)} · 100 lượt gần nhất. Đây là lịch sử; website
            chưa có nhắn trực tiếp với admin.
          </p>
        </div>
      </div>
      <section className="chat-conversation chat-admin-history">
        {turns.map((t) => (
          <article className="chat-turn" key={t.id}>
            <time className="admin-muted">{formatDate(t.createdAt)}</time>
            <div className="chat-bubble chat-customer">
              <strong>Khách</strong>
              <p>{t.customer}</p>
            </div>
            <div className="chat-bubble chat-assistant">
              <strong>
                {t.mode === "ai" ? "Gemini" : "Hướng dẫn / phản hồi dự phòng"}
              </strong>
              <p>{t.assistant ?? "Đang chờ phản hồi"}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
