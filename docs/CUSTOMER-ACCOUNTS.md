# Tài khoản khách hàng và quản lý người dùng

**Dashboard cập nhật:** đồ thị chuyển sang `/admin`, Recharts hai đường đăng ký/hoạt động với 4 khoảng thời gian và bảng số liệu. Danh sách `/admin/customers` đổi thành bảng, giữ toàn bộ tìm/lọc/phân trang/xác nhận cấm/bỏ cấm/xóa quyền. Migration bổ sung ngày hoạt động private, không dựng lịch sử trước thời điểm bắt đầu. Xem [ADMIN-DASHBOARD.md](ADMIN-DASHBOARD.md).

## Cập nhật hồ sơ và giao diện

Theo yêu cầu mới: `/account` chỉ hiển thị hồ sơ, không dựng bảng đơn hoặc tổng đơn. Bố cục sidebar nhận diện bằng chữ cái tên + menu, form tên/SĐT/địa chỉ ở khối chính; email Google chỉ đọc, đăng xuất riêng. Mobile xếp một cột, menu gọn. Đơn mua chuyển sang `/account/orders`, vẫn owner-only và phân trang; không mất tính năng hay dữ liệu.

Migration `20261120054025_customer_profile.sql` thêm `private.accounts.phone/address` mặc định rỗng; RPC `update_customer_profile` chỉ sửa tên/SĐT/địa chỉ của chính phiên Google đang active, có validation, row lock, version và retry idempotent. Không nhận target user/role/email từ form; không sửa Auth identity hoặc membership. Refresh identity Google cập nhật email nhưng không ghi đè tên khách đã tự lưu. Phone/address không đưa vào report admin hoặc DTO public.

Checkout điền sẵn dữ liệu hồ sơ và vẫn cho đổi người nhận của riêng đơn đó; không tự sửa hồ sơ khi đặt đơn, không nhập ngược địa chỉ đơn cũ vào hồ sơ và không đổi snapshot đơn đã có. Form hồ sơ giữ draft khi validation/lỗi mạng, báo thành công, focus ô lỗi, khóa nút trong lúc lưu. SĐT và địa chỉ không bắt buộc ở hồ sơ, vẫn cần dữ liệu phù hợp khi đặt hàng.

Thanh tiện ích Tài khoản/Hướng dẫn/Tra cứu dùng SVG nét đồng bộ, điểm nhấn vàng, hover/focus/current-page, ba vùng chạm trên mobile. Tra cứu dùng neo native để bấm lặp lại vẫn cuộn đúng. Không thêm dependency, avatar ngoài hoặc thông tin tin cậy giả. Backup trước migration gồm 64 bảng/7 object, trong output/backups gitignored.

Kiểm chứng cập nhật hồ sơ: 73 SQL/unit tests đạt, gồm quyền riêng tư, dữ liệu sai, stale version và giữ tên sau refresh Google. Hồi quy đầy đủ M1–M7/storefront/gallery/accounts, buyer UI 375/1440, lint/typecheck/build và security advisors đạt. Đã thử lưu/reload/chuẩn hóa SĐT, giữ draft khi validation/mất mạng, checkout điền sẵn, logout thật của fixture, đơn ở trang riêng và không còn hàng đơn trong hồ sơ. Đã xem screenshots desktop/mobile; chưa thử bàn phím ảo/thiết bị vật lý. Khi kiểm thử phát hiện CTA giỏ có thể bấm trước hydration, đã tái sử dụng useCartReady để chỉ bật khi tương tác sẵn sàng; không đổi giá/tồn/đặt đơn.

Yêu cầu bổ sung 20/11/2026: đăng ký/đăng nhập Google cho khách, phân quyền và gắn đơn với người đặt; admin thống kê tài khoản, xem đồ thị, cấm/bỏ cấm và xóa quyền truy cập. Ưu tiên hơn mô hình guest checkout trước đây.

## Luồng sử dụng

- Website → **Tài khoản** → **Tiếp tục với Google**. Lần đầu tạo tài khoản khách tự động, không có mật khẩu riêng và không cấp quyền admin. `/account` là hồ sơ; `/account/orders` liệt kê đơn chính chủ, phân trang 20 đơn.
- Khách xem hàng/giỏ không cần đăng nhập; đặt đơn mới cần Google đã xác minh và phiên đang được phép dùng. Giỏ localStorage được giữ; Mua ngay lưu lựa chọn item/số lượng qua OAuth bằng cookie HttpOnly giới hạn đường `/checkout`, không cho redirect tùy ý.
- Đơn cũ vẫn có mã/link tra cứu; không tự nhận đơn cũ dựa vào tên/email/SĐT và không đổi ledger/tồn/cọc. Đơn mới gắn `customer_user_id` theo phiên server/DB, không nhận user ID từ form. Không dùng `actor_id` admin để ghi người mua.
- Admin → **Tài khoản người dùng** (`/admin/customers`): tìm tên/email, lọc vai trò/trạng thái, phân trang, xem số đơn và mở danh sách đơn đã lọc cho tài khoản. Admin hiện có và membership từng được cấp/thu hồi vẫn được bảo vệ khỏi thao tác cấm/xóa ở màn hình khách; quản lý admin tại Team như trước.
- Tổng đăng ký = hồ sơ hiện có + đã xóa quyền truy cập. Khách/admin đếm hồ sơ hiện có; bị cấm vẫn nằm trong hiện có. **Hoạt động 30 ngày** = tài khoản được phép sử dụng và có request xác thực trong 30 ngày gần nhất, không phải online realtime. `last_seen_at` cập nhật tối đa mỗi 5 phút khi có truy cập web; không có heartbeat/ghi hoạt động giả.
- Đồ thị số đăng ký mỗi ngày trong 30 ngày theo Asia/Ho_Chi_Minh, dựa vào thời điểm Auth tạo tài khoản, gồm cả hồ sơ bị cấm/xóa sau đó. Có bảng số liệu dễ đọc bằng bàn phím/điện thoại. Số liệu toàn hệ thống, không bị giới hạn bởi trang đang xem.
- Cấm/bỏ cấm/xóa cần lý do và checkbox xác nhận trong dialog hỗ trợ Escape. Cấm hoặc xóa thu hồi `auth.sessions`; JWT cũ không được đọc đơn riêng/tạo đơn/redeem quyền. Bỏ cấm yêu cầu đăng nhập mới.
- **Xóa là xóa quyền truy cập vĩnh viễn (logical deletion)**: giữ hồ sơ Auth, hồ sơ tài khoản, đơn, tiền và audit; ẩn khỏi danh sách mặc định, có bộ lọc xem lại. Không gọi Auth hard-delete, không xóa/ẩn danh toàn bộ PII, không tự cho đăng ký lại cùng Google hoặc bỏ xóa. UI giải thích trước xác nhận. Mã tra cứu đã có vẫn giữ phạm vi chia sẻ riêng như chính sách trước.

