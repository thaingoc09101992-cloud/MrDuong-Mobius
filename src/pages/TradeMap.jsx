import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import { supabase } from '../supabase.js'
import { fold } from '../admin/util.js'
import Icon from '../icons.jsx'
import { parseStoresFile, downloadStoresTemplate, MAX_STORES } from './tradeExcel.js'
import './tradeMap.css'

const PIN_COLOR = '#0284c7'

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
  const box = el('div', 'popup')
  box.appendChild(el('strong', 'popup-title', s.name))
  if (s.store_code) box.appendChild(el('div', 'popup-muted', `Mã: ${s.store_code}`))
  if (s.address) box.appendChild(el('div', null, s.address))
  const list = el('div', 'tm-popup-grid')
  ;[
    ['Doanh số tháng này', s.revenue_current],
    ['Doanh thu 6 tháng', s.revenue_6m],
    ['Trung bình 6 tháng', s.avg_6m],
    ['Số đơn mỗi tháng', s.orders_per_month],
  ].forEach(([label, value]) => {
    list.appendChild(el('span', 'popup-muted', label))
    list.appendChild(el('strong', null, fmt(value)))
  })
  box.appendChild(list)
  if (s.top_skus) box.appendChild(el('div', 'popup-muted', `SKU hay mua: ${s.top_skus}`))
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
  const clusterRef = useRef(null)
  const fitRef = useRef(false)
  const fileRef = useRef(null)

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState(null) // kết quả đọc file đang chờ xác nhận
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [fullscreen, setFullscreen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.rpc('app_list_trade_stores')
    if (err) {
      setError(friendlyError(err))
      setStores([])
    } else {
      fitRef.current = true
      setStores(Array.isArray(data) ? data : [])
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
    const cluster = L.markerClusterGroup({ maxClusterRadius: 50, chunkedLoading: true })
    map.addLayer(cluster)
    mapRef.current = map
    clusterRef.current = cluster
    return () => {
      map.remove()
      mapRef.current = null
      clusterRef.current = null
    }
  }, [])

  const visible = useMemo(() => {
    const q = fold(search.trim())
    if (!q) return stores
    return stores.filter((s) => fold(`${s.name} ${s.store_code || ''} ${s.address || ''}`).includes(q))
  }, [stores, search])

  // Vẽ lại điểm khi dữ liệu hoặc từ khóa tìm kiếm đổi
  useEffect(() => {
    const map = mapRef.current
    const cluster = clusterRef.current
    if (!map || !cluster) return
    cluster.clearLayers()
    const markers = visible.map((s) => {
      const m = L.circleMarker([s.lat, s.lng], {
        radius: 7,
        color: '#ffffff',
        weight: 1.5,
        fillColor: PIN_COLOR,
        fillOpacity: 0.92,
      })
      m.bindPopup(() => buildPopup(s), { maxWidth: 280, minWidth: 220, autoPanPadding: [24, 24] })
      return m
    })
    cluster.addLayers(markers)
    if (fitRef.current && markers.length > 0) {
      map.fitBounds(cluster.getBounds().pad(0.15), { maxZoom: 16 })
      fitRef.current = false
    }
  }, [visible])

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
    const { data, error: err } = await supabase.rpc('app_replace_trade_stores', { p_rows: preview.rows })
    setBusy(false)
    if (err) {
      setNotice(friendlyError(err))
      return
    }
    setPreview(null)
    setNotice(`Đã cập nhật ${data} điểm bán.`)
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
            onChange={(e) => {
              fitRef.current = true
              setSearch(e.target.value)
            }}
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