# Rà soát M1 trước M2 — 19/11/2026

## Kết luận

Các kiểm tra nền tảng Auth/quyền admin/API/Storage local được chạy lại và đạt. Có thể chuyển sang M2 trên PC. Chưa bắt đầu M2 trong lần rà soát này, chưa triển khai HP. Không coi đây là nghiệm thu phát hành production.

## Kiểm tra đã thực hiện

| Kiểm tra | Bằng chứng/kết quả |
| --- | --- |
| Google login và admin đầu tiên | Người dùng đã đăng nhập Google thật và xác nhận vào được admin. Backend có membership active/bootstrap/audit. Không mượn cookie hoặc token phiên thật của người dùng để kiểm thử. |
| Unit/SQL regression | `npm test`: 16 tests tính cả subtests, đạt. PostgreSQL PGlite thực thi migration với schema Auth/Storage fixture. |
| Integration local thật | `npm run test:m1-local`: 6 nhóm qua PostgREST/Storage API, đạt. Dùng Supabase local thật đang chạy. |
| Cạnh tranh invite | Hai request từ hai session fixture đồng thời dùng cùng mã: đúng một người được cấp quyền; người còn lại và lần dùng lại bị từ chối. |
| Giới hạn quyền | Anon không đọc membership; non-admin không nhìn thấy admin khác/tự insert membership/call bootstrap; role/provider giả trong user_metadata không nâng quyền. Private schema không truy cập được qua Data API. |
| Vòng đời invite | Hash không lộ qua danh sách; hết hạn/thu hồi bị chặn; thử sai tăng bộ đếm và bị rate limit. |
| Vô hiệu hóa | Chặn RPC admin và đọc ảnh ngay ở request sau; mã mời chưa dùng do tài khoản disabled tạo bị thu hồi; không redeem để tự mở lại. Kích hoạt lại hoạt động. |
| Phiên đã xóa | JWT fixture còn hạn nhưng auth.sessions đã xóa: has_live_session/is_admin false, RPC admin bị chặn. Không đăng xuất tài khoản thật. |
| Storage API | Admin upload/download PNG nhỏ thành công; anon/non-admin bị chặn đọc/upload; public URL không đọc được bucket private. Chặn MIME text/plain, file >5MiB ở request-images và upsert lên object đã tồn tại. Đây không phải kiểm chứng nội dung ảnh chống file giả dạng. |
| HTTP không đăng nhập | `/admin`, `/admin/join`: 307 về login. Callback code sai kèm next=https://evil.example vẫn 307 về login nội bộ. `/admin/bootstrap`: 404. |
| Security advisor | `npm run db:check`: không phát hiện lỗi. |
| Migration | CLI xác nhận version local DB và file migration cùng `20261119033017`. Không reset database đang có tài khoản thật. |
| Mã nguồn | Lint, typecheck và production build đạt. |
| Secret | `.env.local`, `.env.bootstrap.local`, `supabase/.env` đều bị Git ignore. Test chỉ giữ key/JWT trong bộ nhớ, không ghi vào report. |

## Phạm vi fixture và bảo toàn dữ liệu

`scripts/verify-m1-local.mjs` chỉ chạy khi URL đúng `http://127.0.0.1:54321` và Docker DB container `supabase_db_trumpkeys-local`. Tạo tài khoản `m1-…@example.test` riêng, thêm Google identity/session **tổng hợp trong fixture** để kiểm policy/API, không tạo luồng đăng nhập giả trong ứng dụng và không thay thế kiểm chứng Google OAuth thật.

Raw token thử được ký bằng key của local stack, chỉ trong script test và hết hạn sau 10 phút; không lấy session thật, không đưa vào UI/browser/URL/artifact. Sau mỗi lần chạy: xóa đúng object Storage, invite, audit, attempts, membership và Auth users của lần đó. Script đã xác nhận fixture users không còn; số admin thật active giữ nguyên. Chạy lại để xác nhận cleanup/idempotence cũng đạt.

Thêm lệnh này vào CI job Supabase local sau khi migrate/types. CI chưa chạy trên GitHub vì chưa có remote; kết quả ở đây là chạy trực tiếp trên PC.

## Giới hạn cần kiểm trước phát hành

- Chưa tự thao tác nút tạo/redeem/disable sau đăng nhập trong trình duyệt bằng hai tài khoản Google thật. Backend API đã được kiểm; dashboard Google thật do người dùng xác nhận.
- Chưa kiểm refresh token hết hạn và logout qua nút UI end-to-end. Đã kiểm DB từ chối JWT của session bị xóa.
- Chưa thử reset/rebuild toàn bộ stack vào môi trường Supabase thử nghiệm thứ hai; không reset local hiện tại vì cần giữ tài khoản/cấu hình. PGlite chạy migration sạch và Supabase thật áp dụng lần đầu đều đã qua.
- PWA thiết bị thật, HTTPS/cookie Secure trên domain thật, backup/restore và thông số triển khai là kiểm tra phát hành sau, chưa làm trên HP.

M2 có thể bắt đầu mà không cần người dùng cung cấp thêm bảng giá ngay; giữ những giới hạn trên trong checklist phát hành.
