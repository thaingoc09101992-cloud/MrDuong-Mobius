import { useEffect, useMemo, useState } from 'react'
import { formatTime } from '../supabase.js'
import Icon from '../icons.jsx'
import OutletPhoto from '../OutletPhoto.jsx'
import { mapsUrl, fold } from './util.js'
import { SortLabel, SORT_HINT, compareValues } from './tableKit.jsx'

const PAGE_SIZE = 50

function PhotoModal({ outlet, onClose, onRotate }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ad-modal" role="dialog" aria-modal="true" aria-label={`Ảnh ${outlet.name}`} onClick={onClose}>
      <div className="ad-modal-box card" onClick={(e) => e.stopPropagation()}>
        <OutletPhoto outlet={outlet} alt={`Ảnh ${outlet.name}`} className="ad-modal-img" mode="fit" />
        <div className="stack">
          <strong>{outlet.name}</strong>
          {outlet.address && <span>{outlet.address}</span>}
          <span className="small muted">
            {outlet.channel || 'Chưa chọn loại hình'} - {formatTime(outlet.captured_at)}
          </span>
          <span className="small muted">
            NV: {outlet.employee_name ? `${outlet.employee_name} (${outlet.employee_code})` : outlet.employee_code}
          </span>
          <a className="link small" href={mapsUrl(outlet.lat, outlet.lng)} target="_blank" rel="noopener noreferrer">
            Mở Google Maps ({Number(outlet.lat).toFixed(6)}, {Number(outlet.lng).toFixed(6)}, sai số{' '}
            {Math.round(outlet.accuracy_m)}m)
          </a>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRotate(outlet, -1)}>
              <Icon name="rotate-left" size={16} />
              Xoay trái
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRotate(outlet, 1)}>
              <Icon name="rotate" size={16} />
              Xoay phải
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const COLUMNS = [
  { key: 'name', label: 'Tên điểm bán', type: 'text', get: (o) => o.name },
  { key: 'address', label: 'Địa chỉ', type: 'text', get: (o) => o.address || '' },
  { key: 'channel', label: 'Loại hình', type: 'text', get: (o) => o.channel || '' },
  { key: 'employee', label: 'Nhân viên', type: 'text', get: (o) => `${o.employee_name || ''} ${o.employee_code}`.trim() },
  { key: 'captured_at', label: 'Thời gian', type: 'date', get: (o) => o.captured_at },
]

function sortValue(col, o) {
  const raw = col.get(o)
  if (col.type === 'date') return raw ? Date.parse(raw) : null
  return raw ? String(raw) : null
}

function ColumnHead({ col, sort, onSort, filters, setFilters, showFilters }) {
  return (
    <th aria-sort={sort.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="ad-sort" onClick={() => onSort(col.key)} title={SORT_HINT[col.type]}>
        <SortLabel label={col.label} state={sort.key === col.key ? sort.dir : null} />
      </button>
      {showFilters && (
        <input
          className="ad-colfilter"
          type="search"
          value={filters[col.key] || ''}
          placeholder="Lọc..."
          onChange={(e) => setFilters((f) => ({ ...f, [col.key]: e.target.value }))}
          aria-label={`Lọc theo ${col.label}`}
        />
      )}
    </th>
  )
}

export default function OutletTable({ rows, onRotate }) {
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState(null)
  const [filters, setFilters] = useState({})
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState({ key: null, dir: 'asc' })

  const list = useMemo(() => {
    let out = rows.filter((o) =>
      COLUMNS.every((c) => {
        const f = (filters[c.key] || '').trim()
        if (!f) return true
        const raw = c.get(o)
        const text = c.type === 'date' ? formatTime(raw) : String(raw)
        return fold(text).includes(fold(f))
      }),
    )
    const col = COLUMNS.find((c) => c.key === sort.key)
    if (col) {
      const dir = sort.dir === 'asc' ? 1 : -1
      out = [...out].sort((a, b) => compareValues(sortValue(col, a), sortValue(col, b), dir))
    }
    return out
  }, [rows, filters, sort])

  useEffect(() => {
    setPage(0)
  }, [list])

  const activeFilters = Object.values(filters).filter((v) => (v || '').trim() !== '').length
  const hasFilter = activeFilters > 0 || sort.key !== null

  function toggleSort(key) {
    setSort((s) => {
      if (s.key !== key) return { key, dir: 'asc' }
      if (s.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: 'asc' }
    })
  }

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const slice = list.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const headProps = { sort, onSort: toggleSort, filters, setFilters, showFilters }
  const col = (k) => COLUMNS.find((c) => c.key === k)

  return (
    <div className="stack">
      <div className="ad-toolbar">
        <div className="row wrap-row">
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${showFilters ? 'is-on' : ''}`}
            aria-pressed={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            Lọc theo cột{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </button>
          {hasFilter && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setFilters({})
                setSort({ key: null, dir: 'asc' })
              }}
            >
              Xóa lọc và sắp xếp
            </button>
          )}
        </div>
      </div>

      <div className="card ad-tablewrap">
        <table className={`ad-table ad-table-compact ${showFilters ? 'is-filtering' : ''}`}>
          <thead>
            <tr>
              <th>Ảnh</th>
              <ColumnHead col={col('name')} {...headProps} />
              <ColumnHead col={col('address')} {...headProps} />
              <ColumnHead col={col('channel')} {...headProps} />
              <ColumnHead col={col('employee')} {...headProps} />
              <ColumnHead col={col('captured_at')} {...headProps} />
              <th>Vị trí</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((o) => (
              <tr key={o.id}>
                <td>
                  <button type="button" className="ad-thumb-btn" onClick={() => setOpen(o)} aria-label={`Xem ảnh ${o.name}`}>
                    <OutletPhoto outlet={o} loading="lazy" className="ad-thumb" />
                  </button>
                </td>
                <td className="ad-wrap">
                  <strong>{o.name}</strong>
                </td>
                <td className="ad-wrap">{o.address || <span className="muted">-</span>}</td>
                <td>{o.channel || <span className="muted">-</span>}</td>
                <td className="ad-wrap">
                  {o.employee_name ? `${o.employee_name}` : ''}
                  <span className="muted small ad-block">{o.employee_code}</span>
                </td>
                <td className="ad-nowrap">{formatTime(o.captured_at)}</td>
                <td className="ad-nowrap">
                  <a className="link small" href={mapsUrl(o.lat, o.lng)} target="_blank" rel="noopener noreferrer">
                    {Number(o.lat).toFixed(5)}, {Number(o.lng).toFixed(5)}
                  </a>
                  <span className="muted small ad-block">sai số {Math.round(o.accuracy_m)}m</span>
                </td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td colSpan={7} className="center muted">
                  Không có điểm bán nào khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="row between">
          <button type="button" className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Trang trước
          </button>
          <span className="small muted">
            Trang {page + 1} / {pages}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={page >= pages - 1}
            onClick={() => setPage(page + 1)}
          >
            Trang sau
          </button>
        </div>
      )}

      {open && <PhotoModal outlet={rows.find((r) => r.id === open.id) || open} onClose={() => setOpen(null)} onRotate={onRotate} />}
    </div>
  )
}
