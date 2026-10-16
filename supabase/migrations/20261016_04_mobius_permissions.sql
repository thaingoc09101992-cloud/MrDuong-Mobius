-- MOBIUS: phân quyền dùng chung cho cả nền tảng.
--  1. Quyền sử dụng từng chức năng (cột employees.modules).
--  2. Quản lý trực tiếp (cột employees.manager_code): quản lý chỉ xem dữ liệu của chính mình
--     và của nhân viên báo cáo trực tiếp cho mình.
-- Chức năng hiện có: 'dinh-vi-diem-ban' (Định vị điểm bán).

alter table public.employees
  add column if not exists modules text[] not null default array['dinh-vi-diem-ban']::text[],
  add column if not exists manager_code text references public.employees(code) on update cascade on delete set null;

alter table public.employees
  add constraint employees_not_own_manager check (manager_code is null or manager_code <> code);

-- Khi thêm chức năng mới: đổi danh sách bên dưới
alter table public.employees
  add constraint employees_modules_known check (modules <@ array['dinh-vi-diem-ban']::text[]);

create index if not exists employees_manager_code_idx on public.employees (manager_code);

-- Quản lý trực tiếp phải có vai trò Quản lý; không hạ vai trò người đang quản lý người khác
create or replace function public.employees_check_manager()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.manager_code is not null then
    if not exists (select 1 from public.employees m where m.code = new.manager_code and m.role = 'manager') then
      raise exception 'Quản lý trực tiếp phải là nhân viên có vai trò Quản lý.';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.role = 'manager' and new.role <> 'manager' then
    if exists (select 1 from public.employees r where r.manager_code = new.code) then
      raise exception 'Nhân viên này đang là quản lý trực tiếp của người khác. Hãy chuyển người đó sang quản lý khác trước.';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists employees_check_manager_trg on public.employees;
create trigger employees_check_manager_trg
  before insert or update on public.employees
  for each row execute function public.employees_check_manager();

-- app_me: trả thêm danh sách chức năng và quản lý trực tiếp
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
    'modules', to_json(v.modules), 'manager_code', v.manager_code
  );
end
$$;

-- Định vị điểm bán: cần quyền chức năng; nhân viên xem của mình, quản lý xem của mình và cấp dưới trực tiếp
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

create or replace function public.app_save_outlet(
  p_name text, p_address text, p_channel text,
  p_lat double precision, p_lng double precision, p_accuracy real, p_photo_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.employees;
  v_id uuid;
begin
  select * into v from public._current_employee();
  if v.code is null or v.must_change_password or not ('dinh-vi-diem-ban' = any(v.modules)) then
    raise exception 'Tai khoan khong duoc phep su dung';
  end if;
  if p_accuracy is null or p_accuracy > 50 then
    raise exception 'Do chinh xac GPS vuot qua 50m';
  end if;
  if p_photo_path is null or p_photo_path !~ ('^' || v.code || '/[0-9a-fA-F-]{36}\.jpg$') then
    raise exception 'Duong dan anh khong hop le';
  end if;
  insert into public.outlets (employee_code, name, address, channel, lat, lng, accuracy_m, photo_path)
  values (v.code, btrim(p_name), nullif(btrim(p_address), ''), nullif(btrim(p_channel), ''),
          p_lat, p_lng, p_accuracy, p_photo_path)
  returning id into v_id;
  return v_id;
end
$$;

-- Chỉ người có quyền Định vị điểm bán mới upload ảnh vào thư mục của mình
create or replace function public.my_employee_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select e.code from public.employees e
  where e.user_id = (select auth.uid()) and e.is_active and e.email is not null
    and 'dinh-vi-diem-ban' = any(e.modules)
  limit 1
$$;
