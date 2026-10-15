export function pad(n) {
  return String(n).padStart(2, '0')
}

/** Khóa ngày theo giờ địa phương, dạng YYYY-MM-DD. */
export function dayKey(input) {
  const d = input instanceof Date ? input : new Date(input)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Chuẩn hóa để tìm kiếm không phân biệt hoa thường và dấu tiếng Việt. */
export function fold(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export function applyFilters(rows, f) {
  const q = fold(f.q.trim())
  return rows.filter((o) => {
    if (f.employee && o.employee_code !== f.employee) return false
    if (f.channel && (o.channel || '') !== f.channel) return false
    if (f.from || f.to) {
      const k = dayKey(o.captured_at)
      if (f.from && k < f.from) return false
      if (f.to && k > f.to) return false
    }
    if (q) {
      const hay = fold(`${o.name} ${o.address || ''} ${o.employee_code} ${o.employee_name || ''}`)
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export const EMPTY_FILTERS = { q: '', employee: '', channel: '', from: '', to: '' }

export function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
