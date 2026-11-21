# Giao diện quản trị TRUMP Keys

**Chuông thông báo:** toolbar đầu các trang quản trị (ẩn ở login/join), số chưa đọc và popup sự kiện có liên kết xử lý. `/admin/inbox` có lọc/phân trang/đánh dấu đã đọc riêng; cập nhật mỗi 30 giây khi tab visible. Thông báo cửa hàng tách khỏi trang trạng thái tích hợp Telegram hiện có. Xem [ADMIN-INBOX.md](ADMIN-INBOX.md).

**Dashboard tài khoản 20/11/2026:** đầu `/admin` có KPI đăng ký/hoạt động/mới tháng/tỷ lệ và biểu đồ hai đường; bên dưới giữ nguyên công việc/đơn/kho. `/admin/customers` dùng bảng semantic tìm/lọc/phân trang và giữ xác nhận thao tác. [ADMIN-DASHBOARD.md](ADMIN-DASHBOARD.md) mô tả định nghĩa dữ liệu, giới hạn lịch sử và nghiệm thu.

**Rà soát 20/11/2026:** xem [UI-REVIEW.md](UI-REVIEW.md). Nội dung chính 16px, phụ tối thiểu 14px; menu chia Công việc/Quản lý, mobile bốn mục công việc đầy đủ và hàng quản lý cuộn ngang. Dashboard/catalog giảm khung lặp. Các mô tả kích thước chữ/menu bên dưới là lịch sử thiết kế trước đợt tinh gọn này.

**M4:** menu có thêm Yêu cầu đặt tìm và Portfolio; mobile sáu mục trên hai hàng. Dashboard có số yêu cầu mới. Hộp yêu cầu, trình sửa portfolio và thao tác chọn ảnh tại Lịch sử đơn được mô tả trong [M4-REQUESTS-PORTFOLIO.md](M4-REQUESTS-PORTFOLIO.md).

Mục tiêu: mở trang là biết việc cần làm, xem tiền/tiến độ rõ, không phải cuộn qua mọi form. Thay đổi trên PC; không triển khai HP hay thay quy tắc tiền/tồn.

## Hướng thiết kế

- Giữ logo shop và font Segoe UI/Arial đang có, đủ dấu tiếng Việt. Tiêu đề 25–33px, nội dung 13–14px, số tiền có độ rộng chữ số ổn định.
- Màu nền `#f3f5f8`, mặt nội dung `#ffffff`, chữ `#111827`, chữ phụ `#596579`, hành động `#f59e0b`, đường chia `#e0e5ec`. Trạng thái còn có nhãn chữ; hủy dùng nút đỏ trong vùng thu gọn.
- Desktop: điều hướng trái, vùng làm việc căn trái, giới hạn 1.250px. Điện thoại: menu trên bốn mục luôn thấy đủ, nội dung một cột; các tab chi tiết đơn có thể cuộn ngang. Không dùng thanh điều hướng khách trong admin.
- Thứ tự chi tiết đơn: khách/bàn phím → tổng tiền và thực nhận → ba bước → tab thao tác. QR không chiếm toàn bộ cột bên cạnh công việc hằng ngày.

```text
Điều hướng | Khách / bàn phím / trạng thái
           | Tiền hàng · Thực nhận · Còn thu · Cọc
           | Đang chờ → Đang xử lý → Hoàn thành
           | Tiến độ | Thanh toán | Thông tin | QR | Lịch sử
           | Nội dung của tab đang chọn
```

## Các màn hình

- `/admin`: tổng quan ba trạng thái trong 200 đơn mới nhất, đơn gần đây, mục chưa công khai và linh kiện hết hàng. Không trộn quản trị quyền vào công việc xử lý đơn.
- `/admin/orders`: tìm theo tên khách/bàn phím/mã, lọc trạng thái và số lượng kết quả. Dữ liệu vẫn giới hạn 200 đơn mới nhất như M3, không gọi đây là báo cáo toàn bộ lịch sử.
- Chi tiết đơn: chọn tab bằng chuột hoặc phím mũi tên/Home/End. Tab ẩn giữ form nháp khi chuyển tab. Mới tạo mặc định Thanh toán; đã cọc mặc định Tiến độ; hoàn thành còn nợ COD mặc định Thanh toán.
- Sau nhận cọc, ẩn form thu COD cho tới hoàn thành; chỉ ghi nhận khi tiền thực về shop. Giá vốn nằm trong phần mở rộng, hủy đơn trong phần thu gọn tại Tiến độ.
- Tạo đơn có tìm hạng mục, lọc vẫn giữ số lượng đã chọn. Nhấn Enter trong ô tìm không tự tạo đơn.
- `/admin/catalog`: nội dung danh sách một cột, giữ bộ lọc và phiếu kho thu gọn sẵn có.
- `/admin/team`: chuyển nguyên luồng mời/quản trị tài khoản từ trang tổng quan sang đây; cập nhật revalidation đúng route. Quyền server/DB vẫn kiểm như trước.

## QR và xác nhận chuyển khoản

**Cập nhật cửa hàng:** đã có `/shop`, trang chi tiết, giỏ và checkout khách tự tạo đơn/QR; catalog admin có thumbnail và mặc định tạo Sản phẩm, thêm nhóm bàn phím/switch/phụ kiện. Các mô tả “chưa có checkout” dưới đây là lịch sử trước bổ sung. Xem [STOREFRONT.md](STOREFRONT.md).

**Có hai QR tách biệt:** QR tra cứu ở tab Link & QR; QR chuyển khoản Agribank ở Thanh toán và trang khách. Xem [BANK-PAYMENT.md](BANK-PAYMENT.md). Chưa có checkout khách tự tạo đơn, nút khách báo đã chuyển hoặc kết nối ngân hàng tự động.

Hiện shop tạo đơn sau tư vấn, kiểm tra ngân hàng rồi xác nhận thực thu. Lúc đó hệ thống mới ghi tiền và trừ kho. Bấm hoàn thành đơn không tự coi là nhận COD.

QR ngân hàng đã bổ sung: đúng khoản cọc 20% hoặc toàn bộ 100%, kèm nội dung đối soát riêng → khách chuyển → chờ shop xác nhận → admin kiểm tra ngân hàng và xác nhận. Tài khoản lấy từ ảnh Agribank người dùng cung cấp. Quét/mở QR không tự ghi nhận tiền.

## Kiểm chứng

`npm run test:m3-local` dùng fixture riêng, giữ dữ liệu người dùng. Bổ sung kiểm tra chuyển tab, phím mũi tên, QR có nhãn đúng, tìm đơn, tìm hạng mục giữ số lượng, route quản trị viên/mã mời và bố cục 375/1440. Ảnh kiểm tra ở `output/playwright/admin-*` (gitignored, không phải nội dung public).

Kết quả: lint/typecheck/build đạt, 26 SQL/unit tests đạt; API/Chromium M1–M3 và thao tác mới đạt, không có page error/cảnh báo React trong lần chạy cuối. Đã xem ảnh desktop/mobile, kiểm tra thêm bốn mục menu nằm trọn trong màn hình 375px. Công cụ chụp ảnh dùng `caret: initial` để không tự chèn inline style vào input trước hydration; không thêm suppressHydrationWarning vào ứng dụng.

Màn hình có dữ liệu minh họa trong ảnh kiểm thử, không đưa vào dữ liệu shop. UAT điện thoại thật vẫn thuộc giai đoạn phát hành.
