import { createHash, randomBytes } from "node:crypto";

export function createInviteToken() {
  return `TKADM-${randomBytes(32).toString("base64url")}`;
}
export function hashInviteToken(input: string): string | null {
  const token = input.trim();
  return /^TKADM-[A-Za-z0-9_-]{43}$/.test(token)
    ? createHash("sha256").update(token).digest("hex")
    : null;
}
export type AccessState = {
  message: string;
  ok?: boolean;
  token?: string;
  expiresAt?: string;
};
export type InviteSummary = {
  id: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
};
export function rpcSucceeded(
  value: unknown,
): value is { ok: true; id?: string; expiresAt?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    value.ok === true
  );
}
export function rpcErrorMessage(value: unknown) {
  const code =
    typeof value === "object" && value !== null && "code" in value
      ? value.code
      : null;
  if (code === "rate_limited")
    return "Bạn đã thử quá nhiều lần. Hãy chờ 15 phút rồi thử lại.";
  if (code === "account_disabled")
    return "Tài khoản đã bị vô hiệu hóa. Hãy liên hệ một admin đang hoạt động.";
  if (code === "invite_limit")
    return "Bạn đã có 10 mã mời còn hiệu lực. Hãy thu hồi mã cũ trước.";
  return "Thao tác chưa thực hiện được. Mã mời có thể đã hết hạn, được dùng hoặc bị thu hồi.";
}
