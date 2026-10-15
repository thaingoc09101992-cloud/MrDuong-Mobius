import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import { photoUrl, formatTime } from '../supabase.js'

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined && text !== null) node.textContent = text
  return node
}

/** Dựng popup bằng DOM + textContent để dữ liệu người dùng nhập không thể chèn mã HTML. */
export function buildPopup(o) {
  const box = el('div', 'popup')
  const img = el('img', 'popup-img')
  img.src = photoUrl(o.photo_path)
  img.alt = `Ảnh ${o.name}`
  img.loading = 'lazy'
  box.appendChild(img)
  box.appendChild(el('strong', 'popup-title', o.name))
  if (o.address) box.appendChild(el('div', null, o.address))
  box.appendChild(el('div', 'popup-muted', `${o.channel || 'Chưa chọn loại hình'} - ${formatTime(o.captured_at)}`))
  box.appendChild(
    el('div', 'popup-muted', `NV: ${o.employee_name ? `${o.employee_name} (${o.employee_code})` : o.employee_code}`),
  )
  return box
}

export const pinIcon = L.divIcon({
  className: 'pin-wrap',
  html: '<span class="pin"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -24],
})

function dayKey(iso) {
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function MapReport({ outlets, loading, isManager, onRefresh }) {
  const wrapRef = useRef(null)
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const clusterRef = useRef(null)

  const [employee, setEmployee] = useState('')
  const [channel, setChannel] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [fullscreen, setFullscreen] = useState(false)

  const employees = useMemo(() => {
    const m = new Map()
    outlets.forEach((o) => m.set(o.employee_code, o.employee_name || o.employee_code))
    return [...m.entries()]
  }, [outlets])

  const channels = useMemo(
    () => [...new Set(outlets.map((o) => o.channel).filter(Boolean))],
    [outlets],
  )

  const filtered = useMemo(
    () =>
      outlets.filter((o) => {
        if (employee && o.employee_code !== employee) return false
        if (channel && o.channel !== channel) return false
        const k = dayKey(o.captured_at)
        if (from && k < from) return false
        if (to && k > to) return false
        return true
      }),
    [outlets, employee, channel, from, to],
  )

  // Khởi tạo bản đồ một lần
  useEffect(() => {
    const map = L.map(mapElRef.current, { zoomControl: true }).setView([10.78, 106.7], 11)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    const cluster = L.markerClusterGroup({ maxClusterRadius: 50 })
    map.addLayer(cluster)
    mapRef.current = map
    clusterRef.current = cluster
    return () => {
      map.remove()
      mapRef.current = null
      clusterRef.current = null
    }
  }, [])

  // Vẽ lại điểm khi dữ liệu hoặc bộ lọc đổi
  useEffect(() => {
    const map = mapRef.current
    const cluster = clusterRef.current
    if (!map || !cluster) return
    cluster.clearLayers()
    const markers = filtered.map((o) => {
      const m = L.marker([o.lat, o.lng], { icon: pinIcon, title: o.name })
      m.bindPopup(() => buildPopup(o), { maxWidth: 260, minWidth: 200, autoPanPadding: [24, 24] })
      return m
    })
    cluster.addLayers(markers)
    if (filtered.length > 0) {
      map.fitBounds(cluster.getBounds().pad(0.2), { maxZoom: 17 })
    }
  }, [filtered])

  // Theo dõi chế độ toàn màn hình
  useEffect(() => {
    function onChange() {
      const active = document.fullscreenElement === wrapRef.current
      setFullscreen(active)
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

  function clearFilters() {
    setEmployee('')
    setChannel('')
    setFrom('')
    setTo('')
  }

  const hasFilter = employee || channel || from || to

  return (
    <section className={`map-wrap ${fullscreen ? 'map-full' : ''}`} ref={wrapRef}>
      <div className="map-toolbar">
        <div className="row between wrap-row">
          <strong>
            {filtered.length} / {outlets.length} điểm {isManager ? '(toàn bộ)' : 'của tôi'}
          </strong>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={loading}>
              {loading ? 'Đang tải...' : 'Tải lại'}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={toggleFullscreen}>
              {fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            </button>
          </div>
        </div>

        <div className="filters">
          {isManager && (
            <label className="field field-sm">
              <span>Nhân viên</span>
              <select className={employee ? '' : 'is-empty'} value={employee} onChange={(e) => setEmployee(e.target.value)}>
                <option value="">Tất cả nhân viên</option>
                {employees.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label === code ? code : `${label} (${code})`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field field-sm">
            <span>Loại hình</span>
            <select className={channel ? '' : 'is-empty'} value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">Tất cả loại hình</option>
              {channels.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="field field-sm">
            <span>Từ ngày</span>
            <input className={from ? '' : 'is-empty'} type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field field-sm">
            <span>Đến ngày</span>
            <input className={to ? '' : 'is-empty'} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          {hasFilter && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      <div className="map-canvas" ref={mapElRef} />

      {!loading && outlets.length === 0 && (
        <div className="map-empty muted">Chưa có điểm nào để hiển thị trên bản đồ.</div>
      )}
    </section>
  )
}
