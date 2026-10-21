import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { supabase, safeGet, safeSet } from '../supabase.js'
import Icon from '../icons.jsx'
import { parseStoresFile, downloadStoresTemplate, MAX_STORES } from './tradeExcel.js'
import { buildPopup } from './tradePopup.js'
import { COLOR_FIELDS, buildScheme } from './tradeColor.js'
import './tradeMap.css'

const PIN_COLOR = '#0264a0'
const TM_TABS = [
  { id: 'resource', label: 'Phân tích nguồn lực', icon: 'chart' },
  { id: 'map', label: 'Bản đồ bố trận', icon: 'map' },
]
const DOT_COLORS = ['#0264a0', '#dc2626', '#16a34a', '#ea580c', '#7c3aed', '#111111']
const DOT_STYLE_KEY = 'tm-dot-style'
const COLOR_FIELD_KEY = 'tm-color-field'

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
    this._scheme = null // phương án tô màu theo trường dữ liệu: { bands, assign }
    this._hidden = new Set() // các nhóm đang ẩn
    this._sprites = new Map()
  },
  /** Tô màu theo nhóm: mỗi điểm lấy màu của nhóm mình; nhóm nằm trong hidden thì không vẽ và không bấm được. */
  setScheme(scheme, hidden) {
    this._scheme = scheme
    this._hidden = hidden || new Set()
    if (this._canvas) this._draw()
  },
  /** Phương án tô màu đang dùng được: phải khớp số điểm hiện có, nếu chưa khớp (đang nạp lại dữ liệu) thì vẽ một màu. */
  _active() {
    return this._scheme && this._scheme.assign.length === this._mx.length ? this._scheme : null
  },
  _hideFlags() {
    const s = this._active()
    return s ? s.bands.map((b) => this._hidden.has(b.id)) : null
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
    // Chấm được vẽ sẵn một lần thành ảnh nhỏ rồi dán lên từng vị trí, nhanh hơn nhiều so với vẽ hàng chục nghìn hình tròn.
    // Khi tô màu theo nhóm thì mỗi nhóm có một ảnh chấm riêng.
    const scheme = this._active()
    const assign = scheme ? scheme.assign : null
    const hide = this._hideFlags()
    const sprites = scheme ? scheme.bands.map((b) => this._sprite(r, near, dpr, b.color)) : null
    const plain = scheme ? null : this._sprite(r, near, dpr, this._color)
    const side = (plain || sprites[0]).width / dpr
    const half = side / 2
    ctx.globalAlpha = near ? 1 : 0.92
    const { _mx: mx, _my: my } = this
    for (let i = 0; i < mx.length; i += 1) {
      const x = mx[i] * scale - ox
      const y = my[i] * scale - oy
      if (x < -half || y < -half || x > w + half || y > h + half) continue
      let sprite = plain
      if (assign) {
        const b = assign[i]
        if (hide[b]) continue
        sprite = sprites[b]
      }
      ctx.drawImage(sprite, x - half, y - half, side, side)
    }
    ctx.globalAlpha = 1
  },
  _sprite(r, near, dpr, color) {
    const key = `${color}|${r}|${near}|${dpr}`
    const cached = this._sprites.get(key)
    if (cached) return cached
    if (this._sprites.size > 60) this._sprites.clear()
    const side = Math.ceil((r * 2 + 4) * dpr)
    const c = document.createElement('canvas')
    c.width = side
    c.height = side
    const g = c.getContext('2d')
    g.fillStyle = color
    g.beginPath()
    g.arc(side / 2, side / 2, r * dpr, 0, Math.PI * 2)
    g.fill()
    if (near) {
      g.strokeStyle = '#ffffff'
      g.lineWidth = 1.5 * dpr
      g.stroke()
    }
    this._sprites.set(key, c)
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
    const active = this._active()
    const assign = active ? active.assign : null
    const hide = this._hideFlags()
    let best = -1
    let bestD = limit * limit
    for (let i = 0; i < mx.length; i += 1) {
      if (assign && hide[assign[i]]) continue
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
  const colorMenuRef = useRef(null)
  const [tab, setTab] = useState('map') // 'resource' (phân tích nguồn lực) | 'map' (bản đồ bố trận)
  const [colorMenuOpen, setColorMenuOpen] = useState(false)

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(0) // số điểm đã nhận được trong lúc đang tải
  const [expected, setExpected] = useState(null) // tổng số điểm theo máy chủ (null khi chưa biết), dùng để tính % tiến độ
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null) // kết quả đọc file đang chờ xác nhận
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null) // { loaded, total } khi đang lưu danh sách lên máy chủ
  const [notice, setNotice] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [colorField, setColorField] = useState(() => {
    const v = safeGet(COLOR_FIELD_KEY) || ''
    return COLOR_FIELDS.some((c) => c.id === v) ? v : ''
  }) // trường dữ liệu dùng để tô màu ('' = một màu)
  const [hiddenBands, setHiddenBands] = useState(() => new Set()) // các nhóm màu đang ẩn trên bản đồ
  const [dotStyle, setDotStyle] = useState(loadDotStyle) // { color, scale }: màu và cỡ chấm do người xem chọn

  const load = useCallback(async () => {
    setLoading(true)
    setLoaded(0)
    setExpected(null)
    setError('')
    const all = []
    let failed = null
    // Đọc nhiều trang cùng lúc cho nhanh; dừng khi gặp trang không đầy
    for (let start = 0; !failed; start += PAGE_SIZE * READ_PARALLEL) {
      const results = await Promise.all(
        Array.from({ length: READ_PARALLEL }, (_, i) =>
          supabase
            .rpc('app_list_trade_stores', undefined, start === 0 && i === 0 ? { count: 'exact' } : undefined)
            .range(start + i * PAGE_SIZE, start + (i + 1) * PAGE_SIZE - 1),
        ),
      )
      failed = results.find((r) => r.error) || null
      if (failed) break
      if (start === 0 && typeof results[0].count === 'number') setExpected(results[0].count)
      let last = false
      for (const r of results) {
        const rows = Array.isArray(r.data) ? r.data : []
        all.push(...rows)
        setLoaded(all.length)
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
      const popup = L.popup({ maxWidth: 340, minWidth: 300, maxHeight: 460, autoPanPadding: [24, 24] })
      popup.setLatLng([store.lat, store.lng]).setContent(buildPopup(store, () => popup.update())).openOn(map)
    })
    dots.addTo(map)
    mapRef.current = map
    dotsRef.current = dots
    // Tự cập nhật khi khung bản đồ đổi kích thước (đổi cỡ cửa sổ, thu gọn thanh bên, toàn màn hình, thanh công cụ đổi dạng)
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => map.invalidateSize())
    })
    ro.observe(mapElRef.current)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      map.remove()
      mapRef.current = null
      dotsRef.current = null
    }
  }, [])

  // Vẽ lại các chấm khi dữ liệu đổi
  useEffect(() => {
    const map = mapRef.current
    const dots = dotsRef.current
    if (!map || !dots) return
    dots.setPoints(stores)
    if (fitRef.current && stores.length > 0) {
      let minLat = 90
      let maxLat = -90
      let minLng = 180
      let maxLng = -180
      stores.forEach((s) => {
        if (s.lat < minLat) minLat = s.lat
        if (s.lat > maxLat) maxLat = s.lat
        if (s.lng < minLng) minLng = s.lng
        if (s.lng > maxLng) maxLng = s.lng
      })
      map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [40, 40], maxZoom: 16 })
      fitRef.current = false
    }
  }, [stores])

  // Tô màu theo trường dữ liệu: chia nhóm một lần khi dữ liệu hoặc trường đổi, rồi giao cho lớp vẽ
  useEffect(() => {
    if (tab !== 'map') return undefined
    const id = setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 50) // bản đồ vừa hiện lại sau khi ẩn
    return () => clearTimeout(id)
  }, [tab])

  useEffect(() => {
    if (!colorMenuOpen) return undefined
    const close = (e) => {
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target)) setColorMenuOpen(false)
    }
    const esc = (e) => e.key === 'Escape' && setColorMenuOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [colorMenuOpen])

  const scheme = useMemo(() => (colorField ? buildScheme(stores, colorField) : null), [stores, colorField])
  useEffect(() => {
    if (dotsRef.current) dotsRef.current.setScheme(scheme, hiddenBands)
  }, [scheme, hiddenBands, stores])
  useEffect(() => {
    safeSet(COLOR_FIELD_KEY, colorField || null)
  }, [colorField])

  function changeColorField(id) {
    setColorField(id)
    setHiddenBands(new Set())
  }
  function toggleBand(id) {
    setHiddenBands((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
  const loadPct = expected ? Math.min(99, Math.round((loaded / expected) * 100)) : 0 // chưa xong thì không hiện 100%
  const uploadedAt = stores[0] && stores[0].uploaded_at

  return (
    <section className={`tm ${fullscreen ? 'tm-full' : ''}`} ref={wrapRef}>
      <div className="tabs tm-tabs" role="tablist" aria-label="Màn hình của công cụ">
        {TM_TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            id={`tm-tab-${x.id}`}
            aria-selected={tab === x.id}
            aria-controls={`tm-panel-${x.id}`}
            className={`tab-item ${tab === x.id ? 'is-active' : ''}`}
            onClick={() => setTab(x.id)}
          >
            <Icon name={x.icon} size={18} />
            {x.label}
          </button>
        ))}
      </div>

      <div id="tm-panel-resource" role="tabpanel" aria-labelledby="tm-tab-resource" className="tm-panel" hidden={tab !== 'resource'}>
        <div className="empty-state">
          <Icon name="chart" size={32} />
          <span className="empty-title">Phân tích nguồn lực</span>
          <p className="muted">Nội dung phân tích nguồn lực sẽ được cập nhật tại đây.</p>
        </div>
      </div>

      <div id="tm-panel-map" role="tabpanel" aria-labelledby="tm-tab-map" className="tm-panel" hidden={tab !== 'map'}>
      <div className="tm-bar">
        {loading && (
          <div
            className="tm-loadbar"
            role="progressbar"
            aria-label="Tiến độ tải điểm bán"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={expected ? loadPct : undefined}
          >
            <div className={`tm-loadbar-fill ${expected ? '' : 'is-indeterminate'}`} style={expected ? { width: `${loadPct}%` } : undefined} />
          </div>
        )}
        <div className="tm-count">
          <span className="tm-count-icon">
            <Icon name="map" size={22} />
          </span>
          <span className="tm-count-text">
            <strong>{loading ? 'Đang tải điểm bán...' : `${nf.format(total)} điểm bán`}</strong>
            <small>
              {loading
                ? loaded > 0
                  ? expected
                    ? `Đã nhận ${nf.format(loaded)} / ${nf.format(expected)} điểm (${loadPct}%)`
                    : `Đã nhận ${nf.format(loaded)} điểm`
                  : 'Vui lòng chờ trong giây lát'
                : uploadedAt ? `Cập nhật ${new Date(uploadedAt).toLocaleDateString('vi-VN')}` : 'Chưa có dữ liệu'}
            </small>
          </span>
        </div>

        <div className="tm-style">
          <label className="tm-field">
            <span className="tm-field-label">Tô màu theo</span>
            <select className="tm-select" value={colorField} onChange={(e) => changeColorField(e.target.value)} aria-label="Tô màu điểm bán theo trường dữ liệu">
              <option value="">Một màu</option>
              {COLOR_FIELDS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className={`tm-field ${scheme ? 'is-off' : ''}`} title={scheme ? 'Đang tô màu theo dữ liệu, chọn "Một màu" ở ô "Tô màu theo" để đổi màu chấm' : undefined}>
            <span className="tm-field-label">Màu chấm</span>
            <div className="tm-colordd" ref={colorMenuRef}>
              <button
                type="button"
                className="tm-select-btn"
                aria-haspopup="listbox"
                aria-expanded={colorMenuOpen}
                aria-label="Màu chấm"
                disabled={Boolean(scheme)}
                onClick={() => setColorMenuOpen((o) => !o)}
              >
                <span className="tm-swatch tm-swatch-sm" style={{ background: dotStyle.color }} />
                <Icon name="chevron-down" size={16} />
              </button>
              {colorMenuOpen && (
                <div className="tm-colormenu" role="listbox" aria-label="Màu chấm">
                  {DOT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="option"
                      aria-selected={dotStyle.color.toLowerCase() === c}
                      className={`tm-swatch ${dotStyle.color.toLowerCase() === c ? 'is-active' : ''}`}
                      style={{ background: c }}
                      aria-label={`Màu ${c}`}
                      onClick={() => {
                        setDotStyle((d) => ({ ...d, color: c }))
                        setColorMenuOpen(false)
                      }}
                    />
                  ))}
                  <label className={`tm-swatch tm-swatch-custom ${DOT_COLORS.includes(dotStyle.color.toLowerCase()) ? '' : 'is-active'}`} title="Chọn màu khác">
                    <input
                      type="color"
                      value={dotStyle.color}
                      aria-label="Chọn màu khác"
                      onChange={(e) => setDotStyle((d) => ({ ...d, color: e.target.value }))}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
          <label className="tm-field">
            <span className="tm-field-label">Cỡ chấm</span>
            <input
              type="range"
              className="tm-range"
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
        <div className="tm-actions">
          {user.isAdmin && (
            <>
              <button type="button" className="btn btn-ghost tm-btn-soft" onClick={downloadStoresTemplate} title="Tải file Excel mẫu" aria-label="Tải file Excel mẫu">
                <Icon name="download" size={18} />
                <span className="tm-btn-label tm-btn-label-soft">File mẫu</span>
              </button>
              <button type="button" className="btn btn-primary" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy} title="Nhập danh sách điểm bán từ file Excel" aria-label="Nhập danh sách điểm bán từ file Excel">
                <Icon name="upload" size={18} />
                <span className="tm-btn-label">Nhập Excel</span>
              </button>
              <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onPickFile} />
            </>
          )}
          <button type="button" className="btn btn-ghost btn-icon" data-tip="Tải lại" aria-label="Tải lại dữ liệu" onClick={load} disabled={loading}>
            <Icon name="refresh" size={18} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
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
            {preview.history && (
              <>
                {' '}Sheet "{preview.history.sheet}": đọc {nf.format(preview.history.rowsRead)} dòng, ghép được doanh thu theo tháng cho{' '}
                <strong>{nf.format(preview.history.stores)}</strong> điểm bán
                {preview.history.unmatched > 0 && <> ({nf.format(preview.history.unmatched)} mã không có trong danh sách điểm bán)</>}.
              </>
            )}
            {!preview.history && <> Không có sheet "Doanh thu tháng" nên tab Lịch sử của popup sẽ trống.</>}
            {' '}Khi xác nhận, toàn bộ danh sách hiện có sẽ được thay bằng danh sách này (tối đa {MAX_STORES} điểm bán).
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
            <button type="button" className="btn btn-primary" onClick={confirmReplace} disabled={busy || preview.rows.length === 0}>
              {busy ? 'Đang lưu...' : `Thay thế bằng ${preview.rows.length} điểm bán`}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)} disabled={busy}>
              Hủy
            </button>
          </div>
        </div>
      )}

      <div className="tm-mapbox">
        <div ref={mapElRef} className="tm-map" />
        {scheme && (
          <div className="tm-colorpanel">
            <span className="tm-field-label">{scheme.label}</span>
              <ul className="tm-legend" aria-label={`Chú giải: ${scheme.label}`}>
                {scheme.bands.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className={`tm-legend-item ${hiddenBands.has(b.id) ? 'is-off' : ''}`}
                      aria-pressed={!hiddenBands.has(b.id)}
                      title={hiddenBands.has(b.id) ? 'Bấm để hiện lại nhóm này' : 'Bấm để ẩn nhóm này'}
                      onClick={() => toggleBand(b.id)}
                    >
                      <span className="tm-legend-dot" style={{ background: b.color }} />
                      <span className="tm-legend-label">{b.label}</span>
                      <span className="tm-legend-count">{nf.format(b.count)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {hiddenBands.size > 0 && (
                <button type="button" className="tm-legend-reset" onClick={() => setHiddenBands(new Set())}>
                  Hiện tất cả nhóm
                </button>
              )}
          </div>
        )}
      </div>

      {!loading && !error && total === 0 && (
        <p className="tm-empty muted">
          {user.isAdmin ? 'Chưa có danh sách điểm bán. Bấm "Nhập Excel" để bắt đầu (có file mẫu).' : 'Chưa có danh sách điểm bán. Vui lòng liên hệ quản trị viên.'}
        </p>
      )}
      </div>
    </section>
  )
}