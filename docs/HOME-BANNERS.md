# Banner sản phẩm nổi bật trên trang chủ

**Căn/cắt ảnh (cập nhật 20/11/2026):** khi chọn ảnh, admin thấy khung chữ nhật cố định 3:2, kéo chuột/chạm để căn, thanh phóng đại 1–3× và vị trí ngang/dọc dùng được bằng bàn phím. Có đặt lại khung và căn lại ảnh đang lưu mà không cần upload. Bấm Lưu banner mới ghi ảnh đã cắt; lỗi giữ draft/khung. Server xác thực admin, kiểm số nguyên/tỷ lệ/toạ độ trong ảnh sau chuẩn hóa EXIF, Sharp cắt rồi WebP; không đổi schema/RPC. Bản ảnh gốc không được lưu riêng: muốn lấy lại vùng đã bỏ sau khi lưu cần chọn lại ảnh gốc. Banner thật không bị cắt tự động; chỉ banner admin chủ động chỉnh/lưu thay ảnh.

Vùng ảnh khách dùng cùng tỷ lệ 3:2 trên desktop/mobile và contain để hiển thị đúng khung đã chọn, bỏ chiều cao clamp cũ. Hướng dẫn ảnh 1920×720/không cắt ở lịch sử bên dưới đã được thay thế. Tiêu đề/CTA, tự chuyển 4 giây, giới hạn 5 banner và quyền vẫn giữ nguyên.

| Trạng thái căn ảnh | Tiêu chí |
| --- | --- |
| Chọn ảnh ngang/dọc/vuông | Khung 3:2 có ảnh phủ kín, không kéo méo |
| Kéo/zoom/thanh vị trí | Vùng cắt luôn trong ảnh gốc, cảm ứng và bàn phím đều dùng được |
| Lưu | File WebP chứa đúng vùng đã chọn; ảnh đang dùng chỉ thay sau thành công |
| Khung sai/lỗi ảnh/lưu thất bại | Server chặn; giữ chữ và khung chọn để sửa/thử lại |
| Căn lại ảnh hiện tại | Đọc đúng object của slot sau guard admin; lưu asset mới, dọn asset cũ chỉ khi không còn tham chiếu |
| Trang khách | Tỷ lệ như preview, không thêm cắt responsive, slideshow vẫn dùng được |

Kiểm chứng bổ sung: `tests/banner-crop.test.ts` kiểm hình học portrait/landscape/square/zoom/cạnh và parser input xấu. `scripts/verify-banners-local.mjs` kiểm kéo chuột/cảm ứng, bàn phím, zoom, POST khung vượt ảnh, giữ draft khi lỗi, kích thước file WebP đã lưu, căn lại ảnh cũ và slideshow 1440/375px. Chạy bằng `node scripts/run-local-regression.mjs --banners-only`, chỉ slot fixture trống, không dùng cookie thật hay thay banner shop. Ảnh QA `output/playwright/banner-crop-{1440,375}.png`.

**Tự chuyển:** theo yêu cầu mới, khi có ≥2 banner, tự chuyển mỗi 4 giây và lặp về banner đầu. Tạm dừng khi hover chuột, focus bàn phím, chạm giữ hoặc tab không hiển thị; tiếp tục với chu kỳ đủ 4 giây sau đó. Có nút Tạm dừng/Tự chuyển. Người bật reduced-motion mặc định không tự chạy, vẫn có thể chủ động bật. Một banner không tạo timer/nút chuyển thừa. Những mô tả manual-only bên dưới là baseline trước thay đổi này.

Kiểm chứng tự chuyển: browser fixture đo thời gian thực (không chuyển ngay), chuyển tiếp, pause hover, nút dừng/phát và reduced-motion sau reload đạt; swipe/keyboard/link/hide/clear vẫn đạt. Lint/typecheck, 74 SQL/unit tests và build đạt. Không thay banner thật hoặc cấu hình admin.

**Bố cục cập nhật:** thay khung ảnh ngang có dải trống hai bên + thanh caption dưới bằng layout quảng bá: chữ/CTA bên trái trên nền vàng nhạt, ảnh bên phải trong vùng cao tối đa440px desktop. Mobile xếp chữ/CTA rồi ảnh 3:2. Ảnh dùng contain, không cắt sản phẩm hoặc sửa file admin đã tải. Hợp với ảnh sản phẩm thông thường, không bắt shop thiết kế ảnh có chữ theo tỷ lệ 1920×720. Chuyển banner/quyền quản lý/dữ liệu giữ nguyên; các mô tả caption phía dưới là baseline cũ.

Yêu cầu: admin chỉnh banner đầu trang để giới thiệu sản phẩm, tối đa 5 banner. Chạy trên PC, không deploy HP hoặc tự công khai nội dung thật.

## Hướng dẫn

