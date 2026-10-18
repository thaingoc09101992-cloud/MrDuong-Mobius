-- MOBIUS: "Bài học" (thư viện slide dạng PDF) trong mục Kiến thức.
-- Admin tải file PDF lên; mọi nhân viên đang Active (và admin) xem được. File lưu ở kho riêng tư.
-- Bảng không có chính sách RLS và bị thu hồi quyền trực tiếp: mọi truy cập đi qua các hàm bên dưới.

-- 1. Hàm kiểm tra: admin hoặc nhân viên Active có email
create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.employees e
    where e.user_id = (select auth.uid()) and e.is_active and e.email is not null
  )
$$;
revoke execute on function public.is_active_staff() from public, anon;
grant execute on function public.is_active_staff() to authenticated;

-- 2. Bảng bài học
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (description is null or length(description) <= 1000),
  file_path text not null check (file_path ~ '^[0-9a-f-]{36}\.pdf$'),
  file_size bigint check (file_size is null or file_size >= 0),
  created_at timestamptz not null default now()
);
alter table public.lessons enable row level security;
revoke all on public.lessons from anon, authenticated;

-- 3. Danh sách bài học
create or replace function public.app_list_lessons()
returns table(id uuid, title text, description text, file_path text, file_size bigint, created_at timestamptz)
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
    select l.id, l.title, l.description, l.file_path, l.file_size, l.created_at
    from public.lessons l
    order by l.created_at desc
    limit 500;
end
$$;

-- 4. Thêm bài học (chỉ admin; file PDF đã được tải lên kho trước đó)
create or replace function public.app_add_lesson(p_title text, p_description text, p_file_path text, p_file_size bigint)
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
  insert into public.lessons (title, description, file_path, file_size)
  values (btrim(p_title), nullif(btrim(p_description), ''), p_file_path, p_file_size)
  returning id into v_id;
  return v_id;
end
$$;

-- 5. Xóa bài học (chỉ admin); trả về đường dẫn file để trình duyệt xóa file khỏi kho
create or replace function public.app_delete_lesson(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  if not public.is_admin() then
    raise exception 'Chi quan tri vien duoc xoa bai hoc';
  end if;
  delete from public.lessons where id = p_id returning file_path into v_path;
  return v_path;
end
$$;

revoke execute on function public.app_list_lessons() from public, anon;
revoke execute on function public.app_add_lesson(text, text, text, bigint) from public, anon;
revoke execute on function public.app_delete_lesson(uuid) from public, anon;
grant execute on function public.app_list_lessons() to authenticated;
grant execute on function public.app_add_lesson(text, text, text, bigint) to authenticated;
grant execute on function public.app_delete_lesson(uuid) to authenticated;

-- 6. Kho file riêng tư (chỉ PDF, tối đa 50 MB): nhân viên Active đọc, chỉ admin thêm và xóa
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lessons', 'lessons', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy lessons_obj_select on storage.objects
  for select to authenticated using (bucket_id = 'lessons' and (select public.is_active_staff()));
create policy lessons_obj_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'lessons' and (select public.is_admin()));
create policy lessons_obj_delete on storage.objects
  for delete to authenticated using (bucket_id = 'lessons' and (select public.is_admin()));