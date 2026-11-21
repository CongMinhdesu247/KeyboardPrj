# Mô hình dữ liệu và hợp đồng nghiệp vụ

**Cloud auto-RLS helper:** migration `20261120115119_restrict_auto_rls_function.sql` chỉ revoke quyền gọi API helper event-trigger tùy chọn do Dashboard tạo; không đổi bảng, policy, ledger hoặc nội dung hàm. Local không có helper thì no-op. Nghiệm thu: anon/authenticated EXECUTE=false, event trigger vẫn enabled và DDL hoạt động; advisors cloud0cảnh báo sau migration. Xem [SECURITY-AUDIT.md](SECURITY-AUDIT.md).

**Audit HP/public:** migration `20261120104810_production_security.sql` thay body `private.submit_account_order`, giữ chữ ký/quyền/owner/ledger: xác minh active/live Google → lock request → kiểm owner retry → quota DB cho request mới → snapshot/create như cũ. Bucket account deterministic từ `auth.uid()` (không nhận từ payload/cookie),10lượt/giờ/account, chung global100/giờ với request; retry đã commit không tăng quota. Không thêm bảng; dùng `private.request_budgets`/advisory transaction lock đã có. Không thay admin `order_command`, không trừ kho hay nhận tiền khi tạo đơn. Kiểm chứng và ma trận: [SECURITY-AUDIT.md](SECURITY-AUDIT.md).

**Thông báo trong web:** `private.admin_notification_reads(user_id,notification_id,read_at)` khóa ghép/FK cascade, private/RLS; RPC `admin_inbox` và `read_admin_notifications` chỉ admin đang có quyền và live session, actor từ auth.uid(). Đọc cá nhân/idempotent, watermark cho đọc tất cả; nguồn notification_outbox/Telegram delivery giữ nguyên. [ADMIN-INBOX.md](ADMIN-INBOX.md).

**Dashboard tài khoản:** `private.account_activity_days(day,user_id)` ghi distinct ngày truy cập xác thực qua trigger cập nhật `last_seen_at`; `private.account_analytics_start` đánh dấu ngày bắt đầu, không backfill lịch sử giả. Hai bảng RLS/private; RPC `account_growth` kiểm admin/live session, chỉ trả số đếm/ngày trong 365 ngày. Hợp đồng `account_report` và write không đổi. [ADMIN-DASHBOARD.md](ADMIN-DASHBOARD.md).

**Banner:** bảng public.home_banners RLS, slot1–5 cố định, FKproduct/updated_by; public chỉ active+product public. RPC admin-only save_home_banner lock/version/idempotency/audit; bucket public home-banners riêng. Không đổi order/catalog snapshot/ledger. [HOME-BANNERS.md](HOME-BANNERS.md).

**Hồ sơ khách:** thêm `private.accounts.phone/address`; dùng `display_name` cho tên tự chỉnh, không bị Google refresh ghi đè. RPC owner-only `update_customer_profile` có version/lock/validation; `touch_account` trả thêm hồ sơ của chính user. Checkout chỉ đọc để điền sẵn, không sửa snapshot cũ hoặc ghi ngược hồ sơ. [CUSTOMER-ACCOUNTS.md](CUSTOMER-ACCOUNTS.md).

**Tài khoản khách hiện hành:** `private.accounts` RLS/private, role suy từ admin membership, status active/banned/deleted, registered/last_seen/version; `private.orders.customer_user_id` FK Auth (không dùng actor admin). RPC owner-only my_orders/submit_account_order và admin report/manage/filter. Ban/xóa thu hồi session; soft-delete giữ đơn/tiền. Xem [CUSTOMER-ACCOUNTS.md](CUSTOMER-ACCOUNTS.md); các mô tả guest không cần login bên dưới chỉ còn cho đơn cũ.

