import Link from "next/link";
import { readPublicCatalog } from "@/lib/catalog-data";
import { CartView } from "@/components/cart-view";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Giỏ hàng",
  robots: { index: false, follow: false },
};
export default async function CartPage() {
  const data = await readPublicCatalog();
  return (
    <main id="main" className="container shop-page">
      <Link className="back-link" href="/shop">
        ← Tiếp tục mua sắm
      </Link>
      <h1>Giỏ hàng của bạn</h1>
      <p className="shop-intro">
        Kiểm tra sản phẩm, số lượng và giá trước khi đặt hàng.
      </p>
      <CartView catalog={data.demo ? [] : data.catalog} />
    </main>
  );
}
