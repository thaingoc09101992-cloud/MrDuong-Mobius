# Đánh giá giao diện (trước khi áp dụng HORIZ)

Công nghệ: React 18 + Vite, CSS thuần theo biến, Supabase, Leaflet. Hai phần: app nhân viên (3 tab) và trang `/admin` (4 tab).

| Khu vực | Vấn đề | Nguyên tắc áp dụng | Phương án | Ảnh hưởng |
|---|---|---|---|---|
| Toàn cục | Bo góc lớn, bóng đổ, màu xanh phủ nhiều nơi, giống template SaaS | Luxury through restraint | Trung tính, góc vuông, viền mảnh, không bóng | CSS |
| Typography | Một font, một độ đậm; phân cấp dựa vào màu và card | Typography dẫn dắt phân cấp | Serif cho tiêu đề, nhãn chữ hoa giãn chữ | CSS + JSX nhẹ |
| Tiêu đề trang | Không có; mỗi tab mở thẳng vào nội dung | Editorial | `PageHeader` có eyebrow, tiêu đề lớn, mô tả | App.jsx |
| Lịch sử | Mỗi điểm bán là một card giống nhau | Không ép mọi thứ vào card | Danh sách hàng, đường kẻ, ảnh 4:5 | CSS |
| Đăng nhập | Thẻ nhỏ giữa nền gradient | Editorial, vùng đen sâu | Chia đôi: nền đen tiêu đề serif | Login, AdminLogin |
| Admin KPI | Bốn card bằng nhau | Số liệu là nhân vật chính | Số serif lớn, ngăn bằng đường kẻ | CSS |
| Admin điều hướng | Nút tab dạng viên thuốc | Navigation gọn, chữ nhỏ | Tab chữ hoa, gạch chân | CSS + JSX |
| Biểu đồ | Gradient xanh | Hạn chế gradient | Một màu ink trên rãnh cream | CSS |
| Chuyển động | Gần như không có | Motion 200–400ms | `rise`, gạch chân trượt, `prefers-reduced-motion` | CSS |
| Tiếng Việt | Font mới phải đủ dấu | Accessibility | Be Vietnam Pro + Cormorant Garamond (đều có subset vietnamese) | index.html |

## Rủi ro đã biết
- Instrument Sans (font tham chiếu) không có glyph tiếng Việt, đã thay bằng Be Vietnam Pro.
- Các màn hình sau đăng nhập chỉ kiểm tra qua build; chưa chụp ảnh thực tế vì cần tài khoản Supabase.