Gallery bổ sung `products_services.image_paths text[]` (0–10 ảnh), `video_path text nullable`, `video_url text` (một sound test). `image_path` đồng bộ ảnh đầu; ảnh cũ backfill vào mảng. RPC admin `set_catalog_media` dùng version/lock/audit. Video ở bucket public riêng `catalog-videos`; không đổi Storage private/đơn/kho/ledger. Xem [CATALOG-MEDIA.md](CATALOG-MEDIA.md).

**M7 PC:** không đổi schema/ledger hoặc tạo lịch xóa. `admin/readiness` chỉ đọc catalog/groups/portfolio bằng JWT admin và dựng kiểm tra nội dung; `guide/privacy` dùng thông tin shop đã chốt trong shop-policies. Retention90/180ngày/24tháng là mục tiêu cần rà soát trước áp dụng. Phí ship+COD do khách trả, shop báo riêng, chưa đưa phí vào snapshot hàng/dịch vụ. Xem [M7-READINESS.md](M7-READINESS.md).

**M6 hiện hành:** RPC admin-only/live-session `cash_report` tổng hợp trực tiếp private.order_payments theo ngày ghi nhận Việt Nam; index(created_at,id). Không có bảng balance mới, không thay ledger. Tiền tổng trả chuỗi numeric, UI BigInt; COD còn chờ là hiện tại toàn shop, tách bộ lọc ngày. Xem [M6-CASH-REPORTS.md](M6-CASH-REPORTS.md); lợi nhuận vẫn hoãn.

**M5 hiện hành:** `private.chat_sessions/chat_turns/chat_budgets/notification_outbox`; capability cookie256bit chỉ lưu hash, session guest30ngày, consent trước khi gửi; RPC service-only begin/finish/handoff và worker claim/ack. Admin chat/outbox RPC kiểm active/live session. Trigger outbox cùng transaction đơn/sự kiện/tiền/đặt tìm, không chứa PII. Xem [M5-CHAT-NOTIFICATIONS.md](M5-CHAT-NOTIFICATIONS.md); retention chưa bật xóa tự động.

**Checkout khách:** thêm `checkout_submissions` private, source/delivery/address/note trong orders; actor đơn web nullable, chỉ event created không actor. RPC service-only tạo đơn chờ/snapshot và retry atomic, không ghi tiền/trừ kho. `order_payment_available` chặn cấp QR mới cho đơn web chưa cọc mà catalog/tồn không còn sẵn. Xem [STOREFRONT.md](STOREFRONT.md).

**M4 hiện hành:** `private.custom_requests/request_budgets/portfolio_items`; submit/lookup/budget chỉ service_role, inbox và portfolio writes qua RPC kiểm admin/live session; `portfolio-media` private, manifest published chỉ server đọc rồi ký URL. Chi tiết [M4-REQUESTS-PORTFOLIO.md](M4-REQUESTS-PORTFOLIO.md). Yêu cầu đặt tìm không tạo đơn hay trừ kho.

**Bổ sung thanh toán ngân hàng:** `private.orders.payment_reference` unique, sequence private tạo `TK` + 10 chữ số cho cả đơn mới/cũ. Không phải mã tra cứu. DTO server thêm plan/total/deposit/received/reference để dựng QR local, public chỉ nhận chỉ dẫn thanh toán; không công khai ledger, giá vốn hoặc chứng từ. Xem [BANK-PAYMENT.md](BANK-PAYMENT.md).

**M3 hiện hành:** `private.orders/order_lines/order_payments/order_events/order_commands`; RPC command atomic, receipt trừ kho một lần, snapshot bất biến, ba bước cố định, hủy/hoàn riêng, tracking capability 128 bit chỉ server đọc và ký ảnh. Xem [M3-ORDERS.md](M3-ORDERS.md). Các đề xuất workflow editor/mã ngắn + token hash/trừ kho lúc tạo đơn và quyền dự kiến phía dưới là baseline đã bị thay thế, không dùng để triển khai tiếp.

**M2 hiện hành:** catalog thật ở `public.products_services`, giá vốn và movement ở private schema, write qua RPC có authorization/transaction/version. 8 gói lube nháp không giá. Bucket catalog-images public dành riêng ảnh bán hàng, không đổi bucket ảnh đơn/yêu cầu private. Chi tiết tại [M2-CATALOG.md](M2-CATALOG.md); bảng baseline phía dưới chỉ áp dụng cho module chưa triển khai.

