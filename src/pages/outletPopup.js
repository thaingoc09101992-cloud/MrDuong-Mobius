import { photoUrl, formatTime } from '../supabase.js'

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined && text !== null) node.textContent = text
  return node
}

/** Dựng popup bằng DOM + textContent để dữ liệu người dùng nhập không thể chèn mã HTML. */
export function buildPopup(o) {
  const box = el('div', 'popup')
  const img = document.createElement('img')
  img.src = photoUrl(o.photo_path)
  img.alt = `Ảnh ${o.name}`
  img.loading = 'lazy'
  const rotation = o.photo_rotation || 0
  if (rotation) {
    // Ảnh đã xoay: xem OutletPhoto.jsx (cùng kiểu 'cover')
    const wrap = el('span', `popup-img rot-cover${rotation === 90 || rotation === 270 ? ' is-quarter' : ''}`)
    wrap.style.setProperty('--rot', `${rotation}deg`)
    wrap.appendChild(img)
    box.appendChild(wrap)
  } else {
    img.className = 'popup-img'
    box.appendChild(img)
  }
  box.appendChild(el('strong', 'popup-title', o.name))
  if (o.address) box.appendChild(el('div', null, o.address))
  box.appendChild(el('div', 'popup-muted', `${o.channel || 'Chưa chọn loại hình'} - ${formatTime(o.captured_at)}`))
  box.appendChild(
    el('div', 'popup-muted', `NV: ${o.employee_name ? `${o.employee_name} (${o.employee_code})` : o.employee_code}`),
  )
  return box
}