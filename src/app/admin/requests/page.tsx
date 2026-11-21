import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { requestStatuses, type CustomRequest } from "@/lib/m4-contract";
import { RequestAdminForm } from "@/components/request-admin-form";
import { money } from "@/lib/order-contract";
import { formatDate } from "@/lib/tracking";
export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { client } = await requireAdmin(),
    filters = await searchParams,
    result = await client.rpc("list_custom_requests");
  if (result.error) throw new Error("Chưa tải được yêu cầu đặt tìm.");
  const all = result.data as unknown as CustomRequest[],
    status = filters.status ?? "",
    q = (filters.q ?? "").slice(0, 120).toLocaleLowerCase("vi");
  const filtered = all.filter(
    (r) =>
      (!status || r.status === status) &&
      `${r.customer_name} ${r.phone} ${r.note}`
        .toLocaleLowerCase("vi")
        .includes(q),
  );
  const items = await Promise.all(
    filtered.map(async (r) => {
      const signed = r.image_path
        ? await client.storage
            .from("request-images")
            .createSignedUrl(r.image_path, 300)
        : null;
      return { ...r, imageUrl: signed?.data?.signedUrl };
    }),
  );
  return (
    <main id="main" className="container page-container">
      <div className="tracking-heading">
        <div>
          <h1>Yêu cầu đặt tìm</h1>
          <p>
            Tiếp nhận mẫu, liên hệ tư vấn và ghi lại kết quả. Gửi yêu cầu không
            thu cọc.
          </p>
        </div>
        <a className="button button-outline" href="/admin/requests">
          Tải lại dữ liệu
        </a>
      </div>
      <nav className="admin-filters" aria-label="Lọc yêu cầu">
        <Link
          href="/admin/requests"
          aria-current={!status ? "page" : undefined}
        >
          Tất cả <span>{all.length}</span>
        </Link>
        {Object.entries(requestStatuses).map(([v, label]) => (
          <Link
            key={v}
            href={`/admin/requests?status=${v}`}
            aria-current={status === v ? "page" : undefined}
          >
            {label}
            <span>{all.filter((r) => r.status === v).length}</span>
          </Link>
        ))}
      </nav>
      <form className="admin-search" method="get">
        <input type="hidden" name="status" value={status} />
        <label>
          Tìm yêu cầu
          <input
            type="search"
            name="q"
            maxLength={120}
            defaultValue={filters.q ?? ""}
            placeholder="Tên khách, SĐT hoặc ghi chú"
          />
        </label>
        <button className="button button-outline">Tìm kiếm</button>
      </form>
      <p className="admin-muted">
        {items.length} kết quả trong 200 yêu cầu mới nhất.
      </p>
      <div className="requests-list">
        {!items.length ? (
          <section className="admin-panel admin-empty">
            <h2>Chưa có yêu cầu phù hợp</h2>
            <p>Yêu cầu khách gửi từ trang đặt tìm sẽ xuất hiện tại đây.</p>
          </section>
        ) : (
          items.map((r) => (
            <article key={r.id} id={`request-${r.id}`} className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <span className="badge">{requestStatuses[r.status]}</span>
                  <h2>{r.customer_name}</h2>
                  <p>
                    {r.category === "keycap" ? "Keycap" : "Stabilizer"} ·{" "}
                    {r.phone} ·{" "}
                    {r.budget_vnd ? money(r.budget_vnd) : "Ngân sách chưa chốt"}
                  </p>
                </div>
                <time className="admin-muted">{formatDate(r.created_at)}</time>
              </div>
              <p className="m4-note">{r.note || "Không có ghi chú mẫu."}</p>
              {r.reference_url && (
                <p>
                  <a href={r.reference_url} target="_blank" rel="noreferrer">
                    Mở link mẫu khách gửi ↗
                  </a>
                </p>
              )}
              {r.imageUrl && (
                <div className="m4-image-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.imageUrl} alt="Ảnh mẫu khách gửi" />
                </div>
              )}
              <details className="admin-disclosure">
                <summary>Cập nhật xử lý yêu cầu</summary>
                <RequestAdminForm request={r} />
              </details>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
