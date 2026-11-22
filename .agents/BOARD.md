# Multi-Agent Board — KeyboardPrj (TRUMP Keys)

> **Quy tắc:** Chỉ một coordinator duy nhất cập nhật bảng này. Tạo/cập nhật dòng task **trước** khi gọi worker có quyền sửa file hoặc reviewer chính thức.
>
> - **Status:** `TODO` | `IN_PROGRESS` | `IN_REVIEW` | `BLOCKED` | `DONE`
> - **Review:** `NOT_REQUIRED` | `PENDING_EXTERNAL_REVIEW` | `CHANGES_REQUESTED` | `APPROVED`

| Task ID | Mục tiêu ngắn | Owner / Model | Owned Files | Depends On | Status | Review | Ghi chú / Link |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUDIT-A | Rà soát chỉ đọc mảng (A) Bảo mật & RLS/Auth | Codex Plus (`-Mode Review`) | *(read-only)* | — | DONE | NOT_REQUIRED | 0 findings. `.agents/reviews/AUDIT-FULL-PROJECT.md` |
| AUDIT-B | Rà soát chỉ đọc mảng (B) Logic vận hành & DB/RPC | Codex Plus (`-Mode Review`) | *(read-only)* | — | DONE | NOT_REQUIRED | 4 MEDIUM (3 sửa ở TASK-FIX-BE, `AUDIT-B-4` giữ nguyên hành vi theo quyết định người dùng). `.agents/reviews/AUDIT-FULL-PROJECT.md` |
| AUDIT-C | Rà soát chỉ đọc mảng (C) UI Next.js/React 19 & Tích hợp | `reviewer-critic` (Gemini Pro) | *(read-only)* | — | DONE | NOT_REQUIRED | 1 MEDIUM, 5 LOW (sửa ở TASK-FIX-UI). `.agents/reviews/AUDIT-FULL-PROJECT.md` |
| TASK-FIX-BE | Vá version NULL guard ở RPC & idempotency retry ảnh đơn + tests | Codex Plus (`-Mode Implement`) | `supabase/migrations/20261122090000_fix_rpc_version_null_guards.sql`, `src/app/admin/orders/actions.ts`, `tests/audit-fixes.test.ts` | AUDIT-B | DONE | APPROVED | Review V1 `APPROVED` bởi `reviewer-critic` (Gemini Pro): `.agents/reviews/TASK-FIX-BE-review.md`. `lint/typecheck/test(93/93)/build` pass. |
| TASK-FIX-UI | Vá React 19 dialog, DTO `/account`, notifications UI, mobile 375px CSS & copy admin | Gemini Pro (Coordinator + spec `builder-frontend`) | `src/components/account-controls.tsx`, `src/components/profile-form.tsx`, `src/app/account/page.tsx`, `src/app/admin/notifications/page.tsx`, `src/app/admin/catalog/[id]/page.tsx`, `src/app/admin/readiness/page.tsx`, `src/app/buyer.css`, `src/app/globals.css` | AUDIT-C | DONE | APPROVED | Codex Plus review xác nhận cuối `APPROVED`: `.agents/reviews/TASK-FIX-UI-review.md`. `lint/typecheck/test(93/93)/build` pass. |
| CONFIG-AGENTS | Bật quyền `enable_write_tools` cho `builder-frontend`/`scout-worker`, khóa read-only cho `reviewer-critic`/`architect-gemini` và chặn delegate đệ quy | Gemini Pro (Coordinator) | `.agents/agents/builder-frontend.md`, `.agents/agents/scout-worker.md`, `.agents/agents/reviewer-critic.md`, `.agents/agents/architect-gemini.md` | — | DONE | NOT_REQUIRED | Đã kiểm chứng `.\scripts\test-starter.ps1` và `.\scripts\init-project.ps1`. |
