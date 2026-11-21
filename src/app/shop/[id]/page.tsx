import Link from "next/link";
import { notFound } from "next/navigation";
import { readPublicCatalog } from "@/lib/catalog-data";
import { ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product-gallery";
import { ProductPurchase } from "@/components/product-purchase";
import { money } from "@/lib/order-contract";
import { shop } from "@/lib/brand";
export const dynamic = "force-dynamic";
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    data = await readPublicCatalog(),
    item = data.catalog.find((i) => i.id === id);
  if (!item) notFound();
  return (
    <main id="main" className="container shop-page">
      <nav className="product-breadcrumb" aria-label="Đường dẫn sản phẩm">
        <Link href="/shop">Cửa hàng</Link>
        <span>/</span>
        <span>
          {data.categories.find((c) => c.slug === item.category)?.title}
        </span>
      </nav>
      <div className="product-detail">
        <ProductGallery key={item.id} item={item} />
        <section className="product-detail-info">
          <span className="buyer-product-type">
            {item.type === "product"
              ? "Sản phẩm / linh kiện"
              : "Dịch vụ bàn phím"}
          </span>
          <h1>{item.name}</h1>
          <p className="product-detail-price">
            {money(item.price)}
            <small> / {item.unit}</small>
          </p>
          <p>
            {item.type === "service"
              ? "Shop xác nhận lịch và cách gửi bàn phím sau khi đặt."
              : `Tồn kho: ${item.stock ?? 0} ${item.unit}`}
          </p>
          <p className="product-shipping-note">
            Giá chưa gồm ship. Cọc 20% + COD 80% hoặc chuyển khoản 100%. Giữ/trừ
            hàng khi shop xác nhận nhận tiền.
          </p>
          <ProductPurchase item={item} demo={data.demo} />
          <a
            href={shop.zalo}
            target="_blank"
            rel="noreferrer"
            className="product-support"
          >
            Hỏi shop qua Zalo · 08:00–22:00
          </a>
        </section>
      </div>
      <section className="product-description">
        <h2>Thông tin sản phẩm / dịch vụ</h2>
        <p>
          {item.description ||
            "Shop chưa bổ sung mô tả chi tiết. Hãy hỏi shop về thông số và tương thích trước khi đặt."}
        </p>
      </section>
      {data.catalog.some((i) => i.category === item.category && i.id !== id) && <section>
        <div className="storefront-heading">
          <h2>Cùng nhóm bạn đang xem</h2>
          <Link href="/shop">Xem cửa hàng</Link>
        </div>
        <div className="product-grid">
          {data.catalog
            .filter((i) => i.category === item.category && i.id !== id)
            .slice(0, 4)
            .map((i) => (
              <ProductCard key={i.id} item={i} demo={data.demo} />
            ))}
        </div>
      </section>}
    </main>
  );
}
