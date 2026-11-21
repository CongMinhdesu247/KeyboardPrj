"use client";
import Link from "next/link";
import { useState } from "react";
import type { CatalogItem } from "@/lib/domain";
import { money } from "@/lib/order-contract";
import { addCart, useCartReady } from "./cart-store";
import { ShopImage } from "./shop-image";

export function ProductImage({
  item,
  eager = false,
}: {
  item: CatalogItem;
  eager?: boolean;
}) {
  return (
    <ShopImage
      src={item.imageUrl}
      alt={item.name}
      width={480}
      height={480}
      eager={eager}
    />
  );
}

export function ProductCard({
  item,
  demo = false,
}: {
  item: CatalogItem;
  demo?: boolean;
}) {
  const [notice, setNotice] = useState("");
  const ready = useCartReady();
  const sold = item.type === "product" && (item.stock ?? 0) <= 0;

  return (
    <article className={`product-card${sold ? " product-card-sold" : ""}`}>
      <Link href={`/shop/${item.id}`} className="product-photo">
        <ProductImage item={item} />
        {sold && <span className="product-photo-badge">Tạm hết</span>}
      </Link>
      <div className="product-card-content">
        <div className="product-card-meta">
          <span className="buyer-product-type">
            {item.type === "service" ? "Dịch vụ mod" : "Bàn phím & linh kiện"}
          </span>
          <span
            className={`product-stock-pill${
              item.type === "service" ? " service" : sold ? " out" : ""
            }`}
          >
            {item.type === "service"
              ? "Đặt lịch"
              : sold
                ? "Hết hàng"
                : `Còn ${item.stock}`}
          </span>
        </div>
        <Link href={`/shop/${item.id}`} className="product-title">
          <h3>{item.name}</h3>
        </Link>
        <p className="product-price">
          {money(item.price)}
          <small> / {item.unit}</small>
        </p>
        <button
          className="button button-primary"
          disabled={sold || demo || !ready}
          type="button"
          onClick={() =>
            setNotice(
              addCart({
                itemId: item.id,
                quantity: 1,
                expectedPrice: item.price,
              })
                ? "Đã thêm vào giỏ hàng."
                : "Chưa lưu được giỏ hàng (tối đa 30 mục).",
            )
          }
        >
          {sold ? "Tạm hết hàng" : "Thêm vào giỏ"}
        </button>
        {notice && (
          <p role="status" className="product-notice">
            {notice} <Link href="/cart">Xem giỏ</Link>
          </p>
        )}
      </div>
    </article>
  );
}
