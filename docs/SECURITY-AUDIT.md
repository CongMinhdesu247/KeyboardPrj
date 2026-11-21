# Báo cáo security audit và chuẩn bị public HP — 20/11/2026

**Tiến độ cloud bổ sung:** người dùng đã tạo project `qhxwyzkfylfipfvpesbe` và áp dụng20migrations. Đã kiểm history khớp. Dashboard auto-RLS tạo helper `public.rls_auto_enable()` dạng event_trigger/security-definer với grant mặc định cho API; đây là cảnh báo quyền dư, không xác nhận exploit vì event-trigger function không gọi như hàm thường. Migration `20261120115119_restrict_auto_rls_function.sql` thu hồi EXECUTE từ PUBLIC/anon/authenticated nếu helper tồn tại, giữ event trigger. Đã áp dụng riêng migration này lên cloud và local; advisors cloud không còn WARN/ERROR, kiểm quyền client=false và trigger enabled=O. Test fixture PostgreSQL xác nhận DDL vẫn gọi helper sau revoke. Các trạng thái “chưa production” bên dưới là kết quả tại lần audit trước bước provision này; HP/public HTTPS/OAuth/backup managed thật vẫn chưa nghiệm thu.

Đã xác nhận và vá **một lỗi High**: quota checkout có thể bị bỏ qua qua RPC trực tiếp. Không xác nhận Critical hoặc lộ secret trong phần mã nguồn được scan. Có các lỗi Medium về rate limit/khả dụng và một số điểm hardening Low đã sửa. Không có kết luận rằng hệ thống production đã an toàn hoặc đã UAT: HP, DNS, tunnel, backend production và backup managed thật chưa được kiểm chứng.

## Phạm vi, stack và bằng chứng

- Scan tệp văn bản đủ điều kiện Git (tracked + untracked không bị ignore), ban đầu262tệp: src, migrations, tests, scripts, public text, docs/config. Tìm secret bằng mẫu private key/Google API key/Supabase secret/Telegram token/JWT; đầu ra chỉ vị trí, không in giá trị. Không có candidate khớp trong tập đó. Đây là pattern scan, không phải gitleaks/entropy scan/chứng minh không có secret. Không đọc `.env`/SSH key để in ra; env local chỉ runner có sẵn giữ trong bộ nhớ, tắt integration tạm và khôi phục finally.
- Review thủ công các trust boundary: mọi nhóm Server Actions, Route Handlers/proxy, Auth/RLS/session và các migration thay thế, uploads/Storage/DTO, browser sinks, Gemini/Telegram, Compose/Dockerfile/backup. Không coi grep hoặc tests là chứng minh từng dòng không có lỗi.
- Next.js16.4.6 App Router/React19.3.0, TypeScript strict, npm lockfile; runtime PC24.10.0 và image Node24.22.3 bookworm-slim amd64 pin digest. `@supabase/ssr`0.12.7, `@supabase/supabase-js`2.119.1, sharp0.35.5, qrcode1.5.4, Recharts3.11.0. Các SDK/key chỉ server; client chỉ nhận public DTO.
- DB/Auth/Storage là Supabase; local PC PostgreSQL17.12, backend production managed chưa chọn. Không có SQLite/local upload persistence, Redis hoặc Kafka. Public catalog images/videos/home-banners là công khai có chủ đích; order-media/request-images/portfolio-media là private, portfolio chỉ ký URL sau publish chủ động. Không tự đổi bucket private sang public.
- `npm audit --json`: 498 dependency nodes theo metadata, **0 Critical/High/Moderate/Low**, gồm dev/optional/peer. Docker `npm ci` cũng báo0. Không có dependency High cần nâng trong lần này. Chưa chạy image OS CVE scanner/SBOM, pentest dịch vụ bên ngoài hoặc scanner Git history. Toàn bộ project ban đầu untracked, chưa có release commit để rà lịch sử.

## Bảng phát hiện theo mức độ

Các vị trí “trước” chỉ bản gốc đã đọc; vị trí “sau” là mã hiện tại. Severity dựa trên điều kiện khai thác thực tế, không chỉ tên mẫu.

