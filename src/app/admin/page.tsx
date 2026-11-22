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
  const orders = (
      Array.isArray(result.data) ? result.data : []
    ) as unknown as AdminOrder[],
    active = orders.filter((o) => !o.cancelled_at);
  const counts = orderStages.map(
    (_, stage) => active.filter((o) => o.stage === stage).length,
  );
  const catalogItems = catalog.data ?? [];
  const drafts = catalogItems.filter((i) => !i.active).length,
    empty = catalogItems.filter(
      (i) => i.type === "product" && i.stock_quantity === 0,
    ).length;
  const pendingRequests = (
    (Array.isArray(requests.data) ? requests.data : []) as unknown as {
      status: string;
    }[]
  ).filter((r) => r.status === "pending").length;

  return (
    <main id="main" className="container page-container admin-dashboard">
      <div className="tracking-heading">
        <div>
          <h1>Tổng quan cửa hàng</h1>
          <p>{user.email}</p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/orders/new" className="button button-primary">
            Tạo đơn mới
          </Link>
          <form action={logout}>
            <button className="button button-outline">Đăng xuất</button>
          </form>
        </div>
      </div>

      <div className="admin-stat-grid" aria-label="Trạng thái đơn hàng trong 200 đơn mới nhất">
        {orderStages.map((label, i) => (
          <Link
            key={label}
            href={`/admin/orders?status=${i}`}
            className={`admin-stat admin-stat-stage-${i}`}
          >
            <span>
              <i className="admin-stat-dot" aria-hidden="true" />
              {label}
            </span>
            <strong>{counts[i]}</strong>
          </Link>
        ))}
      </div>

      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Đơn gần đây <small className="admin-muted">(200 đơn mới nhất)</small></h2>
            <Link href="/admin/orders" className="admin-inline-link">
              Xem tất cả →
            </Link>
          </div>
          {!orders.length ? (
            <div className="admin-empty">
              <h3>Chưa có đơn hàng</h3>
              <p>Tạo đơn đầu tiên sau khi chốt cấu hình với khách.</p>
              <Link href="/admin/catalog" className="admin-inline-link">
                Mở bảng giá & kho
              </Link>
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
        </section>

        <aside className="admin-panel admin-focus-panel">
          <h2>Cần chú ý</h2>
          <div className="admin-task-list">
            <Link className="admin-task" href="/admin/requests?status=pending">
              <span>Yêu cầu đặt tìm mới</span>
              <strong className={pendingRequests > 0 ? "is-alert" : undefined}>
                {pendingRequests}
              </strong>
            </Link>
            <Link className="admin-task" href="/admin/catalog?status=draft">
              <span>Mục chưa công khai</span>
              <strong>{drafts}</strong>
            </Link>
            <Link className="admin-task" href="/admin/catalog">
              <span>Linh kiện hết hàng</span>
              <strong className={empty > 0 ? "is-alert" : undefined}>
                {empty}
              </strong>
            </Link>
          </div>
        </aside>
      </div>

      <section className="admin-secondary-section" aria-labelledby="accounts-overview-heading">
        <div className="admin-panel-heading">
          <h2 id="accounts-overview-heading">Thống kê tài khoản</h2>
          <Link href="/admin/customers" className="admin-inline-link">
            Quản lý tài khoản →
          </Link>
        </div>
        {growth.error || !growth.data ? (
          <section className="admin-panel" role="alert">
            <h3>Chưa tải được thống kê tài khoản</h3>
            <p className="admin-muted">
              Hãy tải lại trang để thử lại.
            </p>
            <Link href="/admin" className="admin-inline-link">
              Tải lại tổng quan
            </Link>
          </section>
        ) : (
          <>
            <AccountKpis data={growth.data as unknown as AccountGrowth} />
            <AccountGrowthChart data={growth.data as unknown as AccountGrowth} />
          </>
        )}
      </section>
    </main>
  );
}
