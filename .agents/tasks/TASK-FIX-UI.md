# Task: TASK-FIX-UI — Vá lỗi React 19 dialog, DTO `/account`, notifications UI, mobile 375px CSS & copy admin

- **Plan:** `.agents/plans/audit-and-fix.md`
- **Owner / Model:** `builder-frontend` (Gemini Pro)
- **Mode:** `Implement`
- **Depends On:** `none`

## 1. Mục tiêu

Khắc phục 1 lỗi `MEDIUM` (`AUDIT-C-1`) và 5 lỗi `LOW` (`AUDIT-C-2` .. `AUDIT-C-6`) từ báo cáo `AUDIT-C` trong `.agents/reviews/AUDIT-FULL-PROJECT.md`.

## 2. Ngữ cảnh & Chi tiết cần sửa

1. **`AUDIT-C-1` (`MEDIUM`) — `src/components/account-controls.tsx`**:
   - Hiện tại `<form action={action}>` dùng uncontrolled `<textarea name="reason">` và `<input type="checkbox" name="confirm">` nên khi `manageAccount` trả lỗi phía server, React 19 tự động reset form làm mất nội dung admin vừa nhập.
   - Đồng thời `result.message` cũ vẫn hiển thị khi admin đóng dialog rồi mở thao tác khác (ví dụ từ "Cấm" sang "Xóa").
   - Cách sửa: dùng controlled state cho `reason` và `confirm` (hoặc `onReset={(e) => e.preventDefault()}` + giữ state), đồng thời theo dõi trạng thái mở dialog mới (ví dụ biến `dismissedError` hoặc `attempt` reset khi gọi `open(value)` để không hiện `result.message` cũ của lần mở trước; khi `result` mới trả về từ submit thì hiển thị lại bình thường). Giữ nguyên hành vi đóng dialog khi `result.ok`, hỗ trợ phím `Escape` của native `<dialog>` và trả focus hợp lý khi đóng.
2. **`AUDIT-C-2` (`LOW`) — `src/app/buyer.css` & `src/app/globals.css`**:
   - Đặt `font-size: 16px` cho `.buyer-catalog-sidebar .store-search input` (ít nhất trong `@media (max-width: 767px)`) và `.cart-row input` (trong `@media (max-width: 700px)` hoặc trực tiếp) để tránh auto-zoom trên iOS Safari 375px.
   - Đặt `min-height: 44px` cho `.remove-button` và `.cart-remove` để đảm bảo chuẩn vùng chạm trên mobile.
3. **`AUDIT-C-3` (`LOW`) — `src/app/account/page.tsx` & `src/components/profile-form.tsx`**:
   - Thu hẹp prop truyền từ `AccountPage` xuống `ProfileForm` chỉ gồm `{ email, name, phone, address, version }` (không truyền `id`, `role`, `status`).
4. **`AUDIT-C-4` (`LOW`) — `src/app/admin/notifications/page.tsx` & `src/app/globals.css`**:
   - Trong `src/app/globals.css`, mở rộng rule `.admin-recent-list > a` thành `.admin-recent-list > a, .admin-recent-list > div` (hoặc thêm rule tương đương có `display: flex; justify-content: space-between; gap: 12px; padding; border-top` và responsive 375px) để danh sách 20 thông báo gần nhất ở `/admin/notifications` hiển thị gọn, không dính chữ.
   - Trong `src/app/admin/notifications/page.tsx`, map `n.last_error` sang nhãn tiếng Việt (`network` → `"Lỗi mạng"`, `provider` → `"Lỗi nhà cung cấp"`, `rate_limit` → `"Vượt giới hạn gửi"`, giá trị khác → `"Lỗi gửi"`).
5. **`AUDIT-C-5` (`LOW`) — `src/app/admin/catalog/[id]/page.tsx:67`**:
   - Đổi copy cũ `"100 lần gần nhất. Giữ/trừ hàng theo tiền cọc sẽ được nối ở M3."` thành `"100 lần gần nhất. Tồn kho được trừ tự động khi xác nhận tiền thực nhận của đơn hàng."`.
6. **`AUDIT-C-6` (`LOW`) — `src/app/admin/readiness/page.tsx:161,168,193`**:
   - Sửa lỗi dính chữ thành: `cọc 20% hoặc 100%`, `ghi 80%`, `cổng 8094`.

## 3. Phạm vi file được phép sửa (Ownership)

- `src/components/account-controls.tsx`
- `src/components/profile-form.tsx`
- `src/app/account/page.tsx`
- `src/app/admin/notifications/page.tsx`
- `src/app/admin/catalog/[id]/page.tsx`
- `src/app/admin/readiness/page.tsx`
- `src/app/buyer.css`
- `src/app/globals.css`

*(Tuyệt đối không sửa file ngoài danh sách này. Không chạy `npm run build` trong worker để tránh xung đột `.next/` với worker song song — Coordinator sẽ chạy đầy đủ kiểm tra sau khi cả 2 worker hoàn tất.)*

## 4. Ràng buộc KeyboardPrj cần tuân thủ

- Giao diện tiếng Việt tự nhiên, responsive 375px/1440px, focus-visible rõ ràng, giữ Escape/keyboard trong dialog.
- Không thêm dependency mới, không rò rỉ dữ liệu nhạy cảm sang Client Component.

## 5. Acceptance Criteria

- [ ] `account-controls.tsx` giữ nguyên `reason` và `confirm` khi server trả lỗi; ẩn lỗi cũ khi đóng và mở dialog cho thao tác khác; tự đóng dialog khi `result.ok`.
- [ ] Mobile 375px: ô tìm kiếm `/shop` và ô số lượng `/cart` đạt `font-size: 16px`; `.remove-button` và `.cart-remove` đạt `min-height: 44px`.
- [ ] `ProfileForm` chỉ nhận `{ email, name, phone, address, version }`.
- [ ] `/admin/notifications` hiển thị từng dòng tách biệt rõ ràng và `last_error` hoàn toàn tiếng Việt.
- [ ] Copy ở `/admin/catalog/[id]` và `/admin/readiness` chính xác, không còn câu M2 cũ hay dính chữ.

## 6. Yêu cầu báo cáo

Trả về danh sách file đã sửa kèm `file:dòng` tóm tắt thay đổi. Không tự duyệt `APPROVED`.
