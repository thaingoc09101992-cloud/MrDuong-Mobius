# Design system MOBIUS

Nguồn duy nhất cho **token và nền tảng** dùng chung toàn dự án. Quy tắc riêng của thẻ nằm ở [CARD_DESIGN_RULES.md](CARD_DESIGN_RULES.md) và [TOOL_CARD_SPEC.md](TOOL_CARD_SPEC.md); các file đó chỉ trỏ về đây, không chép lại token.

Toàn bộ token nằm ở đầu [src/styles.css](../src/styles.css) (primitive rồi semantic, kèm bản chế độ tối). Khung có thanh bên dùng [src/shell.css](../src/shell.css); trang quản trị thêm kiểu riêng ở [src/admin/admin.css](../src/admin/admin.css). **Kiểu của khung (`.ad-shell`, `.ad-sidebar`, `.ad-navbtn`, `.ad-bar`, `.ad-main`...) chỉ viết ở `shell.css`**, không chép sang `admin.css` (file này nạp sau nên bản chép sẽ đè và làm trang quản trị lệch khỏi app nhân viên). **Không viết màu hoặc khoảng cách rời rạc trong component, luôn dùng token.**

## Nguyên tắc chung
Giao diện hiện tại là chuẩn đã được chủ dự án duyệt. Mọi trang và component mới phải trông như cùng một sản phẩm.
1. **Sang trọng nhờ tiết chế** (Modern Luxury x Minimalism x Editorial): nền trắng và ngà, chữ mực, một điểm nhấn vàng champagne. Nhiều khoảng trắng, typography dẫn dắt phân cấp. Không dùng màu sặc sỡ, bóng nặng hay hiệu ứng trang trí.
2. **Một nguồn duy nhất:** token ở đầu `styles.css`, khung trang ở `shell.css`, component dùng chung ở `src/` (`Loading`, `ConfirmDialog`, `Icon`, `Logo`, `ThemeToggle`, `AppShell`). Cần thứ đã có thì dùng lại, không tạo bản sao theo trang.
3. **Chỉ dùng token:** màu, cỡ chữ, giãn chữ, khoảng cách, bo góc, chuyển động. Viết giá trị rời chỉ khi nằm trong danh sách ngoại lệ ghi ở tài liệu này.
4. **Đẹp ở cả sáng và tối** chỉ nhờ token ngữ nghĩa, không viết luật riêng cho chế độ tối nếu không thật cần.
5. **Chạy tốt từ điện thoại 390px đến màn 1440px trở lên**, không tràn ngang.
6. **Thay đổi quy tắc** (tài liệu này, CARD_DESIGN_RULES.md, TOOL_CARD_SPEC.md) chỉ khi chủ dự án yêu cầu rõ ràng. Khi đổi thì cập nhật tài liệu cùng lúc với code.

## Màu
Mọi mã màu chỉ được khai báo **một lần** trong hai khối token ở đầu `styles.css`: khối primitive (giá trị gốc) rồi khối semantic (vai trò, có bản chế độ tối). Component chỉ dùng tên token, không viết mã màu.

