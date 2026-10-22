-- MOBIUS: thêm 9 trường phân cấp bán hàng cho điểm bán (dùng cho bộ lọc và "Tô màu theo" của Bố trận điểm bán):
-- Kênh, Miền, Vùng, Khu vực, Tỉnh, NPP, ĐHKD, Tuyến, Tên NVBH. Tất cả là chữ, không bắt buộc, tối đa 200 ký tự.

alter table public.trade_stores add column if not exists channel text check (channel is null or length(channel) <= 200);
alter table public.trade_stores add column if not exists region text check (region is null or length(region) <= 200);
alter table public.trade_stores add column if not exists area text check (area is null or length(area) <= 200);
alter table public.trade_stores add column if not exists zone text check (zone is null or length(zone) <= 200);
alter table public.trade_stores add column if not exists province text check (province is null or length(province) <= 200);
alter table public.trade_stores add column if not exists distributor text check (distributor is null or length(distributor) <= 200);
alter table public.trade_stores add column if not exists dhkd text check (dhkd is null or length(dhkd) <= 200);
alter table public.trade_stores add column if not exists route text check (route is null or length(route) <= 200);
alter table public.trade_stores add column if not exists salesman text check (salesman is null or length(salesman) <= 200);

-- Đọc danh sách: trả thêm 9 trường (đổi kiểu trả về nên phải xóa rồi tạo lại)
drop function if exists public.app_list_trade_stores();
create function public.app_list_trade_stores()
returns table(id uuid, store_code text, name text, address text, lat double precision, lng double precision,
              revenue_current numeric, revenue_6m numeric, avg_6m numeric, orders_per_month numeric,
              top_skus text, cabinet_count integer, monthly jsonb,
              channel text, region text, area text, zone text, province text, distributor text, dhkd text,
              route text, salesman text, uploaded_at timestamptz)
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
           s.avg_6m, s.orders_per_month, s.top_skus, s.cabinet_count, s.monthly,
           s.channel, s.region, s.area, s.zone, s.province, s.distributor, s.dhkd, s.route, s.salesman,
           s.uploaded_at
    from public.trade_stores s
    where s.live
    order by s.id;
end
$$;
revoke execute on function public.app_list_trade_stores() from public, anon;
grant execute on function public.app_list_trade_stores() to authenticated;

-- Thêm một đợt dòng vào vùng chờ: nhận thêm 9 trường
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
     cabinet_count, monthly, channel, region, area, zone, province, distributor, dhkd, route, salesman, live, batch)
  select nullif(btrim(r.store_code), ''), btrim(r.name), nullif(btrim(r.address), ''), r.lat, r.lng,
         r.revenue_current, r.revenue_6m, r.avg_6m, r.orders_per_month, nullif(btrim(r.top_skus), ''),
         r.cabinet_count, r.monthly,
         nullif(btrim(r.channel), ''), nullif(btrim(r.region), ''), nullif(btrim(r.area), ''),
         nullif(btrim(r.zone), ''), nullif(btrim(r.province), ''), nullif(btrim(r.distributor), ''),
         nullif(btrim(r.dhkd), ''), nullif(btrim(r.route), ''), nullif(btrim(r.salesman), ''),
         false, p_batch
  from jsonb_to_recordset(p_rows) as r(
    store_code text, name text, address text, lat double precision, lng double precision,
    revenue_current numeric, revenue_6m numeric, avg_6m numeric, orders_per_month numeric, top_skus text,
    cabinet_count integer, monthly jsonb,
    channel text, region text, area text, zone text, province text, distributor text, dhkd text,
    route text, salesman text);
  get diagnostics v_count = row_count;
  return v_count;
end
$$;
