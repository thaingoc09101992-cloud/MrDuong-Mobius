import { useEffect, useState } from 'react'
import Icon from './icons.jsx'
import Logo from './Logo.jsx'
import { safeGet, safeSet } from './supabase.js'
import { PLATFORM_NAME } from './modules.js'
import useReveal from './useReveal.js'
import './shell.css'

/**
 * Khung có thanh bên của app nhân viên (cùng kiểu với trang quản trị):
 * thông tin tài khoản ở góc trái trên, menu chính, mục Trang quản trị (chỉ admin), đổi giao diện và đăng xuất.
 */
const RAIL_QUERY = '(min-width: 901px) and (max-width: 1099px)'

export default function AppShell({ user, nav, active, onNavigate, theme, onToggleTheme, onLogout, eyebrow, title, hasTabbar, bottomBar, wide = false, children }) {
  useReveal()
  const [collapsed, setCollapsed] = useState(() => safeGet('mb-collapsed') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  // Màn hình 901-1099px: thanh bên tự thu gọn thành cột biểu tượng để nhường chỗ cho nội dung
  const [narrow, setNarrow] = useState(() => window.matchMedia(RAIL_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(RAIL_QUERY)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const who = user.full_name || user.email || user.code || ''
  const initial = who.trim().charAt(0).toUpperCase() || '?'
  const roleLabel = user.isAdmin ? 'Quản trị viên' : user.role === 'manager' ? 'Quản lý' : 'Nhân viên'
  const dark = theme === 'dark'

  function toggleSidebar() {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setMobileOpen((o) => !o)
    } else {
      setCollapsed((c) => {
        safeSet('mb-collapsed', c ? '0' : '1')
        return !c
      })
    }
  }

  function go(id) {
    onNavigate(id)
    setMobileOpen(false)
  }

  return (
    <div className={`ad-shell ${collapsed || narrow ? 'is-collapsed' : ''} ${mobileOpen ? 'is-open' : ''}`}>
      <aside className="ad-sidebar" aria-label="Menu">
        <div className="ad-brandbar">
          <Logo size={46} />
          <span className="ad-brandname">{PLATFORM_NAME}</span>
        </div>

        <nav className="ad-nav" aria-label="Điều hướng chính">
          {nav.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`ad-navbtn ${active === t.id ? 'is-active' : ''}`}
              aria-current={active === t.id ? 'page' : undefined}
              title={t.label}
              onClick={() => go(t.id)}
            >
              <Icon name={t.icon} size={20} />
              <span className="ad-label">{t.label}</span>
            </button>
          ))}

          {user.isAdmin && (
            <div className="ad-navgroup" role="group" aria-label="Quản trị">
              <span className="ad-navlabel">Quản trị</span>
              <a className="ad-navbtn" href="/admin" title="Trang quản trị">
                <Icon name="shield" size={20} />
                <span className="ad-label">Trang quản trị</span>
              </a>
            </div>
          )}
        </nav>

        <div className="ad-sidebar-foot">
          <button
            type="button"
            className="ad-navbtn"
            onClick={onToggleTheme}
            title={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          >
            <Icon name={dark ? 'sun' : 'moon'} size={20} />
            <span className="ad-label">{dark ? 'Giao diện sáng' : 'Giao diện tối'}</span>
          </button>
          <button type="button" className="ad-navbtn" onClick={onLogout} title="Đăng xuất">
            <Icon name="logout" size={20} />
            <span className="ad-label">Đăng xuất</span>
          </button>
        </div>
      </aside>
      <div className="ad-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      {!narrow && (
        <button
          type="button"
          className="ad-edge-toggle"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        >
          <span className="ico-l">
            <Icon name="chevron-left" size={16} />
          </span>
          <span className="ico-r">
            <Icon name="chevron-right" size={16} />
          </span>
        </button>
      )}

      <div className="ad-content">
        <header className="ad-bar">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon ad-bar-menu"
            onClick={toggleSidebar}
            aria-label="Mở menu"
            aria-expanded={mobileOpen}
          >
            <Icon name="panel" size={20} />
          </button>
          <Logo size={36} className="ad-bar-logo" />
          <div className="ad-bar-title">
            <span className="eyebrow">{eyebrow || PLATFORM_NAME}</span>
            <h1 className="ad-pagetitle">{title}</h1>
          </div>
          <div className="ad-bar-account">
            <div className="ad-account-info">
              <strong title={who}>{who}</strong>
              <span className="small muted">{[user.code, roleLabel].filter(Boolean).join(' · ')}</span>
            </div>
            <span className="ad-avatar" aria-hidden="true">
              {initial}
            </span>
          </div>
        </header>
        <main className={`ad-main ${hasTabbar ? 'has-tabbar' : ''} ${wide ? 'is-wide' : ''}`}>{children}</main>
      </div>
      {bottomBar}
    </div>
  )
}
