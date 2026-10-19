-- Cho phép liên kết nhúng của Google Drive (file PDF xem bằng https://drive.google.com/file/d/<id>/preview).
alter table public.lessons drop constraint if exists lessons_source_url_check;
alter table public.lessons add constraint lessons_source_url_check
  check (source_url is null or (
    length(source_url) <= 1500
    and source_url ~* '^https://(onedrive\.live\.com|1drv\.ms|drive\.google\.com|[a-z0-9-]+\.sharepoint\.com|[a-z0-9-]+\.officeapps\.live\.com|[a-z0-9-]+\.office\.com)/'
  ));