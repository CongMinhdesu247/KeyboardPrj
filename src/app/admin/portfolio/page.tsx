import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { PortfolioItem } from "@/lib/m4-contract";
export default async function PortfolioAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; archived?: string }>;
}) {
  const { client } = await requireAdmin(),
    filters = await searchParams,
    result = await client.rpc("list_portfolio_admin");
  if (result.error) throw new Error("Chưa tải được portfolio.");
  const all = result.data as unknown as PortfolioItem[],
    q = (filters.q ?? "").slice(0, 120).toLocaleLowerCase("vi"),
    items = all.filter(
      (i) =>
        `${i.title} ${i.keyboard}`.toLocaleLowerCase("vi").includes(q) &&
        (!filters.status ||
          (filters.status === "public" ? i.published : !i.published)),
    );
  return (
    <main id="main" className="container page-container">
      <div className="tracking-heading">
        <div>
          <h1>Portfolio & sound test</h1>
          <p>Chỉ công khai những bài và hình ảnh đã được shop kiểm tra.</p>
        </div>
        <Link className="button button-primary" href="/admin/portfolio/new">
          Thêm bài portfolio
        </Link>
      </div>
      {filters.archived === "1" && (
        <p role="status">Đã lưu trữ bài và ngừng công khai.</p>
      )}
      <form className="admin-search" method="get">
        <label>
          Tìm bài portfolio
          <input
            name="q"
            type="search"
            maxLength={120}
            defaultValue={filters.q ?? ""}
          />
        </label>
        <label>
          Hiển thị
          <select
            name="status"
            aria-label="Hiển thị"
            defaultValue={filters.status ?? ""}
          >
            <option value="">Tất cả</option>
            <option value="public">Công khai</option>
            <option value="draft">Nháp</option>
          </select>
        </label>
        <button className="button button-outline">Lọc bài</button>
      </form>
      <p className="admin-muted">{items.length} bài trong 200 bài mới nhất.</p>
      <div className="requests-list">
        {!items.length ? (
          <section className="admin-panel admin-empty">
            <h2>Chưa có bài phù hợp</h2>
            <p>
              Thêm ảnh bàn phím và sound test thật, hoặc chọn ảnh từ chi tiết
              đơn để tạo bài mới.
            </p>
          </section>
        ) : (
          items.map((i) => (
            <Link
              key={i.id}
              href={`/admin/portfolio/${i.id}`}
              className="admin-panel portfolio-admin-row"
            >
              <div>
                <span className="badge">
                  {i.published ? "Công khai" : "Nháp"}
                </span>
                <h2>{i.title}</h2>
                <p>{i.keyboard}</p>
              </div>
              <span>Chỉnh sửa</span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
