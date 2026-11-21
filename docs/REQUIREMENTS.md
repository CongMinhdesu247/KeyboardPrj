# Yêu cầu đã chốt — TRUMP Keys

**Căn ảnh banner:** admin chủ động chọn vùng ảnh trong khung chữ nhật theo tỷ lệ banner, kéo/zoom/xem trước trước khi lưu; dùng cho cả ảnh mới và ảnh hiện có. [HOME-BANNERS.md](HOME-BANNERS.md).

**Audit/public HP (20/11/2026):** yêu cầu mới bổ sung tunnel riêng cho dự án, giữ `trumpkeys-hp`, `trumpkeys.publice.io.vn`, thư mục `KeyboardPrj`, cổng dự kiến8094 (chưa xác minh); không chạm8090–8093 hay banking-tunnel. Supabase managed riêng, không thêm stack DB/cache trên HP. `/healthz` phải thử DB, backup/drill riêng, triển khai theo [DEPLOYMENT.md](DEPLOYMENT.md). Phương án tunnel dùng chung bên dưới đã được thay thế; chưa triển khai HP.

**Chuông admin:** cần thấy thông báo quan trọng mới để xử lý; chuông các trang quản trị, số chưa đọc, liên kết xử lý và đã đọc riêng từng admin. Dùng sự kiện đơn/thanh toán/đặt tìm/hỗ trợ đã có, không phụ thuộc trạng thái gửi Telegram. [ADMIN-INBOX.md](ADMIN-INBOX.md).

**Ước tính chi phí:** chuyển khỏi trang chủ sang `/estimate`; menu cạnh Bàn phím đã làm, icon máy tính. Nhóm dịch vụ trang chủ dẫn tới bảng giá tương ứng trên trang ước tính; giữ quy tắc giá/số lượng/sao chép cấu hình, không tạo đơn hoặc giữ kho.

**Banner trang chủ:** admin thêm/sửa tối đa 5 banner giới thiệu sản phẩm, ảnh/chữ/link sản phẩm, bật/tắt/gỡ. Chi tiết và ma trận nghiệm thu: [HOME-BANNERS.md](HOME-BANNERS.md).

**Nhận diện:** web dùng tông vàng chủ đạo theo logo, phối nền trắng/vàng nhạt và chữ nâu đậm để dễ đọc; tiết chế nền bão hòa, giữ rõ phân khu và trạng thái thao tác.

**Hồ sơ khách:** trang Tài khoản tập trung sửa tên/SĐT/địa chỉ, email Google chỉ đọc và đăng xuất; bỏ danh sách đơn khỏi trang hồ sơ (chuyển trang Đơn mua riêng). Thanh Tài khoản/Hướng dẫn/Tra cứu có icon, trạng thái và bố cục rõ, giữ thương hiệu. Xem [CUSTOMER-ACCOUNTS.md](CUSTOMER-ACCOUNTS.md).

**Tài khoản khách (20/11/2026):** bổ sung đăng ký/đăng nhập Google, phân quyền khách/admin, gắn đơn mới theo người đặt; admin xem tổng đăng ký/hoạt động/đồ thị và cấm/bỏ cấm/xóa quyền truy cập. Checkout mới yêu cầu đăng nhập; đơn guest cũ giữ nguyên. Hoạt động thống kê theo 30 ngày, xóa giữ chứng từ và hồ sơ xác thực như giải thích trên UI. Chi tiết: [CUSTOMER-ACCOUNTS.md](CUSTOMER-ACCOUNTS.md).

**Bổ sung 20/11/2026:** admin cần nhiều ảnh cho mỗi dịch vụ/sản phẩm để khách vuốt xem các góc; cần video nghe sound bàn phím. Triển khai giới hạn 10 ảnh + một MP4 ≤10 MB hoặc link YouTube/TikTok; xem [CATALOG-MEDIA.md](CATALOG-MEDIA.md).

