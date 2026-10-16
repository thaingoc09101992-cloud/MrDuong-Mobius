import { useEffect, useState } from 'react'
import { MODULES, moduleNames } from '../modules.js'
import Icon from '../icons.jsx'
import Hero from './Hero.jsx'
import { fetchBanners } from '../banners.js'

/** Home: lời chào và lối tắt tới các công cụ được phép dùng. */
export function HomePage({ user, onOpenTool }) {
  const allowed = MODULES.filter((m) => user.modules.includes(m.id))
  const name = user.full_name || user.code || (user.isAdmin ? 'Quản trị viên' : 'bạn')
  const [banners, setBanners] = useState([])

  useEffect(() => {
    let alive = true
    fetchBanners(true)
      .then((list) => alive && setBanners(list))
      .catch(() => {}) // không tải được banner thì hiện banner mặc định
    return () => {
      alive = false
    }
  }, [])

  return (
    <section className="stack">
      <Hero banners={banners} />
      <header className="page-head">
        <span className="eyebrow">Chào mừng trở lại</span>
        <h2 className="page-title">Xin chào, {name}</h2>
        <p className="page-sub">Chọn một công cụ để bắt đầu làm việc.</p>
      </header>
      <ToolGrid tools={allowed} onOpenTool={onOpenTool} />
    </section>
  )
}

function ToolGrid({ tools, onOpenTool }) {
  if (tools.length === 0) {
    return (
      <div className="card center muted">
        Bạn chưa được cấp quyền dùng công cụ nào. Vui lòng liên hệ quản lý để được phân quyền.
      </div>
    )
  }
  return (
    <div className="module-grid">
      {tools.map((m) => (
        <button key={m.id} type="button" className="module-card" onClick={() => onOpenTool(m.id)}>
          <span className="module-icon">
            <Icon name={m.icon} size={26} />
          </span>
          <span className="module-name">{m.name}</span>
          <span className="module-desc">{m.desc}</span>
          <span className="module-go">
            Mở công cụ
            <Icon name="chevron-right" size={16} />
          </span>
        </button>
      ))}
    </div>
  )
}

/** Công cụ: danh sách đầy đủ các chức năng của MOBIUS mà nhân viên được dùng. */
export function ToolsPage({ user, onOpenTool }) {
  const allowed = MODULES.filter((m) => user.modules.includes(m.id))
  return (
    <section className="stack">
      <header className="page-head">
        <span className="eyebrow">Danh mục công cụ</span>
        <h2 className="page-title">Công cụ làm việc</h2>
        <p className="page-sub">Các chức năng bạn được phân quyền sử dụng.</p>
      </header>
      <ToolGrid tools={allowed} onOpenTool={onOpenTool} />
    </section>
  )
}

/** Trang chưa có nội dung (Video đào tạo, Kiến thức). */
export function ComingSoonPage({ eyebrow, heading, text, icon }) {
  return (
    <section className="stack">
      <header className="page-head">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="page-title">{heading}</h2>
      </header>
      <div className="empty-state">
        <span className="module-icon">
          <Icon name={icon} size={26} />
        </span>
        <strong className="empty-title">Nội dung đang được cập nhật</strong>
        <p className="muted">{text}</p>
      </div>
    </section>
  )
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

/** Thông tin nhân viên: hồ sơ của chính người đang đăng nhập. */
export function ProfilePage({ user }) {
  const roleLabel = user.isAdmin ? 'Quản trị viên' : user.role === 'manager' ? 'Quản lý' : 'Nhân viên'
  const rows = [
    ['Mã nhân viên', user.code || '-'],
    ['Họ và tên', user.full_name || '-'],
    ['Email công ty', user.email || '-'],
    ['Số điện thoại', user.phone || '-'],
    ['Vai trò', roleLabel],
    ['Quản lý trực tiếp', user.manager_name || user.manager_code || '-'],
    ['Công cụ được dùng', moduleNames(user.modules)],
    ['Ngày bắt đầu', user.active_at ? formatDate(user.active_at) : '-'],
  ]
  return (
    <section className="stack">
      <header className="page-head">
        <span className="eyebrow">Hồ sơ cá nhân</span>
        <h2 className="page-title">Thông tin nhân viên</h2>
        <p className="page-sub">Thông tin do quản trị viên cập nhật. Cần chỉnh sửa, vui lòng liên hệ quản lý.</p>
      </header>
      {user.hasEmployee ? (
        <dl className="profile-list">
          {rows.map(([k, v]) => (
            <div className="profile-row" key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="card muted">
          Tài khoản quản trị này chưa có hồ sơ nhân viên. Email: <strong>{user.email}</strong>
        </div>
      )}
    </section>
  )
}
