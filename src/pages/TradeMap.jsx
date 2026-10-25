import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import { supabase, safeGet, safeSet } from '../supabase.js'
import Icon from '../icons.jsx'
import { parseStoresFile, downloadStoresTemplate, MAX_STORES, DIMENSIONS } from './tradeExcel.js'
import { buildPopup } from './tradePopup.js'
import { DotLayer, DOT_COLORS, loadDotStyle } from './dotLayer.js'
import { COLOR_FIELDS, COLOR_GROUPS, buildScheme } from './tradeColor.js'
import { readTradeCache, writeTradeCache, storesVersion } from './tradeCache.js'
import './tradeMap.css'

const TM_TABS = [
  { id: 'resource', label: 'Phân tích nguồn lực', icon: 'chart' },
  { id: 'map', label: 'Bản đồ bố trận', icon: 'map' },
]
const DOT_STYLE_KEY = 'tm-dot-style'
const COLOR_FIELD_KEY = 'tm-color-field'
const TOOLS_KEY = 'tm-tools-collapsed'
const MOBILE_QUERY = '(max-width: 900px)'
// Bộ lọc tạm thời (chưa lọc dữ liệu): cùng các trường phân loại với "Tô màu theo".
// Các trường có nhãn hoặc giá trị dài chiếm cả hàng; còn lại xếp 2 cột.
const WIDE_FILTERS = new Set(['salesman', 'frequency', 'store_type', 'store_size'])

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
  const [tab, setTab] = useState('map') // 'resource' (phân tích nguồn lực) | 'map' (bản đồ bố trận)
  const [slot, setSlot] = useState(null) // cột bên phải của khung trang, nơi đặt thanh công cụ
  // Thanh công cụ bên phải: máy tính nhớ trạng thái mở/thu gọn; điện thoại luôn bắt đầu ở trạng thái đóng
  const [toolsCollapsed, setToolsCollapsed] = useState(() => window.matchMedia(MOBILE_QUERY).matches || safeGet(TOOLS_KEY) === '1')

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
  const [dotStyle, setDotStyle] = useState(() => loadDotStyle(DOT_STYLE_KEY)) // { color, scale }: màu và cỡ chấm do người xem chọn

  const owner = user.email || user.code || '' // bộ đệm điểm bán gắn với tài khoản

  // Tải đầy đủ danh sách từ máy chủ (nút "Tải lại", sau khi nhập Excel, hoặc khi dữ liệu trên máy chủ đã đổi)
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
      writeTradeCache(owner, storesVersion(all.length, all[0] && all[0].uploaded_at), all)
    }
    setLoading(false)
  }, [owner])

  // Mở công cụ: hiện ngay bản đã lưu trên máy, rồi hỏi máy chủ (chỉ 1 dòng) xem dữ liệu có đổi không; đổi thì mới tải lại
  useEffect(() => {
    let off = false
    ;(async () => {
      const cached = await readTradeCache(owner)
      if (off) return
      if (!cached) {
        load()
        return
      }
      fitRef.current = true
      setStores(cached.stores)
      setLoading(false)
      const r = await supabase.rpc('app_list_trade_stores', undefined, { count: 'exact' }).range(0, 0)
      if (off || r.error || typeof r.count !== 'number') return
      const first = Array.isArray(r.data) && r.data[0]
      if (storesVersion(r.count, first && first.uploaded_at) !== cached.version) load()
    })()
    return () => {
      off = true
    }
  }, [owner, load])

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
    // Tự cập nhật khi khung bản đồ đổi kích thước (đổi cỡ cửa sổ, đóng/mở thanh bên, toàn màn hình).
    // Chờ khung đứng yên rồi mới cập nhật một lần: trong lúc thanh bên trượt (~300ms) khung đổi cỡ ở từng khung hình,
    // nếu cập nhật ngay thì mỗi khung hình lại vẽ lại hàng chục nghìn chấm, gây giật.
    let timer = 0
    const ro = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => map.invalidateSize(), 120)
    })
    ro.observe(mapElRef.current)
    return () => {
      clearTimeout(timer)
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
    setSlot(document.getElementById('ad-aside'))
  }, [])

  function setTools(collapsed) {
    setToolsCollapsed(collapsed)
    if (!window.matchMedia(MOBILE_QUERY).matches) safeSet(TOOLS_KEY, collapsed ? '1' : '0')
  }
  // Bấm một biểu tượng ở thanh thu gọn: mở thanh và cuộn tới đúng nhóm đó
  function openSection(id) {
    setTools(false)
    setTimeout(() => {
      const el = document.getElementById(`tm-sec-${id}`)
      if (el) el.scrollIntoView({ block: 'nearest' })
    }, 0)
  }

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

  // Tải file mẫu: báo lỗi rõ ràng thay vì im lặng (ví dụ trình duyệt xem trước trong VS Code không cho tải file)
  async function downloadTemplate() {
    setNotice('')
    try {
      await downloadStoresTemplate()
    } catch {
      setNotice('Không tạo được file mẫu. Vui lòng thử lại trên Chrome hoặc Edge.')
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

  const statusText = loading
    ? loaded > 0
      ? expected
        ? `Đã nhận ${nf.format(loaded)} / ${nf.format(expected)} điểm (${loadPct}%)`
        : `Đã nhận ${nf.format(loaded)} điểm`
      : 'Vui lòng chờ trong giây lát'
    : uploadedAt ? `Cập nhật ${new Date(uploadedAt).toLocaleDateString('vi-VN')}` : 'Chưa có dữ liệu'
  // Số gọn cho thanh thu gọn: 68.236 -> 68K, 6.540 -> 6,5K
  const shortTotal = total >= 1000 ? `${(total / 1000).toFixed(total < 10000 ? 1 : 0).replace('.', ',')}K` : nf.format(total)

  const railItems = [
    { id: 'data', icon: 'upload', label: 'Dữ liệu' },
    { id: 'style', icon: 'eye', label: 'Hiển thị' },
    { id: 'filter', icon: 'filter', label: 'Bộ lọc' },
  ]

  const tools = (
    <aside className={`tm-tools ${toolsCollapsed ? 'is-collapsed' : ''}`} aria-label="Thanh công cụ">
      <div className="tm-tools-head">
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
        <h2 className="tm-tools-title">Công cụ</h2>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon tm-tools-toggle"
          title={toolsCollapsed ? 'Mở thanh công cụ' : 'Thu gọn thanh công cụ'}
          aria-label={toolsCollapsed ? 'Mở thanh công cụ' : 'Thu gọn thanh công cụ'}
          aria-expanded={!toolsCollapsed}
          onClick={() => setTools(!toolsCollapsed)}
        >
          <Icon name="briefcase" size={18} />
        </button>
      </div>

      {toolsCollapsed ? (
        <div className="tm-rail">
          <span className="tm-rail-count" title={`${nf.format(total)} điểm bán`}>
            {loading ? '…' : shortTotal}
          </span>
          <span className="tm-rail-cap">điểm</span>
          <span className="tm-rail-sep" />
          {railItems.map((r) => (
            <button key={r.id} type="button" className="tm-rail-btn" title={r.label} onClick={() => openSection(r.id)}>
              <Icon name={r.icon} size={20} />
              {r.label}
            </button>
          ))}
          <span className="tm-rail-sep" />
          <button type="button" className="tm-rail-btn" title="Tải lại dữ liệu" onClick={load} disabled={loading}>
            <Icon name="refresh" size={20} />
            Tải lại
          </button>
        </div>
      ) : (
        <div className="tm-tools-body">
          <section className="tm-sec" id="tm-sec-data" aria-labelledby="tm-sec-data-h">
            <div className="tm-sec-head">
              <span className="eyebrow tm-sec-label" id="tm-sec-data-h">Dữ liệu</span>
              <button type="button" className="link tm-sec-link" onClick={load} disabled={loading}>
                Tải lại
              </button>
            </div>
            <div className="tm-stat">
              <strong>{nf.format(loading ? loaded : total)}</strong>
              <span>điểm bán</span>
            </div>
            <p className="tm-stat-sub">{statusText}</p>
            {user.isAdmin && (
              <div className="tm-tools-btns">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy} title="Nhập danh sách điểm bán từ file Excel">
                  <Icon name="upload" size={18} />
                  Nhập Excel
                </button>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={downloadTemplate} data-tip="Tải file mẫu" title="Tải file Excel mẫu" aria-label="Tải file Excel mẫu">
                  <Icon name="download" size={18} />
                </button>
                <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onPickFile} />
              </div>
            )}
          </section>

          <section className="tm-sec" id="tm-sec-style" aria-labelledby="tm-sec-style-h">
            <span className="eyebrow tm-sec-label" id="tm-sec-style-h">Hiển thị</span>
            <label className="field field-sm">
              Tô màu theo
              <select value={colorField} onChange={(e) => changeColorField(e.target.value)}>
                <option value="">Một màu</option>
                {COLOR_GROUPS.map((g) => (
                  <optgroup key={g.id} label={g.label}>
                    {COLOR_FIELDS.filter((c) => c.group === g.id).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="field field-sm" role="group" aria-label="Màu chấm">
              Màu chấm
              <div
                className={`tm-swatches ${scheme ? 'is-off' : ''}`}
                title={scheme ? 'Đang tô màu theo dữ liệu, chọn "Một màu" ở ô "Tô màu theo" để đổi màu chấm' : undefined}
              >
                {DOT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={dotStyle.color.toLowerCase() === c}
                    className={`tm-swatch ${dotStyle.color.toLowerCase() === c ? 'is-active' : ''}`}
                    style={{ background: c }}
                    aria-label={`Màu ${c}`}
                    disabled={Boolean(scheme)}
                    onClick={() => setDotStyle((d) => ({ ...d, color: c }))}
                  />
                ))}
                <label className={`tm-swatch tm-swatch-custom ${DOT_COLORS.includes(dotStyle.color.toLowerCase()) ? '' : 'is-active'}`} title="Chọn màu khác">
                  <input
                    type="color"
                    value={dotStyle.color}
                    aria-label="Chọn màu khác"
                    disabled={Boolean(scheme)}
                    onChange={(e) => setDotStyle((d) => ({ ...d, color: e.target.value }))}
                  />
                </label>
              </div>
            </div>
            <label className="field field-sm">
              Cỡ chấm
              <span className="tm-size">
                <input
                  type="range"
                  className="tm-range"
                  min="0.5"
                  max="4"
                  step="0.1"
                  value={dotStyle.scale}
                  onChange={(e) => setDotStyle((d) => ({ ...d, scale: Number(e.target.value) }))}
                />
                <span className="tm-size-val">{dotStyle.scale.toFixed(1)}x</span>
              </span>
            </label>
          </section>

          {/* Bộ lọc: khung tạm, chưa lọc dữ liệu */}
          <section className="tm-sec" id="tm-sec-filter" aria-labelledby="tm-sec-filter-h">
            <span className="eyebrow tm-sec-label" id="tm-sec-filter-h">Bộ lọc</span>
            <div className="tm-filters">
              {DIMENSIONS.map((d) => (
                <label key={d.key} className={`field field-sm ${WIDE_FILTERS.has(d.key) ? 'tm-filter-wide' : ''}`}>
                  {d.label}
                  <select defaultValue="">
                    <option value="">Tất cả</option>
                  </select>
                </label>
              ))}
            </div>
          </section>
        </div>
      )}

      <button
        type="button"
        className="tm-tools-edge"
        onClick={() => setTools(!toolsCollapsed)}
        aria-label={toolsCollapsed ? 'Mở thanh công cụ' : 'Thu gọn thanh công cụ'}
        title={toolsCollapsed ? 'Mở thanh công cụ' : 'Thu gọn thanh công cụ'}
      >
        <Icon name={toolsCollapsed ? 'chevron-left' : 'chevron-right'} size={16} />
      </button>
    </aside>
  )
  // Toàn màn hình (hoặc trang không có cột bên phải): thanh công cụ nằm ngay cạnh bản đồ
  const inlineTools = fullscreen || !slot

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

      <div className="tm-maprow">
      <div className="tm-mapbox">
        <div ref={mapElRef} className="tm-map" />
        {/* Nút trên bản đồ, nằm dưới nút phóng to/thu nhỏ: toàn màn hình; điện thoại thêm nút mở thanh công cụ */}
        <div className="tm-mapbtns">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            data-tip={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            title={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            aria-label={fullscreen ? 'Thoát toàn màn hình' : 'Xem toàn màn hình'}
            onClick={toggleFullscreen}
          >
            <Icon name={fullscreen ? 'collapse' : 'expand'} size={18} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon tm-tools-open" title="Thanh công cụ" aria-label="Mở thanh công cụ" onClick={() => setTools(false)}>
            <Icon name="briefcase" size={18} />
          </button>
        </div>
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
      {tab === 'map' && inlineTools && tools}
      </div>

      {!loading && !error && total === 0 && (
        <p className="tm-empty muted">
          {user.isAdmin ? 'Chưa có danh sách điểm bán. Mở "Thanh công cụ" và bấm "Nhập Excel" để bắt đầu (có file mẫu).' : 'Chưa có danh sách điểm bán. Vui lòng liên hệ quản trị viên.'}
        </p>
      )}
      </div>
      {tab === 'map' && !inlineTools && createPortal(tools, slot)}
    </section>
  )
}
