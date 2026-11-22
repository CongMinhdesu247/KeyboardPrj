---
name: codex-delegate
description: >-
  Giao task triển khai hoặc review độc lập cho Codex Plus qua scripts/invoke-codex.ps1.
  Dùng khi cần Codex viết/debug/refactor backend-logic phức tạp hoặc review code do Gemini viết.
---

# Skill: Codex Delegate

Dùng để gọi **Codex Plus** ổn định trên Windows mà không phụ thuộc `codex mcp-server` hay `codex` trong `PATH`.

## 1. Chuẩn bị trước khi gọi

1. Đảm bảo đã chạy `.\scripts\init-project.ps1` và có file task đầy đủ trong `.agents/tasks/<TASK-ID>.md` (hoặc file review prompt trong `.agents/tasks/<TASK-ID>-review-prompt.md`).
2. Gom đủ ngữ cảnh trong **1 lần gọi** để tiết kiệm hạn mức:
   - Mục tiêu & acceptance criteria rõ ràng.
   - Danh sách `file:dòng` đã khoanh vùng (từ `scout-worker`).
   - Ràng buộc KeyboardPrj liên quan (RLS, `order_command`, `adjust_inventory`, tiền VND nguyên, không chứa secret/PII).
   - Danh sách file được phép sửa (với `-Mode Implement`) hoặc phạm vi diff/file mới cần soi (với `-Mode Review`).

## 2. Lệnh gọi chuẩn

- **Review chỉ đọc (sandbox `read-only`, mặc định `--ephemeral`):**
  ```powershell
  .\scripts\invoke-codex.ps1 -PromptFile .agents/tasks/<TASK-ID>-review-prompt.md -Mode Review
  ```
- **Triển khai trong phạm vi file được giao (sandbox `workspace-write`):**
  ```powershell
  .\scripts\invoke-codex.ps1 -PromptFile .agents/tasks/<TASK-ID>.md -Mode Implement
  ```
- Thêm `-PersistSession` nếu muốn lưu thread vào lịch sử Codex Desktop App.

Output cuối cùng luôn được lưu tại `.agents/runs/<timestamp>-<mode>-<uuid>.md` (đã `.gitignore`).

## 3. Xử lý lỗi & Hạn mức

- `invoke-codex.ps1` tự dò Codex theo thứ tự: `$env:CODEX_BIN` → `PATH` → Codex Desktop App (`OpenAI.Codex`) → Antigravity/VS Code Codex extension.
- **Không retry mù** nếu Codex trả lỗi auth, hết quota hoặc kết nối.
- Khi bị chặn: giữ task ở trạng thái `IN_REVIEW / PENDING_EXTERNAL_REVIEW`, ghi rõ lỗi thực tế vào `.agents/BOARD.md` và cung cấp nội dung file prompt để người dùng bàn giao thủ công cho Codex.
- Sau khi Codex hoàn tất `-Mode Implement`, **bắt buộc** cho Gemini (`reviewer-critic` hoặc coordinator) review độc lập trước khi tích hợp/chốt `DONE`.
