---
trigger: model_decision
description: Quy trình phản biện chéo Gemini ↔ Codex (Maker → Challenger → Verifier). Nạp khi vào bước review hoặc giải quyết tranh luận kỹ thuật.
---

# 02 — Giao thức Phản biện Chéo (Debate Protocol)

## Khi nào bắt buộc phản biện chéo

- Thay đổi logic nghiệp vụ lõi: tiền VND, cọc/COD, tồn kho (`adjust_inventory`), đơn hàng (`order_command`), báo cáo tiền mặt (`cash_report`), tracking capability, chat/outbox.
- Thay đổi auth, RLS, migration SQL, Server Actions ghi dữ liệu hoặc bảo mật/deploy.
- Tính năng mới hoặc refactor chạm ≥ 3 file.

## Nguyên tắc cốt lõi

1. **Khác họ model với tác giả:**
   - Gemini viết → Codex review (`.\scripts\invoke-codex.ps1 -Mode Review`).
   - Codex viết → Gemini review (`reviewer-critic`).
   - Cùng họ model đổi tên vai trò **không** được tính là phản biện chéo.
2. **Đủ phạm vi thay đổi:**
   - Luôn gửi đầy đủ phạm vi thay đổi: `git status`, `git diff`, `git diff --cached`, và danh sách file mới chưa track.
3. **Bằng chứng cụ thể:**
   - Mọi finding phải gắn `file:dòng`, mô tả tác động thực tế, mức độ (`CRITICAL` | `HIGH` | `MEDIUM` | `LOW`) và hướng khắc phục.
   - Không tìm thấy lỗi có bằng chứng là kết quả `APPROVED` hợp lệ — không bịa lỗi để tỏ ra kỹ tính.
4. **Giới hạn vòng lặp:**
   - Tối đa **2 vòng** phản biện (`Maker → Challenger → Verifier`).
   - Sau vòng 2 nếu còn bất đồng về mục tiêu sản phẩm hoặc trade-off chưa chốt trong `docs/REQUIREMENTS.md`, dừng và hỏi người dùng quyết định.
5. **Fallback khi thiếu model đối trọng:**
   - Nếu Codex lỗi quota/auth/mất kết nối: **không retry mù**, giữ trạng thái `IN_REVIEW / PENDING_EXTERNAL_REVIEW`, ghi rõ lý do và cung cấp prompt bàn giao thủ công cho người dùng.
