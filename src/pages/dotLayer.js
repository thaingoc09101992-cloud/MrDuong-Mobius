import L from 'leaflet'
import { safeGet } from '../supabase.js'

// Lớp vẽ chấm điểm bán dùng chung cho Bố trận điểm bán và bản đồ Định vị điểm bán.
export const PIN_COLOR = '#0264a0'
export const DOT_COLORS = ['#0264a0', '#dc2626', '#16a34a', '#ea580c', '#7c3aed', '#111111']

/** Đọc màu và cỡ chấm người xem đã chọn (lưu theo key), sai định dạng thì dùng mặc định. */
export function loadDotStyle(key, defaultScale = 1) {
  try {
    const v = JSON.parse(safeGet(key) || '{}')
    const color = /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : PIN_COLOR
    const scale = Number.isFinite(v.scale) ? Math.min(Math.max(v.scale, 0.5), 4) : defaultScale
    return { color, scale }
  } catch {
    return { color: PIN_COLOR, scale: defaultScale }
  }
}
/**
 * Lớp vẽ từng điểm bán lên một canvas duy nhất (nhanh với hàng chục nghìn điểm). Chấm bán trong suốt nên
 * chỗ nào dày thì màu đậm hơn, nhìn ra mật độ ngay. Bấm gần một chấm thì mở thông tin điểm bán đó.
 */
export const DotLayer = L.Layer.extend({
  initialize(onPick, opts) {
    this._pts = []
    this._mx = new Float64Array(0)
    this._my = new Float64Array(0)
    this._onPick = onPick
    this._hit = (opts && opts.hit) || 4 // vùng bấm quanh chấm (px); điện thoại cần rộng hơn
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
    const limit = Math.max(this._radius() + this._hit, 8)
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