## Dữ liệu, quyền và tương thích

- Migrations `20261120050333_customer_accounts.sql` và `20261120050805_account_order_safety.sql`: `private.accounts` có RLS, không có grant trực tiếp; FK Auth; trigger Google identities + backfill + touch sau login, không tin metadata để quyết định role. Tên hiển thị chỉ là nội dung trình bày.
- RPC authenticated: `touch_account`, `my_orders`, `submit_account_order`; RPC admin-only: `account_report`, `manage_account`, `customer_orders`. Private security definer có kiểm Google/live-session và owner; public wrapper security invoker, revoke PUBLIC/anon. Tất cả chỉ lấy DTO cần thiết.
- `private.has_live_session` kiểm cả trạng thái tài khoản để thu hồi ngay mọi đường nghiệp vụ hiện có. Trigger khóa hàng account và bảo vệ promotion/ban đồng thời; tạo đơn khóa share account trước lệnh checkout. Ban không xóa đơn đang xử lý.
- `submit_account_order` dùng transaction/lock/idempotency của checkout cũ, kiểm owner trước retry rồi gắn chủ đơn trong cùng transaction. Guest RPC cũ vẫn service-only cho tương thích dữ liệu và kiểm thử; Server Action đặt hàng mới luôn yêu cầu account, không có public guest bypass.
- OAuth callback cũ giữ nguyên URL đã cấu hình. Cookie intent enum đưa khách về account/checkout và admin về admin; không đọc arbitrary `next` URL, không thay Google client/secret. Proxy refresh cookie và chạm hoạt động; route account/checkout có no-store. SW vẫn chỉ cache offline fallback.
- Dữ liệu cũ và tài khoản admin thật được giữ; backup trước thay đổi gồm 63 bảng/7 Storage objects trong output/backups gitignored. Không reset DB, không HP/đổi DNS.

## Ma trận kiểm chứng

| Nhóm | Tiêu chí |
| --- | --- |
| Auth | Google verified + session sống; metadata không cấp quyền; anon vào account được chuyển login |
| Đơn | Khách A chỉ liệt kê đơn A, B không thấy; không nhận user ID form; retry không đổi chủ/trừ kho |
| Admin | Tổng/đồ thị/lọc/phân trang đúng dữ liệu; scope đơn theo tài khoản; khách không gọi RPC quản lý |
| Cấm/xóa | Thu hồi phiên; JWT cũ bị chặn; bỏ cấm không hồi sinh phiên; xóa giữ đơn; admin được bảo vệ |
| UI | Desktop 1440px/mobile 375px không tràn; dialog Escape; form checkout giữ dữ liệu khi mất mạng |

`tests/accounts-db.test.ts` dùng database fixture riêng; hồi quy API/Chromium trong `npm run test:m7-local` có hai khách riêng, admin riêng, cleanup cả đơn theo customer_user_id, không dùng cookie thật và tắt tích hợp gửi ngoài. Có thể chạy riêng `npm run test:m7-local -- --accounts-only`.

Chưa nghiệm thu Google OAuth khách bằng tài khoản/điện thoại thật sau thay đổi; fixture identity/session không thay thế việc này. Nếu Google OAuth consent còn chế độ Testing, người vận hành cần thêm email thử nghiệm trong Google Console hoặc hoàn tất phát hành ứng dụng OAuth. Chưa triển khai HP, không cấu hình retention/xóa cá nhân tự động.

Kết quả ngày 20/11/2026: lint/typecheck/build đạt; 71 SQL/unit tests đạt, gồm phân trang hơn 20 tài khoản, private orders, ban/unban/delete và bảo vệ admin. Hồi quy đầy đủ API/Chromium M1–M7/storefront/gallery/accounts đạt; kiểm riêng accounts không có pageerror/console warnings, dialog Escape và xác nhận mới mỗi thao tác đạt. Buyer UI read-only và điều hướng Mod 375/1440px đạt. Đã xem ảnh QA admin/khách desktop/mobile; ảnh ở `output/playwright/accounts-admin-{1440,375}.png` và `customer-account-{1440,375}.png`.

`node scripts/verify-customer-oauth.mjs` xác nhận Server Action tạo handoff Google/PKCE đúng callback, cookie HttpOnly giữ Mua ngay và xử lý callback thiếu code về login an toàn; chặn request trước khi tới Google, không giả lập thành công OAuth. Sau cleanup không còn fixture users, còn đúng 7 Storage objects và admin thật vẫn active. Không gửi AI/Telegram thật trong hồi quy.
