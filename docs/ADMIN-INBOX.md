# Chuông và hộp thông báo quản trị

## Sử dụng

- Chuông nằm ở đầu các trang quản trị sau đăng nhập; số đỏ là số chưa đọc của **admin hiện tại** (trên 99 hiển thị 99+).
- Mở chuông để xem 20 sự kiện mới nhất. Chấm xanh/nền nhạt là chưa đọc; mở sự kiện sẽ đánh dấu đã đọc và dẫn tới đơn, yêu cầu đặt tìm hoặc phiên tư vấn liên quan. Mở chuông đơn thuần không đánh dấu hàng loạt.
- “Đọc tất cả” đánh dấu các thông báo tới thời điểm dữ liệu đang hiển thị. Sự kiện mới phát sinh sau mốc đó vẫn chưa đọc. Có trang `/admin/inbox` với lọc Tất cả/Chưa đọc và phân trang 20 mục.
- Tự kiểm tra mỗi 30 giây khi tab đang hiển thị; kiểm tra lại khi mở chuông, quay lại tab/cửa sổ hoặc có mạng. Không có âm thanh/browser push. Đánh dấu đã đọc không có nghĩa đơn/yêu cầu đã được xử lý xong.

## Nguồn và quyền

Dùng sự kiện thật trong `private.notification_outbox`: đơn mới, chuyển bước, hủy, nhận tiền, hoàn tiền, yêu cầu đặt tìm và khách chuyển sang tư vấn Zalo. Không tạo sự kiện giả, không tự nhận giao dịch ngân hàng, không gửi lại Telegram khi đọc. Sự kiện đã gửi Telegram vẫn có thể chưa đọc trong web. Các sự kiện đã lưu từ M5 cũng xuất hiện; không tạo lịch sử cho giai đoạn trước M5.

`private.admin_notification_reads` có khóa `(user_id, notification_id)`, RLS và không grant trực tiếp cho client/service role; FK cascade chỉ dọn trạng thái đọc khi user/event bị xóa. RPC private security definer kiểm `private.is_admin()` (Google/live session/active) mỗi lần, public wrapper security invoker chỉ grant authenticated. Actor lấy từ `auth.uid()`, client không được chọn admin khác. DTO chỉ có UUID sự kiện/entity, loại, thời gian và read_at; không mang nội dung chat, địa chỉ, tiền, tracking capability hoặc secret.

RPC `admin_inbox` giới hạn tối đa 50 mục/lượt, offset 0–100000, đếm unread độc lập phân trang. `read_admin_notifications` nhận 1–50 UUID hoặc mốc thời gian hữu hạn không nằm trong tương lai, insert idempotent. Không thay outbox delivery/ledger/kho. Server Actions kiểm admin và validation lần nữa. Các route admin giữ cơ chế không cache và SW chỉ fallback offline như trước.

## Ma trận nghiệm thu

| Trạng thái | Kết quả |
| --- | --- |
| Chưa đăng nhập/khách/hết quyền/phiên đã thu hồi | Không đọc/đánh dấu được RPC; server kiểm lại quyền |
| Admin A đọc | Giảm số của A; admin B giữ nguyên |
| Mở lại/tải lại trang | Đã đọc được lưu trong DB |
| Có sự kiện mới | Chuông cập nhật ở lần poll/focus/mở tiếp theo; không cần worker Telegram |
| Đọc tất cả | Idempotent; giữ sự kiện mới hơn snapshot chưa đọc |
| Mạng lỗi | Giữ danh sách đã tải, báo lỗi/thử lại; không giả thành công |
| Rỗng | Thông báo rõ, nút đọc tất cả disabled |
| Desktop/mobile | Hộp không tràn viewport, vùng chạm 44px, Escape/đóng trả focus về chuông |

Kiểm tra `tests/inbox-db.test.ts` trên database fixture riêng: quyền, thu hồi phiên, đọc riêng từng người, watermark, DTO, giới hạn/phân trang và độc lập Telegram. `node scripts/run-local-regression.mjs --inbox-only` kiểm API/Chromium bằng tài khoản và đơn fixture, không dùng cookie thật; thử menu/chuông/Escape/đi đúng đơn, reload, số chưa đọc, filter, lỗi mạng và 1440/375px. Được tích hợp vào hồi quy `npm run test:m7-local`; fixtures cleanup cả trạng thái đọc qua FK. Ảnh tại `output/playwright/admin-bell-*`/`admin-inbox-*`, nội dung ghi rõ fixture.

Chưa nghiệm thu trên điện thoại vật lý hoặc triển khai HP. Không tự bật push hay lịch xóa.
