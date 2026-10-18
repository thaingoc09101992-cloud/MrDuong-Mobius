-- MOBIUS: chức năng "Bố trận điểm bán" (bo-tran-diem-ban).
-- Admin upload danh sách điểm bán từ Excel (thay thế toàn bộ dữ liệu cũ); nhân viên được cấp quyền chức năng chỉ xem.
-- Bảng không có chính sách RLS và bị thu hồi quyền trực tiếp: mọi truy cập đi qua hai hàm bên dưới.

-- 1. Thêm chức năng mới vào danh sách chức năng được phép
alter table public.employees drop constraint if exists employees_modules_known;
alter table public.employees
  add constraint employees_modules_known
  check (modules <@ array['dinh-vi-diem-ban', 'bo-tran-diem-ban']::text[]);

-- 2. Bảng dữ liệu điểm bán
create table if not exists public.trade_stores (
  id uuid primary key default gen_random_uuid(),
  store_code text check (store_code is null or length(store_code) <= 50),
  name text not null check (length(btrim(name)) between 1 and 200),
  address text check (address is null or length(address) <= 500),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  revenue_current numeric check (revenue_current is null or revenue_current >= 0),
  revenue_6m numeric check (revenue_6m is null or revenue_6m >= 0),
  avg_6m numeric check (avg_6m is null or avg_6m >= 0),
  orders_per_month numeric check (orders_per_month is null or orders_per_month >= 0),
  top_skus text check (top_skus is null or length(top_skus) <= 500),
  uploaded_at timestamptz not null default now()
);

alter table public.trade_stores enable row level security;
revoke all on public.trade_stores from anon, authenticated;

-- 3. Đọc danh sách: admin hoặc nhân viên Active, đã đổi mật khẩu và có quyền chức năng
create or replace function public.app_list_trade_stores()
returns table(id uuid, store_code text, name text, address text, lat double precision, lng double precision,
              revenue_current numeric, revenue_6m numeric, avg_6m numeric, orders_per_month numeric,
              top_skus text, uploaded_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.employees;
begin
  if not public.is_admin() then
    select * into v from public._current_employee();
    if v.code is null or v.must_change_password or not ('bo-tran-diem-ban' = any(v.modules)) then
      raise exception 'Tai khoan khong duoc phep su dung';
    end if;
  end if;
  return query
    select s.id, s.store_code, s.name, s.address, s.lat, s.lng, s.revenue_current, s.revenue_6m,
           s.avg_6m, s.orders_per_month, s.top_skus, s.uploaded_at
    from public.trade_stores s
    order by s.name
    limit 20000;
end
$$;

-- 4. Thay thế toàn bộ danh sách (chỉ admin). p_rows là mảng JSON; thao tác trong một giao dịch duy nhất.
create or replace function public.app_replace_trade_stores(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Chi quan tri vien duoc tai danh sach';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Du lieu khong hop le';
  end if;
  if jsonb_array_length(p_rows) = 0 then
    raise exception 'Danh sach trong';
  end if;
  if jsonb_array_length(p_rows) > 10000 then
    raise exception 'Toi da 10000 diem ban moi lan tai';
  end if;

  delete from public.trade_stores where true;
  insert into public.trade_stores
    (store_code, name, address, lat, lng, revenue_current, revenue_6m, avg_6m, orders_per_month, top_skus)
  select nullif(btrim(r.store_code), ''), btrim(r.name), nullif(btrim(r.address), ''), r.lat, r.lng,
         r.revenue_current, r.revenue_6m, r.avg_6m, r.orders_per_month, nullif(btrim(r.top_skus), '')
  from jsonb_to_recordset(p_rows) as r(
    store_code text, name text, address text, lat double precision, lng double precision,
    revenue_current numeric, revenue_6m numeric, avg_6m numeric, orders_per_month numeric, top_skus text);
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke execute on function public.app_list_trade_stores() from public, anon;
revoke execute on function public.app_replace_trade_stores(jsonb) from public, anon;
grant execute on function public.app_list_trade_stores() to authenticated;
grant execute on function public.app_replace_trade_stores(jsonb) to authenticated;