import Link from "next/link";
import type { ReactNode } from "react";
import type { Account } from "@/lib/customer-account";
import { customerLogout } from "@/app/account/actions";
import { ShopIcon } from "./shop-icon";
export function AccountShell({account,selected,children}:{account:Account;selected:"profile"|"orders";children:ReactNode}) {
 const name=account.name || "Khách hàng",initials=name.trim().split(/\s+/).slice(-2).map(word=>Array.from(word)[0]).join("").toLocaleUpperCase("vi");
 return <main id="main" className="container account-page">
  <div className="account-page-heading"><Link className="back-link" href="/">Trang chủ</Link><span aria-hidden="true">/</span><span>Tài khoản</span></div>
  <div className="account-layout">
   <aside className="account-sidebar"><div className="account-identity"><span className="account-avatar" aria-hidden="true">{initials}</span><div><strong>{name}</strong><span>{account.email}</span></div></div>
    <nav className="account-menu" aria-label="Menu tài khoản">
     <Link href="/account" aria-current={selected==="profile"?"page":undefined}><ShopIcon name="user"/>Hồ sơ cá nhân</Link>
     <Link href="/account/orders" aria-current={selected==="orders"?"page":undefined}><ShopIcon name="box"/>Đơn mua</Link>
     {account.role==="admin"&&<Link href="/admin"><ShopIcon name="shield"/>Khu vực quản trị</Link>}
    </nav><form action={customerLogout} className="account-signout"><button type="submit"><ShopIcon name="logout"/>Đăng xuất</button></form>
   </aside>
   <div className="account-main">{children}</div>
  </div>
 </main>;
}
