# Kế hoạch triển khai

## Đã làm
1. **Token và nền tảng:** viết lại `src/styles.css` với token primitive và semantic, chế độ sáng và tối.
2. **Component nền:** nút, form, card, chip, alert, tabbar, topbar.
3. **Trang:** tiêu đề biên tập cho từng tab, đăng nhập chia đôi (nhân viên và admin), danh sách lịch sử dạng hàng, camera và GPS chip.
4. **Admin:** header chữ hoa, KPI serif, biểu đồ một màu, bảng, bộ lọc.
5. **Chuyển động:** `rise`, gạch chân trượt, `prefers-reduced-motion`.
6. **Font, icon, theme-color:** thêm Cormorant Garamond, đổi icon và manifest sang `#111111`.

Không thay đổi backend, API, database hoặc luồng nghiệp vụ.

## Việc tiếp theo (theo thứ tự ưu tiên)
1. Chụp ảnh các màn hình sau đăng nhập (chụp, lịch sử, bản đồ, admin) ở 1440px, 1024px và 390px, chỉnh lệch nếu có.
2. Kiểm tra tương phản chế độ tối và popup bản đồ.
3. Tách `Button`, `Field`, `PageHeader` thành component React nếu số trang tăng.
4. Tối ưu `index` chunk (hiện trên 500 kB do Leaflet và Supabase), dùng `import()` cho trang admin và ExcelJS.
