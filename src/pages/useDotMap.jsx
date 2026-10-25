import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { safeGet, safeSet } from '../supabase.js'
import Icon from '../icons.jsx'
import { DotLayer, DOT_COLORS, loadDotStyle } from './dotLayer.js'
import { buildTextScheme } from './tradeColor.js'
import { buildPopup } from './outletPopup.js'

const DOT_STYLE_KEY = 'mr-dot-style'
const COLOR_FIELD_KEY = 'mr-color-field'
const NO_COLOR = 'none' // người xem chọn "Một màu"
const DEFAULT_SCALE = 1.6 // số điểm ít hơn Bố trận nhiều, nên chấm mặc định to hơn
const TOUCH_HIT = 14 // vùng bấm quanh chấm (px), đủ cho ngón tay

const pad2 = (n) => String(n).padStart(2, '0')
const dayLabel = (iso) => {
  const d = new Date(iso)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Các trường có thể tô màu; get trả về giá trị chữ (null = chưa có dữ liệu). managerOnly: chỉ có ý nghĩa khi xem nhiều nhân viên. */
const COLOR_FIELDS = [
  { id: 'channel', label: 'Loại hình', otherLabel: 'Loại hình khác', get: (o) => o.channel || null },
  { id: 'employee', label: 'Nhân viên', otherLabel: 'Nhân viên khác', managerOnly: true, get: (o) => (o.employee_name ? `${o.employee_name} (${o.employee_code})` : o.employee_code || null) },
  { id: 'day', label: 'Ngày chụp', otherLabel: 'Ngày khác', get: (o) => dayLabel(o.captured_at) },
]

/**
 * Bản đồ chấm điểm bán dùng chung cho tab Bản đồ của nhân viên và trang quản trị: cùng lớp vẽ chấm với Bố trận điểm bán,
 * tô màu theo trường dữ liệu, chọn màu và cỡ chấm, chú giải bấm để ẩn/hiện nhóm.
 * Trả về: mapElRef (gắn vào khung bản đồ), mapRef, controls (ba ô điều khiển, đặt trong .filters) và legend (đặt cạnh khung bản đồ).
 */
export default function useDotMap({ points, isManager }) {
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const dotsRef = useRef(null)

  const [colorField, setColorField] = useState(() => {
    const v = safeGet(COLOR_FIELD_KEY)
    return v === NO_COLOR || COLOR_FIELDS.some((c) => c.id === v) ? v : 'channel'
  })
  const [hiddenBands, setHiddenBands] = useState(() => new Set())
  const [dotStyle, setDotStyle] = useState(() => loadDotStyle(DOT_STYLE_KEY, DEFAULT_SCALE))
  const [legendOpen, setLegendOpen] = useState(() => !window.matchMedia('(max-width: 720px)').matches)

  // Khởi tạo bản đồ một lần
  useEffect(() => {
    const map = L.map(mapElRef.current, { zoomControl: true }).setView([10.78, 106.7], 11)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    const dots = new DotLayer(
      (o) => {
        L.popup({ maxWidth: 260, minWidth: 200, autoPanPadding: [24, 24] })
          .setLatLng([o.lat, o.lng])
          .setContent(buildPopup(o))
          .openOn(map)
      },
      { hit: TOUCH_HIT },
    )
    dots.addTo(map)
    mapRef.current = map
    dotsRef.current = dots
    return () => {
      map.remove()
      mapRef.current = null
      dotsRef.current = null
    }
  }, [])

  // Vẽ lại chấm và canh khung nhìn khi dữ liệu hoặc bộ lọc đổi
  useEffect(() => {
    const map = mapRef.current
    const dots = dotsRef.current
    if (!map || !dots) return
    dots.setPoints(points)
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points.map((o) => [o.lat, o.lng])).pad(0.2), { maxZoom: 17 })
    }
  }, [points])

  // Tô màu theo trường dữ liệu: chia nhóm khi điểm hiện có hoặc trường đổi, rồi giao cho lớp vẽ
  const field = COLOR_FIELDS.find((c) => c.id === colorField && (!c.managerOnly || isManager))
  const scheme = useMemo(
    () => (field && points.length > 0 ? buildTextScheme(field, points.map(field.get)) : null),
    [field, points],
  )
  useEffect(() => {
    if (dotsRef.current) dotsRef.current.setScheme(scheme, hiddenBands)
  }, [scheme, hiddenBands, points])
  useEffect(() => {
    safeSet(COLOR_FIELD_KEY, colorField)
  }, [colorField])
  useEffect(() => {
    if (dotsRef.current) dotsRef.current.setStyle(dotStyle.color, dotStyle.scale)
    safeSet(DOT_STYLE_KEY, JSON.stringify(dotStyle))
  }, [dotStyle])

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

  const controls = (
    <>
      <label className="field field-sm">
        <span>Tô màu theo</span>
        <select value={field ? field.id : NO_COLOR} onChange={(e) => changeColorField(e.target.value)}>
          <option value={NO_COLOR}>Một màu</option>
          {COLOR_FIELDS.filter((c) => !c.managerOnly || isManager).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <div className="field field-sm" role="group" aria-label="Màu chấm">
        <span>Màu chấm</span>
        <div
          className={`tm-swatches ${scheme ? 'is-off' : ''}`}
          title={scheme ? 'Đang tô màu theo dữ liệu, chọn "Một màu" để đổi màu chấm' : undefined}
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
        <span>Cỡ chấm</span>
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
    </>
  )

  const legend = scheme && (
    <div className="tm-colorpanel map-legend">
      <button type="button" className="map-legend-head" aria-expanded={legendOpen} onClick={() => setLegendOpen((v) => !v)}>
        <span className="tm-field-label">{field.label}</span>
        <span className={`map-legend-chev ${legendOpen ? 'is-open' : ''}`}>
          <Icon name="chevron-down" size={16} />
        </span>
      </button>
      {legendOpen && (
        <>
          <ul className="tm-legend" aria-label={`Chú giải: ${field.label}`}>
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
                  <span className="tm-legend-count">{b.count}</span>
                </button>
              </li>
            ))}
          </ul>
          {hiddenBands.size > 0 && (
            <button type="button" className="tm-legend-reset" onClick={() => setHiddenBands(new Set())}>
              Hiện tất cả nhóm
            </button>
          )}
        </>
      )}
    </div>
  )

  return { mapElRef, mapRef, controls, legend }
}