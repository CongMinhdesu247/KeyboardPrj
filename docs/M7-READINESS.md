# M7 — Chuẩn bị vận hành trên PC

Phạm vi được phép: hoàn thiện nội dung/chính sách đã chốt, hướng dẫn nhập dữ liệu thật, kiểm thử end-to-end và đóng gói/kiểm tra production trên PC. **Chưa phát hành**, chưa SSH/đổi DNS/tunnel hoặc deploy HP; chưa xóa dữ liệu. Nội dung thật và quét QR/chuyển tiền trên thiết bị thật vẫn cần người vận hành nghiệm thu.

## Bổ sung hiện hành

- `/guide`: hướng dẫn chọn hàng, đặt đơn, cọc20%/COD80% hoặc bank100%, giữ link riêng, theo dõi, giao nhận/hủy/hoàn theo quy tắc đã chốt.
- `/privacy`: loại thông tin shop nhận, quyền xem theo mã đơn, cookie/giỏ/chat, Google/Supabase/Gemini/Telegram, thời hạn lưu mục tiêu và kênh hỗ trợ. Không tuyên bố đã tự xóa, đã ẩn danh hoàn toàn hoặc có chứng nhận tuân thủ.
- Footer và form đặt hàng/đặt tìm/chat có link tới hướng dẫn/thông tin dữ liệu. Link trong form mở tab mới để giữ nội dung đang nhập.
- `/admin/readiness`: kiểm tra dữ liệu catalog thực bằng RPC admin hiện có; nhận biết mục công khai thiếu ảnh/mô tả/giá, nhóm đang bật, mục nhận đặt và nháp. Kiểm ảnh có tồn tại, nội dung/tương thích, giá/tồn thật và quyền sử dụng là bước duyệt của shop; có ảnh không tự coi đã duyệt. Không thay loại mục Aula hoặc tự nhập hàng mẫu.
- Checklist nhập hàng, portfolio và quét QR/thử COD/tiền thực thu, lưu trữ/backup/domain. Chỉ đọc, không có nút tự nghiệm thu hay phát hành.
- Container smoke script dùng image/tag riêng và cổng loopback ngẫu nhiên, runtime512MB/1CPU/non-root, không có secret/backend/volume thật. Các trang có demo vẫn ghi demo; không kết nối Supabase đang dùng từ container thử. CI dùng cùng script, chưa có kết quả CI từ remote.

## Quyết định shop đã bổ sung

**Phí:** khách trả toàn bộ phí ship và thu hộ COD (nếu có). Shop báo phí, thống nhất trước khi gửi; giá sản phẩm/dịch vụ, tổng tiền hàng và QR hiện chưa gồm phí. Phí không được tự cộng vào doanh thu hàng/dịch vụ, không suy COD net sau phí là đã nhận đủ tiền hàng. Trước vận hành cần kiểm cách hãng vận chuyển thu phí/đối soát thực tế; ledger hiện chỉ nhận đúng phần tiền hàng theo M3.

**Lưu trữ:** mục tiêu chat90ngày, ảnh/video tiến độ180ngày, đơn+thanh toán24tháng; người dùng yêu cầu rà soát trước áp dụng. Không tạo cron hoặc nút xóa. Chốt mốc tính (tin cuối/đóng đơn/giao dịch), ngoại lệ, portfolio, backup/offsite và cách xử lý yêu cầu trước khi viết quy trình xóa. Cookie chat30ngày chỉ là quyền truy cập, khác thời hạn lưu chat.

## Nhập dữ liệu thật — người bạn quản lý shop

1. Vào Admin/Bảng giá & kho. Với hàng bán có tồn chọn **Sản phẩm**, công mod chọn **Dịch vụ**; đúng nhóm/đơn vị. Lube33/37/60/68 là switch thực;75/90/100/full là gói layout.
2. Nhập tên dễ hiểu, ảnh đã được phép, mô tả tương thích, giá bán/giá vốn. Không dùng ảnh mẫu QA/AI để mạo nhận hàng có sẵn.
3. Lưu; sản phẩm mới tồn0, dùng phiếu nhập tồn thực tế có lý do. Bật Công khai khi đúng giá/nội dung. Kiểm `/shop` và chi tiết trên điện thoại.
4. Mở Chuẩn bị vận hành và sửa các mục thiếu. Tạo nhầm loại cần tạo mới đúng rồi lưu trữ mục sai theo hướng dẫn; không đổi lịch sử đơn.
5. Portfolio: chọn ảnh không PII và sound test đã được phép, xem nháp, xác nhận mới công khai. Không để bài fixture/đánh giá/số đã bán giả.

## UAT cùng shop — còn cần làm trên thiết bị thật

Không đánh dấu những dòng này đã đạt chỉ vì test tự động đạt. Ghi ngày/người thử/kết quả và mã nội bộ; không dán capability/ảnh chứa PII vào tài liệu công khai.