### Primitive
| Token | Giá trị | Vai trò |
|---|---|---|
| `--color-ink` | `#111111` | Chữ chính, nút chính; chữ trên nền vàng hoặc nền trắng cố định |
| `--color-ink-2` | `#242424` | Hover nút chính, chữ phụ |
| `--color-white` | `#FFFFFF` | Nền; chữ trên ảnh |
| `--color-black` | `#0B0B0B` | Nền ảnh, camera, khung xem ảnh; nền vùng làm việc ở chế độ tối |
| `--color-ivory` | `#F8F7F4` | Nền vùng làm việc, nền phụ (hover, ô nhấn nhẹ) |
| `--color-cream` | `#F3F0E9` | Khối kem (form tạo mới, bộ lọc), rãnh biểu đồ |
| `--color-beige` | `#E4DED1` | Viền của khối kem, viền ô nhập ở màn đăng nhập |
| `--color-taupe` | `#B8ADA0` | Viền ô nhập khi rê chuột, viền thẻ công cụ (sáng) |
| `--color-border` | `#E7E5E0` | Viền, đường kẻ |
| `--color-muted` | `#737373` | Metadata |
| `--color-accent` | `#0284C7` | Xanh dữ liệu bản đồ: ghim, cụm điểm, chấm đếm. Không dùng cho nút hay chữ giao diện. |
| `--gold` / `--gold-soft` / `--gold-deep` | `#C9A96E` / `#D9C49B` / `#8F723A` | **Vàng champagne, nhận diện MOBIUS**: nhãn phân loại, đường nhấn dưới tiêu đề, nút hành động chính của thẻ, ô icon nhấn. Không dùng làm nền cả khối hay chữ nội dung. Chữ trên nền vàng là `--color-ink`. |
| `--gold-line` / `--gold-glow` | vàng 28% / 12% trong suốt | Viền vàng mảnh và quầng sáng rất nhẹ trên nền thương hiệu, nền hover nhấn vàng. Độ trong suốt khác thì viết `color-mix(in srgb, var(--gold) N%, transparent)`, không viết `rgba(201, 169, 110, …)`. |
| `--brand-dark` | `#14100D` | Nền khung thương hiệu (nửa trái màn đăng nhập, banner Home mặc định, nền chờ ảnh banner); luôn tối ở cả hai chế độ |
| `--on-brand` / `--on-brand-muted` | `#F4F1EA` / `#D2CBBD` | Chữ chính và chữ phụ trên `--brand-dark` |
| `--danger-text` | `#9B3B32` (tối `#E59A92`) | Cảnh báo, xóa |

### Semantic (dùng trong component)
| Token | Sáng | Tối | Vai trò |
|---|---|---|---|
| `--bg` | trắng | `#0F0F0F` | Nền khung: thanh bên, thanh trên, trang không có khung |
| `--canvas` | `--color-ivory` | `--color-black` | Nền vùng làm việc bên trong khung (thay cho `--page-bg` cũ) |
| `--surface` / `--surface-2` | trắng / ivory | `#161616` / `#1C1C1B` | Nền thẻ, bảng, hộp thoại / nền phụ |
| `--tint` / `--tint-border` | cream / beige | `#1F1E1B` / `#2E2C28` | Khối nhấn tông kem và viền của nó |
| `--text`, `--text-2`, `--muted` | | | Chữ chính, chữ phụ, metadata |
| `--border`, `--border-strong` | | | Viền thường, viền khi hover hoặc focus |
| `--track`, `--bar` | | | Rãnh và thanh của biểu đồ, nền ảnh chờ |
| `--focus-ring`, `--overlay` | | | Vòng focus của ô nhập, nền mờ sau hộp thoại |
| `--ok-*`, `--warn-*`, `--danger-*` | | | Trạng thái, sắc độ trầm: nền rất nhạt, chữ đậm vừa |

Chế độ tối đổi giá trị qua `:root[data-theme='dark']` và giữ nguyên tên token, nên **component chỉ dùng token ngữ nghĩa thì tự đẹp ở cả hai chế độ**. Màn đăng nhập có vài biến cục bộ `--lg-*` trong `.login-wrap`, nhưng các biến này chỉ trỏ về token ở trên.

**Ngoại lệ được phép viết màu tại chỗ** (chỉ những chỗ này):
- Lớp phủ trên **ảnh**: gradient tối của ảnh tiêu đề thẻ công cụ (theo TOOL_CARD_SPEC), lớp phủ chữ của banner, nút và chấm trắng mờ đè lên ảnh banner, viền trắng mờ của khung camera.
- Nền dự phòng `#1a1a1a` của ảnh tiêu đề thẻ công cụ (theo TOOL_CARD_SPEC).
- Bóng của ghim và popup bản đồ, bóng rất nhẹ của thẻ dạng hàng (theo CARD_DESIGN_RULES).
- Dải màu cầu vồng của ô chọn màu tùy ý ở Bố trận.

Gradient trang trí chỉ được dùng ở **khung thương hiệu** (quầng sáng vàng và hai đường cong mảnh ở màn đăng nhập, banner Home mặc định khi chưa có ảnh). Những nơi khác không dùng.

## Typography
- **UI:** Be Vietnam Pro 400/500/600 (khoảng 90% giao diện).
- **Biên tập:** Cormorant Garamond 500/600/700 (tiêu đề trang, số liệu KPI, tên công cụ ở thẻ, màn hình đăng nhập). Không dùng cho bảng, form, menu.
- Nội dung: 15px (cỡ của `body`), line-height 1.6.

