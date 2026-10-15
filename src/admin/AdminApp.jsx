import { useCallback, useEffect, useMemo, useState } from 'react'
import { sb, fetchAllOutlets, fetchEmployees } from './adminClient.js'
import { safeGet, safeSet } from '../supabase.js'
import AdminLogin from './AdminLogin.jsx'
import Overview from './Overview.jsx'
import OutletTable from './OutletTable.jsx'
import AdminMap from './AdminMap.jsx'
import Employees from './Employees.jsx'
import FilterBar from './FilterBar.jsx'
import { exportExcel } from './exportExcel.js'
import { applyFilters, EMPTY_FILTERS } from './util.js'
import Icon from '../icons.jsx'
import './admin.css'

const TABS = [
  { id: 'overview', label: 'Tổng quan', icon: 'chart' },
  { id: 'list', label: 'Danh sách', icon: 'list' },
  { id: 'map', label: 'Bản đồ', icon: 'map' },
  { id: 'employees', label: 'Nhân viên', icon: 'users' },
]

export default function AdminApp() {
  const [phase, setPhase] = useState('loading') // loading | out | in
  const [email, setEmail] = useState('')
  const [authError, setAuthError] = useState('')
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light',
  )

  const [tab, setTab] = useState('overview')
  const [outlets, setOutlets] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState('')
  const [isFs, setIsFs] = useState(false)
  const [collapsed, setCollapsed] = useState(() => safeGet('ad-collapsed') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    document.title = 'Quản trị - Thu thập điểm bán'
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    safeSet('theme', theme)
  }, [theme])

  const verify = useCallback(async (session) => {
    if (!session) {
      setPhase('out')
      return
    }
    const { data, error } = await sb.rpc('is_admin')
    if (error || data !== true) {
      await sb.auth.signOut()
      setAuthError('Tài khoản này không có quyền admin.')
      setPhase('out')
      return
    }
    setEmail(session.user.email || '')
    setPhase('in')
  }, [])

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => verify(data.session))
    const { data: sub } = sb.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_OUT') setPhase('out')
    })
    return () => sub.subscription.unsubscribe()
  }, [verify])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [o, e] = await Promise.all([fetchAllOutlets(), fetchEmployees()])
      setOutlets(o)
      setEmployees(e)
    } catch {
      setLoadError('Không tải được dữ liệu. Vui lòng kiểm tra mạng và thử lại.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (phase === 'in') load()
  }, [phase, load])

  useEffect(() => {
    const f = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])

  async function login(emailIn, password) {
    setAuthError('')
    const { data, error } = await sb.auth.signInWithPassword({ email: emailIn, password })
    if (error) {
      setAuthError('Email hoặc mật khẩu không đúng.')
      return
    }
    await verify(data.session)
  }

  async function logout() {
    await sb.auth.signOut()
    setOutlets([])
    setEmployees([])
    setPhase('out')
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      /* bỏ qua khi trình duyệt không cho phép */
    }
  }

  const empMap = useMemo(() => new Map(employees.map((e) => [e.code, e])), [employees])
  const rows = useMemo(
    () => outlets.map((o) => ({ ...o, employee_name: empMap.get(o.employee_code)?.full_name || '' })),
    [outlets, empMap],
  )
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters])

  async function doExport() {
    setExporting(true)
    setNotice('')
    try {
      const name = await exportExcel(filtered)
      setNotice(`Đã xuất ${filtered.length} điểm bán ra file ${name}`)
    } catch {
      setNotice('Xuất Excel thất bại. Vui lòng thử lại.')
    }
    setExporting(false)
  }

  const themeToggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  if (phase === 'loading') return <div className="boot">Đang tải...</div>
  if (phase === 'out') {
    return <AdminLogin onSubmit={login} error={authError} theme={theme} onToggleTheme={themeToggle} />
  }

  const showFilters = tab === 'list' || tab === 'map'
  const current = TABS.find((t) => t.id === tab)
  const initial = (email || '?').trim().charAt(0).toUpperCase()

  function toggleSidebar() {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setMobileOpen((o) => !o)
    } else {
      setCollapsed((c) => {
        safeSet('ad-collapsed', c ? '0' : '1')
        return !c
      })
    }
  }

  function go(id) {
    setTab(id)
    setMobileOpen(false)
  }

  return (
    <div className={`ad-shell ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-open' : ''}`}>
      <aside className="ad-sidebar" aria-label="Menu quản trị">
        <div className="ad-account">
          <span className="ad-avatar" aria-hidden="true">
            {initial}
          </span>
          <div className="ad-account-info">
            <strong>Quản trị viên</strong>
            <span className="small muted" title={email}>
              {email}
            </span>
          </div>
        </div>

        <nav className="ad-nav" aria-label="Điều hướng admin">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`ad-navbtn ${tab === t.id ? 'is-active' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              title={t.label}
              onClick={() => go(t.id)}
            >
              <Icon name={t.icon} size={20} />
              <span className="ad-label">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="ad-sidebar-foot">
          <button type="button" className="ad-navbtn" onClick={load} disabled={loading} title="Tải lại dữ liệu">
            <Icon name="refresh" size={20} />
            <span className="ad-label">{loading ? 'Đang tải...' : 'Tải lại'}</span>
          </button>
          {typeof document.documentElement.requestFullscreen === 'function' && (
            <button type="button" className="ad-navbtn" onClick={toggleFullscreen} title="Toàn màn hình">
              <Icon name="expand" size={20} />
              <span className="ad-label">{isFs ? 'Thoát toàn màn hình' : 'Toàn màn hình'}</span>
            </button>
          )}
          <button type="button" className="ad-navbtn" onClick={themeToggle} title="Đổi giao diện sáng hoặc tối">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
            <span className="ad-label">{theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}</span>
          </button>
          <button type="button" className="ad-navbtn" onClick={logout} title="Đăng xuất">
            <Icon name="logout" size={20} />
            <span className="ad-label">Đăng xuất</span>
          </button>
        </div>
      </aside>
      <div className="ad-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />

      <div className="ad-content">
        <header className="ad-bar">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={toggleSidebar}
            aria-label="Ẩn hoặc hiện menu"
            aria-expanded={!collapsed}
          >
            <Icon name="panel" size={20} />
          </button>
          <div className="ad-bar-title">
            <span className="eyebrow">Quản trị điểm bán</span>
            <h1 className="ad-pagetitle">{current ? current.label : ''}</h1>
          </div>
        </header>

        <main className="ad-main">
          {loadError && (
            <div className="alert alert-error" role="alert">
              {loadError}
            </div>
          )}
          {notice && (
            <div className="alert ad-notice" role="status">
              {notice}
            </div>
          )}

          {showFilters && (
            <FilterBar
              filters={filters}
              onChange={setFilters}
              employees={employees}
              rows={rows}
              shown={filtered.length}
              onExport={doExport}
              exporting={exporting}
            />
          )}

          {tab === 'overview' && <Overview rows={rows} employees={employees} />}
          {tab === 'list' && <OutletTable rows={filtered} />}
          {tab === 'map' && <AdminMap rows={filtered} />}
          {tab === 'employees' && (
            <Employees
              employees={employees}
              rows={rows}
              onSaved={(emp) => setEmployees((list) => list.map((e) => (e.code === emp.code ? emp : e)))}
              onAdded={(emp) => setEmployees((list) => [...list, emp].sort((a, b) => (a.code < b.code ? -1 : 1)))}
              onDeleted={(code) => setEmployees((list) => list.filter((e) => e.code !== code))}
            />
          )}
        </main>
      </div>
    </div>
  )
}