**Baseline toàn dự án:** khi có mâu thuẫn, [REQUIREMENTS.md](REQUIREMENTS.md) được ưu tiên. Phần M1 thực tế đã có migration `20261119033017_admin_foundation.sql`, seed và SQL tests; xem [M1-AUTH.md](M1-AUTH.md) cho schema/quyền hiện hành. Các bảng module M2–M6 bên dưới vẫn là thiết kế, chưa được tạo. Chưa áp dụng vào Supabase thật do thiếu runtime local/OAuth.

## Những thay đổi đã chốt so với baseline

- Admin Google cùng quyền; bổ sung cơ chế mời dùng một lần, hạn/thu hồi, redeem atomic và bootstrap người đầu tiên. Không tự cấp membership vì đăng nhập Google thành công.
- Quy trình cố định 3 bước tiến tuần tự; không dựng workflow editor hoặc cho quay lại bước. Giữ snapshot/log để đơn không bị đổi lịch sử. Khóa line items khi bắt đầu xử lý; hủy là lifecycle riêng.
- Khách tra cứu bằng một mã ngẫu nhiên khó đoán; link/QR dùng cùng mã, không bắt nhập mã nội bộ rồi một token khác. Cần thay mô hình code/token tách biệt trong bảng baseline; quyết định hash/format ở M3.
- Media admin lưu thành công là public-to-order ngay qua signed URL sau xác minh mã, không có vòng duyệt riêng. Portfolio vẫn là hành động đăng riêng.
- Lube theo gói: 33/37/60/68 là số switch, 75/90/100/full là nhóm layout; lưu phân loại/label snapshot, không dùng mặc định giá mỗi phím của demo. Giữ/trừ tồn đúng một lần khi xác nhận nhận cọc hoặc thu đủ, chưa thu tiền thì chưa giữ. Đặt tìm mẫu không cọc.
- Lưu phương án cọc20/COD80 hoặc chuyển khoản full; ledger ghi tiền thực nhận, COD chờ đối soát; đơn hoàn tất chưa chắc paid. Hủy giữ cọc, không xóa chứng từ. Audit điều chỉnh thanh toán.
- Chat có sender customer/assistant thay cho customer/admin/bot ở bản đầu, gọi Gemini ở server, lịch sử phiên private; không mặc định cần Realtime/admin live inbox. Không lưu API key trong message/payload.
- Outbox gửi nhóm Telegram. Retention chưa được xác nhận, không bật tự xóa.
- **Báo cáo theo tiền thực thu**; phần “Quy ước tài chính đề xuất” ở cuối là đề xuất cũ, không áp dụng doanh thu hoàn thành. Tính lợi nhuận hoãn theo yêu cầu, vẫn lưu giá vốn/giao dịch; không chặn M1–M5.

Đây là thiết kế đề xuất cho M1, chưa phải SQL đã chạy. Không có database hoặc migration production trong bản nền. Khi triển khai: dùng Supabase CLI theo `--help` của phiên bản đã pin, tạo migration bằng CLI, kiểm thử reset + RLS trước khi áp dụng staging.

## Quy ước

- ID nội bộ: bigint identity; serialize ID thành string ở TypeScript. Auth user ID: UUID do Supabase Auth cấp.
- Tiền: bigint VND, CHECK >= 0; API kiểm safe integer và giới hạn nghiệp vụ, không chuyển số bigint lớn mất chính xác qua JSON. Starter giới hạn 1 tỷ VND/món và 999 đơn vị.
- Thời gian: timestamptz lưu UTC, hiển thị/tổng hợp ở Asia/Ho_Chi_Minh. Báo cáo dùng khoảng [start, end), không dựa timezone máy chủ.
- FK có index ở phía tham chiếu; xóa mềm catalog/workflow. Tránh cascade xóa lịch sử tài chính, đơn hàng hoặc audit.
- CHECK cho type/status/unit, UNIQUE cho slug/code/token_hash, CHECK quantity > 0 và stock >= 0. Quan hệ current_step phải thuộc chính order đó (composite FK), không chỉ tham chiếu một step bất kỳ.

