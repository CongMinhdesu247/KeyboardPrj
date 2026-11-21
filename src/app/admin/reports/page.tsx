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
  return (
    <main id="main" className="container page-container reports-page">
      <div className="tracking-heading">
        <div>
          <span className="eyebrow">Thu & hoàn tiền</span>
          <h1>Báo cáo tiền thực thu</h1>
          <p>Theo giao dịch admin đã xác nhận · Giờ Việt Nam</p>
        </div>
        <Link className="button button-outline" href={reportUrl(filters)}>
          Tải lại báo cáo
        </Link>
      </div>
      <section
        className="admin-panel report-filter-panel"
        aria-label="Bộ lọc báo cáo"
      >
        <nav className="report-shortcuts" aria-label="Khoảng ngày nhanh">
          {[
            ["Hôm nay", today, today],
            ["Tháng này", month + "-01", today],
            ["Năm nay", year + "-01-01", today],
          ].map(([label, from, to]) => (
            <Link
              key={label}
              href={reportUrl({
                from,
                to,
                group: label === "Năm nay" ? "month" : "day",
              })}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form key={`${filters.from}:${filters.to}:${filters.group}`} className="report-filters" method="get">
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
            <select aria-label="Nhóm theo" name="group" defaultValue={filters.group}>
              <option value="day">Ngày</option>
              <option value="month">Tháng</option>
            </select>
          </label>
          <button className="button button-primary">Xem báo cáo</button>
        </form>
        <p className="admin-muted">
          Bao gồm cả ngày bắt đầu và kết thúc, tối đa 366 ngày. Thu và hoàn được
          tính vào ngày ghi nhận giao dịch, kể cả đơn đã hủy.
        </p>
      </section>
      <div className="report-stats">
        {[
          ["Tiền đã nhận", r.received, "Cọc, chuyển khoản và COD thực nhận"],
          ["Tiền đã hoàn", r.refunded, "Khoản hoàn đã được admin ghi nhận"],
          ["Thực thu trong kỳ", r.net, "Tiền đã nhận trừ tiền đã hoàn"],
        ].map(([label, value, note]) => (
          <section
            className="admin-panel report-stat"
            key={label}
            aria-label={label}
          >
            <span>{label}</span>
            <strong>{reportMoney(value)}</strong>
            <small>{note}</small>
          </section>
        ))}
      </div>
      <p className="report-explanation">
        {r.transactionCount} giao dịch trên {r.orderCount} đơn trong kỳ. Hoàn
        thành đơn không tự tăng doanh thu; thực thu chưa trừ giá vốn, phí ship
        hoặc chi phí vận hành.
      </p>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Thực thu theo {r.group === "day" ? "ngày" : "tháng"}</h2>
          <span className="admin-muted">
            {r.from} → {r.to}
          </span>
        </div>
        {!r.transactionCount && (
          <p className="report-empty">
            Chưa có giao dịch thu/hoàn trong khoảng ngày đã chọn.
          </p>
        )}
        <div className="report-table-scroll report-series" tabIndex={0} role="region" aria-label="Bảng thu hoàn theo kỳ, cuộn để xem thêm">
          <table className="report-table">
            <caption>
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
              {r.series.map((s) => (
                <tr key={s.bucket}>
                  <th scope="row">
                    {r.group === "day"
                      ? s.bucket.split("-").reverse().join("/")
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
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Giao dịch trong kỳ</h2>
          <span className="admin-muted">
            Trang {r.page}/{pages} · 50 giao dịch/trang
          </span>
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
                  <span className="badge">
                    {p.kind === "receipt" ? "Thu tiền" : "Hoàn tiền"}
                  </span>
                  <Link href={`/admin/orders/${p.orderId}`}>
                    <strong>{p.reference}</strong> · {p.keyboard}
                  </Link>
                  <small>
                    {formatDate(p.at)}
                    {p.cancelled ? " · Đơn đã hủy" : ""}
                  </small>
                </div>
                <strong
                  className={p.kind === "refund" ? "report-negative" : ""}
                >
                  {p.kind === "refund" ? "−" : "+"}
                  {reportMoney(p.amount)}
                </strong>
              </article>
            ))}
          </div>
        )}
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
      </section>
      <section className="admin-panel report-pending">
        <h2>COD còn chờ — tại thời điểm tải báo cáo</h2>
        <p className="admin-muted">
          Toàn bộ đơn hiện tại, không bị giới hạn bởi bộ lọc ngày phía trên. Chỉ
          gồm đơn đã nhận cọc, chưa hủy và chưa thu đủ. Chưa nhận cọc thì chưa
          tính vào COD chờ.
        </p>
        <div className="report-pending-totals">
          <div>
            <span>Tổng COD dự kiến còn lại</span>
            <strong>{reportMoney(r.pending.amount)}</strong>
            <small>{r.pending.count} đơn đã cọc</small>
          </div>
          <div>
            <span>Đã hoàn thành, chờ đối soát</span>
            <strong>{reportMoney(r.pending.readyAmount)}</strong>
            <small>{r.pending.readyCount} đơn · Chưa tính là thực thu</small>
          </div>
          <div>
            <span>Đơn hủy còn phần có thể hoàn</span>
            <strong>{reportMoney(r.pending.refundAmount)}</strong>
            <small>
              {r.pending.refundCount} đơn · Phần thực nhận vượt cọc 20%
            </small>
          </div>
        </div>
        {!r.pending.items.length ? (
          <p>Không có COD đang chờ.</p>
        ) : (
          <>
            <p className="admin-muted">
              {r.pending.items.length}/{r.pending.count} đơn, ưu tiên đã hoàn
              thành. Mở đơn để kiểm tra và xác nhận sau khi thực nhận.
            </p>
            <div className="report-ledger">
              {r.pending.items.map((o) => (
                <article className="report-transaction" key={o.orderId}>
                  <div>
                    <Link href={`/admin/orders/${o.orderId}`}>
                      <strong>{o.reference}</strong> · {o.keyboard}
                    </Link>
                    <small>{orderStages[o.stage]}</small>
                  </div>
                  <strong>{reportMoney(o.remaining)}</strong>
                </article>
              ))}
            </div>
            {r.pending.count > 50 && (
              <Link href="/admin/orders">Mở danh sách đơn để xem thêm</Link>
            )}
          </>
        )}
      </section>
      <p className="admin-muted">
        Cập nhật {formatDate(r.generatedAt)}. Báo cáo đọc từ sổ giao dịch, không
        sửa thanh toán. Chức năng tính lợi nhuận được hoãn.
      </p>
    </main>
  );
}
