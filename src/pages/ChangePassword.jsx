import { useState } from 'react'
import { supabase } from '../supabase.js'
import Logo from '../Logo.jsx'
import ThemeToggle from '../ThemeToggle.jsx'

const MIN_LENGTH = 8

function validate(password, confirm) {
  if (password.length < MIN_LENGTH) return `Mật khẩu cần ít nhất ${MIN_LENGTH} ký tự.`
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Mật khẩu cần có cả chữ và số.'
  if (password !== confirm) return 'Mật khẩu nhập lại chưa khớp.'
  return ''
}

/** Màn hình bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên (hoặc sau khi admin đặt lại). */
export default function ChangePassword({ user, onDone, onLogout, theme, onToggleTheme }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const problem = validate(password, confirm)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError('')

    const { error: updErr } = await supabase.auth.updateUser({ password })
    if (updErr) {
      setBusy(false)
      setError(
        /different from the old password|same_password/i.test(updErr.message || updErr.code || '')
          ? 'Mật khẩu mới phải khác mật khẩu tạm thời.'
          : 'Không đổi được mật khẩu. Vui lòng thử lại.',
      )
      return
    }

    const { error: doneErr } = await supabase.rpc('app_complete_password_change')
    setBusy(false)
    if (doneErr) {
      setError('Đã đổi mật khẩu nhưng chưa xác nhận được. Vui lòng đăng nhập lại.')
      return
    }
    onDone({ ...user, must_change_password: false })
  }

  return (
    <div className="login-wrap">
      <ThemeToggle theme={theme} onToggle={onToggleTheme} className="login-theme" />
      <aside className="login-aside">
        <div className="login-brand-lockup">
          <Logo size="auto" className="login-logo" />
          <div className="login-brand-copy">
            <span className="eyebrow">Lần đăng nhập đầu tiên</span>
            <h1 className="login-display login-display-sm">
              Đặt mật khẩu
              <br />
              của bạn
            </h1>
            <span className="login-brand-rule" aria-hidden="true" />
            <p className="login-lead">
              Mật khẩu tạm thời chỉ dùng một lần. Hãy đặt mật khẩu riêng để tiếp tục.
            </p>
          </div>
        </div>
      </aside>
      <form className="card login-card" onSubmit={submit} noValidate>
        <h2 className="login-title">Đổi mật khẩu</h2>
        <p className="muted small">Tài khoản: {user.email}</p>

        <label className="field">
          <span>Mật khẩu mới</span>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Ví dụ: ít nhất 8 ký tự, gồm chữ và số"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </label>
        <label className="field">
          <span>Nhập lại mật khẩu mới</span>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu vừa đặt"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !password || !confirm}>
          {busy ? 'Đang lưu...' : 'Lưu mật khẩu'}
        </button>
        <p className="center-text small">
          <button type="button" className="link" onClick={onLogout}>
            Đăng xuất
          </button>
        </p>
      </form>
    </div>
  )
}
