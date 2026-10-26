import { formatTime } from '../supabase.js'
import Icon from '../icons.jsx'
import OutletPhoto from '../OutletPhoto.jsx'

export default function History({ outlets, loading, isManager, onRefresh, canRotate, onRotate }) {
  return (
    <section className="stack">
      <div className="row between">
        <span className="small muted">{outlets.length} điểm bán</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={loading}>
          {loading ? 'Đang tải...' : 'Tải lại'}
        </button>
      </div>

      {!loading && outlets.length === 0 && (
        <div className="card center muted">Chưa có điểm bán nào. Hãy chụp điểm bán đầu tiên.</div>
      )}

      <ul className="list">
        {outlets.map((o) => (
          <li key={o.id} className="card item">
            <OutletPhoto outlet={o} alt={`Ảnh ${o.name}`} loading="lazy" className="thumb" />
            <div className="item-body">
              <strong className="item-title">{o.name}</strong>
              {o.address && <span className="small muted">{o.address}</span>}
              <span className="item-meta">
                <span className="chip">{o.channel || 'Chưa chọn loại hình'}</span>
                <span className="small muted">{formatTime(o.captured_at)}</span>
              </span>
              {isManager && (
                <span className="small muted">
                  NV: {o.employee_name ? `${o.employee_name} (${o.employee_code})` : o.employee_code}
                </span>
              )}
              <a
                className="small link"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://www.openstreetmap.org/?mlat=${o.lat}&mlon=${o.lng}#map=19/${o.lat}/${o.lng}`}
              >
                Xem vị trí ({Number(o.lat).toFixed(5)}, {Number(o.lng).toFixed(5)})
              </a>
              {canRotate(o) && (
                <button type="button" className="btn btn-ghost btn-sm item-rotate" onClick={() => onRotate(o)}>
                  <Icon name="rotate" size={16} />
                  Xoay ảnh
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
