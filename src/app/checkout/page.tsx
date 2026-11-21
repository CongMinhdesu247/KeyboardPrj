import Link from "next/link";
import { readPublicCatalog } from "@/lib/catalog-data";
import { issueRequestToken } from "@/lib/request-token";
import { CheckoutForm } from "@/components/checkout-form";
import { readAccount } from "@/lib/customer-account";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Đặt hàng & thanh toán",
  robots: { index: false, follow: false },
};
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; quantity?: string }>;
}) {
  const data = await readPublicCatalog(),
    account=await readAccount(),
    p = await searchParams,
    secret = process.env.SUPABASE_SECRET_KEY,
    item = p.item ? data.catalog.find((i) => i.id === p.item) : null;
  const quantity = /^\d{1,2}$/.test(p.quantity ?? "1")
    ? Math.max(1, Math.min(99, Number(p.quantity ?? 1)))
    : 1;
  return (
    <main id="main" className="container shop-page">
      <Link className="back-link" href="/cart">
        ← Giỏ hàng
      </Link>
      <h1>Thông tin đặt hàng</h1>
      <p className="shop-intro">
        Đơn hàng được lưu vào tài khoản Google của bạn. Sau khi đặt, bạn nhận mã tra cứu và QR chuyển khoản.
      </p>
      {!account || account.account.status!=="active" ? <section className="store-empty"><h2>Đăng nhập để đặt hàng</h2><p>Giỏ hàng vẫn được giữ trên thiết bị này.</p><Link className="button button-primary" href={`/account/login?${new URLSearchParams({checkout:"1",...(item?{item:item.id,quantity:String(quantity)}:{})})}`}>Đăng nhập với Google</Link></section> : secret && !data.demo ? (
        p.item && !item ? (
          <div className="store-empty">
            <h2>Mặt hàng không còn bán</h2>
            <Link href="/shop">Chọn mặt hàng khác</Link>
          </div>
        ) : (
          <CheckoutForm
            catalog={data.catalog}
            token={issueRequestToken(secret, undefined, "checkout")}
            customer={{name:account.account.name,phone:account.account.phone,address:account.account.address}}
            quick={
              item
                ? [{ itemId: item.id, quantity, expectedPrice: item.price }]
                : undefined
            }
          />
        )
      ) : (
        <section className="store-empty">
          <h2>Chưa mở đặt hàng trên web</h2>
          <Link href="/shop">Về cửa hàng</Link>
        </section>
      )}
    </main>
  );
}
