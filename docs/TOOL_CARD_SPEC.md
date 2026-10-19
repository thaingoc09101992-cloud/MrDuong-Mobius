# Quy tắc thiết kế thẻ công cụ (Tool Card)

**Bắt buộc tuân thủ.** Chỉ được thay đổi khi chủ dự án yêu cầu rõ ràng việc thay đổi quy tắc này. Khi thay đổi, cập nhật file này cùng lúc với code.

> Quy tắc chung cho **mọi loại thẻ** (bo góc, viền, bóng, màu, nút, tương tác) nằm ở [CARD_DESIGN_RULES.md](CARD_DESIGN_RULES.md); file này chỉ là phần riêng của thẻ công cụ. Khi hai file khác nhau thì thẻ công cụ theo file này.

Áp dụng cho mọi thẻ công cụ trong portal MOBIUS (trang Home và trang Công cụ), hiện được render bởi `ToolGrid` trong [src/pages/sections.jsx](../src/pages/sections.jsx), kiểu ở khối `.module-*` trong [src/styles.css](../src/styles.css). Thẻ mới hoặc loại thẻ phát triển thêm cũng phải theo cùng ngôn ngữ thiết kế này.

## 1. Dữ liệu bắt buộc của mỗi công cụ

Khai báo trong `MODULES` ở [src/modules.js](../src/modules.js). Thẻ đọc hết nội dung từ đây, không viết riêng cho một công cụ nào.

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `id` | Có | Dạng `kebab-case`, không dấu. Cũng là tên file ảnh. |
| `name` | Có | Tên công cụ, ngắn gọn, tối đa khoảng 28 ký tự để vừa một đến hai dòng. |
| `category` | Có | Nhãn phân loại, ví dụ `Công cụ thị trường`. Chữ thường trong dữ liệu, CSS tự in hoa. Thiếu thì thẻ dùng `Công cụ`, nhưng không được để thiếu khi thêm công cụ mới. |
| `desc` | Có | Một đến hai câu, tối đa 3 dòng hiển thị (CSS cắt bớt phần dư). |
| `icon` | Có | Tên icon có trong [src/icons.jsx](../src/icons.jsx). Cần icon mới thì thêm vào file này, không dùng thư viện ngoài. |
| `image` | **Có** | Ảnh tiêu đề đen trắng, xem mục 2. |

**Thẻ trong mục Kiến thức** (ví dụ "Bài học") dùng đúng cùng thiết kế và cùng bộ trường dữ liệu, khai báo trong `KNOWLEDGE_ITEMS` ở `src/modules.js` (với `category: 'Kiến thức'`). Các thẻ này không qua phân quyền chức năng, mọi nhân viên đều thấy.

### Quy tắc khi thiếu ảnh tiêu đề
Nếu người thiết kế hoặc AI được giao thêm một công cụ hay thẻ mới mà **chưa có ảnh tiêu đề thì phải dừng lại và yêu cầu chủ dự án cung cấp ảnh**. Không được tự chọn ảnh ngẫu nhiên, không tải ảnh từ internet, không dùng ảnh của công cụ khác, và không phát hành thẻ không ảnh. (Code vẫn hiển thị được thẻ khi thiếu `image` chỉ để tránh lỗi, đó không phải kiểu thiết kế được chấp nhận.)

## 2. Ảnh tiêu đề

- **Đen trắng** (grayscale) hoàn toàn. Chuyển đổi trước khi đưa vào dự án, không dựa vào CSS filter.
- Lưu tại `public/tools/<id>.jpg`, khai báo `image: '/tools/<id>.jpg'`.
- Kích thước khuyên dùng: rộng từ 1200px, tỉ lệ khoảng 3:1 (ví dụ 1200 × 400). Tối thiểu 780px. Thẻ cắt ảnh kiểu `cover`, căn giữa, nên chủ thể phải nằm vùng giữa.
- Dung lượng dưới khoảng 150 KB, JPEG chất lượng 85-88.
- Không có chữ, logo, watermark trong ảnh.
- **Đồng nhất sắc thái giữa các thẻ:** mọi ảnh tiêu đề phải cùng tông tối, độ sáng trung bình khoảng 100-140 trên thang 255. Ảnh nền sáng (bản đồ, giấy, tường trắng) phải được đảo tông hoặc làm tối trước khi dùng, để các thẻ đứng cạnh nhau không lệch sáng tối.
- Nội dung phù hợp công cụ, tông trầm, ít chi tiết sáng gắt ở nửa dưới (chữ trắng đè lên đó).

## 3. Cấu trúc thẻ

Toàn bộ thẻ là **một `<button class="module-card">`** (bấm được cả thẻ). Không đổi thành thẻ không tương tác, không thêm nút lồng bên trong.

```
module-card
├─ module-head (.has-cover khi có ảnh)   ← phần đầu: ảnh nền + icon + nhận diện
│   ├─ module-icon                       ← khung vuông 54px
│   └─ module-id
│       ├─ module-kicker                 ← category, chữ hoa nhỏ
│       └─ module-name                   ← tên công cụ, nổi bật nhất
└─ module-body                           ← phần thân, nền thẻ
    ├─ module-desc                       ← mô tả
    └─ module-foot                       ← neo đáy, có đường kẻ phía trên
        ├─ module-go                     ← "MỞ CÔNG CỤ"
        └─ module-arrow                  ← nút mũi tên tròn (icon arrow-right)
```

