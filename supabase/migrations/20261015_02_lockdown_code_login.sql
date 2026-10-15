-- Bước 2/2: KHÓA HẲN đăng nhập bằng mã nhân viên.
-- Chỉ chạy SAU KHI bản giao diện mới (đăng nhập email) đã lên Vercel và đăng nhập thử thành công.
-- Sau bước này: không còn tự tạo nhân viên bằng mã, không còn upload ảnh ẩn danh.

drop function if exists public.app_login(text);
drop function if exists public.app_list_outlets(text);
drop function if exists public.app_save_outlet(text, text, text, text, double precision, double precision, real, text);

drop policy if exists outlet_photos_insert on storage.objects;
