import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { demoOrder } from "@/lib/demo-order";
import { normalizeOrderCode, formatDate } from "@/lib/tracking";
import { readTrackedOrder } from "@/lib/order-data";
import { orderStages } from "@/lib/order-contract";
import { BankTransferPanel } from "@/components/bank-transfer-panel";
import { ShopImage } from "@/components/shop-image";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Theo dõi bàn phím",
  robots: { index: false, follow: false },
};

export default async function TrackPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = normalizeOrderCode(code);
  if (!normalized) notFound();
  const demo = normalized === demoOrder.code;
  const order = demo ? demoOrder : await readTrackedOrder(normalized);
  if (!order) notFound();
  return (
    <main id="main" className="container page-container buyer-order-page">
      <Link href="/" className="back-link">
        ← Trở về trang chủ
      </Link>
      <div className="tracking-heading">
        <div>
          <span className="eyebrow">Hành trình bàn phím</span>
          <h1>{order.keyboard}</h1>
          <p className="order-code tracking-code">{order.code}</p>
        </div>
        <span className="badge">
          {demo
            ? "Đơn minh họa"
            : order.cancelled
              ? "Đã hủy"
              : "Tiến độ từ shop"}
        </span>
      </div>
      {order.cancelled && (
        <p className="info-panel">
          Đơn đã hủy. Liên hệ shop để nhận lại tài sản và đối soát thanh toán.
        </p>
      )}
      <section className="info-panel" aria-label="Thông tin đơn">
        <dl className="order-meta">
          <div>
            <dt>Khách hàng</dt>
            <dd>{order.customerDisplayName}</dd>
          </div>
          <div>
            <dt>SĐT liên hệ</dt>
            <dd>{order.customerPhoneMasked}</dd>
          </div>
          <div>
            <dt>Thanh toán</dt>
            <dd>{order.paymentLabel}</dd>
          </div>
          <div>
            <dt>Cập nhật gần nhất</dt>
            <dd>{formatDate(order.updatedAt)}</dd>
          </div>
        </dl>
        <div className="service-tags">
          {order.services.map((service) => (
            <span key={service}>{service}</span>
          ))}
        </div>
      </section>
      <div className="buyer-order-content">
      {!demo && order.bankPayment && (
        <div className="info-panel bank-payment-container">
          <BankTransferPanel payment={order.bankPayment} />
          <a
            className="button button-outline bank-refresh"
            href={`/track/${order.code}`}
          >
            Tải lại trạng thái thanh toán
          </a>
        </div>
      )}
      <section className="info-panel buyer-order-progress">
        <h2>Từng bước, rõ ràng hơn</h2>
        <p>
          {order.cancelled
            ? "Tiến độ dưới đây dừng tại thời điểm hủy."
            : "Bước đang làm được đánh dấu màu hổ phách."}
        </p>
        <ol className="timeline">
          {order.steps.map((step, index) => (
            <li
              key={step.name}
              className={step.status}
              aria-current={
                !order.cancelled && step.status === "current"
                  ? "step"
                  : undefined
              }
            >
              <span className="timeline-marker" aria-hidden="true">
                {step.status === "complete" ? "✓" : index + 1}
              </span>
              <h3>
                {step.name}
                {order.cancelled && step.status === "current"
                  ? " · Dừng khi hủy"
                  : step.status === "current"
                    ? " · Đang thực hiện"
                    : step.status === "pending"
                      ? " · Chưa bắt đầu"
                      : " · Hoàn tất"}
              </h3>
              <p>{step.description}</p>
              {step.updatedAt && (
                <time dateTime={step.updatedAt}>
                  {formatDate(step.updatedAt)}
                </time>
              )}
              {step.note && <p className="timeline-note">{step.note}</p>}
            </li>
          ))}
        </ol>
        {demo && <p>Trang này chỉ chứa dữ liệu giả.</p>}
      </section>
      {!demo && (
        <section className="info-panel buyer-order-media">
          <h2>Ảnh & cập nhật từ xưởng</h2>
          {!order.media?.length ? (
            <p>Shop chưa thêm minh chứng.</p>
          ) : (
            <div className="proof-grid">
              {order.media.map((m, i) => (
                <article key={i}>
                  <span className="badge">{orderStages[m.stage]}</span>
                  <p>{m.note}</p>
                  <time dateTime={m.createdAt}>{formatDate(m.createdAt)}</time>
                  {m.url &&
                    (m.video ? (
                      <video src={m.url} controls preload="metadata" />
                    ) : (
                        <ShopImage
                          src={m.url}
                          alt={m.note || "Ảnh tiến độ bàn phím"}
                          width={1200}
                          height={900}
                        />
                    ))}
                  {m.videoUrl && (
                    <p>
                      <a href={m.videoUrl} target="_blank" rel="noreferrer">
                        Xem sound test ↗
                      </a>
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
          <p>Ảnh có quyền truy cập ngắn hạn. Tải lại trang nếu ảnh hết hạn.</p>
        </section>
      )}
      </div>
      <Link className="button button-outline" href="/#contact">
        Xem hướng dẫn tư vấn
      </Link>
    </main>
  );
}
