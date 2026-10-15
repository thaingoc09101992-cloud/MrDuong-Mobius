-- Thêm số điện thoại cho nhân viên (không bắt buộc).
-- Định dạng: 9 đến 12 chữ số, có thể bắt đầu bằng dấu +. Ứng dụng tự bỏ khoảng trắng, dấu chấm, gạch ngang.
alter table public.employees add column if not exists phone text;

alter table public.employees
  add constraint employees_phone_format check (phone is null or phone ~ '^\+?[0-9]{9,12}$');