### Thang cỡ chữ
Chỉ dùng các token sau, không viết `font-size` bằng số rem rời.
| Token | Cỡ | Dùng cho |
|---|---|---|
| `--fs-2xs` | 0.64rem | Badge, chip, nhãn nhóm menu, tiêu đề cột của bảng gọn |
| `--fs-xs` | 0.72rem | Eyebrow, nhãn form, tab, mục menu, tiêu đề cột |
| `--fs-sm` | 0.78rem | Nút, metadata, chú thích, chữ `.small` |
| `--fs-md` | 0.88rem | Chữ phụ, nội dung bảng, thông báo |
| `--fs-base` | 0.95rem | Mô tả, đoạn văn phụ |
| `--fs-lg` | 1.05rem | Tên thẻ dạng hàng, tiêu đề hộp thoại |
| `--fs-xl` | 1.2rem | `h2`, tiêu đề popup |
| `--fs-2xl` | 1.6rem | Tiêu đề mục |
| `--fs-3xl` | 2rem | Tiêu đề trang dạng gọn, tên thương hiệu ở thanh bên |

Các trường hợp viết cỡ tại chỗ:
- **Tiêu đề lớn co giãn theo màn hình** (`clamp`): tiêu đề trang `.page-title` `clamp(2rem, 2.6vw, 2.8rem)`, số KPI, tiêu đề banner, chữ MOBIUS ở màn đăng nhập, tên công cụ trên thẻ. Phần `vw` trong `clamp` viết bằng `calc(N * var(--vw1))`.
- **Ô nhập và ô chọn trên điện thoại** giữ `1rem`, vì nhỏ hơn 16px thì iOS tự phóng to khi chạm vào.
- Nhãn trong biểu đồ SVG.

### Giãn chữ
Chữ hoa nhỏ luôn có giãn chữ, chỉ dùng 4 mức:
| Token | Giá trị | Dùng cho |
|---|---|---|
| `--tracking-wide` | 0.1em | Nút, chip, nhãn form |
| `--tracking-label` | 0.12em | Tab, mục menu, tiêu đề cột, nhãn phân loại |
| `--tracking-eyebrow` | 0.16em | Eyebrow đầu trang, nhãn nhóm menu |
| `--tracking-brand` | 0.24em | **Chỉ** cho nhãn trong khung thương hiệu (eyebrow ở màn đăng nhập và ở banner Home mặc định) |

Form của màn đăng nhập và đổi mật khẩu theo chuẩn chung (nhãn `--tracking-wide`, nút `btn btn-gold btn-lg`), không dùng `--tracking-brand`. Tiêu đề serif có thể siết nhẹ (-0.01em đến -0.025em) tại chỗ.

## Khoảng cách
`--space-1` ... `--space-20` = `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 80px`. Các token hợp lệ là 1, 2, 3, 4, 6, 8, 12, 16, 20. **Không có `--space-5`** (dùng sai sẽ làm khoảng cách biến mất).

## Hình khối
- **Bo góc chỉ có 3 mức, dùng token:** `--radius-sm` 2px (nút, ô nhập, chi tiết nhỏ), `--radius-md` 4px (thẻ, khung bản đồ, popup), `--radius-lg` 8px (ô vuông chứa icon bên trong thẻ). Không bo quá 8px, không dùng 12px, 16px hay dạng viên thuốc (`999px`). Hình tròn (`50%`) chỉ cho nút mũi tên tròn, avatar, chấm trạng thái, vòng quay loading.
- Viền `1px` (`--border`, hover hoặc focus `--border-strong`).
- Bóng: không dùng cho nút và thẻ công cụ. Thẻ dạng hàng chỉ được bóng rất nhẹ (xem CARD_DESIGN_RULES.md). Không bóng nặng, không glassmorphism. Gradient trang trí chỉ dùng ở khung thương hiệu (xem mục Màu).

## Chuyển động
`--motion-fast 200ms`, `--motion-normal 300ms`, `--motion-slow 400ms`, easing `cubic-bezier(0.22, 0.61, 0.36, 1)`. Hiệu ứng `rise` (opacity + translateY 14px) cho nội dung trang. Hỗ trợ `prefers-reduced-motion` (luật toàn cục tắt animation và transition).

