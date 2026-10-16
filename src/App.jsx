import { useCallback, useEffect, useState } from 'react'
import { supabase, safeSet } from './supabase.js'
import { MODULES, PLATFORM_NAME, modulesOf } from './modules.js'
import Login from './pages/Login.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import Home from './pages/Home.jsx'
import Capture from './pages/Capture.jsx'
import History from './pages/History.jsx'
import MapReport from './pages/MapReport.jsx'
import Icon from './icons.jsx'
import Logo from './Logo.jsx'

const HOME = 'home'

// Các màn hình bên trong chức năng "Định vị điểm bán"
const TABS = [
  { id: 'capture', label: 'Chụp ảnh', icon: 'camera' },
  { id: 'history', label: 'Lịch sử', icon: 'history' },
  { id: 'map', label: 'Bản đồ', icon: 'map' },
]

const PAGES = {
  capture: {
    eyebrow: '01 / Thu thập',
    title: 'Chụp điểm bán',
    sub: 'Chụp ảnh tại cửa hàng, hệ thống tự gắn định vị và thời gian.',
  },
  history: {
    eyebrow: '02 / Lưu trữ',
    title: (m) => (m ? 'Điểm bán của đội' : 'Điểm bán của tôi'),
    sub: 'Danh sách các điểm bán đã ghi nhận, mới nhất ở trên cùng.',
  },
  map: {
    eyebrow: '03 / Bản đồ',
    title: 'Bản đồ điểm bán',
    sub: 'Xem vị trí các điểm bán và lọc theo loại hình, thời gian.',
  },
}

function normalizeUser(data) {
  return { ...data, modules: modulesOf(data) }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)
  const [view, setView] = useState(HOME) // HOME hoặc mã chức năng
  const [tab, setTab] = useState('capture')
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light',
  )
  const [outlets, setOutlets] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    safeSet('theme', theme)
  }, [theme])

  // Khôi phục phiên đăng nhập: chỉ giữ lại nếu tài khoản vẫn Active và có email
  useEffect(() => {
    let alive = true
    safeSet('user', null) // dọn dữ liệu đăng nhập bằng mã của phiên bản cũ

    async function restore() {
      const { data: s } = await supabase.auth.getSession()
      if (!s.session) return
      const { data, error } = await supabase.rpc('app_me')
      if (!alive) return
      if (error || !data) {
        await supabase.auth.signOut()
        return
      }
      setUser(normalizeUser(data))
    }
    restore().finally(() => alive && setBooting(false))

    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_OUT') {
        setUser(null)
        setOutlets([])
        setView(HOME)
      }
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const ready = Boolean(user) && !user.must_change_password
  const inLocate = view === 'dinh-vi-diem-ban'

  const refresh = useCallback(async () => {
    if (!ready || !user.modules.includes('dinh-vi-diem-ban')) return
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase.rpc('app_list_outlets')
    if (error) {
      // Tài khoản bị reset mật khẩu, chuyển Inactive, mất quyền hoặc bị xóa trong lúc đang đăng nhập: buộc đăng nhập lại
      if (/khong duoc phep/i.test(error.message || '')) {
        await supabase.auth.signOut()
        setLoading(false)
        return
      }
      setLoadError('Không tải được dữ liệu. Vui lòng kiểm tra mạng và thử lại.')
    } else {
      setOutlets(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }, [ready, user])

  useEffect(() => {
    refresh()
  }, [refresh])

  function handleLogin(u) {
    setUser(normalizeUser(u))
    setView(HOME)
    setTab('capture')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setOutlets([])
    setView(HOME)
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  if (booting) return <div className="boot">Đang tải...</div>

  if (!user) {
    return <Login onLogin={handleLogin} theme={theme} onToggleTheme={toggleTheme} />
  }

  if (user.must_change_password) {
    return (
      <ChangePassword
        user={user}
        onDone={handleLogin}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    )
  }

  const isManager = user.role === 'manager'
  const moduleName = (MODULES.find((m) => m.id === view) || {}).name

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand-home" onClick={() => setView(HOME)} aria-label="Về trang chủ MOBIUS">
          <Logo size={38} />
          <span className="brand">
            <span className="brand-title">{PLATFORM_NAME}</span>
            <span className="brand-sub">
              {user.full_name ? `${user.full_name} - ` : ''}
              {user.code}
              {isManager ? ' - Quản lý' : ''}
            </span>
          </span>
        </button>
        <div className="topbar-actions">
          {isManager && (
            <a className="btn btn-soft btn-sm" href="/admin">
              <Icon name="shield" size={18} />
              <span className="hide-xs">Trang admin</span>
            </a>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={toggleTheme}
            aria-label="Đổi giao diện sáng hoặc tối"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
            <Icon name="logout" size={18} />
            <span className="hide-xs">Thoát</span>
          </button>
        </div>
      </header>

      <main className={`content ${inLocate ? '' : 'no-tabbar'}`}>
        {!inLocate && <Home user={user} onOpen={setView} />}

        {inLocate && (
          <>
            {loadError && tab !== 'capture' && (
              <div className="alert alert-error" role="alert">
                {loadError}{' '}
                <button type="button" className="link" onClick={refresh}>
                  Thử lại
                </button>
              </div>
            )}
            <header className="page-head" key={tab}>
              <span className="eyebrow">
                {moduleName} · {PAGES[tab].eyebrow}
              </span>
              <h1 className="page-title">
                {typeof PAGES[tab].title === 'function' ? PAGES[tab].title(isManager) : PAGES[tab].title}
              </h1>
              <p className="page-sub">{PAGES[tab].sub}</p>
            </header>
            {tab === 'capture' && <Capture user={user} onSaved={refresh} />}
            {tab === 'history' && (
              <History outlets={outlets} loading={loading} isManager={isManager} onRefresh={refresh} />
            )}
            {tab === 'map' && (
              <MapReport outlets={outlets} loading={loading} isManager={isManager} onRefresh={refresh} />
            )}
          </>
        )}
      </main>

      {inLocate && (
        <nav className="tabbar" aria-label="Điều hướng chức năng Định vị điểm bán">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${tab === t.id ? 'tab-active' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              <span className="tab-icon">
                <Icon name={t.icon} />
                {t.id === 'history' && outlets.length > 0 && (
                  <span className="badge">{outlets.length > 99 ? '99+' : outlets.length}</span>
                )}
              </span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
