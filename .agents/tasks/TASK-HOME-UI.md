# TASK-HOME-UI — Đưa Dịch vụ mod lên đầu trang, LED vàng nổi bật cho khối Custom & Cân bằng Portfolio

## Owner & Model
- **Owner:** Gemini Pro (Coordinator)
- **Reviewer đối trọng:** Codex Plus (`-Mode Review`)

## Mục tiêu
1. Chuyển khối **Dịch vụ mod bàn phím** (`home-band-services` / `#services`) lên trên khối **Sản phẩm & dịch vụ** (`home-shopping`) trên trang chủ.
2. Bố cục lưới dịch vụ cân đối cho 5 thẻ (`lube`, `stab`, `keycap`, `sound_mod`, `cleaning`) trên desktop (1440px), tablet và mobile (375px).
3. Nâng cấp khối **Chưa tìm thấy mẫu bạn cần?** với dải LED vàng chuyển động chạy quanh viền và thêm điểm nhấn làm nổi bật thế mạnh custom theo yêu cầu của shop.
4. Sửa lưới **Portfolio** sao cho các thẻ trên cùng hàng có chiều cao bằng nhau và nút **Xem sound test ↗** thẳng hàng ở đáy thẻ.

## Phạm vi file được phép sửa
- `src/components/workshop.tsx`
- `src/components/service-estimator.tsx`
- `src/components/portfolio-gallery.tsx`
- `src/app/buyer.css`
- `src/app/globals.css`

## Acceptance Criteria
- Phần **Dịch vụ mod bàn phím** xuất hiện ngay dưới `.buyer-assurances` và phía trên `.home-shopping`.
- 5 thẻ dịch vụ mod hiển thị đều đẹp ở 1440px (5 cột) và 375px (2 cột, thẻ cuối cân đối), link "Xem bảng giá ↗" thẳng hàng đáy.
- Khối **Chưa tìm thấy mẫu bạn cần?** có hiệu ứng dải LED màu vàng chuyển động quanh viền mượt mà, nổi bật thế mạnh custom, tôn trọng `prefers-reduced-motion: reduce`, tương phản tốt và responsive 375px/1440px.
- Thẻ Portfolio bằng chiều cao nhau trên cùng hàng ở cả trang chủ và `/portfolio`, nút Sound test thẳng hàng đáy.
