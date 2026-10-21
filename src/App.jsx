import { useCallback, useEffect, useState } from 'react'
import { supabase, safeSet } from './supabase.js'
import { MODULES, PLATFORM_NAME, ALL_MODULE_IDS, modulesOf } from './modules.js'
import Login from './pages/Login.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import { HomePage, ToolsPage, KnowledgePage, ComingSoonPage, ProfilePage } from './pages/sections.jsx'
import Capture from './pages/Capture.jsx'
import History from './pages/History.jsx'
import MapReport from './pages/MapReport.jsx'
import TradeMap from './pages/TradeMap.jsx'
import LessonsPage from './pages/LessonsPage.jsx'
import Icon from './icons.jsx'
import Loading from './Loading.jsx'
import AppShell from './AppShell.jsx'
import { loadProfile } from './profile.js'

// Menu chính của thanh bên
const NAV = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'tools', label: 'Công cụ', icon: 'grid' },
  { id: 'videos', label: 'Video đào tạo', icon: 'play' },
  { id: 'knowledge', label: 'Kiến thức', icon: 'book' },
  { id: 'profile', label: 'Thông tin nhân viên', icon: 'user' },
]

// Các màn hình bên trong công cụ "Định vị điểm bán"
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
    title: (scope) => (scope === 'all' ? 'Tất cả điểm bán' : scope === 'team' ? 'Điểm bán của đội' : 'Điểm bán của tôi'),
    sub: 'Danh sách các điểm bán đã ghi nhận, mới nhất ở trên cùng.',
  },
  map: {
    eyebrow: '03 / Bản đồ',
    title: 'Bản đồ điểm bán',
    sub: 'Xem vị trí các điểm bán và lọc theo loại hình, thời gian.',
  },
}

