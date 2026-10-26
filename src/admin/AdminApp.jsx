import { useCallback, useEffect, useMemo, useState } from 'react'
import { sb, fetchAllOutlets, fetchEmployees } from './adminClient.js'
import { safeGet, safeSet } from '../supabase.js'
import Overview from './Overview.jsx'
import OutletTable from './OutletTable.jsx'
import AdminMap from './AdminMap.jsx'
import { nextRotation, saveRotation } from '../photoRotate.js'
import Employees from './Employees.jsx'
import Banners from './Banners.jsx'
import Lessons from './Lessons.jsx'
import FilterBar from './FilterBar.jsx'
import { exportExcel } from './exportExcel.js'
import { applyFilters, EMPTY_FILTERS } from './util.js'
import Icon from '../icons.jsx'
import Logo from '../Logo.jsx'
import Loading from '../Loading.jsx'
import useReveal from '../useReveal.js'
import useNarrowRail from '../useNarrowRail.js'
import '../shell.css'
import './admin.css'

// Menu quản trị: mỗi mục ở thanh bên là một trang. Trang có `sections` là trang gom: bên trong có thanh tab cho từng
// chức năng con (thêm chức năng mới = thêm một dòng vào sections, không cần đổi menu).
const PAGES = [
  { id: 'users', label: 'Người dùng', title: 'Người dùng và phân quyền', icon: 'users' },
  {
    id: 'appearance',
    label: 'Giao diện',
    icon: 'image',
    sections: [{ id: 'banners', label: 'Banner trang chủ', icon: 'image' }],
  },
  {
    id: 'reports',
    label: 'Báo cáo',
    icon: 'chart',
    sections: [{ id: 'overview', label: 'Tổng quan', icon: 'chart' }],
  },
  {
    id: 'tools',
    label: 'Công cụ',
    icon: 'grid',
    sections: [
      { id: 'list', label: 'Danh sách', icon: 'list', context: 'Định vị điểm bán' },
      { id: 'map', label: 'Bản đồ', icon: 'map', context: 'Định vị điểm bán' },
      { id: 'lessons', label: 'Bài học', icon: 'book' },
    ],
  },
]
const DEFAULT_ROUTE = { page: 'reports', section: 'overview' }

