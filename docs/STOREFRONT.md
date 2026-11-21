# Cửa hàng, giỏ hàng và khách tự đặt đơn

## Trang ước tính riêng — 20/11/2026

Sửa lọc dịch vụ: nhóm mod trên homepage và trang ước tính chỉ gồm lube/stab/keycap/sound_mod. Catalog đưa vào dialog/chọn/tính tổng chỉ có `type=service`, kể cả khi linh kiện bị gán chung nhóm lube. Các nhóm rỗng vẫn có thông báo cập nhật bảng giá. Cửa hàng/giỏ/checkout giữ nguyên toàn bộ sản phẩm và dịch vụ; không sửa dữ liệu production. Nghiệm thu: linh kiện cùng nhóm không xuất hiện trong dialog, dịch vụ còn chọn/tính được, menu mod không có bàn phím/switch/phụ kiện; test hồi quy tại tests/domain.test.ts.

Khối tính giá chuyển khỏi homepage sang `/estimate`, dùng `ServiceEstimator`; menu sau Bàn phím đã làm có icon máy tính, footer thêm liên kết. Homepage giữ nhóm dịch vụ, dẫn `/estimate?category=...` để mở đúng bảng giá; Escape/đóng dialog giữ các lựa chọn trong trang. Dùng lại `calculateEstimate`/`estimateText` và catalog public anonymous, không đổi DB, checkout hay tồn kho. Lựa chọn tạm trong bộ nhớ trang như trước; không lưu qua reload.

| Vùng | Tiêu chí nghiệm thu |
| --- | --- |
| Trang chủ | Không còn panel/floating ước tính; dịch vụ/portfolio/tra cứu còn nguyên |
| Menu | Ước tính chi phí cạnh Bàn phím đã làm, trạng thái active, cuộn ngang mobile |
| Trang riêng | Giá công khai, trạng thái rỗng, chọn/bỏ và cập nhật số lượng/tổng, cấu hình văn bản/sao chép/Zalo giữ nguyên |
| Bảng giá | Link nhóm từ home mở đúng nhóm; Escape đóng; không có dữ liệu hiển thị thông báo sẵn có |
| Responsive | 1440/375px không tràn ngang, footer vàng be và menu điện thoại giữ nguyên |

Kiểm tra read-only `node scripts/verify-estimate-navigation.mjs`: menu/home/category dialog/Escape/chọn/số lượng/tổng/bỏ/văn bản và screenshot 1440/375px; không ghi đơn/kho hoặc dùng tài khoản thật. `node scripts/verify-mod-navigation.mjs` kiểm lại anchor dịch vụ. Clipboard hệ điều hành và trao đổi Zalo chưa kiểm chứng đầu cuối.

**Cập nhật tài khoản:** checkout mới yêu cầu đăng nhập Google và gắn đơn theo tài khoản; thêm `/account` và quản lý người dùng admin. Guest chỉ còn áp dụng đơn cũ và RPC service-only nội bộ. Chi tiết [CUSTOMER-ACCOUNTS.md](CUSTOMER-ACCOUNTS.md), ưu tiên hơn mô tả guest baseline bên dưới.

**Gallery sản phẩm:** trang chi tiết hỗ trợ nhiều góc chụp, vuốt/thumbnail/bàn phím, MP4 có âm thanh hoặc YouTube/TikTok. Thẻ sản phẩm tiếp tục dùng ảnh bìa. Giá/checkout giữ nguyên. Hướng dẫn và ma trận nghiệm thu: [CATALOG-MEDIA.md](CATALOG-MEDIA.md).

## Giao diện người mua — cập nhật 20/11/2026

