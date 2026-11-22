# Plan: Tổng rà soát, sửa lỗi và cập nhật Local Server — KeyboardPrj

- **Slug:** `full-audit-and-local-deploy`
- **Coordinator / Architect:** Gemini Pro
- **Ngày lập:** 2026-11-23
- **Tài liệu đối chiếu:** `AGENTS.md`, `docs/REQUIREMENTS.md`, `docs/PLAN.md`, `docs/DATA-MODEL.md`, `docs/M2-CATALOG.md`, `docs/M3-ORDERS.md`, `docs/M4-REQUESTS-PORTFOLIO.md`, `docs/STOREFRONT.md`, `docs/M5-CHAT-NOTIFICATIONS.md`, `docs/M6-CASH-REPORTS.md`, `docs/M7-READINESS.md`, `docs/ADMIN-UI.md`, `docs/BANK-PAYMENT.md`

## 1. Mục tiêu & Phạm vi

- **Làm:**
  1. Tổng rà soát chỉ đọc theo 2 mảng tách biệt (Backend/Security/DB/RPC bởi Codex Plus; Frontend/UI/Responsive/A11y bởi `builder-frontend` Gemini Pro), bao quát cả mã nguồn hiện hành lẫn các thay đổi mới chưa commit (`TASK-CLEANING-BE`, `TASK-HOME-UI`, `TASK-ADMIN-UI`, `TASK-REPORTS-UI`, migration `20261123004500_add_cleaning_category.sql`).
  2. Chỉ sửa các lỗi có bằng chứng cụ thể (`file:dòng`), tách bạch file ownership không chồng chéo.
  3. Phản biện chéo khác họ model (`.agents/rules/02-debate-protocol.md`): code Codex sửa → `reviewer-critic` (Gemini Pro) review; code Gemini sửa → Codex Plus (`-Mode Review`) review.
  4. Chạy cổng chất lượng đầy đủ (`lint`, `typecheck`, `test`, `build`) và các script verify local phù hợp (không reset DB có admin, không chạy `down -v`/`prune`).
  5. Cập nhật Supabase local (`db:push` nếu có migration chưa đẩy, `db:types`, `db:check`), build bản mới và cập nhật local Next.js server trên cổng đang dùng (`3000`, không chạm `8090–8093` hay hạ tầng HP), xác minh phản hồi OK.
- **Không làm:**
  - Không reset database đang có admin hoặc chạy `docker compose down -v` / `prune`.
  - Không chạm cổng `8090–8093` hoặc hạ tầng HP production.
  - Không đọc/in/đưa `.env*`, service role key, cookie thật, PII hay SSH key vào prompt hoặc file báo cáo.
  - Không tự đổi hành vi đã chốt (ví dụ `AUDIT-B-4` đã được người dùng quyết định giữ nguyên).

## 2. Khảo sát hiện trạng (Baseline 2026-11-23)

- `.\scripts\init-project.ps1`: PASS (Git root khớp `C:\Users\Dung\KeyboardPrj`, `codex-cli 0.171.0-alpha.13` đã đăng nhập).
- `npm run lint`: PASS (exit 0).
- `npm run typecheck`: PASS (exit 0).
- `npm test`: PASS (95/95 tests, exit 0).
- `npm run build`: PASS (Next.js 16.4.6 Turbopack, exit 0).
- `npm run db:check`: PASS (`No issues found` trên local stack `127.0.0.1:54322`).
- Local services hiện hành:
  - Supabase local đang chạy (`54321`, `54322`).
  - Next.js dev server (`npm run dev`) đang chạy trên cổng `3000` (PID `31308` → `6592` → `11920`).