// Địa chỉ dạng #/trang/mục (trang đơn chỉ có #/trang). Địa chỉ cũ (#/map, #/employees...) vẫn dùng được.
const LEGACY_HASH = {
  employees: 'users',
  banners: 'appearance/banners',
  overview: 'reports/overview',
  list: 'tools/list',
  map: 'tools/map',
  lessons: 'tools/lessons',
}
function routeOf(hash) {
  let path = hash.replace(/^#\/?/, '')
  path = LEGACY_HASH[path] || path
  const [pageId, sectionId] = path.split('/')
  const page = PAGES.find((p) => p.id === pageId)
  if (!page) return DEFAULT_ROUTE
  if (!page.sections) return { page: page.id, section: null }
  const section = page.sections.find((s) => s.id === sectionId) || page.sections[0]
  return { page: page.id, section: section.id }
}
const hashOf = (r) => `#/${r.page}${r.section ? `/${r.section}` : ''}`

export default function AdminApp() {
  useReveal()
  const [phase, setPhase] = useState('loading') // loading | out (chưa đăng nhập) | denied (không phải admin) | in
  const [email, setEmail] = useState('')
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light',
  )

  const [route, setRoute] = useState(() => routeOf(window.location.hash))
  const { page: pageId, section: tab } = route // tab: mã mục con đang xem (null ở trang đơn)
  const [outlets, setOutlets] = useState([])
  const [employees, setEmployees] = useState([])
  const [loadError, setLoadError] = useState('')
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState('')
  const [isFs, setIsFs] = useState(false)
  const [collapsed, setCollapsed] = useState(() => safeGet('ad-collapsed') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const narrow = useNarrowRail() // 901-1099px: thanh bên tự thu gọn thành cột biểu tượng

  useEffect(() => {
    document.title = 'Quản trị - MOBIUS'
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
      setPhase('denied')
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
    setLoadError('')
    try {
      const [o, e] = await Promise.all([fetchAllOutlets(), fetchEmployees()])
      setOutlets(o)
      setEmployees(e)
    } catch {
      setLoadError('Không tải được dữ liệu. Vui lòng kiểm tra mạng và thử lại.')
    }
  }, [])

  useEffect(() => {
    if (phase === 'in') load()
  }, [phase, load])

  useEffect(() => {
    const f = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])

  // (Các hook phải đứng trước mọi lệnh return sớm bên dưới, nếu không React báo "Rendered more hooks" và trang trắng.)
  // Giữ trang đang xem trên địa chỉ để F5 hay nút Back vẫn đứng đúng mục
  useEffect(() => {
    if (window.location.hash !== hashOf(route)) window.location.hash = hashOf(route)
  }, [route])
  useEffect(() => {
    function onHash() {
      setRoute(routeOf(window.location.hash))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  async function logout() {
    await sb.auth.signOut()
    window.location.assign('/')
  }

  // Chưa đăng nhập: chuyển về trang đăng nhập duy nhất của MOBIUS
  useEffect(() => {
    if (phase === 'out') window.location.replace('/')
  }, [phase])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      /* bỏ qua khi trình duyệt không cho phép */
    }
  }

  // Xoay ảnh điểm bán: cập nhật ngay trên màn hình, lưu lên máy chủ, lỗi thì trả lại góc cũ
  async function rotateOutlet(o) {
    const rotation = nextRotation(o.photo_rotation)
    const setRot = (r) => setOutlets((prev) => prev.map((x) => (x.id === o.id ? { ...x, photo_rotation: r } : x)))
    setRot(rotation)
    if (await saveRotation(o.id, rotation)) {
      setRot(o.photo_rotation || 0)
      setLoadError('Không xoay được ảnh. Vui lòng thử lại.')
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

  if (phase === 'loading') return <Loading full />
  if (phase === 'out') return <div className="boot">Đang chuyển về trang đăng nhập...</div>
  if (phase === 'denied') {
    return (
      <div className="boot">
        <div className="stack center">
          <h2>Không có quyền quản trị</h2>
          <p className="muted">Tài khoản này chưa được cấp quyền vào trang quản trị MOBIUS.</p>
          <a className="btn btn-primary" href="/">
            Về trang chủ MOBIUS
          </a>
        </div>
      </div>
    )
  }

  const showFilters = tab === 'list' || tab === 'map'
  const page = PAGES.find((p) => p.id === pageId)
  const section = page.sections ? page.sections.find((s) => s.id === tab) : null
  const pageTitle = section ? section.label : page.title || page.label
  const eyebrow = ['Quản trị MOBIUS', page.label, section && section.context].filter(Boolean).join(' · ')
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


  // Mở một trang từ thanh bên: trang gom mở mục con đầu tiên
  function go(id) {
    const p = PAGES.find((x) => x.id === id)
    setRoute({ page: id, section: p.sections ? p.sections[0].id : null })
    setMobileOpen(false)
  }

  return (
    <div className={`ad-shell ${collapsed || narrow ? 'is-collapsed' : ''} ${mobileOpen ? 'is-open' : ''}`}>
      <aside className="ad-sidebar" aria-label="Menu quản trị">
        <div className="ad-brandbar">
          <Logo size={46} />
          <span className="ad-brandname">MOBIUS</span>
        </div>

        <nav className="ad-nav" aria-label="Điều hướng admin">
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`ad-navbtn ${pageId === p.id ? 'is-active' : ''}`}
              aria-current={pageId === p.id ? 'page' : undefined}
              title={p.label}
              onClick={() => go(p.id)}
            >
              <Icon name={p.icon} size={20} />
              <span className="ad-label">{p.label}</span>
            </button>
          ))}
        </nav>

        <div className="ad-sidebar-foot">
          <a className="ad-navbtn" href="/" title="Về trang chủ MOBIUS">
            <Icon name="home" size={20} />
            <span className="ad-label">Trang chủ MOBIUS</span>
          </a>
          {typeof document.documentElement.requestFullscreen === 'function' && (
            <button type="button" className="ad-navbtn" onClick={toggleFullscreen} title="Toàn màn hình">
              <Icon name="expand" size={20} />
              <span className="ad-label">{isFs ? 'Thoát toàn màn hình' : 'Toàn màn hình'}</span>
            </button>
          )}
          <button type="button" className="ad-navbtn" onClick={themeToggle} title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
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
            <span className="eyebrow">{eyebrow}</span>
            <h1 className="ad-pagetitle">{pageTitle}</h1>
          </div>
          <div className="ad-bar-account">
            <div className="ad-account-info">
              <strong>Quản trị viên</strong>
              <span className="small muted" title={email}>
                {email}
              </span>
            </div>
            <span className="ad-avatar" aria-hidden="true">
              {initial}
            </span>
          </div>
        </header>

        <main className={`ad-main ${tab === 'map' ? 'is-wide' : ''}`}>
          {page.sections && (
            <div className="tabs" role="tablist" aria-label={page.label}>
              {page.sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === s.id}
                  className={`tab-item ${tab === s.id ? 'is-active' : ''}`}
                  onClick={() => setRoute({ page: pageId, section: s.id })}
                >
                  <Icon name={s.icon} size={18} />
                  {s.label}
                </button>
              ))}
            </div>
          )}
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

          {tab === 'banners' && <Banners />}
          {tab === 'lessons' && <Lessons />}
          {tab === 'overview' && <Overview rows={rows} employees={employees} />}
          {tab === 'list' && <OutletTable rows={filtered} onRotate={rotateOutlet} />}
          {tab === 'map' && <AdminMap rows={filtered} />}
          {pageId === 'users' && (
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