Thiết kế lại theo cấu trúc cửa hàng bàn phím quốc tế, tham khảo tổ chức danh mục/tìm kiếm của [Keychron](https://www.keychron.com/) và [Mode Designs](https://modedesigns.com/); giữ nội dung tiếng Việt và nhận diện TRUMP Keys.

- Nền trắng `#ffffff`, bề mặt ảnh/tóm tắt `#f3f4f5`, chữ và hành động `#222529`, chữ phụ `#60656b`, đường chia `#e3e5e7`; màu vàng giữ ở nhận diện. Font hệ thống Segoe UI Variable/Segoe UI, nội dung 15–16px, phụ từ 14px.
- Header có tìm kiếm GET `/shop?q=...`, giỏ cập nhật số lượng từ cart hiện có, thanh danh mục và liên kết tra cứu. `/shop?category=...` khởi tạo bộ lọc đúng danh mục; query chỉ chọn dữ liệu catalog public đã tải, không thay giá/kho.
- Trang chủ có khối giới thiệu ngắn và hình bàn phím **minh họa có nhãn**, sau đó hàng đang bán, dịch vụ/ước tính, portfolio, tra cứu và liên hệ. Khi chỉ có một mặt hàng, khối hàng trang chủ chuyển sang hàng ngang thay vì để thẻ nhỏ giữa khoảng trắng lớn. Không tạo SKU/giá/ảnh bán hàng giả.
- Cửa hàng dùng cột lọc trên desktop và danh mục cuộn ngang trên điện thoại. Nhãn bộ lọc `Loại` và `Sắp xếp` giữ trên cùng một hàng, không bị ngắt chữ xuống dòng. Mobile không lặp ô tìm kiếm header với ô lọc của cửa hàng. Ảnh cùng tỉ lệ, tên/giá/tồn/nút thêm giỏ đồng bộ; footer chia Mua sắm/Hỗ trợ.
- Chi tiết có ảnh lớn, nội dung và nút mua rõ; bỏ khung mô tả lồng nhau, ẩn khối gợi ý khi không có mặt hàng cùng nhóm. Giỏ/checkout dùng vùng tóm tắt riêng, trường nhập dễ đọc, phương thức đang chọn có viền rõ.
- `src/app/buyer.css` tách giao diện người mua; biến theme chỉ áp dụng khi không có `.admin-shell`. Giữ nguyên quyền, ledger, cọc/COD, QR, snapshot và quy tắc tồn kho. Không thêm thư viện UI hoặc dịch vụ bên ngoài.

Kiểm tra: `npm run test:buyer-ui` dùng browser context riêng, chỉ đọc server và thay giỏ trong context đó; thử 375/1440px, tìm/lọc và URL query, kết quả rỗng, nút thêm giỏ/số lượng header, chi tiết/giỏ/checkout, menu bàn phím và mã tra cứu sai; không gửi đơn. `npm run test:m7-local` kiểm toàn bộ M1–M7 và checkout bằng fixture có cleanup, không dùng cookie thật và tắt tích hợp trong lúc chạy. Ảnh trong `output/playwright/buyer-*` và `store*`, có nhãn dữ liệu fixture khi dùng sản phẩm kiểm thử. Chưa nghiệm thu trên điện thoại vật lý.

| Vùng giao diện | Trạng thái/tiêu chí nghiệm thu |
| --- | --- |
| Tìm kiếm và danh mục | Query từ header vào đúng bộ lọc; lọc tức thì; kết quả rỗng có hướng dẫn |
| Giỏ trên header | Số lượng cập nhật khi thêm hàng và giữ sau chuyển trang; không lưu thêm dữ liệu khách |
| Hàng và chi tiết | Ảnh hoặc nhãn chưa có ảnh, tên dài không tràn, giá/đơn vị/tồn rõ, thêm giỏ có phản hồi |
| Checkout/QR | Cọc/full và nhận tại shop/giao hàng giữ luồng cũ; pending/lỗi/thành công đúng; admin vẫn xác nhận tiền |
| Desktop/mobile | 375/1440px không tràn ngang; danh mục cuộn được bằng bàn phím; ưu tiên mua hàng trên trang chủ |
| Ảnh lỗi | Hiện nhãn lỗi tải hoặc chưa có ảnh; ảnh sản phẩm/portfolio/tiến độ giữ trọn khung, không tạo ảnh hàng giả |
| Lỗi mạng biểu mẫu | Chặn POST ở browser kiểm thử; checkout/đặt tìm giữ dữ liệu, thông báo nhận focus và nằm trên vùng thanh mobile |
| Tải giỏ | Hiện trạng thái tải trước khi đọc localStorage, sau đó chuyển đúng giỏ hiện có hoặc trạng thái rỗng |
| Trang hỗ trợ/đơn | Đặt tìm, chat, portfolio, guide/privacy và tra cứu đồng bộ hệ chữ; checkout có header tối giản; QR render từ snapshot đơn đã có |

Kết quả trên PC: buyer UI, 63 SQL/unit tests, hồi quy M1–M7 + storefront, lint/typecheck và production build đều đạt. Đã mở ảnh chụp desktop/mobile để rà soát, thu gọn thêm banner mobile và bố cục danh sách chỉ có một mặt hàng sau lượt kiểm tra đầu. Dữ liệu fixture được cleanup, cấu hình tích hợp được khôi phục; không triển khai HP.

Ảnh và nội dung thật do shop nhập vẫn được giữ nguyên. Để mở bán, shop cần thay các ảnh/nội dung thử đang đăng bằng ảnh bàn phím thực tế; thiết kế không tự coi ảnh minh họa là sản phẩm đang bán.

---

Phần bổ sung theo yêu cầu người dùng sau M4: website phải trưng bày ảnh/tên/giá ở ngoài và cho khách tự mua. Triển khai trên PC; không triển khai HP hay kết nối ngân hàng tự nhận tiền.

## Những màn hình đã có

- `/shop`: lưới sản phẩm có ảnh lớn, tên, giá/đơn vị, loại sản phẩm/dịch vụ, tồn; tìm kiếm, lọc nhóm/loại và sắp xếp theo giá/mới nhất. Trang chủ cũng có lưới hàng đang bán trước khu dịch vụ.
- `/shop/[id]`: ảnh lớn, mô tả, tình trạng hàng, số lượng, Thêm vào giỏ và Mua ngay. Mặt hàng ẩn/lưu trữ không mở được. Hết tồn không đặt được. Không có ảnh thì hiện “Chưa có ảnh”, không tự lấy ảnh/giá mẫu làm hàng thật.
- `/cart`: tăng/giảm số lượng, xóa, tính tiền, kiểm hàng ngừng bán/hết tồn. Giá mới phải được khách xác nhận trước khi tiếp tục. Giỏ lưu chỉ ID/số lượng/giá tham khảo trong localStorage; không lưu tên/SĐT/địa chỉ hay mã truy cập đơn ở đây.
- `/checkout`: khách không cần tài khoản, nhập liên hệ, địa chỉ hoặc hẹn nhận tại shop, ghi chú và lựa chọn cọc 20% + COD hoặc bank 100%. Nếu có dịch vụ, phải nhập cấu hình bàn phím cần làm. Tạo thành công tự chuyển sang trang tra cứu có QR ngân hàng.
- Mua ngay chỉ đặt mặt hàng đang xem, không xóa giỏ đang có. Đặt từ giỏ chỉ trừ các dòng đã đặt sau khi server xác nhận tạo đơn; mất mạng/lỗi không xóa giỏ hay làm mất thông tin form.
- Admin Bảng giá & kho có thumbnail và nhóm Bàn phím/Switch/Phụ kiện. Tạo mới mặc định Sản phẩm; dịch vụ vẫn chọn được. Mục cũ tạo nhầm loại không bị tự đổi hoặc xóa lịch sử; tạo mục mới đúng loại rồi lưu trữ mục sai khi phù hợp.

Chỉ ảnh đã upload mới là ảnh sản phẩm thật. Mở Chỉnh sửa trong catalog để bổ sung ảnh/mô tả, giá, Công khai và nhập tồn thực tế. Không tự tạo đánh giá, sao, số đã bán hoặc khuyến mãi giả.

## Đơn và thanh toán

`submit_customer_order` là RPC riêng chỉ server/service_role dùng; không bỏ qua guard của lệnh admin. Hàm khóa request ID và sản phẩm theo thứ tự, kiểm giá/tình trạng/nhóm/tồn, tính tổng và chụp snapshot giá/tên/giá vốn từ DB. Không nhận tổng tiền, giá vốn, actor, trạng thái đã trả hoặc tiến độ do browser gán.

Đơn web có `source=web`, actor tạo đơn null, sự kiện đầu “Shop đã nhận đơn đặt từ website”. Chỉ sự kiện created được phép không có actor; các thao tác nhận tiền/chuyển bước vẫn yêu cầu admin thật/live session. Address/customer note riêng nằm trong bảng private và chỉ admin thấy tại Thông tin đơn. DTO tra cứu vẫn che SĐT, không trả địa chỉ, ghi chú hay giá vốn.

Token checkout ký HMAC theo scope riêng, có hạn một giờ, không dùng token đặt tìm để tạo đơn. `checkout_submissions` private bảo đảm cùng request+hash trả đúng đơn cũ, khác nội dung bị chặn. Mã tracking 128 bit do server sinh; không dùng mã tuần tự/điện thoại để tra cứu. Cookie visitor signed HttpOnly riêng cho `/checkout`, quota DB 10 lượt/visitor/giờ và chia sẻ trần 100 lượt toàn shop/giờ với intake. Cần tuning/WAF trước public.

| Thời điểm | Tiền | Kho |
| --- | --- | --- |
| Chọn vào giỏ | Chưa thu | Chưa giữ/trừ |
| Khách tạo đơn | Chờ cọc hoặc bank full | Kiểm đủ để nhận đơn, chưa giữ/trừ |
| Mở/quét QR hoặc tải lại | Không tự coi đã thanh toán | Không thay đổi |
| Admin xác nhận thực nhận | Thêm receipt | Trừ đúng một lần theo snapshot |
| Hoàn thành | Không tự ghi COD | Không trừ lại |

Giá/QR chỉ là tiền hàng/dịch vụ, chưa gồm ship; shop xác nhận phí ship riêng. Giữ quy tắc cọc đã chốt: chưa giữ hàng khi chưa xác nhận nhận tiền, vì vậy nhiều đơn chờ có thể cùng chọn mặt hàng cuối. Xác nhận cọc đồng thời chỉ một đơn trừ kho thành công. Nếu tồn/đăng bán thay đổi sau tạo đơn web mà chưa cọc, lần đọc trang thanh toán mới ẩn QR và yêu cầu liên hệ shop; không tự thu tiền với hàng đã biết không còn sẵn. QR đã tải/chụp không thể thu hồi; đối soát/trả tiền trong sự cố cần shop xử lý, chưa có gateway tự động.

## Kiểm chứng và giới hạn

Kết quả trên PC: 42/42 SQL/unit tests đạt; hồi quy API và Chromium M1–M4 + storefront đạt; lint, typecheck, production build và Supabase security advisors đạt. Fixture kiểm thử đã được dọn; chưa triển khai HP.

- SQL/unit: validation giỏ, token scope, chặn RPC guest, idempotence, giá authoritative, stock/ẩn hàng, privacy địa chỉ, đơn chờ không đụng ledger/kho, admin receipt trừ kho một lần.
- `npm run test:storefront`: hồi quy M1–M4, thêm sản phẩm fixture có ảnh, tìm/xem card/chi tiết, giỏ giữ sau reload, giá mới cần xác nhận, đặt ship/cọc và pickup/full, giải mã QR, admin thấy địa chỉ nhưng guest không thấy, xác nhận cọc, kho thay đổi và QR không còn xuất hiện cho đơn chờ thiếu tồn.
- Ảnh QA ở `output/playwright/store*`; ảnh fixture chỉ dùng kiểm thử, cleanup theo actor/ID/run marker. Backup trước schema: `output/backups/pre-storefront.sql` (gitignored). Không reset DB thật hoặc sửa mục Aula cũ của người dùng.
- Chưa có biến thể SKU/màu, mã giảm giá, đánh giá, vận đơn/phí ship tự động hoặc đồng bộ ngân hàng. Đây là cửa hàng một shop có checkout thực; các tính năng sàn nhiều nhà bán là phạm vi mở rộng.
- UAT quét QR trên điện thoại, nội dung/giá/ảnh thật và phát hành vẫn cần hoàn tất trên môi trường tên miền sau khi duyệt bản PC.

Migration bổ sung: `20261119140754_storefront_checkout.sql`, `20261119141341_checkout_payment_availability.sql`. Tài liệu Next về form/Server Actions và Supabase functions/RLS được đối chiếu trước khi triển khai.
