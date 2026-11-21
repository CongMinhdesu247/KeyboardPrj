# M4 — Đặt tìm mẫu và portfolio trên PC

M4 bổ sung đặt tìm không cọc và nội dung công khai do admin chọn. Không triển khai HP, không thay quy tắc đơn/cọc/tồn kho của M3.

## Cách sử dụng

### Khách gửi yêu cầu

Mở `/preorder`, nhập tên, SĐT/Zalo, loại keycap/stabilizer, ngân sách (0 nếu chưa chốt), ghi chú và ít nhất một ảnh hoặc link HTTPS. Chọn đồng ý để shop liên hệ rồi gửi. Ảnh JPEG/PNG/WebP tối đa 5 MB/20 MP, reencode WebP và bỏ metadata. Khi thành công có mã tiếp nhận FT để đối chiếu khi liên hệ shop; mã này không mở trang chứa thông tin khách.

Yêu cầu không phải đơn mua hàng, không có QR thu tiền, không giữ/trừ tồn, không tự tạo đơn. Shop kiểm tra khả năng tìm mẫu rồi tư vấn. Chưa hứa thời gian có hàng. Nếu chốt mua, admin tạo đơn theo M3 riêng, không tự chuyển yêu cầu thành đơn hoặc tự nhận cọc.

### Admin xử lý

Mở `/admin/requests`, lọc/tìm theo tên, SĐT hoặc ghi chú. Ảnh/link mẫu và ghi chú chỉ admin xem. Mở “Cập nhật xử lý yêu cầu”, chọn trạng thái và ghi chú nội bộ. Dashboard có số yêu cầu mới. Khi đã lưu, tải lại dữ liệu trước khi sửa tiếp.

| Trạng thái | Ý nghĩa | Thao tác được phép |
| --- | --- | --- |
| Mới nhận | Chưa liên hệ/xử lý | Chuyển Đã liên hệ hoặc Đã xử lý, ghi chú |
| Đã liên hệ | Đã trao đổi, đang tìm/chờ thông tin | Ghi kết quả, chuyển Đã xử lý hoặc mở lại Mới nhận |
| Đã xử lý | Đã chốt kết quả của yêu cầu | Có thể mở lại nếu cần tiếp tục trao đổi |

Đây là trạng thái hộp tiếp nhận, không phải ba bước tuần tự của đơn hàng. Không tự gửi SMS/Zalo/Telegram khi đổi trạng thái; shop liên hệ bằng kênh hiện có, Telegram thuộc M5.

### Đăng portfolio

Mở `/admin/portfolio`, thêm tên bài, cấu hình bàn phím, các mod, mô tả, ảnh và link sound test. Bản nháp được phép chưa có ảnh. Công khai cần ảnh và chọn xác nhận đã kiểm tra quyền sử dụng, thông tin riêng tư.

Tại chi tiết đơn → Lịch sử, mỗi ảnh WebP có nút “Chọn ảnh tạo portfolio”. Trang mới cho xem trước đúng ảnh đã chọn. Lưu sẽ tải/reencode thành bản riêng trong bucket portfolio; không thay/xóa ảnh gốc, không tự đưa ảnh hay nội dung riêng tư khác vào bài. Ảnh/video có sẵn vẫn phải được admin kiểm tra thực tế, chương trình không tự phát hiện SĐT/địa chỉ in trong ảnh.

| Bài | Public | Hành vi |
| --- | --- | --- |
| Nháp | Không | Chỉnh sửa, thay ảnh hoặc công khai sau xác nhận |
| Công khai | Có | Hiện trong homepage/portfolio; sửa public cần xác nhận lại |
| Bỏ Công khai | Không cấp URL xem mới | Lưu nội dung/ảnh để sửa tiếp |
| Lưu trữ | Không cấp URL xem mới | Giữ bản ghi/ảnh, loại khỏi danh sách đang quản lý; chưa có khôi phục qua UI |

Public ở `/portfolio` (tối đa 60 bài gần nhất), homepage tối đa 12 bài. Tìm theo cấu hình/mod khi danh sách có hơn 6 bài. Admin hiển thị 200 mục gần nhất mỗi module; cần thêm phân trang trước khi vận hành vượt giới hạn này.

YouTube chỉ tạo iframe `youtube-nocookie.com` khi khách bấm Mở sound test, không autoplay. TikTok mở bằng link HTTPS ra ngoài. Không nhận HTML nhúng, không fetch link tham khảo của khách ở server. Chưa kiểm chứng phát video thật/thiết bị thật trong kiểm thử tự động.

## Dữ liệu, quyền và chống gửi trùng

