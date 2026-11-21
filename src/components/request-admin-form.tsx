"use client";
import { useActionState } from "react";
import { updateFindRequest } from "@/app/admin/requests/actions";
import {
  requestStatuses,
  type CustomRequest,
  type M4State,
} from "@/lib/m4-contract";
export function RequestAdminForm({ request: r }: { request: CustomRequest }) {
  const [state, action, pending] = useActionState(
    updateFindRequest,
    {} as M4State,
  );
  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      className="m4-form"
    >
      <input type="hidden" name="id" value={r.id} />
      <input type="hidden" name="version" value={r.version} />
      <fieldset disabled={pending || state.ok}>
        <label>
          Trạng thái xử lý
          <select
            name="status"
            aria-label="Trạng thái xử lý"
            defaultValue={r.status}
          >
            {Object.entries(requestStatuses).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ghi chú nội bộ
          <textarea
            name="internalNote"
            maxLength={2000}
            defaultValue={r.internal_note}
          />
        </label>
        <button className="button button-primary">
          {pending ? "Đang lưu…" : "Lưu xử lý"}
        </button>
      </fieldset>
      {state.message && (
        <p role="status">
          {state.message}
          {state.ok && " Tải lại dữ liệu trước khi sửa tiếp."}
        </p>
      )}
    </form>
  );
}