## Bố cục và responsive
- App có **thanh bên** (`AppShell`, dùng chung cho app nhân viên và trang quản trị): tên MOBIUS và tài khoản ở thanh trên, menu bên trái, nút đổi giao diện và đăng xuất ở chân menu. Dưới 900px thanh bên thành menu trượt.
- **Thanh công cụ bên phải** (cho công cụ cần nhiều điều khiển, mẫu: Bố trận điểm bán): `AppShell` nhận prop `aside`, tạo cột `#ad-aside` cao bằng màn hình bên phải; trang đưa nội dung vào bằng portal. Cùng kiểu với thanh trái: nền `--bg`, kẻ trái mảnh, đầu thanh cao 96px (bằng `.ad-brandbar`) có tiêu đề serif "Thanh công cụ", nút tròn ở mép dưới để mở hoặc thu gọn. Mở rộng 320px, chia nhóm bằng nhãn chữ hoa vàng (Dữ liệu, Hiển thị, Bộ lọc), ô nhập dùng `.field field-sm`, nút `btn-sm`. Thu gọn còn cột biểu tượng 76px có chữ nhỏ bên dưới, bấm biểu tượng thì mở đúng nhóm. Máy tính nhớ trạng thái; điện thoại là ngăn trượt từ cạnh phải, mở bằng nút trên bản đồ. Ở chế độ toàn màn hình, thanh nằm cạnh bản đồ.
- **Giao diện thu nhỏ còn 90% trên máy tính** (từ 1024px trở lên, `html { zoom: var(--ui-zoom) }` với `--ui-zoom: 0.9`) để hiển thị nhiều nội dung hơn. Điện thoại và máy tính bảng giữ 100%. Hệ quả cho khi viết CSS: **đơn vị `vh`/`dvh`/`vw` không tự bù tỉ lệ này**, nên chiều cao theo màn hình phải viết `calc(N * var(--v1))` (hoặc `var(--dv1)` cho `dvh`) thay cho `Nvh`, nếu không khối chỉ cao 90% màn hình. Kích thước đo bằng JS (`clientWidth`, `clientHeight`) đã ở đơn vị đã bù, còn `getBoundingClientRect` trả về giá trị đã nhân 0,9 (Leaflet tự xử lý được, đã thử).
- **Bố cục thống nhất cho mọi trang trong menu** (Home, Công cụ, Video, Kiến thức, Bài học, Thông tin nhân viên, Trang quản trị): cùng hai biến trong `.ad-shell` (cuối `src/shell.css`): `--ad-pad` (lề ngoài, `clamp(20px, 2.4vw, 40px)`, điện thoại 16px) và `--ad-gap` (khoảng cách giữa các khối, `clamp(16px, 1.5vw, 24px)`, điện thoại 24px). Thanh trên (`.ad-bar`) dùng cùng `--ad-pad` nên tiêu đề thẳng hàng với nội dung. Đầu trang (`.page-head`) không cộng lề riêng, tiêu đề trang cùng một cỡ (`clamp(2rem, 2.6vw, 2.8rem)`). **Trang mới phải dùng hai biến này, không viết lề hay khoảng cách riêng cho cả trang.**
- Khung nội dung `max-width: var(--container)` (1600px, tương đương 1440px thực tế sau khi thu nhỏ), căn giữa. Chỉ trang cần nhiều diện tích (Bố trận điểm bán, các tab Bản đồ, trình xem bài học) bỏ giới hạn bề ngang: bản đồ dùng lớp `is-wide` (prop `wide` của `AppShell`) và còn để bản đồ lấp đầy chiều cao; trình xem bài học tự nhận qua `:has(> .ls-viewer)` trong `shell.css`. Các trang cùng loại "cần nhiều diện tích" phải cùng cách hiển thị, không để trang này hẹp trang kia rộng. Mọi trang phải co giãn tốt theo bề ngang.
- Điểm ngắt: `720px` (bộ lọc 5 cột), `900px` (đăng nhập chia đôi, thanh bên thu gọn), `1024px` (admin giảm padding). Điện thoại: một cột, padding 16px.
- Không được tràn ngang ở 390px, 1024px, 1440px.

