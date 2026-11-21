# M3 — Đơn hàng, thực thu và tracking local

Triển khai trên PC, không triển khai HP. Đọc REQUIREMENTS.md trước; tài liệu này mô tả hành vi hiện có và các giới hạn vận hành.

**Bổ sung QR ngân hàng:** đã có QR Agribank cọc/full theo đơn, reference riêng và trạng thái chờ admin xác nhận. Xem [BANK-PAYMENT.md](BANK-PAYMENT.md). Không tích hợp ngân hàng tự xác nhận.

## Cách dùng

1. Vào `/admin/catalog`, nhập giá thật và công khai ít nhất một hạng mục. Tám gói lube nháp không được tự điền giá giả.
2. Vào `/admin/orders` → Tạo đơn mới. Chọn số lượng, thông tin khách, cấu hình và phương án cọc/COD hoặc chuyển khoản toàn bộ.
3. Shop xác nhận tiền thực sự nhận qua chuyển khoản, nhập số tiền/chứng từ. Lần đầu phải đúng cọc 20% hoặc 100% theo phương án; chỉ lúc này mới trừ tồn. Thiếu bất kỳ linh kiện nào thì cả giao dịch thất bại, không ghi tiền, không trừ một phần kho.
4. Chuyển từng bước Đang chờ → Đang xử lý → Hoàn thành. Không chuyển khi chưa nhận cọc, không lùi/nhảy bước. Hoàn thành không có nghĩa đã được hãng vận chuyển trả tiền COD.
5. Thêm ghi chú, ảnh private hoặc link sound test. Lưu thành công khách thấy ngay. Gửi link hoặc tải QR cho khách. Link localhost chỉ mở được trên PC; chưa dùng nhận đơn thật từ xa.
6. Sau hoàn thành, chỉ ghi nhận 80% COD còn lại khi hãng vận chuyển thực sự trả shop. Sổ thu/hoàn là append-only, không có nút đánh dấu paid tách khỏi giao dịch tiền.

Tổng hàng/dịch vụ chưa gồm ship. Cọc làm tròn lên một đồng nếu 20% không nguyên. Ghi chú vận chuyển tách riêng, chưa tự tính ship hay tạo vận đơn. M3 không có tích hợp ngân hàng tự động.

## Hủy và sửa sai

| Trạng thái | Thu tiền | Bước kế tiếp | Hủy / hoàn |
| --- | --- | --- | --- |
| Đang chờ, chưa cọc | Đúng 20% hoặc 100% qua bank theo phương án | Chặn | Hủy không cộng tồn, chưa có tiền để hoàn |
| Đang chờ, đã cọc/full | Không thu thêm COD | Đang xử lý | Hủy, thu hồi phần linh kiện shop được xác nhận |
| Đang xử lý | Không thu thêm COD | Hoàn thành | Hủy, thu hồi phần shop, giữ lịch sử |
| Hoàn thành | Thu đúng 80% COD khi shop thực nhận, nếu còn nợ | Không còn bước | Không có đổi trả trong M3 |
| Đã hủy | Chặn thu và cập nhật tiến độ | Chặn | Chỉ ghi hoàn tiền đã thực chuyển trả, tối đa net vượt cọc |

- Chỉ hủy đơn Đang chờ/Đang xử lý. Giữ lịch sử, ghi lý do nội bộ và hiển thị khách trạng thái đã hủy.
- Mặc định không hoàn lại tồn. Admin nhập riêng số linh kiện **của shop**, đã thu hồi và dùng lại được, tối đa số đã trừ. Không nhập bàn phím/tài sản khách, vật tư tiêu hao hoặc công. Đơn chưa nhận tiền không được cộng tồn khi hủy.
- Giữ cọc 20%. Nếu đã chuyển khoản 100%, có thể ghi nhận hoàn phần vượt cọc sau khi shop đã thực sự chuyển trả khách. Không tự chuyển tiền. Gửi lại cùng request không hoàn hai lần.
- Dòng đơn bất biến ngay khi tạo, lưu giá/tên/đơn vị/giá vốn riêng. M3 chưa có editor chỉnh lại báo giá của đơn chờ: chốt sai thì hủy và tạo lại, đối soát tiền nếu đã nhận. Không sửa catalog để thay đổi giá đơn cũ. Điều này chặt hơn yêu cầu khóa khi bắt đầu; sửa đơn chờ với điều chỉnh cọc/tồn là phần mở rộng, chưa có UI.
- Chưa có đổi trả đơn đã hoàn thành hay sửa/xóa giao dịch cũ. Nếu nhập sai chứng từ/số tiền cần quy trình bút toán điều chỉnh riêng trước khi dùng nhận đơn thật; không sửa trực tiếp DB.

