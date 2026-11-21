# M1 — Auth và quyền admin trên PC

**Cập nhật M3:** Google/admin thật đã được người dùng xác nhận. Quy tắc M1 bên dưới chỉ cần publishable cho Auth; từ M3 app cần thêm `SUPABASE_SECRET_KEY` chỉ ở server runtime cho DTO tracking và ký ảnh private. Xem [M3-ORDERS.md](M3-ORDERS.md); không đưa secret vào image/browser. Các hướng dẫn “không cần secret ở app” phía dưới là phạm vi M1 lịch sử.

## Trạng thái

Đã có mã server, migration/seed, RLS, trang login/join/admin, mã mời, vô hiệu hóa/kích hoạt lại admin, script bootstrap và kiểm thử SQL. Chỉ làm local trên PC, không truy cập/triển khai HP.

**Cập nhật môi trường local:** Docker Engine 29.9.2 đã chạy; Supabase `trumpkeys-local` đã khởi động với Google provider bật. Người dùng đã điền credentials trong file gitignored. Migration M1 đã áp dụng trên PostgreSQL thật, seed có 4 nhóm; security advisors không phát hiện lỗi. App đã nối backend local qua `.env.local`.

**Google login/bootstrap đã xác minh:** người dùng đăng nhập Google thật và xác nhận vào được admin. Operator đã xác minh đúng Google identity rồi bootstrap thành công `congminhnguyen0204@gmail.com`; membership active, bootstrap singleton hoàn tất, có audit và phiên Auth.

**Rà soát trước M2 đạt:** 16 unit/SQL tests và 6 nhóm integration qua Supabase API thật, gồm cạnh tranh invite, disable, session bị xóa và Storage private. Đã dọn dữ liệu thử, giữ admin thật. Đủ nền để chuyển M2; các kiểm tra UI/refresh/logout và reset môi trường riêng còn theo dõi trước phát hành. Xem [báo cáo M1-REVIEW.md](M1-REVIEW.md), không coi API fixture là hai người đăng nhập Google thật.

`src/lib/database.types.ts` hiện đã được **sinh bằng Supabase CLI từ database local thật**, sau đó typecheck đạt. Script chạy trực tiếp CLI đã pin qua Node, không dùng shell để nối tham số. CI có job local stack kiểm migration/reset/advisors/types, chưa có kết quả CI; job tắt riêng Google trong cấu hình thử nghiệm để không cần credentials thật.

Kiểm tra đã đạt: `npm run lint`, `npm run typecheck`, `npm test` (16 tests tính cả subtests SQL), `npm run build`. Browser trên dev server hiện có: login desktop/mobile không tràn ngang, Google button disabled khi thiếu config; `/admin` và `/admin/join` trả 307 về login; callback thiếu cấu hình không nhận open redirect, route web bootstrap trả 404. Chưa xem dashboard sau login thật, chưa kiểm hai session đồng thời trên Supabase thật; bộ test không dùng để tuyên bố Google OAuth đã hoạt động.

## Luồng đã triển khai

