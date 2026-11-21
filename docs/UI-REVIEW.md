# Rà soát và tinh gọn giao diện — 20/11/2026

Menu chính bổ sung icon SVG cùng hệ nét: Trang chủ/home, Cửa hàng/tờ tiền, Dịch vụ mod/cờ lê, Bàn phím đã làm/keyboard, Tư vấn cấu hình/chat. Giữ text/URL/anchor và dấu active một gạch, icon aria-hidden không lặp tên accessible; gap8px và không co icon. Mobile giữ menu cuộn ngang, tư vấn riêng giữ quy tắc responsive hiện tại. Không thêm dependency.

**Banner chỉnh bởi admin:** 5 vị trí, thay hero đầu trang khi có banner public hợp lệ, ảnh ngang contain không crop, caption/CTA bên dưới, điều khiển manual/touch/keyboard không autoplay; fallback hero khi rỗng. Form admin chia theo vị trí, nháp/public/gỡ có xác nhận. [HOME-BANNERS.md](HOME-BANNERS.md).

**Chỉnh chu trang chủ / lỗi underline kép:** menu bị kết hợp border-bottom và global a:hover underline; override text-decoration:none trong nav, giữ border3px đồng nhất cho hover/active, focus ring riêng. Hero bố cục 2 cột, nền vàng phân vùng cho hình keyboard SVG hiện có (vẫn ghi minh họa), headline lớn, CTA rõ; mobile xếp dọc. Thêm lối mua theo nhóm trong nội dung home (không đưa lại vào menu chính), icon cho thông tin thanh toán/dịch vụ/theo dõi, giảm khoảng trống portfolio rỗng và thống nhất grid dịch vụ 4/2 cột. Không thay giá/quyền/dữ liệu hoặc tạo đánh giá giả. Đã xem viewport desktop1440/mobile375 và full-page; ảnh QA home-polished-*, navigation-single-line-*. Buyer UI, category links, nav hover/click/focus, mod anchors, service dialog Escape, 73 tests, lint/typecheck/build đạt.

**Màu nhận diện vàng:** buyer tokens vàng mật ong #f2b638, vàng kem #fff5dc, chữ nâu đậm #30251c và nền đọc trắng. CTA chính vàng/chữ nâu, nút thẻ sản phẩm vàng rất nhạt, active menu/filter vàng đậm, checkout selected vàng kem; tra cứu dùng khối vàng mật ong/nút nâu. Giữ success/error màu có ý nghĩa, ảnh sản phẩm nền trung tính và admin theme riêng. Không gradient, không tô vàng mọi vùng hoặc đổi logic. QA desktop1440/mobile375 bằng buyer UI, hồ sơ và checkout fixture, focus/hover/disabled, độ tương phản CTA; không kiểm thiết bị vật lý.

Kết quả tông vàng: buyer UI và accounts fixture (lưu hồ sơ, checkout prefill, cấm/xóa/logout) đạt; 73 SQL/unit tests, lint/typecheck/build đạt. Đã xem `gold-home-1440.png`, `gold-shop-375.png` và ảnh hồ sơ; CTA vàng/chữ nâu đo computed colors 8,55:1. Ảnh QA ở output/playwright gitignored; không đổi dữ liệu/thanh toán hoặc triển khai HP.

**Phân tách trang chủ:** hero vàng nhạt theo nhận diện, khu mua hàng nền trắng, dải dịch vụ mod vàng sáng toàn chiều ngang, ước tính xám xanh với bảng tính trắng, portfolio trắng, tra cứu nền slate tối/nút vàng. Tăng khoảng cách dọc, thống nhất tiêu đề và điểm nhấn nhỏ; không thay nội dung/quyền/giá/dữ liệu hoặc hành vi. ID services/estimate/portfolio/tracking giữ nguyên. Đã xem ảnh desktop1440/mobile375 (`output/playwright/home-sections-*`, home-services-*, home-tracking-*), sửa tương phản lỗi tra cứu; kiểm dialog Escape, mã sai, buyer UI, 73 tests, lint/typecheck/build đạt.

