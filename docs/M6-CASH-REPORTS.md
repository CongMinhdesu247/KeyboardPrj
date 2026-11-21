# M6 — Báo cáo tiền thực thu

Phạm vi đã chốt: tiền đã nhận, tiền đã hoàn, thực thu và COD còn chờ. Không tính lợi nhuận/giá vốn, không xuất Excel hay đối soát theo nhân viên/phương thức. Chỉ chạy trên PC, chưa triển khai HP. Gemini để xử lý sau theo yêu cầu.

## Cách dùng

Mở **Admin → Tiền thực thu** (`/admin/reports`), hoặc link báo cáo ở Tổng quan. Mặc định tháng hiện tại tới hôm nay theo giờ Việt Nam. Chọn Từ ngày/Đến ngày, nhóm Ngày hoặc Tháng rồi bấm Xem báo cáo; có link nhanh Hôm nay/Tháng này/Năm nay.

- **Tiền đã nhận**: tổng ledger receipt được admin xác nhận trong khoảng ngày, gồm cọc, chuyển đủ và COD thực nhận.
- **Tiền đã hoàn**: tổng ledger refund trong khoảng ngày.
- **Thực thu trong kỳ**: đã nhận trừ đã hoàn; có thể âm nếu kỳ đó hoàn nhiều hơn thu. Không phải lợi nhuận và chưa trừ ship/chi phí vận hành.
- Ngày giao dịch là `order_payments.created_at`, tức ngày admin ghi nhận; chưa có nhập ngày tiền về trong quá khứ hay bút toán sửa sai. Đây là giới hạn từ M3, không tự backdate hoặc sửa ledger để làm báo cáo.
- Đơn tạo/hoàn thành/hủy không tự tăng/giảm tiền; cọc tháng trước và COD tháng sau nằm trong hai kỳ tương ứng. Khoản thu của đơn hủy vẫn giữ lịch sử; chỉ giảm thực thu khi đã ghi refund.
- Bảng theo ngày/tháng gồm cả kỳ 0 giao dịch. Nhóm tháng trên khoảng tùy chọn chỉ cộng phần ngày nằm trong khoảng, không tự lấy cả tháng.
- Danh sách giao dịch 50 dòng/trang có link mở đơn, số tiền và thời gian, mã đối soát riêng `payment_reference`. Không trả mã tracking, SĐT, địa chỉ, ghi chú, tài khoản/tham chiếu ngân hàng gốc hoặc giá vốn.

## COD và phần có thể hoàn

Khối **COD còn chờ** là trạng thái hiện tại toàn shop tại lúc tải, độc lập với bộ lọc ngày. Chỉ đơn `deposit_cod`, chưa hủy, đã nhận ít nhất cọc và chưa thu đủ mới được tính; số còn lại = tổng đơn − thu ròng thực tế. Đơn chưa cọc không phải khoản COD chờ. Hiển thị tổng dự kiến còn lại và phần đã hoàn thành chờ shop đối soát. Chưa thu COD thì không cộng vào thực thu.

Hiển thị tối đa50 đơn chờ, ưu tiên hoàn thành, cùng số tổng thực tế. Tổng không bị cắt theo danh sách này hay giới hạn200 đơn của màn hình đơn cũ. Bấm mở đơn để xác nhận khi shop đã nhận tiền; báo cáo không có nút tự nhận tất cả COD.

Đơn hủy còn phần có thể hoàn = `max(thu ròng − cọc20%,0)`, theo quy tắc M3. Đây là số tham khảo để shop kiểm tra, không tự hoàn, không trừ dự kiến vào kỳ thực thu. Sau khi ghi refund qua lệnh đơn chuẩn, số liệu tự cập nhật.

## Hợp đồng kỹ thuật

Migration `20261119155415_cash_reports.sql` thêm index thời gian/ID và RPC đọc `cash_report(p_from date,p_to date,p_group text,p_page int)`. Không thêm bảng tổng hợp hoặc thay ledger/kho/order_command. Private SECURITY DEFINER với search_path rỗng, kiểm `public.is_admin()` active/live session; public wrapper invoker. Chỉ authenticated có execute; anon, service_role và authenticated chưa quyền bị chặn. Trang gọi `requireAdmin()` và dùng JWT admin, không dùng secret/service-role để đọc báo cáo.

