-- Hồ sơ nhân viên đăng nhập: trả thêm số điện thoại, ngày bắt đầu và tên quản lý trực tiếp
-- để trang "Thông tin nhân viên" hiển thị đầy đủ (nhân viên chỉ đọc được hồ sơ của chính mình).
create or replace function public.app_me()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.employees;
begin
  select * into v from public._current_employee();
  if v.code is null then
    raise exception 'Tai khoan khong duoc phep su dung';
  end if;
  return json_build_object(
    'code', v.code, 'full_name', v.full_name, 'role', v.role,
    'email', v.email, 'must_change_password', v.must_change_password,
    'modules', to_json(v.modules), 'manager_code', v.manager_code,
    'phone', v.phone, 'active_at', v.active_at,
    'manager_name', (select m.full_name from public.employees m where m.code = v.manager_code)
  );
end
$$;
