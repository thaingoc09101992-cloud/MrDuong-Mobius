-- MOBIUS: bài học dạng liên kết nhúng (OneDrive/SharePoint) bên cạnh bài học PDF lưu ở Supabase Storage.
-- Mỗi bài học có đúng một nguồn: file_path (PDF trong kho) hoặc source_url (liên kết nhúng).

alter table public.lessons alter column file_path drop not null;
alter table public.lessons add column if not exists source_url text;

alter table public.lessons drop constraint if exists lessons_one_source_check;
alter table public.lessons add constraint lessons_one_source_check
  check ((file_path is not null and source_url is null) or (file_path is null and source_url is not null));

-- Chỉ nhận https và các tên miền OneDrive, SharePoint, Office (liên kết rút gọn 1drv.ms không nhúng được)
alter table public.lessons drop constraint if exists lessons_source_url_check;
alter table public.lessons add constraint lessons_source_url_check
  check (source_url is null or (
    length(source_url) <= 1500
    and source_url ~* '^https://(onedrive\.live\.com|[a-z0-9-]+\.sharepoint\.com|[a-z0-9-]+\.officeapps\.live\.com|[a-z0-9-]+\.office\.com)/'
  ));

-- Danh sách bài học: thêm cột source_url (đổi kiểu trả về nên phải xóa rồi tạo lại)
drop function if exists public.app_list_lessons();
create function public.app_list_lessons()
returns table(id uuid, title text, description text, file_path text, file_size bigint, source_url text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'Tai khoan khong duoc phep su dung';
  end if;
  return query
    select l.id, l.title, l.description, l.file_path, l.file_size, l.source_url, l.created_at
    from public.lessons l
    order by l.created_at desc
    limit 500;
end
$$;
revoke execute on function public.app_list_lessons() from public, anon;
grant execute on function public.app_list_lessons() to authenticated;

-- Thêm bài học dạng liên kết (chỉ admin)
create or replace function public.app_add_lesson_link(p_title text, p_description text, p_source_url text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Chi quan tri vien duoc them bai hoc';
  end if;
  insert into public.lessons (title, description, source_url)
  values (btrim(p_title), nullif(btrim(p_description), ''), btrim(p_source_url))
  returning id into v_id;
  return v_id;
exception when check_violation then
  raise exception 'Lien ket khong hop le';
end
$$;
revoke execute on function public.app_add_lesson_link(text, text, text) from public, anon;
grant execute on function public.app_add_lesson_link(text, text, text) to authenticated;