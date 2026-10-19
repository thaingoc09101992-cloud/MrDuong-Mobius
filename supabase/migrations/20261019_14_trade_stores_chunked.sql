-- MOBIUS: "Bố trận điểm bán" nhận danh sách lớn (hàng chục nghìn điểm bán).
-- File được tải lên theo từng đợt nhỏ vào vùng chờ (live = false), tải xong mới đổi sang danh sách chính thức
-- trong một giao dịch, nên danh sách đang dùng không bị gián đoạn và không bị mất nếu tải dở dang.

alter table public.trade_stores add column if not exists live boolean not null default true;
alter table public.trade_stores add column if not exists batch uuid;
create index if not exists trade_stores_batch_idx on public.trade_stores (batch);

-- Đọc danh sách (chỉ các điểm đang dùng). Không giới hạn dòng trong hàm: phía ứng dụng đọc theo từng trang.
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
    where s.live
    order by s.id;
end
$$;

-- Bắt đầu một lần tải: dọn các đợt tải dở dang trước đó
create or replace function public.app_begin_trade_upload()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Chi quan tri vien duoc tai danh sach';
  end if;
  delete from public.trade_stores where not live;
end
$$;

-- Thêm một đợt dòng vào vùng chờ
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
    (store_code, name, address, lat, lng, revenue_current, revenue_6m, avg_6m, orders_per_month, top_skus, live, batch)
  select nullif(btrim(r.store_code), ''), btrim(r.name), nullif(btrim(r.address), ''), r.lat, r.lng,
         r.revenue_current, r.revenue_6m, r.avg_6m, r.orders_per_month, nullif(btrim(r.top_skus), ''), false, p_batch
  from jsonb_to_recordset(p_rows) as r(
    store_code text, name text, address text, lat double precision, lng double precision,
    revenue_current numeric, revenue_6m numeric, avg_6m numeric, orders_per_month numeric, top_skus text);
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Hoàn tất: thay toàn bộ danh sách cũ bằng đợt vừa tải, kiểm tra đủ số dòng dự kiến
create or replace function public.app_finish_trade_upload(p_batch uuid, p_expected integer)
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
  select count(*) into v_count from public.trade_stores where batch = p_batch and not live;
  if v_count = 0 or v_count <> p_expected then
    raise exception 'Du lieu tai len khong day du';
  end if;
  delete from public.trade_stores where live;
  update public.trade_stores set live = true, uploaded_at = now() where batch = p_batch;
  return v_count;
end
$$;

-- Hàm thay thế một lần cũ không còn dùng
drop function if exists public.app_replace_trade_stores(jsonb);

revoke execute on function public.app_list_trade_stores() from public, anon;
revoke execute on function public.app_begin_trade_upload() from public, anon;
revoke execute on function public.app_append_trade_stores(uuid, jsonb) from public, anon;
revoke execute on function public.app_finish_trade_upload(uuid, integer) from public, anon;
grant execute on function public.app_list_trade_stores() to authenticated;
grant execute on function public.app_begin_trade_upload() to authenticated;
grant execute on function public.app_append_trade_stores(uuid, jsonb) to authenticated;
grant execute on function public.app_finish_trade_upload(uuid, integer) to authenticated;
