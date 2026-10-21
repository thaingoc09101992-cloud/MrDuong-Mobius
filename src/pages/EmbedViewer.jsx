import { useEffect, useRef, useState } from 'react'
import Icon from '../icons.jsx'
import useFullscreen from './useFullscreen.js'
import { displayTitle, sourceLabel } from './lessonsApi.js'

// Trình xem của Google Drive hiển thị trang tài liệu ở bề rộng cố định khoảng 960px dù khung rộng hơn nhiều.
// Ta dựng khung ở bề rộng gốc này rồi phóng to bằng CSS cho vừa khít chiều ngang của vùng xem.
const DRIVE_BASE_WIDTH = 1000
const DRIVE_MAX_SCALE = 2.5

/** Xem bài học dạng liên kết nhúng (Google Drive; bài học cũ dùng OneDrive vẫn xem được). Nội dung do nhà cung cấp hiển thị trong khung. */
export default function EmbedViewer({ lesson, onClose }) {
  const wrapRef = useRef(null)
  const [fullscreen, toggleFullscreen] = useFullscreen(wrapRef)
  const stageRef = useRef(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const name = displayTitle(lesson.title)
  const source = sourceLabel(lesson.source_url)
  const isDrive = source === 'Google Drive'

  // Theo dõi kích thước vùng xem (đổi khi thu phóng cửa sổ hoặc vào toàn màn hình)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = isDrive && stage.w > DRIVE_BASE_WIDTH ? Math.min(stage.w / DRIVE_BASE_WIDTH, DRIVE_MAX_SCALE) : 1
  const frameStyle =
    scale > 1
      ? { width: DRIVE_BASE_WIDTH, height: stage.h / scale, transform: `scale(${scale})`, transformOrigin: '0 0' }
      : undefined

  return (
    <section className={`ls-viewer ${fullscreen ? 'ls-full' : ''}`} ref={wrapRef}>
      <div className="ls-vbar">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          <Icon name="chevron-left" size={18} />
          <span>Danh sách</span>
        </button>
        <strong className="ls-vtitle" title={name}>{name}</strong>
        <div className="ls-pager">
          <a className="btn btn-ghost" href={lesson.source_url} target="_blank" rel="noopener noreferrer" aria-label={`Mở trong ${source} (tab mới)`} title={`Mở trong ${source}`}>
            <Icon name="open" size={18} />
            <span>Mở trong {source}</span>
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label={fullscreen ? 'Thoát toàn màn hình' : 'Xem toàn màn hình'}
            title={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            onClick={toggleFullscreen}
          >
            <Icon name={fullscreen ? 'collapse' : 'expand'} size={18} />
          </button>
        </div>
      </div>
      <div className="ls-stage ls-stage-embed" ref={stageRef}>
        <iframe
          className="ls-frame"
          style={frameStyle}
          src={lesson.source_url}
          title={name}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
        />
      </div>
    </section>
  )
}