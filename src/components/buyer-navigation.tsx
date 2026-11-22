"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./cart-store";
import { ShopIcon } from "./shop-icon";

export function BuyerNavigation() {
  const pathname = usePathname();
  return (
    <nav className="container buyer-navigation" data-checkout={pathname === "/checkout" ? "true" : undefined} aria-label="Điều hướng chính">
      {([
        ["/", "Trang chủ","home"],
        ["/shop", "Cửa hàng","storefront"],
        ["/#services", "Dịch vụ mod","wrench"],
        ["/portfolio", "Bàn phím đã làm","keyboard"],
        ["/estimate", "Ước tính chi phí","calculator"],
      ] as const).map(([href, label,icon]) => href === "/#services" ? (
        <a key={href} href={pathname === "/" ? "#services" : href}><ShopIcon name={icon}/>{label}</a>
      ) : (
        <Link key={href} href={href} aria-current={(href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)) ? "page" : undefined}>
          <ShopIcon name={icon}/>{label}
        </Link>
      ))}
      <Link className="buyer-nav-help" href="/chat" aria-current={pathname === "/chat" || pathname.startsWith("/chat/") ? "page" : undefined}><ShopIcon name="chat"/>Tư vấn cấu hình</Link>
    </nav>
  );
}

export function BuyerCartLink() {
  const count = useCart().reduce((sum, line) => sum + line.quantity, 0);
  return (
    <Link className="buyer-cart-link" href="/cart" aria-label="Giỏ hàng" aria-describedby="buyer-cart-total">
      <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 7h14l1 14H4L5 7z M8 8V6a4 4 0 0 1 8 0v2" />
      </svg>
      <span>Giỏ hàng</span>
      <span id="buyer-cart-total" className="buyer-cart-count" aria-label={`${count} sản phẩm trong giỏ`}>{count}</span>
    </Link>
  );
}
