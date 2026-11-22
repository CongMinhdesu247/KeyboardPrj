"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ManagedAccount } from "@/lib/accounts-contract";
import { manageAccount } from "@/app/admin/customers/actions";

type AccountActionState = {
  ok?: boolean;
  message: string;
  sessionId: number;
};

export function AccountControls({ account }: { account: ManagedAccount }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openRef = useRef(false);
  const sessionRef = useRef(0);
  const [sessionId, setSessionId] = useState(0);
  const [operation, setOperation] = useState("ban");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);

  const restoreFocus = () => {
    const trigger = triggerRef.current;
    if (trigger?.isConnected && !trigger.disabled) {
      trigger.focus();
      return;
    }
    const fallback = document.querySelector<HTMLElement>(
      "main h1, .admin-workspace h1, main",
    );
    if (fallback) {
      if (!fallback.hasAttribute("tabindex")) fallback.setAttribute("tabindex", "-1");
      fallback.focus();
    }
  };

  useEffect(() => {
    return () => {
      if (openRef.current) {
        openRef.current = false;
        restoreFocus();
      }
    };
  }, []);

  const [result, action, pending] = useActionState(
    async (
      prev: AccountActionState,
      formData: FormData,
    ): Promise<AccountActionState> => {
      const submittedSession = Number(formData.get("sessionId") ?? 0);
      const next = await manageAccount(prev, formData);
      return { ...next, sessionId: submittedSession };
    },
    { message: "", sessionId: 0 },
  );

  useEffect(() => {
    if (result.ok && result.sessionId === sessionId) {
      dialog.current?.close();
    }
  }, [result, sessionId]);

  if (account.role === "admin" || account.status === "deleted") return null;

  const label =
    operation === "delete"
      ? "Xóa tài khoản"
      : operation === "ban"
        ? "Cấm tài khoản"
        : "Bỏ cấm tài khoản";

  const showError =
    result.sessionId === sessionId && !result.ok && Boolean(result.message);

  const open = (value: string, trigger: HTMLButtonElement) => {
    if (pending) return;
    const nextSession = sessionRef.current + 1;
    sessionRef.current = nextSession;
    triggerRef.current = trigger;
    openRef.current = true;
    setSessionId(nextSession);
    setOperation(value);
    setReason("");
    setConfirm(false);
    dialog.current?.showModal();
  };

  const handleClose = () => {
    openRef.current = false;
    restoreFocus();
  };

  return (
    <>
      <div className="account-row-actions">
        <button
          type="button"
          disabled={pending}
          className="button button-outline"
          onClick={(e) =>
            open(account.status === "banned" ? "unban" : "ban", e.currentTarget)
          }
        >
          {account.status === "banned" ? "Bỏ cấm" : "Cấm tài khoản"}
        </button>
        <button
          type="button"
          disabled={pending}
          className="button button-outline"
          onClick={(e) => open("delete", e.currentTarget)}
        >
          Xóa tài khoản
        </button>
      </div>
      {result.ok && <p role="status">{result.message}</p>}
      <dialog
        ref={dialog}
        className="account-dialog"
        aria-label={label}
        onClose={handleClose}
      >
        <h2>{label}</h2>
        <p>{account.email}</p>
        <p>
          {operation === "delete"
            ? "Tài khoản bị khóa vĩnh viễn và ẩn khỏi danh sách mặc định. Lịch sử đơn hàng, thanh toán và hồ sơ xác thực được giữ; đây không phải xóa toàn bộ dữ liệu cá nhân."
            : operation === "ban"
              ? "Khách sẽ mất quyền đăng nhập và đặt đơn. Các đơn đang xử lý vẫn được giữ."
              : "Khách được đăng nhập lại. Không tự khôi phục phiên cũ."}
        </p>
        <form action={action} onReset={(e) => e.preventDefault()}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="id" value={account.id} />
          <input type="hidden" name="version" value={account.version} />
          <input type="hidden" name="action" value={operation} />
          <label>
            Lý do
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              name="confirm"
              required
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            Tôi xác nhận {label.toLocaleLowerCase("vi")}
          </label>
          {showError && <p role="alert">{result.message}</p>}
          <div className="form-actions">
            <button type="submit" disabled={pending} className="button button-primary">
              {pending ? "Đang xử lý…" : `Xác nhận ${label.toLocaleLowerCase("vi")}`}
            </button>
            <button
              type="button"
              disabled={pending}
              className="button button-outline"
              onClick={() => dialog.current?.close()}
            >
              Đóng
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