## Component nền
### Button (`.btn`)
**Một bộ nút duy nhất cho toàn app** (app nhân viên, trang quản trị, Bài học, Bố trận...). Không tạo bộ nút riêng theo trang (các bộ `.ls-btn`, `.tm-btn` cũ đã gộp vào đây).
- Cao chuẩn **44px**, bo `--radius-sm` (2px), **chữ hoa** `--fs-sm` đậm 500, giãn `--tracking-wide`, không xuống dòng.
- Mỗi khu vực chỉ có **một** nút `btn-primary` (hoặc một `btn-gold` trên thẻ); các nút còn lại là `btn-ghost`.
- Cỡ: `btn-sm` 40px (thanh công cụ, bộ lọc), `btn-lg` 48px (nút chính của form đăng nhập, đổi mật khẩu, chụp ảnh).
- Kiểu:
  - `btn-primary`: nền ink, chữ trắng, hover `--color-ink-2`.
  - `btn-ghost`: nền trong, viền `--border`, hover viền đậm.
  - `btn-gold`: nút hành động chính của **thẻ** và nút chính của màn đăng nhập (vàng champagne, chữ `--color-ink`, đậm 600, hover `--gold-soft`).
  - `btn-danger` (thêm vào `btn-ghost`): nút xóa, chỉ đổi sang `--danger-text` khi rê chuột.
  - `btn-primary is-danger`: nút xác nhận thao tác không hoàn tác được, chỉ dùng trong hộp xác nhận.
- `btn-icon`: vuông theo chiều cao nút (44px, đi với `btn-sm` là 40px), chỉ icon, bắt buộc có `aria-label` và `title`. Có thể thêm `data-tip="..."` để hiện chú thích nhỏ khi rê chuột hoặc focus.
- Trạng thái: hover, `focus-visible` (viền 2px ink), disabled (opacity 0.4).

### Field (`.field`)
- Label chữ hoa nhỏ. Input cao 48px (`field-sm` 42px cho bộ lọc), viền `--border`, bo `--radius-sm` (kể cả ở màn đăng nhập), placeholder mờ 30% màu chữ (`color-mix(in srgb, var(--text) 30%, transparent)`).
- Hover viền taupe; focus viền `--border-strong` + `--focus-ring`.

### Card (`.card`)
Khối chung: nền `--surface`, viền mảnh, bo `--radius-md`, padding 24px, không bóng. Các loại thẻ chuyên biệt (thẻ công cụ, thẻ tài liệu) theo [CARD_DESIGN_RULES.md](CARD_DESIGN_RULES.md).

### Chip (`.chip`), Alert, GPS chip
Chip: viền mảnh, nền trong, chữ hoa nhỏ. Alert: nền rất nhạt theo trạng thái, vạch trái 2px. GPS chip: chấm trạng thái, nhấp nháy khi đang chờ định vị.

### Điều hướng
Thanh bên (`.ad-navbtn`) cho các mục chính. Trên điện thoại, công cụ "Định vị điểm bán" dùng thanh tab dưới (`.tabbar`).

### Tab (`.tabs` + `.tab-item`)
**Một kiểu tab chữ duy nhất** cho mọi nơi: tab của công cụ (Định vị điểm bán, Bố trận điểm bán), tab trong popup bản đồ, chọn cách thêm bài học.
- Khung `.tabs`: hàng ngang, kẻ dưới `--border`, các tab cách nhau 24px.
- `.tab-item`: chữ hoa `--fs-xs` đậm 500, giãn `--tracking-label`, màu `--muted`; hover `--text`; tab đang chọn (`.is-active`) chữ `--text` và **vạch ink 2px** ở chân. Có thể kèm icon 18px.
- `.tabs-sm`: bản nhỏ cho popup và form (cách nhau 16px, padding dọc 6px).
- Dùng `role="tablist"`/`role="tab"` + `aria-selected` khi đổi màn hình; dùng `role="group"` + `aria-pressed` khi chỉ chọn chế độ trong form.

### Đang tải (`Loading`)
Component [src/Loading.jsx](../src/Loading.jsx): vòng quay `.spinner` (16px, tròn) kèm chữ xám, mặc định "Đang tải...". Dùng `<Loading />` trong trang, `<Loading full />` khi khởi động app. Không viết chữ "Đang tải..." trơn cho trạng thái tải cả trang hoặc cả khối; chữ trên nút đang chạy ("Đang lưu...") thì giữ như cũ.

