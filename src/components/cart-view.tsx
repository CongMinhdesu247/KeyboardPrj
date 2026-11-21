"use client";
import Link from "next/link";
import type { CatalogItem } from "@/lib/domain";
import { resolveCart } from "@/lib/cart";
import { money } from "@/lib/order-contract";
import { useCart, useCartReady, writeCart } from "./cart-store";
import { ProductImage } from "./product-card";
export function CartView({ catalog }: { catalog: CatalogItem[] }) {
  const lines = useCart(),
    ready = useCartReady(),
    rows = resolveCart(lines, catalog),
    changed = rows.some((r) => r.item && r.item.price !== r.line.expectedPrice),
    unavailable = rows.some(
      (r) =>
        !r.item ||
        (r.item.type === "product" && (r.item.stock ?? 0) < r.line.quantity),
    );
  const total = rows.reduce(
    (s, r) => s + (r.item?.price ?? 0) * r.line.quantity,
    0,
  );
  if (!ready) return <div className="store-empty" role="status" aria-busy="true"><p>Đang tải giỏ hàng…</p></div>;
  return !lines.length ? (
    <div className="store-empty">
      <h2>Giỏ hàng đang trống</h2>
      <p>Chọn một sản phẩm hoặc dịch vụ để bắt đầu.</p>
      <Link href="/shop" className="button button-primary">
        Khám phá cửa hàng
      </Link>
    </div>
  ) : (
    <div className="cart-layout">
      <section className="cart-items">
        {rows.map(({ line, item }) => (
          <article className="cart-row" key={line.itemId}>
            <Link href={`/shop/${line.itemId}`} className="cart-thumb">
              {item && <ProductImage item={item} />}
            </Link>
            <div>
              <Link href={`/shop/${line.itemId}`}>
                <h2>{item?.name ?? "Mặt hàng không còn bán"}</h2>
              </Link>
              {item && (
                <p>
                  {money(item.price)} / {item.unit}
                </p>
              )}
              {item?.type === "product" &&
                (item.stock ?? 0) < line.quantity && (
                  <p className="form-error">Không đủ tồn (còn {item.stock}).</p>
                )}
              {item && item.price !== line.expectedPrice && (
                <p className="form-error">
                  Giá đã thay đổi, hãy xác nhận giá mới.
                </p>
              )}
              <button
                className="cart-remove"
                onClick={() =>
                  writeCart(lines.filter((i) => i.itemId !== line.itemId))
                }
              >
                Xóa khỏi giỏ
              </button>
            </div>
            <label>
              Số lượng
              <input
                aria-label={`Số lượng ${item?.name ?? line.itemId}`}
                type="number"
                min="1"
                max="99"
                step="1"
                value={line.quantity}
                onChange={(e) =>
                  writeCart(
                    lines.map((i) =>
                      i.itemId === line.itemId
                        ? {
                            ...i,
                            quantity: Math.max(
                              1,
                              Math.min(
                                99,
                                Math.trunc(Number(e.target.value)) || 1,
                              ),
                            ),
                          }
                        : i,
                    ),
                  )
                }
              />
            </label>
            <strong>{money((item?.price ?? 0) * line.quantity)}</strong>
          </article>
        ))}
      </section>
      <aside className="cart-summary">
        <h2>Tóm tắt giỏ hàng</h2>
        <dl>
          <div>
            <dt>Tiền hàng / dịch vụ</dt>
            <dd>{money(total)}</dd>
          </div>
          <div>
            <dt>Cọc 20%</dt>
            <dd>{money(Math.ceil(total / 5))}</dd>
          </div>
          <div>
            <dt>Vận chuyển</dt>
            <dd>Shop xác nhận riêng</dd>
          </div>
        </dl>
        {changed && (
          <button
            className="button button-outline"
            onClick={() =>
              writeCart(
                rows.flatMap((r) =>
                  r.item ? [{ ...r.line, expectedPrice: r.item.price }] : [],
                ),
              )
            }
          >
            Xác nhận giá mới
          </button>
        )}
        {!changed && !unavailable ? (
          <Link className="button button-primary" href="/checkout">
            Tiến hành đặt hàng
          </Link>
        ) : (
          <p className="form-error">Cập nhật giỏ hàng trước khi đặt.</p>
        )}
        <Link href="/shop">Tiếp tục mua sắm</Link>
        <p>
          Chỉ giữ/trừ hàng khi shop xác nhận đã nhận tiền. Giá chưa gồm ship.
        </p>
      </aside>
    </div>
  );
}
