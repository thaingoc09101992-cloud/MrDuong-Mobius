import { useState } from 'react'

export default function AdminLogin({ onSubmit, error, theme, onToggleTheme }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setBusy(true)
    await onSubmit(email.trim(), password)
    setBusy(false)
  }

  return (
    <div className="login-wrap">
      <button type="button" className="btn btn-ghost btn-sm login-theme" onClick={onToggleTheme}>
        {theme === 'dark' ? 'Sáng' : 'Tối'}
      </button>
      <aside className="login-aside">
        <span className="eyebrow">Quản trị</span>
        <h1 className="login-display">
          Quản trị
          <br />
          điểm bán
        </h1>
        <p className="login-lead">Theo dõi dữ liệu, nhân viên và bản đồ điểm bán.</p>
      </aside>
      <form className="card login-card" onSubmit={submit} noValidate>
        <h2 className="login-title">Đăng nhập</h2>
        <p className="muted small">Dùng tài khoản email của quản trị viên.</p>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </label>
        <label className="field">
          <span>Mật khẩu</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !email.trim() || !password}>
          {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  )
}
