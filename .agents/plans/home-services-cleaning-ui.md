# Plan: Thêm nhóm Vệ sinh phím & Nâng cấp giao diện Trang chủ / Portfolio

## Mục tiêu
1. Thêm nhóm dịch vụ mới `cleaning` (**Vệ sinh phím**) vào hệ thống catalog/estimate/admin và DB migration để hiển thị thành thẻ thứ 5 trong **Dịch vụ mod bàn phím** và cho phép Admin tự tạo/chỉnh sửa gói dịch vụ & giá trong `/admin/catalog`.
2. Đưa khối **Dịch vụ mod bàn phím** lên phía trên khối **Sản phẩm & dịch vụ** trên trang chủ để phản ánh trọng tâm dịch vụ & custom phím của shop.
3. Nâng cấp khối **Chưa tìm thấy mẫu bạn cần?** với dải LED vàng chuyển động chạy quanh viền và bố cục nổi bật cho thế mạnh custom theo yêu cầu.
4. Sửa lưới **Portfolio** sao cho mọi thẻ trên cùng hàng có chiều cao bằng nhau và nút **Xem sound test ↗** thẳng hàng ở đáy thẻ.

## Phân chia Task & File Ownership (không chồng chéo)

### 1. `TASK-CLEANING-BE` (Codex Plus — `-Mode Implement`, Reviewer: `reviewer-critic` Gemini Pro)
- **Files:**
  - `supabase/migrations/20261123004500_add_cleaning_category.sql` (new)
  - `src/lib/domain.ts`
  - `src/lib/estimate.ts`
  - `src/lib/catalog.ts`
  - `src/lib/catalog-input.ts`
  - `src/components/catalog-admin.tsx`
  - `tests/catalog.test.ts`
- **Lưu ý schema:** Cập nhật constraint `service_categories_slug_check` để thêm `'cleaning'` và chèn dòng `service_categories` (`on conflict (slug) do nothing`) không đụng dữ liệu cũ. Không reset DB.

### 2. `TASK-HOME-UI` (Gemini Pro — Coordinator / `builder-frontend`, Reviewer: Codex Plus `-Mode Review`)
- **Files:**
  - `src/components/workshop.tsx`
  - `src/components/service-estimator.tsx`
  - `src/components/portfolio-gallery.tsx`
  - `src/app/buyer.css`
  - `src/app/globals.css`
- **Lưu ý UI/Accessibility:** Tiếng Việt chuẩn, responsive 375px & 1440px, tôn trọng `prefers-reduced-motion: reduce`, tương phản rõ, giữ keyboard/focus.

## Kiểm chứng & Nghiệm thu
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- Phản biện chéo: Gemini Pro review `TASK-CLEANING-BE`, Codex Plus review `TASK-HOME-UI`.
