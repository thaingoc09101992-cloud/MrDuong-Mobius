import { useState } from 'react'
import Icon from '../icons.jsx'
import { displayTitle, driveThumbnail } from './lessonsApi.js'

/**
 * Thẻ video của trang nhân viên: cùng ngôn ngữ thiết kế và cùng CSS với thẻ công cụ (.module-*),
 * ảnh phần đầu là thumbnail của video trên Google Drive. Không có thumbnail (chưa tạo xong hoặc lỗi tải) thì
 * phần đầu vẫn là nền tối với icon và tên. Quy tắc: docs/CARD_DESIGN_RULES.md mục 4.
 */
export default function VideoCard({ video, onOpen }) {
  const [broken, setBroken] = useState(false)
  const name = displayTitle(video.title)
  const thumb = broken ? '' : driveThumbnail(video.source_url)

  return (
    <button type="button" className="module-card video-card" onClick={() => onOpen(video)} aria-label={`Xem video ${name}`}>
      <span className="module-head has-cover video-head">
        {thumb && <img className="video-thumb" src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />}
        <span className="module-icon">
          <Icon name="play" size={26} />
        </span>
        <span className="module-id">
          <span className="module-kicker">Video đào tạo</span>
          <span className="module-name">{name}</span>
        </span>
      </span>
      <span className="module-body">
        <span className="module-desc">{video.description}</span>
        <span className="module-foot">
          <span className="module-go">Xem video</span>
          <span className="module-arrow" aria-hidden="true">
            <Icon name="arrow-right" size={18} />
          </span>
        </span>
      </span>
    </button>
  )
}