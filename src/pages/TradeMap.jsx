import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { supabase } from '../supabase.js'
import { fold } from '../admin/util.js'
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
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const fitRef = useRef(false)
  const fileRef = useRef(null)

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState(null) // kết quả đọc file đang chờ xác nhận
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

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
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  const visible = useMemo(() => {
    const q = fold(search.trim())
    if (!q) return stores
    return stores.filter((s) => fold(`${s.name} ${s.store_code || ''} ${s.address || ''}`).includes(q))
  }, [stores, search])

  // Vẽ lại ghim khi dữ liệu hoặc từ khóa tìm kiếm đổi
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const points = []
    visible.forEach((s) => {
      const m = L.circleMarker([s.lat, s.lng], {
        radius: 7,
        color: '#ffffff',
        weight: 1.5,
        fillColor: PIN_COLOR,
        fillOpacity: 0.92,
      })
      m.bindPopup(() => buildPopup(s), { maxWidth: 280, minWidth: 220, autoPanPadding: [24, 24] })
      m.addTo(layer)
      points.push([s.lat, s.lng])
    })
    if (fitRef.current && points.length > 0) {
      map.fitBounds(L.latLngBounds(points).pad(0.15), { maxZoom: 16 })
      fitRef.current = false
    }
  }, [visible])

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
    <section className="map-wrap tm">
      <div className="map-toolbar">
        <div className="row between wrap-row">
          <strong>
            {visible.length} / {total} điểm bán
            {uploadedAt && <span className="muted tm-date"> · cập nhật {new Date(uploadedAt).toLocaleDateString('vi-VN')}</span>}
          </strong>
          <div className="row wrap-row">
            {user.isAdmin && (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={downloadStoresTemplate}>
                  Tải file mẫu
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}>
                  Tải danh sách Excel
                </button>
                <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onPickFile} />
              </>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
              {loading ? 'Đang tải...' : 'Tải lại'}
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
            <div className="row wrap-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={confirmReplace} disabled={busy || preview.rows.length === 0}>
                {busy ? 'Đang lưu...' : `Thay thế bằng ${preview.rows.length} điểm bán`}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview(null)} disabled={busy}>
                Hủy
              </button>
            </div>
          </div>
        )}

        <label className="field field-sm tm-search">
          <span>Tìm điểm bán</span>
          <input
            type="search"
            value={search}
            placeholder="Tên, mã hoặc địa chỉ"
            onChange={(e) => {
              fitRef.current = true
              setSearch(e.target.value)
            }}
          />
        </label>
      </div>

      <div ref={mapElRef} className="map-canvas" />
      {!loading && !error && total === 0 && (
        <p className="map-empty muted">
          {user.isAdmin ? 'Chưa có danh sách điểm bán. Bấm "Tải danh sách Excel" để bắt đầu (có file mẫu).' : 'Chưa có danh sách điểm bán. Vui lòng liên hệ quản trị viên.'}
        </p>
      )}
    </section>
  )
}