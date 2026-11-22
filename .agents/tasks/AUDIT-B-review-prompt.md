# Audit Chỉ Đọc (Mảng B): Logic Vận Hành, Tiền VND, Tồn Kho & DB/RPC — KeyboardPrj

- **Vai trò:** Independent Backend & Domain Logic Auditor (Codex Plus, `-Mode Review`, read-only).
- **Mục tiêu:** Rà soát sâu mảng **(B) Logic vận hành & DB/RPC** của toàn bộ dự án KeyboardPrj. Chỉ báo cáo các finding **có bằng chứng thực tế trong mã nguồn** (`file:dòng`, mức độ `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`, tác động thực tế, đề xuất sửa). Không bịa lỗi; nếu một mục đúng chuẩn thì ghi rõ đã kiểm tra và đạt.
- **Ràng buộc tuyệt đối:** KHÔNG đọc hoặc trích xuất bất kỳ file `.env*`, key SSH, cookie thật, PII thật hay dữ liệu bí mật.

## Tài liệu quy chuẩn đối chiếu
- `AGENTS.md`
- `docs/REQUIREMENTS.md`, `docs/DATA-MODEL.md`, `docs/BANK-PAYMENT.md`, `docs/STOREFRONT.md`, `docs/M2-CATALOG.md`, `docs/M3-ORDERS.md`, `docs/M4-REQUESTS-PORTFOLIO.md`, `docs/M5-CHAT-NOTIFICATIONS.md`, `docs/M6-CASH-REPORTS.md`, `docs/M7-READINESS.md`

## Phạm vi file cần rà soát
1. **SQL Migrations & RPC Business Logic:**
   - Toàn bộ `supabase/migrations/*.sql`:
     - `order_command` (tạo đơn, cọc, COD, thanh toán, hủy, hoàn phần vượt cọc, trừ kho, snapshot, event log)
     - `adjust_inventory` (request UUID idempotency, movement, không âm)
     - `cash_report` (cash basis theo ngày xác nhận VN, SUM money string/BigInt, COD hiện tại không theo date filter, không cộng đơn hoàn thành/dự kiến COD vào thực thu)
     - Storefront checkout RPC (snapshot/giá/tồn kiểm ở DB, tồn chỉ trừ sau admin receipt, actor nullable chỉ cho event created)
     - Requests & Portfolio (không cọc/không đụng kho, publish có chủ đích, copy ảnh riêng)
     - Chat & Telegram Outbox (begin/finish lease, UUID lượt không gọi AI lại khi chưa biết kết quả, outbox trigger atomic, lease/fencing/backoff)
     - Customer accounts, profile, home banners, admin inbox
2. **Domain & Business Logic (`src/lib/`):**
   - `src/lib/domain.ts`, `src/lib/estimate.ts`, `src/lib/tracking.ts`, `src/lib/number-format.ts`
   - `src/lib/bank-payment.ts`, `src/lib/bank-transfer.ts`
   - `src/lib/cart.ts`, `src/lib/catalog-data.ts`, `src/lib/catalog-input.ts`, `src/lib/catalog-media.ts`, `src/lib/catalog-media-storage.ts`
   - `src/lib/order-contract.ts`, `src/lib/order-data.ts`, `src/lib/m4-contract.ts`, `src/lib/portfolio-data.ts`
   - `src/lib/chat-contract.ts`, `src/lib/notifications.ts`, `src/lib/integrations.ts`
   - `src/lib/report.ts`, `src/lib/admin-contract.ts`, `src/lib/inbox-contract.ts`, `src/lib/banner-contract.ts`, `src/lib/banner-crop.ts`, `src/lib/banner-data.ts`
3. **Server Actions Logic & Revalidation:**
   - `src/app/admin/**/actions.ts`, `src/app/checkout/actions.ts`, `src/app/chat/actions.ts`, `src/app/preorder/actions.ts`, `src/app/account/actions.ts`

## Checklist kiểm tra trọng tâm
- Tiền VND nguyên, không số âm, không tràn số/mất chính xác float; `cash_report` dùng string/BigInt cho SUM money.
- `order_command` là transaction duy nhất cho write đơn admin; không sửa ledger trực tiếp; tồn kho chỉ đổi qua `adjust_inventory` hoặc qua luồng xác nhận tiền trong `order_command`.
- Storefront checkout không bypass `order_command` admin, kiểm giá/tồn ở DB, không trừ tồn trước khi admin xác nhận nhận tiền.
- QR ngân hàng Agribank tạo offline từ snapshot server, dùng `payment_reference` riêng (không dùng tracking capability), không tự xác nhận thanh toán.
- Chat lease/budget recovery & Telegram outbox lease/fencing/backoff xử lý race condition, retry, lỗi mạng đúng chưa?
- `revalidatePath` sau mutations (ví dụ `/admin/team`, `/admin/orders`, `/admin/catalog`, `/shop`, ...).
- Edge cases về validation, concurrency, idempotency, error handling.

## Định dạng đầu ra
Trả về báo cáo Markdown tiếng Việt gồm:
1. Bảng Findings: `| Mức độ | Vị trí (file:dòng) | Mô tả & Bằng chứng | Tác động thực tế | Đề xuất sửa |`
2. Danh sách hạng mục đã kiểm tra và đạt (ngắn gọn).
3. Ghi rõ nếu sửa cần đổi schema/migration DB hoặc có trade-off nghiệp vụ chưa chốt.