| Mức | ID, vị trí | Nguyên nhân / tác động và điều kiện | Vá / trạng thái |
| --- | --- | --- | --- |
| Critical | — | Chưa xác nhận đường khai thác Critical trong phạm vi review | Không đồng nghĩa bảo đảm không còn lỗi |
| **High** | SEC-01 — `supabase/migrations/20261120050333_customer_accounts.sql:45,110`, body thay ở `20261120050805_account_order_safety.sql:17`; quota cũ chỉ trong `src/app/checkout/actions.ts` | Public RPC `submit_account_order` được grant authenticated. Người có tài khoản Google/live session gọi Data API trực tiếp với UUID/hash/code mới, bỏ qua quota Next. Có thể spam đơn chờ, snapshot và Telegram outbox, tăng tải DB/ops; không có bằng chứng tự ghi nhận tiền hoặc trừ kho | **Đã vá** `supabase/migrations/20261120104810_production_security.sql:14`: derive account bucket từ auth.uid(), consume DB quota trong cùng transaction trước create mới; khóa request, kiểm owner và giữ retry. Test trực tiếp10đơn đạt, đơn11bị chặn, retry đơn1đạt và không tăng global. Local DB đã áp dụng; production cần migrate |
| Medium | SEC-02 — trước `src/lib/order-data.ts:17` và preorder/checkout đọc `TRUST_PROXY_IP`/XFF; sau `src/proxy.ts:35,41`, `src/lib/request-security.ts:5` | Mặc định tracking gom mọi người thành key local: một khách có thể làm người khác hết lượt. Bật cờ cũ lại tin phần đầu XFF chưa có trust boundary. Đặt tìm có thể đổi visitor cookie để đổi quota cá nhân; login/POST chưa có web throttle trước session refresh | **Đã vá** chế độ Cloudflare chỉ đọc CF-Connecting-IP hợp lệ, không XFF; một replica limiter bounded, 429/Retry-After trước DB. Quota đặt tìm production theo IP, checkout theo account DB. Trust phụ thuộc port loopback/tunnel duy nhất; local process và own-zone Worker vẫn cần kiểm soát |
| Medium, khả dụng | OPS-01 — `src/app/api/health/route.ts:3`; sau `src/app/healthz/route.ts:6`, `src/lib/readiness-probe.ts:3`, `Dockerfile:28` | Health cũ luôn200 khi web sống dù DB mất kết nối, dễ đưa ứng dụng hỏng vào public/monitor | **Đã vá** giữ liveness riêng, thêm readiness query DB/RLS read-only timeout3giây, cache5giây,503 generic/no-store. Startup HP thử5lần có hạn. Chưa thay thế kiểm Auth/Storage/integration nghiệp vụ |
| Medium, khả dụng | OPS-02 — `src/app/admin/orders/actions.ts:174` (nhánh cleanup trước sửa) | RPC có thể đã commit proof nhưng response bị mất; code cũ xóa upload ngay khi result.error, làm mất byte bằng chứng đã tham chiếu. Cần lỗi mạng sau commit; đây là lỗi khả dụng vận hành, không phải IDOR đã chứng minh | **Đã vá** chỉ dọn khi đã nhận business rejection; lỗi mạng giữ file để tránh mất bằng chứng. Có thể để lại orphan, cần reconciliation được review thay vì xóa mù |
| Medium, triển khai | OPS-03 — `src/app/account/page.tsx:4`, `src/app/account/orders/page.tsx:6` | Khi Docker build không có env (đúng quy tắc secret), readAccount trả sớm trước cookies, hai route được prerender thành redirect chưa cấu hình. Thêm runtime env không đảm bảo thoát cache build; quan sát build image trước vá có route static | **Đã vá** force-dynamic cho hai trang và explicit no-store cho account/auth. Build cuối cần hiển thị route động; không truyền secret vào build để chữa |
| Low | SEC-03 — `src/app/admin/orders/actions.ts:143`, `src/lib/media-image.ts:11` | MP4 proof trước chỉ kiểm chuỗi ftyp; helper ảnh dùng decoder nhưng chưa ép decoded format thuộc allowlist. Cần admin upload hoặc client MIME giả. Ảnh luôn encode WebP nên chưa có bằng chứng stored XSS/RCE | **Đã vá** tái sử dụng bounded MP4 box validator (moov/mdat/brand/size), metadata ảnh JPEG/PNG/WebP tĩnh≤20MP,5MiB; outputWebP strip metadata. Không phải codec/AV malware scanner; storage write admin trực tiếp vẫn nằm trong miền tin cậy admin |
| Low, hardening | SEC-04 — `.gitignore`, `.dockerignore` | Bỏ sót một số private-key filename, ssh directory, log/dump/credential backup trong ignore cũ. Chưa tìm secret bị track/copy thực tế | **Đã bổ sung** key formats/names, nested logs, backups, operator/shared/pgpass/storage.json/npmrc, Python cache. Sample env được phép vì không có giá trị secret; ignore không xóa secret đã commit trước đó |
| Low, hardening | SEC-05 — `next.config.ts:10`, `src/proxy.ts:33` | Thiếu một số headers và phụ thuộc kiểm Origin của framework (request thiếu Origin được Next cho qua kèm warning) | **Đã bổ sung** exact Origin gồm scheme cho mọi write, thiếu/lạ403; nosniff/DENY/no-referrer, Permissions-Policy, CSP base/object/frame. **Còn cải tiến tùy chọn:** nonce script-src CSP đầy đủ; không báo là XSS đã khai thác và không tự thêm unsafe-inline/eval |
| Low, supply chain | OPS-04 — `Dockerfile:2,13`, `compose.yaml:54` | Base Node tag major trôi; chưa có connector riêng theo yêu cầu mới | **Đã pin** Node24.22.3 và cloudflared2026.11.0 cả version/digest; manifests amd64 xác minh registry. Cập nhật bảo mật cần review digest+rebuild có kế hoạch; pin không tự nhận vá tương lai |

