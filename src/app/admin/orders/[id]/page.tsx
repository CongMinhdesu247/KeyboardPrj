import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { requireAdmin } from "@/lib/auth";
import { readAuthConfig } from "@/lib/auth-config";
import {
  money,
  netReceived,
  orderStages,
  type AdminOrder,
} from "@/lib/order-contract";
import { OrderActionForm } from "@/components/order-forms";
import { AdminTabs } from "@/components/admin-tabs";
import { formatDate } from "@/lib/tracking";
import { renderBankPayment } from "@/lib/bank-payment";
import { BankTransferPanel } from "@/components/bank-transfer-panel";
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireAdmin();
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const result = await client.rpc("read_order", { p_id: id });
  if (result.error) throw new Error("Chưa tải được đơn.");
  if (!result.data) notFound();
  const o = result.data as unknown as AdminOrder,
    net = netReceived(o),
    live = !o.cancelled_at;
  const url = `${readAuthConfig(process.env)!.origin}/track/${o.code}`;
  const qr = await QRCode.toDataURL(url, {
    width: 220,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  const proofs = await Promise.all(
    o.events
      .filter((e) => e.path)
      .map(async (e) => {
        const signed = await client.storage
          .from("order-media")
          .createSignedUrl(e.path!, 300);
        return { ...e, url: signed.data?.signedUrl };
      }),
  );
  const bankPayment = await renderBankPayment({
    available: o.payment_available,
    plan: o.plan,
    total: o.total_vnd,
    deposit: o.deposit_vnd,
    received: net,
    reference: o.payment_reference,
    cancelled: !live,
  });
  const props = (action: string) => ({
    action,
    orderId: id,
    requestId: randomUUID(),
  });
  const paymentDue = net === 0 || (o.stage === 2 && net < o.total_vnd);
  const cancelled = (
    <details className="admin-danger">
      <summary>Hủy đơn hàng</summary>
      <p>
        Giữ cọc 20%. Trả lại tài sản khách. Chỉ cộng kho linh kiện của shop đã
        thu hồi và còn sử dụng được; không cộng vật tư tiêu hao.
      </p>
      <OrderActionForm {...props("cancel")} label="Xác nhận hủy đơn">
        <label>
          Lý do hủy (nội bộ)
          <textarea name="reason" required minLength={3} maxLength={1000} />
        </label>
        {o.items
          .filter((i) => i.type === "product")
          .map((i) => (
            <label key={i.item_id}>
              Thu hồi {i.name}
              <input
                type="number"
                name={`return-${i.item_id}`}
                min="0"
                max={o.stock_committed ? i.quantity : 0}
                defaultValue="0"
              />
            </label>
          ))}
      </OrderActionForm>
    </details>
  );
  return (
    <main id="main" className="container page-container">
      <Link className="back-link" href="/admin/orders">
        ← Danh sách đơn hàng
      </Link>
      <div className="tracking-heading">
        <div>
          <span
            className={`admin-status status-${live ? o.stage : "cancelled"}`}
          >
            {live ? orderStages[o.stage] : "Đã hủy"}
          </span>
          <h1>{o.keyboard}</h1>
          <p>
            {o.customer_name} · {o.phone}
          </p>
        </div>
        <a className="button button-outline" href={`/admin/orders/${id}`}>
          Tải lại dữ liệu
        </a>
      </div>
      <div className="admin-order-summary">
        <div>
          <span>Tiền hàng / dịch vụ</span>
          <strong>{money(o.total_vnd)}</strong>
        </div>
        <div>
          <span>Đã thực nhận</span>
          <strong>{money(net)}</strong>
        </div>
        <div>
          <span>{live ? "Còn phải thu" : "Có thể hoàn sau giữ cọc"}</span>
          <strong>
            {money(
              live
                ? Math.max(o.total_vnd - net, 0)
                : Math.max(net - o.deposit_vnd, 0),
            )}
          </strong>
        </div>
        <div>
          <span>Cọc 20% · Chưa gồm ship</span>
          <strong>{money(o.deposit_vnd)}</strong>
        </div>
      </div>
      <ol className="admin-stepper" aria-label="Tiến độ đơn hàng">
        {orderStages.map((s, i) => (
          <li
            key={s}
            className={
              o.stage === 2 || i < o.stage
                ? "done"
                : live && i === o.stage
                  ? "active"
                  : ""
            }
            aria-current={
              live && o.stage < 2 && i === o.stage ? "step" : undefined
            }
          >
            <span>{o.stage === 2 || i < o.stage ? "✓" : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <AdminTabs
        initial={live && paymentDue ? "payment" : "progress"}
        panels={[
          {
            id: "progress",
            label: "Tiến độ & ảnh",
            content: (
              <div className="admin-content-grid">
                <section className="admin-panel">
                  <h2>
                    {live
                      ? o.stage < 2
                        ? `Chuyển sang ${orderStages[o.stage + 1]}`
                        : "Đơn đã hoàn thành"
                      : "Đơn đã hủy"}
                  </h2>
                  {live && o.stage < 2 ? (
                    <>
                      <p className="admin-muted">
                        {net === 0
                          ? "Cần xác nhận nhận cọc trong tab Thanh toán trước khi bắt đầu."
                          : "Cập nhật sau khi hoàn tất công việc ở bước hiện tại."}
                      </p>
                      <OrderActionForm
                        {...props("advance")}
                        label={`Chuyển sang ${orderStages[o.stage + 1]}`}
                      >
                        <input
                          type="hidden"
                          name="expectedStage"
                          value={o.stage}
                        />
                        <label>
                          Ghi chú khách được xem
                          <textarea name="note" maxLength={1000} />
                        </label>
                      </OrderActionForm>
                    </>
                  ) : (
                    <p className="admin-muted">
                      {live
                        ? "Kiểm tra thu COD nếu shop chưa nhận đủ tiền."
                        : "Tiến độ đã dừng. Kiểm tra thanh toán và bàn giao lại tài sản khách."}
                    </p>
                  )}
                  {live && o.stage < 2 && cancelled}
                </section>
                {live && (
                  <section className="admin-panel">
                    <h2>Cập nhật ảnh / sound test</h2>
                    <p className="admin-muted">
                      Khách xem ngay sau khi lưu. Ảnh tối đa 5 MB; MP4 tối đa 10
                      MB.
                    </p>
                    <OrderActionForm
                      {...props("proof")}
                      label="Lưu tiến độ public"
                    >
                      <label>
                        Bước
                        <select name="stage" defaultValue={o.stage}>
                          {orderStages.map(
                            (s, i) =>
                              i <= o.stage && (
                                <option key={s} value={i}>
                                  {s}
                                </option>
                              ),
                          )}
                        </select>
                      </label>
                      <label>
                        Ghi chú public
                        <textarea name="note" maxLength={1000} />
                      </label>
                      <label>
                        Ảnh / MP4
                        <input
                          type="file"
                          name="media"
                          accept="image/jpeg,image/png,image/webp,video/mp4"
                        />
                      </label>
                      <label>
                        Hoặc link YouTube / TikTok
                        <input type="url" name="videoUrl" maxLength={500} />
                      </label>
                    </OrderActionForm>
                  </section>
                )}
              </div>
            ),
          },
          {
            id: "payment",
            label: "Thanh toán",
            content: (
              <div className="admin-content-grid">
                <section className="admin-panel">
                  <h2>
                    {live && net < o.total_vnd
                      ? net === 0
                        ? "Xác nhận tiền chuyển khoản"
                        : "Theo dõi tiền COD"
                      : !live
                        ? "Thanh toán đơn đã hủy"
                        : "Đã thu đủ tiền"}
                  </h2>
                  <p>
                    {o.plan === "deposit_cod"
                      ? "Phương án: cọc 20%, còn lại 80% COD."
                      : "Phương án: chuyển khoản toàn bộ 100%."}
                  </p>
                  <p className="admin-muted">
                    Nội dung đối soát: <strong>{o.payment_reference}</strong>
                  </p>
                  {bankPayment.status === "awaiting_transfer" && (
                    <details className="admin-disclosure bank-admin-preview">
                      <summary>Xem QR chuyển khoản của đơn</summary>
                      <BankTransferPanel payment={bankPayment} admin />
                    </details>
                  )}
                  {live &&
                    net < o.total_vnd &&
                    (paymentDue ? (
                      <>
                        <div className="admin-note">
                          Mở ứng dụng ngân hàng để kiểm tra. Chỉ bấm xác nhận
                          khi tiền đã thực sự về tài khoản shop.
                        </div>
                        <OrderActionForm
                          {...props("receipt")}
                          label="Ghi nhận thực thu"
                        >
                          <label>
                            Số tiền (VND)
                            <input
                              type="number"
                              name="amount"
                              min="1"
                              max={o.total_vnd - net}
                              defaultValue={
                                net
                                  ? o.total_vnd - net
                                  : o.plan === "deposit_cod"
                                    ? o.deposit_vnd
                                    : o.total_vnd
                              }
                              required
                            />
                          </label>
                          <label>
                            Phương thức
                            <select
                              name="method"
                              defaultValue={net ? "cod" : "bank"}
                            >
                              <option value="bank">Chuyển khoản</option>
                              <option value="cod">
                                COD đã được đơn vị vận chuyển trả
                              </option>
                            </select>
                          </label>
                          <label>
                            Mã giao dịch / chứng từ
                            <input
                              name="reference"
                              minLength={3}
                              maxLength={300}
                              required
                            />
                          </label>
                        </OrderActionForm>
                      </>
                    ) : (
                      <div className="admin-note">
                        Đã nhận cọc. Khoản COD {money(o.total_vnd - net)} chỉ
                        ghi nhận sau hoàn thành, khi đơn vị vận chuyển đã trả
                        tiền shop.
                      </div>
                    ))}
                  {!live && net > o.deposit_vnd && (
                    <>
                      <p>
                        Tối đa có thể hoàn: {money(net - o.deposit_vnd)}. Chỉ
                        ghi sau khi thực sự trả tiền khách.
                      </p>
                      <OrderActionForm
                        {...props("refund")}
                        label="Ghi nhận đã hoàn"
                      >
                        <input type="hidden" name="method" value="bank" />
                        <label>
                          Số tiền hoàn
                          <input
                            type="number"
                            name="amount"
                            min="1"
                            max={net - o.deposit_vnd}
                            defaultValue={net - o.deposit_vnd}
                            required
                          />
                        </label>
                        <label>
                          Chứng từ / lý do
                          <input
                            name="reference"
                            minLength={3}
                            maxLength={300}
                            required
                          />
                        </label>
                      </OrderActionForm>
                    </>
                  )}
                </section>
                <section className="admin-panel">
                  <h2>Lịch sử thu / hoàn</h2>
                  {!o.payments.length ? (
                    <p className="admin-muted">
                      Chưa nhận tiền. Đơn đang chờ xác nhận của shop.
                    </p>
                  ) : (
                    <ul className="admin-ledger">
                      {o.payments.map((p) => (
                        <li key={p.id}>
                          <div>
                            <strong>
                              {p.kind === "receipt" ? "Thu" : "Hoàn"}{" "}
                              {money(p.amount_vnd)}
                            </strong>
                            <span>
                              {p.method === "bank" ? "Chuyển khoản" : "COD"} ·{" "}
                              {p.reference}
                            </span>
                          </div>
                          <time>{formatDate(p.created_at)}</time>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ),
          },
          {
            id: "details",
            label: "Thông tin đơn",
            content: (
              <section className="admin-panel">
                <h2>Hạng mục đã chốt</h2>
                {o.source === "web" && (
                  <div className="admin-note">
                    <strong>Đơn khách đặt trên website</strong>
                    <p>
                      {o.delivery_method === "ship"
                        ? `Giao tới: ${o.shipping_address}`
                        : "Khách nhận tại shop"}
                    </p>
                    {o.customer_note && <p>Khách ghi chú: {o.customer_note}</p>}
                  </div>
                )}
                <p className="admin-muted">
                  Giá giữ theo thời điểm tạo đơn, chưa gồm phí vận chuyển.
                </p>
                <div className="order-items">
                  {o.items.map((i) => (
                    <div key={i.item_id} className="order-choice">
                      <span>
                        {i.name}
                        <small>
                          {i.quantity} {i.unit} × {money(i.price_vnd)}
                        </small>
                      </span>
                      <strong>{money(i.price_vnd * i.quantity)}</strong>
                    </div>
                  ))}
                </div>
                <div className="admin-detail-notes">
                  <div>
                    <h3>Vận chuyển</h3>
                    <p>{o.shipping_note || "Chưa chốt phí ship."}</p>
                  </div>
                  <div>
                    <h3>Ghi chú nội bộ</h3>
                    <p>{o.internal_note || "Không có ghi chú."}</p>
                  </div>
                </div>
                <details className="admin-disclosure">
                  <summary>Xem giá vốn đã lưu</summary>
                  {o.items.map((i) => (
                    <p key={i.item_id}>
                      {i.name}: {money(i.cost_vnd)} / {i.unit}
                    </p>
                  ))}
                </details>
                <p className="admin-muted">
                  Hạng mục đã cố định. Nếu chốt sai, hủy và tạo lại đơn trước
                  khi xử lý.
                </p>
              </section>
            ),
          },
          {
            id: "share",
            label: "Link & QR",
            content: (
              <section className="admin-panel admin-share">
                <div>
                  <h2>QR tra cứu đơn hàng</h2>
                  <p>
                    Gửi khách để theo dõi tiến độ. Đây là QR tra cứu, không dùng
                    để chuyển khoản.
                  </p>
                  <p className="order-code">{o.code}</p>
                  <div className="form-actions">
                    <a
                      className="button button-primary"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mở trang tra cứu
                    </a>
                    <a
                      className="button button-outline"
                      href={qr}
                      download={`trumpkeys-${id}.png`}
                    >
                      Tải QR PNG
                    </a>
                  </div>
                  <p className="admin-muted">
                    Ai có link đều xem được tiến độ. Link localhost hiện chỉ mở
                    trên PC này.
                  </p>
                </div>
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qr}
                    width={220}
                    height={220}
                    alt="QR mở trang tra cứu đơn"
                  />
                </div>
              </section>
            ),
          },
          {
            id: "history",
            label: "Lịch sử",
            content: (
              <section className="admin-panel">
                <h2>Nhật ký tiến độ</h2>
                <ul className="admin-ledger">
                  {o.events.map((e) => (
                    <li key={e.id}>
                      <div>
                        <strong>
                          {e.kind === "cancel"
                            ? "Hủy đơn"
                            : e.kind === "created"
                              ? "Tạo đơn"
                              : e.kind === "stage"
                                ? orderStages[e.stage]
                                : "Cập nhật ảnh / ghi chú"}
                        </strong>
                        {e.note && <span>{e.note}</span>}
                        {e.video_url && (
                          <a
                            href={e.video_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Xem video
                          </a>
                        )}
                      </div>
                      <time>{formatDate(e.created_at)}</time>
                    </li>
                  ))}
                </ul>
                <div className="proof-grid">
                  {proofs.map(
                    (e) =>
                      e.url && (
                        <div key={e.id}>
                          {e.path?.endsWith(".mp4") ? (
                            <video src={e.url} controls preload="metadata" />
                          ) : (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={e.url} alt={e.note || "Ảnh tiến độ"} />
                              <Link
                                className="button button-outline"
                                href={`/admin/portfolio/new?order=${id}&event=${e.id}`}
                              >
                                Chọn ảnh tạo portfolio
                              </Link>
                            </>
                          )}
                        </div>
                      ),
                  )}
                </div>
              </section>
            ),
          },
        ]}
      />
    </main>
  );
}
