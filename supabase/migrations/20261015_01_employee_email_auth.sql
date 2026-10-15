-- Bước 1/2: THÊM đăng nhập bằng email cho nhân viên (chưa xóa cách cũ, trang đang chạy không bị gián đoạn).
-- Áp dụng cho project Supabase "Thu_Thap_Diem_Ban".

-- 1. Chỉ cho phép email thuộc tên miền công ty
create or replace function public.is_company_email(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_email ~* '^[a-z0-9._%+-]+@(thophat\.vn|kdc\.vn)$'
$$;

-- 2. Cột mới cho nhân viên
alter table public.employees
  add column if not exists email text,
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists active_at timestamptz,
  add column if not exists inactive_at timestamptz,
  add column if not exists must_change_password boolean not null default true;

alter table public.employees
  add constraint employees_email_company check (email is null or public.is_company_email(email));

create unique index if not exists employees_email_key on public.employees (lower(email)) where email is not null;
create unique index if not exists employees_user_id_key on public.employees (user_id) where user_id is not null;

-- Dữ liệu hiện có: ghi nhận mốc thời gian ban đầu
update public.employees set active_at = coalesce(active_at, created_at) where is_active and active_at is null;
update public.employees set inactive_at = coalesce(inactive_at, now()) where not is_active and inactive_at is null;

-- 3. Tự động ghi Ngày Active / Ngày Inactive khi đổi trạng thái, chuẩn hóa email
create or replace function public.employees_track()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is not null then
    new.email := lower(btrim(new.email));
  end if;
  if tg_op = 'INSERT' then
    if new.is_active then
      new.active_at := coalesce(new.active_at, now());
      new.inactive_at := null;
    else
      new.inactive_at := coalesce(new.inactive_at, now());
    end if;
  elsif new.is_active is distinct from old.is_active then
    if new.is_active then
      new.active_at := now();
      new.inactive_at := null;
    else
      new.inactive_at := now();
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists employees_track_trg on public.employees;
create trigger employees_track_trg
  before insert or update on public.employees
  for each row execute function public.employees_track();

-- 4. Hàm nội bộ: nhân viên hiện tại theo tài khoản đăng nhập (chỉ Active và có email)
create or replace function public._current_employee()
returns public.employees
language sql
stable
security definer
set search_path = ''
as $$
  select e.* from public.employees e
  where e.user_id = (select auth.uid()) and e.is_active and e.email is not null
  limit 1
$$;
revoke execute on function public._current_employee() from public, anon, authenticated;

create or replace function public.my_employee_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select e.code from public.employees e
  where e.user_id = (select auth.uid()) and e.is_active and e.email is not null
  limit 1
$$;
revoke execute on function public.my_employee_code() from public, anon;
grant execute on function public.my_employee_code() to authenticated;

-- 5. RPC mới dựa trên tài khoản đăng nhập (không nhận mã từ trình duyệt)
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
    'email', v.email, 'must_change_password', v.must_change_password
  );
end
$$;

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
  if v.code is null or v.must_change_password then
    raise exception 'Tai khoan khong duoc phep su dung';
  end if;
  return query
    select o.id, o.employee_code, e.full_name, o.name, o.address, o.channel,
           o.lat, o.lng, o.accuracy_m, o.photo_path, o.captured_at
    from public.outlets o
    join public.employees e on e.code = o.employee_code
    where v.role = 'manager' or o.employee_code = v.code
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
  if v.code is null or v.must_change_password then
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

create or replace function public.app_complete_password_change()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.employees
     set must_change_password = false
   where user_id = (select auth.uid()) and is_active and email is not null;
  if not found then
    raise exception 'Tai khoan khong duoc phep su dung';
  end if;
end
$$;

revoke execute on function public.app_me() from public, anon;
revoke execute on function public.app_list_outlets() from public, anon;
revoke execute on function public.app_save_outlet(text, text, text, double precision, double precision, real, text) from public, anon;
revoke execute on function public.app_complete_password_change() from public, anon;
grant execute on function public.app_me() to authenticated;
grant execute on function public.app_list_outlets() to authenticated;
grant execute on function public.app_save_outlet(text, text, text, double precision, double precision, real, text) to authenticated;
grant execute on function public.app_complete_password_change() to authenticated;

-- 6. Chỉ tài khoản đăng nhập (Active, có email) mới upload ảnh vào thư mục của mình
create policy outlet_photos_insert_auth on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'outlet-photos'
    and (storage.foldername(name))[1] = public.my_employee_code()
  );
