import { CHANNELS } from '../supabase.js'
import { EMPTY_FILTERS } from './util.js'

export default function FilterBar({ filters, onChange, employees, rows, shown, onExport, exporting }) {
  const channels = [...new Set([...CHANNELS, ...rows.map((r) => r.channel).filter(Boolean)])]
  const hasFilter = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)
  const set = (k) => (e) => onChange({ ...filters, [k]: e.target.value })

  return (
    <div className="card ad-filters">
      <div className="ad-filter-grid">
        <label className="field field-sm ad-search">
          <span>Tìm kiếm</span>
          <input
            type="search"
            placeholder="Tên điểm bán, địa chỉ, nhân viên"
            value={filters.q}
            onChange={set('q')}
          />
        </label>
        <label className="field field-sm">
          <span>Nhân viên</span>
          <select value={filters.employee} onChange={set('employee')}>
            <option value="">Tất cả</option>
            {employees.map((e) => (
              <option key={e.code} value={e.code}>
                {e.full_name ? `${e.full_name} (${e.code})` : e.code}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-sm">
          <span>Loại hình</span>
          <select value={filters.channel} onChange={set('channel')}>
            <option value="">Tất cả</option>
            {channels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-sm">
          <span>Từ ngày</span>
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={set('from')} />
        </label>
        <label className="field field-sm">
          <span>Đến ngày</span>
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={set('to')} />
        </label>
      </div>
      <div className="row between wrap-row">
        <span className="small muted">
          Hiển thị <strong>{shown}</strong> / {rows.length} điểm bán
        </span>
        <div className="row">
          {hasFilter && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...EMPTY_FILTERS })}>
              Xóa lọc
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onExport}
            disabled={exporting || shown === 0}
          >
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        </div>
      </div>
    </div>
  )
}