SEC-01 không bị “sửa” bằng giấu publishable key: key này public theo thiết kế, quyền/quota phải đúng ở DB. MD5 trong migration chỉ nối thành bucket identifier, không dùng hash mật khẩu/capability hay quyết định quyền. Quota shared global100giờ là giới hạn đã có của request, không thêm thu tiền/kho vào checkout.

## Endpoint và quyền đã truy vết

API ứng dụng chủ yếu là **Next Server Actions trên POST của route hiện tại**, không có REST CRUD `/api/orders` để quên kiểm. Action IDs không phải cơ chế authorization.

| Entry point / module | Kiểm quyền và giới hạn |
| --- | --- |
| GET `/api/health`, GET `/healthz` | Public, chỉ status; loopback được phép riêng. Readiness không trả schema/query lỗi |
| GET `/auth/callback` | OAuth PKCE exchange, verified Google, touch_account; cookie intent và checkout return allowlist; canonical APP_ORIGIN, không tin Host để tạo redirect |
| `/admin/login`, `startGoogleLogin`; `/account/login`, `customerGoogleLogin` | Không phải admin bootstrap; OAuth Google, exact callback, production secure cookie; web login rate20/phút/IP |
| Logout admin/customer | Server Action, same-origin; Supabase revoke local session; stale JWT bị `has_live_session` DB chặn |
| `/admin/team`, `src/app/admin/actions.ts` | requireAdmin/requireGoogleUser riêng từng action; invite256bit/hash/TTL24h/use-once/atomic, redeem có DB attempts; không tin metadata và không tự hồi quyền |
| `/admin/catalog`, `catalog/actions.ts`, `media-actions.ts`, `/admin/banners` | requireAdmin trước read/upload/write, version/idempotency; inventory chỉ adjust_inventory RPC+movement; cost private; decoder/file limits phía server |
| `/admin/orders`, `orders/actions.ts` | requireAdmin; duy nhất order_command transaction cho đơn/admin tiền/kho; private tables không direct grants; receipt/COD/refund append-only, actor từ server/DB |
| `/admin/requests`, `/admin/portfolio` | requireAdmin cả read/write; request-images private; publish explicit approval; copy ảnh đơn có kiểm sourceOrder/event và tạo byte riêng |
| `/admin/customers`, reports, inbox, chat, notifications | requireAdmin ở từng page/action/RPC; live session, account status; DTO/report bounded, BigInt money; notification read receipts theo actor |
| `/account`, `/account/orders`, profile actions | getUser+verified Google+live DB account; my_orders theo auth.uid; A không đọc đơn B; ban/delete revoke phiên và giữ chứng từ |
| `/checkout`, placeCustomerOrder | Active Google account, signed TTL token, validation allowlist, DB kiểm giá/tồn/snapshot/owner/idempotency, quota trực tiếp trong RPC; tạo đơn chưa trừ kho/chưa ghi tiền |
| `/preorder`, submitFindRequest | Signed scoped token, validation/honeypot/consent, quota DB+IP trusted, ảnh decode private; không đơn/cọc/kho |
| `/track/[code]` | Capability128bit, normalize, throttle; service-only track_order RPC, DTO allowlist che PII, không địa chỉ/note/cost; signed URL5phút, no-store/no-referrer/noindex |
| `/chat`, sendChat/handoff/reset | Capability cookie256bit HttpOnly, DB hash, scoped signed token, lease/idempotency/quota session+global; Gemini chỉ context public/lịch sử phiên, plain text/no tools, timeout/fallback Zalo |
| Home/shop/estimate/portfolio/gallery | Catalog public RLS và DTO, không admin cookie fallback; no unsafe HTML sink phát hiện. Portfolio only published, video URL exact parsed HTTPS YouTube/TikTok. CartlocalStorage chỉ ID/qty/expectedPrice, DB không tin giá client |
| Notification worker / notifications | Service-only RPC claim/ack có lease/fencing/backoff, payload không PII/capability; disabled khi thiếu credential. Không gọi AI/Telegram thật trong audit hồi quy |
| Supabase Data API/Storage trực tiếp | RPC authenticated được review như endpoint public riêng; RLS/private grants/definer search_path/owner checks và service-only guest tracking/chat/request. Public buckets chỉ media sản phẩm/banner có chủ đích |

