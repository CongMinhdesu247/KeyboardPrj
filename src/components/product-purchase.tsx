"use client";
import Link from "next/link";
import { useState } from "react";
import type { CatalogItem } from "@/lib/domain";
import { addCart,useCartReady } from "./cart-store";
export function ProductPurchase({
  item,
  demo,
}: {
  item: CatalogItem;
  demo: boolean;
}) {
  const [quantity, setQuantity] = useState(1),
    [notice, setNotice] = useState("");
  const max = item.type === "product" ? Math.min(item.stock ?? 0, 99) : 99,
    ready=useCartReady(),disabled = demo || max < 1 || !ready;
  return (
    <div className="product-purchase">
      <label>
        Số lượng
        <input
          aria-label="Số lượng mua"
          type="number"
          min="1"
          max={Math.max(1, max)}
          value={quantity}
          onChange={(e) =>
            setQuantity(
              Math.max(
                1,
                Math.min(Math.max(1, max), Number(e.target.value) || 1),
              ),
            )
          }
        />
      </label>
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
        <p role="status">
          {notice} <Link href="/cart">Xem giỏ hàng</Link>
        </p>
      )}
      {disabled && (
        <p>
          {demo
            ? "Dữ liệu minh họa chưa nhận đặt mua."
            : "Mặt hàng đang hết tồn, bạn có thể liên hệ shop để đặt tìm."}
        </p>
      )}
    </div>
  );
}
