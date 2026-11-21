# QR chuyển khoản Agribank — xác nhận thủ công

Triển khai local trên PC. Chưa kết nối tài khoản ngân hàng, chưa chuyển tiền thử và chưa triển khai HP.

## Tài khoản nhận tiền

Người dùng cung cấp ảnh QR: Agribank, BIN `970405`, tài khoản `1500200768268`, chủ tài khoản `NGUYEN CONG MINH`, chi nhánh TP Hà Nội. Đã giải mã ảnh trên PC và đối chiếu BIN/số tài khoản với chữ trong ảnh. Không coi việc giải mã là tra cứu tên chủ tài khoản tại ngân hàng.

Thông tin nhận tiền công khai ở `src/lib/bank-transfer.ts`, không phải credential đăng nhập ngân hàng. Không có mật khẩu, token truy cập tài khoản hoặc API ngân hàng.

## Luồng sử dụng

**Cập nhật checkout:** khách đã có thể tự đặt từ `/shop` → giỏ/checkout → trang đơn có QR. Các đoạn “shop tạo đơn” và “chưa có checkout” bên dưới là phạm vi M3 trước khi được yêu cầu bổ sung. Hiện cả admin tạo và khách tự tạo đều chờ admin xác nhận thực thu. Xem [STOREFRONT.md](STOREFRONT.md).

1. Shop vẫn tạo đơn sau tư vấn, chọn phương án cọc 20% + COD hoặc chuyển khoản toàn bộ 100%.
2. Trang tra cứu của đúng đơn hiển thị QR chuyển khoản, số tiền, người nhận, số tài khoản và nội dung đối soát. Khách có thể tải QR, sao chép thông tin hoặc quét bằng ứng dụng ngân hàng.
3. Khách chuyển xong chờ shop kiểm tra; không chuyển lại khi trạng thái còn chờ. Có nút tải lại trạng thái, dùng tải trang thật để nhận dữ liệu mới từ server.
4. Admin vào Thanh toán, so sánh ngân hàng với nội dung/số tiền của đơn, ghi chứng từ và xác nhận thực thu. QR có thể mở xem ở phần thu gọn trong cùng tab. Chỉ lệnh nhận tiền đã có của M3 ghi ledger/trừ kho.
5. Sau nhận cọc, QR 20% được ẩn, báo phần còn lại là COD. Sau thu đủ hoặc hủy, không đưa QR chuyển khoản mới. QR đã tải/chụp trước đó không thể thu hồi khỏi ứng dụng ngân hàng; luôn kiểm tra trạng thái đơn trước khi chuyển.

Không tự đổi phương án thanh toán sau khi nhận cọc. Chưa có checkout khách tự tạo đơn, nút khách báo đã chuyển, upload chứng từ khách, webhook hoặc đối soát tự động. Không thêm nút báo chuyển tiền nhưng không gửi thông tin thật cho shop.

## Quy tắc dữ liệu

- Số tiền QR lấy từ snapshot và ledger server, không nhận amount hoặc tài khoản từ query string/browser. Cọc bằng `ceil(total/5)`, chưa gồm ship; toàn bộ là tổng tiền hàng/dịch vụ.
- Mỗi đơn có `payment_reference` riêng, định dạng `TK` + 10 chữ số, unique từ sequence private. Migration bổ sung cả đơn cũ. Reference không phải mã tra cứu và không mở được trang đơn.
- Không gửi mã tracking 128 bit, SĐT/tên khách hoặc ghi chú vào nội dung chuyển khoản. `track_order` vẫn chỉ service_role gọi được, chỉ bổ sung plan/total/deposit/received/reference vào DTO server. Sổ thanh toán/giá vốn và thông tin khách đầy đủ không public.
- QR tạo local bằng TLV NAPAS/VietQR, dịch vụ `QRIBFTTA`, VND `704`, CRC16-CCITT và thư viện qrcode đã có. Không tải ảnh QR qua dịch vụ ngoài, không cần key hay phí API tạo QR.
- `jsqr` chỉ ở devDependencies để giải mã QR kiểm thử độc lập; không thêm SDK thanh toán vào runtime.
- QR thanh toán khác QR tra cứu ở tab Link & QR. Giữ nhãn rõ ở cả hai nơi.

## Ma trận trạng thái

| Đơn | QR ngân hàng | Tiền cần chuyển | Thao tác nhận tiền |
| --- | --- | --- | --- |
| Chưa thu, cọc/COD | Có | 20% chưa ship, làm tròn lên VND | Admin kiểm tra rồi nhận cọc |
| Chưa thu, full bank | Có | 100% chưa ship | Admin kiểm tra rồi nhận đủ |
| Đã cọc | Ẩn | Không yêu cầu bank thêm; 80% COD | Chỉ thu COD sau hoàn thành, khi shop thực nhận |
| Đã thu đủ | Ẩn | Không yêu cầu thêm | Không ghi trùng |
| Đã hủy | Ẩn | Không chuyển vào đơn | Hoàn phần vượt cọc theo M3 nếu thực trả |

## Kiểm chứng

- Unit: CRC đối chiếu vector chuẩn, payload static khớp nguyên văn QR Agribank trong ảnh, payload dynamic khớp ví dụ VietQR; giải mã PNG bằng thư viện độc lập, số tiền sai bị từ chối, trạng thái cọc/full/paid/cancel.
- SQL: migration từ DB sạch, reference không dùng để truy cập đơn, DTO vẫn không có raw phone/ghi chú/giá vốn.
- `npm run test:m3-local`: tạo đơn qua UI, giải mã QR thật trong HTML để kiểm tra BIN/số tài khoản/số tiền/reference, mở trang nhiều lần không tạo receipt; admin xác nhận xong khách tải lại thấy QR bị ẩn. Thử thêm full 100% và hủy; hồi quy M1–M3, cleanup fixture.
- Ảnh desktop/mobile ở `output/playwright/bank-payment-*`. Backup private trước migration ở `output/backups/pre-bank-qr.sql` (gitignored).
- Kết quả local: 29 SQL/unit tests, API/Chromium M1–M3 và luồng QR đạt; lint/typecheck/build đạt, security advisors không có findings. Fixture đã cleanup, dữ liệu shop không reset. Build được kiểm tra riêng sau browser.
- Trước dùng nhận tiền thật: quét QR bằng app ngân hàng trên điện thoại để xác nhận hiển thị đúng tên/số tiền/nội dung. Kiểm thử giải mã QR không thay cho UAT app ngân hàng hoặc giao dịch thật.

Nguồn chính thức đã đối chiếu: [VietQR — tạo QR và ví dụ payload](https://www.vietqr.io/danh-sach-api/link-tao-ma-nhanh/api-tao-ma-qr), [danh sách BIN ngân hàng](https://www.vietqr.io/api-bank/demo). Tài liệu hiện hướng dẫn tạo offline, không tích hợp mới endpoint generate cũ.
