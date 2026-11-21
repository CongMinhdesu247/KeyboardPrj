# Kế hoạch triển khai TRUMP Keys

**Khung căn ảnh banner:** crop 3:2 ngay form, kéo/zoom/chỉnh ngang-dọc bằng chuột/cảm ứng/bàn phím; Sharp cắt ở server, giữ guard/version/cleanup và không đổi DB. Ma trận nghiệm thu: [HOME-BANNERS.md](HOME-BANNERS.md).

**Security/public HP (20/11/2026):** quota checkout đã chuyển xuống RPC account, không thể bỏ qua bằng gọi Supabase trực tiếp; proxy trusted CF-IP/exact Origin/429, readiness DB và image pin digest. Chuẩn bị tunnel riêng theo yêu cầu mới, backup managed/drill container riêng. Ma trận nghiệm thu và giới hạn: [SECURITY-AUDIT.md](SECURITY-AUDIT.md), [DEPLOYMENT.md](DEPLOYMENT.md), [HP-BACKUP-RESTORE.md](HP-BACKUP-RESTORE.md). Chưa triển khai/đổi DNS/kiểm tài nguyên HP; thay mô tả tunnel dùng chung ở lịch sử bên dưới.

**Hộp thông báo admin:** chuông toàn khu vực quản trị, cập nhật 30 giây/focus, trang `/admin/inbox` lọc/phân trang, đọc riêng từng admin; dùng outbox hiện có, không đổi ledger/kho/Telegram. Ma trận nghiệm thu: [ADMIN-INBOX.md](ADMIN-INBOX.md).

**Dashboard tài khoản:** KPI toàn bộ đăng ký/hoạt động30ngày/mới tháng/tỷ lệ; Recharts hai đường với 7/30/90/365 ngày, bảng tài khoản giữ tìm/lọc/phân trang và xác nhận. RPC `account_growth` chỉ admin/live session; lịch sử hoạt động bắt đầu từ migration, không dựng số liệu quá khứ. Trạng thái và tiêu chí: [ADMIN-DASHBOARD.md](ADMIN-DASHBOARD.md).

**Trang ước tính riêng:** `/estimate` thay khối ước tính trên home; menu và footer liên kết trang mới, nhóm dịch vụ home mở đúng bảng giá. Ma trận nghiệm thu và kiểm tra: [STOREFRONT.md](STOREFRONT.md).

**Banner nổi bật:** thêm trang admin `/admin/banners` 5 vị trí, ảnh tối ưu/chọn sản phẩm/publish-hide-clear, slideshow manual đầu home với touch/keyboard. RLS và version bảo vệ dữ liệu, giữ hero cũ khi rỗng. [HOME-BANNERS.md](HOME-BANNERS.md).

**Hồ sơ cá nhân:** `/account` tập trung chỉnh tên/SĐT/địa chỉ và đăng xuất, đơn mua ở `/account/orders`. Form lưu thật, giữ lỗi/draft, checkout điền sẵn; utility links có icon và trạng thái responsive. Chi tiết và ma trận quyền: [CUSTOMER-ACCOUNTS.md](CUSTOMER-ACCOUNTS.md).

**Tài khoản khách và thống kê:** Google signup/login, account orders, owner checkout, trang admin tài khoản/đồ thị/tìm-lọc-phân trang/cấm/bỏ cấm/xóa quyền truy cập. Đơn cũ/admin/ledger giữ nguyên; ma trận nghiệm thu và giới hạn: [CUSTOMER-ACCOUNTS.md](CUSTOMER-ACCOUNTS.md).

**Gallery sản phẩm (20/11/2026):** nhiều ảnh/sắp xếp/đổi bìa và một sound test MP4 hoặc YouTube/TikTok, gallery vuốt/chọn ảnh phía khách. Migration bổ sung giữ dữ liệu cũ; không đổi giá/tồn/đơn. Ma trận nghiệm thu tại [CATALOG-MEDIA.md](CATALOG-MEDIA.md).