Không có mật khẩu app để đánh giá bcrypt/argon2: người dùng đăng nhập Google qua Supabase Auth. Không tự thêm password login hay JWT signing secret khác. Cookie SSR đã `HttpOnly`, `Secure` theo HTTPS canonical, `SameSite=Lax`, path/TTL theo luồng; không lưu token vào localStorage. DB kiểm session sống và account/membership, không chỉ JWT metadata.

SQL được gửi bằng Supabase query builder/RPC tham số; SQL động trong fixture/backup dùng identifier quoting và random allowlist, không nhận path/command từ HTTP. Không phát hiện reachable SQL/NoSQL/OS command injection, unsafe eval hoặc stored/DOM XSS sink trong app được review. Không có endpoint fetch URL tùy ý; reference URL chỉ lưu/link, integrations dùng host cố định. Không có CORS wildcard/credential reflection; browser gọi cùng origin. Không thêm webhook ngân hàng/check-out giả hoặc tự đánh dấu QR đã thanh toán.

## OWASP Top10:2025 — ma trận phạm vi

| Nhóm rủi ro | Đối chiếu đã làm | Giới hạn |
| --- | --- | --- |
| A01 Broken Access Control | RLS, admin/live session, A/B account, private storage, capability DTO, direct RPC quota | Production grants/provider/keys cần kiểm lại sau migrate |
| A02 Security Misconfiguration | Host/Origin, same-origin CORS, headers/cache, ports/non-root/limits/logs | HP/UFW/router/actual tunnel chưa đọc; CSP script nonce còn tùy chọn |
| A03 Software Supply Chain Failures | npm audit toàn bộlockfile, exact runtime/image digest và manifest | Chưa OS image CVE scan; registry/advisory có thể cập nhật |
| A04 Cryptographic Failures | Cookie flags, token entropy/hash, secrets server-only, HTTPS config | Không audit nội bộ Google/Supabase/Cloudflare; backup chưa mã hóa mặc định |
| A05 Injection | DB parameter/RPC, React escaped text, URL/media allowlist, subprocess args không shell từ HTTP | Không fuzz mọi parser/codec hoặc scan malware |
| A06 Insecure Design | Idempotency/atomic payments/stock, quota DB, chat budget, no AI tools | NAT/IPv6 farms/DoS phân tán cần edge policy và đo tải |
| A07 Authentication Failures | Google identity, PKCE, session DB, invites/revocation, no fake login | OAuth public domain/real devices chưa UAT đợt này |
| A08 Software or Data Integrity Failures | Lockfile, pinned images, checksums, DB transactional command, safe drill targets | Chưa thiết lập signing/provenance artifact, Git release đầu tiên cần review |
| A09 Security Logging and Alerting Failures | Không log secret/PII/capability, bounded logs, health/backup monitoring guide | Chưa tích hợp monitor HP vì chưa biết schema config và không truy cập HP |
| A10 Mishandling of Exceptional Conditions | Lỗi mất response sau commit không xóa proof, idempotent retry, fail-closed config/readiness, provider timeout/fallback, transaction rollback | Chưa fault-inject mọi lỗi mạng/đầy đĩa/OOM trên HP |
| Bổ sung SSRF (đối chiếu cả nhóm2021) | Không arbitrary outbound HTTP, URL parser/host allowlist, fixed provider endpoints | Backend/operator env thuộc miền tin cậy; review lại nếu thêm URL preview/import/webhook |

