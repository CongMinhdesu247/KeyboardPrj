# Báo cáo Audit Toàn Diện — KeyboardPrj (TRUMP Keys)

- **Ngày thực hiện:** 2026-11-22
- **Coordinator:** Gemini Pro
- **Baseline trước Audit:** `npm run lint` (0), `npm run typecheck` (0), `npm test` (87/87 pass), `npm run build` (0).
- **Bảo mật dữ liệu:** Không đọc hay trích xuất `.env*`, service role key, cookie thật, PII thật hay SSH key.

## 1. Tóm tắt theo 3 mảng

| Mảng | Auditor / Model | Phạm vi | Findings |
| --- | --- | --- | --- |
| **(A) Bảo mật & RLS/Auth** | Codex Plus (`-Mode Review`, read-only) | 53 file auth/proxy/actions/lib + 21 migrations (PGlite 23/23 private tables RLS, 67/67 tests) | **0 findings** |
| **(B) Logic vận hành & DB/RPC** | Codex Plus (`-Mode Review`, read-only) | 70 file (21 migrations, 24 lib, 13 actions, 12 docs; 76/76 tests + PGlite probes) | **4 `MEDIUM`** |
| **(C) Giao diện Next.js / React 19 & Tích hợp** | `reviewer-critic` (Gemini Pro, read-only) | `src/app/**`, `src/components/**`, `public/sw.js`, `globals.css`, `buyer.css` | **1 `MEDIUM`**, **5 `LOW`** |

- **CRITICAL:** 0
- **HIGH:** 0
- **MEDIUM:** 5
- **LOW:** 5

---

## 2. Tổng hợp Findings có bằng chứng

| ID | Mức độ | Mảng | Vị trí (`file:dòng`) | Mô tả & Bằng chứng | Tác động thực tế | Hướng xử lý |
| --- | --- | --- | --- | --- | --- | --- |
| `AUDIT-B-1` | `MEDIUM` | B | `supabase/migrations/20261119132910_requests_portfolio.sql:79,84,93` | `pv` trở thành SQL `NULL` khi payload thiếu `version`; biểu thức `old.version <> pv` không trả `true` nên không chặn update/publish/hide/archive. Probe PGlite xác nhận gọi lại không có `version` trả `ok:true` và ghi đè tiêu đề. | Admin gọi RPC trực tiếp có thể bỏ qua optimistic locking. | **Sửa ngay** trong migration function-only mới (`CREATE OR REPLACE FUNCTION`, không đổi bảng): bắt buộc `pv IS NOT NULL AND pv >= 1` và so sánh `IS DISTINCT FROM`. |
| `AUDIT-B-2` | `MEDIUM` | B | `supabase/migrations/20261120050333_customer_accounts.sql:97` | `manage_account` bỏ qua kiểm tra phiên bản khi `p_version IS NULL` (`old.version <> p_version` cho NULL). Probe PGlite: `manage_account(customer, NULL, 'ban', reason)` trả `ok:true`, đổi trạng thái thành `banned` và tăng version lên 2. | Bỏ qua chống xung đột khi cấm/bỏ cấm/xóa tài khoản (vẫn yêu cầu quyền admin). | **Sửa ngay** trong migration function-only mới (`CREATE OR REPLACE FUNCTION`, không đổi bảng): từ chối `p_version IS NULL OR p_version < 1` và dùng `IS DISTINCT FROM`. |
| `AUDIT-B-3` | `MEDIUM` | B | `src/app/admin/orders/actions.ts:151,166-178`; `supabase/migrations/20261119045002_order_validation_fix.sql:13` | Gửi lại ảnh/video đơn sau khi mất phản hồi đúng lúc commit không idempotent vì mỗi lần action tạo `randomUUID()` path mới; `order_command` so sánh toàn bộ payload (chỉ bỏ `code`) nên trả `request_conflict`. | Admin gửi lại form ảnh cùng request ID sau lỗi mạng bị từ chối, có nguy cơ tạo request mới gây trùng bằng chứng. | **Sửa ngay** trong `src/app/admin/orders/actions.ts`: tạo Storage path tất định theo `request_id` + SHA-256 nội dung file; nếu object đã tồn tại thì tái sử dụng và tuyệt đối không xóa object đã tồn tại sẵn khi lỗi. |
| `AUDIT-B-4` | `MEDIUM` | B | `supabase/migrations/20261119144326_chat_telegram.sql:25`; `supabase/migrations/20261120102139_admin_inbox.sql:24,48-50` | Outbox dùng `created_at DEFAULT now()` (thời điểm bắt đầu transaction), inbox dùng `statement_timestamp()` làm watermark. Transaction bắt đầu trước khi tải feed nhưng commit sau đó sẽ có `created_at <= watermark`, nên thao tác "Đọc tất cả" sau commit có thể đánh dấu đã đọc thông báo chưa từng hiện trên màn hình. | Trong tình huống cạnh tranh transaction hiếm gặp, admin có thể bị đánh dấu đã đọc nhầm thông báo mới. | **Hoãn — Trade-off nghiệp vụ:** Đổi "Đọc tất cả" thành chỉ đánh dấu các ID đã tải làm thay đổi ngữ nghĩa khi có nhiều hơn 1 trang thông báo; giữ nguyên và báo cáo để chủ dự án quyết định. |
| `AUDIT-C-1` | `MEDIUM` | C | `src/components/account-controls.tsx:11-12` | `<form action={action}>` trong `<dialog className="account-dialog">` thiếu `onReset={(e) => e.preventDefault()}`; React 19 tự reset form khi action trả lỗi server (mất lý do & checkbox). Ngoài ra `result.message` cũ còn tồn đọng khi đóng dialog và mở thao tác khác. | Admin mất nội dung lý do vừa nhập khi gặp lỗi validation/conflict, và thấy lỗi cũ khi chuyển sang thao tác khác. | **Sửa ngay** trong `src/components/account-controls.tsx`: chặn reset form khi có lỗi hoặc dùng controlled state, và xóa thông báo lỗi cũ khi mở dialog cho thao tác mới. |
| `AUDIT-C-2` | `LOW` | C | `src/app/buyer.css:685`; `src/app/globals.css:751,3074,3087` | Mobile `375px`: `.buyer-catalog-sidebar .store-search input` (`15px`) và `.cart-row input` (`14px`) nhỏ hơn `16px` (gây auto-zoom trên iOS Safari). `.remove-button` (`min-height: 36px`) và `.cart-remove` (`padding: 10px 0`) dưới chuẩn chạm `44px`. | Trải nghiệm chạm/nhập trên điện thoại 375px chưa tối ưu. | **Sửa ngay** trong `src/app/buyer.css` và `src/app/globals.css`. |
| `AUDIT-C-3` | `LOW` | C | `src/app/account/page.tsx:8`; `src/components/profile-form.tsx:8-27` | Truyền toàn bộ đối tượng `Account` (`id`, `role`, `status`) xuống Client Component `ProfileForm` dù chỉ cần `{ email, name, phone, address, version }`. | Không rò sang guest (đã có `requireCustomerAccount`), nhưng dư thừa field ở Server/Client boundary. | **Sửa ngay** trong `src/app/account/page.tsx` và `src/components/profile-form.tsx`: thu hẹp prop DTO tối giản. |
| `AUDIT-C-4` | `LOW` | C | `src/app/admin/notifications/page.tsx:87-105`; `src/app/globals.css:1729-1743` | `.admin-recent-list` chỉ định kiểu `> a`, không áp dụng cho `> div` ở `/admin/notifications` khiến 2 `<span>` dính liền; `last_error` hiển thị raw enum tiếng Anh (`network`, `provider`, `rate_limit`). | Khó đọc danh sách log thông báo và lộ enum tiếng Anh thô cho admin. | **Sửa ngay** trong `src/app/admin/notifications/page.tsx` và `src/app/globals.css`. |
| `AUDIT-C-5` | `LOW` | C | `src/app/admin/catalog/[id]/page.tsx:67` | Copy cũ từ M2: `"100 lần gần nhất. Giữ/trừ hàng theo tiền cọc sẽ được nối ở M3."`. | Gây hiểu nhầm cho admin vì M3 đã trừ kho tự động khi xác nhận tiền thực nhận. | **Sửa ngay** trong `src/app/admin/catalog/[id]/page.tsx`. |
| `AUDIT-C-6` | `LOW` | C | `src/app/admin/readiness/page.tsx:161,168,193` | Lỗi dính chữ với số: `cọc20% hoặc100%`, `ghi80%`, `cổng8094`. | Giảm tính chỉn chu tiếng Việt. | **Sửa ngay** trong `src/app/admin/readiness/page.tsx`. |

