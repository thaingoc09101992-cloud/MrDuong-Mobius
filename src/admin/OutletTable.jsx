import { useEffect, useState } from 'react'
import { photoUrl, formatTime } from '../supabase.js'
import { mapsUrl } from './util.js'

const PAGE_SIZE = 50

function PhotoModal({ outlet, onClose }) {
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
        <img src={photoUrl(outlet.photo_path)} alt={`Ảnh ${outlet.name}`} className="ad-modal-img" />
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
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OutletTable({ rows }) {
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    setPage(0)
  }, [rows])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const slice = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="stack">
      <div className="card ad-tablewrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Ảnh</th>
              <th>Tên điểm bán</th>
              <th>Địa chỉ</th>
              <th>Loại hình</th>
              <th>Nhân viên</th>
              <th>Thời gian</th>
              <th>Vị trí</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((o) => (
              <tr key={o.id}>
                <td>
                  <button type="button" className="ad-thumb-btn" onClick={() => setOpen(o)} aria-label={`Xem ảnh ${o.name}`}>
                    <img src={photoUrl(o.photo_path)} alt="" loading="lazy" className="ad-thumb" />
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

      {open && <PhotoModal outlet={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
