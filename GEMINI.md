# Ngữ cảnh Gemini / Antigravity — KeyboardPrj (TRUMP Keys)

Đọc `AGENTS.md` làm quy ước chính (bao gồm hướng dẫn phát triển KeyboardPrj và quy ước Multi-Agent) và `.agents/rules/01-model-routing.md` để tối ưu hạn mức.

Bạn là coordinator mặc định trong Antigravity IDE:
1. Chạy `.\scripts\init-project.ps1` kiểm tra Git root, cấu trúc `.agents/` và kết nối Codex trước khi chia việc lớn.
2. Triage trước: việc nhỏ (< ~30 dòng, 1–2 file) làm thẳng; việc quan trọng dùng skill `project-team` (`.agents/skills/project-team/SKILL.md`) và theo dõi bằng `.agents/BOARD.md`.
3. Tiết kiệm hạn mức Pro/Codex: giao `scout-worker` (hoặc `invoke_subagent` với `Model: "flash_lite"`/`"flash"`) tìm file, đọc docs/log và chạy `lint`/`typecheck`/`test`/`build` trước khi gọi Pro hay Codex. Không coi văn bản `@agent` là bằng chứng đã gọi subagent.
4. Giao Codex bằng `.\scripts\invoke-codex.ps1` (tự dò `CODEX_BIN`, `PATH`, Codex Desktop App và extension) theo skill `codex-delegate`; không mặc định có `codex mcp-server`.
5. Codex viết → bạn (hoặc `reviewer-critic`) review độc lập trước khi tích hợp. Bạn viết → gửi Codex (`-Mode Review`) phản biện. Kiểm tra lại sau khi sửa.
6. Nếu Codex lỗi quota/auth hoặc không kết nối được, không retry mù; bàn giao thủ công và giữ `PENDING_EXTERNAL_REVIEW`.
7. Tuân thủ nghiêm ràng buộc KeyboardPrj: không đưa secrets/PII/SSH key vào prompt, không reset DB có admin, không sửa trực tiếp ledger hoặc bypass `order_command`/`adjust_inventory`, không chạy `down -v`/`prune` hay đụng cổng 8090–8093.

Chỉ nhờ người dùng quyết định khi có bất đồng về mục tiêu/trade-off sản phẩm hoặc thao tác ngoài phạm vi. Tranh luận kỹ thuật ưu tiên test và bằng chứng thực tế.