---

## 3. Các hạng mục cốt lõi đã kiểm tra & đạt chuẩn

- **Auth, RLS & Fail-closed:** `requireAdmin()` + `private.is_admin()` kiểm Google identity, live session, membership; 23/23 bảng private bật RLS, 0 grant trực tiếp cho `anon`/`authenticated`; `SECURITY DEFINER` đặt `search_path=''`; không có open redirect hay IDOR ở `/account`, `/chat`, `/track`.
- **Tiền VND, Tồn kho & Báo cáo:** Tiền VND nguyên không âm, cọc `(total+4)/5`, `order_command` & `adjust_inventory` khóa hàng và giao dịch nguyên tử; `cash_report` dùng cash basis theo ngày VN, SUM dạng string/BigInt, tách COD hiện tại.
- **QR Agribank vs QR tra cứu:** Tách biệt rõ giữa QR tra cứu (`Link & QR`) và QR chuyển khoản Agribank (`Thanh toán` & trang khách), dùng `payment_reference` riêng, không chứa tracking capability, không tự xác nhận thanh toán.
- **Storefront, Cart, Admin UI & SW:** `localStorage` giỏ hàng chỉ lưu `{ itemId, quantity, expectedPrice }`; tab chi tiết đơn hỗ trợ bàn phím và giữ state form (`hidden`); menu khách ẩn hoàn toàn trong `/admin`; `public/sw.js` chỉ precache `/offline.html`, không cache route nhạy cảm.

## 4. Nguồn báo cáo chi tiết
- AUDIT-A (Codex Plus): `.agents/runs/20261122-152927-review-32816e89653c4ce19db9a7c3838c2d4b.md`
- AUDIT-B (Codex Plus): `.agents/runs/20261122-153422-review-eaf89da36c804f7e9bd5e400a38a9df9.md`
- AUDIT-C (`reviewer-critic` Gemini Pro): Subagent conversation `fa094576-3765-4256-9044-0b8676099ac9`
