import { useState } from 'react'
import { supabase } from '../supabase.js'
import { loadProfile } from '../profile.js'
import Logo from '../Logo.jsx'
import ThemeToggle from '../ThemeToggle.jsx'

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

    // Chỉ nhân viên đang Active có email hoặc tài khoản admin mới được vào
    const profile = await loadProfile()
    if (!profile) {
      await supabase.auth.signOut()
      setBusy(false)
      setError('Tài khoản chưa được cấp quyền hoặc đã ngừng hoạt động. Vui lòng liên hệ quản lý.')
      return
    }
    setBusy(false)
    onLogin(profile)
  }

  return (
    <div className="login-wrap">
      <ThemeToggle theme={theme} onToggle={onToggleTheme} className="login-theme" />
      <aside className="login-aside">
        <div className="login-brand-lockup">
          <Logo size="auto" className="login-logo" />
          <div className="login-brand-copy">
            <span className="eyebrow">Nền tảng nội bộ</span>
            <h1 className="login-display">MOBIUS</h1>
            <span className="login-brand-rule" aria-hidden="true" />
            <p className="login-lead login-lead-2">
              Mọi công cụ. Một không gian.
            </p>
          </div>
        </div>
      </aside>
      <form className="card login-card" onSubmit={submit} noValidate>
        <h2 className="login-title">Đăng nhập</h2>

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
          className="btn btn-gold btn-block btn-lg"
          disabled={busy || !email.trim() || !password}
        >
          {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  )
}
