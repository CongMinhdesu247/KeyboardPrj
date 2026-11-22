# Hướng dẫn phát triển

- Đọc `docs/REQUIREMENTS.md`, `docs/PLAN.md`, `docs/DATA-MODEL.md` và module liên quan trước khi thay đổi. REQUIREMENTS chứa câu trả lời khách hàng, ưu tiên hơn giả định baseline M0; các đề xuất đánh dấu chưa chốt không phải yêu cầu đã được duyệt.
- Dự án một shop, Next.js App Router, npm và TypeScript strict. Không thêm tầng repository/DI/global store khi chưa có nhu cầu thực.
- Deploy theo `docs/DEPLOYMENT.md`: HP Ubuntu Docker, project `trumpkeys-hp`, loopback dự kiến 8094, Cloudflare Tunnel hiện có. Không thay ứng dụng/cổng 8090–8093, không đọc key SSH, không commit .env, không chạy down -v/prune. Cổng/tài nguyên chưa được xác minh vì SSH bị từ chối.
- `src/lib/domain.ts`: kiểu dữ liệu thuần; `catalog.ts`/`demo-order.ts`: dữ liệu giả; `estimate.ts`/`tracking.ts`: quy tắc thuần có kiểm thử. Không đặt secret/PII trong module client có thể import.
- Server Components mặc định; Client Components cho tương tác. Mọi write thật cần validation + authorization ở server.
- M1 đã rà soát trước M2: xem `docs/M1-REVIEW.md` cho bằng chứng/giới hạn. Supabase local/Google/admin thật có hoạt động; `npm run test:m1-local` chạy fixture API riêng và cleanup, không reset DB hiện có. Secret ở env gitignored, không in giá trị. Thiếu cấu hình thì fail closed; không thêm fake login, bypass guard hoặc bootstrap web endpoint. Mọi Server Action vẫn kiểm quyền server/DB.
- M2 đã có catalog/inventory/image/public pricing; đọc `docs/M2-CATALOG.md`. Tồn chỉ đổi qua adjust_inventory RPC có request UUID và movement; giá vốn private. Homepage anonymous tách cookie admin, không fallback giá mẫu khi backend đã cấu hình bị lỗi. `npm run test:catalog-ui` thử Next actions/Chromium bằng fixture riêng và cleanup; không dùng cookie thật. Không reset database có admin.
- M3 đã có đơn/cọc/COD/QR/tracking/media/hủy/hoàn phần vượt cọc; đọc `docs/M3-ORDERS.md`. `order_command` là transaction duy nhất cho write đơn; private tables không có grant trực tiếp. Runtime cần secret server-only, tracking RPC chỉ service_role. `npm run test:m3-local` kiểm cả M1–M3 và cleanup fixture. Chưa có editor báo giá đơn chờ/bút toán sửa sai thanh toán; không sửa ledger trực tiếp hoặc tự nhận đã UAT production.
- Admin UI theo `docs/ADMIN-UI.md`: `/admin` là tổng quan, quyền/mã mời chuyển sang `/admin/team` và actions phải revalidate route này. Chi tiết đơn dùng tab có keyboard navigation, không dồn mọi form; giữ form khi đổi tab. Menu khách bị ẩn trong admin.
- QR ngân hàng theo `docs/BANK-PAYMENT.md`: Agribank đã được người dùng cung cấp; tạo offline cho cọc/full từ snapshot server. Không đưa tracking capability vào nội dung ngân hàng; dùng payment_reference riêng. QR không xác nhận thanh toán: chỉ admin nhận tiền qua order_command mới ghi ledger/trừ kho. Phân biệt QR tra cứu tab Link & QR với QR chuyển khoản tab Thanh toán/trang khách; không thêm webhook/checkout giả.
- M4 theo `docs/M4-REQUESTS-PORTFOLIO.md`: yêu cầu không cọc/không đụng kho; ảnh mẫu private/admin-only. Form token có hạn/idempotency và quota DB. Portfolio private tới khi admin xác nhận publish; copy ảnh đơn là bản riêng có chủ đích. Không tự đưa media khác ra public. `npm run test:m4-local` chạy cả M1–M4, cleanup fixture, không dùng cookie thật/reset DB.
- Cửa hàng/checkout theo `docs/STOREFRONT.md`: lưới ảnh/giá trên home và `/shop`, chi tiết, cart localStorage chỉ ID/qty/giá, khách tạo đơn qua RPC service-only riêng. Không bypass order_command admin. Đơn web actor nullable nhưng chỉ event created không actor; địa chỉ/ghi chú private. Snapshot/giá/tồn kiểm ở DB; tồn chỉ trừ sau admin receipt. `test:storefront` hồi quy cả M1–M4 và mua hàng, cleanup thêm checkout_submissions/đơn guest fixture. Không tự đổi loại mục Aula cũ.
- Tiền VND nguyên, không số âm; workflow/order items snapshot; guest chỉ nhận DTO allowlist; Storage private; RLS trước khi kết nối bảng nghiệp vụ.
- M6 theo `docs/M6-CASH-REPORTS.md`: `/admin/reports` qua cash_report JWT admin/live session, ledger cash basis theo ngày xác nhận Việt Nam. SUM money dạng string/BigInt, không cộng đơn hoàn thành hay dự kiến COD vào thực thu. COD hiện tại không theo date filter. Không profit/export/backdate/sửa ledger. `test:m6-local` tạm tắt integration local trong thời gian fixture, khôi phục env trong finally; không worker cùng lúc test.
- M5 theo `docs/M5-CHAT-NOTIFICATIONS.md`: chat cookie HttpOnly capability256bit, hash DB; begin/finish lease và UUID lượt không gọi AI lại khi chưa biết kết quả. Gemini chỉ nhận catalog/policy công khai + lịch sử đúng phiên; không có tool/write đơn, fallback Zalo khi lỗi. Telegram outbox trigger atomic, lease/fencing/backoff; không gửi PII hay tracking capability. Thiếu credential thì tắt; không nhận đã kiểm thử dịch vụ thật. `test:m5-local` cleanup cả chat/budget/outbox fixture, không cookie thật/reset DB.
- SW chỉ cache fallback offline, không thêm route nhạy cảm vào cache.
- Backup theo `docs/LOCAL-BACKUP-RESTORE.md`: scripts chỉ stack local cố định, snapshot read-only, backup nhạy cảm ACL/private/gitignored. Verify phải checksum trước restore; target chỉ database random `trumpkeys_restore_<32hex>` mới và marker khớp khi dọn, tuyệt đối không postgres/reset/clean/restore roles toàn cluster. Không gửi dump/config qua chat; không worker/fixture cùng backup. Chỉ logical DB/file local đã kiểm chứng, chưa offsite/new-stack OAuth/signed URL hay HP.
- M7 theo `docs/M7-READINESS.md`: guide/privacy và admin/readiness chỉ nêu điều đã chốt; khách trả ship+COD, báo phí riêng. Retention90/180ngày/24tháng là mục tiêu cần rà soát mốc/backup, chưa tự xóa. Checklist dữ liệu không tự duyệt ảnh/quyền hoặc phát hành. `test:m7-local` dùng runner tắt integration tạm/khôi phục env; `test:container` chỉ image/container/cổng loopback ngẫu nhiên riêng, không secret, không HP/prune/reset DB.
- Khi thêm module: cập nhật ma trận trạng thái và tiêu chí nghiệm thu. Dữ liệu demo phải ghi nhãn rõ.
- Kiểm tra `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Typecheck tạo route types bằng Next CLI trước khi chạy tsc.
- Giao diện tiếng Việt, responsive 375px/1440px, focus rõ và giữ được Escape/keyboard trong dialog.

# Quy ước phối hợp Multi-Agent

## Mục tiêu và phân vai

Phối hợp **Gemini Pro**, **Codex Plus** và **Flash/Free** theo thế mạnh thực tế, phản biện có bằng chứng và tối ưu hạn mức. File Markdown là quy ước phối hợp, không tự cấp quyền hay tạo kết nối hệ thống. Mọi agent đều phải tuân thủ toàn bộ hướng dẫn phát triển và ràng buộc bảo mật/DB/deploy của KeyboardPrj ở trên.

- **Coordinator / Architect — Gemini Pro (mặc định):** làm rõ yêu cầu, lập plan, chia task, xây UI/frontend (`src/app/**`, `src/components/**`), tích hợp đa module và review độc lập code của Codex.
- **Core Logic / Debug Implementer — Codex Plus:** backend/business logic phức tạp (`src/lib/**`, Server Actions, SQL/RLS/RPC trong `supabase/`), thuật toán, edge cases, debug lỗi khó, refactor sâu và review độc lập code của Gemini.
- **Scout / Verifier — Flash / Flash-Lite / Free:** tìm file, đọc log, tóm tắt ngữ cảnh (`file:dòng`), chạy `lint`/`typecheck`/`test`/`build`, viết docs/boilerplate/test đơn giản để tiết kiệm hạn mức cho Pro và Codex. Không tự quyết kiến trúc, auth, RLS hoặc schema.
- **Challenger — khác họ model với tác giả:** Gemini viết → Codex review; Codex viết → Gemini review. Cùng họ model đổi tên vai trò không phải phản biện chéo.

Chi tiết định tuyến và hạn mức xem `.agents/rules/01-model-routing.md`. Khi review hoặc nghiệm thu, đọc thêm `.agents/rules/02-debate-protocol.md` và `.agents/rules/03-quality-gates.md`.

Giao tiếp tiếng Việt; code, tên biến và commit tiếng Anh.

## Quy mô công việc & Tiết kiệm hạn mức

- **Việc nhỏ, rủi ro thấp (< ~30 dòng, 1–2 file):** làm trực tiếp, kiểm tra phù hợp, không cần plan/board/subagent hay gọi Codex.
- **Tính năng, logic quan trọng, bug khó, thay đổi nhiều module:** khảo sát gọn bằng Flash trước nếu cần, lưu plan `.agents/plans/<slug>.md`, tạo task từ `.agents/templates/task.md`.
- Ghi lý do trong plan trước khi xóa file hoặc đổi schema/RPC/API contract.
- Không tự cài dependencies, đổi cấu hình toàn máy, deploy lên HP hoặc đưa secrets/PII/SSH key vào prompt khi chưa thuộc phạm vi được giao.

## Điều phối và quyền sửa file

- Một coordinator duy nhất cập nhật `.agents/BOARD.md`, cấp task ID, owner, file được sửa và dependencies **trước** khi gọi worker có quyền sửa file hoặc review chính thức (khảo sát chỉ đọc ngắn bằng Flash/research trước khi lập plan không bắt buộc tạo dòng board). Worker chỉ cập nhật task/report được giao.
- Mỗi task có đúng một writer tại một thời điểm; mặc định tối đa hai worker đồng thời. Cùng workspace không giao hai writer đụng cùng file, lockfile (`package-lock.json`), cấu hình hay thư mục build (`.next/`) — trùng phạm vi thì chạy tuần tự.
- Worktree riêng chỉ dùng khi Git root đúng dự án và đã có commit nền.
- Board và file claims là quy ước phối hợp, **không phải khóa hệ thống**. Worker không tự sinh thêm worker hay gọi ngược coordinator (chỉ delegate một cấp, tránh vòng lặp Gemini → Codex → Gemini).
- Không reset/clean/stash/ghi đè thay đổi có sẵn của người dùng hoặc agent khác. Xác minh Git root qua preflight (`.\scripts\init-project.ps1`) trước mọi thao tác Git; từ chối repo cha ngoài dự án.

## Hoàn tất và bàn giao

Trạng thái task: `TODO → IN_PROGRESS → IN_REVIEW → DONE` (hoặc `BLOCKED` kèm điều kiện tiếp tục).
Trạng thái review: `NOT_REQUIRED | PENDING_EXTERNAL_REVIEW | CHANGES_REQUESTED | APPROVED`.

Task quan trọng chỉ `DONE` khi đạt acceptance criteria, kiểm tra thích hợp đã pass (`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` và test local liên quan nếu đụng DB/UI) và model đối trọng đã review bản cuối. Thiếu kết nối/quota: vẫn bàn giao phần đã làm, giữ `IN_REVIEW / PENDING_EXTERNAL_REVIEW` kèm prompt cho bên còn lại; không giả đã gọi agent.

Báo cáo luôn nêu: file thay đổi, lệnh và kết quả kiểm tra, reviewer/model thật, phần chưa xác minh. Không tìm thấy lỗi có bằng chứng là kết quả review hợp lệ.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
