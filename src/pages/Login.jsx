import { useState } from 'react'
import { supabase } from '../supabase.js'
import Logo from '../Logo.jsx'

export default function Login({ onLogin, theme, onToggleTheme }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const mail = email.trim().toLowerCase()
    if (!mail || !password) return
    setBusy(true)
    setError('')

    const { error: authErr } = await supabase.auth.signInWithPassword({ email: mail, password })
    if (authErr) {
      setBusy(false)
      setError('Email hoặc mật khẩu không đúng.')
      return
    }

    // Chỉ nhân viên đang Active và có email mới được dùng ứng dụng
    const { data, error: meErr } = await supabase.rpc('app_me')
    if (meErr || !data) {
      await supabase.auth.signOut()
      setBusy(false)
      setError('Tài khoản chưa được cấp quyền hoặc đã ngừng hoạt động. Vui lòng liên hệ quản lý.')
      return
    }
    setBusy(false)
    onLogin(data)
  }

  return (
    <div className="login-wrap">
      <button
        type="button"
        className="btn btn-ghost btn-sm login-theme"
        onClick={onToggleTheme}
        aria-label="Đổi giao diện sáng hoặc tối"
      >
        {theme === 'dark' ? 'Sáng' : 'Tối'}
      </button>
      <aside className="login-aside">
        <Logo size={60} className="login-logo" />
        <span className="eyebrow">Nền tảng nội bộ</span>
        <h1 className="login-display">MOBIUS</h1>
        <p className="login-lead">Nơi tập hợp các chức năng làm việc dành cho nhân viên, từ định vị điểm bán và nhiều hơn nữa.</p>
      </aside>
      <form className="card login-card" onSubmit={submit} noValidate>
        <h2 className="login-title">Đăng nhập</h2>
        <p className="muted small">Dùng email công ty và mật khẩu được cấp.</p>

        <label className="field">
          <span>Email công ty</span>
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect="off"
            spellCheck="false"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ví dụ: ten@thophat.vn"
            autoFocus
          />
        </label>
        <label className="field">
          <span>Mật khẩu</span>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={busy || !email.trim() || !password}
        >
          {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
        <p className="center-text small">
          <a className="link" href="/admin">
            Đăng nhập quản trị
          </a>
        </p>
      </form>
    </div>
  )
}