1. `/admin` kiểm danh tính Google với Auth server, phiên đang tồn tại trong auth.sessions và membership active. Chưa đăng nhập chuyển `/admin/login`; không có quyền chuyển `/admin/join`.
2. Google OAuth dùng PKCE, code verifier/session trong cookie HttpOnly, SameSite=Lax; Secure khi APP_ORIGIN là HTTPS. Không có Supabase client trong trình duyệt, không cần `NEXT_PUBLIC_*` hoặc secret key trong app.
3. Callback chỉ quay lại origin do operator cấu hình, không nhận `next`/redirect tùy ý từ query. Lỗi chỉ hiển thị thông báo chung, không log code/token.
4. Đăng nhập Google không tự cấp quyền. Admin đầu tiên phải do operator bootstrap đúng tài khoản Google đã xác minh `congminhnguyen0204@gmail.com`, chỉ một lần.
5. Admin active tạo token ngẫu nhiên 256-bit, một lần dùng, hạn 24 giờ; server chỉ lưu SHA-256. Raw token chỉ trả về trong lần tạo và không thể xem lại sau reload. Mỗi admin tối đa 10 lời mời chưa hết hạn/chưa thu hồi/chưa dùng.
6. Người được mời đăng nhập Google rồi nhập mã tại `/admin/join`. DB redeem atomic, không cho dùng lại/hết hạn/thu hồi; tối đa 10 lượt/15 phút/tài khoản, tính cả thử sai. Mã không nằm trong URL để tránh log/referrer.
7. Admin cùng quyền, được vô hiệu hóa/kích hoạt lại admin khác, không được tự vô hiệu hóa mình. Quyền membership và phiên kiểm lại ở DB cho RPC/RLS; không tin role trong user_metadata. Khi vô hiệu hóa một admin, lời mời chưa dùng do họ tạo bị thu hồi. Tài khoản disabled không dùng invite để tự mở lại.
8. Logout xóa phiên hiện tại; auth.sessions được kiểm ở quyền admin/redeem nên JWT cũ của phiên bị xóa cũng không tiếp tục gọi quyền admin. Thao tác đã được cho phép và đang chạy có thể hoàn tất.

## Chạy phần hiện có, chưa cần Docker

**PC PowerShell:**

```powershell
npm ci
npm test
npm run dev
```

Mở `http://localhost:3000/admin`: chuyển login, hiển thị chưa cấu hình, nút Google bị vô hiệu hóa. Không có fake login/admin mặc định. Homepage/demo M0 vẫn chạy bình thường.

## Khởi động Supabase local khi có Docker

Không cần tạo project cloud để phát triển. Cần Docker-compatible Engine chạy Linux containers trên PC. Không bật Docker/port hoặc sửa HP để bù cho thiếu runtime PC.

```powershell
docker info
npm run db:start
```

Project local: `trumpkeys-local`; Postgres 17, API 54321, DB 54322, Studio 54323. Config tắt Realtime, Analytics, Vector Storage và Edge Runtime chưa dùng. Kiểm cổng/port publish thực tế qua Docker khi chạy; không coi local Supabase là dịch vụ đã được bảo vệ để đưa ra internet, không thêm vào Cloudflare Tunnel.

CLI 3 đã pin, lệnh mặc định local; trong M1 không dùng `--remote`. Không chạy `db reset` trên nơi có dữ liệu cần giữ. Local stack mới sẽ áp dụng migration/seed; khi thay đổi dùng `npm run db:push` và kiểm `npx supabase migration list`.

```powershell
npm run db:check
npm run db:types
npm run typecheck
```

Nếu migration đã áp dụng, tạo migration mới bằng CLI; không sửa file cũ để thay đổi database có lịch sử. Không chạy reset để chữa lỗi OAuth.

## Thiết lập Google OAuth local

1. Tạo Google Cloud project và OAuth Client kiểu **Web application**. Chỉ cần scope openid/email/profile; để app testing và thêm email người thử vào test users nếu Google yêu cầu.
2. Authorized JavaScript origin: `http://localhost:3000`.
3. Authorized redirect URI của Google: **`http://127.0.0.1:54321/auth/v1/callback`**. Đây là callback Supabase, khác callback Next.js.
4. Copy `supabase/.env.example` thành `supabase/.env`, đặt Google Client ID/Secret tại máy. Không gửi secret vào chat/commit Git.
5. Trong `[auth.external.google]` ở `supabase/config.toml`, chuyển `enabled = true` sau khi điền credentials. Giữ nonce check. `auth.email.enabled = false`, anonymous sign-in tắt.
6. Restart đúng project local bằng `npm run db:stop` rồi `npm run db:start` (không dùng cờ xóa dữ liệu). Đây là local dev, không áp dụng cho HP.
7. Copy `.env.local.example` thành `.env.local`; đặt SUPABASE_URL và publishable key lấy từ `npx supabase status`. Giữ APP_ORIGIN=`http://localhost:3000`. Không chép secret/service-role key vào trường publishable.
8. Next.js callback đã được allowlist chính xác là `http://localhost:3000/auth/callback`. Dùng nhất quán localhost cho app, không trộn với 127.0.0.1:3000 trong cùng phiên PKCE. Restart `npm run dev` sau khi đổi env.

