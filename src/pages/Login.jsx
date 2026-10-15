import { useState } from 'react'
import { supabase, CODE_PATTERN } from '../supabase.js'

export default function Login({ onLogin, theme, onToggleTheme }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const normalized = code.trim().toUpperCase()
    if (!CODE_PATTERN.test(normalized)) {
      setError('Mã nhân viên gồm 3 đến 20 ký tự: chữ không dấu, số, gạch ngang hoặc gạch dưới.')
      return
    }
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase.rpc('app_login', { p_code: normalized })
    setBusy(false)
    if (err) {
      setError(
        err.message && err.message.includes('khoa')
          ? 'Tài khoản đã bị khóa. Vui lòng liên hệ quản lý.'
          : 'Không đăng nhập được. Vui lòng kiểm tra mã nhân viên và kết nối mạng.',
      )
      return
    }
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
      <form className="card login-card" onSubmit={submit} noValidate>
        <img src="/icon.svg" alt="" width="56" height="56" className="login-logo" />
        <h1>Thu thập điểm bán</h1>
        <p className="muted">Đăng nhập bằng mã nhân viên để bắt đầu.</p>

        <label className="field">
          <span>Mã nhân viên</span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="username"
            autoCorrect="off"
            spellCheck="false"
            maxLength={20}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ví dụ: NV001"
            autoFocus
          />
        </label>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !code.trim()}>
          {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
        <p className="center-text small">
          <a className="link" href="/admin">
            Đăng nhập quản trị (email)
          </a>
        </p>
      </form>
    </div>
  )
}