**Rà soát toàn bộ UI người mua:** đồng bộ ảnh/form và các trang hỗ trợ–tra cứu với cửa hàng; checkout gọn, xử lý lỗi ảnh/mạng và tải giỏ rõ ràng. Ma trận nghiệm thu trong [STOREFRONT.md](STOREFRONT.md), phạm vi/bằng chứng/giới hạn ở [UI-REVIEW.md](UI-REVIEW.md). Không đổi nghiệp vụ, URL, dữ liệu hoặc triển khai HP.

**Tinh gọn UI/UX theo yêu cầu:** cải thiện phân cấp, chữ, menu admin và luồng nhìn trên khách/admin; giữ nghiệp vụ/API. Phạm vi, ma trận nghiệm thu và giới hạn ở [UI-REVIEW.md](UI-REVIEW.md).

**Sau M7-PC — backup/restore local đã kiểm chứng:** backup logical DB+Storage bytes+source/config, checksum, phục hồi vào database/tệp riêng, đối chiếu63bảng/2object, quyền và báo cáo tiền đạt. Không restore đè, không reset, không gửi credential/payload ra ngoài. Xem [LOCAL-BACKUP-RESTORE.md](LOCAL-BACKUP-RESTORE.md). Còn cần nơi backup ngoài PC và nghiệm thu toàn stack/backend production, nội dung thật/QR/COD; chưa HP.

**M7 đã hoàn thiện phần kỹ thuật trên PC:** guide/privacy, phí ship/COD do khách trả, retention mục tiêu có rà soát trước khi xóa, checklist nội dung admin và kiểm thử release local. 62 SQL/unit tests, hồi quy API/Chromium M1–M7 và build đạt. Xem [M7-READINESS.md](M7-READINESS.md). Chưa nhập ảnh/giá/tồn thay shop, chưa quét QR/chuyển tiền thiết bị thật, chưa restore backend production, chưa triển khai HP/đổi DNS; các phần vận hành này còn chờ nghiệm thu.

**M6 đã triển khai trên PC:** báo cáo thu/hoàn/thực thu theo ngày hoặc tháng, lọc ngày Việt Nam, giao dịch phân trang và COD hiện tại còn chờ. Đọc trực tiếp ledger, không đổi tiền/kho, không tính lợi nhuận. Xem [M6-CASH-REPORTS.md](M6-CASH-REPORTS.md). Chưa triển khai HP; M7 tiếp theo là nội dung thật, chính sách dữ liệu và UAT/phát hành sau khi người dùng duyệt.

**M5 đã triển khai trên PC:** `/chat` với lịch sử riêng theo phiên, Gemini phía server có quota/timeout/fallback Zalo; admin xem lịch sử và trạng thái tích hợp; outbox Telegram atomic cùng nghiệp vụ, worker có lease/backoff. Đã cấu hình credential local và gửi Telegram thật thành công vào nhóm “Trump”; Gemini dùng lại credential cũ theo yêu cầu mới nhất, giữ model3.6 và đã bật; Google hiện trả503 quá tải, chưa nghiệm thu phản hồi AI thật. Xem [M5-CHAT-NOTIFICATIONS.md](M5-CHAT-NOTIFICATIONS.md). Không triển khai HP. M6 tiếp theo chỉ là báo cáo tiền thực thu; lợi nhuận vẫn hoãn.

**Bổ sung cửa hàng/checkout theo yêu cầu ngay sau M4:** trang lưới ảnh–giá trên home và `/shop`, chi tiết, cart, khách tự đặt đơn ship/pickup và nhận QR, admin xác nhận thực thu. Không còn chỉ có cấu hình/ước tính rồi nhờ admin tạo đơn. Xem [STOREFRONT.md](STOREFRONT.md); chưa triển khai HP.

