import { photoUrl, formatTime } from '../supabase.js'

export default function History({ outlets, loading, isManager, onRefresh }) {
  return (
    <section className="stack">
      <div className="row between">
        <h2>{isManager ? 'Tất cả điểm bán' : 'Điểm bán của tôi'}</h2>
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
            <img src={photoUrl(o.photo_path)} alt={`Ảnh ${o.name}`} loading="lazy" className="thumb" />
            <div className="item-body">
              <strong className="item-title">{o.name}</strong>
              {o.address && <span className="small">{o.address}</span>}
              <span className="small muted">
                {o.channel || 'Chưa chọn loại hình'} - {formatTime(o.captured_at)}
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
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