- Migration `20261119132910_requests_portfolio.sql`: bảng `private.custom_requests`, `request_budgets`, `portfolio_items`, index/constraints/RLS. Không grant đọc/ghi bảng trực tiếp cho anon/authenticated.
- Intake dùng Server Action, token form HMAC có hạn một giờ, ID riêng và SHA256 của nội dung chuẩn hóa/ảnh. Token giữ ổn định trong form kể cả re-render sau cookie/lỗi. Gửi lại cùng token+nội dung trả lại cùng kết quả; đổi nội dung của token đã dùng bị chặn. Không dùng token để đọc thông tin request.
- Khách không được upload/read trực tiếp Storage hoặc gọi RPC ghi dữ liệu. Chỉ server dùng secret gọi submit/lookup/budget. Admin read/update luôn kiểm Google identity, membership và live session ở server/DB.
- Cookie `tk-find-visitor` ký HMAC, HttpOnly, SameSite=Lax, Secure khi HTTPS, giới hạn `/preorder`, một giờ. Quota DB: 10 lượt thử/visitor/giờ, 100 lượt toàn shop/giờ; bản local dùng địa chỉ `local`. Chỉ tin IP proxy nếu `TRUST_PROXY_IP=true` đã được xác minh. Có honeypot và Next same-origin checks. Đây là giới hạn bản đầu; cần WAF/CAPTCHA và tuning tải trước public để tránh kẻ xấu chiếm quota chung.
- Ảnh mẫu ở `request-images` private, chỉ admin có signed URL 300 giây. Không có endpoint khách đọc yêu cầu, nên guest A/B không thể đọc ảnh hay liên hệ của nhau.
- Ảnh portfolio ở `portfolio-media` private, chỉ server ký sau khi đọc manifest published; public DTO chỉ có nội dung bài/ảnh được chọn. Không kèm SĐT, note nội bộ, mã tracking, ledger hoặc ảnh khác trong đơn. URL đã cấp/chụp lại có thể dùng tối đa thời hạn ký; unpublish không thể thu hồi ảnh đã tải về máy.
- Metadata và Storage là hai dịch vụ: file tải xong mới commit metadata. Business rejection xác định thì cleanup file của chính attempt. Network timeout không chắc commit sẽ lookup lại; không xóa file có thể đang được bản ghi tham chiếu. Orphan trong lỗi bất định và ảnh cũ khi thay thế cần công cụ đối soát Storage trước phát hành; chưa tự xóa vì retention chưa chốt.
- Không cache preorder/admin/private response bằng SW. Portfolio/ảnh ký cũng không đưa vào SW; tải lại trang nếu URL hết hạn. Chưa tự xóa request/ảnh theo ngày, chưa tự đưa ảnh tracking/request lên public.

## Kiểm thử và vận hành

**Kết quả local:** 35/35 SQL/unit tests đạt; integration API và Chromium M1–M4 đạt, gồm ảnh private, form khi mất mạng, token ổn định, nháp/công khai/ẩn/lưu trữ và copy ảnh gốc. Lint/typecheck/build đạt; advisors không có findings; secret server không xuất hiện trong browser assets. Đã xem ảnh mobile/desktop. Fixture request/account đã cleanup, không còn portfolio mẫu công khai. Chưa coi là UAT điện thoại/video thật hoặc phát hành production.

- `npm test`: SQL chạy tất cả migration từ DB sạch; kiểm quyền anon/non-admin, quota, retry/idempotence, version conflict, không đụng đơn/kho, draft/publish approval/hide/archive và stale session.
- `npm run test:m4-local`: Supabase thật + Chromium fixture riêng, hồi quy M1–M3 và QR ngân hàng. M4 kiểm ảnh giả/lỗi giữ form, mất mạng giữ nội dung, token form ổn định sau lỗi và RPC gửi đồng thời không tạo trùng, inbox, ảnh private không mở công khai, copy đúng ảnh của đơn, thiếu xác nhận không publish, publish xuất hiện trên home/portfolio, click-to-load video, hide/archive và ảnh gốc còn nguyên, mobile/desktop.
- Video bên ngoài được stub trong E2E để kiểm URL/điều khiển, không coi là chứng minh chất lượng sound test hoặc khả năng phát từ YouTube/TikTok.
- Ảnh QA ở `output/playwright/m4-*`; backup trước migration `output/backups/pre-m4.sql`, gitignored và có dữ liệu private. Không reset DB có tài khoản thật. Cleanup fixture theo actor/ID/run marker, không xóa dữ liệu người dùng.
- M4 chưa có dữ liệu nội dung shop thật. Bạn của chủ dự án nhập portfolio/ảnh/video đã được phép sử dụng. Chốt retention, thử UAT và restore backup trước phát hành cùng M7.

Tham khảo: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [database functions](https://supabase.com/docs/guides/database/functions). API Server Action/cookies đối chiếu tài liệu đi kèm Next 16.4.6 trong `node_modules/next/dist/docs/`.
