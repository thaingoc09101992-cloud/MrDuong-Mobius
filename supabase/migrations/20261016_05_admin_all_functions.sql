-- Quản trị viên (bảng admins) dùng được mọi chức năng của MOBIUS:
-- trong "Định vị điểm bán" admin xem toàn bộ điểm bán của hệ thống, không phụ thuộc phân quyền nhân viên.
-- (Chụp ảnh và lưu điểm bán vẫn cần hồ sơ nhân viên vì điểm bán phải gắn với một nhân viên.)

create or replace function public.app_list_outlets()
returns table(id uuid, employee_code text, employee_name text, name text, address text, channel text,
              lat double precision, lng double precision, accuracy_m real, photo_path text,
              captured_at timestamp with time zone)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.employees;
begin
  if public.is_admin() then
    return query
      select o.id, o.employee_code, e.full_name, o.name, o.address, o.channel,
             o.lat, o.lng, o.accuracy_m, o.photo_path, o.captured_at
      from public.outlets o
      join public.employees e on e.code = o.employee_code
      order by o.captured_at desc
      limit 5000;
    return;
  end if;

  select * into v from public._current_employee();
  if v.code is null or v.must_change_password or not ('dinh-vi-diem-ban' = any(v.modules)) then
    raise exception 'Tai khoan khong duoc phep su dung';
  end if;
  return query
    select o.id, o.employee_code, e.full_name, o.name, o.address, o.channel,
           o.lat, o.lng, o.accuracy_m, o.photo_path, o.captured_at
    from public.outlets o
    join public.employees e on e.code = o.employee_code
    where o.employee_code = v.code
       or (v.role = 'manager' and e.manager_code = v.code)
    order by o.captured_at desc
    limit 5000;
end
$$;
