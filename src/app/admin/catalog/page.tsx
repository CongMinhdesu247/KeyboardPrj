import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { catalogImageUrl, type AdminCatalogItem } from "@/lib/catalog-data";
import { readAuthConfig } from "@/lib/auth-config";
import { StockForm } from "@/components/catalog-admin";
import { formatVnd } from "@/lib/estimate";
import { categories } from "@/lib/catalog";
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    archived?: string;
  }>;
}) {
  const { client } = await requireAdmin();
  const { data, error } = await client.rpc("list_catalog_admin");
  if (error) throw new Error("Chưa tải được danh sách. Hãy thử lại.");
  const all = (Array.isArray(data)
    ? data
    : []) as unknown as AdminCatalogItem[];
  const filters = await searchParams;
  const query = (filters.q ?? "").slice(0, 120).toLocaleLowerCase("vi");
  const items = all.filter(
    (item) =>
      (!query || item.name.toLocaleLowerCase("vi").includes(query)) &&
      (!filters.category || item.category_slug === filters.category) &&
      (!filters.status ||
        (filters.status === "public" ? item.active : !item.active)),
  );
  return (
    <main id="main" className="container admin-catalog">
      <div className="section-heading">
        <div>
          <h1>Dịch vụ và linh kiện</h1>
          <p>{all.length} mục đang quản lý · Giá chưa gồm phí vận chuyển</p>
        </div>
        <Link href="/admin/catalog/new" className="button button-primary">
          Thêm dịch vụ / sản phẩm
        </Link>
      </div>
      {filters.archived === "1" && (
        <p className="auth-feedback" role="status">
          Đã đưa mục vào lưu trữ và gỡ khỏi bảng giá. Lịch sử tồn kho được giữ
          nguyên.
        </p>
      )}
      <form className="catalog-filters" method="get">
        <label>
          Tìm theo tên
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            maxLength={120}
            placeholder="Lube, keycap, switch…"
          />
        </label>
        <label>
          Nhóm
          <select name="category" defaultValue={filters.category ?? ""}>
            <option value="">Tất cả</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hiển thị
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Tất cả</option>
            <option value="public">Công khai</option>
            <option value="draft">Nháp / tạm ẩn</option>
          </select>
        </label>
        <button className="button button-outline">Lọc danh sách</button>
      </form>
      <p className="catalog-help">
        Chỉ mục công khai có giá mới xuất hiện ở cửa hàng. Mở từng linh kiện để nhập hoặc điều chỉnh tồn.
      </p>
      <div className="catalog-admin-list">
        {!items.length && (
          <div className="info-panel">
            <h2>Chưa có mục phù hợp</h2>
            <p>Thử bỏ bộ lọc hoặc thêm dịch vụ/sản phẩm đầu tiên.</p>
          </div>
        )}
        {items.map((item) => (
          <article key={item.id} className="catalog-admin-card">
            <div className="catalog-item-heading">
              <div className="admin-catalog-thumb">
                {item.image_path ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={catalogImageUrl(
                        item.image_path,
                        readAuthConfig(process.env)!.url,
                      )}
                      alt={item.name}
                      width={72}
                      height={72}
                    />
                  </>
                ) : (
                  <span>Chưa có ảnh</span>
                )}
              </div>
              <div>
                <span className={`badge ${item.active ? "badge-public" : "badge-draft"}`}>
                  {item.active ? "Công khai" : "Nháp / tạm ẩn"}
                </span>
                <h2>{item.name}</h2>
                <p>
                  {categories.find((c) => c.slug === item.category_slug)?.title}{" "}
                  · {item.type === "service" ? "Dịch vụ" : "Linh kiện"}
                </p>
              </div>
              <Link
                className="button button-outline"
                href={`/admin/catalog/${item.id}`}
              >
                Chỉnh sửa
              </Link>
            </div>
            <dl className="catalog-stats">
              <div>
                <dt>Giá bán / {item.unit}</dt>
                <dd>
                  {item.price_vnd === null
                    ? "Chưa nhập"
                    : formatVnd(item.price_vnd)}
                </dd>
              </div>
              <div>
                <dt>Giá vốn</dt>
                <dd>{formatVnd(item.cost_vnd)}</dd>
              </div>
              <div>
                <dt>Tồn kho</dt>
                <dd
                  className={
                    item.type === "product" && item.stock_quantity === 0
                      ? "catalog-stock-zero"
                      : undefined
                  }
                >
                  {item.type === "product"
                    ? `${item.stock_quantity} ${item.unit}`
                    : "Không áp dụng"}
                </dd>
              </div>
            </dl>
            {item.type === "product" && (
              <details>
                <summary>Nhập hàng / điều chỉnh tồn</summary>
                <StockForm id={item.id} requestId={randomUUID()} />
                <Link
                  href={`/admin/catalog/${item.id}#history`}
                  className="back-link"
                >
                  Xem lịch sử tồn kho
                </Link>
              </details>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
