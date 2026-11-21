import "server-only";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import { isVerifiedGoogleUser, readAuthConfig } from "@/lib/auth-config";

export async function requireGoogleUser() {
  if (!readAuthConfig(process.env)) redirect("/admin/login");
  const client = await createAuthClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/admin/login?status=session");
  if (!isVerifiedGoogleUser(data.user))
    redirect("/admin/login?status=google_required");
  const session = await client.rpc("has_live_session");
  if (session.error)
    throw new Error(
      "Chưa xác minh được phiên. Hãy kiểm tra migration và kết nối dữ liệu.",
    );
  if (session.data !== true) redirect("/admin/login?status=session");
  return { client, user: data.user };
}
export async function requireAdmin() {
  const context = await requireGoogleUser();
  const { data, error } = await context.client.rpc("is_admin");
  if (error)
    throw new Error(
      "Chưa xác minh được quyền quản trị. Hãy kiểm tra kết nối và migration.",
    );
  if (data !== true) redirect("/admin/join");
  return context;
}