Credentials Google nằm ở Auth server local, không nằm trong ứng dụng Next.js. Các key local do CLI in ra không được đưa vào ảnh chụp/chat hoặc repository.

## Cấp quyền admin đầu tiên

Sau khi đăng nhập Google đúng tài khoản đã chốt, tài khoản xuất hiện ở Auth → Users trong Studio nhưng vẫn chưa là admin. Lấy UUID của tài khoản đó.

Tạo **`.env.bootstrap.local`** (gitignored) chỉ dành cho operator:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=
BOOTSTRAP_USER_ID=
```

Điền secret local và UUID trực tiếp ở PC, rồi chạy:

```powershell
npm run admin:bootstrap
```

Script chỉ chấp nhận backend loopback trong M1, kiểm Google identity/email đã xác minh rồi gọi RPC chỉ service_role được phép. DB khóa singleton để không bootstrap hai lần. Không có route web tương đương. Reload `/admin` sau khi thành công. Không lưu secret này vào image, app env hay URL. Có thể bỏ file bootstrap khỏi máy sau khi cất credentials ở nơi bảo vệ; không cần cho ứng dụng chạy.

## Database/RLS

Migration `20261119033017_admin_foundation.sql` tạo:

- `public.admin_members`: chỉ SELECT dưới RLS, không cho authenticated tự INSERT/UPDATE/DELETE.
- `public.service_categories`: khách đọc active, admin CRUD dưới RLS; seed 4 nhóm, không seed admin/người dùng/đơn thật.
- Private invite, attempts, bootstrap state và audit; không đưa private schema vào Data API. RPC public là SECURITY INVOKER wrapper. SECURITY DEFINER chỉ ở private, search_path rỗng, fully-qualified object, kiểm actor cụ thể và revoke execute mặc định.
- Hai bucket private `order-media` (10 MiB, JPEG/PNG/WebP/MP4) và `request-images` (5 MiB, JPEG/PNG/WebP). Admin select/insert/delete; không cho overwrite/update. Khách chưa có quyền upload/read; M3/M4 thêm endpoints có validation và ký URL theo đúng đơn/phiên. Seed không tạo public bucket.

Không tạo sẵn toàn bộ bảng đơn/chat/giá vốn chưa dùng: M2–M5 thêm migration theo module, dùng chung helper quyền. Khi thêm bảng exposed phải có RLS/GRANT rõ ràng trước khi UI nối dữ liệu.

## Nghiệm thu còn lại để đóng M1

- Đã chạy stack local, migration/seed/advisors/types; chưa thử reset lại trên database thử nghiệm riêng sau khi có tài khoản thật, không reset database đang dùng để sửa OAuth.
- Google login/callback/refresh/logout thật, cookie HttpOnly/Secure đúng môi trường; thử callback thiếu/sai code và không có open redirect.
- Bootstrap email đúng/sai, không tạo lại được; Google account thứ hai không thấy admin khi chưa có invite.
- Hai session đồng thời tranh một invite: chỉ một người nhận quyền; role disable chặn session còn sống; account disabled không redeem lại.
- Upload thực qua Storage API: đúng/sai MIME/size, guest không đọc file; PGlite kiểm SQL policy chưa chứng minh validation/storage API.
- Kiểm UI sau login trên desktop/mobile. Hiện chỉ có thể kiểm giao diện chưa cấu hình và redirect bảo vệ; không dựng mock route để vượt Auth.

Nguồn đã đối chiếu: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [session_id và logout](https://supabase.com/docs/guides/auth/sessions), [CLI local](https://supabase.com/docs/guides/local-development/cli/getting-started), [CLI v3](https://supabase.com/changelog/supabase-cli-v3), [PGlite](https://pglite.dev/docs/).
