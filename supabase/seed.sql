-- Dữ liệu nền không chứa khách hàng/admin, không tự cấp quyền khi reset.
insert into public.service_categories(slug, title, description, position) values
  ('lube', 'Lube & switch', 'Lube theo số switch hoặc nhóm layout.', 0),
  ('stab', 'Stabilizer', 'Cân chỉnh stabilizer.', 1),
  ('keycap', 'Keycap & đặt tìm', 'Keycap có sẵn và tìm mẫu theo yêu cầu.', 2),
  ('sound_mod', 'Tiêu âm & mod', 'Tinh chỉnh vật liệu tiêu âm.', 3)
on conflict(slug) do nothing;
