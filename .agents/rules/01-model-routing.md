---
trigger: always_on
description: Quy tắc định tuyến model (Gemini Pro / Codex Plus / Flash) và tối ưu hạn mức cho KeyboardPrj.
---

# 01 — Định tuyến Model & Bảo vệ Hạn mức

## Nguyên tắc chọn model

1. **Triage trước khi mở rộng đội:**
   - Việc nhỏ (< ~30 dòng, 1–2 file, rủi ro thấp): làm trực tiếp trong phiên hiện tại, chạy kiểm tra phù hợp, **không** lập plan/board, **không** gọi subagent hay Codex.
   - Việc lớn (tính năng mới, sửa nhiều module, migration SQL/RLS, bug khó, refactor sâu): áp dụng skill `project-team`.
2. **Flash / Flash-Lite đi trước (`scout-worker` hoặc `Model: "flash_lite"` / `"flash"`):**
   - Khảo sát codebase trả về `file:dòng`, interface, tài liệu `docs/*.md` liên quan.
   - Đọc log dài, chạy `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
   - Viết tài liệu, boilerplate hoặc unit test đơn giản theo spec có sẵn.
   - **Cấm:** Flash không tự quyết kiến trúc, auth, RLS, schema DB hoặc logic tiền/tồn kho.
3. **Gemini Pro (`architect-gemini`, `builder-frontend`, `reviewer-critic`):**
   - Coordinator, kiến trúc tổng thể, thiết kế UI/UX Next.js App Router + React 19 (responsive 375px/1440px, tiếng Việt, keyboard accessibility).
   - Tích hợp nhiều module và **review độc lập code do Codex viết**.
4. **Codex Plus (`scripts/invoke-codex.ps1` qua skill `codex-delegate`):**
   - Backend/business logic phức tạp (`src/lib/**`, Server Actions, `supabase/migrations/**`, RLS, `order_command`, `adjust_inventory`, `cash_report`, chat/outbox).
   - Debug lỗi khó, concurrency, edge cases, refactor sâu.
   - **Review độc lập code do Gemini viết** (`-Mode Review`).
   - Gom đầy đủ spec + `file:dòng` + acceptance criteria trong 1 lượt gọi; không gọi lắt nhắt và **không retry mù** khi lỗi auth/quota.

## Kỷ luật điều phối

- Delegate tối đa **1 cấp** (worker không gọi ngược coordinator hay sinh thêm worker).
- Mặc định tối đa **2 worker song song**; không để 2 writer chạm cùng file, `package-lock.json`, `next.config.ts`, `supabase/migrations/` hay `.next/`.
- Không bao giờ đưa `.env*`, service role key, cookie thật, PII khách hàng hay SSH key vào task prompt hoặc file trong `.agents/`.
