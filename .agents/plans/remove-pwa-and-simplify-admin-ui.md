# Plan: Xóa nút Cài ứng dụng & Tinh gọn giao diện quản trị Admin

## Mục tiêu
1. **Xóa ô "Cài ứng dụng" (`↓ Cài ứng dụng`) ở cuối trang**: bỏ hoàn toàn nút cài PWA ở footer (`src/app/layout.tsx`), xóa component `src/components/pwa-install.tsx` và các rule CSS `.install-control`/`.install-button`/`.install-message` không còn dùng.
2. **Tinh gọn & nâng cấp thiết kế giao diện khu vực quản trị (`/admin/**`)**: giảm nhiễu thông tin, ưu tiên công việc hằng ngày lên đầu, nhóm gọn điều hướng sidebar, giữ nguyên 100% logic/quyền/RPC và tương thích hoàn toàn với các script kiểm thử cục bộ (`verify-m3-local`, `verify-accounts-local`, `verify-inbox-local`).

## Lý do xóa file
- `src/components/pwa-install.tsx`: chỉ phục vụ nút "Cài ứng dụng" ở footer; người dùng yêu cầu xóa vì đây là web thuần, không cần cài ứng dụng.

## Phạm vi thay đổi & File Ownership (`TASK-ADMIN-UI`)
- **Owner:** Gemini Pro (Coordinator / Frontend UI)
- **Reviewer đối trọng:** Codex Plus (`-Mode Review`)
- **Files:**
  - `src/app/layout.tsx` (xóa import và render `<PwaInstall />`)
  - `src/components/pwa-install.tsx` (xóa file)
  - `src/app/buyer.css` (xóa CSS `.buyer-footer-bottom .install-*`)
  - `src/components/admin-navigation.tsx` (rút gọn 13 mục phẳng → 2 nhóm chính `Công việc` (4) + `Cửa hàng` (4) + nhóm thu gọn `Hệ thống` (4); bỏ trùng `Thông báo cửa hàng` vì đã có chuông thông báo trên toolbar)
  - `src/app/admin/page.tsx` (đưa tổng quan đơn hàng + đơn gần đây + cần chú ý lên đầu; chuyển thống kê tài khoản xuống khối phụ bên dưới; bỏ khối nhắc thủ công lặp lại; thêm CTA `Tạo đơn mới` ở header)
  - `src/components/account-kpis.tsx` (rút gọn chú thích dài trên 4 thẻ KPI, giữ nguyên cấu trúc `.dashboard-kpis > div`)
  - `src/components/account-growth.tsx` (tinh gọn tiêu đề/ghi chú dài, giữ nguyên tương tác 7/30/90/365 ngày, Cách xem, bảng số liệu và keyboard tooltip)
  - `src/app/admin/orders/page.tsx` (lược bỏ câu mô tả thừa ở header, giữ nguyên filter/search/table)
  - `src/app/admin/catalog/page.tsx` (lược bỏ dòng trợ giúp thừa, giữ nguyên lọc/card/phiếu kho)
  - `src/app/globals.css` (xóa `.install-*`; nâng cấp hệ thống style `.admin-*` gọn, thoáng, độ tương phản rõ, hỗ trợ `.admin-nav-more` và responsive 375px/768px/1440px không tràn ngang)

## Tiêu chí nghiệm thu
- Không còn nút/chữ "Cài ứng dụng" ở footer hay bất kỳ trang nào.
- Sidebar admin gọn (8 mục chính + 1 mục thu gọn `Hệ thống`), nhóm `.admin-nav-daily` vẫn giữ đủ 4 link `/admin`, `/admin/orders`, `/admin/catalog`, `/admin/reports` vừa khít 375px.
- `/admin` hiển thị công việc đơn hàng & cần chú ý trước, thống kê tài khoản nằm gọn bên dưới; vẫn giữ đầy đủ `Tổng quan cửa hàng`, `.dashboard-kpis > div` (4 thẻ), `.growth-chart svg`, nút 7/30/90/365 ngày và bảng số liệu.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` đều PASS.
- Review độc lập bởi Codex Plus đạt `APPROVED`.
