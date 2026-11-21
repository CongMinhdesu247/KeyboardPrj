import { receivingBank, type BankPayment } from "@/lib/bank-transfer";
import { money } from "@/lib/order-contract";
import { CopyValue } from "./copy-value";
export function BankTransferPanel({
  payment,
  admin = false,
}: {
  payment: BankPayment;
  admin?: boolean;
}) {
  if (payment.status === "confirmation_required")
    return (
      <section className="bank-payment-status">
        <h2>Shop cần kiểm tra lại mặt hàng</h2>
        <p>
          Tồn kho hoặc tình trạng bán đã thay đổi. Vui lòng chưa chuyển khoản,
          liên hệ shop để được xác nhận trước.
        </p>
      </section>
    );
  if (payment.status === "cancelled")
    return (
      <section className="bank-payment-status">
        <h2>Đơn đã hủy</h2>
        <p>
          Không chuyển thêm tiền vào đơn này. Liên hệ shop để đối soát hoặc hoàn
          tiền.
        </p>
      </section>
    );
  if (payment.status === "paid")
    return (
      <section className="bank-payment-status">
        <h2>Shop đã xác nhận thanh toán đủ</h2>
        <p>Bạn không cần chuyển thêm tiền cho đơn này.</p>
      </section>
    );
  if (payment.status === "deposit_received")
    return (
      <section className="bank-payment-status">
        <h2>Shop đã xác nhận nhận cọc</h2>
        <p>
          Còn lại {money(payment.remaining)} thanh toán COD. Không chuyển thêm
          theo QR cọc cũ.
        </p>
      </section>
    );
  return (
    <section className="bank-payment" aria-label="Chuyển khoản ngân hàng">
      <div className="bank-payment-details">
        <span className="badge">Chờ shop xác nhận thanh toán</span>
        <h2>
          {payment.plan === "deposit_cod"
            ? "Chuyển khoản cọc 20%"
            : "Chuyển khoản toàn bộ 100%"}
        </h2>
        <p className="bank-amount">{money(payment.amount)}</p>
        <p className="admin-muted">
          Tiền hàng / dịch vụ, chưa gồm phí vận chuyển.
        </p>
        <dl className="bank-recipient">
          <div>
            <dt>Ngân hàng</dt>
            <dd>{receivingBank.bankName}</dd>
          </div>
          <div>
            <dt>Chủ tài khoản</dt>
            <dd>{receivingBank.accountName}</dd>
          </div>
        </dl>
        <CopyValue label="Số tài khoản" value={receivingBank.accountNumber} />
        <CopyValue label="Nội dung chuyển khoản" value={payment.reference} />
        <p className="bank-wait-note">
          {admin
            ? "Đối chiếu số tiền và nội dung này trong ứng dụng ngân hàng trước khi ghi nhận thực thu."
            : "Nếu đã chuyển tiền, vui lòng không chuyển lại. Chờ shop kiểm tra tài khoản và xác nhận; tải lại trang để xem trạng thái mới."}
        </p>
      </div>
      <div className="bank-qr">
        <span className="bank-qr-label">QR chuyển khoản · Agribank</span>
        {payment.qrDataUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={payment.qrDataUrl}
              width={320}
              height={320}
              alt="QR chuyển khoản Agribank"
            />
            <a
              className="button button-outline"
              href={payment.qrDataUrl}
              download={`trumpkeys-thanhtoan-${payment.reference}.png`}
            >
              Tải QR chuyển khoản
            </a>
          </>
        )}
        <p>
          Kiểm tra đúng tên người nhận, số tiền và nội dung trong ứng dụng ngân
          hàng trước khi chuyển.
        </p>
      </div>
    </section>
  );
}
