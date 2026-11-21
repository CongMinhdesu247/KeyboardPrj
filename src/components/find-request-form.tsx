"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { submitFindRequest } from "@/app/preorder/actions";
import type { M4State } from "@/lib/m4-contract";
import { FormError } from "./form-error";
import { VndInput } from "./vnd-input";
export function FindRequestForm({ token }: { token: string }) {
  const [submissionToken] = useState(token);
  const [state, action, pending] = useActionState(
    async (previous: M4State, form: FormData): Promise<M4State> => {
      try {
        return await submitFindRequest(previous, form);
      } catch {
        return {
          message:
            "Chưa kết nối được với shop. Thông tin vẫn được giữ; kiểm tra mạng rồi gửi lại.",
        };
      }
    },
    {} as M4State,
  );
  if (state.ok)
    return (
      <section className="info-panel request-success" role="status">
        <span className="badge">Đã gửi thành công</span>
        <h2>Shop đã nhận yêu cầu</h2>
        <p>
          Mã tiếp nhận: <strong>{state.reference}</strong>
        </p>
        <p>{state.message}</p>
        <p>
          Giờ tư vấn 08:00–22:00. Yêu cầu chưa phải đơn mua hàng và chưa giữ tồn
          kho.
        </p>
        <a className="button button-outline" href="/preorder">
          Gửi yêu cầu khác
        </a>
        <Link href="/">Về trang chủ</Link>
      </section>
    );
  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      className="m4-form"
    >
      <input type="hidden" name="token" value={submissionToken} />
      <div className="form-honeypot" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <fieldset disabled={pending}>
        <div className="order-form-grid">
          <label>
            Tên liên hệ
            <input
              name="customerName"
              required
              maxLength={120}
              autoComplete="name"
            />
          </label>
          <label>
            Số điện thoại / Zalo
            <input
              name="phone"
              required
              type="tel"
              maxLength={20}
              autoComplete="tel"
            />
          </label>
        </div>
        <div className="order-form-grid">
          <label>
            Bạn muốn tìm
            <select
              name="category"
              aria-label="Bạn muốn tìm"
              defaultValue="keycap"
            >
              <option value="keycap">Keycap</option>
              <option value="stab">Stabilizer</option>
            </select>
          </label>
          <label>
            Ngân sách dự kiến (VND)
            <VndInput
              name="budget"
              min={0}
              max={1000000000}
              required
              placeholder="Nhập 0 nếu chưa chốt"
            />
          </label>
        </div>
        <label>
          Ảnh mẫu
          <input
            name="image"
            aria-label="Ảnh mẫu"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
          <small>
            Ảnh JPEG/PNG/WebP tối đa 5 MB. Chỉ shop xem ảnh bạn gửi.
          </small>
        </label>
        <label>
          Link mẫu tham khảo
          <input
            type="url"
            name="referenceUrl"
            aria-label="Link mẫu tham khảo"
            maxLength={500}
            placeholder="https://…"
          />
          <small>
            Cần ít nhất một ảnh hoặc link mẫu. Shop không cam kết có hàng chỉ từ
            yêu cầu này.
          </small>
        </label>
        <label>
          Ghi chú về mẫu muốn tìm
          <textarea
            name="note"
            maxLength={2000}
            placeholder="Layout, profile, màu sắc, dòng bàn phím cần tương thích…"
          />
        </label>
        <label className="m4-check">
          <input type="checkbox" name="consent" required />
          <span>
            Tôi đồng ý để TRUMP Keys dùng thông tin này để liên hệ và xử lý yêu
            cầu đặt tìm.
          </span>
        </label>
        <Link href="/privacy" target="_blank" rel="noreferrer">Xem thông tin riêng tư (tab mới)</Link>
        <button
          className="button button-primary"
          aria-label="Gửi yêu cầu đặt tìm"
          type="submit"
        >
          {pending ? "Đang gửi…" : "Gửi yêu cầu đặt tìm"}
        </button>
      </fieldset>
      <FormError message={state.message} pending={pending} />
    </form>
  );
}
