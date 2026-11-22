# Plan: <Tên tính năng / hạng mục>

- **Slug:** `<slug>`
- **Coordinator / Architect:** `<Gemini Pro>`
- **Tài liệu đối chiếu:** `AGENTS.md`, `docs/REQUIREMENTS.md`, `docs/PLAN.md`, `docs/DATA-MODEL.md`, `<docs module liên quan>`

## 1. Mục tiêu & Phạm vi

- **Làm:** ...
- **Không làm:** ...

## 2. Khảo sát hiện trạng (từ Scout)

- `path/to/file.ts:10-40` — mô tả ngắn

## 3. Thiết kế & Rủi ro

- **Schema / RPC / RLS (nếu có):** ... (ghi rõ lý do nếu đổi contract hoặc xóa file)
- **Bảo mật / Dữ liệu nhạy cảm:** kiểm tra server auth, không lộ secret/PII, tiền VND nguyên.
- **UI / Responsive / A11y (nếu có):** tiếng Việt, 375px/1440px, focus & keyboard.

## 4. Phân chia Task & File Ownership

| Task ID | Mô tả | Model giao | Owned Files (không trùng) | Thứ tự / Phụ thuộc |
| --- | --- | --- | --- | --- |
| TASK-001 | ... | Codex Plus / Gemini Pro / Flash | `...` | — |

## 5. Tiêu chí nghiệm thu & Kiểm tra

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Test local module liên quan (nếu có): `...`
- [ ] Phản biện chéo Gemini ↔ Codex đạt `APPROVED`