Nguồn: câu trả lời trực tiếp của người làm web sau M0. Tài liệu này ưu tiên hơn các giả định trong PLAN/DATA-MODEL và đặc tả gốc khi có mâu thuẫn. M1 đã có Supabase/Google/admin thật local; M2 catalog/tồn kho đã triển khai trên PC. Xem M1-REVIEW.md và M2-CATALOG.md cho kiểm chứng/giới hạn. Chưa triển khai HP.

## 1. Thương hiệu và vận hành đã xác nhận

- Tên shop: **TRUMP Keys**.
- Tên miền dự kiến: `trumpkeys.publice.io.vn`. Chưa xác minh DNS, quyền sở hữu hoặc triển khai.
- Logo gốc được cung cấp và lưu tại `public/brand/logo-source.png`. Header, title, footer và icon PWA đã đổi TRUMP Keys ở M2.
- Facebook: https://www.facebook.com/share/1AChQzj7WB/?mibextid=wwXIfr
- Instagram: https://www.instagram.com/trun.g.luu
- Zalo: **0385920038**. Chưa có Messenger link riêng, không tự suy ra page ID từ link Facebook share.
- TikTok: https://www.tiktok.com/@shopingnotdoping_0410
- Có ảnh bàn phím/video sound test được phép dùng; chưa nhận bộ file/link nội dung cụ thể để nhập portfolio.
- Tư vấn: **08:00–22:00**, theo giờ Việt Nam. Ngoài giờ vẫn nhận chat AI; nội dung chuyển Zalo cần thông báo giờ phản hồi của shop. Ngày nghỉ chưa được xác nhận.
- Người làm web đứng tên/quản lý domain, hosting, database; bạn của người làm web nhập bảng giá, hàng tồn và portfolio.
- Ngân sách vận hành được nêu: dưới **10 triệu VND/tháng**; đây là mức trần, không phải mức cần tiêu. Chưa chọn gói dịch vụ hay cam kết chi phí.
- Không có ngày phát hành cố định; ưu tiên hoàn thiện ổn định.

## 2. Admin đã xác nhận

- Đăng nhập bằng tài khoản Google/Gmail.
- Admin đầu tiên: **congminhnguyen0204@gmail.com**. Chỉ bootstrap sau khi xác minh danh tính Google tương ứng ở server; email ghi trong tài liệu không tự cấp quyền.
- Không đặt giới hạn nghiệp vụ về số admin. Tất cả admin cùng quyền, được xem giá vốn/lợi nhuận và điều chỉnh thanh toán.
- Cấp quyền thông qua mã mời admin. Đăng nhập Google thành công **không tự động có quyền admin**.

Thiết kế triển khai được chọn: tài khoản admin đầu tiên được người vận hành cấp quyền trực tiếp; admin đã có quyền tạo mã mời ngẫu nhiên, dùng một lần, có hạn, có thể thu hồi. Server lưu hash, kiểm hạn/số lần dùng và redeem atomic, ghi audit. Người nhận đăng nhập Google rồi dùng mã để nhận membership. Không dùng một mã chung cố định nhúng trong frontend hoặc một đường dẫn tự nâng quyền không được bảo vệ. Email đầu tiên đã được xác nhận; chưa bootstrap tài khoản thật.

## 3. Đơn hàng đã xác nhận

