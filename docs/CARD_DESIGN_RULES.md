# Quy tắc thiết kế thẻ (Card) cho toàn dự án MOBIUS

**Bắt buộc tuân thủ** cho mọi thẻ, hàng danh sách dạng thẻ và khối nội dung dạng thẻ (kể cả loại thẻ mới phát triển thêm). Chỉ được thay đổi khi chủ dự án yêu cầu rõ ràng; khi đổi thì cập nhật file này cùng lúc với code.

Các loại thẻ hiện có:

| Loại thẻ | Nơi dùng | Mã nguồn | Quy tắc riêng |
|---|---|---|---|
| Thẻ công cụ | Home, Công cụ, Kiến thức | `ToolGrid` trong `src/pages/sections.jsx`, CSS `.module-*` | [TOOL_CARD_SPEC.md](TOOL_CARD_SPEC.md) |
| Thẻ tài liệu (bài học) | Kiến thức → Bài học, Admin → Bài học | `src/pages/LessonCard.jsx`, CSS `.ls-card` trong `src/pages/lessons.css` | Mục 3 bên dưới |

Thẻ mới phải **tái sử dụng** component và CSS sẵn có khi cùng loại, không tạo bản trùng lặp. Thẻ thuộc loại mới thì áp dụng mục 1 và 2, rồi bổ sung một mục riêng vào file này.

## 1. Quy tắc chung cho mọi loại thẻ

> Token màu, bo góc, khoảng cách, chuyển động nằm ở [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) (nguồn duy nhất). Phần dưới chỉ nêu **cách áp dụng cho thẻ**.

### Độ bo góc (quan trọng, hay sai)
- **Thẻ: `--radius-md` (4px). Ô vuông chứa icon bên trong thẻ: `--radius-lg` (8px).** Nút và ô nhập trong thẻ: `--radius-sm`/`--radius-md` theo component nền. Không bao giờ viết số px rời, không bo 12px hay dạng viên thuốc, không bo quá 8px.
- Hình tròn (`50%`) chỉ cho nút mũi tên tròn của thẻ công cụ, avatar, chấm trạng thái, vòng quay loading; không dùng cho khung thẻ hay nút chữ.
- Thẻ và nút ở cùng một khu vực phải cùng mức bo.

### Viền, bóng, nền
- Viền 1px: `--border` (mặc định), `--border-strong` khi hover hoặc focus. Thẻ công cụ dùng `--color-taupe` ở chế độ sáng theo quy tắc riêng.
- Bóng đổ: **thẻ công cụ không có bóng**. Thẻ dạng hàng (như thẻ tài liệu) chỉ được bóng rất nhẹ: `0 1px 2px rgba(17,17,17,.05)`, hover `0 2px 6px rgba(17,17,17,.07)`; chế độ tối `0 1px 2px rgba(0,0,0,.4)`. Không bóng nặng.
- Không gradient trang trí, glassmorphism hay hiệu ứng rườm rà (ngoại lệ duy nhất: gradient phủ ảnh tiêu đề của thẻ công cụ để chữ đọc được).
- Nền thẻ `--surface`; nền phụ (ô icon, vùng nhấn nhẹ) `--surface-2`.

### Màu
- Chỉ dùng token ngữ nghĩa và token vàng; không viết mã màu rời. Cảnh báo/xóa dùng `--danger-text`. Chữ trên nền vàng là `#111111`.
- Vàng champagne chỉ dùng cho nhãn phân loại, ô icon dạng nhấn vàng và **nút hành động chính của thẻ**. Không dùng vàng cho nền cả thẻ hay chữ nội dung.
- Thẻ phải đẹp ở **cả chế độ sáng và tối** chỉ nhờ token.
### Chữ
- Tên công cụ: Cormorant Garamond (`--font-editorial`) đậm 700. Tên tài liệu và các thẻ dạng hàng: font giao diện (Be Vietnam Pro) đậm 600, cỡ khoảng 1.05rem, một dòng, cắt bằng dấu "..." khi dài.
- Mô tả: `--muted`, khoảng 0.9-0.95rem, giới hạn 2 dòng (thẻ công cụ) bằng `-webkit-line-clamp`.
- Metadata: `--muted`, khoảng 0.78rem, ngăn bằng dấu `·`.
- Hiển thị tên thân thiện: tên kỹ thuật như `AI_History_and_Evolution` hiển thị thành `AI History & Evolution` (xem `displayTitle` trong `src/pages/lessonsApi.js`). Ưu tiên tên hiển thị đã lưu trong dữ liệu.

### Khoảng cách
Dùng token khoảng cách (xem DESIGN_SYSTEM.md; không có `--space-5`).

### Nút trong thẻ
- Nút phụ (đổi tên, xóa, hủy): nền `--surface`, viền `--border`, bo `--radius-md`, cao 44px, hover viền `--border-strong`.
- Nút hành động chính của thẻ (ví dụ "Mở tài liệu"): **vàng champagne** (`--gold`, chữ `#111111`, đậm 600), hover `--gold-soft`.
- Nút xóa: hover đổi sang `--danger-text`, không đỏ sẵn.
- Nút chỉ có icon: bắt buộc có `aria-label` và `title` (tooltip); vùng bấm tối thiểu 40 × 40px (hiện dùng 44px).
- Không lồng `<button>` trong `<button>`. Khi cả thẻ bấm được, các nút con phải chặn lan sự kiện (`stopPropagation`) để bấm đổi tên hoặc xóa không kích hoạt việc mở.

