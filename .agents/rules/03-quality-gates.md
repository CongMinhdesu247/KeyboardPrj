---
trigger: model_decision
description: Cổng kiểm tra chất lượng và điều kiện nghiệm thu DONE cho dự án KeyboardPrj. Nạp trước khi hoàn tất hoặc bàn giao task.
---

# 03 — Cổng Chất lượng & Nghiệm thu (Quality Gates)

## Điều kiện bắt buộc trước khi chuyển `DONE`

1. **Kiểm tra tĩnh & build (bắt buộc cho mọi thay đổi code):**
   - `npm run lint`
   - `npm run typecheck` (tự chạy `next typegen && tsc --noEmit`)
   - `npm test`
   - `npm run build`
2. **Kiểm tra hồi quy theo module (khi đụng DB/RPC/UI tương ứng):**
   - Auth/Catalog/Orders/Requests/Storefront/Chat/Reports/Readiness: chạy script kiểm thử local tương ứng (`test:m1-local`, `test:catalog-ui`, `test:m3-local`, `test:m4-local`, `test:storefront`, `test:m5-local`, `test:m6-local`, `test:m7-local`) — luôn dùng fixture riêng và cleanup, **không** reset DB có admin.
   - Khi sửa cấu trúc multi-agent/scripts: chạy `.\scripts\test-starter.ps1` và `.\scripts\init-project.ps1`.
3. **Kiểm tra ràng buộc đặc thù KeyboardPrj:**
   - Tiền VND nguyên, không số âm; SUM money dùng string/BigInt ở báo cáo.
   - Không rò rỉ secret/PII sang Client Component hoặc log; không đưa tracking capability vào nội dung chuyển khoản ngân hàng hay Telegram.
   - Giao diện tiếng Việt, responsive 375px/1440px, focus rõ, giữ Escape/keyboard trong dialog/tab.
   - Khi thêm module hoặc đổi luồng nghiệp vụ: cập nhật tài liệu `docs/` liên quan.
4. **Phản biện chéo:**
   - Task quan trọng phải có báo cáo review tại `.agents/reviews/<ID>-review.md` với trạng thái `APPROVED` từ model khác họ (hoặc ghi nhận rõ `PENDING_EXTERNAL_REVIEW` nếu bị chặn quota/kết nối).
5. **Báo cáo bàn giao trung thực:**
   - Nêu rõ: danh sách file thay đổi, lệnh đã chạy + kết quả thực tế, reviewer/model thật, và những phần **chưa** xác minh (ví dụ: UAT production HP, dịch vụ ngoài).
