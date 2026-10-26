import { useState } from 'react'
import { photoUrl } from './supabase.js'

/**
 * Ảnh điểm bán có tính đến góc xoay đã lưu (outlet.photo_rotation: 0, 90, 180, 270 độ theo chiều kim đồng hồ).
 * mode 'cover': ảnh nhỏ trong khung có kích thước cố định theo className, cắt vừa khung (ảnh thu nhỏ, danh sách).
 * mode 'fit': ảnh hiện nguyên vẹn, khung tự đổi tỉ lệ theo góc xoay (cửa sổ xem ảnh).
 */
export default function OutletPhoto({ outlet, alt = '', className = '', mode = 'cover', loading }) {
  const rotation = outlet.photo_rotation || 0
  const src = photoUrl(outlet.photo_path)
  const quarter = rotation === 90 || rotation === 270
  const [ratio, setRatio] = useState(null) // rộng / cao của ảnh gốc, chỉ cần cho mode 'fit'

  if (!rotation) return <img src={src} alt={alt} loading={loading} className={className} />

  if (mode === 'cover') {
    return (
      <span className={`${className} rot-cover ${quarter ? 'is-quarter' : ''}`} style={{ '--rot': `${rotation}deg` }}>
        <img src={src} alt={alt} loading={loading} />
      </span>
    )
  }

  const ar = ratio ? (quarter ? 1 / ratio : ratio) : 0.75
  return (
    <span className={`rot-fit ${quarter ? 'is-quarter' : ''}`} style={{ '--rot': `${rotation}deg`, '--ar': ar }}>
      <img src={src} alt={alt} onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
    </span>
  )
}