## Các bảng

| Bảng                | Nội dung chính                                                                                                             | Quy tắc                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| admin_members       | user_id → auth.users, active                                                                                               | Chỉ chủ hệ thống cấp quyền, không cho người dùng tự nâng quyền                                                |
| order_stages        | name, position, description, active                                                                                        | Template; transaction khi reorder; vô hiệu hóa thay vì xóa khâu đang dùng                                     |
| service_categories  | slug, title, description, position                                                                                         | 4 slug: lube, stab, keycap, sound_mod                                                                         |
| products_services   | category_id, type, unit, price_vnd, stock_quantity, image_path, is_preorder, active                                        | service: stock null; product: stock integer >= 0; preorder không tự hứa có hàng                               |
| orders              | order_code, tracking_token_hash, customer_name/phone, current_step_id, lifecycle_status, created_at, completed_at, version | lifecycle: active/completed/cancelled; optimistic version hoặc lock khi sửa; mã code dễ đọc tách token bí mật |
| order_items         | order_id, product_service_id nullable, name_snapshot, unit_snapshot, quantity, unit_price_vnd, unit_cost_vnd               | Giá/tên giữ nguyên khi catalog đổi; tổng tiền server tính từ snapshot                                         |
| order_steps         | order_id, template_stage_id nullable, name_snapshot, description_snapshot, position, started_at, completed_at              | Snapshot workflow lúc tạo, UNIQUE(order_id, position), UNIQUE(order_id, id) hỗ trợ composite FK               |
| order_stage_logs    | order_id, order_step_id, note_public, note_internal, actor_id, created_at                                                  | Append-only; mọi chuyển bước cùng transaction với orders.current_step_id                                      |
| order_media         | log_id, storage_path, kind, customer_visible, created_at                                                                   | File private; ký URL ngắn hạn sau khi kiểm quyền; không nhận URL tùy ý để server fetch                        |
| payments            | order_id, kind(receipt/refund), amount_vnd, occurred_at, reference, idempotency_key                                        | Ledger; UNIQUE idempotency_key; trạng thái thanh toán suy ra từ tổng thu - hoàn                               |
| inventory_movements | product_id, order_id nullable, delta, reason, actor_id, created_at                                                         | Cập nhật cùng transaction với stock; delta không bằng 0, stock không âm                                       |
| custom_requests     | category(keycap/stab), customer_contact, budget_vnd, reference_image_path, note, status, created_at                        | pending/contacted/done; private, không public select; form chống spam                                         |
| portfolio_items     | title, keyboard_model, mods_applied, video_url, thumbnail_path, published_at                                               | Chỉ public khi published; video https thuộc allowlist, parse ID thay nhúng HTML khách gửi                     |
| chat_sessions       | token_hash, status, last_message_at, expires_at                                                                            | Token ngẫu nhiên trong cookie HttpOnly; tuyệt đối không tin session_id từ client làm quyền sở hữu             |
| chat_messages       | session_id, sender, content, created_at, client_message_id                                                                 | sender do server gán; UNIQUE(session_id, client_message_id) chống gửi trùng                                   |
| notification_outbox | event_type, entity_id, payload_minimal, attempts, next_attempt_at, sent_at, last_error                                     | Message/request ghi cùng transaction với outbox; retry có backoff; không đẩy PII dư thừa vào webhook          |
| audit_events        | actor_id, action, entity_type/id, changed_fields, created_at                                                               | Không chứa secret/token hay toàn bộ payload khách; quy tắc lưu giữ cần chủ shop chốt                          |

Index ban đầu: FK nêu trên; orders(created_at), orders(lifecycle_status, created_at), payments(occurred_at), chat_messages(session_id, created_at, id), custom_requests(status, created_at), outbox(next_attempt_at) WHERE sent_at IS NULL. Xác nhận EXPLAIN với truy vấn thực, không tạo mọi index có thể nghĩ ra.

