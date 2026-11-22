# Audit Chỉ Đọc (Mảng A): Bảo mật, Auth, RLS, Grants & Fail-Closed — KeyboardPrj

- **Vai trò:** Independent Security & Backend Auditor (Codex Plus, `-Mode Review`, read-only).
- **Mục tiêu:** Rà soát sâu mảng **(A) Bảo mật & RLS/Auth** của toàn bộ dự án KeyboardPrj. Chỉ báo cáo các finding **có bằng chứng thực tế trong mã nguồn** (`file:dòng`, mức độ `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`, tác động thực tế, đề xuất sửa). Không bịa lỗi; nếu một mục an toàn thì ghi rõ đã kiểm tra và đạt.
- **Ràng buộc tuyệt đối:** KHÔNG đọc hoặc trích xuất bất kỳ file `.env*`, key SSH, cookie thật, PII thật hay dữ liệu bí mật.

## Tài liệu quy chuẩn đối chiếu
- `AGENTS.md`
- `docs/REQUIREMENTS.md`, `docs/DATA-MODEL.md`, `docs/M1-REVIEW.md` .. `docs/M7-READINESS.md`, `docs/STOREFRONT.md`, `docs/BANK-PAYMENT.md`

## Phạm vi file cần rà soát
1. **Auth, Proxy, Host Policy & Security Helpers:**
   - `src/proxy.ts`
   - `src/instrumentation.ts`
   - `src/app/auth/callback/route.ts`
   - `src/app/api/health/route.ts`, `src/app/healthz/route.ts`
   - `src/lib/auth.ts`, `src/lib/auth-config.ts`, `src/lib/host-policy.ts`, `src/lib/request-security.ts`, `src/lib/request-token.ts`
   - `src/lib/supabase/server.ts`, `src/lib/supabase/service.ts`, `src/lib/supabase/session.ts`
   - `src/lib/customer-account.ts`, `src/lib/profile.ts`, `src/lib/integrations.ts`, `src/lib/readiness.ts`, `src/lib/readiness-probe.ts`
2. **Server Actions Authorization & Input Validation:**
   - `src/app/admin/actions.ts`
   - `src/app/admin/banners/actions.ts`
   - `src/app/admin/catalog/actions.ts`, `src/app/admin/catalog/media-actions.ts`
   - `src/app/admin/customers/actions.ts`
   - `src/app/admin/inbox/actions.ts`
   - `src/app/admin/notifications/actions.ts`
   - `src/app/admin/orders/actions.ts`
   - `src/app/admin/portfolio/actions.ts`
   - `src/app/admin/requests/actions.ts`
   - `src/app/account/actions.ts`
   - `src/app/chat/actions.ts`
   - `src/app/checkout/actions.ts`
   - `src/app/preorder/actions.ts`
3. **Database Security, RLS, Grants, Storage Policies & SECURITY DEFINER RPCs:**
   - Toàn bộ `supabase/migrations/*.sql` (từ `20261119033017_admin_foundation.sql` đến `20261120115119_restrict_auto_rls_function.sql`).

## Checklist kiểm tra trọng tâm
- Mọi Server Action ghi dữ liệu (admin và customer/public) có kiểm tra authorization ở server/DB và fail-closed khi thiếu cấu hình hay không?
- Có bypass quyền admin, IDOR (đọc/sửa dữ liệu người dùng khác ở `/account`, `/chat`, `/track`), open redirect ở `/auth/callback` hoặc login/join không?
- RLS và `REVOKE`/`GRANT` trong `supabase/migrations/*.sql`: private tables có bị grant trực tiếp cho `anon`/`authenticated` không? `SECURITY DEFINER` functions có `SET search_path` an toàn và kiểm tra caller role/JWT đúng không?
- Tracking capability (`track/[code]`): có bị lộ vào nội dung chuyển khoản ngân hàng, Telegram outbox, log hay lỗi không?
- Chat cookie HttpOnly capability (256-bit, hash DB), form token (hạn/idempotency/quota) có lỗ hổng nào không?
- Rò rỉ secret, service role key, cost price, private notes, PII vào response/log/client.

## Định dạng đầu ra
Trả về báo cáo Markdown tiếng Việt gồm:
1. Bảng Findings: `| Mức độ | Vị trí (file:dòng) | Mô tả & Bằng chứng | Tác động thực tế | Đề xuất sửa |`
2. Danh sách hạng mục đã kiểm tra và đạt (ngắn gọn).
3. Ghi rõ nếu sửa cần đổi schema/migration DB hoặc có trade-off nghiệp vụ chưa chốt.
