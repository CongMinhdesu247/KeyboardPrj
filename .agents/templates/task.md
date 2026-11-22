# Task: <TASK-ID> — <Tiêu đề ngắn>

- **Plan:** `.agents/plans/<slug>.md`
- **Owner / Model:** `<Codex Plus | Gemini Pro | Flash>`
- **Mode:** `<Implement | Review | Scout>`
- **Depends On:** `<none | TASK-xxx>`

## 1. Mục tiêu

Mô tả ngắn gọn, rõ ràng kết quả cần đạt.

## 2. Ngữ cảnh & Vị trí đã khoanh vùng

- `src/...:L10-L45` — ...
- Tài liệu liên quan: `docs/...`

## 3. Phạm vi file được phép sửa (Ownership)

- `path/to/owned-file-1`
- `path/to/owned-file-2`

*(Không sửa file ngoài danh sách này; giữ nguyên thay đổi có sẵn của người dùng hoặc agent khác.)*

## 4. Ràng buộc KeyboardPrj cần tuân thủ

- Tuân thủ `AGENTS.md` (không bypass `order_command` / `adjust_inventory`, không sửa ledger trực tiếp, không đưa secret/PII sang client/log, không reset DB).

## 5. Acceptance Criteria

- [ ] Tiêu chí 1
- [ ] Tiêu chí 2

## 6. Lệnh kiểm tra bắt buộc

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## 7. Yêu cầu báo cáo

Trả về: danh sách file đã sửa, lệnh kiểm tra + kết quả thực tế, rủi ro/phần chưa xác minh. Không tự duyệt `APPROVED` cho chính mình.
