import { useCallback, useEffect, useState } from 'react'
import { supabase, safeGet, safeSet } from './supabase.js'
import Login from './pages/Login.jsx'
import Capture from './pages/Capture.jsx'
import History from './pages/History.jsx'
import MapReport from './pages/MapReport.jsx'

const TABS = [
  { id: 'capture', label: 'Chụp điểm bán' },
  { id: 'history', label: 'Lịch sử' },
  { id: 'map', label: 'Bản đồ' },
]

function readUser() {
  try {
    const raw = safeGet('user')
    if (!raw) return null
    const u = JSON.parse(raw)
    return u && typeof u.code === 'string' ? u : null
  } catch {
    return null
  }
}

export default function App() {
  const [user, setUser] = useState(readUser)
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

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase.rpc('app_list_outlets', { p_code: user.code })
    if (error) {
      setLoadError('Không tải được dữ liệu. Vui lòng kiểm tra mạng và thử lại.')
    } else {
      setOutlets(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  function handleLogin(u) {
    safeSet('user', JSON.stringify(u))
    setUser(u)
    setTab('capture')
  }

  function handleLogout() {
    safeSet('user', null)
    setUser(null)
    setOutlets([])
  }

  if (!user) {
    return (
      <Login
        onLogin={handleLogin}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />
    )
  }

  const isManager = user.role === 'manager'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-title">Thu thập điểm bán</span>
          <span className="brand-sub">
            {user.full_name ? `${user.full_name} - ` : ''}
            {user.code}
            {isManager ? ' - Quản lý' : ''}
          </span>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Đổi giao diện sáng hoặc tối"
          >
            {theme === 'dark' ? 'Sáng' : 'Tối'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Thoát
          </button>
        </div>
      </header>

      <main className="content">
        {loadError && tab !== 'capture' && (
          <div className="alert alert-error" role="alert">
            {loadError}{' '}
            <button type="button" className="link" onClick={refresh}>
              Thử lại
            </button>
          </div>
        )}
        {tab === 'capture' && <Capture user={user} onSaved={refresh} />}
        {tab === 'history' && (
          <History outlets={outlets} loading={loading} isManager={isManager} onRefresh={refresh} />
        )}
        {tab === 'map' && (
          <MapReport outlets={outlets} loading={loading} isManager={isManager} onRefresh={refresh} />
        )}
      </main>

      <nav className="tabbar" aria-label="Điều hướng chính">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'tab-active' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'history' && outlets.length > 0 && (
              <span className="badge">{outlets.length}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
