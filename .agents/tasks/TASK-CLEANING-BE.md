# TASK-CLEANING-BE — Thêm nhóm dịch vụ "Vệ sinh phím" (`cleaning`)

## Owner & Model
- **Owner:** Codex Plus (`-Mode Implement`)
- **Reviewer đối trọng:** `reviewer-critic` (Gemini Pro)

## Mục tiêu
Thêm nhóm dịch vụ mới với slug `cleaning` (**Vệ sinh phím**) để:
1. Hiển thị thành thẻ thứ 5 trong phần **Dịch vụ mod bàn phím** trên trang chủ và trang `/estimate`.
2. Cho phép Admin chọn nhóm **Vệ sinh phím** trong `/admin/catalog` để tự thêm gói dịch vụ và giá sau này (không tạo item mẫu cứng trong DB migration).

## Phạm vi file được phép sửa (chỉ sửa các file này)
1. `supabase/migrations/20261123004500_add_cleaning_category.sql` (tạo mới)
2. `src/lib/domain.ts`
3. `src/lib/estimate.ts`
4. `src/lib/catalog.ts`
5. `src/lib/catalog-input.ts`
6. `src/components/catalog-admin.tsx`
7. `tests/catalog.test.ts`

## Chi tiết kỹ thuật & Ràng buộc
1. **Migration SQL (`supabase/migrations/20261123004500_add_cleaning_category.sql`):**
   - Tham khảo mẫu ở `supabase/migrations/20261119140754_storefront_checkout.sql` (dòng 1-4):
     - `alter table public.service_categories drop constraint service_categories_slug_check;`
     - `alter table public.service_categories add constraint service_categories_slug_check check(slug in ('lube','stab','keycap','sound_mod','cleaning','keyboard','switch','accessory'));`
     - `insert into public.service_categories(slug,title,description,position) values ('cleaning','Vệ sinh phím','Làm sạch bụi bẩn, vệ sinh keycap, case và bảo dưỡng tổng thể.',7) on conflict (slug) do nothing;`
   - Tuyệt đối không reset DB, không sửa RLS/policy hay chạm bảng khác.
2. **`src/lib/domain.ts`:**
   - Thêm `| "cleaning"` vào `CategorySlug`.
3. **`src/lib/estimate.ts`:**
   - Thêm `"cleaning"` vào `modCategorySlugs`: `["lube", "stab", "keycap", "sound_mod", "cleaning"]`.
4. **`src/lib/catalog.ts`:**
   - Thêm vào mảng `categories`:
     ```ts
     {
       slug: "cleaning",
       title: "Vệ sinh phím",
       description: "Làm sạch bụi bẩn, vệ sinh keycap, case và bảo dưỡng tổng thể.",
       mark: "sound",
     },
     ```
   - Không cần thêm item giả vào `catalog` nếu không cần thiết (khi chưa có mục công khai, dialog bảng giá ở `/estimate` đã có trạng thái trống hướng dẫn nhắn Zalo rất chuẩn).
5. **`src/lib/catalog-input.ts`:**
   - Thêm `"cleaning"` vào danh sách `category` hợp lệ trong `parseCatalogInput` (dòng 49-57).
   - Đảm bảo `lubePackage` vẫn chỉ cho phép khi `category === "lube"`.
6. **`src/components/catalog-admin.tsx`:**
   - Thêm `["cleaning", "Vệ sinh phím"]` vào mảng `labels` (dòng 21-29) để admin có thể chọn nhóm **Vệ sinh phím** khi tạo/sửa mục trong `/admin/catalog`.
7. **`tests/catalog.test.ts`:**
   - Bổ sung unit test xác nhận:
     - `parseCatalogInput` chấp nhận `category: "cleaning"`, `type: "service"`, `unit: "gói"`, `price: "150000"`, `active: "on"`.
     - `parseCatalogInput` từ chối gán `lubePackage` cho `category: "cleaning"`.
     - `modCategorySlugs` chứa `"cleaning"`.

## Acceptance Criteria
- Migration SQL áp dụng sạch trên test DB (`npm test` chạy qua `createTestDatabase()` áp dụng toàn bộ migration).
- `CategorySlug`, `categories`, `modCategorySlugs`, `parseCatalogInput`, `catalog-admin.tsx` đồng bộ slug `"cleaning"`.
- Không sửa bất kỳ file nào ngoài danh sách trên.
- Báo cáo rõ file đã sửa và tóm tắt thay đổi.
