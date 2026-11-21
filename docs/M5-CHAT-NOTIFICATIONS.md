# M5 — Tư vấn Gemini, chuyển Zalo và thông báo Telegram

Triển khai trên PC, không thay đổi HP. Không có live chat admin/Realtime. Người vận hành đã cung cấp credential, được lưu riêng trong `.env.local` gitignored, không đưa vào tài liệu/source. Bot Telegram `@trumpKeys_bot` đã xác thực getMe, được thêm vào nhóm “Trump” do người dùng xác nhận; đã lưu ID nhóm/bật Telegram local và gửi tin kiểm tra thành công HTTP200. Worker `notify:once` chạy thành công, hàng đợi hiện 0/0; chưa phải kiểm chứng một đơn thực tế qua toàn bộ hệ thống vận hành. Theo yêu cầu mới nhất, đã khôi phục credential cũ và bật lại AI, giữ model `gemini-3.6-flash`. Kiểm tra generateContent trả HTTP503 UNAVAILABLE: model đang quá tải; chưa nghiệm thu được câu trả lời AI thật. Khóa thay thế trước đó trả403 yêu cầu billing, hiện không còn dùng khóa đó. Không tự cấu hình billing/gói thanh toán. Khi nhà cung cấp lỗi, chat dùng fallback Zalo.

PC gặp timeout với thứ tự DNS mặc định; thử lại qua TLS và Node IPv4-first kết nối được. `.env.local` bật `PREFER_IPV4=true`; Next instrumentation và worker chỉ đổi thứ tự ưu tiên địa chỉ khi option này được bật, không sửa DNS hay cấu hình mạng hệ điều hành. Môi trường khác mặc định false. Với khóa cũ hiện tại lỗi503 là quá tải phía nhà cung cấp; không retry liên tục hay tự đổi model/gói. Chat vẫn lưu và hướng dẫn Zalo. Đã bỏ temperature tùy chỉnh khi chuyển 3.6 theo tài liệu Google; giữ trần output512 tokens.

## Cách dùng

- Khách mở `/chat` từ menu Tư vấn hoặc trang chủ. Nhập câu hỏi, đồng ý lưu/xử lý nội dung và gửi. Nội dung hiển thị dạng văn bản thuần; hướng dẫn dự phòng được ghi rõ, không giả làm phản hồi AI.
- Nút Mở Zalo dẫn tới số shop đã chốt. Đánh dấu cần shop hỗ trợ tạo một sự kiện cho admin; không hứa nhân viên đang online hoặc tự gửi tin sang Zalo. Shop chưa có SĐT khách từ chat nên khách phải chủ động nhắn Zalo.
- Chat tồn tại trong cùng trình duyệt qua cookie HttpOnly, SameSite=Lax, path `/chat`, Secure khi HTTPS. Capability ngẫu nhiên 256 bit, database lưu hash SHA256 có scope; không nhận session ID làm quyền sở hữu từ browser.
- Quyền mở phiên khách có hạn 30 ngày, độc lập với thời hạn lưu dữ liệu. Bắt đầu phiên mới bỏ cookie, không xóa lịch sử. Admin xem ở `/admin/chat`; chỉ admin Google active/live session đọc được. Mỗi lần khách đọc 20 lượt gần nhất; admin xem 100 phiên mới nhất và 100 lượt/phiên.
- `/admin/notifications` hiển thị trạng thái cấu hình, số chờ/đã gửi/hết lượt thử và 20 sự kiện gần nhất; có gửi đợt nhỏ tới hạn và cho thử lại tối đa 5 thông báo lỗi sau sửa cấu hình.

## Gemini

Điền vào `.env.local` trên PC, không gửi secret qua chat hay commit:

```dotenv
GEMINI_ENABLED=false
GEMINI_API_KEY=
GEMINI_MODEL=
```

Chọn model đang có quyền sử dụng trong Google AI Studio, xem tài liệu model hiện hành. Không mặc định một model cũ hoặc tự bật trả phí. Đối chiếu điều khoản dữ liệu của gói đã chọn trước khi bật `GEMINI_ENABLED=true` và khởi động lại Next. UI xin khách xác nhận từ 18 tuổi và đồng ý gửi nội dung; không dành chat AI cho người dưới tuổi này. Khi dùng dịch vụ miễn phí, dữ liệu có thể được nhà cung cấp sử dụng khác với gói trả phí; người vận hành phải chọn gói phù hợp trước public.

REST `generateContent` ở server với header API key, không thêm SDK. Chỉ gửi chính sách được chốt, tối đa 40 mặt hàng công khai và 6 lượt chat gần nhất. Không truy vấn đơn, giá vốn, tài khoản hay bảng khách cho AI. Không gửi ảnh, không tải link do khách nhập, không cấp tool hoặc quyền write. Redact email, chuỗi số liên hệ và mã tracking trong chat trước khi gửi; đây chỉ là giảm dữ liệu, không bảo đảm phát hiện mọi PII (đặc biệt địa chỉ). UI nhắc không nhập thông tin riêng.

Mỗi lượt tối đa 1.000 ký tự; mỗi mục catalog chỉ name120/description200; output tối đa512 tokens/3.000 ký tự; timeout15s, không retry provider tự động. 20 lượt/phiên/giờ và 200 lượt/ngày toàn shop (ngày Việt Nam) giới hạn cứng trong DB cho cả fallback. Đặt billing/quota nhà cung cấp tương ứng; đây là trần request/token, không phải dự báo tiền VND. Cookie reset có thể vượt hạn theo phiên nhưng không vượt trần toàn shop; WAF/IP tuning thuộc phát hành.

