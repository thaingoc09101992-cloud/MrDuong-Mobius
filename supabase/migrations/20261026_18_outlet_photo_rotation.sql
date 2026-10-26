-- Xoay ảnh điểm bán: lưu góc xoay (độ, theo chiều kim đồng hồ) vào dòng điểm bán thay vì ghi đè file ảnh.
-- Admin xoay được mọi ảnh, nhân viên chỉ xoay ảnh của chính mình.

alter table public.outlets add column if not exists photo_rotation smallint not null default 0;
alter table public.outlets drop constraint if exists outlets_photo_rotation_check;
alter table public.outlets add constraint outlets_photo_rotation_check check (photo_rotation in (0, 90, 180, 270));

-- Kiểu trả về đổi (thêm cột photo_rotation) nên phải xóa rồi tạo lại
drop function if exists public.app_list_outlets();
create function public.app_list_outlets()
returns table(id uuid, employee_code text, employee_name text, name text, address text, channel text,
              lat double precision, lng double precision, accuracy_m real, photo_path text,
              captured_at timestamp with time zone, photo_rotation smallint)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v public.employees;
begin
  if public.is_admin() then
    return query
      select o.id, o.employee_code, e.full_name, o.name, o.address, o.channel,
             o.lat, o.lng, o.accuracy_m, o.photo_path, o.captured_at, o.photo_rotation
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
           o.lat, o.lng, o.accuracy_m, o.photo_path, o.captured_at, o.photo_rotation
    from public.outlets o
    join public.employees e on e.code = o.employee_code
    where o.employee_code = v.code
       or (v.role = 'manager' and e.manager_code = v.code)
    order by o.captured_at desc
    limit 5000;
end
$$;
revoke execute on function public.app_list_outlets() from public, anon;
grant execute on function public.app_list_outlets() to authenticated;

create or replace function public.app_rotate_outlet_photo(p_outlet uuid, p_rotation smallint)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v public.employees;
begin
  if p_rotation is null or p_rotation not in (0, 90, 180, 270) then
    raise exception 'Goc xoay khong hop le';
  end if;
  if public.is_admin() then
    update public.outlets set photo_rotation = p_rotation where id = p_outlet;
  else
    select * into v from public._current_employee();
    if v.code is null or v.must_change_password or not ('dinh-vi-diem-ban' = any(v.modules)) then
      raise exception 'Tai khoan khong duoc phep su dung';
    end if;
    update public.outlets set photo_rotation = p_rotation where id = p_outlet and employee_code = v.code;
  end if;
  if not found then
    raise exception 'Khong tim thay diem ban hoac khong co quyen';
  end if;
end
$$;
revoke execute on function public.app_rotate_outlet_photo(uuid, smallint) from public, anon;
grant execute on function public.app_rotate_outlet_photo(uuid, smallint) to authenticated;