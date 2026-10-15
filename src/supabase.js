import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export const BUCKET = 'outlet-photos'
export const MAX_ACCURACY_M = 50

export const CHANNELS = [
  'Tạp hóa',
  'Siêu thị mini',
  'Cửa hàng tiện lợi',
  'Đại lý / Nhà phân phối',
  'Quán cà phê / Ăn uống',
  'Trường học / Bệnh viện / Cơ quan',
  'Khác',
]

export const CODE_PATTERN = /^[A-Z0-9_-]{3,20}$/

export function photoUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function safeGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSet(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* bỏ qua khi trình duyệt chặn lưu trữ */
  }
}
