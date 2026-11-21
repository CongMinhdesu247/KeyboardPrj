import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { PortfolioEditor } from "@/components/portfolio-editor";
import type { AdminOrder } from "@/lib/order-contract";
export default async function NewPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; event?: string }>;
}) {
  const { client } = await requireAdmin(),
    p = await searchParams;
  let sourceOrder = "",
    sourceEvent = "",
    imageUrl: string | undefined;
  if (p.order || p.event) {
    if (
      !/^[a-f0-9-]{36}$/i.test(p.order ?? "") ||
      !/^[a-f0-9-]{36}$/i.test(p.event ?? "")
    )
      throw new Error("Ảnh nguồn không hợp lệ.");
    const result = await client.rpc("read_order", { p_id: p.order! });
    const e = (result.data as unknown as AdminOrder | null)?.events.find(
      (e) => e.id === p.event && e.path?.endsWith(".webp"),
    );
    if (result.error || !e?.path)
      throw new Error("Không tìm thấy ảnh trong đơn nguồn.");
    const signed = await client.storage
      .from("order-media")
      .createSignedUrl(e.path, 300);
    if (signed.error) throw new Error("Chưa xem được ảnh nguồn.");
    imageUrl = signed.data.signedUrl;
    sourceOrder = p.order!;
    sourceEvent = p.event!;
  }
  return (
    <main id="main" className="container page-container">
      <Link className="back-link" href="/admin/portfolio">
        ← Portfolio
      </Link>
      <h1>Thêm bài portfolio</h1>
      <section className="admin-panel">
        <PortfolioEditor
          id={randomUUID()}
          sourceOrder={sourceOrder}
          sourceEvent={sourceEvent}
          imageUrl={imageUrl}
        />
      </section>
    </main>
  );
}