### Tương tác và truy cập
- Hover: viền rõ hơn, nhích lên tối đa 2px (chỉ thẻ công cụ). Không phóng to.
- `:focus-visible` luôn có outline rõ ở cả hai chế độ (2px, offset 2px; nút vàng dùng outline vàng đậm hoặc nhạt).
- Giữ semantic: thao tác chính là `<button>`, danh sách là `<ul>/<li>`.
- Tôn trọng `prefers-reduced-motion` (luật toàn cục đã tắt animation và transition).

### Responsive
- Không tràn ngang ở 390px, 1024px, 1440px; tên dài được cắt bằng "...".
- Màn hình nhỏ: nút chính có thể chuyển thành nút icon nhưng vẫn có `aria-label` và tooltip.
- Các thẻ trong cùng một hàng lưới cao bằng nhau.

### Kỹ thuật
- React 18 và CSS thuần, không cài thêm thư viện cho việc trang trí thẻ.
- CSS của loại thẻ riêng đặt tiền tố riêng (`.module-`, `.ls-`, `.tm-`), **không sửa các selector dùng chung** trong `styles.css` nếu có thể ảnh hưởng nơi khác.
- Không hardcode nội dung riêng cho một thẻ trong component; mọi nội dung đọc từ dữ liệu.

## 2. Danh sách kiểm tra cho mọi thẻ mới hoặc thẻ sửa

- [ ] Độ bo góc đúng token (thẻ 4px, ô icon 8px), không có bo 12px hay hình viên thuốc.
- [ ] Chỉ dùng token màu và khoảng cách; không dùng `--space-5`.
- [ ] Nút hành động chính màu vàng champagne; nút chỉ có icon có `aria-label` và `title`.
- [ ] Sáng và tối đều đẹp; hover và focus bàn phím rõ.
- [ ] Không tràn ở 390px, 1024px, 1440px; tên dài bị cắt bằng "...".
- [ ] Bấm nút phụ không kích hoạt hành động mở của cả thẻ.
- [ ] `npm run build` thành công.

## 3. Thẻ tài liệu (bài học)

Thành phần: `LessonCard` ([src/pages/LessonCard.jsx](../src/pages/LessonCard.jsx)), dùng chung cho trang nhân viên (chỉ mở) và trang quản trị (thêm đổi tên và xóa). Không tạo bản sao.

**Bố cục (desktop):** lưới 3 cột `auto | 1fr | auto`, khoảng cách 16px, padding 16px dọc và 20px ngang.
- **Trái:** ô vuông 52 × 52px, bo `--radius-lg`, icon tài liệu màu vàng champagne trên nền vàng nhạt (`--gold` pha 16% vào `--surface`); icon `--gold-deep` ở chế độ sáng, `--gold` ở chế độ tối.
- **Giữa:** tên (đậm 600, một dòng, cắt "..."), mô tả (tối đa 2 dòng), metadata dạng `Tài liệu · 18/10/2026 · 425 KB`.
- **Phải:** nút vàng "Mở tài liệu" kèm icon mở; trang quản trị có thêm nút đổi tên (bút chì) và nút xóa (thùng rác) ngay cạnh.

**Hai nguồn bài học:** file PDF lưu ở Supabase Storage (mở bằng `PdfViewer`), hoặc liên kết Google Drive (dạng `https://drive.google.com/file/d/<id>/preview`, cột `source_url`, mở bằng `EmbedViewer`). Bài học mới chỉ thêm bằng Google Drive; bài học cũ dùng OneDrive vẫn xem được. `LessonViewer` chọn trình xem theo nguồn; thẻ hiển thị giống nhau, chỉ dòng metadata khác (`Google Drive · ngày` hoặc `OneDrive · ngày` thay cho `Tài liệu · ngày · dung lượng`). Giao diện chỉ nhận liên kết https của Google Drive (kiểm tra ở cả giao diện và cơ sở dữ liệu); khung nhúng dùng `sandbox`.

**Đổi tên (chỉ admin):** chỉnh trực tiếp trên thẻ.
- Tự focus và chọn toàn bộ tên; `Enter` lưu, `Esc` hủy; có nút dấu tích và nút X rõ ràng.
- Cắt khoảng trắng hai đầu, không cho rỗng, tối đa 120 ký tự (kiểm tra cả ở giao diện và ở hàm cơ sở dữ liệu `app_rename_lesson`).
- Trong lúc lưu có vòng quay loading và khóa thao tác lặp; lỗi thì giữ tên cũ và hiện thông báo; thành công thì cập nhật ngay không cần tải lại.
- Chỉ đổi cột `title`; không đổi đường dẫn hay tên file trong Storage.
- Quyền admin phải được kiểm tra ở phía máy chủ, không chỉ ẩn nút.

**Màn hình nhỏ (dưới 640px):** hàng nút chuyển xuống dưới và căn phải, "Mở tài liệu" thành nút icon vuông 44px (vẫn có `aria-label` và tooltip), ô icon thu còn 44px.

**Trình xem tài liệu** (`PdfViewer.jsx`): khung xem chiếm gần hết chiều cao màn hình, hỗ trợ nút chuyển trang, phím mũi tên, lăn chuột và toàn màn hình. Đây không phải thẻ nhưng dùng cùng token và bo góc `--radius-md`.