## 4. Thông số thiết kế

**Thẻ là `<button>`:** bắt buộc đặt `padding: 0` cho `.module-card` (kèm `overflow: hidden`). Nếu không, trình duyệt áp padding mặc định của nút và ảnh phần đầu bị hở khoảng trắng hai bên và phía trên. Ảnh phần đầu luôn **tràn sát viền thẻ** ở ba cạnh (trên, trái, phải); khoảng cách bên trong do `.module-head` và `.module-body` tự giữ.

**Phần đầu (có ảnh)**
- Cao tối thiểu 150px, ảnh `cover`, căn giữa, nền dự phòng `#1a1a1a`.
- Phủ gradient tối từ dưới lên: `rgba(10,10,10,.82)` ở đáy, `.5` ở 55%, `.28` ở đỉnh. Bắt buộc có để chữ trắng luôn đọc được.
- Icon và chữ nằm sát đáy phần đầu, căn `flex-end`, cách đáy 16px, cách lề 24px.
- Khung icon 54 × 54px, bo `--radius-lg`, nền trắng 16% kèm làm mờ nền (kính mờ), icon màu trắng.
- Nhãn `category`: cỡ 0.68rem, đậm 600, giãn chữ 0.12em, chữ hoa, màu `--gold-soft`.
- Tên: **Cormorant Garamond (`--font-editorial`), đậm 700**, cùng họ font với tiêu đề "Xin chào, …". Cỡ `clamp(1.75rem, 1.4rem + 1.1vw, 2.2rem)`, line-height 1.05, màu trắng.

**Phần thân**
- Padding 24px hai bên và phía trên, 16px phía dưới. Khoảng cách giữa mô tả và footer 24px.
- Mô tả: `--muted`, 0.95rem, line-height 1.6, tối đa 3 dòng, cách tên thêm 8px.
- Footer: neo xuống đáy thẻ bằng flexbox (`margin-top: auto`), có đường kẻ mảnh `--border` phía trên, padding-top 12px.
- "MỞ CÔNG CỤ": 0.78rem, đậm 600, giãn chữ 0.12em, chữ hoa.
- Nút mũi tên: tròn 40px, icon `arrow-right` 18px màu `#111111`. Nền `--gold-deep` (sáng), `--gold-soft` (tối).

**Thẻ không ảnh** (chỉ để dự phòng): nhãn dùng `--gold-deep` (sáng) / `--gold` (tối), tên dùng màu chữ thường.

## 5. Tương tác

- Hover: viền chuyển `--border-strong`, thẻ dịch lên tối đa 2px, nút mũi tên chuyển sang `--gold`.
- Focus bàn phím (`:focus-visible`): outline 2px màu `--text`, offset 2px.
- Không phóng to, không shadow nặng, không lớp phủ mô tả khi hover (đã thử và bị loại).
- Tôn trọng `prefers-reduced-motion` (luật toàn cục trong styles.css đã tắt animation và transition).

## 6. Bố cục lưới và responsive

- `.module-grid`: `repeat(auto-fill, minmax(min(100%, 340px), 1fr))`, khoảng cách `--space-4`.
- Điện thoại một cột, màn lớn tự chia cột. Các thẻ cùng hàng cao bằng nhau.
- Tên và mô tả không được tràn khỏi thẻ ở 390px, 1024px, 1440px.

## 7. Chế độ sáng và tối

- Dùng token có sẵn (`--surface`, `--surface-2`, `--border`, `--muted`, `--gold*`). Không viết mã màu rời, ngoại trừ gradient phủ ảnh và màu icon trong nút mũi tên.
- Chế độ sáng: nền trắng, chữ đen, mô tả xám trung tính.
- Chế độ tối: nền charcoal, chữ ngà, mô tả xám ấm, điểm nhấn vàng giữ nguyên.
- Phần đầu có ảnh giống nhau ở cả hai chế độ.

## 8. Việc không được làm

- Không hardcode nội dung riêng cho một công cụ trong component.
- Không thêm thư viện, không dùng CSS-in-JS, giữ React 18 và CSS thuần.
- Không dùng token không tồn tại (ví dụ `--space-5`; token khoảng cách hợp lệ: 1, 2, 3, 4, 6, 8, 12, 16, 20).
- Không đổi hành vi `onOpenTool` hay luồng phân quyền khi chỉnh giao diện thẻ.

## 9. Danh sách kiểm tra khi thêm công cụ hoặc thẻ mới

- [ ] Đủ 6 trường dữ liệu, `image` do chủ dự án cung cấp.
- [ ] Ảnh đen trắng, đúng kích thước, dưới 150 KB, đặt trong `public/tools/`.
- [ ] `npm run build` thành công.
- [ ] Ảnh phần đầu tràn sát viền thẻ, không hở khoảng trắng hai bên và phía trên.
- [ ] Kiểm tra chế độ sáng và tối.
- [ ] Kiểm tra ở 1440px, 1024px, 390px: tên và mô tả không tràn, các thẻ cùng hàng cao bằng nhau.
- [ ] Hover, focus bàn phím, và chữ tiếng Việt có dấu hiển thị đúng.