Date được validate ở cả URL và DB:1900–2100, thứ tự hợp lệ, tối đa366 ngày bao gồm hai đầu; group day/month, page1–1.000.000. SQL đổi đầu ngày Việt Nam sang UTC, truy vấn `[start,end+1day)` theo `created_at`, index không bọc function trên điều kiện thời gian. Tổng tiền/bảng/ledger/COD đọc cùng statement snapshot. Ledger đủ mọi dòng trong kỳ, paginate chỉ danh sách.

Postgres SUM trả numeric/string vào JSON cho tiền; UI dùng BigInt và Intl VND, không mất số khi tổng vượt Number.MAX_SAFE_INTEGER. Số tiền gốc không đổi. Bảng tiền có caption/header và vùng scroll ngang nội bộ trên điện thoại; không tràn toàn trang. Admin header private no-store và noindex sẵn có, SW không cache báo cáo. Không có route báo cáo public.

## Ma trận nghiệm thu

Kết quả local: 60/60 SQL/unit tests đạt; hồi quy API/Chromium M1–M6 và storefront đạt, gồm fixture receipt retry/refund/COD và cleanup. Đã xem ảnh1440px/375px, không tràn toàn trang. Lint, typecheck và production build đạt; Supabase security advisors không có vấn đề. Kiểm tra cuối không còn user/đơn/catalog M6 fixture hoặc notification orphan; cấu hình integration gốc đã khôi phục. Không phát sinh gửi Gemini/Telegram thật từ fixture trong lần chạy này.

| Trạng thái | Kết quả |
| --- | --- |
| Chưa có giao dịch kỳ | Tổng0, thông báo rõ, bảng ngày0 vẫn có |
| Thu cọc | Tăng receipt đúng20%, chưa phải lợi nhuận |
| Gửi lại receipt cùng request | Không tăng tổng lần hai |
| Hoàn thành chưa COD | Không đổi thực thu; tăng nhóm hoàn thành chờ đối soát |
| Nhận COD | Tăng receipt ngày xác nhận, giảm chờ; không cộng lại cọc |
| Hủy đã thu | Giữ thu lịch sử, hiện phần có thể hoàn |
| Refund khác kỳ | Trừ kỳ ghi nhận refund, có thể âm |
| Bộ lọc sai | Báo lỗi, không trả báo cáo nhầm hoặc sửa dữ liệu |
| Mất quyền/hết live session | Server và DB đều từ chối |
| Lỗi DB | Hiển thị chưa tải được, không coi là số0 thật |

`npm test`: fixture PGlite với ngày sát17:00UTC (0h Việt Nam), cọc kỳ trước/COD kỳ sau, hủy/refund, tổng/tháng/ngày0/âm,251 dòng phân trang, không lộ dữ liệu riêng và chặn quyền/live session. Không reset DB hiện có.

`npm run test:m6-local`: hồi quy API/Chromium M1–M6 và storefront, thêm fixture M6 tạo đơn/thu cọc idempotent/hoàn thành/hủy/refund/COD bằng RPC chuẩn, UI filter/empty/error/link/375px/1440px. Cleanup theo actor/ID. Runner tạm tắt Gemini/Telegram trong `.env.local`, giữ bản gốc trong bộ nhớ và khôi phục trong finally để không gửi thông báo giả hoặc gọi API thật; không chạy worker cùng lúc kiểm thử. Dữ liệu admin thật/Aula giữ nguyên. Nếu process bị kill cưỡng bức, kiểm tra lại hai cờ integration sau khi dừng.

Chưa nghiệm thu vận hành trên domain/điện thoại thật; chưa có sửa sai/backdate giao dịch, tính ship tự động, lợi nhuận hoặc export. Không vì vậy mà sửa trực tiếp sổ thu/hoàn.