### Hộp xác nhận (`confirmDialog`)
Hàm [src/ConfirmDialog.jsx](../src/ConfirmDialog.jsx): `await confirmDialog({ title, message, confirmLabel, cancelLabel, danger })`, trả về `true`/`false`. **Không dùng `window.confirm`.** Hộp bo `--radius-md`, nền `--surface`, backdrop `--overlay`, mở bằng fade + rise. Nút "Hủy" (`btn-ghost`) bên trái, nút xác nhận bên phải; khi `danger` thì nút xác nhận là `btn-primary is-danger` và focus nằm sẵn ở "Hủy". Esc hoặc bấm ra ngoài là hủy.

### PageHeader (`.page-head`)
Eyebrow đánh số hoặc nhãn, tiêu đề serif cỡ lớn, mô tả một dòng. Dùng ở các trang nội dung của app nhân viên.

### Màn hình đăng nhập
Chia đôi từ 900px: **trái là khung thương hiệu nền đen** (logo cạnh khối chữ "NỀN TẢNG NỘI BỘ", MOBIUS, đường vàng, một câu mô tả, hai đường cong vàng mảnh), **phải là form** theo giao diện hiện tại. Dưới 900px khung thương hiệu thành dải đầu trang gọn. Dùng chung với màn hình đổi mật khẩu.

### Bảng admin (`.ad-table`)
Tiêu đề chữ hoa `--fs-xs` (bảng gọn `--fs-2xs`), kẻ dưới đậm; hàng cách nhau đường mảnh, hover nền ivory. Ảnh thu nhỏ tỉ lệ 4:5.

### KPI admin (`.ad-kpi`), biểu đồ
Số liệu dẫn dắt bằng serif cỡ lớn, ngăn cột bằng đường kẻ dọc, không dùng card. Biểu đồ một màu ink trên rãnh cream, bo `--radius-sm`.

### Modal (`.ad-modal`)
Backdrop `--overlay`, hộp bo `--radius-md`, mở bằng fade + rise 300ms. Đóng bằng Esc, bấm ra ngoài hoặc nút đóng. Chỉ xác nhận có/không thì dùng `confirmDialog`, không tự dựng modal.

### Icon (`Icon`)
- Chỉ dùng [src/icons.jsx](../src/icons.jsx): SVG nét mảnh (`stroke` 1.8, đầu nét tròn, `viewBox` 24), màu theo chữ (`currentColor`). Cần icon mới thì vẽ thêm vào file này theo cùng kiểu nét. Không dùng thư viện icon ngoài, emoji hay ảnh PNG làm icon.
- Cỡ: **18px** trong nút, tab và hàng thao tác; **20px** ở thanh bên và thanh trên; **16px** cho chú thích nhỏ; 22–26px trong ô icon của thẻ và trạng thái rỗng; lớn hơn chỉ dùng cho minh họa.
- Icon đứng một mình phải nằm trong nút có `aria-label` và `title`. Icon cạnh chữ chỉ để trang trí (component đã tự gắn `aria-hidden`).

### Trạng thái rỗng, thông báo và lỗi
- **Trạng thái rỗng** (`.empty-state`): ô icon (`.module-icon`, icon 26px), tiêu đề serif (`.empty-title`), một câu mô tả `muted`, căn giữa. Nếu có thao tác tiếp theo thì thêm một nút. Danh sách phụ bên trong trang quản trị có thể chỉ dùng một dòng `muted` ("Chưa có ...").
- **Thông báo** (`.alert`): nền rất nhạt, vạch trái 2px theo màu trạng thái, bo `--radius-sm`, đặt ngay trên khối liên quan.
  - Lỗi dùng `alert alert-error` (`role="alert"` nếu xuất hiện sau thao tác).
  - Thành công trong admin dùng `alert ad-notice`.
  - Thông tin trung tính dùng `alert`.
- **Lỗi của một ô nhập** đặt ngay dưới ô, chữ `--danger-text` cỡ `--fs-md`, kèm `aria-invalid` trên ô.
- Không dùng `window.alert` hay `window.confirm`.

