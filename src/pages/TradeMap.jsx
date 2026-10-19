import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { supabase, safeGet, safeSet } from '../supabase.js'
import { fold } from '../admin/util.js'
import Icon from '../icons.jsx'
import { parseStoresFile, downloadStoresTemplate, MAX_STORES } from './tradeExcel.js'
import './tradeMap.css'

const PIN_COLOR = '#0264a0'
const DOT_COLORS = ['#0264a0', '#dc2626', '#16a34a', '#ea580c', '#7c3aed', '#111111']
const DOT_STYLE_KEY = 'tm-dot-style'

function loadDotStyle() {
  try {
    const v = JSON.parse(safeGet(DOT_STYLE_KEY) || '{}')
    const color = /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : PIN_COLOR
    const scale = Number.isFinite(v.scale) ? Math.min(Math.max(v.scale, 0.5), 4) : 1
    return { color, scale }
  } catch {
    return { color: PIN_COLOR, scale: 1 }
  }
}

/**
 * Lớp vẽ từng điểm bán lên một canvas duy nhất (nhanh với hàng chục nghìn điểm). Chấm bán trong suốt nên
 * chỗ nào dày thì màu đậm hơn, nhìn ra mật độ ngay. Bấm gần một chấm thì mở thông tin điểm bán đó.
 */
const DotLayer = L.Layer.extend({
  initialize(onPick) {
    this._pts = []
    this._mx = new Float64Array(0)
    this._my = new Float64Array(0)
    this._onPick = onPick
    this._color = PIN_COLOR
    this._scale = 1
  },
  setStyle(color, scale) {
    this._color = color
    this._scale = scale
    if (this._canvas) this._draw()
  },
  onAdd(map) {
    this._map = map
    const c = L.DomUtil.create('canvas', 'tm-dots leaflet-zoom-hide')
    this._canvas = c
    map.getPanes().overlayPane.appendChild(c)
    this._redraw = () => {
      if (this._raf) return
      this._raf = requestAnimationFrame(() => {
        this._raf = 0
        this._draw()
      })
    }
    this._click = (e) => this._pick(e.containerPoint)
    // Chỉ vẽ lại khi kéo hoặc zoom xong; trong lúc kéo, canvas (rộng hơn màn hình) trượt cùng bản đồ nên không giật
    map.on('moveend zoomend resize', this._redraw)
    map.on('click', this._click)
    this._draw()
  },
  onRemove(map) {
    map.off('moveend zoomend resize', this._redraw)
    map.off('click', this._click)
    cancelAnimationFrame(this._raf)
    L.DomUtil.remove(this._canvas)
    this._canvas = null
  },
  setPoints(pts) {
    this._pts = pts
    // Đổi sẵn sang tọa độ Mercator chuẩn hóa (0..1) một lần, để mỗi lần vẽ chỉ cần nhân và trừ
    const mx = new Float64Array(pts.length)
    const my = new Float64Array(pts.length)
    pts.forEach((p, i) => {
      const sin = Math.sin((p.lat * Math.PI) / 180)
      mx[i] = (p.lng + 180) / 360
      my[i] = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)
    })
    this._mx = mx
    this._my = my
    if (this._canvas) this._draw()
  },
  _radius() {
    const z = this._map.getZoom()
    return (z <= 9 ? 2.2 : z <= 12 ? 3 : z <= 14 ? 4 : 5.5) * this._scale
  },
  /** Gốc tọa độ của canvas so với bản đồ ở mức zoom hiện tại: điểm (x, y) trên canvas = mx * scale - ox. */
  _frame() {
    const map = this._map
    const size = map.getSize()
    const padX = Math.round(size.x / 2)
    const padY = Math.round(size.y / 2)
    const min = map.getPixelBounds().min
    return {
      size,
      padX,
      padY,
      scale: 256 * 2 ** map.getZoom(),
      ox: Math.round(min.x) - padX,
      oy: Math.round(min.y) - padY,
    }
  },
  _draw() {
    const map = this._map
    const c = this._canvas
    if (!map || !c) return
    const { size, padX, padY, scale, ox, oy } = this._frame()
    const w = size.x + padX * 2
    const h = size.y + padY * 2
    const dpr = window.devicePixelRatio || 1
    L.DomUtil.setPosition(c, map.containerPointToLayerPoint([-padX, -padY]))
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      c.style.width = `${w}px`
      c.style.height = `${h}px`
    }
    const ctx = c.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const r = this._radius()
    const near = map.getZoom() >= 15
    // Chấm được vẽ sẵn một lần thành ảnh nhỏ rồi dán lên từng vị trí, nhanh hơn nhiều so với vẽ hàng chục nghìn hình tròn
    const sprite = this._sprite(r, near, dpr)
    const side = sprite.width / dpr
    const half = side / 2
    ctx.globalAlpha = near ? 1 : 0.92
    const { _mx: mx, _my: my } = this
    for (let i = 0; i < mx.length; i += 1) {
      const x = mx[i] * scale - ox
      const y = my[i] * scale - oy
      if (x < -half || y < -half || x > w + half || y > h + half) continue
      ctx.drawImage(sprite, x - half, y - half, side, side)
    }
    ctx.globalAlpha = 1
  },
  _sprite(r, near, dpr) {
    const key = `${this._color}|${r}|${near}|${dpr}`
    if (this._spriteKey === key) return this._spriteImg
    const side = Math.ceil((r * 2 + 4) * dpr)
    const c = document.createElement('canvas')
    c.width = side
    c.height = side
    const g = c.getContext('2d')
    g.fillStyle = this._color
    g.beginPath()
    g.arc(side / 2, side / 2, r * dpr, 0, Math.PI * 2)
    g.fill()
    if (near) {
      g.strokeStyle = '#ffffff'
      g.lineWidth = 1.5 * dpr
      g.stroke()
    }
    this._spriteKey = key
    this._spriteImg = c
    return c
  },
  _pick(point) {
    const map = this._map
    const { scale, ox, oy, padX, padY } = this._frame()
    const limit = Math.max(this._radius() + 4, 8)
    // Điểm bấm tính theo canvas = vị trí trên màn hình cộng phần đệm
    const px = point.x + padX
    const py = point.y + padY
    const { _mx: mx, _my: my } = this
    let best = -1
    let bestD = limit * limit
    for (let i = 0; i < mx.length; i += 1) {
      const dx = mx[i] * scale - ox - px
      if (dx > limit || dx < -limit) continue
      const dy = my[i] * scale - oy - py
      const d = dx * dx + dy * dy
      if (d <= bestD) {
        bestD = d
        best = i
      }
    }
    if (best >= 0) this._onPick(this._pts[best])
  },
})

