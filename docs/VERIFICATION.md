# Kiểm tra bản nền M0

> M2 cập nhật: xem [M2-CATALOG.md](M2-CATALOG.md). 17 unit/SQL tests, 9 nhóm API integration M1/M2 và luồng browser tạo/ảnh/stock/estimate/sửa/ẩn/archive/logout đã đạt trên local. Dữ liệu kiểm thử được cleanup; còn 8 gói lube nháp không giá. Không thay dữ liệu/tài khoản thật hoặc HP.

> Báo cáo bên dưới là lịch sử M0. Cập nhật M1: lint, typecheck, production build và 16 tests (gồm các subtests SQL) đạt. Đã chạy migration/seed bằng PostgreSQL PGlite; chưa chạy stack Supabase thật. Browser kiểm trên dev server có sẵn tại localhost:3000, desktop 1440×1000/mobile 375×812: login chưa cấu hình hiển thị đúng, không tràn ngang, Google button disabled, không hiện dashboard. HTTP `/admin` và `/admin/join` trả 307 về login, callback sai trả 307 về origin nội bộ, `/admin/bootstrap` trả 404, query status không hợp lệ không gây 500; không có console error ở trang login. Đã rà bundle static không thấy tên secret key/bootstrap RPC. Không dừng dev server của người dùng. Điều kiện còn lại để đóng M1 ở [M1-AUTH.md](M1-AUTH.md).

Ngày: 19/11/2026. Máy Windows, Node 24.10.0, npm 11.6.1. Production server local; trình duyệt Chromium qua Playwright CLI.

## Kiểm tra mã nguồn

- `npm run lint`: đạt.
- `npm run typecheck`: đạt, gồm Next route type generation.
- `npm test`: 3 nhóm test đạt (tổng VND/format cấu hình; số lượng, giá và stock không hợp lệ; chuẩn hóa mã và path không hợp lệ).
- `npm run build`: đạt; homepage/admin/preorder static, tracking dynamic.
- Cài dependency báo 0 vulnerabilities tại thời điểm dựng. Đây không thay thế security review trước production.

## Kiểm tra trình duyệt

- Desktop 1440×1000: xem viewport và full page; minh họa/tokens/4 cột dịch vụ hiển thị đúng.
- Mobile 375×812: xem viewport/full page, bố cục 2 cột dịch vụ, sheet bảng giá, nav đáy; DOM không tràn ngang.
- Chọn lube → xem ước tính → xóa nội dung ô và nhập 82 → Tab: tổng 246.000 VND. Nhập 0 → Tab: từ chối, khôi phục 82 và báo lỗi. Click copy: hiển thị xác nhận clipboard write thành công. Không đọc clipboard cá nhân.
- Escape đóng dialog/sheet; nút đóng và hành động xem ước tính hoạt động.
- Gõ `kb-demo2026` và tra cứu: chuyển sang `/track/KB-DEMO2026`, timeline đúng bước hiện tại.
- `/track/KB-MISSING`: HTTP **404**, có hướng dẫn xem đơn mẫu. Đã bỏ loading toàn cục vì nó gây streaming 200 cho notFound ở route này.
- Header tracking/admin: `Cache-Control: no-store, max-age=0, private`.
- SW production active; cache `kb-workshop-offline-v1` chỉ có `/offline.html`.
- Tắt network, reload tracking: hiện fallback offline, không hiện lại đơn đã cache; bật mạng/reload trở lại trang tra cứu.
- Trang tracking online không có console error. 404 và mất mạng có lỗi network dự kiến trong console.
- Sửa sau review: ô số lượng cho phép nhập lại trước khi commit khi blur/Enter; waveform thu gọn trên mobile; bỏ số thứ tự HTML trùng marker timeline; thông báo ước tính chuyển vào panel để không che nút.

Ảnh QA local nằm ở `output/playwright/` và được gitignore; không phải artifact cần cho build.

## Giới hạn kiểm tra

Chưa có Supabase nên chưa chạy migration, query, RLS, Auth hay upload tests. GitHub Actions mới được cấu hình, chưa có remote/CI run. Chưa kiểm cài PWA trên iPhone/Android thật, screen reader, Safari/Firefox, hiệu năng mạng yếu, back/forward bfcache hoặc auto-fill. Những kiểm tra này thuộc M1/M7 và không được coi là đã đạt.
