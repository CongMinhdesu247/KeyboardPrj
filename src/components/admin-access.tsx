"use client";
import { useActionState } from "react";
import {
  createAdminInvite,
  redeemAdminInvite,
  revokeAdminInvite,
  setAdminActive,
} from "@/app/admin/actions";
import type { AccessState, InviteSummary } from "@/lib/admin-contract";
import type { Database } from "@/lib/database.types";
import { formatDate } from "@/lib/tracking";
const initial: AccessState = { message: "" };
export function JoinAdminForm() {
  const [state, action, pending] = useActionState(redeemAdminInvite, initial);
  return (
    <form action={action} className="access-form">
      <label htmlFor="admin-token">Mã mời admin</label>
      <input
        id="admin-token"
        name="token"
        type="password"
        autoComplete="off"
        spellCheck={false}
        required
        maxLength={60}
        placeholder="TKADM-…"
      />
      <button className="button button-primary" disabled={pending}>
        {pending ? "Đang xác minh…" : "Xác nhận mã mời"}
      </button>
      <p role="status" className="auth-feedback">
        {state.message}
      </p>
    </form>
  );
}
function RevokeForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revokeAdminInvite, initial);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="button button-outline" disabled={pending}>
        {pending ? "Đang thu hồi…" : "Thu hồi mã"}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
function MemberForm({
  member,
}: {
  member: Database["public"]["Tables"]["admin_members"]["Row"];
}) {
  const [state, action, pending] = useActionState(setAdminActive, initial);
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={member.user_id} />
      <input type="hidden" name="active" value={String(!member.active)} />
      <button className="button button-outline" disabled={pending}>
        {pending
          ? "Đang lưu…"
          : member.active
            ? "Vô hiệu hóa quyền"
            : "Kích hoạt lại"}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
export function AdminAccess({
  members,
  invites,
  currentUserId,
}: {
  members: Database["public"]["Tables"]["admin_members"]["Row"][];
  invites: InviteSummary[];
  currentUserId: string;
}) {
  const [state, action, pending] = useActionState(createAdminInvite, initial);
  return (
    <>
      <section className="info-panel">
        <h2>Mời thêm admin</h2>
        <p>
          Người được mời đăng nhập Google, sau đó nhập mã ở trang cấp quyền. Mọi
          admin có cùng quyền quản lý cửa hàng.
        </p>
        <form action={action} className="access-form">
          <button className="button button-primary" disabled={pending}>
            {pending ? "Đang tạo…" : "Tạo mã mời 24 giờ"}
          </button>
          <p role="status" className="auth-feedback">
            {state.message}
          </p>
          {state.token && (
            <div>
              <label htmlFor="new-admin-token">
                Mã mời vừa tạo — chọn để sao chép
              </label>
              <input
                id="new-admin-token"
                className="invite-token"
                readOnly
                value={state.token}
                onFocus={(event) => event.target.select()}
              />
              <p>
                Hết hạn:{" "}
                {state.expiresAt ? formatDate(state.expiresAt) : "24 giờ"}. Mã
                không thể xem lại sau khi tải lại trang.
              </p>
            </div>
          )}
        </form>
        <ul className="access-list">
          {invites.length === 0 && <li>Chưa có mã mời nào.</li>}
          {invites.map((invite) => (
            <li key={invite.id}>
              <div>
                <strong>Mã mời #{invite.id}</strong>
                <p>Hết hạn {formatDate(invite.expiresAt)}</p>
                <span className="badge">
                  {invite.usedAt
                    ? "Đã dùng"
                    : invite.revokedAt
                      ? "Đã thu hồi"
                      : "Chưa sử dụng (kiểm tra hạn ở trên)"}
                </span>
              </div>
              {!invite.usedAt && !invite.revokedAt && (
                <RevokeForm id={invite.id} />
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="info-panel">
        <h2>Đội ngũ admin</h2>
        <p>
          Vô hiệu hóa chặn những lần truy cập/thao tác tiếp theo, kể cả khi tài
          khoản còn phiên Google. Thao tác đang chạy có thể hoàn tất.
        </p>
        <ul className="access-list">
          {members.map((member) => (
            <li key={member.user_id}>
              <div>
                <strong>{member.email}</strong>
                <p>
                  {member.user_id === currentUserId
                    ? "Tài khoản của bạn · "
                    : ""}
                  {member.active ? "Đang hoạt động" : "Đã vô hiệu hóa"}
                </p>
              </div>
              {member.user_id !== currentUserId && (
                <MemberForm member={member} />
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
