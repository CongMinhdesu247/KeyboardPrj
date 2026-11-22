# Review Report: <TASK-ID>

- **Task:** `.agents/tasks/<TASK-ID>.md`
- **Maker (tác giả):** `<Gemini Pro | Codex Plus>`
- **Challenger (reviewer độc lập):** `<Codex Plus | Gemini Pro>`
- **Vòng review:** `1 / 2`
- **Kết luận:** `<APPROVED | CHANGES_REQUESTED | PENDING_EXTERNAL_REVIEW>`

## 1. Phạm vi đã kiểm tra

- `git status` / `git diff` / `git diff --cached` / file mới:
  - `path/to/file`

## 2. Findings (bắt buộc có `file:dòng` và bằng chứng)

| Mức độ | Vị trí (`file:dòng`) | Mô tả & Tác động thực tế | Đề xuất sửa |
| --- | --- | --- | --- |
| *(Không có finding có bằng chứng)* | — | — | — |

## 3. Kiểm tra ràng buộc KeyboardPrj

- [ ] Server authorization / RLS / fail-closed
- [ ] Toàn vẹn tiền VND / tồn kho / ledger (`order_command`, `adjust_inventory`)
- [ ] Không lộ secret / PII / tracking capability
- [ ] Tiếng Việt, responsive 375px/1440px, keyboard accessibility (nếu có UI)

## 4. Kết luận & Bước tiếp theo

Nêu rõ điều kiện để chuyển `DONE` hoặc các mục cần sửa ở vòng tiếp theo.
