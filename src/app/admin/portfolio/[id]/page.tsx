import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  PortfolioEditor,
  ArchivePortfolioForm,
} from "@/components/portfolio-editor";
import type { PortfolioItem } from "@/lib/m4-contract";
export default async function PortfolioEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireAdmin(),
    { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const result = await client.rpc("list_portfolio_admin");
  if (result.error) throw new Error("Chưa tải được bài.");
  const item = (result.data as unknown as PortfolioItem[]).find(
    (i) => i.id === id,
  );
  if (!item) notFound();
  const signed = item.image_path
    ? await client.storage
        .from("portfolio-media")
        .createSignedUrl(item.image_path, 300)
    : null;
  return (
    <main id="main" className="container page-container">
      <Link className="back-link" href="/admin/portfolio">
        ← Portfolio
      </Link>
      <div className="tracking-heading">
        <div>
          <span className="badge">{item.published ? "Công khai" : "Nháp"}</span>
          <h1>{item.title}</h1>
        </div>
        <a className="button button-outline" href={`/admin/portfolio/${id}`}>
          Tải lại bài
        </a>
      </div>
      <section className="admin-panel">
        <PortfolioEditor
          id={id}
          item={item}
          imageUrl={signed?.data?.signedUrl}
        />
        <ArchivePortfolioForm item={item} />
      </section>
    </main>
  );
}
