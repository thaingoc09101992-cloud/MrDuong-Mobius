-- MOBIUS: đổi tên hiển thị của bài học (chỉ admin). Chỉ cập nhật cột title; đường dẫn file trong Storage không đổi.
create or replace function public.app_rename_lesson(p_id uuid, p_title text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := btrim(p_title);
begin
  if not public.is_admin() then
    raise exception 'Chi quan tri vien duoc doi ten bai hoc';
  end if;
  if v_title is null or length(v_title) < 1 or length(v_title) > 120 then
    raise exception 'Ten bai hoc khong hop le';
  end if;
  update public.lessons set title = v_title where id = p_id returning title into v_title;
  if not found then
    raise exception 'Khong tim thay bai hoc';
  end if;
  return v_title;
end
$$;

revoke execute on function public.app_rename_lesson(uuid, text) from public, anon;
grant execute on function public.app_rename_lesson(uuid, text) to authenticated;