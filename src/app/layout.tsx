import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Image from "next/image";
import { shop } from "@/lib/brand";
import { PwaInstall } from "@/components/pwa-install";
import { BuyerNavigation, BuyerCartLink } from "@/components/buyer-navigation";
import { UtilityLinks } from "@/components/utility-links";
import "./globals.css";
import "./buyer.css";

export const metadata: Metadata = {
  title: {
    default: "TRUMP Keys · Chạm đúng chất riêng",
    template: "%s | TRUMP Keys",
  },
  description:
    "TRUMP Keys: dịch vụ mod bàn phím, linh kiện, ước tính chi phí và theo dõi hành trình.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TRUMP Keys",
  },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F5B700",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          Đến nội dung chính
        </a>
        <div className="store-utility">
          <div className="container">
            <span>Tư vấn mỗi ngày · 08:00–22:00</span>
            <UtilityLinks />
          </div>
        </div>
        <header className="site-header">
          <div className="container header-inner">
            <Link
              href="/"
              className="brand"
              aria-label="TRUMP Keys — Trang chủ"
            >
              <Image
                src="/brand/logo-header.webp"
                alt=""
                width={48}
                height={48}
                className="shop-logo"
                unoptimized
                priority
              />
              <span>
                TRUMP<span className="brand-sub">Keys</span>
              </span>
            </Link>
            <form action="/shop" method="get" className="buyer-search" role="search">
              <label className="visually-hidden" htmlFor="buyer-search">Tìm trong cửa hàng</label>
              <input id="buyer-search" type="search" name="q" placeholder="Tìm bàn phím, switch, keycap…" maxLength={120} />
              <button type="submit" aria-label="Tìm kiếm sản phẩm">
                <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
              </button>
            </form>
            <BuyerCartLink />
          </div>
          <BuyerNavigation />
        </header>
        {children}
        <footer className="site-footer buyer-footer-shell">
          <div className="container buyer-footer">
          <div>
            <strong>TRUMP Keys</strong>
            <p>Bàn phím, linh kiện và dịch vụ mod<br />cho góc làm việc của bạn.</p>
            <p>Tư vấn 08:00–22:00 · Giờ Việt Nam</p>
            <nav className="social-links" aria-label="Kênh liên hệ shop">
              {[
                ["Zalo", shop.zalo],
                ["Facebook", shop.facebook],
                ["Instagram", shop.instagram],
                ["TikTok", shop.tiktok],
              ].map(([label, url]) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <div>
            <h2>Mua sắm</h2>
            <nav aria-label="Mua sắm"><Link href="/shop">Tất cả sản phẩm</Link><Link href="/#services">Dịch vụ mod</Link><Link href="/preorder">Đặt tìm mẫu</Link><Link href="/portfolio">Bàn phím đã làm</Link><Link href="/estimate">Ước tính chi phí</Link></nav>
          </div>
          <div>
            <h2>Hỗ trợ khách hàng</h2>
            <nav aria-label="Hướng dẫn và dữ liệu"><Link href="/guide">Hướng dẫn mua hàng</Link><Link href="/guide#delivery">Giao và nhận hàng</Link><Link href="/guide#cancel">Hủy và hoàn tiền</Link><Link href="/#tracking">Tra cứu đơn hàng</Link><Link href="/privacy">Thông tin riêng tư</Link><Link href="/chat">Tư vấn cấu hình</Link></nav>
          </div>
          <div className="buyer-footer-bottom">
            <span>TRUMP Keys · Giá chưa gồm phí ship và COD</span>
            <PwaInstall />
            <Link href="/admin">Khu vực quản trị</Link>
          </div>
          </div>
        </footer>
        <nav className="mobile-nav" aria-label="Điều hướng điện thoại">
          {[
            ["/", "Trang chủ", "M3 10l9-7 9 7 M5 9v12h14V9 M9 21v-7h6v7"],
            ["/shop", "Cửa hàng", "M3 9l2-6h14l2 6 M3 9h18v12H3z M9 21v-8h6v8"],
            ["/cart", "Giỏ hàng", "M2 3h3l3 12h11l3-9H6 M9 20h.01 M19 20h.01"],
            ["/chat", "Tư vấn", "M3 3h18v14H8l-5 4z M7 7h10 M7 11h7"],
          ].map(([href, label, path]) => (
            <Link href={href} key={href}>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </body>
    </html>
  );
}
