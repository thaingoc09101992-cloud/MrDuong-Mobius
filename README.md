# MOBIUS

Nền tảng làm việc nội bộ. Nhân viên đăng nhập bằng email công ty, vào trang chủ và chọn chức năng được phân quyền.

## Chức năng

- **Định vị điểm bán**: chụp ảnh, lấy định vị GPS và ghi nhận thông tin điểm bán tại thị trường; xem lịch sử và bản đồ.

## Dùng chung toàn MOBIUS

- **Nhân viên và phân quyền** (trang quản trị `/admin`, mục Nhân viên): tạo nhân viên, import Excel hàng loạt, mật khẩu tạm và bắt buộc đổi lần đầu.
- **Quyền sử dụng từng chức năng**: mỗi nhân viên được bật hoặc tắt từng chức năng.
- **Quản lý trực tiếp**: quản lý chỉ xem dữ liệu của chính mình và của nhân viên báo cáo trực tiếp cho mình.

## Công nghệ

React 18 + Vite, Supabase (Postgres, Auth, Storage, Edge Functions), Leaflet, ExcelJS. Triển khai trên Vercel, tự deploy khi push lên `main`. Mã nguồn Supabase nằm trong thư mục `supabase/` (migrations và Edge Function).

## Chạy local

```bash
npm install
npm run dev
```

Tạo file `.env` (không đưa lên git):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
