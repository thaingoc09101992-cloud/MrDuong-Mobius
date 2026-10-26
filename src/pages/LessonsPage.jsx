import { useEffect, useState } from 'react'
import Icon from '../icons.jsx'
import Loading from '../Loading.jsx'
import LessonViewer from './LessonViewer.jsx'
import LessonCard from './LessonCard.jsx'
import VideoCard from './VideoCard.jsx'
import { listLessons, lessonError } from './lessonsApi.js'
import './lessons.css'

const COPY = {
  lesson: {
    eyebrow: 'Kiến thức',
    title: 'Bài học',
    sub: 'Chọn một bài học để xem ngay trong MOBIUS.',
    icon: 'book',
    emptyTitle: 'Chưa có bài học nào',
    emptyText: 'Các bài học sẽ được cập nhật tại đây.',
  },
  video: {
    eyebrow: 'Đào tạo',
    title: 'Video đào tạo',
    sub: 'Chọn một video để xem ngay trong MOBIUS. Đây là nội dung nội bộ, vui lòng không chia sẻ ra ngoài.',
    icon: 'play',
    emptyTitle: 'Chưa có video nào',
    emptyText: 'Các video hướng dẫn và đào tạo nghiệp vụ sẽ được cập nhật tại đây.',
  },
}

/** Danh sách bài học hoặc video để xem (kind = 'lesson' | 'video'). Việc thêm và xóa chỉ có ở trang quản trị (/admin). */
export default function LessonsPage({ onBack, kind = 'lesson' }) {
  const copy = COPY[kind]
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [active, setActive] = useState(null)

  useEffect(() => {
    let alive = true
    listLessons(kind)
      .then((list) => alive && setLessons(list))
      .catch((err) => alive && setError(lessonError(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [kind])

  if (active) return <LessonViewer lesson={active} onClose={() => setActive(null)} />

  return (
    <section className="stack ls">
      <header className="page-head">
        <span className="eyebrow">{copy.eyebrow}</span>
        <h2 className="page-title">{copy.title}</h2>
        <p className="page-sub">{copy.sub}</p>
      </header>

      {onBack && (
        <div className="ls-top">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            <Icon name="chevron-left" size={18} />
            <span>Kiến thức</span>
          </button>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <Loading />}
      {!loading && !error && lessons.length === 0 && (
        <div className="empty-state">
          <span className="module-icon">
            <Icon name={copy.icon} size={26} />
          </span>
          <strong className="empty-title">{copy.emptyTitle}</strong>
          <p className="muted">{copy.emptyText}</p>
        </div>
      )}

      {kind === 'video' ? (
        <div className="module-grid">
          {lessons.map((v) => (
            <VideoCard key={v.id} video={v} onOpen={setActive} />
          ))}
        </div>
      ) : (
        <ul className="ls-list">
          {lessons.map((l) => (
            <LessonCard key={l.id} lesson={l} onOpen={setActive} />
          ))}
        </ul>
      )}
    </section>
  )
}