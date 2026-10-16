-- Banner trang chủ MOBIUS: 5 vị trí (slot 1 đến 5), admin đăng ảnh, nhân viên đã đăng nhập xem.

create table if not exists public.banners (
  slot smallint primary key check (slot between 1 and 5),
  image_path text not null,
  title text check (title is null or length(title) <= 120),
  subtitle text check (subtitle is null or length(subtitle) <= 200),
  link_url text check (link_url is null or (length(link_url) <= 500 and link_url ~ '^(https?://|/)')),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.banners enable row level security;

create policy banners_select on public.banners
  for select to authenticated using (true);

create policy banners_admin_insert on public.banners
  for insert to authenticated with check ((select public.is_admin()));
create policy banners_admin_update on public.banners
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy banners_admin_delete on public.banners
  for delete to authenticated using ((select public.is_admin()));

-- Kho ảnh banner: đọc công khai (ảnh hiển thị trực tiếp), chỉ admin được thêm, sửa, xóa
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banners', 'banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy banners_obj_select on storage.objects
  for select using (bucket_id = 'banners');
create policy banners_obj_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'banners' and (select public.is_admin()));
create policy banners_obj_update on storage.objects
  for update to authenticated using (bucket_id = 'banners' and (select public.is_admin()));
create policy banners_obj_delete on storage.objects
  for delete to authenticated using (bucket_id = 'banners' and (select public.is_admin()));