- Thay đổi mới trong working tree so với `HEAD`:
  - Backend/DB: `supabase/migrations/20261123004500_add_cleaning_category.sql`, `src/lib/domain.ts`, `src/lib/catalog.ts`, `src/lib/catalog-input.ts`, `src/lib/estimate.ts`, `tests/admin-db.test.ts`, `tests/catalog.test.ts`, `tests/domain.test.ts`.
  - Frontend/UI: `src/app/layout.tsx`, `src/app/buyer.css`, `src/app/globals.css`, `src/app/admin/page.tsx`, `src/app/admin/orders/page.tsx`, `src/app/admin/catalog/page.tsx`, `src/app/admin/reports/page.tsx`, `src/components/workshop.tsx`, `src/components/service-estimator.tsx`, `src/components/portfolio-gallery.tsx`, `src/components/admin-navigation.tsx`, `src/components/account-kpis.tsx`, `src/components/account-growth.tsx`, `src/components/catalog-admin.tsx`, xóa `src/components/pwa-install.tsx`.

## 3. Thiết kế & Rủi ro

- **Schema / RPC / RLS:** Kiểm tra kỹ `20261123004500_add_cleaning_category.sql` và toàn bộ 23 migrations trong `supabase/migrations/`, đảm bảo RLS/grants/search_path/`order_command`/`adjust_inventory`/`cash_report`/checkout RPC an toàn, không bypass quyền hoặc lỗi race/idempotency.
- **Bảo mật / Dữ liệu nhạy cảm:** Không rò rỉ secret/PII sang client bundle; kiểm tra capability tokens (`/track`, `/chat`), QR thanh toán (`payment_reference` tách biệt tracking code), và origin/host checks trong `src/proxy.ts`.
- **UI / Responsive / A11y:** Kiểm tra 375px & 1440px, focus/Escape/keyboard trong dialog & tab, giữ state form khi đổi tab, tiếng Việt nhất quán, trạng thái loading/error/empty, và kiểm tra các thay đổi UI mới nhất (xóa PWA install, nâng cấp Home/Admin/Reports).

## 4. Phân chia Task & File Ownership

| Task ID | Mô tả | Model giao | Owned Files (không trùng) | Thứ tự / Phụ thuộc |
| --- | --- | --- | --- | --- |
| `AUDIT-BE-20261123` | Rà soát chỉ đọc Backend, Server Actions, API & SQL/RLS/RPC | Codex Plus (`-Mode Review`) | *(read-only)* `src/lib/**`, `src/app/**/actions.ts`, `src/app/api/**`, `src/app/auth/**`, `src/app/healthz/**`, `src/proxy.ts`, `supabase/**` | Song song với `AUDIT-FE-20261123` |
| `AUDIT-FE-20261123` | Rà soát chỉ đọc Giao diện, Responsive 375/1440 & Accessibility | `builder-frontend` (Gemini Pro) | *(read-only)* `src/app/**` (trừ `actions.ts`/`api`/`auth`/`healthz`), `src/components/**`, `src/app/globals.css`, `src/app/buyer.css` | Song song với `AUDIT-BE-20261123` |
| `FIX-BE-20261123` *(nếu có finding)* | Sửa lỗi Backend/DB có bằng chứng từ `AUDIT-BE-20261123` | Codex Plus (`-Mode Implement`) | Chốt cụ thể sau khi có finding | Sau `AUDIT-BE-20261123` |
| `FIX-FE-20261123` *(nếu có finding)* | Sửa lỗi Frontend/UI có bằng chứng từ `AUDIT-FE-20261123` | `builder-frontend` (Gemini Pro) | Chốt cụ thể sau khi có finding | Sau `AUDIT-FE-20261123` |
| `LOCAL-DEPLOY-20261123` | Đẩy migration local (nếu cần), verify local suites, cập nhật & xác minh local server | Coordinator (Gemini Pro) | *(vận hành local, không sửa code)* | Sau khi hoàn tất fix & review |

## 5. Tiêu chí nghiệm thu & Kiểm tra

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run db:check` (và `npm run db:push` / `npm run db:types` nếu có migration chưa đồng bộ)
- [ ] Các script verify local phù hợp (`test:m1-local`, `test:m7-local`, `test:buyer-ui`, ...) không reset DB
- [ ] Phản biện chéo Gemini ↔ Codex đạt `APPROVED` cho mọi task sửa code
- [ ] Local Next.js server chạy bản code mới và phản hồi HTTP OK (không đụng 8090–8093)