| Thử | Kết quả cần thấy | Trạng thái |
| --- | --- | --- |
| Ảnh/giá/tồn thật trên375px và desktop | Đúng mẫu/đơn vị/layout, không tràn, không hàng QA | Chờ shop duyệt |
| Chọn hàng, đổi giá trước checkout | Nhắc xác nhận giá mới, không đặt hàng đã ẩn/hết tồn | Tự động có; thiết bị thật chờ |
| Đặt ship và pickup | Địa chỉ chỉ admin thấy, link/mã đơn lưu được | Tự động có; shop kiểm thực tế |
| Quét QR bằng app ngân hàng | Đúng người nhận, tiền cọc/full, reference; chưa coi paid | Chờ quét thiết bị thật |
| Thực nhận cọc → admin xác nhận | Receipt một lần, trừ tồn một lần, tracking đúng | Tự động có; đối soát thật chờ |
| Telegram trong nhóm Trump | Đúng sự kiện/admin link, không lộ nội dung riêng | Tin kiểm tra thật đã gửi ở M5; đơn vận hành chờ |
| Hoàn thành → nhận COD từ hãng | Chưa thu không tăng doanh thu; ghi nhận tiền về mới tăng | Tự động có; quy trình hãng/phiếu đối soát chờ |
| Hủy/hoàn phần vượt cọc | Giữ ledger, trả linh kiện shop có kiểm; không lấy đồ khách làm tồn | Tự động có; shop thử quy trình |
| Mất mạng, mở offline, thử lại | Không xác nhận giả hay hiển thị dữ liệu đơn cũ từ cache | Tự động kiểm SW; điện thoại thật chờ |
| Đăng nhập Google/logout/thu hồi | Chặn đúng phiên và quyền | PC thật người dùng đã xác nhận; production chờ |

## Backup, chuyển HP và phát hành — phần PC đã thử, production còn lại

- Đọc `DEPLOYMENT.md`; giữ project/cổng của ứng dụng khác. Không tự truy cập HP do yêu cầu build xong PC trước.
- Chọn backend production: Supabase local trên PC không thể dùng endpoint127.0.0.1 từ HP. Chưa tự tạo gói trả phí hoặc tự cài stack Supabase lên HP.
- Đã bổ sung [backup/restore local](LOCAL-BACKUP-RESTORE.md): logical DB, Auth/schema/metadata + byte Storage + source/config, khôi phục vào database riêng và file riêng, fingerprint63bảng/2object, quyền admin và báo cáo tiền đã đạt. Chưa có bản sao ngoài PC hoặc restore toàn stack mới/signed Storage API. `scripts/backup-config.sh` vẫn chỉ sao lưu config. Không reset local để thử.
- Chốt lưu trữ như trên, quyền quản trị, người giữ backup và cách phục hồi khi PC/host hỏng. Không đặt lịch xóa/backup retention mà chưa duyệt.
- Xác minh tài nguyên/cổng8094 HP, cấu hình env server/OAuth callback HTTPS, tunnel hostname và worker Telegram riêng; secrets chỉ runtime, không bake vào image. Không log tracking capability/PII.
- Source hiện chưa có remote/commit được phát hành; trước release cần version được review, giữ image/tag và đường rollback. Image M7 smoke chỉ là bằng chứng chạy Linux, không phải release đã duyệt.
- Sau khi bạn duyệt PC/nội dung/UAT/backend mới triển khai theo DEPLOYMENT.md và kiểm HTTPS từ ngoài mạng. Gemini chưa ổn vẫn có Zalo; lợi nhuận tiếp tục hoãn.

## Kiểm chứng có thể chạy lại

Kết quả phần PC: 62/62 SQL/unit tests đạt; hồi quy API/Chromium M1–M7 và storefront đạt, gồm offline chỉ cache fallback. Lint/typecheck/native production build và Supabase advisors đạt. Đã xem ảnh desktop1440/mobile375 của các màn hình mới. Fixture được dọn, env integration gốc được khôi phục; chưa chạy worker thật trong lúc test. Không vì vậy đánh dấu UAT thiết bị/tiền thật hoặc backup/restore đã hoàn tất.

Container Linux đã build/chạy đạt trên PC với runtime512MB/non-root và Host canonical, asset/policy200, guard/redirect/no-store và worker khởi động được. Đã phát hiện và sửa lỗi worker thiếu SDK trong standalone: package-worker dùng tracer sẵn có của Next đóng gói dependency ESM theo lockfile. Image kiểm chứng: `trumpkeys-web:m7-191b1730-2602-4b81-af76-f2b7c548fed9`, không phải release production. Container thử đã dọn, không có env/backend/volume thật trong image này.

```powershell
npm run lint
npm run typecheck
npm test
npm run db:check
npm run test:m7-local
npm run build
npm run test:container
```

`test:m7-local` tạm tắt Gemini/Telegram trong file local và khôi phục cấu hình gốc ở finally như M6; fixture không gửi tin vào nhóm thật hay gọi Gemini. Không chạy worker cùng lúc. Cleanup theo ID/actor, không dùng cookie Google thật hoặc reset DB. M7 thử chính sách, checklist admin,375/1440 và SW offline bằng đăng ký SW thủ công trong browser context kiểm thử (dev không tự đăng ký); chỉ `/offline.html` được cache, không route đơn/admin/chat.

`test:container` tự build image Linux, bind cổng ngẫu nhiên127.0.0.1, kiểm liveness/assets/policy, admin redirect/no-store, Host lạ và worker import; dọn đúng container vừa tạo, giữ image kiểm chứng để review. Không prune/down/reset hoặc thay ứng dụng khác. Production provider Auth/DB/Storage/Gemini và HTTPS thật vẫn chưa được kiểm bằng container không secret này.
