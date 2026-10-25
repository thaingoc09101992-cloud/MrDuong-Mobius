import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'app-auth',
    },
  },
)

export const BUCKET = 'outlet-photos'
export const MAX_ACCURACY_M = 50

export const CHANNELS = [
  'Circle K',
  'MiniStop',
  'FamilyMart',
  'GS25',
  '7-Eleven',
  'Ohmee',
  'VinMart +',
  'Bách Hóa Xanh',
  'CoopFood',
  'SatraFood',
  'Avakids',
  'Kingfood',
  'NNDD Nuti',
  'CoopMart',
  'Big-C',
  'VinMart',
  'Aeon',
  'LotteMart',
  'MegaMarket',
  'CoopExtra',
  'Emart',
  'Lan chi',
  'Khác',
]

export const CODE_PATTERN = /^[A-Z0-9_-]{3,20}$/

// Chỉ email thuộc các tên miền công ty mới được tạo tài khoản (cũng được kiểm tra ở cơ sở dữ liệu)
export const COMPANY_DOMAINS = ['thophat.vn', 'kdc.vn']

export function normalizePhone(value) {
  return String(value || '').replace(/[\s.\-()]/g, '')
}

// 9 đến 12 chữ số, có thể bắt đầu bằng +
export function isPhone(value) {
  return /^\+?[0-9]{9,12}$/.test(String(value || ''))
}

export function isCompanyEmail(email) {
  const m = /^[a-z0-9._%+-]+@([a-z0-9.-]+)$/i.exec(String(email || '').trim())
  return Boolean(m) && COMPANY_DOMAINS.includes(m[1].toLowerCase())
}

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