**M4 đã triển khai và kiểm thử trên PC:** đặt tìm không cọc, inbox admin private, portfolio nháp/công khai/ẩn/lưu trữ, copy một ảnh từ đơn có chủ đích, sound test click-to-load. 35 SQL/unit tests, API/Chromium M1–M4, lint/typecheck/build và advisors đạt. Xem [M4-REQUESTS-PORTFOLIO.md](M4-REQUESTS-PORTFOLIO.md) cho cách dùng, giới hạn và UAT còn lại. Chưa có nội dung portfolio thật, chưa triển khai HP. M5 tiếp theo là Gemini → Zalo và Telegram.

**QR Agribank đã bổ sung vào M3:** cọc/full theo snapshot, reference riêng, tạo offline và admin xác nhận thủ công; xem [BANK-PAYMENT.md](BANK-PAYMENT.md). Checkout khách tự tạo đơn đã được bổ sung sau M4 như ghi ở đầu tài liệu; chưa kết nối ngân hàng tự động.

**M3 lõi đã triển khai trên PC:** tạo đơn/snapshot, cọc/COD/trừ kho atomic, ba bước, ảnh private, mã/QR/tracking, hủy và hoàn phần vượt cọc. 26 SQL/unit tests và integration Supabase/Chromium M1–M3 đạt, lint/typecheck đạt, advisors không có lỗi. Xem [M3-ORDERS.md](M3-ORDERS.md) cho hướng dẫn, bằng chứng và phần chưa có: editor đơn chờ, bút toán sửa sai, UAT thiết bị thật. Chưa nghiệm thu vận hành/triển khai HP. M2 đã hoàn thành theo [M2-CATALOG.md](M2-CATALOG.md). Các dòng cập nhật M0/M1 và ước lượng dưới đây là lịch sử baseline.

**Cập nhật sau M0:** đọc [Yêu cầu đã chốt](REQUIREMENTS.md) trước khi triển khai. M0 hoàn thành; M1 đã rà soát đủ nền để chuyển M2 trên PC: Google/admin thật do người dùng xác nhận, 16 SQL/unit tests và 6 nhóm integration Supabase thật đạt, advisors/types/build đạt. Giới hạn E2E/phát hành còn theo dõi trong [M1-REVIEW.md](M1-REVIEW.md). M2 chưa bắt đầu ở lần rà soát này. Chưa triển khai HP; giao diện khách M0 vẫn dùng thương hiệu/demo cũ.

Ngày lập: 19/11/2026. Trạng thái: nền tảng local, chưa dùng để nhận đơn thật.

## 1. Mục tiêu và phạm vi

PWA cho một cửa hàng mod bàn phím: khách không cần tài khoản, chủ shop quản lý tập trung. Luồng chính: xem dịch vụ → lập ước tính → tư vấn/chốt đơn → shop tạo đơn → khách theo dõi bằng link/QR. Tên Keyboard Workshop và mọi giá trong bản dựng là dữ liệu minh họa.

Giữ nguyên [SPEC gốc](../SPEC.original.txt) làm tài liệu lịch sử. Các thay đổi do khách hàng xác nhận được ghi trong [REQUIREMENTS.md](REQUIREMENTS.md).

## Điều chỉnh lộ trình theo câu trả lời của khách hàng

