import { CHANNELS } from '../supabase.js'
import { EMPTY_FILTERS } from './util.js'

/** Bộ lọc điểm bán: các ô lọc đều nhau bên trái, nút chức năng bên phải (cùng bố cục với form tạo nhân viên). */
/** compact: tab Bản đồ, chỉ còn Nhân viên và Loại hình (bỏ tìm kiếm và ngày), chừa chỗ (#ad-map-controls) cho các ô tô màu của bản đồ để bản đồ có nhiều chỗ hơn. */
export default function FilterBar({ filters, onChange, employees, rows, shown, onExport, exporting, compact = false }) {
  const channels = [...new Set([...CHANNELS, ...rows.map((r) => r.channel).filter(Boolean)])]
  const hasFilter = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)
  const set = (k) => (e) => onChange({ ...filters, [k]: e.target.value })

  return (
    <div className={`card ad-addform ${compact ? 'ad-addform-compact' : ''}`}>
      <div className={`ad-addform-fields ${compact ? 'ad-fields-map' : 'ad-fields-4'}`}>
        {!compact && (
          <label className="field field-sm ad-span-all">
            <span>Tìm kiếm</span>
            <input
              type="search"
              placeholder="Ví dụ: Tạp hóa Bà Sáu, 12 Lê Lợi, Nguyễn Văn An"
              value={filters.q}
              onChange={set('q')}
            />
          </label>
        )}
        <label className={`field field-sm ${compact ? 'ad-fm-4' : ''}`}>
          <span>Nhân viên</span>
          <select className={filters.employee ? '' : 'is-empty'} value={filters.employee} onChange={set('employee')}>
            <option value="">Tất cả nhân viên</option>
            {employees.map((e) => (
              <option key={e.code} value={e.code}>
                {e.full_name ? `${e.full_name} (${e.code})` : e.code}
              </option>
            ))}
          </select>
        </label>
        <label className={`field field-sm ${compact ? 'ad-fm-4' : ''}`}>
          <span>Loại hình</span>
          <select className={filters.channel ? '' : 'is-empty'} value={filters.channel} onChange={set('channel')}>
            <option value="">Tất cả loại hình</option>
            {channels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {!compact && (
          <>
            <label className="field field-sm">
              <span>Từ ngày</span>
              <input
                className={filters.from ? '' : 'is-empty'}
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={set('from')}
              />
            </label>
            <label className="field field-sm">
              <span>Đến ngày</span>
              <input
                className={filters.to ? '' : 'is-empty'}
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={set('to')}
              />
            </label>
          </>
        )}
        {compact && <div className="ad-fm-slot" id="ad-map-controls" />}
      </div>
      <div className="ad-addform-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onExport} disabled={exporting || shown === 0}>
          {exporting ? 'Đang xuất...' : 'Xuất Excel'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!hasFilter} onClick={() => onChange({ ...EMPTY_FILTERS })}>
          Xóa lọc
        </button>
      </div>
    </div>
  )
}
