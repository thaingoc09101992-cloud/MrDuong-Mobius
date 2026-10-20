# MOBIUS: quy tắc cho Claude

## Thẻ (card), bắt buộc cho toàn dự án
Khi thêm, sửa hoặc thiết kế **bất kỳ thẻ nào** (thẻ công cụ, thẻ tài liệu/bài học, hàng danh sách dạng thẻ, hoặc loại thẻ mới), **đọc và tuân thủ [docs/CARD_DESIGN_RULES.md](docs/CARD_DESIGN_RULES.md) trước khi viết code**. File này là bộ quy tắc chung (bo góc, viền, bóng, màu, chữ, khoảng cách, nút, tương tác, responsive, danh sách kiểm tra). Quy tắc chỉ được thay đổi khi chủ dự án yêu cầu rõ ràng.

Điểm hay sai nhất: **độ bo góc chỉ dùng token** (thẻ `--radius-md` 4px, ô icon `--radius-lg` 8px), không bo 12px hay dạng viên thuốc; không dùng token khoảng cách `--space-5` (không tồn tại); nút hành động chính của thẻ là vàng champagne; giao diện máy tính được thu nhỏ 90% bằng `zoom` nên chiều cao theo màn hình phải viết `calc(N * var(--v1))` thay cho `Nvh` (xem DESIGN_SYSTEM.md).

### Thẻ công cụ
Thẻ công cụ có thêm quy tắc riêng tại [docs/TOOL_CARD_SPEC.md](docs/TOOL_CARD_SPEC.md). Mỗi công cụ phải có `name`, `category`, `desc`, `icon` và **`image` (ảnh tiêu đề đen trắng, cùng tông tối)** trong `src/modules.js`. Nếu chưa có ảnh tiêu đề thì **dừng lại và yêu cầu chủ dự án cung cấp**, không tự chọn hoặc tải ảnh khác.

## Tài liệu thiết kế khác
Token, nền tảng và component nền dùng chung (nguồn duy nhất, các tài liệu khác trỏ về đây): [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).