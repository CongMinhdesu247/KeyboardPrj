import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import {
  reportFilters,
  reportMoney,
  reportUrl,
  vietnamDate,
  type CashReport,
  type ReportQuery,
} from "@/lib/report";
import { formatDate } from "@/lib/tracking";
import { orderStages } from "@/lib/order-contract";

const shortDate = (iso: string) => iso.split("-").reverse().join("/");

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportQuery>;
}) {
  const { client } = await requireAdmin();
  let filters;
  try {
    filters = reportFilters(await searchParams);
  } catch (e) {
    return (
      <main id="main" className="container page-container">
        <h1>Báo cáo tiền thực thu</h1>
        <p role="alert">
          {e instanceof Error ? e.message : "Bộ lọc không hợp lệ."}
        </p>
        <Link className="button button-primary" href="/admin/reports">
          Về báo cáo tháng này
        </Link>
      </main>
    );
  }
  const { data, error } = await client.rpc("cash_report", {
    p_from: filters.from,
    p_to: filters.to,
    p_group: filters.group,
    p_page: filters.page,
  });
  if (error)
    return (
      <main id="main" className="container page-container">
        <h1>Báo cáo tiền thực thu</h1>
        <p role="alert">
          Chưa tải được báo cáo. Thử tải lại; dữ liệu thu/hoàn chưa thay đổi.
        </p>
        <Link className="button button-outline" href={reportUrl(filters)}>
          Thử tải lại
        </Link>
      </main>
    );

  const r = data as unknown as CashReport,
    today = vietnamDate(),
    year = today.slice(0, 4),
    month = today.slice(0, 7),
    pages = Math.max(1, Math.ceil(r.transactionCount / r.pageSize));

  const shortcuts = [
    ["Hôm nay", today, today, "day"],
    ["Tháng này", `${month}-01`, today, "day"],
    ["Năm nay", `${year}-01-01`, today, "month"],
  ] as const;

  const hasPendingRefund = BigInt(r.pending.refundAmount) > BigInt(0);

  return (
    <main id="main" className="container page-container reports-page">
      <div className="tracking-heading">
        <div>
          <h1>Báo cáo tiền thực thu</h1>
          <p>
            {shortDate(r.from)} – {shortDate(r.to)} · {r.transactionCount} giao
            dịch ({r.orderCount} đơn)
          </p>
        </div>
        <Link className="button button-outline" href={reportUrl(filters)}>
          Tải lại
        </Link>
      </div>

      <section
        className="admin-panel report-filter-panel"
        aria-label="Bộ lọc báo cáo"
      >
        <nav className="report-shortcuts" aria-label="Khoảng ngày nhanh">
          {shortcuts.map(([label, from, to, group]) => {
            const active = filters.from === from && filters.to === to;
            return (
              <Link
                key={label}
                href={reportUrl({ from, to, group })}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <form
          key={`${filters.from}:${filters.to}:${filters.group}`}
          className="report-filters"
          method="get"
        >
          <label>
            Từ ngày
            <input
              name="from"
              type="date"
              required
              min="1900-01-01"
              max="2100-12-31"
              defaultValue={filters.from}
            />
          </label>
          <label>
            Đến ngày
            <input
              name="to"
              type="date"
              required
              min="1900-01-01"
              max="2100-12-31"
              defaultValue={filters.to}
            />
          </label>
          <label>
            Nhóm theo
            <select
              aria-label="Nhóm theo"
              name="group"
              defaultValue={filters.group}
            >
              <option value="day">Ngày</option>
              <option value="month">Tháng</option>
            </select>
          </label>
          <button className="button button-primary">Xem báo cáo</button>
        </form>
      </section>

      <div className="report-stats">
        <section
          className="admin-panel report-stat report-stat-net"
          aria-label="Thực thu trong kỳ"
        >
          <span>Thực thu trong kỳ</span>
          <strong className={BigInt(r.net) < BigInt(0) ? "report-negative" : ""}>
            {reportMoney(r.net)}
          </strong>
          <small>Tiền đã nhận trừ tiền đã hoàn</small>
        </section>
        <section
          className="admin-panel report-stat report-stat-in"
          aria-label="Tiền đã nhận"
        >
          <span>Tiền đã nhận</span>
          <strong>{reportMoney(r.received)}</strong>
          <small>Cọc, chuyển khoản và COD</small>
        </section>
        <section
          className="admin-panel report-stat report-stat-out"
          aria-label="Tiền đã hoàn"
        >
          <span>Tiền đã hoàn</span>
          <strong>{reportMoney(r.refunded)}</strong>
          <small>Hoàn lại cho khách</small>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Giao dịch trong kỳ</h2>
          {r.transactionCount > 0 && (
            <span className="admin-muted">
              Trang {r.page}/{pages}
            </span>
          )}
        </div>
        {!r.transactions.length ? (
          <p className="report-empty">
            {r.transactionCount
              ? "Trang này không có giao dịch. Chọn trang đầu để xem dữ liệu."
              : "Chưa có giao dịch trong kỳ."}
          </p>
        ) : (
          <div className="report-ledger">
            {r.transactions.map((p) => (
              <article className="report-transaction" key={p.id}>
                <div>
                  <div className="report-tx-meta">
                    <span
                      className={`report-kind ${p.kind === "refund" ? "is-refund" : "is-receipt"}`}
                    >
                      {p.kind === "receipt" ? "Thu" : "Hoàn"}
                    </span>
                    <time>{formatDate(p.at)}</time>
                    {p.cancelled && (
                      <span className="report-tx-cancelled">Đơn đã hủy</span>
                    )}
                  </div>
                  <Link href={`/admin/orders/${p.orderId}`}>
                    <strong>{p.keyboard}</strong>
                    <span className="report-tx-ref"> · {p.reference}</span>
                  </Link>
                </div>
                <strong
                  className={
                    p.kind === "refund" ? "report-negative" : "report-positive"
                  }
                >
                  {p.kind === "refund" ? "−" : "+"}
                  {reportMoney(p.amount)}
                </strong>
              </article>
            ))}
          </div>
        )}
        {(r.page > 1 || r.page < pages) && (
          <nav className="report-pagination" aria-label="Trang giao dịch">
            {r.page > 1 && (
              <Link
                className="button button-outline"
                href={reportUrl({
                  ...filters,
                  page: Math.min(r.page - 1, pages),
                })}
              >
                Trang trước
              </Link>
            )}
            {r.page > pages && (
              <Link href={reportUrl({ ...filters, page: 1 })}>Trang đầu</Link>
            )}
            {r.page < pages && (
              <Link
                className="button button-outline"
                href={reportUrl({ ...filters, page: r.page + 1 })}
              >
                Trang sau
              </Link>
            )}
          </nav>
        )}
      </section>

      <section className="admin-panel report-pending">
        <div className="admin-panel-heading">
          <h2>COD đang chờ thu</h2>
          <span className="report-scope-pill">Toàn shop hiện tại</span>
        </div>
        <div className="report-pending-totals">
          <div>
            <span>Tổng COD còn lại</span>
            <strong>{reportMoney(r.pending.amount)}</strong>
            <small>{r.pending.count} đơn đã cọc</small>
          </div>
          <div>
            <span>Đã xong, chờ tiền về</span>
            <strong>{reportMoney(r.pending.readyAmount)}</strong>
            <small>{r.pending.readyCount} đơn đã hoàn thành</small>
          </div>
          <div className={hasPendingRefund ? "is-warn" : undefined}>
            <span>Đơn hủy cần kiểm tra hoàn</span>
            <strong>{reportMoney(r.pending.refundAmount)}</strong>
            <small>{r.pending.refundCount} đơn vượt cọc 20%</small>
          </div>
        </div>
        {!r.pending.items.length ? (
          <p className="report-empty">Không có đơn nào đang chờ thu COD.</p>
        ) : (
          <>
            <div className="report-ledger">
              {r.pending.items.map((o) => (
                <article className="report-transaction" key={o.orderId}>
                  <div>
                    <Link href={`/admin/orders/${o.orderId}`}>
                      <strong>{o.keyboard}</strong>
                      <span className="report-tx-ref"> · {o.reference}</span>
                    </Link>
                    <small>{orderStages[o.stage]}</small>
                  </div>
                  <strong>{reportMoney(o.remaining)}</strong>
                </article>
              ))}
            </div>
            {r.pending.count > 50 && (
              <Link href="/admin/orders" className="admin-inline-link">
                Mở danh sách đơn để xem thêm →
              </Link>
            )}
          </>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Thực thu theo {r.group === "day" ? "ngày" : "tháng"}</h2>
          <span className="admin-muted">
            {shortDate(r.from)} – {shortDate(r.to)}
          </span>
        </div>
        <div
          className="report-table-scroll report-series"
          tabIndex={0}
          role="region"
          aria-label="Bảng thu hoàn theo kỳ, cuộn để xem thêm"
        >
          <table className="report-table">
            <caption className="visually-hidden">
              Tiền theo {r.group === "day" ? "ngày" : "tháng"}, gồm cả kỳ không
              phát sinh
            </caption>
            <thead>
              <tr>
                <th scope="col">{r.group === "day" ? "Ngày" : "Tháng"}</th>
                <th scope="col">Đã nhận</th>
                <th scope="col">Đã hoàn</th>
                <th scope="col">Thực thu</th>
              </tr>
            </thead>
            <tbody>
              {r.series.map((s) => {
                const zero =
                  BigInt(s.received) === BigInt(0) &&
                  BigInt(s.refunded) === BigInt(0);
                return (
                  <tr
                    key={s.bucket}
                    className={zero ? "report-row-zero" : "report-row-active"}
                  >
                    <th scope="row">
                      {r.group === "day"
                        ? shortDate(s.bucket)
                        : s.bucket.slice(0, 7).split("-").reverse().join("/")}
                    </th>
                    <td>{reportMoney(s.received)}</td>
                    <td>{reportMoney(s.refunded)}</td>
                    <td
                      className={
                        BigInt(s.net) < BigInt(0) ? "report-negative" : ""
                      }
                    >
                      {reportMoney(s.net)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <details className="report-help">
        <summary>Cách tính số liệu</summary>
        <ul>
          <li>
            Chỉ tính tiền admin đã bấm xác nhận (thu hoặc hoàn) theo giờ Việt
            Nam; hoàn thành đơn không tự cộng tiền.
          </li>
          <li>
            Thực thu là tiền đã nhận trừ tiền đã hoàn, chưa trừ giá vốn hay phí
            ship.
          </li>
          <li>
            Mục <strong>COD đang chờ thu</strong> hiển thị tổng hiện tại của
            toàn shop, không bị ảnh hưởng bởi bộ lọc ngày phía trên.
          </li>
          <li>Cập nhật lúc {formatDate(r.generatedAt)}.</li>
        </ul>
      </details>
    </main>
  );
}
