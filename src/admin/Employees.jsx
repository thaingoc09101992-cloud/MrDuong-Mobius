import { useEffect, useMemo, useState } from 'react'
import { sb, callEmployeesFn } from './adminClient.js'
import { formatTime, CODE_PATTERN, COMPANY_DOMAINS, isCompanyEmail, normalizePhone, isPhone } from '../supabase.js'
import { fold } from './util.js'
import BulkImport from './BulkImport.jsx'

const DOMAIN_HINT = COMPANY_DOMAINS.map((d) => `@${d}`).join(' hoặc ')

function SecretModal({ secret, onClose }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Email: ${secret.email}\nMật khẩu tạm: ${secret.password}`)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="ad-modal" role="dialog" aria-modal="true" aria-label="Mật khẩu tạm thời">
      <div className="ad-modal-box card">
        <span className="eyebrow">{secret.title}</span>
        <h2>Mật khẩu tạm thời</h2>
        <p className="muted small">
          Gửi thông tin này cho nhân viên. Mật khẩu chỉ hiển thị <strong>một lần</strong> và nhân viên phải đổi
          ngay ở lần đăng nhập đầu tiên.
        </p>
        <dl className="ad-secret">
          <dt>Nhân viên</dt>
          <dd>
            {secret.name} ({secret.code})
          </dd>
          <dt>Email đăng nhập</dt>
          <dd>{secret.email}</dd>
          <dt>Mật khẩu tạm</dt>
          <dd className="ad-secret-pass">{secret.password}</dd>
        </dl>
        <div className="row">
          <button type="button" className="btn btn-ghost grow" onClick={copy}>
            {copied ? 'Đã sao chép' : 'Sao chép'}
          </button>
          <button type="button" className="btn btn-primary grow" onClick={onClose}>
            Đã lưu lại
          </button>
        </div>
      </div>
    </div>
  )
}

function AccountState({ emp }) {
  if (!emp.user_id || !emp.email) return <span className="chip chip-warn">Chưa có tài khoản</span>
  if (emp.must_change_password) return <span className="chip chip-warn">Chờ đổi mật khẩu</span>
  return <span className="chip">Đã kích hoạt</span>
}

function EmployeeRow({ emp, count, onSaved, onDeleted, onError, onSecret }) {
  const [name, setName] = useState(emp.full_name || '')
  const [email, setEmail] = useState(emp.email || '')
  const [phone, setPhone] = useState(emp.phone || '')
  const [editingEmail, setEditingEmail] = useState(false)
  const [busy, setBusy] = useState(false)

  const hasAccount = Boolean(emp.user_id)

  useEffect(() => {
    setName(emp.full_name || '')
    setEmail(emp.email || '')
    setPhone(emp.phone || '')
  }, [emp.full_name, emp.email, emp.phone])

  async function patch(changes) {
    setBusy(true)
    onError('')
    const { data, error } = await sb.from('employees').update(changes).eq('code', emp.code).select().single()
    setBusy(false)
    if (error) {
      onError('Không lưu được thay đổi. Vui lòng thử lại.')
      setName(emp.full_name || '')
      return
    }
    onSaved(data)
  }

  async function run(body, title) {
    setBusy(true)
    onError('')
    try {
      const res = await callEmployeesFn(body)
      if (res.employee) onSaved(res.employee)
      if (res.temp_password) {
        onSecret({
          title,
          code: res.employee.code,
          name: res.employee.full_name || res.employee.code,
          email: res.employee.email,
          password: res.temp_password,
        })
      }
      setEditingEmail(false)
    } catch (err) {
      onError(err.message)
    }
    setBusy(false)
  }

  function submitEmail() {
    const mail = email.trim().toLowerCase()
    if (!isCompanyEmail(mail)) {
      onError(`Email phải thuộc tên miền công ty (${DOMAIN_HINT}).`)
      return
    }
    if (hasAccount) {
      if (mail === emp.email) {
        setEditingEmail(false)
        return
      }
      run({ action: 'change_email', code: emp.code, email: mail }, 'Đã đổi email')
    } else {
      run(
        { action: 'create', code: emp.code, email: mail, full_name: name.trim() || null, role: emp.role },
        'Đã cấp tài khoản',
      )
    }
  }

  function resetPassword() {
    if (!window.confirm(`Đặt lại mật khẩu cho ${emp.email}? Mật khẩu cũ sẽ không dùng được nữa.`)) return
    run({ action: 'reset_password', code: emp.code }, 'Đã đặt lại mật khẩu')
  }

  function savePhone() {
    const v = normalizePhone(phone)
    if (v === (emp.phone || '')) {
      setPhone(emp.phone || '')
      return
    }
    if (v && !isPhone(v)) {
      onError('Số điện thoại gồm 9 đến 12 chữ số.')
      setPhone(emp.phone || '')
      return
    }
    patch({ phone: v || null })
  }

  async function remove() {
    if (count > 0) {
      onError(`Nhân viên ${emp.code} đã có ${count} điểm bán nên không thể xóa. Hãy chuyển sang Inactive để giữ dữ liệu.`)
      return
    }
    const label = emp.full_name ? `${emp.full_name} (${emp.code})` : emp.code
    const extra = emp.email ? `\nTài khoản đăng nhập ${emp.email} cũng sẽ bị xóa.` : ''
    if (!window.confirm(`Xóa vĩnh viễn nhân viên ${label}?${extra}\nThao tác này không thể hoàn tác.`)) return
    setBusy(true)
    onError('')
    try {
      await callEmployeesFn({ action: 'delete', code: emp.code })
      onDeleted(emp.code)
    } catch (err) {
      onError(err.message)
      setBusy(false)
    }
  }

  return (
    <tr className={emp.is_active ? '' : 'ad-inactive'}>
      <td>
        <strong>{emp.code}</strong>
      </td>
      <td>
        <input
          className="ad-input"
          value={name}
          maxLength={100}
          placeholder="Nhập họ tên"
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const v = name.trim()
            if (v !== (emp.full_name || '')) patch({ full_name: v || null })
          }}
          aria-label={`Họ tên của ${emp.code}`}
        />
      </td>
      <td>
        {hasAccount && !editingEmail ? (
          <div className="ad-emailcell">
            <span className="ad-wrap">{emp.email}</span>
            <button type="button" className="link small" disabled={busy} onClick={() => setEditingEmail(true)}>
              Đổi
            </button>
          </div>
        ) : (
          <div className="ad-emailcell">
            <input
              className="ad-input"
              type="email"
              value={email}
              placeholder={`ten${COMPANY_DOMAINS[0] ? `@${COMPANY_DOMAINS[0]}` : ''}`}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitEmail()}
              aria-label={`Email của ${emp.code}`}
            />
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !email.trim()} onClick={submitEmail}>
              {hasAccount ? 'Lưu' : 'Cấp TK'}
            </button>
            {hasAccount && (
              <button
                type="button"
                className="link small"
                onClick={() => {
                  setEditingEmail(false)
                  setEmail(emp.email || '')
                }}
              >
                Hủy
              </button>
            )}
          </div>
        )}
        <AccountState emp={emp} />
      </td>
      <td>
        <input
          className="ad-input"
          type="tel"
          inputMode="tel"
          maxLength={16}
          value={phone}
          placeholder="Số điện thoại"
          disabled={busy}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={savePhone}
          aria-label={`Số điện thoại của ${emp.code}`}
        />
      </td>
      <td>
        <select
          className="ad-input"
          value={emp.role}
          disabled={busy}
          onChange={(e) => patch({ role: e.target.value })}
          aria-label={`Vai trò của ${emp.code}`}
        >
          <option value="staff">Nhân viên</option>
          <option value="manager">Quản lý</option>
        </select>
      </td>
      <td>
        <select
          className="ad-input"
          value={emp.is_active ? 'active' : 'inactive'}
          disabled={busy}
          onChange={(e) => patch({ is_active: e.target.value === 'active' })}
          aria-label={`Trạng thái của ${emp.code}`}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </td>
      <td className="ad-nowrap small muted">{emp.active_at ? formatTime(emp.active_at) : '-'}</td>
      <td className="ad-nowrap small muted">{emp.inactive_at ? formatTime(emp.inactive_at) : '-'}</td>
      <td className="center">{count}</td>
      <td>
        <div className="ad-actions">
          {hasAccount && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={resetPassword}>
              Reset mật khẩu
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm ad-danger" disabled={busy} onClick={remove}>
            Xóa
          </button>
        </div>
      </td>
    </tr>
  )
}

const ROLE_LABEL = { staff: 'Nhân viên', manager: 'Quản lý' }

// Cấu hình các cột của bảng: kiểu dữ liệu quyết định cách sắp xếp (chữ A-Z, ngày cũ/mới, số tăng/giảm)
const COLUMNS = [
  { key: 'code', w: 76, label: 'Mã NV', type: 'text', get: (e) => e.code },
  { key: 'full_name', w: 150, label: 'Tên nhân viên', type: 'text', get: (e) => e.full_name || '' },
  { key: 'email', w: 220, label: 'Email', type: 'text', get: (e) => e.email || '' },
  { key: 'phone', w: 120, label: 'Số điện thoại', type: 'text', get: (e) => e.phone || '' },
  {
    key: 'role', w: 116,
    label: 'Vai trò',
    type: 'text',
    get: (e) => ROLE_LABEL[e.role] || e.role,
    options: [
      ['staff', 'Nhân viên'],
      ['manager', 'Quản lý'],
    ],
    match: (e, v) => e.role === v,
  },
  {
    key: 'status', w: 116,
    label: 'Trạng thái',
    type: 'text',
    get: (e) => (e.is_active ? 'Active' : 'Inactive'),
    options: [
      ['active', 'Active'],
      ['inactive', 'Inactive'],
    ],
    match: (e, v) => (e.is_active ? 'active' : 'inactive') === v,
  },
  { key: 'active_at', w: 112, label: 'Ngày Active', type: 'date', get: (e) => e.active_at },
  { key: 'inactive_at', w: 112, label: 'Ngày Inactive', type: 'date', get: (e) => e.inactive_at },
  { key: 'count', w: 64, label: 'Số điểm', type: 'number', get: (e, counts) => counts.get(e.code) || 0 },
]

const SORT_HINT = {
  text: 'Sắp xếp A → Z / Z → A',
  date: 'Sắp xếp cũ → mới / mới → cũ',
  number: 'Sắp xếp tăng dần / giảm dần',
}

function sortValue(col, emp, counts) {
  const raw = col.get(emp, counts)
  if (col.type === 'date') return raw ? Date.parse(raw) : null
  if (col.type === 'number') return raw
  return raw ? String(raw) : null
}

export default function Employees({ employees, rows, onSaved, onAdded, onDeleted }) {
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [importing, setImporting] = useState(false)
  const [role, setRole] = useState('staff')
  const [status, setStatus] = useState('active')
  const [adding, setAdding] = useState(false)
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [secret, setSecret] = useState(null)

  const counts = useMemo(() => {
    const m = new Map()
    rows.forEach((r) => m.set(r.employee_code, (m.get(r.employee_code) || 0) + 1))
    return m
  }, [rows])

  const visible = useMemo(() => {
    let list = employees.filter((e) =>
      COLUMNS.every((c) => {
        const f = (filters[c.key] || '').trim()
        if (!f) return true
        if (c.match) return c.match(e, f)
        const raw = c.get(e, counts)
        const text = c.type === 'date' ? (raw ? formatTime(raw) : '') : String(raw)
        return fold(text).includes(fold(f))
      }),
    )
    const col = COLUMNS.find((c) => c.key === sort.key)
    if (col) {
      const dir = sort.dir === 'asc' ? 1 : -1
      list = [...list].sort((a, b) => {
        const va = sortValue(col, a, counts)
        const vb = sortValue(col, b, counts)
        if (va === null && vb === null) return 0
        if (va === null) return 1 // ô trống luôn nằm cuối
        if (vb === null) return -1
        return (typeof va === 'number' ? va - vb : va.localeCompare(vb, 'vi')) * dir
      })
    }
    return list
  }, [employees, filters, sort, counts])

  const hasFilter = Object.values(filters).some((v) => (v || '').trim() !== '') || sort.key !== null

  function toggleSort(key) {
    setSort((s) => {
      if (s.key !== key) return { key, dir: 'asc' }
      if (s.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: 'asc' }
    })
  }

  function saved(emp) {
    if (employees.some((e) => e.code === emp.code)) onSaved(emp)
    else onAdded(emp)
  }

  async function add(e) {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    const mail = email.trim().toLowerCase()
    if (!CODE_PATTERN.test(c)) {
      setError('Mã nhân viên gồm 3 đến 20 ký tự: chữ không dấu, số, gạch ngang hoặc gạch dưới.')
      return
    }
    if (!isCompanyEmail(mail)) {
      setError(`Email phải thuộc tên miền công ty (${DOMAIN_HINT}).`)
      return
    }
    const ph = normalizePhone(phone)
    if (ph && !isPhone(ph)) {
      setError('Số điện thoại gồm 9 đến 12 chữ số.')
      return
    }
    setAdding(true)
    setError('')
    try {
      const res = await callEmployeesFn({
        action: 'create',
        code: c,
        email: mail,
        phone: ph || null,
        full_name: fullName.trim() || null,
        role,
        is_active: status === 'active',
      })
      saved(res.employee)
      setSecret({
        title: 'Đã tạo nhân viên',
        code: res.employee.code,
        name: res.employee.full_name || res.employee.code,
        email: res.employee.email,
        password: res.temp_password,
      })
      setCode('')
      setFullName('')
      setEmail('')
      setPhone('')
      setRole('staff')
      setStatus('active')
    } catch (err) {
      setError(err.message)
    }
    setAdding(false)
  }

  return (
    <div className="stack">
      <form className="card ad-addform" onSubmit={add} noValidate>
        <label className="field field-sm ad-col-2">
          <span>Mã nhân viên</span>
          <input value={code} maxLength={20} onChange={(e) => setCode(e.target.value)} placeholder="Ví dụ: NV002" />
        </label>
        <label className="field field-sm ad-col-3">
          <span>Tên nhân viên</span>
          <input value={fullName} maxLength={100} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="field field-sm ad-col-4">
          <span>Email công ty</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`ten@${COMPANY_DOMAINS[0]}`}
          />
        </label>
        <label className="field field-sm ad-col-3">
          <span>Số điện thoại</span>
          <input
            type="tel"
            inputMode="tel"
            maxLength={16}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0901234567"
          />
        </label>
        <label className="field field-sm ad-col-3">
          <span>Vai trò</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="staff">Nhân viên</option>
            <option value="manager">Quản lý</option>
          </select>
        </label>
        <label className="field field-sm ad-col-3">
          <span>Trạng thái</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <div className="ad-addform-actions ad-col-6">
          <button type="submit" className="btn btn-primary btn-sm" disabled={adding || !code.trim() || !email.trim()}>
            {adding ? 'Đang tạo...' : 'Tạo nhân viên'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImporting(true)}>
            Import từ Excel
          </button>
        </div>
      </form>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="row between wrap-row">
        <span className="small muted">
          {visible.length} / {employees.length} nhân viên. Chỉ nhân viên Active có email mới đăng nhập được.
        </span>
        {hasFilter && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setFilters({})
              setSort({ key: null, dir: 'asc' })
            }}
          >
            Xóa lọc và sắp xếp
          </button>
        )}
      </div>

      <div className="card ad-tablewrap">
        <table className="ad-table ad-table-fixed">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  style={{ width: `${c.w}px` }}
                  aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button type="button" className="ad-sort" onClick={() => toggleSort(c.key)} title={SORT_HINT[c.type]}>
                    <span>{c.label}</span>
                    <span className="ad-sort-ico" aria-hidden="true">
                      {sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                  {c.options ? (
                    <select
                      className="ad-colfilter"
                      value={filters[c.key] || ''}
                      onChange={(e) => setFilters((f) => ({ ...f, [c.key]: e.target.value }))}
                      aria-label={`Lọc theo ${c.label}`}
                    >
                      <option value="">Tất cả</option>
                      {c.options.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="ad-colfilter"
                      type="search"
                      value={filters[c.key] || ''}
                      placeholder="Lọc..."
                      onChange={(e) => setFilters((f) => ({ ...f, [c.key]: e.target.value }))}
                      aria-label={`Lọc theo ${c.label}`}
                    />
                  )}
                </th>
              ))}
              <th style={{ width: '160px' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((emp) => (
              <EmployeeRow
                key={emp.code}
                emp={emp}
                count={counts.get(emp.code) || 0}
                onSaved={saved}
                onDeleted={onDeleted}
                onError={setError}
                onSecret={setSecret}
              />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="center muted">
                  {employees.length === 0 ? 'Chưa có nhân viên nào.' : 'Không có nhân viên nào khớp bộ lọc.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {secret && <SecretModal secret={secret} onClose={() => setSecret(null)} />}
      {importing && <BulkImport employees={employees} onCreated={saved} onClose={() => setImporting(false)} />}
    </div>
  )
}
