# Thu thập điểm bán (Sales Tool)

Ứng dụng nội bộ để nhân viên thị trường chụp ảnh, lấy định vị GPS và nhập thông tin điểm bán. Có trang quản trị tại `/admin`.

- React 18 + Vite, Supabase (Postgres, Storage, Auth), Leaflet, ExcelJS
- Triển khai trên Vercel, tự deploy khi push lên `main`

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