const PAGE_SIZE = 1000 // máy chủ giới hạn số dòng mỗi lần đọc, nên đọc theo từng trang
const READ_PARALLEL = 6
const UPLOAD_CHUNK = 2000

const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
const fmt = (v) => (v === null || v === undefined ? '-' : nf.format(v))

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined && text !== null) node.textContent = text
  return node
}

/** Popup dựng bằng DOM + textContent để dữ liệu từ Excel không thể chèn mã HTML. */
function buildPopup(s) {
  const box = el('div', 'tm-pop')
  if (s.store_code) box.appendChild(el('span', 'tm-pop-eyebrow', `Mã ${s.store_code}`))
  box.appendChild(el('strong', 'tm-pop-title', s.name))
  if (s.address) box.appendChild(el('p', 'tm-pop-address', s.address))
  const list = el('dl', 'tm-pop-stats')
  ;[
    ['Doanh số tháng này', s.revenue_current],
    ['Doanh thu 6 tháng', s.revenue_6m],
    ['Trung bình 6 tháng', s.avg_6m],
    ['Số đơn mỗi tháng', s.orders_per_month],
  ].forEach(([label, value]) => {
    const row = el('div', 'tm-pop-row')
    row.appendChild(el('dt', null, label))
    row.appendChild(el('dd', null, fmt(value)))
    list.appendChild(row)
  })
  box.appendChild(list)
  if (s.top_skus) {
    const sku = el('p', 'tm-pop-sku')
    sku.appendChild(el('span', 'tm-pop-eyebrow', 'SKU hay mua'))
    sku.appendChild(document.createTextNode(s.top_skus))
    box.appendChild(sku)
  }
  return box
}

