import { MODULES, PLATFORM_NAME } from '../modules.js'
import Icon from '../icons.jsx'

/** Trang chủ MOBIUS: các thẻ chức năng mà nhân viên được phép dùng. */
export default function Home({ user, onOpen }) {
  const allowed = MODULES.filter((m) => user.modules.includes(m.id))

  return (
    <section className="stack">
      <header className="page-head">
        <span className="eyebrow">{PLATFORM_NAME} · Trang chủ</span>
        <h1 className="page-title">Xin chào, {user.full_name || user.code}</h1>
        <p className="page-sub">Chọn chức năng để bắt đầu làm việc.</p>
      </header>

      {allowed.length > 0 ? (
        <div className="module-grid">
          {allowed.map((m) => (
            <button key={m.id} type="button" className="module-card" onClick={() => onOpen(m.id)}>
              <span className="module-icon">
                <Icon name={m.icon} size={26} />
              </span>
              <span className="module-name">{m.name}</span>
              <span className="module-desc">{m.desc}</span>
              <span className="module-go">
                Mở chức năng
                <Icon name="chevron-right" size={16} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="card center muted">
          Bạn chưa được cấp quyền dùng chức năng nào. Vui lòng liên hệ quản lý để được phân quyền.
        </div>
      )}
    </section>
  )
}
