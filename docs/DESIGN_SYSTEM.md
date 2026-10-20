# Design system MOBIUS

Nguồn duy nhất cho **token và nền tảng** dùng chung toàn dự án. Quy tắc riêng của thẻ nằm ở [CARD_DESIGN_RULES.md](CARD_DESIGN_RULES.md) và [TOOL_CARD_SPEC.md](TOOL_CARD_SPEC.md); các file đó chỉ trỏ về đây, không chép lại token.

Toàn bộ token nằm ở đầu [src/styles.css](../src/styles.css) (primitive rồi semantic, kèm bản chế độ tối). Khung có thanh bên dùng [src/shell.css](../src/shell.css); trang quản trị thêm kiểu riêng ở [src/admin/admin.css](../src/admin/admin.css). **Không viết màu hoặc khoảng cách rời rạc trong component, luôn dùng token.**

## Màu
| Token | Giá trị | Vai trò |
|---|---|---|
| `--color-ink` | `#111111` | Chữ chính, nút chính |
| `--color-ink-2` | `#242424` | Hover nút chính, chữ phụ |
| `--color-white` | `#FFFFFF` | Nền |
| `--color-ivory` | `#F8F7F4` | Nền thay thế (bộ lọc, hover hàng) |
| `--color-cream` | `#F3F0E9` | Rãnh biểu đồ, nền ảnh chờ |
| `--color-beige` | `#E8E2D8` | Dự phòng nhấn nền |
| `--color-taupe` | `#B8ADA0` | Placeholder, viền thẻ công cụ (sáng) |
| `--color-border` | `#E7E5E0` | Viền, đường kẻ |
| `--color-muted` | `#737373` | Metadata |
| `--gold` / `--gold-soft` / `--gold-deep` | `#C9A96E` / `#D9C49B` / `#8F723A` | **Vàng champagne, nhận diện MOBIUS**: nhãn phân loại, đường nhấn dưới tiêu đề, nút hành động chính của thẻ, ô icon nhấn. Không dùng làm nền cả khối hay chữ nội dung. Chữ trên nền vàng là `#111111`. |
| `--color-accent` | `#0284C7` | Xanh dữ liệu bản đồ: ghim, cụm điểm, chấm đếm. Không dùng cho nút hay chữ giao diện. |
| `--danger-text` | `#9B3B32` (tối `#E59A92`) | Cảnh báo, xóa |

Token ngữ nghĩa dùng trong component: `--bg`, `--surface`, `--surface-2`, `--text`, `--text-2`, `--muted`, `--border`, `--border-strong`, `--focus-ring`, `--overlay`. Chế độ tối đảo `ink` và `white` và giữ nguyên cấu trúc token ngữ nghĩa (đổi qua `:root[data-theme='dark']`), nên **component chỉ dùng token ngữ nghĩa thì tự đẹp ở cả hai chế độ**. Trạng thái (ok, warn, danger) dùng sắc độ trầm: nền rất nhạt, chữ đậm vừa.

## Typography
- **UI:** Be Vietnam Pro 400/500/600 (khoảng 90% giao diện).
- **Biên tập:** Cormorant Garamond 500/600/700 (tiêu đề trang, số liệu KPI, tên công cụ ở thẻ, màn hình đăng nhập). Không dùng cho bảng, form, menu.
- **Nhãn nhỏ** (eyebrow, tab, nút, label form): chữ hoa, giãn chữ 0.1–0.16em.
- Tiêu đề trang: `clamp(2.2rem, 8vw, 3.2rem)`, line-height 1.02. Nội dung: 15px, line-height 1.6.

## Khoảng cách
`--space-1` ... `--space-20` = `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 80px`. Các token hợp lệ là 1, 2, 3, 4, 6, 8, 12, 16, 20. **Không có `--space-5`** (dùng sai sẽ làm khoảng cách biến mất).

## Hình khối
- **Bo góc chỉ có 3 mức, dùng token:** `--radius-sm` 2px (nút, ô nhập, chi tiết nhỏ), `--radius-md` 4px (thẻ, khung bản đồ, popup), `--radius-lg` 8px (ô vuông chứa icon bên trong thẻ). Không bo quá 8px, không dùng 12px, 16px hay dạng viên thuốc (`999px`). Hình tròn (`50%`) chỉ cho nút mũi tên tròn, avatar, chấm trạng thái, vòng quay loading.
- Viền `1px` (`--border`, hover hoặc focus `--border-strong`).
- Bóng: không dùng cho nút và thẻ công cụ. Thẻ dạng hàng chỉ được bóng rất nhẹ (xem CARD_DESIGN_RULES.md). Không bóng nặng, không gradient trang trí, không glassmorphism.

## Chuyển động
`--motion-fast 200ms`, `--motion-normal 300ms`, `--motion-slow 400ms`, easing `cubic-bezier(0.22, 0.61, 0.36, 1)`. Hiệu ứng `rise` (opacity + translateY 14px) cho nội dung trang. Hỗ trợ `prefers-reduced-motion` (luật toàn cục tắt animation và transition).

