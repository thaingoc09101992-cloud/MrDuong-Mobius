# Checklist kiểm tra giao diện

Kiểm tra tại 1440px, 1024px và 390px, ở cả chế độ sáng và tối.

## Tổng thể
- [ ] Nền trắng, chữ ink, viền mảnh; không có gradient hay bóng đổ lớn.
- [ ] Chỉ có một màu nhấn (pin bản đồ); trạng thái dùng sắc độ trầm.
- [ ] Không có cuộn ngang ở bất kỳ viewport nào.
- [ ] Tiếng Việt có dấu hiển thị đồng nhất, không trộn font.

## Typography
- [ ] Serif chỉ ở tiêu đề trang, tên điểm bán, số KPI, đăng nhập.
- [ ] Nhãn chữ hoa giãn chữ ở tab, nút, label form.
- [ ] Không quá 4 cỡ chữ trên cùng một màn hình.

## Bố cục và khoảng trắng
- [ ] Khoảng cách theo thang token, không dùng giá trị ngẫu nhiên.
- [ ] Khoảng cách giữa tiêu đề và mô tả nhỏ hơn giữa các nhóm.
- [ ] Danh sách lịch sử dạng hàng, không card.

## Component
- [ ] Nút cao 48px (nhỏ 40px), bo 2px, hover đổi nền trong 300ms.
- [ ] Input có focus rõ (viền ink + vòng mờ).
- [ ] Tab đang chọn có vạch 2px.
- [ ] Bảng admin: tiêu đề chữ hoa, hover hàng nhẹ.

## Chức năng (không được mất)
- [ ] Đăng nhập mã nhân viên và đăng nhập admin.
- [ ] Nút Trang admin chỉ hiện với vai trò Quản lý.
- [ ] Chụp ảnh, GPS ≤ 50 m, lưu điểm bán.
- [ ] Bản đồ, bộ lọc, toàn màn hình, xuất Excel.

## Chuyển động và accessibility
- [ ] Chuyển động 200–400ms; không bounce.
- [ ] `prefers-reduced-motion` tắt animation.
- [ ] Điều hướng bằng bàn phím, focus-visible rõ.
- [ ] Tương phản chữ/nền đạt tối thiểu 4.5:1.