## Ma trận nghiệm thu và kiểm tra thực chạy

| Tiêu chí | Kết quả trong đợt này |
| --- | --- |
| Direct checkout RPC không né quota, retry không nhân đôi | Unit/SQL PostgreSQL PGlite mới; migration local không reset; advisors0issue |
| Không cấp quyền bằng user_metadata, stale session/A-B/private storage bị chặn | SQL tests và regression Supabase local/browser fixture M1–M7; kết quả cuối ghi dưới đây |
| CF-IP/XFF/Origin và quota bộ nhớ bounded | Unit tests + Linux container HTTP smoke: missing CF403, forgedXFF không đổi quota, IP2 riêng,429+Retry-After |
| `/healthz` missing backend không báo xanh | Unit HTTP adapter success/failure/throw + Docker503; endpoint DB thật được local fixture/env kiểm riêng qua request read-only |
| Build/runtime | lint, next typegen/tsc, npm test81/81 và production build đạt; Docker image không env, UID1000/512MiB, header/no-store/private redirects/worker disabled đạt |
| Compose | `docker compose --env-file .env.example --profile tunnel -f compose.yaml config --quiet` đạt; cloudflared `tunnel ready --help` đã đối chiếu từ image pin |
| Restore | PostgreSQL17 container **thật**, dữ liệu/file giả: dump → restore randomDB → fingerprint/hash khớp, target cleanup; corrupt dump bị từ chối trước restore. Không dữ liệu/credential production |
| HP/public | **Chưa chạy**: preflight thực tế, route DNS/Tunnel/HTTPS4G, resource load, production migration/Google/provider/backup managed/new-stack restore |

Hồi quy M1–M7 **đã đạt exit0**, gồm inbox375px/1440px, cleanup đúng fixture và khôi phục integration env. Runner tạm tắt GEMINI/TELEGRAM và khôi phục finally, không cookie thật, không worker/backup cùng lúc. Fixture cleanup bổ sung account-budget mới và trừ đúng phần global của fixture; không reset DB/cấp lại admin. Lần gọi runner đầu chưa có dev server đã dừng an toàn và khôi phục env. Một lượt sau đó bắt được hydration warning do screenshot Playwright mặc định giấu caret trước hydration; sửa screenshot catalog/inbox dùng caret initial (không bỏ qua warning), chạy lại toàn bộ đã đạt. Dev server riêng được dừng sau khi hoàn tất.

## Điều kiện còn lại trước phát hành

Chạy preflight bằng chính người vận hành; chọn backend production riêng và áp dụng migration; cấu hình Google/Cloudflare exact hostname; chứng minh backup managed thực và restore trên môi trường mới; kiểm 4G/cookie/quyền/ảnh/QR/nghiệp vụ; đo RAM/CPU/disk trên HP. Không tự ký “đã UAT”, không cho rằng backup BankingPrj bao phủ dự án, không coi HTTP200 health hoặc tunnelConnected là đủ nhận đơn thật.

Tài liệu bàn giao: [HP-PREFLIGHT.md](HP-PREFLIGHT.md), [DEPLOYMENT.md](DEPLOYMENT.md), [HP-BACKUP-RESTORE.md](HP-BACKUP-RESTORE.md). Các nguồn chính đã đối chiếu: [Next data security](https://nextjs.org/docs/app/guides/data-security), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Cloudflare CF-Connecting-IP](https://developers.cloudflare.com/fundamentals/reference/http-headers/), [OWASP Top10:2025](https://top10.owasp.org/2025/). Hành vi Next dùng tài liệu đi kèm đúng bản `node_modules/next/dist/docs/` trước khi sửa.
