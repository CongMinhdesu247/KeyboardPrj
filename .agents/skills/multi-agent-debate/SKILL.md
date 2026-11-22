---
name: multi-agent-debate
description: >-
  Thực hiện phản biện chéo độc lập giữa Gemini Pro và Codex Plus (Maker → Challenger → Verifier).
  Dùng sau khi triển khai thay đổi quan trọng hoặc khi cần kiểm tra chéo kiến trúc, bảo mật, logic.
---

# Skill: Multi-Agent Debate (Phản biện chéo Gemini ↔ Codex)

Đọc `.agents/rules/02-debate-protocol.md` trước khi bắt đầu.

## 1. Xác định vai trò

- **Gemini viết** → **Codex review** (`.\scripts\invoke-codex.ps1 -PromptFile <prompt> -Mode Review`).
- **Codex viết** → **Gemini review** (`reviewer-critic` hoặc coordinator Gemini Pro).
- Không tự review code của chính mình hay dùng cùng họ model rồi gọi là phản biện chéo.

## 2. Chuẩn bị gói review đầy đủ

Trước khi gọi Challenger, thu thập đầy đủ phạm vi thay đổi:
```powershell
git status --short
git diff --stat
git diff --cached --stat
```
Đưa vào prompt review:
- Task ID, mục tiêu, acceptance criteria và **tên model tác giả (maker)**.
- Danh sách toàn bộ file đã sửa, đã stage và file mới chưa track.
- Kết quả các lệnh kiểm tra đã chạy (`lint`, `typecheck`, `test`, `build`).
- Yêu cầu Challenger trả về theo mẫu `.agents/templates/review.md` (mọi finding có `file:dòng`, mức độ, tác động, hướng sửa).

## 3. Lưu kết quả & Xử lý vòng phản biện

1. Lưu báo cáo review chính thức tại `.agents/reviews/<TASK-ID>-review.md`.
2. Nếu `CHANGES_REQUESTED`:
   - Maker sửa các mục `CRITICAL` / `HIGH` (và `MEDIUM` hợp lý) có bằng chứng.
   - Chạy lại kiểm tra (`lint`, `typecheck`, `test`, `build`).
   - Gửi Challenger kiểm tra lại bản cuối (**tối đa 2 vòng**).
3. Nếu `APPROVED`: cập nhật `.agents/BOARD.md` và sang bước nghiệm thu `.agents/rules/03-quality-gates.md`.
4. Nếu sau vòng 2 vẫn còn bất đồng về yêu cầu sản phẩm/trade-off: tóm tắt 2 phương án kèm bằng chứng để người dùng quyết định.
5. Nếu thiếu model đối trọng (Codex lỗi/hết quota): giữ `IN_REVIEW / PENDING_EXTERNAL_REVIEW` và đính kèm prompt bàn giao thủ công.
