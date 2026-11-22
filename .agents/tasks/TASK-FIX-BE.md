# Task: TASK-FIX-BE — Vá version NULL guard ở RPC & idempotency retry ảnh đơn

- **Plan:** `.agents/plans/audit-and-fix.md`
- **Owner / Model:** Codex Plus (`-Mode Implement`)
- **Mode:** `Implement`
- **Depends On:** `none`

## 1. Mục tiêu

Khắc phục 3 lỗi `MEDIUM` có bằng chứng từ `AUDIT-B` (`AUDIT-B-1`, `AUDIT-B-2`, `AUDIT-B-3`) và bổ sung kiểm thử tự động chứng minh cả 3 lỗi đã được vá triệt để.

## 2. Ngữ cảnh & Vị trí đã khoanh vùng

1. **`AUDIT-B-1` — `supabase/migrations/20261119132910_requests_portfolio.sql:79,84,93`**:
   - Trong `public.portfolio_command(p jsonb)`, khi payload thiếu `version` hoặc `version` là `null`, `pv` trở thành `NULL` và `old.version <> pv` không trả `true`, bỏ qua optimistic locking.
   - Đọc kỹ định nghĩa mới nhất của `portfolio_command` qua toàn bộ `supabase/migrations/*.sql` để không làm mất bất kỳ sửa đổi nào từ các migration sau đó.
2. **`AUDIT-B-2` — `supabase/migrations/20261120050333_customer_accounts.sql:97`**:
   - Trong `public.manage_account(...)`, khi `p_version` là `NULL`, kiểm tra phiên bản bị bỏ qua (`old.version <> p_version` cho `NULL`), cho phép cấm/bỏ cấm/xóa tài khoản mà không khớp version.
   - Đọc kỹ định nghĩa mới nhất của `manage_account` qua toàn bộ `supabase/migrations/*.sql` để không làm mất bất kỳ sửa đổi nào từ các migration sau đó.
3. **`AUDIT-B-3` — `src/app/admin/orders/actions.ts:151,166-178`**:
   - Khi tải ảnh/video đơn, mỗi lần gọi action tạo `uploaded = ${orderId}/${randomUUID()}.${extension}`. Nếu request đã commit ở DB nhưng mất phản hồi mạng, admin gửi lại form với cùng `request_id` sẽ sinh path mới và bị `order_command` từ chối `request_conflict`.
   - Đổi sang path tất định dựa trên `requestId` (đã validate UUID ở action) và SHA-256 nội dung file sau khi xử lý (ví dụ `${orderId}/${requestId}-${contentHash.slice(0, 16)}.${extension}`).
   - Upload với `upsert: false`; nếu Storage trả lỗi đã tồn tại (409 / `already exists` / `Duplicate` — kiểm tra kỹ thuộc tính `statusCode` và `message` của Supabase Storage error), đánh dấu `reusedExisting = true` và tiếp tục gọi `order_command` với đúng path đó.
   - Khi `order_command` thất bại (`result.error || !data?.ok || !data.id`): giữ nguyên nguyên tắc không xóa khi `result.error` (lỗi transport/mất phản hồi), VÀ **không xóa** khi `reusedExisting === true` (file đã tồn tại từ trước có thể thuộc request đã commit).

## 3. Phạm vi file được phép sửa (Ownership)

- `supabase/migrations/20261122090000_fix_rpc_version_null_guards.sql` *(tạo mới — chỉ `CREATE OR REPLACE FUNCTION`, không đổi bảng)*
- `src/app/admin/orders/actions.ts`
- `tests/audit-fixes.test.ts` *(tạo mới — kiểm thử PGlite cho `portfolio_command` version NULL/invalid, `manage_account` version NULL/invalid, và helper/logic path tất định cho media retry)*

*(Không sửa bất kỳ file nào ngoài 3 file này. Không sửa các file migration cũ. Không chạy `npm run build` trong bước này để tránh xung đột `.next/` với worker song song.)*

## 4. Ràng buộc KeyboardPrj cần tuân thủ

- Tuân thủ `AGENTS.md`: giữ nguyên `SECURITY DEFINER`, `SET search_path = ''`, kiểm tra `private.is_admin()`, grants/revokes nguyên trạng.
- Không đọc `.env*`, không reset DB, không sửa ledger trực tiếp, không bypass `order_command`.
- Code, tên biến, tên test tiếng Anh; thông báo người dùng tiếng Việt rõ ràng.

## 5. Acceptance Criteria

- [ ] `portfolio_command` từ chối mọi thao tác update/publish/hide/archive khi thiếu `version`, `version` là `null`, `< 1`, hoặc sai kiểu/không khớp `old.version` (dùng `IS DISTINCT FROM`), trả mã lỗi nhất quán (`version_conflict` hoặc `invalid_input` phù hợp contract hiện có) và không thay đổi dữ liệu.
- [ ] `manage_account` từ chối khi `p_version IS NULL` hoặc `p_version < 1` (trước nhánh idempotency/update) và kiểm tra `IS DISTINCT FROM`, không thay đổi trạng thái hay tăng version.
- [ ] `src/app/admin/orders/actions.ts` tạo Storage path tất định từ `request_id` + SHA-256 nội dung file; nếu object đã tồn tại thì tái sử dụng an toàn và không bao giờ xóa object đã tồn tại sẵn khi gặp lỗi.
- [ ] `tests/audit-fixes.test.ts` kiểm chứng cả 3 điểm trên và pass 100%.

## 6. Lệnh kiểm tra bắt buộc (không chạy `next build`)

```powershell
node --experimental-strip-types --test --test-isolation=none tests/audit-fixes.test.ts
```

## 7. Yêu cầu báo cáo

Trả về: danh sách file đã tạo/sửa, tóm tắt thay đổi kèm `file:dòng`, lệnh kiểm tra + kết quả thực tế, và rủi ro/lưu ý (nếu có). Không tự duyệt `APPROVED`.