- **M1:** Google login; admin cùng quyền; bootstrap admin đầu tiên, mã mời dùng một lần/có hạn/thu hồi được; membership và kiểm thử quyền ở server/DB.
- **M2:** admin nhập bảng giá/tồn kho thật. Gói lube 33/37/60/68 theo số switch thực tế; 75/90/100/full theo nhóm layout. Thêm thương hiệu/logo/social TRUMP Keys và ghi chú giá chưa gồm ship.
- **M3:** chỉ 3 bước Đang chờ → Đang xử lý → Hoàn thành, không skip/back/pause; bỏ editor workflow ở bản đầu. Khóa hạng mục khi bắt đầu. Mã đơn ngẫu nhiên dùng cả nhập tay và QR. Cọc 20% + COD 80% hoặc chuyển khoản full; media tracking thấy ngay sau khi lưu. Hủy tách khỏi 3 bước, giữ cọc và lịch sử.
- **M4:** ảnh thật/sound test và đặt tìm; không tự đưa toàn bộ media đơn lên portfolio.
- **M5:** Gemini phía server → Zalo, lịch sử chat private; Telegram bot báo nhóm admin. Không xây live admin inbox/Realtime trong bản đầu. Thông tin AI có nguồn shop, giới hạn chi phí, fallback khi lỗi/không biết.
- **M6:** doanh thu theo tiền thực thu; **hoãn tính lợi nhuận theo yêu cầu**, vẫn lưu giá vốn để bổ sung sau. Không làm Excel hoặc báo cáo theo nhân viên/phương thức.
- **M7:** cấu hình tên miền trumpkeys.publice.io.vn, nội dung thật, quyền riêng tư/retention, UAT và phát hành. Chưa tự động xóa dữ liệu khi thời hạn chưa được duyệt.
- **Triển khai:** Docker Next.js standalone trên HP hiện có, project `trumpkeys-hp`, loopback dự kiến 8094 và Cloudflare Tunnel dùng chung. Xem [DEPLOYMENT.md](DEPLOYMENT.md); chưa triển khai thật. Giữ/trừ tồn lúc xác nhận nhận cọc, không khi tạo đơn; đặt tìm không cọc. Admin bootstrap email đã chốt trong REQUIREMENTS.

Bảng mốc bên dưới là ước lượng baseline M0, **không phải backlog hiện hành cho các mục đã bị thay thế ở trên**. Ước lượng lại M1/M5/M6 sau khi chốt điểm còn thiếu, không coi AI chat tương đương thời lượng live chat.

## 2. Kiến trúc đề xuất

- Next.js App Router + React + TypeScript strict. Server Components đọc dữ liệu; Client Components chỉ cho tương tác. Một ứng dụng, một repository, không microservice.
- CSS thuần và design tokens theo đặc tả. Dùng HTML dialog, form và Intl trước khi thêm thư viện.
- Supabase dự kiến cung cấp Postgres, Auth cho admin, Storage private và Realtime cho chat. Chưa tạo project, chưa cài SDK, chưa có kết nối database trong bản nền.
- Next.js Route Handlers/Server Actions là ranh giới cho thao tác khách có dữ liệu nhạy cảm. Không mở bảng orders/chat/custom_requests cho anonymous đọc trực tiếp.
- Sau khi có host: một môi trường staging, một production, cấu hình riêng. Chọn Vercel hoặc host hỗ trợ Next.js runtime đầy đủ; chưa triển khai trong giai đoạn này.
- Chỉ thêm thư viện QR, biểu đồ, validation, kéo thả khi bắt đầu module thực sự cần. Không dựng hàng loạt API trả success giả.

```text
Khách / Admin
     ↓ HTTPS
Next.js: trang + validation + authorization + public DTO
     ↓
Supabase: Auth | Postgres/RLS | private Storage | Realtime
     ↓ transaction outbox
Worker gửi thông báo → Telegram / email (retry, chống gửi trùng)
```

## 3. Những nguyên tắc phải giữ từ đầu

1. Tiền VND là số nguyên không âm, không float. Giá bán và giá vốn lưu snapshot trên dòng đơn hàng. Ước tính của khách không phải báo giá được cam kết; server tính lại khi tạo đơn.
2. Workflow template có thể chỉnh sửa; mỗi đơn lưu snapshot các bước. Đổi tên/sắp xếp/xóa template không thay đổi đơn đang làm. Log chuyển bước chỉ thêm, không ghi đè lịch sử.
3. Mã dễ đọc không phải bí mật. Production dùng token tra cứu ngẫu nhiên đủ entropy, lưu hash; mã tuần tự chỉ dùng nội bộ. Không công khai danh sách đơn. Nếu bắt buộc tra cứu bằng mã ngắn, cần xác minh bổ sung và giới hạn thử.
4. Public tracking chỉ trả tên rút gọn, SĐT đã che, dịch vụ, thanh toán và minh chứng đã được duyệt. Không trả giá vốn, địa chỉ, ghi chú nội bộ hay khóa Storage.
5. Auth admin là bắt buộc trước mọi read/write nội bộ. UI ẩn nút không thay authorization. Không dựa vào metadata mà người dùng tự sửa được.
6. Tồn kho có ledger và cập nhật atomic trong transaction; không đọc số lượng rồi ghi lại ở client. Dịch vụ không có tồn kho; sản phẩm có tồn kho >= 0.
7. Không cache tracking, admin, chat, ảnh riêng tư vào Service Worker. Offline chỉ hiện hướng dẫn; không giả vờ đã gửi form khi mất mạng.

