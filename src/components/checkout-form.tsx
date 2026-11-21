"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogItem } from "@/lib/domain";
import { resolveCart, type CartLine } from "@/lib/cart";
import { money } from "@/lib/order-contract";
import { placeCustomerOrder, type CheckoutState } from "@/app/checkout/actions";
import { useCart, useCartReady, removeSubmitted } from "./cart-store";
import {shippingPolicy} from "@/lib/shop-policies";
import { FormError } from "./form-error";
import type { ProfileFields } from "@/lib/profile";
export function CheckoutForm({
  catalog,
  token,
  quick,
  customer,
}: {
  catalog: CatalogItem[];
  token: string;
  quick?: CartLine[];
  customer?:ProfileFields;
}) {
  const cart = useCart(),
    cartReady = useCartReady(),
    chosen = quick ?? cart,
    rows = resolveCart(chosen, catalog),
    router = useRouter();
  const [submissionToken] = useState(token),
    [plan, setPlan] = useState("deposit_cod"),
    [delivery, setDelivery] = useState("ship");
  const [state, action, pending] = useActionState(
    async (prev: CheckoutState, form: FormData): Promise<CheckoutState> => {
      try {
        const sent = chosen.map((i) => ({ ...i }));
        const result = await placeCustomerOrder(prev, form);
        if (result.ok && result.code) {
          if (!quick) removeSubmitted(sent);
          router.push(`/track/${result.code}`);
        }
        return result;
      } catch {
        return {
          message: "Mất kết nối. Thông tin vẫn giữ nguyên; hãy thử gửi lại.",
        };
      }
    },
    {} as CheckoutState,
  );
  const total = rows.reduce(
      (s, r) => s + (r.item?.price ?? 0) * r.line.quantity,
      0,
    ),
    invalid = rows.some(
      (r) =>
        !r.item ||
        r.item.price !== r.line.expectedPrice ||
        (r.item.type === "product" && (r.item.stock ?? 0) < r.line.quantity),
    );
  if (state.ok)
    return (
      <section className="store-empty" role="status">
        <h2>Đã tạo đơn hàng</h2>
        <p>Đang mở trang QR thanh toán…</p>
        <Link className="button button-primary" href={`/track/${state.code}`}>
          Mở đơn & QR thanh toán
        </Link>
      </section>
    );
  if (!quick && !cartReady) return <section className="store-empty" role="status" aria-busy="true"><p>Đang tải giỏ hàng…</p></section>;
  if (!chosen.length)
    return (
      <section className="store-empty">
        <h2>Chưa có mặt hàng để đặt</h2>
        <Link href="/shop" className="button button-primary">
          Chọn sản phẩm
        </Link>
      </section>
    );
  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      className="checkout-layout"
    >
      <input type="hidden" name="token" value={submissionToken} />
      <input type="hidden" name="items" value={JSON.stringify(chosen)} />
      <div className="form-honeypot" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <section className="checkout-details">
        <fieldset className="m4-form" disabled={pending}>
          <h2>Thông tin người nhận</h2>
          <div className="order-form-grid">
            <label>
              Họ và tên
              <input
                name="customerName"
                defaultValue={customer?.name??""}
                autoComplete="name"
                required
                maxLength={120}
              />
            </label>
            <label>
              Số điện thoại
              <input
                name="phone"
                defaultValue={customer?.phone??""}
                type="tel"
                autoComplete="tel"
                required
                maxLength={20}
              />
            </label>
          </div>
          <label>
            Nhận hàng
            <select
              aria-label="Nhận hàng"
              name="delivery"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            >
              <option value="ship">Giao hàng đến địa chỉ</option>
              <option value="pickup">Nhận tại shop (hẹn trước)</option>
            </select>
          </label>
          {delivery === "ship" && (
            <label>
              Địa chỉ nhận hàng
              <textarea
                name="address"
                aria-label="Địa chỉ nhận hàng"
                defaultValue={customer?.address??""}
                autoComplete="street-address"
                required
                minLength={10}
                maxLength={1000}
              />
            </label>
          )}
          {rows.some((r) => r.item?.type === "service") && (
            <label>
              Bàn phím cần thực hiện dịch vụ
              <input
                name="keyboard"
                required
                maxLength={200}
                placeholder="Tên bàn phím, layout, yêu cầu tương thích…"
              />
            </label>
          )}
          <label>
            Ghi chú cho shop
            <textarea name="note" maxLength={2000} />
          </label>
          <h2>Chọn cách thanh toán</h2>
          <label className="payment-choice">
            <input
              type="radio"
              name="plan"
              value="deposit_cod"
              checked={plan === "deposit_cod"}
              onChange={() => setPlan("deposit_cod")}
            />
            <span>
              <strong>Chuyển khoản cọc 20%</strong>
              <small>Còn lại 80% COD. Cọc chưa gồm phí ship.</small>
            </span>
          </label>
          <label className="payment-choice">
            <input
              type="radio"
              name="plan"
              value="transfer_full"
              checked={plan === "transfer_full"}
              onChange={() => setPlan("transfer_full")}
            />
            <span>
              <strong>Chuyển khoản 100%</strong>
              <small>
                Thanh toán toàn bộ tiền hàng/dịch vụ, chưa gồm ship.
              </small>
            </span>
          </label>
          <label className="m4-check">
            <input type="checkbox" name="consent" required />
            <span>
              Tôi đã kiểm tra cấu hình, số lượng và đồng ý điều kiện: phí ship
              do shop xác nhận riêng; cọc 20% không hoàn khi khách hủy; hàng chỉ
              được giữ/trừ khi shop xác nhận nhận tiền.
            </span>
          </label>
          <p className="admin-muted">{shippingPolicy}</p>
          <p className="policy-links"><Link href="/guide" target="_blank" rel="noreferrer">Hướng dẫn mua hàng (tab mới)</Link><Link href="/privacy" target="_blank" rel="noreferrer">Thông tin riêng tư (tab mới)</Link></p>
        </fieldset>
      </section>
      <aside className="cart-summary checkout-summary">
        <h2>Đơn hàng của bạn</h2>
        {rows.map(({ line, item }) => (
          <div className="checkout-line" key={line.itemId}>
            <span>
              {item?.name ?? "Mặt hàng không còn bán"} × {line.quantity}
            </span>
            <strong>{money((item?.price ?? 0) * line.quantity)}</strong>
          </div>
        ))}
        <dl>
          <div>
            <dt>Tiền hàng / dịch vụ</dt>
            <dd>{money(total)}</dd>
          </div>
          <div>
            <dt>Phí vận chuyển</dt>
            <dd>Shop xác nhận riêng</dd>
          </div>
          <div className="checkout-pay">
            <dt>Chuyển khoản sau đặt đơn</dt>
            <dd>
              {money(plan === "deposit_cod" ? Math.ceil(total / 5) : total)}
            </dd>
          </div>
        </dl>
        <p>
          Đặt hàng xong sẽ có mã đơn và QR Agribank. Shop kiểm tra tiền vào rồi
          xác nhận.
        </p>
        {invalid && (
          <p className="form-error">
            Giá hoặc tồn đã thay đổi.{" "}
            <Link href="/cart">Kiểm tra giỏ hàng</Link>.
          </p>
        )}
        <button
          className="button button-primary"
          aria-label="Đặt hàng & nhận QR"
          disabled={pending || invalid || total <= 0}
        >
          {pending ? "Đang tạo đơn…" : "Đặt hàng & nhận QR"}
        </button>
        <FormError message={state.message} pending={pending} />
      </aside>
    </form>
  );
}
