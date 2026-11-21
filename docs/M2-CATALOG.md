# M2 — Bảng giá, linh kiện và tồn kho

**Bổ sung gallery:** tối đa 10 ảnh, sắp xếp/đổi bìa/gỡ riêng và một sound test MP4 ≤10 MB hoặc YouTube/TikTok. Ảnh cũ giữ làm bìa. Thao tác tại **Ảnh & sound test** sau khi tạo mục hoặc trên trang Chỉnh sửa. Chi tiết: [CATALOG-MEDIA.md](CATALOG-MEDIA.md).

Trạng thái: đã triển khai và kiểm tra trên PC với Supabase local. Chưa triển khai HP. Người dùng cần nhập giá/tồn/ảnh thật trước khi công khai nội dung.

## Cách sử dụng

1. Đăng nhập [admin local](http://localhost:3000/admin), chọn **Quản lý dịch vụ & linh kiện**, hoặc mở [danh sách](http://localhost:3000/admin/catalog).
2. Tám gói lube đã có bản nháp: **33/37/60/68 switch** và **layout 75/90/100/full**. Chọn Chỉnh sửa, nhập giá bán và mô tả, tick Công khai rồi Lưu thay đổi. Không tự quy đổi layout thành số switch.
3. Thêm mục mới vào một trong bốn nhóm cố định. Dịch vụ không có tồn; linh kiện có tồn khởi tạo 0. Loại dịch vụ/linh kiện được khóa sau khi tạo; tạo mục khác nếu chọn nhầm loại.
4. Giá bán có thể để trống để giữ bản nháp. Không thể công khai khi chưa có giá. Giá vốn chỉ admin xem; chưa tính lợi nhuận. Giá hiển thị và cấu hình sao chép ghi rõ chưa gồm ship.
5. Ảnh sản phẩm tối đa 5 MB/20 MP, chỉ JPEG/PNG/WebP tĩnh. Khi chọn ảnh bìa ở form thêm/chỉnh sửa sản phẩm, admin có khung căn chỉnh 3:2 (kéo chuột/cảm ứng, phóng đại 1–3×, thanh vị trí ngang/dọc, đặt lại khung và căn lại ảnh hiện tại) tương tự căn chỉnh banner. Server đọc nội dung, xoay theo EXIF, cắt theo vùng đã chọn, resize tối đa 1400px, chuyển WebP và bỏ metadata. Nếu lưu lỗi thì nội dung chữ và khung căn được giữ.
6. Linh kiện: mở Nhập hàng / điều chỉnh tồn, nhập số dương để tăng hoặc số âm để giảm, ghi lý do. Có nút chọn nhanh +1/−1; xác nhận bằng Ghi điều chỉnh. Sau thành công tải lại trang để tạo phiếu tiếp theo. Trang Chỉnh sửa có 100 biến động gần nhất (số thay đổi, tồn sau thay đổi, lý do và giờ Việt Nam).
7. Bỏ tick Công khai là tạm ẩn và có thể bật lại. **Lưu trữ mục này** là xóa mềm khỏi danh sách làm việc/bảng giá; giữ số tồn, lịch sử và tham chiếu để dùng ở M3. Chưa có UI khôi phục mục đã lưu trữ; dùng tạm ẩn nếu còn định bán lại.

Khách thấy mục đang công khai thuộc nhóm active. Hàng hết tồn vẫn hiện giá/số lượng 0 nhưng không thể chọn vào ước tính. Ước tính hỗ trợ số lượng theo đơn vị và mở Zalo sau khi sao chép; đây chưa phải tạo đơn/giữ hàng. M3 mới nối việc giữ/trừ tồn khi xác nhận nhận cọc/thu đủ.

## Dữ liệu và quyền

- Migration `20261119041859_catalog_inventory.sql`: `public.products_services`, `private.product_costs`, `private.inventory_movements`, RPC save/archive/stock/list và policy Storage cho catalog.
- Catalog public chỉ có giá bán, trạng thái, stock và nội dung sản phẩm; giá vốn nằm ở private schema. Homepage dùng client anonymous riêng, không mang cookie admin vào truy vấn public. Khi backend đã cấu hình nhưng lỗi: báo lỗi, không lấy giá mẫu thay thế.
- Các write chỉ qua RPC kiểm Google identity, session sống và membership active. Authenticated/admin không được cập nhật trực tiếp stock qua Data API. Không đổi workflow/bootstrap hoặc membership hiện tại.
- Nhập/xuất kho dùng transaction, row lock và idempotency UUID. Retry cùng phiếu không ghi trùng; hai request trừ hàng đồng thời không làm âm tồn. Trường version ngăn form chỉnh sản phẩm cũ ghi đè dữ liệu đã sửa/đã đổi tồn nơi khác.
- `catalog-images` là bucket **public riêng**, chỉ dùng ảnh sản phẩm sẽ công khai. Upload/delete yêu cầu admin. Ảnh đơn và ảnh đặt tìm vẫn ở hai bucket private M1; không đổi quyền của chúng. Không dùng catalog bucket cho thông tin khách.
- Storage và DB không có chung transaction: upload trước, save metadata sau; nếu DB từ chối thì xóa upload mới. Sau save thành công, dọn ảnh cũ. Lỗi mạng đúng thời điểm cleanup có thể để lại ảnh mồ côi, cần dọn trước phát hành/định kỳ khi có lượng upload lớn; không báo mất sản phẩm đã commit.

Migration M2 mới đang phát triển local đã được sửa phần khởi tạo nhóm bằng INSERT ON CONFLICT trước gói nháp, sau khi kiểm thử database sạch phát hiện seed.sql chạy sau migrations. Schema/function không thay đổi ở lần sửa này, dữ liệu local hiện có giữ nguyên. Các migration đã phát hành sau này phải dùng migration mới, không sửa lịch sử.

## Thương hiệu

- Header/footer/title/manifest/offline/icons dùng **TRUMP Keys**. Logo gốc giữ tại `public/brand/logo-source.png`; header và icon sinh từ ảnh đó bằng `npm run assets`.
- Link Facebook, Instagram, TikTok, Zalo và giờ tư vấn 08:00–22:00 đã có. Không tự suy Messenger ID từ link Facebook share.
- Hero vẫn là minh họa SVG có nhãn rõ; chưa nhận bộ ảnh bàn phím/video thật. Portfolio/pre-order/chat AI vẫn thuộc các mốc sau. Tracking `KB-DEMO2026` vẫn là đơn mẫu, chưa phải M3.

## Kiểm chứng ngày 19/11/2026

- Lint, TypeScript, production build: đạt.
- `npm test`: 17 tests gồm subtests SQL; chạy toàn bộ migration từ schema sạch trong PGlite. Có test giá nguyên/giá âm/nháp không giá/public thiếu giá/gói lube sai loại.
- `npm run test:m1-local`: 6 nhóm M1 và 3 nhóm M2 qua Supabase API thật đạt: draft/public, che giá vốn, chặn ghi trực tiếp, xung đột version, stock retry, trừ kho đồng thời, archive giữ history.
- `npm run test:catalog-ui`: thêm luồng Chromium thật với fixture riêng, đi qua Next Server Actions thật. Kiểm: form thiếu giá giữ nội dung; ảnh giả đuôi PNG bị chặn; tạo sản phẩm có ảnh hợp lệ; thử trừ kho 0 bị chặn và giữ lý do; nhập 3; khách chọn 2 có tổng 50.000 VND; ảnh tải được; đổi giá/ẩn/archive; logout fixture chặn quyền tiếp theo.
- Desktop 1440×1000 và mobile 375×812: xem screenshot admin/list/editor, homepage và ước tính; kiểm không tràn ngang. Ảnh QA ở output/playwright, gitignored. Test dùng danh tính/session fixture local, không dùng cookie hoặc đăng xuất admin thật. Google login thật đã do người dùng xác nhận ở M1.
- Supabase security advisors: không phát hiện lỗi. Migration local khớp phiên bản. Tài khoản admin thật giữ active.
- Sau cleanup: còn đúng 8 gói nháp không giá, 0 mục công khai và 0 user fixture. Giá 25.000/30.000 trong screenshots chỉ là dữ liệu thử đã xóa, không phải giá shop.

## Giới hạn

Chưa thử thiết bị iOS/Android thật, trình duyệt ngoài Chromium, callback Google nhiều tài khoản thật trong lần này, CI GitHub hoặc image Docker trên HP. M2 hiện danh sách admin tải các mục chưa archive, chưa phân trang; phù hợp quy mô shop nhỏ, thêm pagination khi catalog lớn. Không có báo cáo lợi nhuận, đơn thật, phiếu giữ kho theo cọc hoặc tự động đối soát COD ở M2.