Menu chính theo yêu cầu mới: Trang chủ / Cửa hàng / Dịch vụ mod / Bàn phím đã làm, giữ Tư vấn cấu hình bên phải desktop. Bỏ liên kết Bàn phím/Switch/Keycap khỏi header; nhóm và bộ lọc vẫn ở cửa hàng. Trang chủ đánh dấu khi ở `/`, Cửa hàng giữ trạng thái hiện tại cả khi mở chi tiết. Không đổi URL danh mục hoặc nghiệp vụ.

**Hồ sơ tài khoản:** thay trang toàn chữ/đơn hàng bằng sidebar nhận diện/menu và form hồ sơ (tên, SĐT, email Google chỉ đọc, địa chỉ, lưu), đăng xuất tách riêng. Chuyển đơn mua sang route riêng; thanh tiện ích có icon SVG, trạng thái hiện tại/hover/focus, đủ 3 lối tắt mobile. Giữ font tiếng Việt, trắng/đen/vàng, không thêm thư viện hoặc ảnh avatar ngoài. Kiểm quyền, lưu/validation/mất mạng/checkout prefill và screenshots trong hồi quy Accounts; chi tiết [CUSTOMER-ACCOUNTS.md](CUSTOMER-ACCOUNTS.md).

Sửa điều hướng Dịch vụ mod: Link của router có thể giữ nguyên vị trí khi hash đã trùng, hoặc chuyển từ `/shop` về trang chủ nhưng không cuộn đến phần vừa render. Menu này dùng neo HTML gốc (`#services` trên home, `/#services` từ trang khác), giữ URL/nội dung. `node scripts/verify-mod-navigation.mjs` kiểm click đầu/lặp lại sau khi cuộn lên, từ shop, Enter và reduced-motion ở 1440/375px; đọc-only, không tạo đơn hoặc dùng cookie thật. Đã đạt và chụp `output/playwright/mod-navigation-{1440,375}.png`.

## Rà soát toàn bộ luồng người mua — cập nhật mới nhất

Phạm vi: home/shop/chi tiết/giỏ/checkout, đặt tìm, chat, portfolio, tra cứu đơn, hướng dẫn và riêng tư; header/footer, ảnh và phản hồi form dùng chung. Đã đọc route/component/style trước khi sửa và chụp bản đang chạy ở 375/1440px (`output/playwright/review-before/`). Không thêm tài khoản người mua hoặc SKU biến thể vào mô hình mua guest hiện tại.

Vấn đề thực tế: menu và thanh mobile cạnh tranh với checkout; style các trang hỗ trợ chưa đồng bộ; ảnh portfolio dùng crop; ảnh hỏng chỉ để trống; bộ lọc thiếu xóa nhanh; thông báo lỗi cuối form chưa nhận focus; màu bước hiện tại không khớp lời hướng dẫn.

Thay đổi:

- Component `ShopImage` dùng chung ảnh sản phẩm, portfolio và ảnh tiến độ: giữ tỉ lệ/contain, nhãn khi chưa có ảnh hoặc lỗi tải; ảnh chi tiết tải sớm. Không đổi tệp ảnh hoặc quyền đọc Storage.
- `FormError` giữ thông báo trong vùng live status, đưa focus và cuộn vào vùng nhìn thấy sau lỗi; dùng cho checkout/đặt tìm. Không reset form. Giỏ có trạng thái tải trước khi phục hồi localStorage, không báo trống sớm.
- Checkout có header gọn và bỏ thanh mobile cố định; các trang khác dành khoảng cuộn an toàn, thanh mobile ẩn khi đang nhập biểu mẫu. Ô nhập có cỡ chữ 16px và viền rõ; mục footer có vùng chạm thoải mái.
- Trang đặt tìm chia phần giải thích/form trên desktop, form một cột trên điện thoại. Chat giảm cỡ tiêu đề cạnh tranh. Đơn tách tiến độ với thanh toán, QR giữ nền trắng/kích thước đọc được; bước đang làm dùng vàng nhận diện. Chính sách/portfolio cùng hệ chữ và khoảng cách.
- Footer dẫn trực tiếp tới giao nhận và hủy/hoàn tiền đã được duyệt. Bộ lọc có xóa nhanh và khôi phục danh sách khi rỗng. Giữ thương hiệu, nội dung nghiệp vụ, URL và tích hợp; không tạo đánh giá, bảo hành hoặc cam kết giao hàng mới.

