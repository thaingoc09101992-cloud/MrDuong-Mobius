import { useEffect, useRef, useState } from 'react'
import { sb } from './adminClient.js'
import {
  BANNER_BUCKET,
  BANNER_SLOTS,
  BANNER_SIZE_HINT,
  BANNER_MAX_FILE,
  bannerUrl,
  fetchBanners,
  prepareBannerImage,
} from '../banners.js'

const LINK_PATTERN = /^(https?:\/\/|\/)/i

function Slot({ slot, row, onChanged }) {
  const [title, setTitle] = useState(row ? row.title || '' : '')
  const [subtitle, setSubtitle] = useState(row ? row.subtitle || '' : '')
  const [link, setLink] = useState(row ? row.link_url || '' : '')
  const [active, setActive] = useState(row ? row.is_active : true)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const input = useRef(null)

  useEffect(() => {
    if (!file) {
      setPreview('')
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const currentUrl = preview || (row ? bannerUrl(row.image_path) : '')
  const hasImage = Boolean(currentUrl)

  function pick(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    setError('')
    setDone('')
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      setError('Chỉ nhận ảnh JPG, PNG hoặc WebP.')
      return
    }
    if (f.size > BANNER_MAX_FILE) {
      setError('Ảnh quá lớn (tối đa 8MB). Vui lòng chọn ảnh nhỏ hơn.')
      return
    }
    setFile(f)
  }

  async function save() {
    setError('')
    setDone('')
    const lk = link.trim()
    if (lk && !LINK_PATTERN.test(lk)) {
      setError('Liên kết phải bắt đầu bằng https://, http:// hoặc /.')
      return
    }
    if (!file && !row) {
      setError('Hãy chọn một ảnh cho banner này.')
      return
    }
    setBusy(true)
    try {
      let path = row ? row.image_path : ''
      let oldPath = null
      if (file) {
        const blob = await prepareBannerImage(file)
        const newPath = `slot-${slot}/${Date.now()}.jpg`
        const up = await sb.storage.from(BANNER_BUCKET).upload(newPath, blob, { contentType: 'image/jpeg', upsert: false })
        if (up.error) throw new Error('Tải ảnh lên thất bại. Vui lòng thử lại.')
        oldPath = row ? row.image_path : null
        path = newPath
      }
      const { data, error: err } = await sb
        .from('banners')
        .upsert({
          slot,
          image_path: path,
          title: title.trim() || null,
          subtitle: subtitle.trim() || null,
          link_url: lk || null,
          is_active: active,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (err) throw new Error('Không lưu được banner. Vui lòng thử lại.')
      if (oldPath) await sb.storage.from(BANNER_BUCKET).remove([oldPath])
      setFile(null)
      setDone('Đã lưu')
      onChanged(data)
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  async function remove() {
    if (!row) {
      setFile(null)
      return
    }
    if (!window.confirm(`Xóa banner ${slot}? Ảnh sẽ bị xóa khỏi trang chủ.`)) return
    setBusy(true)
    setError('')
    try {
      const { error: err } = await sb.from('banners').delete().eq('slot', slot)
      if (err) throw new Error('Không xóa được banner. Vui lòng thử lại.')
      await sb.storage.from(BANNER_BUCKET).remove([row.image_path])
      setFile(null)
      setTitle('')
      setSubtitle('')
      setLink('')
      setActive(true)
      onChanged(null, slot)
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  const status = !row ? 'Trống' : row.is_active ? 'Đang hiển thị' : 'Đang ẩn'

  return (
    <article className="card banner-slot">
      <div className="row between">
        <div>
          <span className="eyebrow">Vị trí {slot}</span>
          <h2>Banner {slot}</h2>
        </div>
        <span className={`chip ${row && row.is_active ? 'chip-ok' : ''}`}>{status}</span>
      </div>

      <button type="button" className="banner-preview" onClick={() => input.current && input.current.click()} disabled={busy}>
        {hasImage ? (
          <span className="banner-preview-img" style={{ backgroundImage: `url("${currentUrl}")` }} />
        ) : (
          <span className="banner-preview-empty">
            Chưa có ảnh. Bấm để chọn ảnh
            <small>Khuyên dùng {BANNER_SIZE_HINT}, JPG, PNG hoặc WebP</small>
          </span>
        )}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />

      <div className="banner-fields">
        <label className="field field-sm">
          <span>Tiêu đề (không bắt buộc)</span>
          <input value={title} maxLength={120} disabled={busy} placeholder="Ví dụ: Chương trình khuyến mãi tháng 10" onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field field-sm">
          <span>Phụ đề (không bắt buộc)</span>
          <input value={subtitle} maxLength={200} disabled={busy} placeholder="Ví dụ: Áp dụng từ 01/10 đến 31/10" onChange={(e) => setSubtitle(e.target.value)} />
        </label>
        <label className="field field-sm banner-link">
          <span>Liên kết khi bấm vào banner (không bắt buộc)</span>
          <input value={link} maxLength={500} disabled={busy} placeholder="Ví dụ: https://congty.vn/khuyen-mai" onChange={(e) => setLink(e.target.value)} />
        </label>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {done && !error && (
        <div className="alert ad-notice" role="status">
          {done}
        </div>
      )}

      <div className="row wrap-row banner-actions">
        <label className="ad-check">
          <input type="checkbox" checked={active} disabled={busy} onChange={(e) => setActive(e.target.checked)} />
          <span>Hiển thị trên trang chủ</span>
        </label>
        <span className="grow" />
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => input.current && input.current.click()}>
          {hasImage ? 'Đổi ảnh' : 'Chọn ảnh'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm ad-danger" disabled={busy || (!row && !file)} onClick={remove}>
          Xóa
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
          {busy ? 'Đang lưu...' : 'Lưu banner'}
        </button>
      </div>
    </article>
  )
}

/** Quản lý 5 banner của trang chủ MOBIUS. */
export default function Banners() {
  const [rows, setRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetchBanners(false)
      .then((list) => {
        if (alive) setRows(Object.fromEntries(list.map((r) => [r.slot, r])))
      })
      .catch(() => alive && setError('Không tải được danh sách banner. Vui lòng thử lại.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  function changed(row, removedSlot) {
    setRows((m) => {
      const next = { ...m }
      if (row) next[row.slot] = row
      else delete next[removedSlot]
      return next
    })
  }

  if (loading) return <div className="muted">Đang tải banner...</div>

  return (
    <div className="stack">
      <p className="muted small banner-help">
        Trang chủ hiển thị tối đa 5 banner, tự chuyển lần lượt theo vị trí 1 đến 5. Ảnh khuyên dùng {BANNER_SIZE_HINT}; hệ
        thống tự thu nhỏ và nén ảnh trước khi tải lên. Banner đang ẩn hoặc để trống sẽ không hiện với nhân viên.
      </p>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <div className="banner-grid">
        {BANNER_SLOTS.map((slot) => (
          <Slot key={`${slot}-${rows[slot] ? rows[slot].updated_at : 'empty'}`} slot={slot} row={rows[slot]} onChanged={changed} />
        ))}
      </div>
    </div>
  )
}
