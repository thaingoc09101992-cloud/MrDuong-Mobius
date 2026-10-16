import { MODULES, PLATFORM_NAME } from '../modules.js'
import Icon from '../icons.jsx'

/** Trang chủ MOBIUS: các thẻ chức năng được phép dùng; riêng admin có thêm thẻ Trang quản trị. */
export default function Home({ user, onOpen }) {
  const allowed = MODULES.filter((m) => user.modules.includes(m.id))
  const nothing = allowed.length === 0 && !user.isAdmin

  return (
    <section className="stack">
      <header className="page-head">
        <span className="eyebrow">{PLATFORM_NAME} · Trang chủ</span>
        <h1 className="page-title">Xin chào, {user.full_name || user.code || user.email || 'bạn'}</h1>
        <p className="page-sub">Chọn chức năng để bắt đầu làm việc.</p>
      </header>

      {!nothing ? (
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

          {user.isAdmin && (
            <a className="module-card" href="/admin">
              <span className="module-icon">
                <Icon name="shield" size={26} />
              </span>
              <span className="module-name">Trang quản trị</span>
              <span className="module-desc">Quản lý nhân viên, phân quyền và dữ liệu của MOBIUS.</span>
              <span className="module-go">
                Mở trang quản trị
                <Icon name="chevron-right" size={16} />
              </span>
            </a>
          )}
        </div>
      ) : (
        <div className="card center muted">
          Bạn chưa được cấp quyền dùng chức năng nào. Vui lòng liên hệ quản lý để được phân quyền.
        </div>
      )}
    </section>
  )
}
