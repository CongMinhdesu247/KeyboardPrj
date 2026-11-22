import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { money, orderStages, type AdminOrder } from "@/lib/order-contract";
import { formatDate } from "@/lib/tracking";
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string;customer?:string }>;
}) {
  const { client } = await requireAdmin(),
    filters = await searchParams;
  const customer=/^[a-f0-9-]{36}$/i.test(filters.customer??"")?filters.customer:undefined;
  const result = customer?await client.rpc("customer_orders",{p_user:customer}):await client.rpc("list_orders");
  if (result.error) throw new Error("Chưa tải được danh sách đơn.");
  const all = result.data as unknown as AdminOrder[],
    status = ["0", "1", "2", "cancelled"].includes(filters.status ?? "")
      ? filters.status!
      : "all",
    q = (filters.q ?? "").slice(0, 120),
    normalized = q.trim().toLocaleLowerCase("vi");
  const matches = (o: AdminOrder, s: string) =>
    s === "all" ||
    (s === "cancelled"
      ? !!o.cancelled_at
      : !o.cancelled_at && String(o.stage) === s);
  const orders = all.filter(
    (o) =>
      matches(o, status) &&
      `${o.code} ${o.keyboard} ${o.customer_name}`
        .toLocaleLowerCase("vi")
        .includes(normalized),
  );
  return (
    <main id="main" className="container page-container">
      <div className="tracking-heading">
        <div>
          <h1>Đơn hàng</h1>
          <p>{orders.length} đơn · trong 200 đơn mới nhất</p>
        </div>
        <Link className="button button-primary" href="/admin/orders/new">
          Tạo đơn mới
        </Link>
      </div>
      {customer&&<p>Đang xem đơn của một tài khoản. <Link href="/admin/orders">Xem tất cả đơn</Link> · <Link href="/admin/customers">Quản lý tài khoản</Link></p>}
      <nav className="admin-filters" aria-label="Lọc trạng thái đơn">
        {[
          ["all", "Tất cả"],
          ...orderStages.map((s, i) => [String(i), s]),
          ["cancelled", "Đã hủy"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/orders?${new URLSearchParams({ status: value, q,...(customer?{customer}:{}) }).toString()}`}
            aria-current={status === value ? "page" : undefined}
          >
            {label}
            <span>{all.filter((o) => matches(o, value)).length}</span>
          </Link>
        ))}
      </nav>
      <section className="admin-panel">
        <form className="admin-search" method="get">
          {customer&&<input type="hidden" name="customer" value={customer}/>}
          <input type="hidden" name="status" value={status} />
          <label htmlFor="order-search">
            Tìm đơn hàng
            <input
              id="order-search"
              type="search"
              name="q"
              maxLength={120}
              defaultValue={q}
              placeholder="Tên khách, bàn phím hoặc mã đơn"
            />
          </label>
          <button className="button button-outline">Tìm kiếm</button>
          {q && (
            <Link
              href={`/admin/orders?${new URLSearchParams({ status, ...(customer ? { customer } : {}) }).toString()}`}
            >
              Xóa tìm kiếm
            </Link>
          )}
        </form>
        {!orders.length ? (
          <div className="admin-empty">
            <h2>{all.length ? "Không có đơn phù hợp" : "Chưa có đơn hàng"}</h2>
            <p>
              {all.length
                ? "Thử tên khác hoặc chọn Tất cả."
                : "Chốt cấu hình và phương án thanh toán với khách trước khi tạo đơn."}
            </p>
          </div>
        ) : (
          <div className="admin-order-table">
            <div className="admin-order-table-head">
              <span>Khách hàng / bàn phím</span>
              <span>Trạng thái</span>
              <span>Tiền hàng</span>
              <span>Ngày tạo</span>
            </div>
            {orders.map((o) => (
              <Link
                className="admin-order-row"
                href={`/admin/orders/${o.id}`}
                key={o.id}
              >
                <div>
                  <strong>{o.keyboard}</strong>
                  <span>{o.customer_name}</span>
                  <small className="order-code">{o.code}</small>
                </div>
                <span
                  className={`admin-status status-${o.cancelled_at ? "cancelled" : o.stage}`}
                >
                  {o.cancelled_at ? "Đã hủy" : orderStages[o.stage]}
                </span>
                <strong>{money(o.total_vnd)}</strong>
                <time dateTime={o.created_at}>{formatDate(o.created_at)}</time>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
