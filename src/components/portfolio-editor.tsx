"use client";
import { useActionState } from "react";
import { savePortfolio, archivePortfolio } from "@/app/admin/portfolio/actions";
import type { PortfolioItem, M4State } from "@/lib/m4-contract";
export function PortfolioEditor({
  id,
  item,
  imageUrl,
  sourceOrder = "",
  sourceEvent = "",
}: {
  id: string;
  item?: PortfolioItem;
  imageUrl?: string;
  sourceOrder?: string;
  sourceEvent?: string;
}) {
  const [state, action, pending] = useActionState(savePortfolio, {} as M4State);
  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      className="m4-form"
    >
      <input name="id" type="hidden" value={id} />
      <input name="version" type="hidden" value={item?.version ?? 0} />
      <input name="sourceOrder" type="hidden" value={sourceOrder} />
      <input name="sourceEvent" type="hidden" value={sourceEvent} />
      <fieldset disabled={pending || state.ok}>
        <label>
          Tên bài portfolio
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={item?.title}
          />
        </label>
        <label>
          Bàn phím / cấu hình
          <input
            name="keyboard"
            required
            maxLength={200}
            defaultValue={item?.keyboard}
          />
        </label>
        <label>
          Các hạng mục mod
          <textarea name="mods" maxLength={2000} defaultValue={item?.mods} />
        </label>
        <label>
          Mô tả
          <textarea
            name="description"
            maxLength={2000}
            defaultValue={item?.description}
          />
        </label>
        <label>
          Link sound test YouTube / TikTok
          <input
            name="videoUrl"
            type="url"
            maxLength={500}
            defaultValue={item?.video_url}
          />
        </label>
        {imageUrl && (
          <div className="m4-image-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Ảnh đã chọn cho portfolio" />
          </div>
        )}
        {sourceOrder && (
          <p className="admin-note">
            Đã chọn ảnh từ đơn. Khi lưu sẽ tạo một bản riêng cho portfolio,
            không đổi ảnh gốc hay tự đăng các ảnh khác.
          </p>
        )}
        <label>
          {imageUrl ? "Thay ảnh portfolio" : "Ảnh portfolio"}
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
          />
          <small>
            Ảnh tối đa 5 MB. Bản nháp được phép chưa có ảnh; công khai cần có
            ảnh.
          </small>
        </label>
        <label className="m4-check">
          <input
            type="checkbox"
            name="published"
            defaultChecked={item?.published}
          />
          <span>Công khai trên website</span>
        </label>
        <label className="m4-check">
          <input type="checkbox" name="approved" />
          <span>
            Tôi đã kiểm tra quyền sử dụng ảnh/video và bảo đảm không có SĐT, địa
            chỉ hoặc thông tin riêng tư của khách trong nội dung công khai.
          </span>
        </label>
        <button className="button button-primary" aria-label="Lưu portfolio">
          {pending ? "Đang lưu…" : "Lưu portfolio"}
        </button>
      </fieldset>
      {state.message && (
        <p role="status">
          {state.message}
          {state.ok && " Tải lại trang trước khi sửa tiếp."}
        </p>
      )}
    </form>
  );
}
export function ArchivePortfolioForm({ item }: { item: PortfolioItem }) {
  const [state, action, pending] = useActionState(
    archivePortfolio,
    {} as M4State,
  );
  return (
    <details className="admin-danger">
      <summary>Lưu trữ bài portfolio</summary>
      <p>
        Bài sẽ ngừng công khai. Không xóa ảnh gốc trong đơn hoặc yêu cầu khách.
      </p>
      <form action={action}>
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="version" value={item.version} />
        <button className="button button-outline" disabled={pending}>
          Xác nhận lưu trữ bài
        </button>
        {state.message && <p role="status">{state.message}</p>}
      </form>
    </details>
  );
}
