"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShopIcon } from "./shop-icon";
export function UtilityLinks() {
 const path=usePathname();
 return <nav className="utility-links" aria-label="Liên kết tiện ích">
  <Link href="/account" aria-current={path.startsWith("/account")?"page":undefined}><span className="utility-icon"><ShopIcon name="user" size={18}/></span><span>Tài khoản</span></Link>
  <Link href="/guide" aria-current={path==="/guide"?"page":undefined} aria-label="Hướng dẫn mua hàng"><span className="utility-icon"><ShopIcon name="book" size={18}/></span><span>Hướng dẫn<span className="utility-label-extra"> mua hàng</span></span></Link>
  <a href={path==="/"?"#tracking":"/#tracking"} aria-current={path.startsWith("/track/")?"page":undefined} aria-label="Tra cứu đơn hàng"><span className="utility-icon"><ShopIcon name="search" size={18}/></span><span>Tra cứu<span className="utility-label-extra"> đơn hàng</span></span></a>
 </nav>;
}
