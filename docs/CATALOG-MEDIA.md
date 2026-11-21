# Gallery ảnh và sound test sản phẩm

Yêu cầu ngày 20/11/2026: nhiều góc chụp và video để khách nghe tiếng bàn phím. Không đổi giá, tồn, checkout, cọc hoặc thanh toán.

## Sử dụng

- Admin → Bảng giá & kho → Chỉnh sửa → **Ảnh & sound test**. Với mục mới, lưu thông tin lần đầu; gallery xuất hiện ngay trên trang đó.
- Chọn nhiều ảnh cùng lúc, tối đa **10 ảnh/mục**, mỗi ảnh JPEG/PNG/WebP tĩnh ≤5 MB và 20 MP. Server đọc nội dung, bỏ metadata, chuyển WebP. Ảnh gallery thu gọn tối đa 1600px; ảnh bìa từ form cũ vẫn 1400px.
- Ảnh đầu là bìa trên danh sách/home/giỏ; dùng **Làm ảnh bìa**, **Trước**, **Sau**, **Gỡ ảnh**. Media lưu ngay; tên/giá/mô tả vẫn dùng Lưu thay đổi. Ảnh cũ được giữ và tự đưa vào gallery.
- Một sound test/mục: tải **MP4 ≤10 MB** (khuyến nghị H.264/AAC), hoặc link HTTPS YouTube/TikTok. Hai lựa chọn thay thế nhau; có thể gỡ sound test. Video lớn hơn dùng link ngoài.
- Khách mở chi tiết để vuốt ngang/chọn thumbnail/nút mũi tên; bàn phím hỗ trợ trái/phải/Home/End. Video có nút phát và âm lượng, không tự phát. Chuyển khỏi video sẽ dừng phát. YouTube chỉ tải iframe khi khách yêu cầu; TikTok mở link gốc.

## Dữ liệu và quyền

Migration `20261120041746_catalog_media_gallery.sql` thêm `products_services.image_paths`, `video_path`, `video_url`; không đổi bảng đơn/ledger/kho. Trigger đồng bộ `image_path` với ảnh đầu, tương thích form bìa cũ; gỡ bìa đưa ảnh kế tiếp lên. RPC `set_catalog_media` kiểm admin/Google/session sống, row lock, version và tồn tại object mới, giới hạn mảng/path/host, ghi audit. Payload lặp đúng trạng thái hiện tại có tính idempotent; dữ liệu khác với version cũ bị từ chối.

Bucket `catalog-videos` public chỉ dành nội dung sản phẩm được phép công khai, MP4 ≤10 MB, chỉ admin upload/delete. `catalog-images` giữ quyền hiện tại. Không thay quyền ảnh đơn/yêu cầu/portfolio. Ẩn sản phẩm không thu hồi URL asset đã biết: không tải thông tin khách/nội dung riêng lên catalog.

Upload lần lượt qua Server Actions; giữ request limit 12 MB. MP4 kiểm MIME/kích thước/cấu trúc ISO-BMFF có ftyp/moov/mdat, không giải mã/transcode codec. Mã hóa khác H.264/AAC có thể không phát trên mọi thiết bị; có đường mở video khi lỗi. Không thêm dependency.

Sau cập nhật, đọc lại DB để xử lý mất response sau commit. Chỉ dọn asset hết tham chiếu trong toàn catalog, kể cả mục lưu trữ. Khi chưa xác định trạng thái hoặc Storage lỗi, giữ file thay vì xóa nhầm; có thể còn orphan cần rà soát. Không xóa ảnh đang được mục khác dùng. DB và Storage không có transaction chung.

## Ma trận nghiệm thu local

| Phạm vi | Tiêu chí |
| --- | --- |
| Dữ liệu cũ | Ảnh bìa cũ thành ảnh đầu; không đổi giá/tồn/đơn |
| Upload | Chọn nhiều ảnh, giới hạn server, chặn file giả; MP4 phát cả hình và audio |
| Quản lý | Đổi bìa, sắp xếp, gỡ riêng; version cũ không ghi đè |
| Quyền | Guest/anon/phiên thu hồi không ghi; Storage chặn guest upload |
| Khách | Thumbnail, keyboard, vuốt cảm ứng; không autoplay, đổi ảnh dừng âm thanh; link thật |
| Responsive | Chromium 1440×1000 và 375×812 không tràn ngang; ảnh chụp admin/khách |

Kiểm thử: `tests/catalog-media.test.ts` và `scripts/verify-catalog-media-local.mjs` tích hợp hồi quy M1–M7. Chỉ fixture riêng, cleanup sau test, không dùng cookie admin thật. Chưa kiểm chứng iOS/Android vật lý hoặc mọi codec/video của shop; chưa triển khai HP.

Kết quả 20/11/2026: lint/typecheck/build đạt; `npm test` 65/65; DB security advisors không phát hiện vấn đề; hồi quy API/Chromium M1–M7 + storefront + gallery đạt. Có kiểm vuốt qua CDP touch, keyboard, giữ ảnh khi resize, MP4 fixture ghi bằng Chromium có track audio phát/giải mã được, không autoplay và chuyển ảnh dừng video. Đã xem ảnh chụp admin/khách ở 375/1440px. Fixture đã cleanup, Storage còn 5 object như trước thay đổi, không có lệch `image_path`/ảnh đầu. Backup local trước migration nằm trong output/backups (gitignored); không reset DB hoặc dùng phiên admin thật.

Ảnh QA: `output/playwright/catalog-gallery-{admin,buyer}-{desktop,mobile}.png`. Chạy riêng gallery bằng `npm run test:m7-local -- --catalog-media-only`; chạy đủ bằng `npm run test:m7-local`. Luồng có kiểm bảo toàn dữ liệu nhưng không thay nghiệm thu sound test thực tế trên loa/điện thoại của shop.
