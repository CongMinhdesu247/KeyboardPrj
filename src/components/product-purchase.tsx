"use client";
import Link from "next/link";
import { useState } from "react";
import type { CatalogItem } from "@/lib/domain";
import { addCart, useCartReady } from "./cart-store";

export function ProductPurchase({
  item,
  demo,
}: {
  item: CatalogItem;
  demo: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const max = item.type === "product" ? Math.min(item.stock ?? 0, 99) : 99;
  const safeMax = Math.max(1, max);
  const ready = useCartReady();
  const unavailable = demo || max < 1;
  const disabled = unavailable || !ready;

  const updateQuantity = (next: number) => {
    setQuantity(Math.max(1, Math.min(safeMax, Math.trunc(next) || 1)));
  };

  return (
    <div className="product-purchase">
      <div className="product-qty-row">
        <label htmlFor="product-qty-input">Số lượng</label>
        <div className="product-qty-stepper">
          <button
            type="button"
            className="qty-step-btn"
            aria-label="Giảm số lượng"
            disabled={disabled || quantity <= 1}
            onClick={() => updateQuantity(quantity - 1)}
          >
            −
          </button>
          <input
            id="product-qty-input"
            aria-label="Số lượng mua"
            type="number"
            min="1"
            max={safeMax}
            step="1"
            value={quantity}
            disabled={disabled}
            onChange={(e) => updateQuantity(Number(e.target.value) || 1)}
          />
          <button
            type="button"
            className="qty-step-btn"
            aria-label="Tăng số lượng"
            disabled={disabled || quantity >= safeMax}
            onClick={() => updateQuantity(quantity + 1)}
          >
            +
          </button>
        </div>
        {item.type === "product" && max > 0 && (
          <span className="product-qty-limit">Tối đa {max} {item.unit}</span>
        )}
      </div>
      <div className="form-actions">
        <button
          className="button button-outline"
          type="button"
          disabled={disabled}
          onClick={() =>
            setNotice(
              addCart({ itemId: item.id, quantity, expectedPrice: item.price })
                ? "Đã thêm vào giỏ hàng."
                : "Không lưu được giỏ hàng (tối đa 30 mục).",
            )
          }
        >
          Thêm vào giỏ
        </button>
        {!disabled && (
          <Link
            className="button button-primary"
            href={`/checkout?item=${item.id}&quantity=${quantity}`}
          >
            Mua ngay
          </Link>
        )}
      </div>
      {notice && (
        <p role="status" className="product-notice">
          {notice} <Link href="/cart">Xem giỏ hàng</Link>
        </p>
      )}
      {unavailable && (
        <p className="product-unavailable-note">
          {demo
            ? "Dữ liệu minh họa chưa nhận đặt mua."
            : "Mặt hàng đang hết tồn, bạn có thể liên hệ shop để đặt tìm."}
        </p>
      )}
    </div>
  );
}
