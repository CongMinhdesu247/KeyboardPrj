"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireGoogleUser } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase/server";
import { readAuthConfig } from "@/lib/auth-config";
import {
  createInviteToken,
  hashInviteToken,
  rpcSucceeded,
  rpcErrorMessage,
  type AccessState,
} from "@/lib/admin-contract";

export async function startGoogleLogin() {
  const config = readAuthConfig(process.env);
  if (!config) redirect("/admin/login?status=setup");
  (await cookies()).set("tk-login-intent","admin",{httpOnly:true,sameSite:"lax",secure:config.secure,path:"/",maxAge:600});
  const client = await createAuthClient({ writeCookies: true });
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${config.origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/admin/login?status=oauth_failed");
  redirect(data.url);
}
export async function logout() {
  const client = await createAuthClient({ writeCookies: true });
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error)
    throw new Error("Chưa đăng xuất được. Hãy thử lại khi có kết nối.");
  redirect("/admin/login");
}
export async function createAdminInvite(): Promise<AccessState> {
  const { client } = await requireAdmin();
  const token = createInviteToken();
  const { data, error } = await client.rpc("create_admin_invite", {
    p_token_hash: hashInviteToken(token)!,
  });
  if (error) return { message: "Chưa tạo được mã mời. Hãy thử lại." };
  if (!rpcSucceeded(data) || typeof data.expiresAt !== "string")
    return { message: rpcErrorMessage(data) };
  revalidatePath("/admin");
  revalidatePath("/admin/team");
  return {
    ok: true,
    message:
      "Mã chỉ hiện trong lần tạo này. Gửi riêng cho người được mời; mã hết hạn sau 24 giờ và chỉ dùng một lần.",
    token,
    expiresAt: data.expiresAt,
  };
}
export async function redeemAdminInvite(
  _previous: AccessState,
  form: FormData,
): Promise<AccessState> {
  const { client } = await requireGoogleUser();
  const tokenHash = hashInviteToken(String(form.get("token") ?? ""));
  if (!tokenHash)
    return {
      message:
        "Mã không đúng định dạng. Hãy dán đầy đủ mã TKADM- được admin gửi.",
    };
  const { data, error } = await client.rpc("redeem_admin_invite", {
    p_token_hash: tokenHash,
  });
  if (error) return { message: "Chưa xác minh được mã mời. Hãy thử lại." };
  if (!rpcSucceeded(data)) return { message: rpcErrorMessage(data) };
  revalidatePath("/admin");
  revalidatePath("/admin/team");
  redirect("/admin");
}
export async function revokeAdminInvite(
  _previous: AccessState,
  form: FormData,
): Promise<AccessState> {
  const { client } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!/^[1-9]\d{0,17}$/.test(id) || !Number.isSafeInteger(Number(id)))
    return { message: "Mã mời không hợp lệ." };
  const { data, error } = await client.rpc("revoke_admin_invite", {
    p_id: Number(id),
  });
  if (error || !rpcSucceeded(data))
    return { message: "Không thu hồi được mã. Hãy tải lại danh sách." };
  revalidatePath("/admin");
  revalidatePath("/admin/team");
  return { ok: true, message: "Đã thu hồi mã mời." };
}
export async function setAdminActive(
  _previous: AccessState,
  form: FormData,
): Promise<AccessState> {
  const { client } = await requireAdmin();
  const id = String(form.get("userId") ?? "");
  const active = String(form.get("active") ?? "");
  if (!/^[a-f0-9-]{36}$/i.test(id) || !["true", "false"].includes(active))
    return { message: "Thông tin tài khoản không hợp lệ." };
  const { data, error } = await client.rpc("set_admin_active", {
    p_user_id: id,
    p_active: active === "true",
  });
  if (error || !rpcSucceeded(data))
    return {
      message:
        "Chưa đổi được quyền tài khoản. Bạn không thể tự vô hiệu hóa mình.",
    };
  revalidatePath("/admin");
  revalidatePath("/admin/team");
  return {
    ok: true,
    message:
      active === "true" ? "Đã kích hoạt admin." : "Đã vô hiệu hóa quyền admin.",
  };
}