Kiểm chứng bổ sung: `test:buyer-ui` xem mọi trang public tại 375/1440, keyboard/menu, reset bộ lọc, header/giỏ/checkout, ảnh lỗi rồi tải lại, tra cứu sai mã. Lỗi mạng checkout và đặt tìm được mô phỏng bằng chặn POST trong browser context riêng: giữ địa chỉ/ghi chú, focus thông báo lỗi nằm trong viewport; không gửi đơn/yêu cầu thật. `test:m7-local` tiếp tục dùng fixture riêng, cleanup và tắt tích hợp trong lúc chạy. Ảnh QR sau reload chỉ chụp khi QR thật đã hiện, không dùng khung loading làm bằng chứng bố cục.

Giới hạn: kiểm tra Chromium trên PC, chưa kiểm trên Safari/iPhone/Android vật lý, chưa chuyển tiền thật/đối soát vận chuyển hoặc nghiệm thu Gemini thật. Không triển khai HP; nội dung/ảnh thật do shop nhập vẫn được giữ nguyên.

---

**Đợt thiết kế lại riêng người mua:** theo yêu cầu tiếp theo, bổ sung hệ thống giao diện cửa hàng quốc tế với header tìm kiếm/giỏ/danh mục, giới thiệu bàn phím ngắn, sidebar lọc, gallery–nút mua và checkout đồng bộ. Đây là hướng buyer mới thay phần mô tả trang chủ cũ bên dưới; chi tiết và kiểm chứng tại [STOREFRONT.md](STOREFRONT.md). Admin giữ giao diện vận hành đã kiểm tra.

## Phạm vi và vấn đề

Đọc cấu trúc Next App Router, layout khách/admin, CSS toàn cục, cửa hàng, giỏ, checkout, tracking, chat, catalog và các màn hình xử lý đơn trước khi sửa. Áp dụng frontend-design, web-frontend, web-design-guidelines, hướng dẫn React và kiểm tra giao diện đã render.

- `workshop.tsx`: hero quảng bá nằm sau lưới hàng, đẩy tra cứu xuống sâu; khung hỏi đáp mô phỏng lặp với trang chat thật.
- `globals.css`: nhãn và nội dung phụ nhiều chỗ chỉ 10–13px; catalog, dashboard và bộ lọc dùng nhiều khung riêng; portfolio một bài bị kéo rộng quá mức.
- `admin-navigation.tsx`: mười mục ngang mức ưu tiên, menu điện thoại nhiều hàng và nhãn nhỏ.
- `storefront.tsx` / `product-card.tsx`: lặp thương hiệu, nhãn loại nổi trên ảnh và chữ đơn vị/tồn quá nhỏ.
- Chat: lặp tiêu đề, câu hướng dẫn dài trước ô nhập.

## Quyết định thiết kế

Giữ Segoe UI/Arial có đủ dấu tiếng Việt, không tải thêm font hay thư viện UI. Bảng màu: nền `#f8fafc`, mặt nội dung `#ffffff`, chữ `#111827`, chữ phụ `#4b5563`, đường chia `#e2e6eb`, hành động vàng thương hiệu `#f59e0b`. Nhãn trạng thái có ý nghĩa vẫn giữ chữ và màu tương ứng.

Nội dung chính 16px, nội dung phụ tối thiểu 14px; tiêu đề theo cấp, số tiền dễ so sánh. Căn trái; khoảng cách tạo nhóm thay cho khung lồng nhau. Giữ card cho sản phẩm có ảnh/giá, đơn vị thông tin độc lập; dùng danh sách cho công việc và catalog.