## Dữ liệu và quyền

- Mọi bảng đơn/dòng đơn/giao dịch/sự kiện/request nằm trong `private`, bật RLS, không cấp SELECT hay write trực tiếp cho anon/authenticated.
- `order_command` xác minh Google identity, membership và phiên còn sống; khóa request, khóa đơn rồi sản phẩm theo ID cố định. UUID request và payload kiểm gửi lặp, chống đổi nội dung cùng UUID. Mọi write liên quan commit/rollback cùng transaction.
- `read_order`/`list_orders` chỉ admin; danh sách tối đa 200 đơn mới nhất. Dữ liệu khách đầy đủ và giá vốn chỉ nằm trong DTO quản trị.
- Mã `TK-` + 32 ký tự hex (128 bit ngẫu nhiên), không có mã tuần tự public. Cùng mã dùng nhập tay, link và QR. Mã lưu nguyên văn trong bảng private để admin gửi lại; đây là capability, phải giữ kín. Không phải mô hình mã ngắn + token phụ của baseline M0.
- `track_order` chỉ được gọi bằng server secret, trả DTO một mã chính xác; browser không được gọi trực tiếp. Server chỉ chuyển tên rút gọn, SĐT che, cấu hình, hạng mục, tiến độ, tình trạng tiền và các cập nhật public. Không trả địa chỉ, số đầy đủ, ghi chú nội bộ, giá vốn hay chứng từ.
- Bucket `order-media` private. Ảnh kiểm nội dung bằng Sharp, giới hạn 5 MB/20 MP, reencode WebP; MP4 tối đa 10 MB, kiểm MIME và header container, chưa phân tích codec/transcode. Nếu video không phát trên thiết bị, dùng YouTube/TikTok. Không autoplay. Không tự đưa ảnh đơn lên portfolio.
- Storage URL ký 300 giây sau khi tra cứu đúng capability. URL chứa object path theo cơ chế signed URL của Supabase, nhưng không trả trường storage path riêng trong DTO; người có signed URL được xem đến khi hết hạn. Tải lại trang để ký URL mới.
- Tracking/admin no-store, noindex, no-referrer; SW không cache. Limiter local 30 lượt/phút dùng chung cho PC, bounded 2.000 keys. Chỉ bật `TRUST_PROXY_IP=true` sau khi xác minh proxy ghi đè header IP; trước nhiều replica phải thay limiter bằng bộ đếm dùng chung. Đây không thay cho entropy mã.
- `SUPABASE_SECRET_KEY` mới cần ở **server runtime** từ M3; `.env.local` gitignored đã cấu hình local, không dùng NEXT_PUBLIC. Operator bootstrap vẫn riêng. Không in credential ra log/bundle.

## Kiểm thử và phát hành

- `npm test`: SQL chạy database rỗng với tất cả migration, kiểm snapshot, rollback tiền/tồn nhiều dòng, idempotency, bước, hủy/thu hồi, hoàn tiền, COD và quyền/DTO.
- Kết quả local: 26/26 SQL/unit tests, API Supabase và Chromium M1–M3 đạt; lint/typecheck/production build đạt, security advisors không có findings. Secret runtime không xuất hiện trong assets public. Sau cleanup còn 0 đơn fixture, 1 admin thật và 8 gói lube nháp chưa giá. Không coi là UAT khách hàng/thiết bị thật.
- `npm run test:m3-local`: API Supabase thật + Chromium, dùng fixture riêng, không dùng cookie thật, cleanup cả đơn/ảnh/sổ kho/tài khoản. Bao gồm hồi quy M1/M2, tranh tồn giữa hai đơn, tạo đơn qua Next Server Action, nhận cọc, bước sai/chuyển đủ bước, từ chối ảnh giả, giữ form sau lỗi, ảnh private public tracking, COD, mã sai, layout 375/1440.
- Ảnh QA ở `output/playwright/m3-*`; backup trước migration ở `output/backups/pre-m3.sql` (không commit, có dữ liệu private). Không reset DB người dùng.
- Trước public: UAT với giá/sản phẩm thật; kiểm QR trên điện thoại qua tên miền; quy trình bút toán sửa sai; ship/COD, retention/backup; không ghi đường dẫn capability vào access/analytics logs. Next dev hiện vẫn in URL khi truy cập, chỉ dùng local. Chưa nghiệm thu thiết bị iOS/Android thật hay codec video.
- Lợi nhuận vẫn hoãn. M4 tiếp theo là đặt tìm không cọc và portfolio chủ động xuất bản.

Tham khảo: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [private downloads](https://supabase.com/docs/guides/storage/serving/downloads).
