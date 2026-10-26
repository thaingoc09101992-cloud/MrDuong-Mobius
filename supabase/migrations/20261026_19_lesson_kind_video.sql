-- MOBIUS: "Video đào tạo" dùng chung bảng và quyền của Bài học, phân biệt bằng cột kind ('lesson' | 'video').
-- Video hiện lưu bằng liên kết Google Drive (source_url); sau này đổi nơi lưu chỉ cần mở rộng ràng buộc source_url và trình xem.
-- Chỉ tài khoản Mobius (admin hoặc nhân viên Active) đọc được danh sách, nên liên kết không lộ ra ngoài ứng dụng.

alter table public.lessons add column if not exists kind text not null default 'lesson';
alter table public.lessons drop constraint if exists lessons_kind_check;
alter table public.lessons add constraint lessons_kind_check check (kind in ('lesson', 'video'));

-- Kiểu trả về đổi (thêm cột kind) nên phải xóa rồi tạo lại
drop function if exists public.app_list_lessons();
create function public.app_list_lessons()
returns table(id uuid, title text, description text, file_path text, file_size bigint, source_url text,
              allow_download boolean, created_at timestamptz, kind text)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'Tai khoan khong duoc phep su dung';
  end if;
  return query
    select l.id, l.title, l.description, l.file_path, l.file_size, l.source_url, l.allow_download, l.created_at, l.kind
    from public.lessons l
    order by l.created_at desc
    limit 500;
end
$$;
revoke execute on function public.app_list_lessons() from public, anon;
grant execute on function public.app_list_lessons() to authenticated;

-- Thêm tham số p_kind (mặc định 'lesson' nên nơi gọi cũ vẫn chạy); xóa cả hàm cũ (3 tham số) lẫn bản mới (4 tham số)
-- để chạy lại file này nhiều lần không bị lỗi "already exists"
drop function if exists public.app_add_lesson_link(text, text, text);
drop function if exists public.app_add_lesson_link(text, text, text, text);
create function public.app_add_lesson_link(p_title text, p_description text, p_source_url text, p_kind text default 'lesson')
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Chi quan tri vien duoc them bai hoc';
  end if;
  if p_kind is null or p_kind not in ('lesson', 'video') then
    raise exception 'Loai noi dung khong hop le';
  end if;
  insert into public.lessons (title, description, source_url, kind)
  values (btrim(p_title), nullif(btrim(p_description), ''), btrim(p_source_url), p_kind)
  returning id into v_id;
  return v_id;
exception when check_violation then
  raise exception 'Lien ket khong hop le';
end
$$;
revoke execute on function public.app_add_lesson_link(text, text, text, text) from public, anon;
grant execute on function public.app_add_lesson_link(text, text, text, text) to authenticated;