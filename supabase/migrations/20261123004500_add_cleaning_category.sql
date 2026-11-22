alter table public.service_categories drop constraint service_categories_slug_check;
alter table public.service_categories add constraint service_categories_slug_check check(slug in ('lube','stab','keycap','sound_mod','cleaning','keyboard','switch','accessory'));
insert into public.service_categories(slug,title,description,position) values
 ('cleaning','Vệ sinh phím','Làm sạch bụi bẩn, vệ sinh keycap, case và bảo dưỡng tổng thể.',7) on conflict (slug) do nothing;