```text
Khách: header → tra cứu gọn → hàng và giá → dịch vụ/ước tính → bài đã làm → liên hệ
Admin: điều hướng công việc/quản lý | tiêu đề → dữ liệu chính → thao tác
Mobile: nhóm công việc luôn thấy đủ; nhóm quản lý cuộn ngang bằng chạm hoặc bàn phím
```

## Đã thay đổi

- Bỏ hero, minh họa bàn phím và hỏi đáp mô phỏng khỏi trang chủ; giữ nguyên các dịch vụ, ước tính, portfolio và đường dẫn tư vấn thật.
- Tra cứu nằm gần đầu; ví dụ đơn chỉ hiện khi dữ liệu là demo. Một h1 mô tả hàng đang bán.
- Bỏ badge thương hiệu/loại hàng trang trí; giá đen đậm, tồn có chữ rõ; thêm kích thước ảnh để ổn định bố cục.
- Dashboard gom ba trạng thái thành một dải số, bớt chỉ dẫn lặp. Catalog thành danh sách trên một mặt nội dung, trạng thái dạng chữ, phiếu kho vẫn thu gọn.
- Menu tách công việc và quản lý. Điện thoại giữ bốn mục công việc trọn chiều ngang, các mục quản lý cuộn trong vùng riêng.
- Rút ngắn nội dung chat; giữ thông tin về AI, lưu dữ liệu và consent. Thêm trạng thái tải trang bằng chữ, giữ lỗi/thành công/pending của form hiện có.
- Focus rõ, nhấn nút có phản hồi nhẹ; reduced motion tắt chuyển động. Không thêm dependency, global store, widget hoặc bước checkout.

## Ma trận và nghiệm thu

| Phần | Trạng thái cần kiểm |
| --- | --- |
| Home/shop | 375/1440px, tìm/lọc, ảnh/giá, thêm giỏ, hết hàng, dialog/Escape |
| Giỏ/checkout/tracking | rỗng/có hàng, đổi số lượng, tạo đơn fixture, QR, trạng thái thanh toán |
| Admin | dashboard/catalog/đơn, menu mobile, tab và phím mũi tên, form giữ giá trị, tiền/kho fixture |
| Chat/chính sách | chữ dễ đọc, consent, pending/fallback, lịch sử riêng, không tràn ngang |
| Chung | lint, typecheck, unit/SQL, build; hồi quy local có cleanup, không cookie admin thật |

Ảnh kiểm tra trong `output/playwright/` (gitignored). Dữ liệu fixture có nhãn kiểm thử, không dùng làm hàng thật. Ảnh/giá/nội dung do shop nhập không được tự thay thế khi sửa giao diện. Chưa kiểm trên điện thoại vật lý, chưa nghiệm thu AI thật và chưa triển khai HP.

Kết quả: 63 SQL/unit tests đạt; `npm run test:m7-local` đạt toàn bộ M1–M7 và storefront, gồm mua nhanh/full, cọc/QR, ghi tiền, kho, form giữ nội dung, quyền riêng tư và cleanup. Đã xem ảnh Chromium 375px/1440px, kiểm tra không tràn ngang trên các màn hình chính, bốn mục công việc nằm trọn màn hình mobile và mục quản lý cuối nhận focus/được cuộn vào view. Đã kiểm ảnh portfolio thực sau khi cuộn để kích hoạt lazy loading. Thời gian chờ assertion trình duyệt local là 15 giây cho route/Server Action; không thêm sleep, bỏ assertion nghiệp vụ hoặc retry tự gửi thanh toán. Gemini/Telegram được tắt trong fixture rồi khôi phục nguyên cấu hình bằng runner sẵn có.

Nguồn kiểm tra tương tác: [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md), đối chiếu theo brief; không áp dụng máy móc các quy tắc mâu thuẫn tiếng Việt hoặc yêu cầu không thêm bước.