// Vị trí đang xem được giữ trên địa chỉ (#/mục/công cụ hoặc mục con/màn hình) để F5 hay nút Back vẫn đứng đúng trang
function readHash() {
  const [sec, sub, scr] = window.location.hash.replace(/^#\/?/, '').split('/')
  const section = NAV.some((n) => n.id === sec) ? sec : 'home'
  return {
    section,
    tool: section === 'tools' && MODULES.some((m) => m.id === sub) ? sub : null,
    knowledge: section === 'knowledge' && sub === 'lessons' ? 'lessons' : null,
    tab: TABS.some((t) => t.id === scr) ? scr : 'capture',
  }
}

function buildHash(section, tool, knowledge, tab) {
  if (tool) return `#/tools/${tool}${tool === 'dinh-vi-diem-ban' ? `/${tab}` : ''}`
  if (knowledge) return `#/knowledge/${knowledge}`
  return `#/${section}`
}

function normalizeUser(data) {
  return { ...data, modules: data.isAdmin ? ALL_MODULE_IDS : modulesOf(data) }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)
  const [section, setSection] = useState(() => readHash().section)
  const [tool, setTool] = useState(() => readHash().tool) // null hoặc mã công cụ đang mở
  const [knowledge, setKnowledge] = useState(() => readHash().knowledge) // null hoặc mục đang mở trong Kiến thức
  const [tab, setTab] = useState(() => readHash().tab)
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

  // Khôi phục phiên đăng nhập: chỉ giữ lại nếu tài khoản vẫn được phép dùng MOBIUS
  useEffect(() => {
    let alive = true
    safeSet('user', null) // dọn dữ liệu đăng nhập bằng mã của phiên bản cũ

    async function restore() {
      const { data: s } = await supabase.auth.getSession()
      if (!s.session) return
      const profile = await loadProfile()
      if (!alive) return
      if (!profile) {
        await supabase.auth.signOut()
        return
      }
      setUser(normalizeUser(profile))
    }
    restore().finally(() => alive && setBooting(false))

    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_OUT') {
        setUser(null)
        setOutlets([])
        setSection('home')
        setTool(null)
      }
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Đồng bộ vị trí đang xem với địa chỉ trang, và theo dõi nút Back/Forward
  useEffect(() => {
    if (!user || user.must_change_password) return
    // Công cụ không được cấp quyền hoặc màn hình Chụp ảnh khi chưa có hồ sơ nhân viên: quay về mức hợp lệ
    if (tool && !user.modules.includes(tool)) {
      setTool(null)
      return
    }
    if (tool === 'dinh-vi-diem-ban' && tab === 'capture' && !user.hasEmployee) {
      setTab('history')
      return
    }
    const next = buildHash(section, tool, knowledge, tab)
    if (window.location.hash !== next) window.location.hash = next
  }, [user, section, tool, knowledge, tab])

  useEffect(() => {
    function onHash() {
      const h = readHash()
      setSection(h.section)
      setTool(h.tool)
      setKnowledge(h.knowledge)
      setTab(h.tab)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const ready = Boolean(user) && !user.must_change_password
  const inLocate = tool === 'dinh-vi-diem-ban'

  const refresh = useCallback(async () => {
    if (!ready || !(user.hasEmployee || user.isAdmin) || !user.modules.includes('dinh-vi-diem-ban')) return
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
    setSection('home')
    setTool(null)
    setTab('capture')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setOutlets([])
    setSection('home')
    setTool(null)
    setKnowledge(null)
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  function navigate(id) {
    setSection(id)
    setTool(null)
    setKnowledge(null)
  }

  // Công cụ nằm trong mục Công cụ; chưa có hồ sơ nhân viên thì không chụp ảnh được nên vào thẳng Lịch sử
  function openTool(id) {
    setTab(user && user.hasEmployee ? 'capture' : 'history')
    setSection('tools')
    setTool(id)
  }

  if (booting) return <Loading full />

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
  // Phạm vi xem dữ liệu: admin xem tất cả, quản lý xem đội, nhân viên xem của mình
  const scope = user.isAdmin ? 'all' : isManager ? 'team' : 'mine'
  const seesOthers = scope !== 'mine'
  // Chụp ảnh cần hồ sơ nhân viên (điểm bán phải gắn với một nhân viên)
  const tabs = TABS.filter((t) => t.id !== 'capture' || user.hasEmployee)
  const toolName = (MODULES.find((m) => m.id === tool) || {}).name
  const sectionName = (NAV.find((n) => n.id === section) || {}).label

  const bottomBar = inLocate ? (
    <nav
      className="tabbar"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      aria-label="Điều hướng công cụ Định vị điểm bán"
    >
      {tabs.map((t) => (
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
  ) : null

  return (
    <AppShell
      user={user}
      nav={NAV}
      active={section}
      onNavigate={navigate}
      theme={theme}
      onToggleTheme={toggleTheme}
      onLogout={handleLogout}
      eyebrow={tool ? `${PLATFORM_NAME} · Công cụ` : PLATFORM_NAME}
      title={tool ? toolName : section === 'knowledge' && knowledge === 'lessons' ? 'Bài học' : sectionName}
      hasTabbar={inLocate}
      wide={tool === 'bo-tran-diem-ban' || (inLocate && tab === 'map')}
      bottomBar={bottomBar}
    >
      {!tool && section === 'home' && <HomePage user={user} onOpenTool={openTool} />}
      {!tool && section === 'tools' && <ToolsPage user={user} onOpenTool={openTool} />}
      {!tool && section === 'videos' && (
        <ComingSoonPage
          eyebrow="Đào tạo"
          heading="Video đào tạo"
          icon="play"
          text="Các video hướng dẫn và đào tạo nghiệp vụ sẽ được cập nhật tại đây."
        />
      )}
      {!tool && section === 'knowledge' && knowledge === 'lessons' && (
        <LessonsPage onBack={() => setKnowledge(null)} />
      )}
      {!tool && section === 'knowledge' && !knowledge && <KnowledgePage onOpenItem={setKnowledge} />}
      {!tool && section === 'profile' && <ProfilePage user={user} />}

      {inLocate && (
        <>
          <div className="tabs tool-tabs" role="tablist" aria-label="Màn hình của công cụ">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`tab-item ${tab === t.id ? 'is-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <Icon name={t.icon} size={18} />
                {t.label}
              </button>
            ))}
          </div>
          {loadError && tab !== 'capture' && (
            <div className="alert alert-error" role="alert">
              {loadError}{' '}
              <button type="button" className="link" onClick={refresh}>
                Thử lại
              </button>
            </div>
          )}
          <header className="page-head" key={tab}>
            <span className="eyebrow">{PAGES[tab].eyebrow}</span>
            <h2 className="page-title">
              {typeof PAGES[tab].title === 'function' ? PAGES[tab].title(scope) : PAGES[tab].title}
            </h2>
            <p className="page-sub">{PAGES[tab].sub}</p>
          </header>
          {tab === 'capture' && user.hasEmployee && <Capture user={user} onSaved={refresh} />}
          {tab === 'history' && (
            <History outlets={outlets} loading={loading} isManager={seesOthers} onRefresh={refresh} />
          )}
          {tab === 'map' && (
            <MapReport outlets={outlets} loading={loading} isManager={seesOthers} onRefresh={refresh} />
          )}
        </>
      )}
      {tool === 'bo-tran-diem-ban' && <TradeMap user={user} />}
    </AppShell>
  )
}
