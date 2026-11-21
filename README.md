# TRUMP Keys — nền tảng phát triển

Public HP/security: [báo cáo audit](docs/SECURITY-AUDIT.md), [lệnh HP chỉ đọc](docs/HP-PREFLIGHT.md), [triển khai/tunnel/monitor](docs/DEPLOYMENT.md), [backup/restore managed](docs/HP-BACKUP-RESTORE.md). Bộ triển khai được kiểm trên PC; chưa public hoặc xác minh HP.

Bộ khung PWA cho cửa hàng dịch vụ mod/custom bàn phím, dựa trên [đặc tả gốc](SPEC.original.txt). **Đây là bản nền chạy local với dữ liệu minh họa, chưa nhận đơn thật.**

## Khởi chạy

Cần Node.js 24 LTS và npm. Không cần tài khoản cloud, database hoặc `.env` để chạy demo.

```sh
npm ci
npm run dev
```

Mở [localhost:3000](http://localhost:3000). Xem thử đơn [KB-DEMO2026](http://localhost:3000/track/KB-DEMO2026).

## Tài liệu phát triển

- **[Cửa hàng & khách tự mua](docs/STOREFRONT.md)**: [xem ảnh/giá sản phẩm](http://localhost:3000/shop), chi tiết, giỏ hàng và checkout tạo đơn/QR chờ admin xác nhận. `npm run test:storefront` kiểm luồng mua và các module cũ.

- **[M4 — đặt tìm & portfolio](docs/M4-REQUESTS-PORTFOLIO.md)**: khách gửi [yêu cầu không cọc](http://localhost:3000/preorder), admin xử lý tại [hộp yêu cầu](http://localhost:3000/admin/requests), [quản lý portfolio](http://localhost:3000/admin/portfolio) và chọn công khai ảnh/sound test. `npm run test:m4-local` kiểm toàn bộ luồng bằng fixture riêng.

- **[QR chuyển khoản Agribank](docs/BANK-PAYMENT.md)**: QR theo cọc 20%/full 100%, nội dung đối soát riêng, admin xác nhận thủ công; tách khỏi QR tra cứu.

- **[Giao diện quản trị](docs/ADMIN-UI.md)**: tổng quan công việc, menu riêng, lọc/tìm đơn, tab thao tác, quản trị viên tách riêng; phân biệt QR tra cứu với QR thanh toán.

- **[M3 — đơn hàng, cọc/COD, QR và tracking](docs/M3-ORDERS.md)**: quản lý tại [admin/orders](http://localhost:3000/admin/orders), cập nhật tiến độ/ảnh private, hủy và hoàn phần vượt cọc. Cần secret chỉ ở server runtime. Chưa triển khai HP; xem giới hạn sửa đơn/thanh toán và UAT trong tài liệu.

- **[M2 — quản lý catalog/tồn kho](docs/M2-CATALOG.md)**: đã có thêm/sửa/đăng/ẩn/lưu trữ, upload ảnh, lịch sử kho và bảng giá thật. Truy cập [admin/catalog](http://localhost:3000/admin/catalog) để nhập giá cho 8 gói lube nháp.

- **[M1 Auth/admin trên PC](docs/M1-AUTH.md)**: Google login và admin thật đã được người dùng xác nhận; kiểm thử phiên/quyền và hồi quy local đạt. Dùng `.env.local.example` khi làm trên PC.

- [Triển khai HP Ubuntu/Docker/Cloudflare](docs/DEPLOYMENT.md): Compose `trumpkeys-hp`, loopback dự kiến 8094, cấu hình env, cập nhật/rollback/backup. Chưa triển khai lên HP; SSH hiện bị từ chối khóa.

- **[Yêu cầu TRUMP Keys đã chốt sau M0](docs/REQUIREMENTS.md)**: thương hiệu, Google/admin invite, 3 bước đơn, cọc/COD, Gemini → Zalo và Telegram. Ưu tiên tài liệu này khi khác baseline. Giao diện demo chưa được đổi thương hiệu trong lần ghi nhận yêu cầu.

- [Kế hoạch 8 mốc, phụ thuộc và nghiệm thu](docs/PLAN.md): M0 nền tảng → M1 Auth/DB → M2 catalog/tồn kho → M3 đơn/QR/tracking → M4 preorder/portfolio → M5 chat/thông báo → M6 báo cáo → M7 phát hành.
- [Mô hình dữ liệu, quyền truy cập và transaction](docs/DATA-MODEL.md).
- [Hướng thiết kế và responsive](docs/DESIGN.md).
- [Hướng dẫn cho các lần phát triển tiếp](AGENTS.md).

## Đã có trong M0

- Next.js 16.4.6, React 19.3, TypeScript strict, CSS tokens theo đặc tả, tiếng Việt.
- Trang chủ responsive, 4 nhóm dịch vụ; native dialog ở desktop và dạng sheet ở mobile.
- Ước tính theo đơn vị/số lượng, kiểm tồn kho mẫu, tổng VND nguyên, bỏ món và sao chép cấu hình (có bản văn bản thay thế).
- Trang tracking render ở server, timeline mẫu, thông tin liên hệ đã che, mã sai trả 404, metadata noindex và response no-store.
- Quick replies tư vấn local; trang preorder/admin thể hiện rõ chưa kết nối.
- Manifest/icon PNG, hướng dẫn cài iOS/Android, Service Worker chỉ cache trang offline tĩnh.
- Kiểm thử logic nghiệp vụ bằng Node test runner; GitHub Actions chạy lint, typecheck, test, build.

M1 đã nối Google/Supabase local và người dùng đã vào admin. M2 đã có catalog, upload ảnh công khai, nhập/điều chỉnh tồn có lịch sử và ước tính lấy dữ liệu thật; thương hiệu TRUMP Keys đã được áp dụng. Tám gói lube vẫn là nháp chưa nhập giá, không có báo giá mẫu công khai trong backend đang kết nối. Chưa có đơn/QR thật, Gemini/webhook hoặc báo cáo. Giỏ ước tính vẫn nằm trong state, reset khi reload/rời trang.

## Cấu trúc

```text
src/app/                  route, layout, error/not-found
  track/[code]/           tracking capability thật + KB-DEMO2026 có nhãn mẫu
  admin/                  login, join, dashboard quyền có server guard
  auth/callback/          PKCE callback, không auto-bootstrap
  preorder/               hướng dẫn chuẩn bị yêu cầu
src/components/           tương tác catalog/ước tính và cài PWA
src/lib/                  domain types, dữ liệu mẫu, quy tắc tính tiền/tra cứu
tests/                    logic tiền/stock/auth + SQL/RLS bằng PGlite
supabase/                 CLI config, migration M1, seed 4 nhóm
public/                   manifest, offline fallback, SW, hình SVG và icon
scripts/                  sinh lại hình minh họa/icon gốc
docs/                     kế hoạch, dữ liệu, thiết kế, kết quả kiểm tra
.github/workflows/ci.yml   kiểm tra khi push/PR
```

## Lệnh kiểm tra

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`typecheck` tạo route types trước khi chạy TypeScript, dùng được trên checkout mới. `npm run assets` sinh lại SVG bàn phím và các icon từ mã nguồn (Sharp chỉ là dev dependency). CI dùng Node 24 và lockfile npm. Không chỉnh tay `node_modules` hoặc `.next`.

## Kiểm tra PWA

Service Worker chỉ đăng ký trong production để không gây cache nhiễu khi phát triển. Chạy `npm run build` rồi `npm start`, mở localhost, tải lại một lần sau khi SW activate. Trong DevTools Application kiểm manifest/icon, Service Workers và Cache Storage: chỉ có `/offline.html`. Chuyển Network sang Offline và tải lại: phải thấy trang kết nối lại. Bật mạng và retry: lấy nội dung mới từ server.

HTTPS bắt buộc ngoài localhost. iOS dùng Safari → Chia sẻ → Thêm vào MH chính; không có API buộc hiện prompt cài trên iOS. Android/desktop chỉ có prompt nếu trình duyệt hỗ trợ và đáp ứng điều kiện cài đặt. Khả năng cài cần kiểm tra trên thiết bị thật trước phát hành. Tăng version cache khi sửa offline shell; worker mới chờ vòng đời trình duyệt thay vì ép reload mất bản nháp.

## Tiếp tục nghiệm thu M1

1. Theo [M1-AUTH.md](docs/M1-AUTH.md), khởi động Docker-compatible Engine trên PC rồi `npm run db:start`. Chưa cần Supabase cloud hoặc HP.
2. Tạo Google OAuth Web client, cấu hình callbacks và secret ở `supabase/.env`, bật provider Google.
3. Copy `.env.local.example` thành `.env.local`, điền publishable key local. App chỉ dùng server-side Supabase, không có client key trong bundle.
4. Đăng nhập Google, lấy user UUID; dùng script operator bootstrap email đã chốt. Không có route web bootstrap hoặc fake login.
5. Kiểm advisors, sinh types từ stack local, thử nhiều tài khoản/phiên và các luồng thất bại trước khi đánh dấu M1 hoàn thành.

Không có môi trường production, migration đã áp dụng hay dịch vụ cloud nào được tạo bởi bản nền này.
# Tư vấn và thông báo (M5)

Đã có `/chat`, `/admin/chat` và `/admin/notifications`. Gemini và Telegram mặc định tắt khi chưa cấu hình. Xem [hướng dẫn M5](docs/M5-CHAT-NOTIFICATIONS.md) cho credential server-only, worker và giới hạn kiểm chứng.

# Báo cáo tiền (M6)

Mở **Admin → Tiền thực thu** để lọc thu/hoàn theo ngày hoặc tháng và kiểm tra COD đang chờ. Không tính lợi nhuận. Xem [hướng dẫn M6](docs/M6-CASH-REPORTS.md). Kiểm thử đầy đủ local: `npm run test:m6-local`.

# Chuẩn bị vận hành (M7)

Đã bổ sung hướng dẫn mua hàng `/guide`, thông tin riêng tư `/privacy` và **Admin → Chuẩn bị vận hành**. Người quản lý shop vẫn cần nhập/duyệt nội dung thật và UAT thiết bị; chưa deploy HP. Xem [M7](docs/M7-READINESS.md), kiểm thử bằng `npm run test:m7-local` và `npm run test:container`.

# Sao lưu và khôi phục local

`npm run backup:drill` tạo backup DB + Storage + source/config và thử phục hồi trong database/thư mục riêng, không ghi đè hệ thống đang dùng. Backup chứa dữ liệu nhạy cảm, được bảo vệ ở `output/backups/trumpkeys-local/`. Xem [hướng dẫn](docs/LOCAL-BACKUP-RESTORE.md); chưa có bản sao ngoài PC hoặc triển khai HP.

