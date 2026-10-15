# Đặc tả component

Tất cả component dùng chung token trong [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Button (`.btn`)
- Cao 48px (`-sm` 40px, `-lg` 56px), bo 2px, chữ hoa 0.72–0.82rem giãn 0.1em.
- `btn-primary`: nền ink, chữ trắng, hover chuyển ink-2.
- `btn-ghost` và `btn-soft`: nền trong, viền `--border`, hover viền đậm.
- `btn-icon`: 40×40, chỉ icon.
- Trạng thái: hover, focus-visible (viền 2px ink), disabled (opacity 0.4).

## Field (`.field`)
- Label chữ hoa nhỏ. Input cao 48px, viền `--border`, bo 2px.
- Focus: viền ink + vòng mờ 3px. Placeholder màu taupe.
- Biến thể nhỏ `field-sm` (42px) cho bộ lọc.

## Card (`.card`)
Nền trắng, viền mảnh, bo 4px, padding 24px, không bóng. Trong danh sách lịch sử, card được bỏ khung và chỉ còn đường kẻ phân cách.

## Chip (`.chip`)
Viền mảnh, nền trong, chữ hoa nhỏ. Dùng cho loại hình điểm bán.

## Alert và GPS chip
Nền rất nhạt theo trạng thái, vạch trái 2px (alert). Chấm trạng thái, nhấp nháy khi đang chờ định vị.

## Navigation
- Mobile: `.tabbar` 3 mục, icon nét mảnh + nhãn chữ hoa, tab đang chọn có vạch ink 2px phía trên. Huy hiệu số điểm trên tab Lịch sử.
- Admin: `.ad-tabs` chữ hoa, gạch chân ink 2px cho tab đang chọn.

## PageHeader (`.page-head`)
Eyebrow đánh số (01 / Thu thập), tiêu đề serif cỡ lớn, mô tả một dòng. Dùng ở mọi tab của app nhân viên.

## Màn hình đăng nhập
Mobile: dải đen tiêu đề serif phía trên, form phía dưới. Từ 900px: chia đôi, trái nền đen, phải form. Dùng chung cho đăng nhập nhân viên và admin.

## Bảng admin (`.ad-table`)
Tiêu đề chữ hoa 0.68rem, kẻ dưới đậm; hàng cách nhau đường mảnh, hover nền ivory. Ảnh thu nhỏ tỷ lệ 4:5.

## KPI admin (`.ad-kpi`)
Số liệu dẫn dắt bằng serif cỡ lớn, ngăn cột bằng đường kẻ dọc, không dùng card.

## Biểu đồ
Một màu ink trên rãnh cream, bo 2px. Cột theo ngày và thanh ngang.

## Modal ảnh (`.ad-modal`)
Backdrop `--overlay`, hộp bo 4px, mở bằng fade + rise 300ms.
