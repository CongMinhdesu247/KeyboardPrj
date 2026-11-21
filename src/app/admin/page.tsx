import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { money, orderStages, type AdminOrder } from "@/lib/order-contract";
import { logout } from "./actions";
import { AccountGrowthChart } from "@/components/account-growth";
import { AccountKpis } from "@/components/account-kpis";
import type { AccountGrowth } from "@/lib/accounts-contract";
export default async function AdminPage() {
  const { client, user } = await requireAdmin();
  const [result, catalog, requests, growth] = await Promise.all([
    client.rpc("list_orders"),
    client
      .from("products_services")
      .select("id,name,price_vnd,stock_quantity,type,active")
      .is("archived_at", null),
    client.rpc("list_custom_requests"),
    client.rpc("account_growth"),
  ]);
  if (result.error || catalog.error || requests.error)
    throw new Error("Chưa tải được tổng quan cửa hàng.");
  const orders = result.data as unknown as AdminOrder[],
    active = orders.filter((o) => !o.cancelled_at);
  const counts = orderStages.map(
    (_, stage) => active.filter((o) => o.stage === stage).length,
  );
  const drafts = catalog.data.filter((i) => !i.active).length,
    empty = catalog.data.filter(
      (i) => i.type === "product" && i.stock_quantity === 0,
    ).length;
  return (
    <main id="main" className="container page-container">
      <div className="tracking-heading">
        <div>
          <h1>Tổng quan cửa hàng</h1>
          <p>{user.email}</p>
        </div>
        <form action={logout}>
          <button className="button button-outline">Đăng xuất</button>
        </form>
      </div>
      {growth.error ? <section className="admin-panel" role="alert"><h2>Chưa tải được thống kê tài khoản</h2><p>Hãy tải lại trang. Nếu lỗi tiếp diễn, kiểm tra kết nối và migration thống kê.</p><Link href="/admin">Tải lại tổng quan</Link></section> : <><AccountKpis data={growth.data as unknown as AccountGrowth}/><AccountGrowthChart data={growth.data as unknown as AccountGrowth}/></>}
      <div className="admin-panel-heading"><h2>Công việc cửa hàng</h2><Link href="/admin/customers">Quản lý tài khoản</Link></div>
      <div className="admin-stat-grid">
        {orderStages.map((label, i) => (
          <Link
            key={label}
            href={`/admin/orders?status=${i}`}
            className="admin-stat"
          >
            <span>{label}</span>
            <strong>{counts[i]}</strong>
          </Link>
        ))}
      </div>
      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Đơn gần đây</h2>
            <Link href="/admin/orders/new" className="button button-primary">
              Tạo đơn mới
            </Link>
          </div>
          <p className="admin-muted">
            Trong 200 đơn mới nhất.
          </p>
          {!orders.length ? (
            <div className="admin-empty">
              <h3>Chưa có đơn hàng</h3>
              <p>
                Nhập bảng giá, chốt cấu hình với khách rồi tạo đơn đầu tiên.
              </p>
              <Link href="/admin/catalog">Mở bảng giá & kho</Link>
            </div>
          ) : (
            <div className="admin-recent-list">
              {orders.slice(0, 6).map((o) => (
                <Link href={`/admin/orders/${o.id}`} key={o.id}>
                  <span>
                    <strong>{o.keyboard}</strong>
                    <small>{o.customer_name}</small>
                  </span>
                  <span className="admin-recent-meta">
                    <span
                      className={`admin-status status-${o.cancelled_at ? "cancelled" : o.stage}`}
                    >
                      {o.cancelled_at ? "Đã hủy" : orderStages[o.stage]}
                    </span>
                    <small>{money(o.total_vnd)}</small>
                  </span>
                </Link>
              ))}
            </div>
          )}
          <Link href="/admin/orders" className="admin-text-link">
            Xem tất cả đơn hàng
          </Link>
        </section>
        <aside className="admin-panel">
          <h2>Cần chú ý</h2>
          <Link className="admin-task" href="/admin/requests?status=pending">
            <strong>
              {
                (requests.data as unknown as { status: string }[]).filter(
                  (r) => r.status === "pending",
                ).length
              }{" "}
              yêu cầu đặt tìm mới
            </strong>
            <span>Kiểm tra ảnh mẫu và liên hệ khách.</span>
          </Link>
          <Link className="admin-task" href="/admin/catalog?status=draft">
            <strong>{drafts} mục chưa công khai</strong>
            <span>Kiểm tra giá và nội dung trước khi mở bán.</span>
          </Link>
          <Link className="admin-task" href="/admin/catalog">
            <strong>{empty} linh kiện hết hàng</strong>
            <span>Kiểm tra kho trước khi xác nhận nhận cọc.</span>
          </Link>
          <div className="admin-note">
            <strong>Xác nhận tiền thủ công</strong>
            <p>
              Chỉ ghi nhận cọc hoặc COD sau khi kiểm tra tiền đã thực sự về
              shop.
            </p>
          </div>
          <Link className="admin-text-link" href="/admin/readiness">Kiểm tra trước khi mở bán</Link>
        </aside>
      </div>
    </main>
  );
}
