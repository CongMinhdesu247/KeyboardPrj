"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

type NavItem = readonly [href: string, label: string, icon: string];

const dailyLinks: readonly NavItem[] = [
  [
    "/admin",
    "Tổng quan",
    "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  ],
  [
    "/admin/orders",
    "Đơn hàng",
    "M8 4H5v17h14V4h-3 M8 3h8v4H8z M8 11h8 M8 15h8",
  ],
  [
    "/admin/catalog",
    "Bảng giá & kho",
    "M3 7l9-4 9 4-9 4z M3 7v10l9 4 9-4V7 M12 11v10",
  ],
  ["/admin/reports", "Tiền thực thu", "M4 20V10 M10 20V4 M16 20v-8 M3 21h18"],
];

const storeLinks: readonly NavItem[] = [
  [
    "/admin/requests",
    "Yêu cầu đặt tìm",
    "M4 4h16v12H4z M8 20h8 M12 16v4 M8 8h8 M8 12h5",
  ],
  [
    "/admin/portfolio",
    "Portfolio",
    "M3 3h18v18H3z M3 16l6-6 4 4 3-3 5 5 M16 7h.01",
  ],
  [
    "/admin/banners",
    "Banner trang chủ",
    "M3 4h18v16H3z M3 15l6-6 4 4 3-3 5 5 M16 8h.01",
  ],
  [
    "/admin/customers",
    "Tài khoản",
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  ],
];

const systemLinks: readonly NavItem[] = [
  [
    "/admin/team",
    "Quản trị viên",
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  ],
  ["/admin/chat", "Lịch sử tư vấn", "M3 3h18v14H8l-5 4z M7 7h10 M7 11h7"],
  [
    "/admin/notifications",
    "Tích hợp & thông báo",
    "M12 3a6 6 0 0 1 6 6v5l3 3H3l3-3V9a6 6 0 0 1 6-6 M9 21h6",
  ],
  [
    "/admin/readiness",
    "Chuẩn bị vận hành",
    "M9 3h6v4H9z M9 5H5v16h14V5h-4 M8 12l2 2 5-5 M8 18h8",
  ],
];

function NavLink({ item, path }: { item: NavItem; path: string }) {
  const [href, label, icon] = item;
  const active = href === "/admin" ? path === href : path.startsWith(href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      <span aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={icon} />
        </svg>
      </span>
      {label}
    </Link>
  );
}

export function AdminNavigation() {
  const path = usePathname();
  const inSystem = systemLinks.some(([href]) => path.startsWith(href));
  return (
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/admin">
        <Image
          src="/brand/logo-header.webp"
          alt=""
          width={36}
          height={36}
          className="shop-logo"
          unoptimized
        />
        <span>
          TRUMP Keys<small>Quản trị</small>
        </span>
      </Link>
      <nav aria-label="Điều hướng quản trị">
        <div className="admin-nav-group admin-nav-daily">
          <span className="admin-nav-label">Công việc</span>
          {dailyLinks.map((item) => (
            <NavLink key={item[0]} item={item} path={path} />
          ))}
        </div>
        <div className="admin-nav-group admin-nav-manage">
          <span className="admin-nav-label">Cửa hàng</span>
          {storeLinks.map((item) => (
            <NavLink key={item[0]} item={item} path={path} />
          ))}
        </div>
        <details key={path} className="admin-nav-more" open={inSystem || undefined}>
          <summary>Hệ thống</summary>
          <div className="admin-nav-group admin-nav-system">
            {systemLinks.map((item) => (
              <NavLink key={item[0]} item={item} path={path} />
            ))}
          </div>
        </details>
      </nav>
      <div className="admin-sidebar-footer">
        <Link href="/" target="_blank">
          Xem website ↗
        </Link>
      </div>
    </aside>
  );
}
