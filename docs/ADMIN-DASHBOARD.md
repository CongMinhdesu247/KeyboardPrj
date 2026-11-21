# Tổng quan quản trị và tăng trưởng tài khoản

Ngày cập nhật: 20/11/2026. Next.js16/React19, CSS thuần và font hệ thống hiện có, Recharts chỉ trong component tương tác. Giữ `/admin` tổng quan đơn/công việc, `/admin/team` quản trị quyền; không đổi hợp đồng `account_report`/`manage_account`.

## Số liệu

- KPI tổng đăng ký gồm cả banned/deleted; hoạt động30ngày chỉ status active và last_seen_at trong 30×24giờ; mới tháng từ đầu tháng Việt Nam; tỷ lệ = active30/tổng đăng ký, 0 khi mẫu số 0.
- `account_growth()` gọi dưới JWT admin, DB kiểm admin + live session; response không có email, tên, địa chỉ, session hoặc capability. Không cache công khai, không fallback số liệu mẫu.
- Lũy kế đăng ký được tính từ registered_at thật. Giới hạn như nguồn cũ: người đã xóa vật lý khỏi Auth không còn trong số liệu; xóa quyền qua UI vẫn giữ account.
- `account_activity_days` chỉ giữ user_id/ngày Việt Nam, khóa chính ngày/user chống đếm trùng; trigger sau cập nhật last_seen_at tái sử dụng touch_account đã xác thực/throttle5phút, không ghi URL/IP/token. Ngày đầu migration chưa đầy đủ nên hiển thị null; không backfill từ last_seen_at vì không chứng minh các ngày trước.
- Chế độ theo ngày: đăng ký mới và distinct truy cập/ngày, hôm nay tạm tính. Chế độ tổng: tổng đăng ký và distinct truy cập trong 30 ngày lịch kết thúc tại ngày đó. Lịch sử active30 chỉ có khi đủ 30 ngày đầy đủ sau ngày migration. Điểm hôm nay lấy active30 hiện hành từ last_seen_at, loại banned/deleted; lịch sử tính hoạt động thực đã ghi nhận tại thời điểm truy cập, không hồi tố trạng thái hiện tại.
- Ngày chưa đủ dữ liệu = null/—, đường không nối qua khoảng thiếu. Chưa có lịch sử đủ thì đường hoạt động chỉ có điểm hôm nay; không thể phục dựng lịch sử trước migration. Retention bảng mới cần cùng rà soát chính sách tài khoản; không bật xóa tự động.

## Ma trận nghiệm thu

| Hạng mục | Trạng thái / tiêu chí |
| --- | --- |
| Tổng quan | 4 KPI, biểu đồ trước công việc/đơn gần đây, giữ liên kết kho/yêu cầu/đơn |
| Biểu đồ | 7/30/90/365ngày, tổng/theo ngày, 2 màu + nét đứt, tooltip, bảng số liệu thay thế |
| Tài khoản | Bảng semantic, tìm tên/email, lọc quyền/trạng thái, phân trang20 giữ query, empty state/xóa lọc |
| Thao tác | Giữ lý do/xác nhận/version/server authorization, Escape dialog; admin sang team |
| Responsive | Kiểm 375/768/1440, bảng cuộn nội bộ có focus, không tràn toàn trang |
| Lỗi/tải | loading skeleton; error boundary thử lại; lỗi thống kê riêng giữ công việc/danh sách |
| Quyền/SQL | tests/account-growth.test.ts: anon/customer/stale session bị chặn, ngày VN, distinct, null history |
| Hồi quy UI | scripts/verify-accounts-local.mjs dùng fixture riêng, kiểm chart/range/table/Escape/cấm/bỏ cấm/xóa |

Migration additive `20261120084134_account_dashboard.sql`; áp dụng local không reset DB. Rollback ứng dụng về bản cũ có thể giữ bảng/RPC mới chưa sử dụng; không drop dữ liệu hoạt động đã thu trong quá trình rollback. Không triển khai HP trong thay đổi này.

Tham khảo API đã đối chiếu: [Recharts](https://recharts.github.io/en-US/api/LineChart/), [Supabase functions](https://supabase.com/docs/guides/database/functions), Next.js docs trong node_modules bản đã cài.

## Kết quả kiểm chứng local

- `npm run lint`, `npm run typecheck`, `npm test` (75 tests) và `npm run build` đạt. Build Windows cần chạy ngoài sandbox để Turbopack tạo junction cho sharp; không đổi cấu hình build để né lỗi.
- Migration đã áp dụng local, types đã sinh lại; `supabase db advisors --type security --fail-on error` không có lỗi.
- `node scripts/run-local-regression.mjs --accounts-only` đạt API M1–M4 và UI tài khoản: range7/365/30, đổi chế độ, bảng ngày, tooltip bàn phím, ảnh 375/768/1440, không tràn ngang toàn trang; cấm/bỏ cấm/xóa quyền và Escape đạt. Không có pageerror/console warnings. Cleanup fixture và khôi phục cấu hình integration thành công.
- Đã xem ảnh QA dashboard desktop/mobile và tài khoản desktop/tablet; ảnh `output/playwright/dashboard-growth-{1440,768,375}.png`, `accounts-admin-{1440,768,375}.png` gitignored. Số liệu fixture trong ảnh không phải kết quả tăng trưởng production.
- Chưa UAT thiết bị vật lý hoặc triển khai HP; chưa thể nghiệm thu đường lịch sử hoạt động30ngày thực tế khi chưa thu đủ30ngày. SQL fixture đã kiểm aggregation, distinct và khoảng null trước coverage.