1. Admin → **Banner trang chủ** (`/admin/banners`). Có 5 vị trí cố định, thứ tự hiển thị 1 → 5, bỏ qua vị trí đang ẩn.
2. Mở vị trí, nhập tiêu đề (120 ký tự), mô tả tùy chọn (240 ký tự), ảnh JPEG/PNG/WebP tĩnh ≤5 MB/20 MP và chọn sản phẩm đang công khai/có giá. Gợi ý ảnh ngang **1920 × 720 px**, ảnh chứa nội dung chính/chữ phải đủ lớn để đọc trên điện thoại. Server chuyển WebP tối đa 1920px, bỏ metadata; không cắt ảnh.
3. Tick **Công khai trên trang chủ**, bấm **Lưu banner**. Bỏ tick rồi lưu để tạm ẩn. Nháp được phép chưa đầy đủ thông tin. Sản phẩm ngừng công khai/lưu trữ thì banner tự ẩn với khách; cần chọn sản phẩm đang bán trước khi bật lại. Admin vẫn có thể lưu nháp/tắt banner liên kết sản phẩm đã ẩn.
4. **Gỡ nội dung banner này** → checkbox xác nhận → Xác nhận gỡ; giải phóng vị trí, không xóa sản phẩm. Sau khi gỡ vẫn mở form và hiện thông báo thành công.
5. Khách thấy banner ngay dưới header, thay phần hero minh họa khi có banner hợp lệ để không dồn hai banner mở đầu. Khi không có banner, hero cũ xuất hiện. Ảnh và nút **Xem sản phẩm** mở `/shop/{id}`. Tiêu đề/mô tả nằm riêng, không đè lên ảnh. Chuyển bằng nút/chấm/vuốt hoặc trái-phải/Home/End; không tự chạy. Chỉ một banner thì không hiện điều khiển thừa.

## Hợp đồng dữ liệu và quyền

- `20261120065732_home_banners.sql`: `public.home_banners`, 5 slot PK CHECK1–5, title/subtitle/image_path/product_id/active/version/updated_by/updated_at. Không grant write trực tiếp; RLS public chỉ active và sản phẩm+nhóm đang public/có giá, admin đọc cả nháp. Chỉ grant DTO columns, không grant updated_by cho anon/authenticated.
- RPC authenticated `save_home_banner` wrapper invoker → private definer kiểm admin Google/membership/session sống, row lock/version/idempotency; chỉ cập nhật slot đã có, không insert slot thứ6. Kiểm object tồn tại, đường dẫn UUID.webp, target product và nội dung bắt buộc khi publish. Ghi audit banner_saved/banner_cleared. Migration tiếp `20261120070527_banner_hidden_product_drafts.sql` cho lưu nháp/tắt banner đã liên kết sản phẩm ngừng bán.
- `home-banners` public bucket riêng ≤5MB WebP, chỉ admin upload/read listing/delete. Không thay bucket private. Ảnh banner được coi nội dung công khai kể cả khi nháp/ẩn: không tải dữ liệu khách hoặc nội dung riêng tư.
- Public homepage dùng client anonymous riêng, select allowlist, không mang cookie admin hoặc dùng service-role để đọc draft. Khi backend cấu hình nhưng lỗi, báo lỗi; không thay bằng banner mẫu. Chưa cấu hình thì không có banner và hero demo hiện tại vẫn có nhãn.
- Server Action xác thực quyền, validate input/ảnh thật bằng Sharp, upload trước RPC. Đọc lại trạng thái để hòa giải response thất lạc sau commit; chỉ dọn ảnh không còn tham chiếu ở bất kỳ banner nào. Lỗi kiểm tham chiếu/Storage có thể để orphan; giữ asset khi chưa xác định commit, không xóa nhầm ảnh đang dùng. Storage và SQL không có transaction chung.
- Không thay giá/kho/ledger/đơn, không thêm thư viện hay nguồn ảnh ngoài. Backup trước đổi schema: 64 bảng, 8 Storage objects tại output/backups (gitignored), không reset DB.

## Ma trận nghiệm thu

| Phần | Tiêu chí |
| --- | --- |
| Giới hạn/quyền | 5 vị trí, guest/anon/JWT thu hồi không ghi, không cập nhật trực tiếp bảng |
| Nội dung | Ảnh giả bị chặn, publish thiếu dữ liệu bị chặn, title/link nội bộ sản phẩm thật |
| Xung đột | Version cũ không ghi đè; cùng payload retry idempotent; khóa hàng ngắn |
| Public | Nháp/ẩn/sản phẩm ẩn không xuất hiện, admin không làm rò nháp lên home |
| UI | Upload/lưu/ẩn/gỡ xác nhận qua Server Actions; giữ chữ khi lỗi; desktop1440/mobile375 không tràn; ảnh contain |
| Tương tác | Dot/arrow/keyboard/touch chuyển đúng, CTA mở sản phẩm, không autoplay, fallback hero khi rỗng |

`tests/banners-db.test.ts` kiểm SQL trên schema fixture riêng. `scripts/verify-banners-local.mjs` tích hợp `npm run test:m7-local`; chạy riêng `npm run test:m7-local -- --banners-only`. Browser test chỉ dùng ≥2 vị trí trống, không ghi đè banner thật; nếu không đủ vị trí thì báo bỏ qua kiểm write UI. Cleanup theo updated_by fixture và danh sách asset riêng, giữ nội dung user khác đã sửa. Nếu shop đã dùng đủ vị trí, cần môi trường nghiệm thu riêng cho write. Ảnh QA `output/playwright/banner-{home,admin}-{1440,375}.png`.

Chưa nghiệm thu trên điện thoại vật lý, chưa nhập banner/ảnh quảng bá thật thay shop.

Kết quả local 20/11/2026: lint/typecheck/build đạt, 74 SQL/unit tests đạt, security advisors không phát hiện vấn đề. Hồi quy đầy đủ M1–M7 + storefront/accounts/gallery/banner đạt; buyer UI read-only đạt. Có kiểm upload ảnh giả/ảnh thật, giữ chữ khi lỗi, draft/public, CTA, dot/keyboard/CDP touch, auto-hide theo sản phẩm, lưu trạng thái ẩn và gỡ qua Server Actions với checkbox xác nhận. Đã xem ảnh admin/mobile và home desktop/mobile (1440/375px). Sau cleanup còn đúng 5 slot trống, 0 fixture users, 8 Storage objects như backup trước đổi và admin thật vẫn active. Không đưa nội dung QA lên thành banner shop, không gửi Gemini/Telegram trong test.