## Chữ trên giao diện
- Tiếng Việt có dấu đầy đủ, câu ngắn, xưng hô trung tính. Thông báo lỗi nói **điều gì sai và cách xử lý** ("File quá lớn (tối đa 50 MB).").
- Dữ liệu và JSX viết chữ thường hoặc viết hoa đầu câu; chữ hoa của nhãn, nút, tab do CSS (`text-transform`) tạo ra, không gõ sẵn chữ in hoa.
- Nút dùng động từ chỉ đúng việc sẽ làm ("Thêm bài học", "Xuất Excel", "Xóa"); không dùng "OK" hay "Có".
- Đang xử lý: đổi chữ trên nút thành "Đang lưu...", "Đang tải lên..." và khóa nút. Tải cả khối thì dùng `Loading`.
- Tên kỹ thuật hiển thị thành tên thân thiện (xem `displayTitle` trong `src/pages/lessonsApi.js`).
- Ngày hiển thị dạng `18/10/2026`. Số trong bảng, bộ đếm và tiến độ dùng `font-variant-numeric: tabular-nums` để các cột số thẳng hàng.

## Truy cập (accessibility)
- Thao tác là `<button>` (chuyển trang ra ngoài là `<a>`), danh sách là `<ul>/<li>`, bảng là `<table>`. Không gắn `onClick` vào `div` khi có thể dùng nút, và không lồng nút trong nút.
- Mọi phần tử bấm được có `:focus-visible` rõ (outline 2px `--text`, offset 2px; nút vàng dùng outline vàng).
- Vùng bấm tối thiểu 40 × 40px. Nút icon trong bảng dày có thể vẽ nhỏ hơn nhưng phải nới vùng bấm (xem `.ad-iconbtn`).
- Tab, nhóm chọn chế độ, hộp thoại, thông báo dùng đúng `role` và `aria-*` như đã ghi ở từng component. Hộp thoại giữ focus bên trong và trả focus về chỗ cũ khi đóng.
- Chữ trên nền vàng hoặc nền ảnh phải đọc được; trên ảnh luôn có lớp phủ tối.
- Tôn trọng `prefers-reduced-motion`.

## Khi thêm trang hoặc component mới
1. Đọc tài liệu này (và CARD_DESIGN_RULES.md nếu có thẻ). Tìm component có sẵn trước khi viết mới.
2. Trang trong menu nằm trong `AppShell`, dùng `.page-head` (eyebrow, tiêu đề, mô tả), lề `--ad-pad`, khoảng cách `--ad-gap`. Trang cần nhiều diện tích dùng `wide`.
3. CSS riêng của một khu vực đặt **tiền tố riêng** (`.ls-`, `.tm-`, `.ad-`...) và nằm trong file của khu vực đó. Không sửa selector dùng chung trong `styles.css` theo cách làm ảnh hưởng nơi khác. Kiểu dùng chung cho nhiều trang thì đưa vào `styles.css`.
4. React 18 và CSS thuần. Không dùng CSS-in-JS hay thư viện UI. `style={{...}}` chỉ cho giá trị động (màu theo dữ liệu, phần trăm tiến độ).
5. Không chép CSS từ file khác sang. Cần khác đi thì dùng biến thể (class phụ) của component gốc.

## Danh sách kiểm tra trước khi bàn giao
- [ ] Chỉ dùng token; không có mã màu, `font-size` rem, giãn chữ hay bo góc viết rời ngoài các ngoại lệ đã ghi; không có `--space-5`.
- [ ] Nút là `.btn` (một nút chính mỗi khu vực), tab là `.tabs`, xác nhận là `confirmDialog`, tải là `Loading`, icon là `Icon`.
- [ ] Bo góc đúng 3 mức; không có dạng viên thuốc.
- [ ] Chiều cao theo màn hình viết `calc(N * var(--v1))`, không viết `Nvh` (trừ khung bản đồ Leaflet).
- [ ] Sáng và tối đều đẹp; hover, focus bàn phím và disabled rõ ràng.
- [ ] Không tràn ngang ở 390px, 1024px, 1440px; chữ dài bị cắt bằng "...".
- [ ] Nút chỉ có icon có `aria-label` và `title`.
- [ ] `npm run build` thành công.