# Triển khai TRUMP Keys trên HP homeserver

Cập nhật 20/11/2026 theo yêu cầu audit/public HTTPS. **Chưa SSH, triển khai, đổi DNS/tunnel/UFW/router hoặc xác minh tài nguyên HP trong đợt này.** Cấu hình đã kiểm trên PC/Docker Linux, chưa phải nghiệm thu production.

## Định danh và kiến trúc

| Mục | Giá trị dùng trong bộ triển khai |
| --- | --- |
| Public URL | `https://trumpkeys.publice.io.vn` (giữ tên đã chốt trong REQUIREMENTS) |
| Thư mục HP | `/home/congminh/apps/KeyboardPrj` (giữ đường dẫn hiện hành) |
| Compose project | `trumpkeys-hp` |
| Web / metrics tunnel | `127.0.0.1:8094` / `127.0.0.1:2094`, đều phải xác minh trống |
| Runtime | Next.js16.4.6, React19.3.0, Node24.22.3 Debian bookworm, linux/amd64 |
| Backend | Supabase managed **riêng** (`project_ref`: `qhxwyzkfylfipfvpesbe`): PostgreSQL/Auth/Storage; không dùng DB BankingPrj |
| CPU/RAM tối đa | web1CPU/512MiB + tunnel0.25CPU/128MiB; chưa gồm build, backup, Docker/OS |

Yêu cầu mới ưu tiên **tunnel riêng** thay phương án dùng chung `hp-homeserver` trong tài liệu cũ. Profile `tunnel` tạo connector của riêng `trumpkeys-hp`, không sửa `banking-tunnel` hay các route khác. Container names mặc định `trumpkeys-hp-web-1`, `trumpkeys-hp-cloudflared-1`; không cần hardcode `container_name` gây xung đột. Network bridge `trumpkeys-hp_application` riêng cho web; không dùng external network/volume dự án khác.

```text
Browser HTTPS → Cloudflare Named Tunnel riêng
→ cloudflared (Ubuntu host network)
→ HTTP 127.0.0.1:8094 → web:3000 (0.0.0.0 trong container)
→ Supabase HTTPS riêng (DB/Auth/Storage bền vững)
```

Host networking **chỉ cho cloudflared** để giữ topology loopback bạn yêu cầu. Web vẫn dùng bridge riêng. Metrics tunnel bind loopback2094, không mở thêm host port. Connector host-network có thể truy cập dịch vụ loopback khác theo quyền host; đây là giới hạn cách ly cần biết, không ghép network ứng dụng khác. Không chạy nguyên Compose này trên Windows như production; test container PC dùng cổng ngẫu nhiên riêng.

Không thêm DB/Redis/Kafka/Nginx/upload volume vì ứng dụng không ghi dữ liệu nghiệp vụ vào filesystem web. Không chuyển local Supabase PC (127.0.0.1:54321) thành backend HP hoặc self-host trọn Supabase trên máy8GB khi chưa đo được tài nguyên.

## Bước 1 — kiểm tra HP chỉ đọc

**[HP Server], thư mục home bất kỳ**: chạy khối trong [HP-PREFLIGHT.md](HP-PREFLIGHT.md). Kỳ vọng8094 và2094 trống, app cũ khỏe và đủ disk/RAM. Nếu không đạt, dừng ở bước này; không dừng ứng dụng chiếm cổng. 8090–8093 giữ nguyên.

## Bước 2 — kiểm tra và đóng gói trên PC

