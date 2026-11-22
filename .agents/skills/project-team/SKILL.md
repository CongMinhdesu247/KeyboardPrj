---
name: project-team
description: >-
  Điều phối đội multi-agent (Gemini Pro + Codex Plus + Flash/Flash-Lite) cho KeyboardPrj.
  Dùng khi thực hiện tính năng mới, sửa lỗi khó hoặc thay đổi chạm nhiều module cần lập plan,
  phân file ownership, giao đúng model và phản biện chéo.
---

# Skill: Project Team (Điều phối Multi-Agent cho KeyboardPrj)

Áp dụng khi yêu cầu vượt quá ngưỡng việc nhỏ (< ~30 dòng, 1–2 file, rủi ro thấp).

## Bước 1 — Preflight & Triage

1. Chạy preflight kiểm tra Git root, cấu trúc `.agents/` và kết nối Codex:
   ```powershell
   .\scripts\init-project.ps1
   ```
2. Đọc `AGENTS.md` và tài liệu `docs/` liên quan (`docs/REQUIREMENTS.md`, `docs/PLAN.md`, `docs/DATA-MODEL.md` + docs của module đụng tới).
3. Nếu việc nhỏ (< ~30 dòng, 1–2 file, không đụng auth/RLS/ledger/inventory), làm trực tiếp và bỏ qua các bước dưới.

## Bước 2 — Scout (Tiết kiệm hạn mức)

- Gọi `scout-worker` (hoặc `invoke_subagent` với `Model: "flash_lite"` / `"flash"`) khoanh vùng `file:dòng`, interface, tests hiện có và baseline.

## Bước 3 — Plan & File Ownership

1. Lập plan theo `.agents/templates/plan.md` và lưu tại `.agents/plans/<slug>.md` (có thể dùng `architect-gemini` cho kiến trúc phức tạp).
2. Tạo từng file task từ `.agents/templates/task.md` tại `.agents/tasks/<TASK-ID>.md`, ghi rõ:
   - Owner & model thực tế
   - Danh sách file được phép sửa (**không chồng chéo** giữa các worker song song)
   - Acceptance criteria & lệnh kiểm tra
3. Cập nhật `.agents/BOARD.md` (chỉ coordinator được sửa board) **trước** khi giao worker ghi file.

## Bước 4 — Triển khai đúng thế mạnh

- **UI / Next.js App Router / tích hợp:** `builder-frontend` (Gemini Pro) hoặc coordinator.
- **Backend / Server Actions / SQL / RLS / debug khó / refactor sâu:** Codex Plus qua skill `codex-delegate` (`.\scripts\invoke-codex.ps1 -PromptFile .agents/tasks/<ID>.md -Mode Implement`).
- **Docs / test đơn giản / chạy verify:** `scout-worker` (Flash / Flash-Lite).
- Tối đa 2 worker song song; trùng file/lockfile/migrations thì chạy tuần tự.

## Bước 5 — Phản biện chéo & Nghiệm thu

1. Thực hiện phản biện chéo theo skill `multi-agent-debate` và `.agents/rules/02-debate-protocol.md` (Gemini ↔ Codex, tối đa 2 vòng).
2. Chạy đầy đủ cổng chất lượng theo `.agents/rules/03-quality-gates.md`:
   ```powershell
   npm run lint; npm run typecheck; npm test; npm run build
   ```
   *(Kèm test local theo module nếu thay đổi DB/RPC/UI.)*
3. Cập nhật `.agents/BOARD.md` sang `DONE` (hoặc `IN_REVIEW / PENDING_EXTERNAL_REVIEW` nếu thiếu model đối trọng) và báo cáo trung thực cho người dùng.
