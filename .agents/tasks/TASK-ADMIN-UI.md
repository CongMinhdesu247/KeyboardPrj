# Task: TASK-ADMIN-UI

- **Owner:** Gemini Pro (Coordinator / Frontend UI)
- **Reviewer:** Codex Plus (`-Mode Review`)
- **Plan:** `.agents/plans/remove-pwa-and-simplify-admin-ui.md`
- **Status:** DONE
- **Review:** APPROVED

## Mục tiêu
1. Xóa ô "Cài ứng dụng" ở cuối trang (`src/app/layout.tsx`, `src/components/pwa-install.tsx`, CSS `.install-*`).
2. Tinh gọn và nâng cấp thiết kế khu vực quản trị `/admin/**` cho đơn giản, dễ quan sát, ít rối thông tin nhưng giữ nguyên đầy đủ tính năng nghiệp vụ và tương thích kiểm thử.

## Owned Files
- `src/app/layout.tsx`
- `src/components/pwa-install.tsx` (delete)
- `src/app/buyer.css`
- `src/app/globals.css`
- `src/components/admin-navigation.tsx`
- `src/app/admin/page.tsx`
- `src/components/account-kpis.tsx`
- `src/components/account-growth.tsx`
- `src/app/admin/orders/page.tsx`
- `src/app/admin/catalog/page.tsx`

## Acceptance Criteria
1. Footer không còn nút "Cài ứng dụng"; không còn import/file/CSS chết của `PwaInstall`.
2. Sidebar admin chỉ còn 2 nhóm chính gọn gàng (`Công việc` 4 mục + `Cửa hàng` 4 mục) và 1 mục thu gọn `<details>` `Hệ thống` (4 mục ít dùng); tự mở khi đang ở route trong nhóm đó; bỏ mục trùng `Thông báo cửa hàng`.
3. Trang `/admin` đưa đơn hàng & việc cần xử lý lên đầu; bỏ hộp cảnh báo thừa; chuyển KPI & biểu đồ tài khoản xuống dưới với giao diện gọn gàng hơn.
4. Trang `/admin/orders` và `/admin/catalog` bỏ dòng chữ mô tả rườm rà, nâng cấp khoảng cách và độ rõ thị giác trên 375px / 768px / 1440px.
5. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass không lỗi.