**[PC Windows], PowerShell tại `C:\Users\Dung\KeyboardPrj`**, Docker Desktop ở chế độ Linux containers:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm audit
npm run test:container
python scripts/verify-hp-backup.py
```

Kỳ vọng các lệnh exit0; audit0 vulnerabilities tại lần kiểm, không phải bảo đảm tương lai. Container test tự tạo/xóa đúng container fixture, không dùng secret/DB thật. Python test cần Python3 trên PC chỉ cho phép thử backup, không phải dependency của web.

Mã nguồn hiện ban đầu đều untracked, chưa tự commit/đẩy remote. Review `git status --short`, `.gitignore`, scan secret trước khi tạo commit riêng của bạn. Không đưa `.env*` thật, `.ssh`, backup, log vào index. Nếu Git chưa có HEAD thì các lệnh archive dưới đây chưa chạy được; không phát hành một archive rỗng hoặc bỏ qua nguồn gốc release.

Sau khi có commit đã review:

```powershell
$releaseTag = git rev-parse --short=12 HEAD
New-Item -ItemType Directory -Force output/deploy | Out-Null
git archive --format=tar.gz -o "output/deploy/trumpkeys-$releaseTag.tar.gz" HEAD
docker buildx build --platform linux/amd64 --load -t "trumpkeys-web:$releaseTag" .
docker image inspect "trumpkeys-web:$releaseTag" --format '{{.Os}}/{{.Architecture}} {{.Id}}'
docker save -o "output/deploy/trumpkeys-image-$releaseTag.tar" "trumpkeys-web:$releaseTag"
Get-FileHash "output/deploy/trumpkeys-$releaseTag.tar.gz" -Algorithm SHA256
Get-FileHash "output/deploy/trumpkeys-image-$releaseTag.tar" -Algorithm SHA256
```

Kỳ vọng `linux/amd64`. Dockerfile pin cả version+digest base image, `npm ci` dùng lockfile, user runtime `node` UID1000; build không nhận env thật vì `.dockerignore`. Image không chứa `.env.local` hoặc SSH key. Không dùng build args để truyền secret. Giữ hash ngoài archive để đối chiếu HP. Build PC giúp tránh thiếu RAM trên HP; mem_limit runtime không giới hạn RAM build.

## Bước 3 — đưa release/image lên HP

**[PC Windows], cùng thư mục**, dùng SSH agent/config `homeserver` đã có, không đọc hay copy private key:

```powershell
ssh -i "$env:USERPROFILE\.ssh\homeserver_ed25519" congminh@100.95.33.63 'mkdir -p /home/congminh/apps/KeyboardPrj/incoming'
scp -i "$env:USERPROFILE\.ssh\homeserver_ed25519" "output/deploy/trumpkeys-$releaseTag.tar.gz" "output/deploy/trumpkeys-image-$releaseTag.tar" congminh@100.95.33.63:/home/congminh/apps/KeyboardPrj/incoming/
```

Nếu máy bạn chưa có alias `homeserver`, dùng đích SSH/Tailscale đã được bạn cấu hình (`congminh@100.95.33.63`) thay alias. Lỗi publickey xử lý ở máy bạn theo cấu hình SSH hiện có; không mở private key hoặc đổi sshd/UFW.

**[HP Server], thư mục dự án**:

```sh
cd /home/congminh/apps/KeyboardPrj
release_tag=REPLACE_WITH_COMMIT_TAG
# Thay placeholder trước khi tiếp tục; chỉ chữ/số an toàn.
case "$release_tag" in *[!a-f0-9]*|'') exit 1 ;; esac
sha256sum "incoming/trumpkeys-$release_tag.tar.gz" "incoming/trumpkeys-image-$release_tag.tar"
test ! -e "releases/$release_tag" || exit 1
mkdir -p "releases/$release_tag" shared
chmod 700 shared
tar -xzf "incoming/trumpkeys-$release_tag.tar.gz" -C "releases/$release_tag"
sudo docker load -i "incoming/trumpkeys-image-$release_tag.tar"
cd "releases/$release_tag"
test -e ../../shared/.env || (umask 077; cp .env.example ../../shared/.env)
chmod 600 ../../shared/.env
ln -s ../../shared/.env .env
nano ../../shared/.env
```

Chỉ tiếp tục giải nén sau khi hai SHA256 khớp PC. Dùng archive từ commit bạn tạo, không giải nén archive không tin cậy. Mỗi release là thư mục mới; không giải nén đè release cũ. `ln` lỗi nếu .env đã tồn tại: kiểm release/path, không xóa env thật để chữa.

Nếu buộc build trên HP, chỉ sau preflight đủ RAM/disk: `sudo env IMAGE_TAG="$release_tag" docker compose --env-file .env -p trumpkeys-hp -f compose.yaml build web`. Tránh build đồng thời backup hoặc tải nặng app khác; ưu tiên image đã build PC.

## Bước 4 — backend, migration và env

Trong editor HP, điền `PUBLIC_URL=https://trumpkeys.publice.io.vn`, `CORS_ORIGINS` cùng exact origin, `WEB_PORT=8094`, `IMAGE_TAG` là release tag và ba biến `SUPABASE_*` của backend riêng. Compose ánh xạ PUBLIC_URL thành APP_ORIGIN cho code/cookie. Không wildcard CORS; không thêm allow-origin header vì frontend/API cùng origin. Startup HP từ chối thiếu env/HTTP origin/CORS khác origin; thử DB tối đa5lần (3giây mỗi lượt, nghỉ2giây), không tự migration/reset khi startup. Docker restart có thể thử lại vòng startup; cần cảnh báo nếu restart lặp.