## 4. Các mốc và điều kiện hoàn thành

Ước lượng cho 1 lập trình viên, cần hiệu chỉnh sau mỗi mốc. Tổng khoảng 6–9 tuần làm việc tập trung, tùy tài sản nội dung và các tích hợp; không phải cam kết lịch giao.

| Mốc                        | Công việc                                                                                                | Nghiệm thu / phụ thuộc                                                                                           | Ước lượng |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| M0 — Nền tảng (bản này)    | Scaffold, tokens, catalog mẫu, ước tính, tracking mẫu, PWA cơ bản, docs, CI                              | Build/typecheck/lint/test qua; desktop/mobile không tràn; dữ liệu demo được ghi rõ                               | 1–2 ngày  |
| M1 — Dữ liệu & admin       | Supabase local/staging, migration, seed, generated types, Auth admin, RLS, login/logout, kiểm soát phiên | Khách và tài khoản không phải admin không đọc/ghi nội bộ; migration reset được; không có secret trong bundle     | 3–5 ngày  |
| M2 — Catalog & tồn kho     | CRUD 4 nhóm, giá/đơn vị, publish/hide, product images, ledger tồn kho                                    | Điều chỉnh đồng thời không âm tồn; dịch vụ không trừ kho; public chỉ thấy mục đang bán                           | 3–4 ngày  |
| M3 — Đơn hàng & tracking   | Workflow snapshot, tạo đơn + line snapshots, token/QR, cập nhật bước/media, thanh toán                   | Tạo đơn atomic; QR mở đúng đơn; template đổi không ảnh hưởng đơn cũ; chống dò mã; public DTO không có PII đầy đủ | 5–7 ngày  |
| M4 — Pre-order & portfolio | Upload private, form, inbox xử lý, video sound test, lọc URL nhúng                                       | Loại/size file được kiểm ở server; khách A không xem ảnh khách B; lỗi giữ nội dung form; video không autoplay    | 3–5 ngày  |
| M5 — Chat & thông báo      | Cookie phiên guest, quick replies, Realtime riêng phiên, admin inbox, outbox + retry webhook             | Hai khách không thấy chat nhau; refresh giữ phiên; retry không nhân đôi; lỗi webhook không làm mất message       | 5–7 ngày  |
| M6 — Tài chính             | Payment ledger, doanh thu theo ngày/tháng/năm, giá vốn, lợi nhuận, biểu đồ                               | Đối soát được bằng dữ liệu seed, cọc/hoàn tiền không tính trùng; timezone Asia/Ho_Chi_Minh                       | 3–4 ngày  |
| M7 — UAT & phát hành       | E2E, RLS tests, accessibility, PWA thiết bị thật, backup/restore, staging → production                   | Shop duyệt các luồng thực tế; restore thử thành công; không dùng demo; có rollback và hướng dẫn vận hành         | 4–6 ngày  |

M2 và M3 đi sau M1; M4/M5 cần upload/session policies của M1; M6 cần payment/order model của M3. Ưu tiên hoàn tất M1 → M2 → M3 trước để shop dùng được luồng đơn hàng.

## 5. Ma trận yêu cầu