## Bố cục và responsive
- App có **thanh bên** (`AppShell`, dùng chung cho app nhân viên và trang quản trị): tên MOBIUS và tài khoản ở thanh trên, menu bên trái, nút đổi giao diện và đăng xuất ở chân menu. Dưới 900px thanh bên thành menu trượt.
- **Giao diện thu nhỏ còn 90% trên máy tính** (từ 1024px trở lên, `html { zoom: var(--ui-zoom) }` với `--ui-zoom: 0.9`) để hiển thị nhiều nội dung hơn. Điện thoại và máy tính bảng giữ 100%. Hệ quả cho khi viết CSS: **đơn vị `vh`/`dvh`/`vw` không tự bù tỉ lệ này**, nên chiều cao theo màn hình phải viết `calc(N * var(--v1))` (hoặc `var(--dv1)` cho `dvh`) thay cho `Nvh`, nếu không khối chỉ cao 90% màn hình. Kích thước đo bằng JS (`clientWidth`, `clientHeight`) đã ở đơn vị đã bù, còn `getBoundingClientRect` trả về giá trị đã nhân 0,9 (Leaflet tự xử lý được, đã thử).
- Khung nội dung `max-width: var(--container)` (1600px, tương đương 1440px thực tế sau khi thu nhỏ), căn giữa, padding 48px (desktop). Mọi trang phải co giãn tốt theo bề ngang.
- Điểm ngắt: `720px` (bộ lọc 5 cột), `900px` (đăng nhập chia đôi, thanh bên thu gọn), `1024px` (admin giảm padding). Điện thoại: một cột, padding 16px.
- Không được tràn ngang ở 390px, 1024px, 1440px.

## Component nền
### Button (`.btn`)
- Cao 48px (`-sm` 40px, `-lg` 56px), bo `--radius-sm`, chữ hoa 0.72–0.82rem giãn 0.1em.
- `btn-primary`: nền ink, chữ trắng, hover `--color-ink-2`. `btn-ghost`: nền trong, viền `--border`, hover viền đậm. `btn-icon`: 40 × 40, chỉ icon (cần `aria-label`).
- Trạng thái: hover, `focus-visible` (viền 2px ink), disabled (opacity 0.4).
- Nút hành động chính của **thẻ** là vàng champagne (xem CARD_DESIGN_RULES.md).

### Field (`.field`)
- Label chữ hoa nhỏ. Input cao 48px (`field-sm` 42px cho bộ lọc), viền `--border`, bo `--radius-sm`, placeholder `--color-taupe`.
- Hover viền taupe; focus viền `--border-strong` + `--focus-ring`.

### Card (`.card`)
Khối chung: nền `--surface`, viền mảnh, bo `--radius-md`, padding 24px, không bóng. Các loại thẻ chuyên biệt (thẻ công cụ, thẻ tài liệu) theo [CARD_DESIGN_RULES.md](CARD_DESIGN_RULES.md).

### Chip (`.chip`), Alert, GPS chip
Chip: viền mảnh, nền trong, chữ hoa nhỏ. Alert: nền rất nhạt theo trạng thái, vạch trái 2px. GPS chip: chấm trạng thái, nhấp nháy khi đang chờ định vị.

### Điều hướng
Thanh bên (`.ad-navbtn`) cho các mục chính. Trong công cụ "Định vị điểm bán" có thanh tab chữ (`.tool-tab`) và, trên điện thoại, thanh tab dưới (`.tabbar`) với tab đang chọn có vạch ink 2px.

### PageHeader (`.page-head`)
Eyebrow đánh số hoặc nhãn, tiêu đề serif cỡ lớn, mô tả một dòng. Dùng ở các trang nội dung của app nhân viên.

### Màn hình đăng nhập
Chia đôi từ 900px: **trái là khung thương hiệu nền đen** (logo cạnh khối chữ "NỀN TẢNG NỘI BỘ", MOBIUS, đường vàng, một câu mô tả, hai đường cong vàng mảnh), **phải là form** theo giao diện hiện tại. Dưới 900px khung thương hiệu thành dải đầu trang gọn. Dùng chung với màn hình đổi mật khẩu.

### Bảng admin (`.ad-table`)
Tiêu đề chữ hoa 0.68rem, kẻ dưới đậm; hàng cách nhau đường mảnh, hover nền ivory. Ảnh thu nhỏ tỉ lệ 4:5.

### KPI admin (`.ad-kpi`), biểu đồ
Số liệu dẫn dắt bằng serif cỡ lớn, ngăn cột bằng đường kẻ dọc, không dùng card. Biểu đồ một màu ink trên rãnh cream, bo `--radius-sm`.

### Modal (`.ad-modal`)
Backdrop `--overlay`, hộp bo `--radius-md`, mở bằng fade + rise 300ms.