Không có JWT secret/DB password của ứng dụng trong env web: Google/Auth/JWT do Supabase quản lý. Google client secret nhập trong Supabase provider settings. GEMINI/TELEGRAM mặc định false; bật khi đã nghiệm thu riêng. Tunnel token chỉ trong env connector, không truyền vào web. Đọc [HP-BACKUP-RESTORE.md](HP-BACKUP-RESTORE.md) cho credential backup tách riêng.

**Migration không được bỏ qua:** bản vá quota cần `20261120104810_production_security.sql`. Local PC đã áp dụng không reset và kiểm advisors. Production dùng Supabase project `qhxwyzkfylfipfvpesbe` (dùng CLI đã pin 3.2.0, đọc `npx supabase db push --help` trước thao tác). Chọn explicit target bằng `--remote=qhxwyzkfylfipfvpesbe`; token scoped và password nhập tại terminal/password manager, không ghi tham số secret vào history. Chạy `npx supabase db push --remote=qhxwyzkfylfipfvpesbe --dry-run --skip-vault` để review danh sách, backup/drill trước rồi `npx supabase db push --remote=qhxwyzkfylfipfvpesbe --skip-vault`. Không include-seed/include-roles/reset/clean. Project mới cần toàn bộ migrations; project có dữ liệu cần đối chiếu migration history, không dùng include-all để bỏ qua lệch lịch sử. Migration lỗi thì giữ web cũ, điều tra ở staging.

Supabase Auth: Site URL chính xác public origin; redirect allowlist **exact** `https://trumpkeys.publice.io.vn/auth/callback`. Google Authorized redirect URI là `https://<project-ref>.supabase.co/auth/v1/callback`. Không nhầm hai callback. Chỉ bật Google provider đã kiểm, kiểm cookie `Secure`, `HttpOnly`, `SameSite=Lax`, logout/revoked session. Admin Google không tự được cấp quyền: bootstrap đầu tiên qua quy trình operator kiểm identity ở DB, không mở endpoint hoặc bypass. Với production mới, operator có thể gọi RPC `bootstrap_first_admin` trong Dashboard SQL bằng **UUID Google đã xác minh đúng email đã chốt**, không copy dữ liệu Auth local sang để giả đăng nhập. Lưu audit, thử non-admin bị chặn; lời gọi DB function vẫn tự kiểm email/identity và chỉ chạy một lần.

## Bước 5 — chạy web trước tunnel

**[HP Server], release mới**, chỉ project này:

```sh
sudo docker compose --env-file .env -p trumpkeys-hp -f compose.yaml config --quiet
sudo env IMAGE_TAG="$release_tag" docker compose --env-file .env -p trumpkeys-hp -f compose.yaml up -d --no-build --pull never web
sudo env IMAGE_TAG="$release_tag" docker compose --env-file .env -p trumpkeys-hp -f compose.yaml ps
curl --fail --max-time 5 http://127.0.0.1:8094/api/health
curl --fail --max-time 5 http://127.0.0.1:8094/healthz
```

Kỳ vọng liveness200 và readiness200. `/healthz` trả503 khi thiếu cấu hình/DB/query lỗi; payload chỉ status, no-store, không stack/secret. Query DB read-only cache tối đa5giây; không chứng minh OAuth, key đặc quyền, Storage upload hoặc Gemini/Telegram sẵn sàng. Healthcheck image dùng readiness; Docker không tự restart chỉ vì unhealthy. Inspect chỉ trường an toàn: `sudo docker inspect --format '{{.State.Health.Status}} {{.RestartCount}}' trumpkeys-hp-web-1`.

