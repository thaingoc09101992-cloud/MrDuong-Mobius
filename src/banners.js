import { supabase } from './supabase.js'

export const BANNER_BUCKET = 'banners'
export const BANNER_SLOTS = [1, 2, 3, 4, 5]
export const BANNER_SIZE_HINT = '1920 × 800 px (tỉ lệ 12:5)'
export const BANNER_MAX_FILE = 8 * 1024 * 1024 // ảnh gốc tối đa 8MB, sẽ được thu nhỏ trước khi tải lên

export function bannerUrl(path) {
  return supabase.storage.from(BANNER_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Lấy các banner. onlyActive = true: chỉ những banner đang hiển thị (dùng cho trang chủ). */
export async function fetchBanners(onlyActive) {
  let q = supabase.from('banners').select('*').order('slot', { ascending: true })
  if (onlyActive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Không đọc được ảnh. Vui lòng chọn file JPG, PNG hoặc WebP.'))
    }
    img.src = url
  })
}

/** Thu nhỏ ảnh về rộng tối đa 1920px và nén JPEG để tải nhanh. */
export async function prepareBannerImage(file, maxWidth = 1920) {
  const img = await loadImage(file)
  const scale = Math.min(1, maxWidth / img.naturalWidth)
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff' // nền trắng cho ảnh PNG trong suốt
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
  if (!blob) throw new Error('Không xử lý được ảnh. Vui lòng thử ảnh khác.')
  return blob
}
