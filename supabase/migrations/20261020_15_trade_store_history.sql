-- MOBIUS: popup điểm bán có hai tab (Profile, Lịch sử). Thêm "số tủ" và doanh thu 12 tháng gần nhất cho từng điểm bán.
-- monthly: mảng JSON tối đa 12 phần tử, mới nhất trước, mỗi phần tử {"m": "YYYY-MM" hoặc null, "v": doanh thu}.

alter table public.trade_stores add column if not exists cabinet_count integer
  check (cabinet_count is null or cabinet_count >= 0);
alter table public.trade_stores add column if not exists monthly jsonb
  check (monthly is null or (jsonb_typeof(monthly) = 'array' and jsonb_array_length(monthly) <= 12));

-- Đọc danh sách: trả thêm cabinet_count và monthly (đổi kiểu trả về nên phải xóa rồi tạo lại)
drop function if exists public.app_list_trade_stores();
create function public.app_list_trade_stores()
returns table(id uuid, store_code text, name text, address text, lat double precision, lng double precision,
              revenue_current numeric, revenue_6m numeric, avg_6m numeric, orders_per_month numeric,
              top_skus text, cabinet_count integer, monthly jsonb, uploaded_at timestamptz)
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
           s.avg_6m, s.orders_per_month, s.top_skus, s.cabinet_count, s.monthly, s.uploaded_at
    from public.trade_stores s
    where s.live
    order by s.id;
end
$$;
revoke execute on function public.app_list_trade_stores() from public, anon;
grant execute on function public.app_list_trade_stores() to authenticated;

-- Thêm một đợt dòng vào vùng chờ: nhận thêm cabinet_count và monthly
create or replace function public.app_append_trade_stores(p_batch uuid, p_rows jsonb)
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
  if p_batch is null or p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Du lieu khong hop le';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'Moi dot toi da 5000 diem ban';
  end if;
  if (select count(*) from public.trade_stores where batch = p_batch and not live) + jsonb_array_length(p_rows) > 100000 then
    raise exception 'Toi da 100000 diem ban moi lan tai';
  end if;

  insert into public.trade_stores
    (store_code, name, address, lat, lng, revenue_current, revenue_6m, avg_6m, orders_per_month, top_skus,
     cabinet_count, monthly, live, batch)
  select nullif(btrim(r.store_code), ''), btrim(r.name), nullif(btrim(r.address), ''), r.lat, r.lng,
         r.revenue_current, r.revenue_6m, r.avg_6m, r.orders_per_month, nullif(btrim(r.top_skus), ''),
         r.cabinet_count, r.monthly, false, p_batch
  from jsonb_to_recordset(p_rows) as r(
    store_code text, name text, address text, lat double precision, lng double precision,
    revenue_current numeric, revenue_6m numeric, avg_6m numeric, orders_per_month numeric, top_skus text,
    cabinet_count integer, monthly jsonb);
  get diagnostics v_count = row_count;
  return v_count;
end
$$;