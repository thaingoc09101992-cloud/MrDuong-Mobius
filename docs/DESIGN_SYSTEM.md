# Design system

Toàn bộ token nằm ở đầu [src/styles.css](../src/styles.css) (primitive rồi semantic). Trang admin dùng chung token, chỉ thêm kiểu riêng ở [src/admin/admin.css](../src/admin/admin.css). Không viết màu hoặc khoảng cách rời rạc trong component.

## Màu
| Token | Giá trị | Vai trò |
|---|---|---|
| `--color-ink` | `#111111` | Chữ chính, nút chính |
| `--color-ink-2` | `#242424` | Hover nút chính, chữ phụ |
| `--color-white` | `#FFFFFF` | Nền |
| `--color-ivory` | `#F8F7F4` | Nền thay thế (bộ lọc, hover hàng) |
| `--color-cream` | `#F3F0E9` | Rãnh biểu đồ, nền ảnh chờ |
| `--color-beige` | `#E8E2D8` | Dự phòng nhấn nền |
| `--color-taupe` | `#B8ADA0` | Placeholder, gạch chân link |
| `--color-border` | `#E7E5E0` | Viền, divider |
| `--color-muted` | `#737373` | Metadata |
| `--color-accent` | `#0284C7` | Màu nhấn duy nhất (pin bản đồ) |

Trạng thái (ok, warn, danger) dùng sắc độ trầm: nền rất nhạt, chữ đậm vừa. Chế độ tối đảo `ink` và `white`, giữ nguyên cấu trúc token semantic (`--bg`, `--surface`, `--text`, `--border`...).

## Typography
- **UI:** Be Vietnam Pro 400/500/600 (khoảng 90% giao diện).
- **Biên tập:** Cormorant Garamond 500/600 (tiêu đề trang, số liệu KPI, tên điểm bán, màn hình đăng nhập). Không dùng cho bảng, form, menu.
- **Nhãn nhỏ** (eyebrow, tab, nút, label form): chữ hoa, giãn chữ 0.1–0.16em.
- Tiêu đề trang: `clamp(2.2rem, 8vw, 3.2rem)`, line-height 1.02. Nội dung: 15px, line-height 1.6.

## Spacing
`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 80` (`--space-1` ... `--space-20`).

## Hình khối
Bo góc `2 / 4 / 8px`. Viền `1px`. Không dùng shadow cho thẻ hay nút.

## Chuyển động
`--motion-fast 200ms`, `--motion-normal 300ms`, `--motion-slow 400ms`, easing `cubic-bezier(0.22, 0.61, 0.36, 1)`. Hiệu ứng `rise` (opacity + translateY 14px) cho nội dung trang. Hỗ trợ `prefers-reduced-motion`.

## Responsive
- Mobile (dưới 720px): một cột, thanh tab dưới, padding 16px.
- Tablet và desktop: `min-width: 720px` (bộ lọc 5 cột), `900px` (đăng nhập chia đôi), `1024px` (admin giảm padding).
- Admin: `max-width: 1440px`, padding 48px.
