import { requireAdmin } from "@/lib/auth";
import type { InviteSummary } from "@/lib/admin-contract";
import { AdminAccess } from "@/components/admin-access";
import { logout } from "../actions";
export default async function AdminPage() {
  const { client, user } = await requireAdmin();
  const [members, invites] = await Promise.all([
    client
      .from("admin_members")
      .select("user_id,email,active,created_at")
      .order("created_at"),
    client.rpc("list_admin_invites"),
  ]);
  if (members.error || invites.error)
    throw new Error(
      "Chưa tải được danh sách quản trị. Hãy kiểm tra kết nối dữ liệu.",
    );
  const summaries: InviteSummary[] = [];
  if (Array.isArray(invites.data))
    for (const value of invites.data) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        typeof value.id === "string" &&
        typeof value.createdAt === "string" &&
        typeof value.expiresAt === "string" &&
        (value.usedAt === null || typeof value.usedAt === "string") &&
        (value.revokedAt === null || typeof value.revokedAt === "string")
      )
        summaries.push({
          id: value.id,
          createdAt: value.createdAt,
          expiresAt: value.expiresAt,
          usedAt: value.usedAt,
          revokedAt: value.revokedAt,
        });
    }
  return (
    <main id="main" className="container page-container">
      <div className="tracking-heading">
        <div>
          <span className="eyebrow">TRUMP Keys · Quản trị</span>
          <h1>Quản trị viên</h1>
          <p>{user.email}</p>
        </div>
        <form action={logout}>
          <button className="button button-outline">Đăng xuất</button>
        </form>
      </div>
      <AdminAccess
        currentUserId={user.id}
        members={members.data ?? []}
        invites={summaries}
      />
    </main>
  );
}