Nếu liveness không lên: kiểm image tag, `docker compose ... ps`, xem log web riêng tại máy, kiểm env trong editor. Không paste `docker inspect` toàn bộ/config/env/log có PII lên chat. Nếu503: kiểm URL/key, outbound HTTPS/CA, backend awake và migrations/RLS. Không thêm fallback giá mẫu hoặc bỏ guard.

## Bước 6 — tunnel riêng, không đổi BankingPrj

Trong Cloudflare Zero Trust Dashboard của bạn, tạo Named Tunnel **mới** `trumpkeys-hp`; lấy token connector và nhập trực tiếp vào `.env` bằng editor HP (`TUNNEL_TOKEN=`), không chạy lệnh có token literal và không gửi chat. Không dùng lại `banking-tunnel`/token hiện có.

Thêm Published application route duy nhất:

- Hostname `trumpkeys.publice.io.vn`, service type HTTP, URL `127.0.0.1:8094`.
- HTTP Host Header `trumpkeys.publice.io.vn`; giữ APP_ORIGIN HTTPS dù hop nội bộ HTTP.
- Không chỉnh route `bankingprj.020407.xyz` hoặc route khác. Nếu hostname đã có DNS/route, xác minh nó thuộc TRUMP Keys trước khi chuyển, không ghi đè mù.
- SSL public bật HTTPS, không Cache Everything cho HTML/action/auth/admin/account/chat/checkout/tracking/API/health. Không thêm cache rule ghi đè no-store.

**[HP Server], release mới**:

```sh
sudo env IMAGE_TAG="$release_tag" docker compose --env-file .env -p trumpkeys-hp -f compose.yaml --profile tunnel pull cloudflared
sudo env IMAGE_TAG="$release_tag" docker compose --env-file .env -p trumpkeys-hp -f compose.yaml --profile tunnel up -d --no-build --pull never cloudflared
sudo docker compose --env-file .env -p trumpkeys-hp -f compose.yaml --profile tunnel ps
curl --fail --max-time 5 http://127.0.0.1:2094/ready
```

Kỳ vọng connector healthy và Dashboard Connected. Token rỗng/sai: connector không kết nối, sửa riêng project này. 502: kiểm web health, cổng, HTTP Host Header và host namespace. Không đổi UFW/router. Metrics2094 đang trống là điều kiện bắt buộc trước chạy.

## Bước 7 — IP, CORS, rate limit và kiểm thử ngoài 4G

Next.js không có Express `trust proxy`. Không đặt tùy ý số hop2 rồi tin XFF. Compose đặt `TRUSTED_PROXY=cloudflare`; proxy chỉ dùng một `CF-Connecting-IP` IPv4/IPv6 hợp lệ, không fallback XFF. Trust dựa trên **đường vào duy nhất Cloudflare Tunnel + port web loopback**, không phải tính xác thực của chuỗi header tự nó. Tiến trình có quyền host/local Docker vẫn là miền tin cậy: chúng có thể giả header; tuyệt đối không publish thêm ingress LAN/public hoặc kết nối app bridge từ workload không tin cậy. Không thêm Worker cùng zone sửa client-IP; tắt Pseudo IPv4 Overwrite/Remove visitor IP headers nếu làm mất IP gốc. Nếu topology thay đổi, review lại trust trước public.

Tracking30request/phút/IP; login/callback20; POST30; page180. Vượt hạn trả429+Retry-After/no-store trước refresh session/DB. Bộ đếm web bounded4000 entries, một process/một replica, reset khi restart; không thay Cloudflare WAF chống DDoS. IP cùng NAT có thể chung quota; kiểm hai mạng thật. Quota DB persistent10đơn/giờ/tài khoản và global100giờ chung request/checkout, idempotent retry không tăng quota. Chat vẫn có quota phiên/giờ/ngày DB riêng. Rate limit IP web chỉ bật khi chọn trusted Cloudflare, không áp dụng dev localhost như production.

**[PC Windows/thiết bị 4G], ngoài mạng nhà**, dùng origin public:

```powershell
curl.exe --fail --max-time 10 https://trumpkeys.publice.io.vn/healthz
curl.exe -I https://trumpkeys.publice.io.vn/
curl.exe -i -X OPTIONS -H "Origin: https://untrusted.example" -H "Access-Control-Request-Method: POST" https://trumpkeys.publice.io.vn/healthz
curl.exe -i -X POST -H "Origin: https://untrusted.example" https://trumpkeys.publice.io.vn/checkout
1..31 | ForEach-Object { curl.exe -s -o NUL -w "%{http_code}\n" https://trumpkeys.publice.io.vn/track/invalid-security-check }
```

