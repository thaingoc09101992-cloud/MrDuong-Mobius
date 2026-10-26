import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase.js'
import Icon from '../icons.jsx'
import Loading from '../Loading.jsx'
import { confirmDialog } from '../ConfirmDialog.jsx'
import {
  LESSON_BUCKET,
  LESSON_MAX_FILE,
  listLessons,
  renameLesson,
  uploadLessonFile,
  addLessonLink,
  parseEmbedInput,
  lessonError,
  formatSize,
  displayTitle,
} from '../pages/lessonsApi.js'
import LessonCard from '../pages/LessonCard.jsx'
import LessonViewer from '../pages/LessonViewer.jsx'
import '../pages/lessons.css'

/**
 * Quản lý bài học (PDF hoặc liên kết Google Drive) và video (liên kết Google Drive): chỉ admin thêm, đổi tên và xóa.
 * kind = 'lesson': nhân viên xem ở Kiến thức → Bài học; kind = 'video': xem ở mục Video đào tạo.
 */
export default function Lessons({ kind = 'lesson' }) {
  const isVideo = kind === 'video'
  const noun = isVideo ? 'video' : 'bài học'
  const fileRef = useRef(null)
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('link') // 'link' = dán liên kết Google Drive (mặc định), 'pdf' = tải file lên Supabase
  const [linkInput, setLinkInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(null)
  const [progress, setProgress] = useState(null) // { loaded, total } khi đang tải file lên
  const [stage, setStage] = useState(null) // 'upload' | 'save' | null
  const uploadRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setLessons(await listLessons(kind))
    } catch (err) {
      setError(lessonError(err))
      setLessons([])
    }
    setLoading(false)
  }, [kind])

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
    if (!title.trim()) setTitle(displayTitle(f.name.replace(/\.pdf$/i, '')))
  }

  function resetForm() {
    setTitle('')
    setDescription('')
    setFile(null)
    setLinkInput('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit(e) {
    e.preventDefault()
    if (mode === 'link') {
      const parsed = parseEmbedInput(linkInput)
      if (!title.trim() || parsed.error) {
        setNotice(parsed.error || `Hãy nhập tên ${noun}.`)
        return
      }
      setBusy(true)
      setNotice('')
      try {
        await addLessonLink(title.trim(), description.trim(), parsed.url, kind)
        resetForm()
        setNotice(`Đã thêm ${noun}.`)
        load()
      } catch (err) {
        setNotice(err && err.message ? err.message : 'Không thêm được. Vui lòng thử lại.')
      }
      setBusy(false)
      return
    }
    if (!title.trim()) {
      setNotice(`Hãy nhập tên ${noun}.`)
      return
    }
    if (!file) {
      setNotice('Hãy chọn file PDF.')
      return
    }
    setBusy(true)
    setNotice('')
    setStage('upload')
    setProgress({ loaded: 0, total: file.size })
    const path = `${crypto.randomUUID()}.pdf`
    const upload = uploadLessonFile(path, file, (loaded, total) => setProgress({ loaded, total }))
    uploadRef.current = upload
    try {
      await upload.promise
    } catch (err) {
      uploadRef.current = null
      setBusy(false)
      setStage(null)
      setProgress(null)
      setNotice(err && err.message ? err.message : 'Không tải lên được. Vui lòng thử lại.')
      return
    }
    uploadRef.current = null
    setProgress(null)
    setStage('save')
    const { error: err } = await supabase.rpc('app_add_lesson', {
      p_title: title.trim(),
      p_description: description.trim(),
      p_file_path: path,
      p_file_size: file.size,
    })
    if (err) {
      await supabase.storage.from(LESSON_BUCKET).remove([path]) // không để lại file mồ côi
      setBusy(false)
      setStage(null)
      setNotice(lessonError(err))
      return
    }
    setBusy(false)
    setStage(null)
    resetForm()
    setNotice(`Đã thêm ${noun}.`)
    load()
  }

  async function remove(lesson) {
    const ok = await confirmDialog({
      title: `Xóa ${noun} "${lesson.title}"?`,
      message: isVideo
        ? 'Video sẽ bị xóa khỏi mục Video đào tạo (file trên Google Drive không bị xóa). Thao tác này không thể hoàn tác.'
        : 'Bài học sẽ bị xóa khỏi mục Kiến thức. Thao tác này không thể hoàn tác.',
      confirmLabel: 'Xóa',
      danger: true,
    })
    if (!ok) return
    setNotice('')
    const { data, error: err } = await supabase.rpc('app_delete_lesson', { p_id: lesson.id })
    if (err) {
      setNotice(lessonError(err))
      return
    }
    if (data) await supabase.storage.from(LESSON_BUCKET).remove([data])
    load()
  }

  // Đổi tên hiển thị: chỉ cập nhật cột title; thẻ tự đổi ngay không cần tải lại trang
  async function rename(lesson, name) {
    const saved = await renameLesson(lesson.id, name)
    setLessons((list) => list.map((l) => (l.id === lesson.id ? { ...l, title: saved } : l)))
  }

  if (active) return <LessonViewer lesson={active} onClose={() => setActive(null)} />

  return (
    <div className="stack ls">
      <p className="muted small">
        {isVideo
          ? 'Thêm video bằng liên kết Google Drive. Nhân viên xem ở mục Video đào tạo. Liên kết chỉ hiển thị cho người đã đăng nhập MOBIUS, nhưng ai có liên kết vẫn mở được trên Drive nên đừng chia sẻ ra ngoài. Chỉ quản trị viên thêm và xóa được.'
          : 'Tải file PDF (xuất từ PowerPoint hoặc Google Slides, tối đa 50 MB). Nhân viên xem ở mục Kiến thức, Bài học; chỉ quản trị viên tải lên và xóa được.'}
      </p>

      {notice && <div className="alert">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <form className="card ls-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>{isVideo ? 'Tên video' : 'Tên bài học'}</span>
          <input value={title} maxLength={200} disabled={busy} onChange={(e) => setTitle(e.target.value)} placeholder={isVideo ? 'Ví dụ: Hướng dẫn chụp ảnh điểm bán' : 'Ví dụ: Quy trình chăm sóc điểm bán'} />
        </label>
        <label className="field">
          <span>Mô tả ngắn (không bắt buộc)</span>
          <input value={description} maxLength={1000} disabled={busy} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {!isVideo && (
          <div className="tabs tabs-sm ls-mode" role="group" aria-label={`Cách thêm ${noun}`}>
            <button type="button" className={`tab-item ${mode === 'link' ? 'is-active' : ''}`} aria-pressed={mode === 'link'} onClick={() => setMode('link')} disabled={busy}>
              Dán liên kết Google Drive
            </button>
            <button type="button" className={`tab-item ${mode === 'pdf' ? 'is-active' : ''}`} aria-pressed={mode === 'pdf'} onClick={() => setMode('pdf')} disabled={busy}>
              Tải file PDF lên
            </button>
          </div>
        )}
        {mode === 'pdf' && !isVideo ? (
          <div className="ls-file">
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}>
              <Icon name="upload" size={18} />
              <span>{file ? 'Chọn file khác' : 'Chọn file PDF'}</span>
            </button>
            <span className="muted">{file ? `${file.name} (${formatSize(file.size)})` : 'Chưa chọn file. File lưu trong Supabase.'}</span>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={pickFile} />
          </div>
        ) : (
          <label className="field">
            <span>Liên kết Google Drive của file</span>
            <textarea
              className="ls-link-input"
              rows={3}
              value={linkInput}
              disabled={busy}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="Dán liên kết chia sẻ của file, ví dụ https://drive.google.com/file/d/..."
            />
            <small className="muted ls-hint">
              Trên Google Drive: chuột phải vào file (PDF, PowerPoint...), chọn Chia sẻ, đặt "Bất kỳ ai có đường liên kết" (Người xem),
              bấm Sao chép đường liên kết rồi dán vào đây. File nằm ở Drive của bạn nên không tốn dung lượng Supabase.
              {isVideo ? 'Video nên là file MP4 đã được Drive xử lý xong (mở được trong Drive). Nhân viên xem ngay trong MOBIUS.' : 'Nhân viên chỉ xem được nếu file được chia sẻ cho họ.'}
            </small>
          </label>
        )}
        <div className="ls-form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {stage === 'save' ? 'Đang lưu...' : busy ? (mode === 'link' ? 'Đang thêm...' : 'Đang tải lên...') : (isVideo ? 'Thêm video' : 'Thêm bài học')}
          </button>
          {stage === 'upload' && (
            <button type="button" className="btn btn-ghost" onClick={() => uploadRef.current && uploadRef.current.abort()}>
              Hủy tải lên
            </button>
          )}
        </div>
        {progress && (
          <div className="ls-progress">
            <div
              className="ls-progress-track"
              role="progressbar"
              aria-label="Tiến độ tải lên"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((progress.loaded / progress.total) * 100)}
            >
              <div className="ls-progress-bar" style={{ width: `${Math.round((progress.loaded / progress.total) * 100)}%` }} />
            </div>
            <span className="ls-progress-text muted">
              {Math.round((progress.loaded / progress.total) * 100)}% · {formatSize(progress.loaded)} / {formatSize(progress.total)}
            </span>
          </div>
        )}
      </form>

      {loading && <Loading />}
      {!loading && !error && lessons.length === 0 && <p className="muted">{isVideo ? 'Chưa có video nào.' : 'Chưa có bài học nào.'}</p>}

      <ul className="ls-list">
        {lessons.map((l) => (
          <LessonCard key={l.id} lesson={l} admin onOpen={setActive} onRename={rename} onDelete={remove} />
        ))}
      </ul>
    </div>
  )
}