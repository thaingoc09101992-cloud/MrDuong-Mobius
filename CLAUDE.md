# MOBIUS: quy tắc cho Claude

## Thẻ công cụ (bắt buộc)
Khi thêm, sửa hoặc thiết kế bất kỳ thẻ công cụ nào (kể cả loại thẻ mới phát triển thêm), **đọc và tuân thủ [docs/TOOL_CARD_SPEC.md](docs/TOOL_CARD_SPEC.md) trước khi viết code**. Quy tắc này chỉ được thay đổi khi chủ dự án yêu cầu rõ ràng.

Điểm quan trọng nhất: mỗi công cụ phải có `name`, `category`, `desc`, `icon` và **`image` (ảnh tiêu đề đen trắng)** trong `src/modules.js`. Nếu chưa có ảnh tiêu đề thì **dừng lại và yêu cầu chủ dự án cung cấp**, không tự chọn hoặc tải ảnh khác.

## Tài liệu thiết kế khác
Token và component dùng chung: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md), [docs/COMPONENT_SPECIFICATION.md](docs/COMPONENT_SPECIFICATION.md).