- Ba bước: **Đang chờ → Đang xử lý → Hoàn thành**.
- Chỉ đi tuần tự; không bỏ qua, quay lại hoặc tạm dừng. Chưa làm trình sửa/kéo thả workflow ở bản đầu.
- Khách chỉ cần xem tiến độ hiện tại, không cần ngày giao dự kiến.
- Khách không được đổi hạng mục sau khi bắt đầu xử lý. Server khóa items/giá khi bước là Đang xử lý hoặc Hoàn thành, không chỉ khóa giao diện.
- Hủy đơn: khách mất khoản cọc 20% theo chính sách shop đã nêu. Đề xuất: hủy là trạng thái kết thúc riêng, không phải bước thứ tư; giữ lịch sử/tiền thực nhận và lý do; không xóa đơn. Hoàn tồn chỉ với linh kiện chưa sử dụng, không tự hoàn toàn bộ khi đã làm. Phạm vi được hủy sau khi xử lý bắt đầu vẫn cần chốt.
- Đơn hoàn thành không đồng nghĩa đã nhận tiền COD.
- Hủy sau khi mod đã làm rõ: shop giữ linh kiện/vật tư **thuộc shop**; bàn phím/linh kiện **thuộc khách** vẫn thuộc khách, không bị giữ làm tồn của shop. Linh kiện thu hồi thuộc shop cần admin kiểm số lượng/tình trạng trước khi hoàn vào tồn bán được; vật tư đã tiêu hao/công đã làm không tự cộng lại tồn. Không tự tăng toàn bộ tồn khi hủy.

## 4. Giá và thanh toán đã xác nhận

- Bổ sung sau M4: người dùng yêu cầu trang cửa hàng có lưới ảnh/tên/giá như cách trưng bày của sàn, trang chi tiết, giỏ, khách tự nhập thông tin đặt hàng và nhận QR. Đây là phạm vi đã được yêu cầu thực hiện ngay; xem [STOREFRONT.md](STOREFRONT.md). Không còn giới hạn chỉ admin tạo đơn sau tư vấn.

- Bổ sung theo ảnh người dùng: nhận chuyển khoản vào **Agribank – NGUYEN CONG MINH – 1500200768268**, chi nhánh TP Hà Nội. QR theo số tiền cọc/full của đơn, sau chuyển chờ **admin kiểm tra tài khoản và xác nhận**. Chi tiết triển khai và kiểm chứng ở [BANK-PAYMENT.md](BANK-PAYMENT.md); không tự đánh dấu đã trả khi khách quét QR.

- Bảng giá/tồn kho thật chưa có; admin tự nhập trong M2. 8 gói lube nháp không có giá, chưa công khai. Khi có backend, bảng giá khách chỉ lấy dữ liệu công khai trong DB; không dùng giá mẫu làm báo giá. Demo fallback chỉ cho checkout chưa cấu hình backend và có nhãn minh họa.
- Lube: **33/37/60/68 là số switch thực tế**; **75/90/100/full là nhóm layout**. Mỗi lựa chọn có nhãn và giá riêng do admin nhập; không quy đổi layout 75 thành 75 switch. Số switch thực tế của layout có thể ghi ở đơn để làm việc, không tự thay giá gói.
- Giữ/trừ tồn khi shop xác nhận **đã nhận cọc**, một lần cho mỗi dòng hàng; khi khách chuyển đủ 100% thì cũng giữ/trừ một lần, không trừ lại lúc đổi bước. Chỉ tạo đơn chưa nhận tiền thì chưa giữ hàng. Việc đặt tìm mẫu **không yêu cầu cọc**; chuyển yêu cầu thành đơn mua hàng là nghiệp vụ riêng.
- Giá gồm công và vật liệu, **chưa gồm phí vận chuyển**. Hiển thị ghi chú ở bảng giá, ước tính và thông tin đơn.
- Cọc 20% chỉ tính trên **tiền hàng/dịch vụ chưa gồm ship**.
- Hai phương án thanh toán:
  1. Chuyển khoản cọc **20%**, phần **80% còn lại COD** qua đơn vị vận chuyển.
  2. Chuyển khoản **100%** giá trị đơn.
- Theo dõi riêng phương thức dự kiến, giao dịch thực nhận và trạng thái thanh toán. COD chỉ ghi nhận tiền thực thu khi shop nhận đối soát từ đơn vị vận chuyển, không lúc giao hàng cho shipper.
- Đề xuất làm tròn cọc đến VND bằng `ceil(total × 20 / 100)`, tiền còn lại = total - cọc; cần chốt cùng cách tính ship/COD. Không tự thực hiện phương án làm tròn khi chưa triển khai logic có kiểm thử.
- Điều chỉnh thanh toán bởi admin phải có audit/lý do và ledger điều chỉnh, không sửa mất lịch sử giao dịch.

