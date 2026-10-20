// Popup điểm bán của "Bố trận điểm bán": hai tab Profile và Lịch sử, dựng bằng DOM + textContent
// để dữ liệu từ Excel không thể chèn mã HTML.

const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const SVG_NS = 'http://www.w3.org/2000/svg'

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined && text !== null) node.textContent = text
  return node
}

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag)
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v))
  return node
}

const money = (v) => (v === null || v === undefined || Number.isNaN(v) ? '-' : nf.format(Math.round(v)))

/** Rút gọn để vừa ô nhỏ: 12,5 tr, 1,2 tỷ. */
export function compactMoney(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '-'
  const a = Math.abs(v)
  if (a >= 1e9) return `${(v / 1e9).toFixed(1).replace('.', ',')} tỷ`
  if (a >= 1e6) return `${(v / 1e6).toFixed(1).replace('.', ',')} tr`
  return nf.format(Math.round(v))
}

/** Nhãn tháng cho từng phần tử (mới nhất trước): dùng "m" nếu có, không thì lùi dần từ tháng của ngày tải dữ liệu. */
export function monthItems(monthly, anchorIso) {
  const anchor = anchorIso ? new Date(anchorIso) : new Date()
  const base = Number.isNaN(anchor.getTime()) ? new Date() : anchor
  return monthly.map((x, i) => {
    let y
    let m
    const hit = x && typeof x.m === 'string' && /^(\d{4})-(\d{2})$/.exec(x.m)
    if (hit) {
      y = Number(hit[1])
      m = Number(hit[2])
    } else {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
      y = d.getFullYear()
      m = d.getMonth() + 1
    }
    const mm = String(m).padStart(2, '0')
    return { v: Number(x && x.v) || 0, month: mm, label: `T${mm}/${String(y).slice(2)}`, full: `${mm}/${y}` }
  })
}

/** Doanh thu tháng này và các bình quân KHÔNG tính tháng này: 3 tháng, 9 tháng, năm (11 tháng trước). null nếu chưa đủ số tháng. */
export function summarize(monthly) {
  const v = monthly.map((x) => Number(x && x.v) || 0)
  const prev = v.slice(1)
  const avg = (n) => (prev.length >= n ? prev.slice(0, n).reduce((a, b) => a + b, 0) / n : null)
  return { current: v.length ? v[0] : null, avg3: avg(3), avg9: avg(9), avgYear: avg(11) }
}

function row(label, value) {
  const r = el('div', 'tm-pop-row')
  r.appendChild(el('dt', null, label))
  r.appendChild(el('dd', null, value))
  return r
}

function chart(items) {
  // Từ cũ đến mới, trái sang phải; tháng này (mới nhất) tô vàng
  const data = [...items].reverse()
  const W = 300
  const H = 92
  const base = 76
  const top = 14
  const max = Math.max(...data.map((d) => d.v), 1)
  const slot = W / data.length
  const bw = Math.min(18, slot - 6)
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'tm-chart', role: 'img', 'aria-label': 'Biểu đồ doanh thu theo tháng' })
  data.forEach((d, i) => {
    const h = Math.max(d.v > 0 ? 2 : 0, ((base - top) * d.v) / max)
    const x = i * slot + (slot - bw) / 2
    const isCurrent = i === data.length - 1
    const bar = svgEl('rect', { x: x.toFixed(1), y: (base - h).toFixed(1), width: bw, height: h.toFixed(1), class: isCurrent ? 'tm-chart-bar is-current' : 'tm-chart-bar' })
    bar.appendChild(svgEl('title', {})).textContent = `${d.full}: ${money(d.v)}`
    svg.appendChild(bar)
    const t = svgEl('text', { x: (x + bw / 2).toFixed(1), y: H - 6, class: 'tm-chart-label', 'text-anchor': 'middle' })
    t.textContent = d.month
    svg.appendChild(t)
  })
  svg.appendChild(svgEl('line', { x1: 0, x2: W, y1: base + 0.5, y2: base + 0.5, class: 'tm-chart-axis' }))
  return svg
}

