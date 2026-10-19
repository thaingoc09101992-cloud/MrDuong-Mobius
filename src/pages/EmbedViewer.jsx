import { useRef } from 'react'
import Icon from '../icons.jsx'
import useFullscreen from './useFullscreen.js'
import { displayTitle, sourceLabel } from './lessonsApi.js'

/** Xem bài học dạng liên kết nhúng (Google Drive; bài học cũ dùng OneDrive vẫn xem được). Nội dung do nhà cung cấp hiển thị trong khung. */
export default function EmbedViewer({ lesson, onClose }) {
  const wrapRef = useRef(null)
  const [fullscreen, toggleFullscreen] = useFullscreen(wrapRef)
  const name = displayTitle(lesson.title)
  const source = sourceLabel(lesson.source_url)

  return (
    <section className={`ls-viewer ${fullscreen ? 'ls-full' : ''}`} ref={wrapRef}>
      <div className="ls-vbar">
        <button type="button" className="ls-btn" onClick={onClose}>
          <Icon name="chevron-left" size={18} />
          <span>Danh sách</span>
        </button>
        <strong className="ls-vtitle" title={name}>{name}</strong>
        <div className="ls-pager">
          <a className="ls-btn" href={lesson.source_url} target="_blank" rel="noopener noreferrer" aria-label={`Mở trong ${source} (tab mới)`} title={`Mở trong ${source}`}>
            <Icon name="open" size={18} />
            <span>Mở trong {source}</span>
          </a>
          <button
            type="button"
            className="ls-btn ls-btn-icon"
            aria-label={fullscreen ? 'Thoát toàn màn hình' : 'Xem toàn màn hình'}
            title={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            onClick={toggleFullscreen}
          >
            <Icon name={fullscreen ? 'collapse' : 'expand'} size={18} />
          </button>
        </div>
      </div>
      <div className="ls-stage ls-stage-embed">
        <iframe
          className="ls-frame"
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