Kỳ vọng health200; headers nosniff/DENY/no-referrer/CSP hạn chế object/base/frame/Permissions-Policy. Preflight không có `Access-Control-Allow-Origin` (không cần allowlist cross-origin), POST origin lạ403. Tracking invalid hiển thị không tìm thấy, đến giới hạn429; với Next streaming, không tìm thấy/chuyển login có thể HTTP200 kèm điều hướng/notFound trong HTML. Không dùng healthz để thử quota vì health được miễn và có cache query ngắn. Chạy burst chỉ một lần trên dữ liệu invalid; chờ60giây rồi thử lại, không dùng mã đơn thật/log tracking capability.

Trên browser4G thử Google login/logout, non-admin không vào admin, checkout/QR/cọc bằng fixture được shop duyệt, upload valid/invalid/size, tiền/kho chỉ thay khi admin xác nhận, account A không thấy đơn B, chat tách phiên và fallback. Thử một mạng4G khác không bị429 cùng lượt. Không gửi tiền hoặc gọi dịch vụ thật bằng test tự động. Kiểm SW chỉ có offline fallback, không có cache dữ liệu cá nhân. Hoàn tất backup/drill/new-stack UAT trước công khai nhận đơn.

## Bước 8 — monitor, update và rollback

Thêm một HTTP check mới trong **cơ chế monitor hiện có của HP** cho `http://127.0.0.1:8094/healthz`, methodGET, expected200, timeout5giây, mỗi60giây; cảnh báo sau3lỗi liên tiếp và báo hồi phục. Giữ check liveness `/api/health` riêng để phân biệt web chết/DB lỗi. Có thể thử read-only bằng `curl --fail --max-time 5 .../healthz >/dev/null` trước khi gắn. Không in/đọc `/etc/hp-server-monitor/telegram.json`, không thay token/chat của monitor. Chưa biết định dạng cấu hình monitor nên không đưa lệnh ghi tự suy vào service; thêm check theo schema sẵn có ngay tại HP, kiểm syntax/dry-run và reload riêng monitor theo hướng dẫn của nó. Không restart Docker/banking để thêm check.

Theo dõi thêm RestartCount/health, RSS/CPU/disk, tuổi backup và ngày drill cuối. HTTPS ngoài nhà cần check riêng vì loopback không phát hiện DNS/tunnel lỗi. Log json-file mọi container10MiB×3; không bật cloudflared debug vì có thể log URL/header nhạy cảm. App không log request capability/PII. CSP hiện chỉ base/object/frame, chưa là nonce script-src chống mọi XSS; xem báo cáo audit.

Trước mỗi update: backup+drill, ghi tag/imageID cũ và hash env trong hồ sơ riêng; giữ image/release cũ. Nạp image mới xong mới `up` riêng web. Một replica có gián đoạn ngắn khi recreate; không cam kết zero downtime. Tunnel có thể giữ nguyên khi chỉ đổi web.

Rollback **[HP Server], release cũ tương thích schema**:

```sh
cd /home/congminh/apps/KeyboardPrj/releases/REPLACE_OLD_TAG
old_tag=REPLACE_OLD_TAG
sudo env IMAGE_TAG="$old_tag" docker compose --env-file .env -p trumpkeys-hp -f compose.yaml up -d --no-build --pull never web
curl --fail --max-time 5 http://127.0.0.1:8094/healthz
```

Shared env thay đổi cần khôi phục bản tương ứng chủ động sau backup hiện tại; không giải nén tự động đè. Bản vá DB quota là additive replacement tương thích chữ ký, giữ khi rollback image cũ; không rollback bằng sửa ledger/xóa bảng/reset. Không dùng `down -v`, prune, hoặc thao tác project khác.

Nguồn: [Next self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Cloudflare headers/trust](https://developers.cloudflare.com/fundamentals/reference/http-headers/), [cloudflared run parameters](https://developers.cloudflare.com/tunnel/reference/run-parameters/), [Compose services](https://docs.docker.com/reference/compose-file/services/).