function friendlyError(error) {
  const msg = (error && error.message) || ''
  if (/khong duoc phep|chi quan tri/i.test(msg)) return 'Tài khoản không có quyền thực hiện thao tác này.'
  if (/does not exist|could not find the function|PGRST202/i.test(msg)) {
    return 'Chức năng này chưa được kích hoạt trên máy chủ dữ liệu. Vui lòng liên hệ quản trị viên hệ thống.'
  }
  return 'Không thực hiện được. Vui lòng kiểm tra mạng và thử lại.'
}

export default function TradeMap({ user }) {
  const wrapRef = useRef(null)
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const dotsRef = useRef(null)
  const fitRef = useRef(false)
  const fileRef = useRef(null)

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('') // từ khóa đã chờ ngừng gõ, để danh sách lớn không vẽ lại mỗi phím
  const [preview, setPreview] = useState(null) // kết quả đọc file đang chờ xác nhận
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null) // { loaded, total } khi đang lưu danh sách lên máy chủ
  const [notice, setNotice] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [dotStyle, setDotStyle] = useState(loadDotStyle) // { color, scale }: màu và cỡ chấm do người xem chọn

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const all = []
    let failed = null
    // Đọc nhiều trang cùng lúc cho nhanh; dừng khi gặp trang không đầy
    for (let start = 0; !failed; start += PAGE_SIZE * READ_PARALLEL) {
      const results = await Promise.all(
        Array.from({ length: READ_PARALLEL }, (_, i) =>
          supabase.rpc('app_list_trade_stores').range(start + i * PAGE_SIZE, start + (i + 1) * PAGE_SIZE - 1),
        ),
      )
      failed = results.find((r) => r.error) || null
      if (failed) break
      let last = false
      for (const r of results) {
        const rows = Array.isArray(r.data) ? r.data : []
        all.push(...rows)
        if (rows.length < PAGE_SIZE) {
          last = true
          break
        }
      }
      if (last) break
    }
    if (failed) {
      setError(friendlyError(failed.error))
      setStores([])
    } else {
      fitRef.current = true
      setStores(all)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Khởi tạo bản đồ một lần
  useEffect(() => {
    const map = L.map(mapElRef.current, { zoomControl: true, preferCanvas: true }).setView([10.78, 106.7], 11)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    const dots = new DotLayer((store) => {
      L.popup({ maxWidth: 300, minWidth: 260, autoPanPadding: [24, 24] })
        .setLatLng([store.lat, store.lng])
        .setContent(buildPopup(store))
        .openOn(map)
    })
    dots.addTo(map)
    mapRef.current = map
    dotsRef.current = dots
    return () => {
      map.remove()
      mapRef.current = null
      dotsRef.current = null
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      fitRef.current = true
      setQuery(search)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const searchKeys = useMemo(() => stores.map((s) => fold(`${s.name} ${s.store_code || ''} ${s.address || ''}`)), [stores])

  const visible = useMemo(() => {
    const q = fold(query.trim())
    if (!q) return stores
    return stores.filter((_, i) => searchKeys[i].includes(q))
  }, [stores, searchKeys, query])

  // Vẽ lại các chấm khi dữ liệu hoặc từ khóa tìm kiếm đổi
  useEffect(() => {
    const map = mapRef.current
    const dots = dotsRef.current
    if (!map || !dots) return
    dots.setPoints(visible)
    if (fitRef.current && visible.length > 0) {
      let minLat = 90
      let maxLat = -90
      let minLng = 180
      let maxLng = -180
      visible.forEach((s) => {
        if (s.lat < minLat) minLat = s.lat
        if (s.lat > maxLat) maxLat = s.lat
        if (s.lng < minLng) minLng = s.lng
        if (s.lng > maxLng) maxLng = s.lng
      })
      map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [40, 40], maxZoom: 16 })
      fitRef.current = false
    }
  }, [visible])

  useEffect(() => {
    if (dotsRef.current) dotsRef.current.setStyle(dotStyle.color, dotStyle.scale)
    safeSet(DOT_STYLE_KEY, JSON.stringify(dotStyle))
  }, [dotStyle])

  // Theo dõi chế độ toàn màn hình (kể cả khi thoát bằng phím Esc)
  useEffect(() => {
    function onChange() {
      setFullscreen(document.fullscreenElement === wrapRef.current)
      setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 150)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  async function toggleFullscreen() {
    const node = wrapRef.current
    if (!node) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (node.requestFullscreen) {
        await node.requestFullscreen()
      } else {
        // Trình duyệt không hỗ trợ API toàn màn hình (ví dụ iPhone): dùng chế độ phủ kín màn hình
        setFullscreen((v) => !v)
        setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 150)
      }
    } catch {
      setFullscreen((v) => !v)
      setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 150)
    }
  }

  async function onPickFile(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setNotice('')
    setPreview(null)
    try {
      setPreview({ file: file.name, ...(await parseStoresFile(file)) })
    } catch (err) {
      setNotice(err && err.message ? err.message : 'Không đọc được file Excel.')
    }
    setBusy(false)
  }

  async function confirmReplace() {
    if (!preview || preview.rows.length === 0) return
    setBusy(true)
    setNotice('')
    const rows = preview.rows
    const batch = crypto.randomUUID()
    setProgress({ loaded: 0, total: rows.length })
    let err = (await supabase.rpc('app_begin_trade_upload')).error
    for (let i = 0; !err && i < rows.length; i += UPLOAD_CHUNK) {
      err = (await supabase.rpc('app_append_trade_stores', { p_batch: batch, p_rows: rows.slice(i, i + UPLOAD_CHUNK) })).error
      if (!err) setProgress({ loaded: Math.min(i + UPLOAD_CHUNK, rows.length), total: rows.length })
    }
    let saved = 0
    if (!err) {
      const done = await supabase.rpc('app_finish_trade_upload', { p_batch: batch, p_expected: rows.length })
      err = done.error
      saved = done.data
    }
    setBusy(false)
    setProgress(null)
    if (err) {
      setNotice(friendlyError(err))
      return
    }
    setPreview(null)
    setNotice(`Đã cập nhật ${nf.format(saved)} điểm bán.`)
    load()
  }

  const total = stores.length
  const uploadedAt = stores[0] && stores[0].uploaded_at

  return (
    <section className={`tm ${fullscreen ? 'tm-full' : ''}`} ref={wrapRef}>
      <div className="tm-bar">
        <div className="tm-count">
          <span className="tm-count-icon">
            <Icon name="map" size={22} />
          </span>
          <span className="tm-count-text">
            <strong>{nf.format(total)} điểm bán</strong>
            <small>{uploadedAt ? `Cập nhật ${new Date(uploadedAt).toLocaleDateString('vi-VN')}` : 'Chưa có dữ liệu'}</small>
          </span>
        </div>

        <label className="tm-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={search}
            placeholder="Tên, mã hoặc địa chỉ"
            aria-label="Tìm điểm bán"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <div className="tm-actions">
          {user.isAdmin && (
            <>
              <button type="button" className="tm-btn" onClick={downloadStoresTemplate}>
                <Icon name="download" size={18} />
                <span>Tải file mẫu</span>
              </button>
              <button type="button" className="tm-btn tm-btn-primary" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}>
                <Icon name="upload" size={18} />
                <span>Nhập danh sách Excel</span>
              </button>
              <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onPickFile} />
            </>
          )}
          <button type="button" className="tm-btn tm-btn-icon" data-tip="Tải lại" aria-label="Tải lại dữ liệu" onClick={load} disabled={loading}>
            <Icon name="refresh" size={18} />
          </button>
          <button
            type="button"
            className="tm-btn tm-btn-icon"
            data-tip={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            aria-label={fullscreen ? 'Thoát toàn màn hình' : 'Xem toàn màn hình'}
            onClick={toggleFullscreen}
          >
            <Icon name={fullscreen ? 'collapse' : 'expand'} size={18} />
          </button>
        </div>
      </div>

      {notice && <div className="alert">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {preview && (
        <div className="card tm-preview">
          <strong>Đọc file: {preview.file}</strong>
          <p className="muted">
            {preview.total} dòng dữ liệu: <strong>{preview.rows.length}</strong> hợp lệ
            {preview.errors.length > 0 && <>, <strong>{preview.errors.length}</strong> lỗi sẽ bị bỏ qua</>}.
            Khi xác nhận, toàn bộ danh sách hiện có sẽ được thay bằng danh sách này (tối đa {MAX_STORES} điểm bán).
          </p>
          {preview.errors.length > 0 && (
            <ul className="tm-errors">
              {preview.errors.slice(0, 8).map((e) => (
                <li key={e.row}>Dòng {e.row}: {e.message}</li>
              ))}
              {preview.errors.length > 8 && <li>... và {preview.errors.length - 8} lỗi khác</li>}
            </ul>
          )}
          {progress && (
            <div className="tm-progress">
              <div
                className="tm-progress-track"
                role="progressbar"
                aria-label="Tiến độ lưu danh sách"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((progress.loaded / progress.total) * 100)}
              >
                <div className="tm-progress-bar" style={{ width: `${Math.round((progress.loaded / progress.total) * 100)}%` }} />
              </div>
              <span className="tm-progress-text muted">
                {Math.round((progress.loaded / progress.total) * 100)}% · {nf.format(progress.loaded)} / {nf.format(progress.total)} điểm bán
              </span>
            </div>
          )}
          <div className="tm-actions">
            <button type="button" className="tm-btn tm-btn-primary" onClick={confirmReplace} disabled={busy || preview.rows.length === 0}>
              {busy ? 'Đang lưu...' : `Thay thế bằng ${preview.rows.length} điểm bán`}
            </button>
            <button type="button" className="tm-btn" onClick={() => setPreview(null)} disabled={busy}>
              Hủy
            </button>
          </div>
        </div>
      )}

      <div className="tm-mapbox">
        <div ref={mapElRef} className="tm-map" />
        <div className="tm-style">
          <span className="tm-style-title">Kiểu chấm</span>
          <div className="tm-swatches" role="group" aria-label="Màu chấm">
            {DOT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`tm-swatch ${dotStyle.color.toLowerCase() === c ? 'is-active' : ''}`}
                style={{ background: c }}
                aria-label={`Màu ${c}`}
                aria-pressed={dotStyle.color.toLowerCase() === c}
                onClick={() => setDotStyle((d) => ({ ...d, color: c }))}
              />
            ))}
            <input
              type="color"
              className="tm-colorpick"
              value={dotStyle.color}
              aria-label="Chọn màu khác"
              onChange={(e) => setDotStyle((d) => ({ ...d, color: e.target.value }))}
            />
          </div>
          <label className="tm-size">
            <span>Cỡ chấm</span>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={dotStyle.scale}
              aria-label="Cỡ chấm"
              onChange={(e) => setDotStyle((d) => ({ ...d, scale: Number(e.target.value) }))}
            />
            <span className="tm-size-val">{dotStyle.scale.toFixed(1)}x</span>
          </label>
        </div>
        <div className="tm-badge" aria-live="polite">
          <span className="tm-badge-dot" />
          {nf.format(visible.length)} điểm đang hiển thị
        </div>
      </div>

      {!loading && !error && total === 0 && (
        <p className="tm-empty muted">
          {user.isAdmin ? 'Chưa có danh sách điểm bán. Bấm "Nhập danh sách Excel" để bắt đầu (có file mẫu).' : 'Chưa có danh sách điểm bán. Vui lòng liên hệ quản trị viên.'}
        </p>
      )}
    </section>
  )
}