import { useEffect, useRef, useState } from 'react'
import Icon from '../icons.jsx'
import { displayTitle, formatSize, LESSON_TITLE_MAX } from './lessonsApi.js'

/**
 * Thẻ tài liệu dùng chung cho trang nhân viên (chỉ mở) và trang quản trị (thêm đổi tên, xóa).
 * onRename(lesson, name) trả về Promise và ném lỗi (Error có message thân thiện) khi lưu thất bại.
 */
export default function LessonCard({ lesson, onOpen, admin = false, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const name = displayTitle(lesson.title)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function startEdit() {
    setValue(name)
    setError('')
    setEditing(true)
  }

  function cancel() {
    if (saving) return
    setEditing(false)
    setError('')
  }

  async function save() {
    if (saving) return
    const next = value.trim()
    if (!next) {
      setError('Tên không được để trống.')
      return
    }
    if (next.length > LESSON_TITLE_MAX) {
      setError(`Tên tối đa ${LESSON_TITLE_MAX} ký tự.`)
      return
    }
    if (next === name) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onRename(lesson, next)
      setEditing(false)
    } catch (err) {
      setError((err && err.message) || 'Không lưu được. Tên cũ được giữ nguyên.')
    }
    setSaving(false)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  const meta = [lesson.source_url ? 'OneDrive' : 'Tài liệu', new Date(lesson.created_at).toLocaleDateString('vi-VN'), formatSize(lesson.file_size)]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className={`ls-card ${editing ? 'is-editing' : ''}`} onClick={() => !editing && onOpen(lesson)}>
      <span className="ls-doc" aria-hidden="true">
        <Icon name="doc" size={24} />
      </span>

      <div className="ls-body">
        {editing ? (
          <div className="ls-edit">
            <div className="ls-edit-row">
              <input
                ref={inputRef}
                className="ls-edit-input"
                value={value}
                maxLength={LESSON_TITLE_MAX}
                disabled={saving}
                aria-label="Tên tài liệu"
                aria-invalid={Boolean(error)}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <button type="button" className="ls-btn ls-btn-icon ls-btn-primary" aria-label="Lưu tên tài liệu" title="Lưu (Enter)" onClick={save} disabled={saving || !value.trim()}>
                {saving ? <span className="ls-spin" aria-hidden="true" /> : <Icon name="check" size={18} />}
              </button>
              <button type="button" className="ls-btn ls-btn-icon" aria-label="Hủy đổi tên" title="Hủy (Esc)" onClick={cancel} disabled={saving}>
                <Icon name="x" size={18} />
              </button>
            </div>
            {error && (
              <p className="ls-err" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <strong className="ls-name" title={name}>
            {name}
          </strong>
        )}
        {lesson.description && <span className="ls-desc">{lesson.description}</span>}
        <small className="ls-meta">{meta}</small>
      </div>

      <div className="ls-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ls-btn ls-open-btn" aria-label={`Mở tài liệu ${name}`} title="Mở tài liệu" onClick={() => onOpen(lesson)} disabled={saving}>
          <Icon name="open" size={18} />
          <span>Mở tài liệu</span>
        </button>
        {admin && (
          <>
            <button type="button" className="ls-btn ls-btn-icon" aria-label={`Đổi tên tài liệu ${name}`} title="Đổi tên" onClick={startEdit} disabled={editing || saving}>
              <Icon name="pencil" size={18} />
            </button>
            <button type="button" className="ls-btn ls-btn-icon ls-btn-danger" aria-label={`Xóa tài liệu ${name}`} title="Xóa" onClick={() => onDelete(lesson)} disabled={saving}>
              <Icon name="trash" size={18} />
            </button>
          </>
        )}
      </div>
    </li>
  )
}