Trả lỗi, blocked/truncated, rỗng, chứa URL/số tài khoản dài/mã tra cứu: dùng fallback Zalo. Prompt không cam kết thông tin chưa công bố. Model vẫn có thể sai; trước public cần thử câu hỏi thật, prompt injection và rà soát câu trả lời. AI không bao giờ tự xác nhận đơn/thanh toán. Catalog lỗi không lấy giá demo gửi AI.

`begin_chat` lưu câu hỏi và giữ lease45s; `finish_chat` chỉ cùng hash+ID+lease mới hoàn tất. UUID lượt ổn định khi thử lại: done trả lịch sử, pending trả busy; lease hết hạn chốt fallback thay vì gọi model lần hai. Không giữ transaction trong lúc gọi HTTP. Mất phản hồi sau commit có thể tải lại/kiểm tra cùng ID, không xóa nội dung form. Khi hết quota, không sinh session rác.

## Telegram

```dotenv
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=
```

Tạo bot bằng BotFather, thêm vào nhóm admin riêng, cho phép gửi tin; lấy đúng ID nhóm âm. Không dùng ID username của cá nhân. Sau khi cấu hình, bật `TELEGRAM_ENABLED=true` và restart web/worker. Không gọi getUpdates tự động để đọc tin nhóm hoặc gửi thử khi chưa có credential.

Trigger ghi `notification_outbox` cùng transaction khi tạo đơn (admin/web), đổi bước/hủy, thu/hoàn tiền, gửi đặt tìm; chat handoff ghi cùng transaction và chỉ một lần/phiên. Payload chỉ loại sự kiện+entity UUID; Telegram nhận link admin yêu cầu đăng nhập và UUID sự kiện. Không có SĐT/địa chỉ/tên khách/nội dung chat/giá vốn/mã tracking hoặc tổng tiền. Không backfill thông báo cho dữ liệu cũ.

Web dùng `after()` gửi một đợt tối đa5 sau thao tác thành công; thiếu cấu hình không claim/tiêu lượt. Worker bền vững xử lý cả sự kiện bị bỏ lỡ khi process dừng và retry:

```powershell
npm run notify:once
npm run notify:worker
```

Worker đọc `.env.local` nếu có, hoặc environment được inject. Loop30s, tắt Ctrl+C. Không tự chạy một service background hay deploy lên HP trong M5. Image runtime đã đóng gói script; khi triển khai theo DEPLOYMENT.md cần scheduler/process supervisor gọi worker, chưa cấu hình cron trên HP.

Claim `FOR UPDATE SKIP LOCKED`, tối đa5/đợt, fencing lease90s; mỗi HTTP timeout8s. ACK chỉ đúng lease còn hạn. Tối đa5 lần; backoff và Telegram `retry_after` được tôn trọng, trần chờ24h; last_error chỉ enum, không lưu URL/token/provider body. Mạng lỗi không rollback đơn. Telegram sendMessage không có khóa idempotency của shop: nếu Telegram nhận nhưng ACK mất, có thể lặp (at-least-once); UUID sự kiện giúp nhận biết.

## Ma trận trạng thái và nghiệm thu

Kết quả trên PC: 52/52 SQL/unit tests đạt; hồi quy API + Chromium M1–M5 và storefront đạt, gồm dọn fixture thành công. Lint/typecheck/production build đạt; Supabase security advisors không có vấn đề. Đã xem ảnh desktop1440 và mobile375. Worker ở trạng thái chưa cấu hình kết thúc an toàn, không claim/gửi thông báo. Các lượt gọi Gemini/Telegram thành công/lỗi/429/timeout được kiểm qua adapter fake fetch, không thay cho nghiệm thu tài khoản thật.

| Tình huống | Khách / admin thấy | Dữ liệu / tác dụng |
| --- | --- | --- |
| Chưa cấu hình | AI chưa bật, Zalo luôn sẵn | Lưu hỏi+fallback, Telegram pending |
| AI thành công | Nhãn Gemini và câu trả lời | Hoàn tất cùng lượt, không sửa đơn |
| Timeout/provider lỗi | Hướng dẫn Zalo | Không retry provider tự động |
| Gửi lại | Busy hoặc lịch sử cũ | Không sinh thêm lượt/chi phí |
| Phiên khác | Chưa có lịch sử của người kia | Không nhận hash/session từ browser |
| Handoff | Đã đánh dấu, khách chủ động nhắn Zalo | Một outbox/phiên |
| Telegram lỗi | Pending/backoff hoặc hết5lượt | Đơn/ledger/kho giữ kết quả đúng |
| Admin hết quyền | Không mở lịch sử/hàng đợi | Guard server + RPC kiểm live admin |

Kiểm chứng: `npm test` kiểm adapter HTTP bằng fake fetch (không gọi dịch vụ thật), scope/capability, private RPC, idempotence/lease/quota, rollback outbox và fencing. `npm run test:m5-local` chạy hồi quy API/Chromium M1–M4+storefront và gửi/reload chat, phiên khác không thấy lịch sử, Zalo handoff, admin đọc đúng lịch sử, reset cookie và responsive375/1440. Chỉ fixture riêng; cleanup cả chat budget, outbox và đơn web; không reset DB hoặc dùng cookie Google thật.

Chưa nghiệm thu live Gemini/Telegram, điện thoại thật, chính sách retention hoặc public release. Không tự xóa lịch sử/đơn khi chưa chốt thời hạn lưu.

Nguồn kỹ thuật đã đối chiếu: [Gemini generateContent](https://aistudio.google.com/api-reference/generate-content/generate-content), [model hiện hành](https://aistudio.google.com/docs/models), [Gemini terms](https://aistudio.google.com/docs/terms), [Telegram sendMessage](https://core.telegram.org/bots/api#sendmessage), [Supabase database functions](https://supabase.com/docs/guides/database/functions). Next after/cookies/forms đọc từ docs phiên bản đang cài.
