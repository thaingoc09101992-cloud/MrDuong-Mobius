import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase.js'
import Icon from '../icons.jsx'
import { LESSON_BUCKET, LESSON_MAX_FILE, listLessons, lessonError, formatSize } from '../pages/lessonsApi.js'
import '../pages/lessons.css'

/** Quản lý bài học (PDF): chỉ admin tải lên và xóa. Nhân viên xem ở mục Kiến thức → Bài học. */
export default function Lessons() {
  const fileRef = useRef(null)
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setLessons(await listLessons())
    } catch (err) {
      setError(lessonError(err))
      setLessons([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function pickFile(e) {
    const f = e.target.files && e.target.files[0]
    setNotice('')
    if (!f) return
    if (!/\.pdf$/i.test(f.name) || (f.type && f.type !== 'application/pdf')) {
      setNotice('Chỉ nhận file PDF. Hãy xuất slide ra PDF rồi tải lên.')
      e.target.value = ''
      return
    }
    if (f.size > LESSON_MAX_FILE) {
      setNotice('File quá lớn (tối đa 50 MB).')
      e.target.value = ''
      return
    }
    setFile(f)
    if (!title.trim()) setTitle(f.name.replace(/\.pdf$/i, ''))
  }

  function resetForm() {
    setTitle('')
    setDescription('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit(e) {
    e.preventDefault()
    if (!title.trim() || !file) return
    setBusy(true)
    setNotice('')
    const path = `${crypto.randomUUID()}.pdf`
    const up = await supabase.storage.from(LESSON_BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: false })
    if (up.error) {
      setBusy(false)
      setNotice(lessonError(up.error))
      return
    }
    const { error: err } = await supabase.rpc('app_add_lesson', {
      p_title: title.trim(),
      p_description: description.trim(),
      p_file_path: path,
      p_file_size: file.size,
    })
    if (err) {
      await supabase.storage.from(LESSON_BUCKET).remove([path]) // không để lại file mồ côi
      setBusy(false)
      setNotice(lessonError(err))
      return
    }
    setBusy(false)
    resetForm()
    setNotice('Đã thêm bài học.')
    load()
  }

  async function remove(lesson) {
    if (!window.confirm(`Xóa bài học "${lesson.title}"? Không thể hoàn tác.`)) return
    setNotice('')
    const { data, error: err } = await supabase.rpc('app_delete_lesson', { p_id: lesson.id })
    if (err) {
      setNotice(lessonError(err))
      return
    }
    if (data) await supabase.storage.from(LESSON_BUCKET).remove([data])
    load()
  }

  return (
    <div className="stack ls">
      <p className="muted small">
        Tải file PDF (xuất từ PowerPoint hoặc Google Slides, tối đa 50 MB). Nhân viên xem ở mục Kiến thức, Bài học; chỉ quản trị viên tải lên và xóa được.
      </p>

      {notice && <div className="alert">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <form className="card ls-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Tên bài học</span>
          <input value={title} maxLength={200} disabled={busy} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Quy trình chăm sóc điểm bán" />
        </label>
        <label className="field">
          <span>Mô tả ngắn (không bắt buộc)</span>
          <input value={description} maxLength={1000} disabled={busy} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="ls-file">
          <button type="button" className="ls-btn" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}>
            <Icon name="upload" size={18} />
            <span>{file ? 'Chọn file khác' : 'Chọn file PDF'}</span>
          </button>
          <span className="muted">{file ? `${file.name} (${formatSize(file.size)})` : 'Chưa chọn file.'}</span>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={pickFile} />
        </div>
        <div className="ls-form-actions">
          <button type="submit" className="ls-btn ls-btn-primary" disabled={busy || !title.trim() || !file}>
            {busy ? 'Đang tải lên...' : 'Thêm bài học'}
          </button>
        </div>
      </form>

      {loading && <p className="muted">Đang tải...</p>}
      {!loading && !error && lessons.length === 0 && <p className="muted">Chưa có bài học nào.</p>}

      <ul className="ls-list">
        {lessons.map((l) => (
          <li key={l.id} className="ls-item">
            <div className="ls-open ls-row">
              <span className="ls-icon">
                <Icon name="book" size={22} />
              </span>
              <span className="ls-text">
                <strong>{l.title}</strong>
                {l.description && <span className="ls-desc">{l.description}</span>}
                <small className="muted">
                  {new Date(l.created_at).toLocaleDateString('vi-VN')}
                  {l.file_size ? ` · ${formatSize(l.file_size)}` : ''}
                </small>
              </span>
            </div>
            <button type="button" className="ls-btn ls-btn-icon" aria-label={`Xóa bài học ${l.title}`} title="Xóa" onClick={() => remove(l)}>
              <Icon name="trash" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}