function profilePanel(s) {
  const panel = el('div', 'tm-pop-panel')
  const photo = el('div', 'tm-pop-photo', 'Chưa có ảnh điểm bán')
  panel.appendChild(photo)
  if (s.address) panel.appendChild(el('p', 'tm-pop-address', s.address))
  const list = el('dl', 'tm-pop-stats')
  list.appendChild(row('Tọa độ', `${Number(s.lat).toFixed(6)}, ${Number(s.lng).toFixed(6)}`))
  list.appendChild(row('Số tủ', s.cabinet_count === null || s.cabinet_count === undefined ? '-' : String(s.cabinet_count)))
  panel.appendChild(list)
  if (s.top_skus) {
    const sku = el('p', 'tm-pop-sku')
    sku.appendChild(el('span', 'tm-pop-eyebrow', 'SKU hay mua'))
    sku.appendChild(document.createTextNode(s.top_skus))
    panel.appendChild(sku)
  }
  return panel
}

function historyPanel(s) {
  const panel = el('div', 'tm-pop-panel')
  const monthly = Array.isArray(s.monthly) ? s.monthly.slice(0, 12) : []
  if (monthly.length === 0) {
    panel.appendChild(el('p', 'tm-pop-empty', 'Chưa có doanh thu theo tháng. Hãy bổ sung sheet "Doanh thu tháng" trong file Excel.'))
    return panel
  }
  const items = monthItems(monthly, s.uploaded_at)
  const sum = summarize(monthly)
  const stats = el('dl', 'tm-pop-stats')
  stats.appendChild(row('Doanh thu tháng này', money(sum.current)))
  stats.appendChild(row('Bình quân 3 tháng', money(sum.avg3)))
  stats.appendChild(row('Bình quân 9 tháng', money(sum.avg9)))
  stats.appendChild(row('Bình quân năm', money(sum.avgYear)))
  panel.appendChild(stats)
  panel.appendChild(el('p', 'tm-pop-note', 'Bình quân không tính tháng này. Năm = 11 tháng trước tháng này.'))

  panel.appendChild(el('span', 'tm-pop-eyebrow', 'Doanh thu 12 tháng'))
  const grid = el('ul', 'tm-pop-months')
  items.forEach((d) => {
    const li = el('li', null)
    li.appendChild(el('span', null, d.label))
    li.appendChild(el('strong', null, compactMoney(d.v)))
    li.title = `${d.full}: ${money(d.v)}`
    grid.appendChild(li)
  })
  panel.appendChild(grid)
  panel.appendChild(chart(items))
  return panel
}

/** onResize: gọi sau khi đổi tab để Leaflet tính lại kích thước và vị trí popup. */
export function buildPopup(s, onResize) {
  const box = el('div', 'tm-pop')
  if (s.store_code) box.appendChild(el('span', 'tm-pop-eyebrow', `Mã ${s.store_code}`))
  box.appendChild(el('strong', 'tm-pop-title', s.name))

  const tabs = el('div', 'tm-pop-tabs')
  tabs.setAttribute('role', 'tablist')
  const panels = { profile: profilePanel(s), history: historyPanel(s) }
  const buttons = {}
  function show(name) {
    Object.keys(panels).forEach((k) => {
      const on = k === name
      panels[k].hidden = !on
      buttons[k].setAttribute('aria-selected', on ? 'true' : 'false')
      buttons[k].classList.toggle('is-active', on)
    })
    if (onResize) onResize()
  }
  ;[
    ['profile', 'Profile'],
    ['history', 'Lịch sử'],
  ].forEach(([key, label]) => {
    const b = el('button', 'tm-pop-tab', label)
    b.type = 'button'
    b.setAttribute('role', 'tab')
    b.addEventListener('click', () => show(key))
    buttons[key] = b
    tabs.appendChild(b)
  })
  box.appendChild(tabs)
  box.appendChild(panels.profile)
  box.appendChild(panels.history)
  show('profile')
  return box
}