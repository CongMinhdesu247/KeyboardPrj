"use client";
import { useActionState, useState, type ReactNode } from "react";
import { submitOrder } from "@/app/admin/orders/actions";
import { money, type OrderFormState } from "@/lib/order-contract";
export function OrderActionForm({
  action,
  requestId,
  orderId,
  children,
  label,
}: {
  action: string;
  requestId: string;
  orderId?: string;
  children: ReactNode;
  label: string;
}) {
  const [state, submit, pending] = useActionState(
    submitOrder,
    {} as OrderFormState,
  );
  return (
    <form
      action={submit}
      onReset={(e) => e.preventDefault()}
      className="access-form"
    >
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="requestId" value={requestId} />
      {orderId && <input type="hidden" name="orderId" value={orderId} />}
      <fieldset disabled={pending || state.ok} className="order-fieldset">
        {children}
        <button
          className="button button-primary"
          type="submit"
          aria-label={label}
          aria-busy={pending}
        >
          {pending ? "Đang lưu…" : label}
        </button>
      </fieldset>
      {state.message && (
        <p role="status" className={state.ok ? "form-success" : "form-error"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
type Choice = {
  id: string;
  name: string;
  price: number;
  version: number;
  unit: string;
  stock: number | null;
};
export function CreateOrderForm({
  items,
  requestId,
}: {
  items: Choice[];
  requestId: string;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const total = items.reduce(
    (s, i) => s + i.price * (quantities[i.id] ?? 0),
    0,
  );
  return (
    <OrderActionForm action="create" requestId={requestId} label="Tạo đơn hàng">
      <div className="order-form-grid">
        <label>
          Tên khách hàng
          <input
            name="customerName"
            required
            maxLength={120}
            autoComplete="off"
          />
        </label>
        <label>
          Số điện thoại
          <input
            name="phone"
            required
            maxLength={20}
            type="tel"
            autoComplete="off"
          />
        </label>
      </div>
      <label>
        Bàn phím / cấu hình
        <input name="keyboard" required maxLength={200} />
      </label>
      <label>
        Phương án thanh toán
        <select name="plan">
          <option value="deposit_cod">
            Cọc 20% chuyển khoản, còn lại 80% COD
          </option>
          <option value="transfer_full">Chuyển khoản toàn bộ 100%</option>
        </select>
      </label>
      <h2>Chọn hạng mục</h2>
      <p>
        Nhập số lượng để chọn. Tạo đơn chưa giữ hàng; tồn chỉ trừ khi xác nhận
        nhận tiền.
      </p>
      <div className="order-items">
        <label className="admin-item-search">
          Tìm hạng mục
          <input
            type="search"
            value={search}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tên dịch vụ hoặc linh kiện"
          />
        </label>
        <small>
          {items.filter((i) => (quantities[i.id] ?? 0) > 0).length} hạng mục đã
          chọn · Thay đổi bộ lọc vẫn giữ số lượng.
        </small>
        {!items.some((i) =>
          i.name
            .toLocaleLowerCase("vi")
            .includes(search.trim().toLocaleLowerCase("vi")),
        ) && <p>Không có hạng mục phù hợp.</p>}
        {items.map((i) => (
          <div
            key={i.id}
            hidden={
              !i.name
                .toLocaleLowerCase("vi")
                .includes(search.trim().toLocaleLowerCase("vi"))
            }
          >
            <label className="order-choice">
              <span>
                {i.name}
                <small>
                  {money(i.price)} / {i.unit}
                  {i.stock !== null ? ` · Tồn ${i.stock}` : ""}
                </small>
              </span>
              <input type="hidden" name={`version-${i.id}`} value={i.version} />
              <input
                aria-label={`Số lượng ${i.name}`}
                type="number"
                name={`qty-${i.id}`}
                min="0"
                max="999"
                step="1"
                defaultValue="0"
                onChange={(e) =>
                  setQuantities({
                    ...quantities,
                    [i.id]: Math.max(
                      0,
                      Math.min(999, Math.trunc(Number(e.target.value)) || 0),
                    ),
                  })
                }
              />
            </label>
          </div>
        ))}
      </div>
      <p className="order-total">
        Tiền hàng / dịch vụ: <strong>{money(total)}</strong> · Cọc 20%:{" "}
        <strong>{money(Math.ceil(total / 5))}</strong>
      </p>
      <label>
        Ghi chú vận chuyển (chưa tính trong tổng và cọc)
        <textarea name="shippingNote" maxLength={500} />
      </label>
      <label>
        Ghi chú nội bộ
        <textarea name="internalNote" maxLength={2000} />
      </label>
    </OrderActionForm>
  );
}
