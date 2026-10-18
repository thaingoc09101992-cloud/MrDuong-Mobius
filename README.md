# MOBIUS

Nền tảng làm việc nội bộ. Một trang đăng nhập duy nhất bằng email công ty. Sau khi đăng nhập, nhân viên vào trang chủ và chọn chức năng được phân quyền; riêng tài khoản admin có thêm mục **Trang quản trị** (`/admin`).

## Chức năng

- **Định vị điểm bán**: chụp ảnh, lấy định vị GPS và ghi nhận thông tin điểm bán tại thị trường; xem lịch sử và bản đồ.

- **Bố trận điểm bán**: admin tải danh sách điểm bán từ Excel (doanh số tháng, doanh thu 6 tháng, trung bình 6 tháng, số đơn mỗi tháng, SKU hay mua, tọa độ), xem trên bản đồ, bấm vào điểm bán để xem thông tin chi tiết, có ô tìm kiếm. Nhân viên được cấp quyền chỉ xem. Cần chạy migration `20261018_08_trade_stores.sql` và triển khai lại Edge Function `admin-employees`.

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
