import { useEffect, useState } from 'react'
import Icon from '../icons.jsx'
import PdfViewer from './PdfViewer.jsx'
import LessonCard from './LessonCard.jsx'
import { listLessons, lessonError } from './lessonsApi.js'
import './lessons.css'

/** Danh sách bài học để xem. Việc tải lên và xóa chỉ có ở trang quản trị (/admin). */
export default function LessonsPage({ onBack }) {
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [active, setActive] = useState(null)

  useEffect(() => {
    let alive = true
    listLessons()
      .then((list) => alive && setLessons(list))
      .catch((err) => alive && setError(lessonError(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  if (active) return <PdfViewer lesson={active} onClose={() => setActive(null)} />

  return (
    <section className="stack ls">
      <header className="page-head">
        <span className="eyebrow">Kiến thức</span>
        <h2 className="page-title">Bài học</h2>
        <p className="page-sub">Chọn một bài học để xem ngay trong MOBIUS.</p>
      </header>

      <div className="ls-top">
        <button type="button" className="ls-btn" onClick={onBack}>
          <Icon name="chevron-left" size={18} />
          <span>Kiến thức</span>
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="muted">Đang tải...</p>}
      {!loading && !error && lessons.length === 0 && (
        <div className="empty-state">
          <span className="module-icon">
            <Icon name="book" size={26} />
          </span>
          <strong className="empty-title">Chưa có bài học nào</strong>
          <p className="muted">Các bài học sẽ được cập nhật tại đây.</p>
        </div>
      )}

      <ul className="ls-list">
        {lessons.map((l) => (
          <LessonCard key={l.id} lesson={l} onOpen={setActive} />
        ))}
      </ul>
    </section>
  )
}