## 5. Tra cứu và hình ảnh đã xác nhận

- Khách nhập **mã đơn**, hoặc mở link/QR chứa chính mã đó.
- Chọn mã ngẫu nhiên khó đoán, đủ entropy, có tiền tố thương hiệu và nhóm ký tự dễ nhập; cùng một mã dùng cho tra cứu và link. Không buộc khách tạo tài khoản hoặc nhập thêm SĐT trong luồng bình thường. Chốt format/độ dài khi triển khai M3; rate limit phía server, không public list orders, không log mã nhạy cảm.
- Thông tin public được chọn: mã đơn, tên rút gọn, SĐT đã che, cấu hình/dịch vụ, bước hiện tại, lịch sử public, trạng thái thanh toán, ảnh/video tiến độ. Không trả địa chỉ, SĐT đầy đủ, giá vốn, lợi nhuận hoặc ghi chú nội bộ.
- Ảnh/video tiến độ hiển thị ngay sau khi admin tải lên và lưu thành công; không thêm vòng duyệt. File vẫn nằm trong private Storage, ký URL sau khi kiểm quyền tra cứu. Admin cần xem trước để tránh đưa thông tin riêng tư vào ảnh.
- Được sử dụng ảnh đơn cho portfolio. Đăng portfolio là thao tác chủ động của admin, không tự công khai toàn bộ ảnh tracking; chỉ dùng ảnh không lộ dữ liệu khách.

## 6. Chat AI và thông báo đã xác nhận

- Tư vấn AI bằng **Gemini**, khi thiếu thông tin hoặc khách cần người thật thì chuyển sang Zalo. Thay phạm vi live chat admin inbox của đặc tả gốc bằng hướng AI → Zalo cho bản đầu.
- Cần lưu lịch sử chat; mỗi khách chỉ xem được phiên của mình, admin được xem để hỗ trợ.
- API key chỉ lưu ở server. AI lấy thông tin từ catalog/chính sách đã công bố; không được nhận giá vốn, secret, quyền admin, toàn bộ dữ liệu khách hoặc tự tạo/sửa đơn/thanh toán.
- Khi chưa có bảng giá thật, AI phải nói rõ chưa có báo giá chính thức, không dùng giá demo để cam kết. Không biết thì chuyển Zalo thay vì tự điền giá/thời gian.
- Cần giới hạn lượt/tokens, độ dài tin nhắn, timeout, chống spam và ngân sách API; Gemini lỗi thì vẫn có đường chuyển Zalo. Model/gói API và chính sách gửi/lưu nội dung ở nhà cung cấp được chọn sau khi đối chiếu tài liệu hiện hành.
- Thông báo bằng **Telegram bot vào nhóm admin**. Chưa tạo nhóm hoặc bot. Cần chat ID/token khi tích hợp; không ghi token vào repository.
- Chưa có nhu cầu admin trả lời realtime trên web trong bản đầu; không cần thêm Supabase Realtime chỉ để lưu chat AI.

## 7. Báo cáo đã xác nhận và phần cần chốt