## Transaction quan trọng

**Tạo đơn:** xác minh admin → validate input → khóa sản phẩm theo thứ tự ID cố định → kiểm giá/tồn kho → tạo orders → snapshot items/steps → log bước đầu → reserve/trừ kho theo quy tắc đã chốt → inventory ledger → commit. UNIQUE code và retry có giới hạn khi xung đột. QR chứa link token, không chứa số điện thoại.

**Chuyển bước:** xác minh admin → lock order/version → kiểm bước thuộc order, bước đích hợp lệ → cập nhật current_step + timestamps → append log → commit. Quay lại bước trước phải có lý do/audit, không xóa log.

**Ghi tiền:** xác minh admin → khóa order → kiểm idempotency, số tiền/hoàn tiền → insert ledger → commit. Không sửa trạng thái paid bằng nút rời mà thiếu chứng từ tiền tương ứng.

**Chỉnh tồn:** UPDATE atomic theo delta với điều kiện kết quả >= 0, ghi movement trong cùng transaction. Nếu không cập nhật được, báo xung đột/tồn không đủ; không ghi success giả.

## Quyền truy cập dự kiến

| Actor                          | Đọc                                             | Ghi                                                  |
| ------------------------------ | ----------------------------------------------- | ---------------------------------------------------- |
| Anonymous browser              | Catalog active, portfolio published             | Không ghi trực tiếp bảng nghiệp vụ                   |
| Guest qua server endpoint      | DTO một đơn sau xác thực token; chat đúng phiên | Request/chat với rate limit, validation, phiên guest |
| Authenticated không phải admin | Như anonymous                                   | Không quản trị                                       |
| Admin active                   | Nội bộ theo nghiệp vụ                           | CRUD có validation và audit                          |
| Outbox worker                  | Outbox tối thiểu cần gửi                        | Cập nhật attempts/sent_at                            |

RLS bật cho mọi bảng exposed; chỉ grant quyền cần dùng. Admin kiểm qua membership tin cậy và session đã xác thực. Không tạo policy `USING (true)` trên orders/chat. Ưu tiên truy vấn dưới quyền JWT admin để RLS bảo vệ thêm; chỉ dùng secret server key ở endpoint guest sau xác minh capability và dựng DTO allowlist. Views cần security_invoker hoặc private schema. Storage bucket order-media/request-images private, upload không overwrite mặc định; signed URL có hạn, không log token.

## DTO tra cứu public

`PublicOrder = { code, customerDisplayName, customerPhoneMasked, keyboard, services[], paymentLabel, steps[{name, description, status, updatedAt?, note?}], updatedAt }`.

DTO hiện tại trong `src/lib/domain.ts` cố ý không có total cost, raw phone, internal note, storage key, token hash. M3 thêm media DTO được duyệt; token không nằm trong JSON. Responses `Cache-Control: private, no-store`, robots noindex, Referrer-Policy no-referrer. Redact đường dẫn token khỏi analytics/access logs.

## Quy ước tài chính đề xuất cần xác nhận

- Tiền thực thu kỳ = receipts - refunds có occurred_at trong kỳ; tiền cọc nằm ở đây.
- Doanh thu hoàn thành kỳ = tổng giá bán snapshot của đơn completed trong kỳ, có quy tắc điều chỉnh/hủy rõ ràng.
- Lãi sau giá vốn linh kiện = doanh thu hoàn thành - tổng giá vốn snapshot của chính các đơn đó.
- Chưa gọi đây là lợi nhuận ròng kế toán nếu chưa trừ công, thuê mặt bằng, vận chuyển, thuế và các chi phí vận hành. Màn hình sẽ ghi đúng phạm vi chỉ tiêu.
- deposit/partial/paid suy từ ledger so với tổng đơn; overpayment/zero-price cần test và quy tắc xác nhận. Không cộng cọc vào doanh thu lần nữa khi hoàn tất đơn.
