# Triết lý thiết kế

Ngôn ngữ thiết kế lấy từ HORIZ: **Modern Luxury × Minimalism × Editorial**. Nguyên tắc: *luxury through restraint* (sang trọng đến từ sự tiết chế).

Đây là bản chuyển giao DNA thẩm mỹ, không sao chép chức năng. Ứng dụng là công cụ nghiệp vụ cho nhân viên thị trường, nên tinh thần editorial chỉ nằm ở tiêu đề trang, màn hình đăng nhập và số liệu tổng quan. Không dùng hero lớn làm mất không gian làm việc.

## Giữ nguyên từ HORIZ
- Bảng màu trung tính: đen `#111`, trắng, ivory, cream, taupe. Nền trắng là chủ đạo.
- Typography dẫn dắt phân cấp: serif cho tiêu đề biên tập, sans cho giao diện.
- Góc vuông (2–4px), viền mảnh `#E7E5E0`, gần như không có bóng.
- Nút đặc: nền đen, chữ trắng, chữ hoa giãn nhẹ.
- Chuyển động 200–400ms, chỉ dùng opacity và transform.

## Chuyển đổi cho ứng dụng nghiệp vụ
| HORIZ | Ứng dụng này |
|---|---|
| Hero lớn | Tiêu đề trang cỡ lớn (serif) + mô tả ngắn; màn hình đăng nhập chia đôi nền đen |
| Menu thương mại | 3 tab dưới (mobile) và tab chữ hoa gạch chân (admin) |
| Lưới sản phẩm | Danh sách điểm bán dạng hàng, ngăn bằng đường kẻ, không dùng card |
| Footer đen | Không dùng footer; vùng đen chỉ xuất hiện ở màn hình đăng nhập |

## Quyết định lệch khỏi HORIZ (có chủ đích)
1. **Font giao diện là Be Vietnam Pro, không phải Instrument Sans.** Instrument Sans không có glyph tiếng Việt, từng từ sẽ bị trộn hai font. Cormorant Garamond hỗ trợ tiếng Việt nên giữ nguyên.
2. **Màu nhấn `#0284C7` được giữ làm màu nhấn duy nhất**, chỉ dùng cho pin trên bản đồ. Phần còn lại là trung tính.
3. **Chế độ tối được giữ** vì nhân viên dùng ngoài trời và ban đêm. Cùng spacing, typography và component với chế độ sáng.
