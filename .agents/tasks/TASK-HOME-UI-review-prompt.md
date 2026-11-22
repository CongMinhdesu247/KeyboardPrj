# Review Request — TASK-HOME-UI (Vòng 2 — Độc lập bởi Codex Plus)

Đã xử lý finding MEDIUM vòng 1 (WCAG 2.2.2 Pause, Stop, Hide): thêm nút `Dừng hiệu ứng viền` / `Bật hiệu ứng viền` (`button type="button"`, `aria-pressed={ledPaused}`) trong `src/components/workshop.tsx` và quy tắc `[data-led-paused="true"]` trong `src/app/buyer.css` để tắt hoàn toàn animation trên viền LED, halo `::before` và `.preorder-led-dot` (giữ viền vàng tĩnh).

Hãy kiểm tra lại diff hiện tại ở chế độ **read-only** và trả về kết luận `APPROVED` hoặc `CHANGES_REQUESTED`.

Hãy đọc `AGENTS.md`, `.agents/rules/02-debate-protocol.md` và kiểm tra toàn bộ thay đổi UI của `TASK-HOME-UI` trong chế độ **read-only** (không sửa file):
- `src/components/workshop.tsx`
- `src/components/service-estimator.tsx`
- `src/components/portfolio-gallery.tsx`
- `src/app/buyer.css`
- `src/app/globals.css`

Chạy `git status` và `git diff -- src/components/workshop.tsx src/components/service-estimator.tsx src/components/portfolio-gallery.tsx src/app/buyer.css src/app/globals.css` để xem đầy đủ thay đổi.

## Tiêu chí phản biện
1. Thứ tự trang chủ: phần **Dịch vụ mod bàn phím** (`home-band-services` / `#services`) nằm phía trên phần **Sản phẩm & dịch vụ** (`home-shopping`), không làm gãy anchor `#services`, `#portfolio`, `#tracking`, `#contact`.
2. Lưới dịch vụ 5 thẻ: cân đối trên desktop (1440px), tablet (<=1050px) và mobile (375px), không tràn ngang, link "Xem bảng giá ↗" thẳng hàng đáy.
3. Khối **Chưa tìm thấy mẫu bạn cần?** (`.preorder-spotlight`): hiệu ứng dải LED vàng chuyển động bằng CSS `@property` + `conic-gradient`, có fallback/tắt animation cho `prefers-reduced-motion: reduce`, tương phản chữ rõ, không làm hỏng layout mobile 375px hoặc overflow ngang.
4. Lưới Portfolio (`.portfolio-grid`, `.portfolio-card`, `.portfolio-card-body`, `.portfolio-card-actions`): các thẻ trên cùng hàng có chiều cao bằng nhau, nút **Xem sound test ↗** / **Mở sound test** / iframe hoạt động bình thường trên cả trang chủ và `/portfolio`.
5. Không có lỗi CSS specificity conflict giữa `globals.css` và `buyer.css`, không vi phạm accessibility hoặc ràng buộc KeyboardPrj.

Trả về kết luận theo chuẩn:
- `APPROVED` hoặc `CHANGES_REQUESTED`
- Danh sách findings có bằng chứng `file:dòng` + mức độ (`CRITICAL`/`HIGH`/`MEDIUM`/`LOW`) và hướng sửa (nếu không có lỗi thật sự thì kết luận `APPROVED`, không bịa lỗi).