| Đặc tả        | Bản nền                                                                    | Phần tiếp theo                                                 |
| ------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Home + 4 nhóm | Có responsive, dialog desktop/sheet mobile, giá mẫu                        | Giá/ảnh lấy từ DB, vuốt đóng sheet                             |
| Ước tính      | Chọn món, số lượng, tổng tiền, sao chép cấu hình                           | Giá authoritative phía server, URL Zalo thật, lưu nháp nếu cần |
| Tracking      | Trang server `/track/KB-DEMO2026`, timeline, 404                           | Token thật, rate limit, ảnh/video signed URL, QR               |
| Admin         | Trang trạng thái chưa cấu hình, không dữ liệu nội bộ                       | Auth, CRUD, workflow, inventory, inbox, báo cáo                |
| Pre-order     | Trang giải thích trạng thái chưa nhận yêu cầu                              | Form upload + server validation + xử lý trạng thái             |
| Chat          | Quick replies chạy local, ghi rõ chưa realtime                             | Phiên khách, realtime, webhook, inbox                          |
| Portfolio     | Empty state trung thực                                                     | CRUD và video thật có allowlist                                |
| PWA           | Manifest, icon PNG, đăng ký SW production, offline fallback, hướng dẫn cài | Kiểm thử iOS/Android thật, cập nhật phiên bản                  |
| Social links  | Chưa hiển thị link shop giả                                                | Điền Zalo/Messenger/TikTok/Facebook/Instagram trước phát hành  |

## 6. Chiến lược kiểm thử

- M0: native Node test cho phép tính tiền, số lượng/stock, mã tra cứu. TypeScript, ESLint và production build trên CI.
- M1+: Supabase local + test RLS theo actor (anon, guest A/B, authenticated không phải admin, admin). Seed toàn bộ đều giả.
- M3+: integration transaction tạo đơn, cập nhật đồng thời, bước sai workflow, token hết hiệu lực, payload vượt giới hạn, chống log token.
- M4/M5+: malicious file, URL video sai host, session khác, disconnect/reconnect, webhook retry.
- Trước release: E2E desktop/mobile cho tra cứu đúng/sai, giỏ trống/nhiều món, pre-order thất bại/thành công, admin login hết phiên; keyboard/focus; HTTPS; iOS Add to Home Screen; Android install; offline và nâng version SW.

## 7. Câu hỏi ban đầu (đã được trả lời một phần)

Danh sách cần hỏi tiếp hiện hành nằm ở [REQUIREMENTS.md, mục 8](REQUIREMENTS.md#8-còn-cần-trả-lời). Không hỏi lại những quyết định đã xác nhận. Các dòng dưới giữ lại để đối chiếu lịch sử:

- Tên thương hiệu, logo, domain, Zalo/social thật, bảng giá/ảnh/video có quyền sử dụng.
- Lube theo phím hay theo gói: có được chọn đồng thời không? Phụ phí switch bẩn, rã hàn, layout đặc biệt xử lý thế nào?
- Quy tắc cọc, hủy, hoàn tiền, sửa đơn đã hoàn tất; thời điểm ghi nhận doanh thu và giá vốn; phí ship/thuế/chi phí công có đưa vào báo cáo không?
- Khách được xem ảnh nào, thời hạn lưu ảnh/chat, thông báo về quyền riêng tư, quy trình xóa dữ liệu.
- Kênh thông báo Telegram hay email; thời gian trả lời và phân công nếu nhiều admin.

## 8. Definition of Done chung

Mỗi module có validation ở server, authorization, loading/empty/error/success, dữ liệu giả tách biệt, test tập trung vào rủi ro nghiệp vụ, cập nhật docs. Thay đổi DB có migration/rollback approach, index/FK/constraints/RLS và kiểm thử reset. Không đưa tác vụ chưa hoàn thiện lên production dưới dạng nút có vẻ hoạt động.

Tài liệu tham khảo chính thức đã đối chiếu: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Next.js PWA](https://nextjs.org/docs/app/guides/progressive-web-apps), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase changelog](https://supabase.com/changelog.md). Đối chiếu lại khi bắt đầu M1 vì CLI/SDK có thể đổi.
