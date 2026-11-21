import type { Metadata } from "next";
import { AdminNavigation } from "@/components/admin-navigation";
import { AdminNotificationBell } from "@/components/admin-inbox";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Quản trị | TRUMP Keys" },
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <AdminNavigation />
      <div className="admin-workspace"><AdminNotificationBell />{children}</div>
    </div>
  );
}
