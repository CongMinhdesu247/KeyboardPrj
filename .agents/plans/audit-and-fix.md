# Plan: Sửa các lỗi có bằng chứng sau Audit toàn dự án

- **Slug:** `audit-and-fix`
- **Coordinator / Architect:** Gemini Pro
- **Tài liệu đối chiếu:** `AGENTS.md`, `docs/REQUIREMENTS.md`, `docs/DATA-MODEL.md`, `docs/ADMIN-UI.md`, `docs/M3-ORDERS.md`, `docs/M4-REQUESTS-PORTFOLIO.md`, `docs/M7-READINESS.md`, `.agents/reviews/AUDIT-FULL-PROJECT.md`

## 1. Mục tiêu & Phạm vi

- **Làm:**
  - Sửa 3 finding `MEDIUM` ở mảng (B) Backend/RPC/Actions (`AUDIT-B-1`, `AUDIT-B-2`, `AUDIT-B-3`) kèm test tự động xác nhận.
  - Sửa 1 finding `MEDIUM` và 5 finding `LOW` ở mảng (C) UI/Frontend (`AUDIT-C-1` .. `AUDIT-C-6`).
  - Phản biện chéo độc lập sau khi sửa (Codex sửa → `reviewer-critic` Gemini Pro review; `builder-frontend` Gemini Pro sửa → Codex `-Mode Review` review).
  - Chạy đầy đủ cổng chất lượng: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- **Không làm:**
  - Không đổi cấu trúc bảng DB (chỉ `CREATE OR REPLACE FUNCTION` để vá kiểm tra `version IS NULL` ở 2 RPC).
  - Không sửa `AUDIT-B-4` (admin inbox watermark vs loaded IDs) vì có trade-off ngữ nghĩa sản phẩm ("Đọc tất cả" vs "Đọc các mục đã tải") — báo cáo rõ để chủ dự án quyết định.
  - Không reset DB local có admin, không đụng cổng 8090–8093, không chạy `down -v`/`prune`.

## 2. Khảo sát hiện trạng

Xem chi tiết bằng chứng `file:dòng` tại `.agents/reviews/AUDIT-FULL-PROJECT.md`.

## 3. Thiết kế & Rủi ro

- **Schema / RPC (`TASK-FIX-BE`):**
  - Tạo migration mới `supabase/migrations/20261122090000_fix_rpc_version_null_guards.sql` chỉ chứa `CREATE OR REPLACE FUNCTION` cho:
    1. `public.portfolio_command(p jsonb)` (từ `20261119132910_requests_portfolio.sql`): bắt buộc `pv IS NOT NULL AND pv >= 1` khi action không phải `create`, và so sánh `old.version IS DISTINCT FROM pv` (tránh bypass optimistic locking khi `version` thiếu hoặc `NULL`). Giữ nguyên toàn bộ logic, `SECURITY DEFINER`, `SET search_path = ''`, grants và quyền kiểm admin.
    2. `public.manage_account(...)` (từ `20261120050333_customer_accounts.sql`): từ chối `p_version IS NULL OR p_version < 1` trước khi xử lý và so sánh `old.version IS DISTINCT FROM p_version`. Giữ nguyên toàn bộ logic, `SECURITY DEFINER`, `SET search_path = ''`, grants và kiểm admin.
  - Không thay đổi cấu trúc bảng, không đổi API contract hợp lệ. Lưu ý: sau khi merge cần chạy `supabase migration up` trên môi trường local/deploy (không reset DB).
- **Idempotency tải ảnh đơn (`TASK-FIX-BE`):**
  - Trong `src/app/admin/orders/actions.ts`: thay vì `randomUUID()` cho path upload `order-media`, tạo path tất định theo `request_id` và SHA-256 của buffer đã chuẩn hóa (ví dụ `${orderId}/${requestId}-${sha256.slice(0, 16)}.${extension}`).
  - Upload với `upsert: false`; nếu Storage báo object đã tồn tại (409 / `already exists` / `Duplicate`), đánh dấu `reusedExisting = true` và tiếp tục gọi `order_command` với đúng path đó.
  - Khi RPC trả lỗi ứng dụng (`!result.error` và `!data?.ok`), **chỉ** gọi `storage.remove([uploaded])` nếu `!reusedExisting`, bảo toàn tuyệt đối nguyên tắc không bao giờ xóa bằng chứng đã commit.
- **UI / React 19 / Accessibility (`TASK-FIX-UI`):**
  - `src/components/account-controls.tsx`: chặn reset form khi lỗi server (dùng controlled state cho `reason`/`confirm` hoặc `onReset` + reset sạch state & ẩn lỗi cũ khi mở dialog mới cho thao tác khác).
  - `src/app/account/page.tsx` & `src/components/profile-form.tsx`: chỉ truyền DTO `{ email, name, phone, address, version }`.
  - `src/app/admin/notifications/page.tsx` & `src/app/globals.css`: định kiểu `.admin-recent-list > div` đồng bộ `.admin-recent-list > a` và Việt hóa `last_error` (`network` → `Lỗi mạng`, `provider` → `Lỗi nhà cung cấp`, `rate_limit` → `Vượt giới hạn gửi`).
  - `src/app/buyer.css` & `src/app/globals.css`: `font-size: 16px` cho `.buyer-catalog-sidebar .store-search input` và `.cart-row input` trên mobile; `min-height: 44px` cho `.remove-button` và `.cart-remove`.
  - `src/app/admin/catalog/[id]/page.tsx`: cập nhật copy M2 cũ thành mô tả đúng M3 hiện tại.
  - `src/app/admin/readiness/page.tsx`: sửa 3 lỗi dính chữ `cọc 20% hoặc 100%`, `ghi 80%`, `cổng 8094`.

## 4. Phân chia Task & File Ownership (Không chồng chéo — Chạy song song 2 worker)

| Task ID | Mô tả | Model giao | Owned Files (không trùng) | Thứ tự / Phụ thuộc |
| --- | --- | --- | --- | --- |
| `TASK-FIX-BE` | Vá version NULL guard (portfolio & manage_account), idempotent retry ảnh đơn + tests | Codex Plus (`-Mode Implement`) | `supabase/migrations/20261122090000_fix_rpc_version_null_guards.sql`, `src/app/admin/orders/actions.ts`, `tests/audit-fixes.test.ts` | Song song với `TASK-FIX-UI` |
| `TASK-FIX-UI` | Vá `account-controls` React 19 dialog, DTO `/account`, notifications UI/copy, mobile 375px CSS, copy catalog/readiness | `builder-frontend` (Gemini Pro) | `src/components/account-controls.tsx`, `src/components/profile-form.tsx`, `src/app/account/page.tsx`, `src/app/admin/notifications/page.tsx`, `src/app/admin/catalog/[id]/page.tsx`, `src/app/admin/readiness/page.tsx`, `src/app/buyer.css`, `src/app/globals.css` | Song song với `TASK-FIX-BE` |

## 5. Tiêu chí nghiệm thu & Kiểm tra

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test` (bao gồm các test mới trong `tests/audit-fixes.test.ts`)
- [ ] `npm run build`
- [ ] Phản biện chéo `TASK-FIX-BE` (Codex sửa → `reviewer-critic` Gemini Pro review) đạt `APPROVED`
- [ ] Phản biện chéo `TASK-FIX-UI` (`builder-frontend` Gemini Pro sửa → Codex `-Mode Review` review) đạt `APPROVED`