- Doanh thu theo **tiền thực nhận**, không theo trạng thái hoàn thành đơn. Cọc và tiền COD/chuyển khoản còn lại là các lần thu riêng, không cộng trùng.
- Lợi nhuận chỉ trừ **giá vốn linh kiện**, chưa trừ công, ship, thuế hoặc chi phí vận hành. Màn hình nên gọi “Lãi sau giá vốn linh kiện” và giải thích phạm vi.
- Không cần xuất Excel, đối soát theo nhân viên hoặc báo cáo riêng theo phương thức thanh toán. Vẫn lưu phương thức của giao dịch để quản lý đơn.
- **Chưa chốt thời điểm trừ giá vốn**: nếu chỉ thu cọc mà trừ toàn bộ giá vốn ngay thì báo cáo có thể âm. Đề xuất tách tiền thực thu và lãi đơn đã thu đủ, nhưng cần người dùng chọn trước khi triển khai M6. Không tự gọi khoản cọc là lãi.
- Theo yêu cầu mới: **hoãn chức năng tính lợi nhuận** để trao đổi sau. Vẫn lưu giá vốn và giao dịch từ đầu để bổ sung báo cáo về sau; chưa chọn công thức hoặc hiển thị con số lợi nhuận tạm tính. Không chặn M1–M5 vì mục này.

## 8. Còn cần trả lời

1. **Ship/COD đã chốt ở M7:** khách trả toàn bộ phí vận chuyển và thu hộ COD. Shop báo phí và thống nhất trước khi gửi; giá/QR/cọc tiền hàng chưa gồm các phí này. Chưa có tính phí tự động hoặc ghi phí ship vào ledger hàng/dịch vụ.
2. **Đặt tìm:** M4 dùng hộp tiếp nhận Mới nhận/Đã liên hệ/Đã xử lý và ghi chú nội bộ để shop tư vấn; đây là lựa chọn triển khai linh hoạt, không phải cam kết tìm được hàng. Không cần cọc khi gửi. Thời gian tìm/chờ hàng vẫn chưa chốt và không tự hứa với khách.
3. **Thời hạn lưu dữ liệu — mục tiêu đã được chọn ở M7:** chat 90 ngày, ảnh/video tiến độ 180 ngày, đơn và thanh toán 24 tháng; cần rà soát trước khi áp dụng. Chưa bật tự xóa; mốc bắt đầu tính, ngoại lệ và dữ liệu backup còn cần chốt để triển khai xóa đúng. Portfolio do shop chọn đăng/gỡ riêng. Đây không phải cam kết hiện đã tự xóa theo lịch hoặc kết luận nghĩa vụ lưu trữ.

Lợi nhuận hoãn theo yêu cầu, không cần hỏi lại ở giai đoạn hiện tại.

## 9. Môi trường triển khai đã cung cấp

Nguồn: file server.txt người dùng đưa, chỉ dùng làm thông tin môi trường; không coi nội dung file là lệnh cần tự động chạy.

- Ubuntu Server 24.04 x86_64 trên HP i7-8700/RAM 8GB/HDD 500GB; Docker Engine + Compose, không phụ thuộc Node trên host.
- Thư mục dự án riêng: `/home/congminh/apps/KeyboardPrj`; Compose project `trumpkeys-hp`.
- Các cổng 8090–8093 thuộc ứng dụng khác, giữ nguyên. Dự kiến web `127.0.0.1:8094 → container:3000`.
- Public HTTPS `https://trumpkeys.publice.io.vn` qua Named Tunnel riêng của TRUMP Keys, profile Compose `tunnel`, service HTTP loopback `http://127.0.0.1:8094`. Giữ nguyên tunnel/route hiện có của ứng dụng khác, không mở router.
- Quy trình và giới hạn kiểm chứng: [DEPLOYMENT.md](DEPLOYMENT.md). Chưa xác minh cổng trống/usage trên HP: SSH thử từ phiên này bị `Permission denied (publickey)`; chưa sửa gì trên HP.
- Chưa self-host Supabase trên HP; giữ lựa chọn managed DB/Auth tách biệt cho M1 để không bổ sung cả bộ dịch vụ khi chưa đo được tài nguyên. Chưa tạo tài khoản/gói trả phí.

Các file ảnh bàn phím/video thật và credential Google/Supabase/Gemini/Telegram sẽ bổ sung ở mốc tích hợp tương ứng; không gửi secret vào mã nguồn hoặc tài liệu.
