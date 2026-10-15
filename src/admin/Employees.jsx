import { useEffect, useMemo, useState } from 'react'
import { sb, callEmployeesFn } from './adminClient.js'
import { formatTime, CODE_PATTERN, COMPANY_DOMAINS, isCompanyEmail, normalizePhone, isPhone } from '../supabase.js'
import { fold } from './util.js'
import BulkImport from './BulkImport.jsx'
import { exportEmployees } from './employeeExcel.js'
import Icon from '../icons.jsx'

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

const ACCOUNT_STATES = {
  ok: 'Đã kích hoạt',
  pending: 'Chờ đổi mật khẩu',
  none: 'Chưa có tài khoản',
}

function formatDay(iso) {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

function accountState(emp) {
  if (!emp.user_id || !emp.email) return 'none'
  return emp.must_change_password ? 'pending' : 'ok'
}

function AccountDot({ emp }) {
  const st = accountState(emp)
  return <i className={`ad-dot ad-dot-${st}`} title={ACCOUNT_STATES[st]} aria-label={ACCOUNT_STATES[st]} />
}

function IconBtn({ icon, label, onClick, disabled, tone }) {
  return (
    <button
      type="button"
      className={`ad-iconbtn ${tone ? `is-${tone}` : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={16} />
    </button>
  )
}

/** Xem chi tiết một nhân viên (chỉ đọc). */
function EmployeeDetail({ emp, count, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const st = accountState(emp)
  const items = [
    ['Mã nhân viên', emp.code],
    ['Tên nhân viên', emp.full_name || '-'],
    ['Email', emp.email || '-'],
    ['Số điện thoại', emp.phone || '-'],
    ['Vai trò', emp.role === 'manager' ? 'Quản lý' : 'Nhân viên'],
    ['Trạng thái', emp.is_active ? 'Active' : 'Inactive'],
    ['Ngày Active', emp.active_at ? formatTime(emp.active_at) : '-'],
    ['Ngày Inactive', emp.inactive_at ? formatTime(emp.inactive_at) : '-'],
    ['Tài khoản', ACCOUNT_STATES[st]],
    ['Điểm bán đã ghi nhận', String(count)],
    ['Ngày tạo', emp.created_at ? formatTime(emp.created_at) : '-'],
  ]

  return (
    <div className="ad-modal" role="dialog" aria-modal="true" aria-label="Chi tiết nhân viên" onClick={onClose}>
      <div className="ad-modal-box card" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <div>
            <span className="eyebrow">Chi tiết nhân viên</span>
            <h2>{emp.full_name || emp.code}</h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Đóng
          </button>
        </div>
        <dl className="ad-secret">
          {items.map(([k, v]) => (
            <div className="ad-detail-row" key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function EmployeeRow({ emp, count, onSaved, onDeleted, onError, onSecret, onView }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(emp.full_name || '')
  const [email, setEmail] = useState(emp.email || '')
  const [phone, setPhone] = useState(emp.phone || '')
  const [role, setRole] = useState(emp.role)
  const [active, setActive] = useState(emp.is_active)

  const hasAccount = Boolean(emp.user_id)

  function startEdit() {
    setName(emp.full_name || '')
    setEmail(emp.email || '')
    setPhone(emp.phone || '')
    setRole(emp.role)
    setActive(emp.is_active)
    onError('')
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
    onError('')
  }

  function secretFor(res, title) {
    return {
      title,
      code: res.employee.code,
      name: res.employee.full_name || res.employee.code,
      email: res.employee.email,
      password: res.temp_password,
    }
  }

  async function save() {
    const mail = email.trim().toLowerCase()
    const ph = normalizePhone(phone)
    if (ph && !isPhone(ph)) {
      onError('Số điện thoại gồm 9 đến 12 chữ số.')
      return
    }
    if (mail && !isCompanyEmail(mail)) {
      onError(`Email phải thuộc tên miền công ty (${DOMAIN_HINT}).`)
      return
    }
    setBusy(true)
    onError('')
    try {
      // 1. Thông tin thường: họ tên, số điện thoại, vai trò, trạng thái
      const changes = {}
      const nm = name.trim() || null
      if (nm !== (emp.full_name || null)) changes.full_name = nm
      if ((ph || null) !== (emp.phone || null)) changes.phone = ph || null
      if (role !== emp.role) changes.role = role
      if (active !== emp.is_active) changes.is_active = active
      let latest = emp
      if (Object.keys(changes).length > 0) {
        const { data, error } = await sb.from('employees').update(changes).eq('code', emp.code).select().single()
        if (error) throw new Error('Không lưu được thay đổi. Vui lòng thử lại.')
        latest = data
        onSaved(data)
      }

      // 2. Email: đổi email của tài khoản hiện có, hoặc cấp tài khoản mới nếu chưa có
      if (mail && mail !== (emp.email || '')) {
        if (hasAccount) {
          const res = await callEmployeesFn({ action: 'change_email', code: emp.code, email: mail })
          if (res.employee) onSaved(res.employee)
        } else {
          const res = await callEmployeesFn({
            action: 'create',
            code: emp.code,
            email: mail,
            full_name: latest.full_name,
            phone: latest.phone,
            role: latest.role,
            is_active: latest.is_active,
          })
          if (res.employee) onSaved(res.employee)
          if (res.temp_password) onSecret(secretFor(res, 'Đã cấp tài khoản'))
        }
      }
      setEditing(false)
    } catch (err) {
      onError(err.message)
    }
    setBusy(false)
  }

  async function resetPassword() {
    if (!window.confirm(`Reset mật khẩu cho ${emp.email}? Mật khẩu cũ sẽ không dùng được nữa.`)) return
    setBusy(true)
    onError('')
    try {
      const res = await callEmployeesFn({ action: 'reset_password', code: emp.code })
      if (res.employee) onSaved(res.employee)
      if (res.temp_password) onSecret(secretFor(res, 'Đã reset mật khẩu'))
    } catch (err) {
      onError(err.message)
    }
    setBusy(false)
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

  const dash = <span className="muted">-</span>

  return (
    <tr className={`${emp.is_active ? '' : 'ad-inactive'} ${editing ? 'ad-editing' : ''}`}>
      <td>
        <strong>{emp.code}</strong>
      </td>

      <td>
        {editing ? (
          <input
            className="ad-input is-edit"
            value={name}
            maxLength={100}
            placeholder="Tên nhân viên"
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            aria-label={`Họ tên của ${emp.code}`}
          />
        ) : (
          <span className="ad-cell-text" title={emp.full_name || undefined}>
            {emp.full_name || dash}
          </span>
        )}
      </td>

      <td>
        {editing ? (
          <div className="ad-emailcell">
            <AccountDot emp={emp} />
            <input
              className="ad-input is-edit"
              type="email"
              value={email}
              placeholder={hasAccount ? 'Email công ty' : 'Nhập email để cấp tài khoản'}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              aria-label={`Email của ${emp.code}`}
            />
          </div>
        ) : (
          <div className="ad-emailcell">
            <AccountDot emp={emp} />
            {emp.email ? (
              <span className="ad-email-text" title={emp.email}>
                {emp.email}
              </span>
            ) : (
              <button type="button" className="link small" disabled={busy} onClick={startEdit}>
                + Cấp tài khoản
              </button>
            )}
          </div>
        )}
      </td>

      <td>
        {editing ? (
          <input
            className="ad-input is-edit"
            type="tel"
            inputMode="tel"
            maxLength={16}
            value={phone}
            placeholder="Số điện thoại"
            disabled={busy}
            onChange={(e) => setPhone(e.target.value)}
            aria-label={`Số điện thoại của ${emp.code}`}
          />
        ) : (
          <span className="ad-cell-text">{emp.phone || dash}</span>
        )}
      </td>

      <td>
        {editing ? (
          <select
            className="ad-input is-edit"
            value={role}
            disabled={busy}
            onChange={(e) => setRole(e.target.value)}
            aria-label={`Vai trò của ${emp.code}`}
          >
            <option value="staff">Nhân viên</option>
            <option value="manager">Quản lý</option>
          </select>
        ) : (
          <span className="ad-cell-text">{ROLE_LABEL[emp.role] || emp.role}</span>
        )}
      </td>

      <td>
        {editing ? (
          <select
            className="ad-input is-edit"
            value={active ? 'active' : 'inactive'}
            disabled={busy}
            onChange={(e) => setActive(e.target.value === 'active')}
            aria-label={`Trạng thái của ${emp.code}`}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        ) : (
          <span className="ad-cell-text">{emp.is_active ? 'Active' : 'Inactive'}</span>
        )}
      </td>

      <td className="ad-nowrap small muted" title={emp.active_at ? formatTime(emp.active_at) : undefined}>
        {emp.active_at ? formatDay(emp.active_at) : '-'}
      </td>
      <td className="ad-nowrap small muted" title={emp.inactive_at ? formatTime(emp.inactive_at) : undefined}>
        {emp.inactive_at ? formatDay(emp.inactive_at) : '-'}
      </td>

      <td>
        <div className="ad-iconbtns">
          {editing ? (
            <>
              <IconBtn icon="check" label="Lưu thay đổi" tone="ok" disabled={busy} onClick={save} />
              <IconBtn icon="x" label="Hủy" disabled={busy} onClick={cancel} />
            </>
          ) : (
            <>
              <IconBtn icon="eye" label="Xem chi tiết" disabled={busy} onClick={() => onView(emp.code)} />
              <IconBtn icon="edit" label="Sửa thông tin" disabled={busy} onClick={startEdit} />
              {hasAccount && (
                <IconBtn icon="key" label="Reset mật khẩu (tạo mật khẩu ngẫu nhiên)" disabled={busy} onClick={resetPassword} />
              )}
              <IconBtn icon="trash" label="Xóa nhân viên" tone="danger" disabled={busy} onClick={remove} />
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

const ROLE_LABEL = { staff: 'Nhân viên', manager: 'Quản lý' }

// Cấu hình các cột của bảng: kiểu dữ liệu quyết định cách sắp xếp (chữ A-Z, ngày cũ/mới, số tăng/giảm)
const COLUMNS = [
  { key: 'code', w: 86, label: 'Mã NV', type: 'text', get: (e) => e.code },
  { key: 'full_name', w: 140, label: 'Tên nhân viên', type: 'text', get: (e) => e.full_name || '' },
  { key: 'email', w: 176, label: 'Email', type: 'text', get: (e) => e.email || '' },
  { key: 'phone', w: 124, label: 'Số điện thoại', type: 'text', get: (e) => e.phone || '' },
  {
    key: 'role', w: 120,
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
    key: 'status', w: 120,
    label: 'Trạng thái',
    type: 'text',
    get: (e) => (e.is_active ? 'Active' : 'Inactive'),
    options: [
      ['active', 'Active'],
      ['inactive', 'Inactive'],
    ],
    match: (e, v) => (e.is_active ? 'active' : 'inactive') === v,
  },
  { key: 'active_at', w: 100, label: 'Ngày Active', type: 'date', get: (e) => e.active_at },
  { key: 'inactive_at', w: 100, label: 'Ngày Inactive', type: 'date', get: (e) => e.inactive_at },
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
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [adding, setAdding] = useState(false)
  const [filters, setFilters] = useState({})
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [secret, setSecret] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [exporting, setExporting] = useState(false)

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
        const text = c.type === 'date' ? (raw ? formatDay(raw) : '') : String(raw)
        return fold(text).includes(fold(f))
      }),
    )
    const col = COLUMNS.find((c) => c.key === sort.key)
    // Nhân viên Active luôn xếp trên Inactive; cột đang sắp xếp quyết định thứ tự trong từng nhóm
    const activeFirst = sort.key !== 'status'
    if (col || activeFirst) {
      const dir = sort.dir === 'asc' ? 1 : -1
      list = [...list].sort((a, b) => {
        if (activeFirst && a.is_active !== b.is_active) return a.is_active ? -1 : 1
        if (!col) return 0
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

  const activeFilters = Object.values(filters).filter((v) => (v || '').trim() !== '').length
  const hasFilter = activeFilters > 0 || sort.key !== null

  function toggleSort(key) {
    setSort((s) => {
      if (s.key !== key) return { key, dir: 'asc' }
      if (s.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: 'asc' }
    })
  }

  async function doExport() {
    setExporting(true)
    setError('')
    try {
      await exportEmployees(visible, counts)
    } catch {
      setError('Xuất danh sách thất bại. Vui lòng thử lại.')
    }
    setExporting(false)
  }

  function saved(emp) {
    if (employees.some((e) => e.code === emp.code)) onSaved(emp)
    else onAdded(emp)
  }

  const dirty = Boolean(code || fullName || email || phone || role || status)

  function clearForm() {
    setCode('')
    setFullName('')
    setEmail('')
    setPhone('')
    setRole('')
    setStatus('')
    setError('')
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
        role: role || 'staff',
        is_active: status ? status === 'active' : true,
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
      setRole('')
      setStatus('')
    } catch (err) {
      setError(err.message)
    }
    setAdding(false)
  }

  return (
    <div className="stack">
      <form className="card ad-addform" onSubmit={add} noValidate>
        <div className="ad-addform-fields">
          <label className="field field-sm ad-col-3">
            <span>Mã nhân viên</span>
            <input value={code} maxLength={20} onChange={(e) => setCode(e.target.value)} placeholder="Ví dụ: NV002" />
          </label>
          <label className="field field-sm ad-col-5">
            <span>Tên nhân viên</span>
            <input
              value={fullName}
              maxLength={100}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn An"
            />
          </label>
          <label className="field field-sm ad-col-4">
            <span>Email công ty</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`Ví dụ: ten@${COMPANY_DOMAINS[0]}`}
            />
          </label>
          <label className="field field-sm ad-col-4">
            <span>Số điện thoại</span>
            <input
              type="tel"
              inputMode="tel"
              maxLength={16}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ví dụ: 0901234567"
            />
          </label>
          <label className="field field-sm ad-col-4">
            <span>Vai trò</span>
            <select
              className={role ? '' : 'is-empty'}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="" disabled hidden>
                Mặc định: Nhân viên
              </option>
              <option value="staff">Nhân viên</option>
              <option value="manager">Quản lý</option>
            </select>
          </label>
          <label className="field field-sm ad-col-4">
            <span>Trạng thái</span>
            <select
              className={status ? '' : 'is-empty'}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="" disabled hidden>
                Mặc định: Active
              </option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        <div className="ad-addform-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={adding || !code.trim() || !email.trim()}>
            {adding ? 'Đang tạo...' : 'Tạo nhân viên'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!dirty || adding} onClick={clearForm}>
            Xóa nội dung
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

      <div className="ad-toolbar">
        <div className="row wrap-row">
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${showFilters ? 'is-on' : ''}`}
            aria-pressed={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            Lọc theo cột{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={exporting || visible.length === 0}
            onClick={doExport}
            title="Xuất file Excel danh sách nhân viên đang hiển thị (theo bộ lọc và sắp xếp hiện tại)"
          >
            {exporting ? 'Đang xuất...' : 'Xuất danh sách'}
          </button>
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
        <span className="ad-legend small muted">
          <i className="ad-dot ad-dot-ok" /> Đã kích hoạt
          <i className="ad-dot ad-dot-pending" /> Chờ đổi mật khẩu
          <i className="ad-dot ad-dot-none" /> Chưa có tài khoản
        </span>
      </div>

      <div className="card ad-tablewrap">
        <table className={`ad-table ad-table-fixed ${showFilters ? 'is-filtering' : ''}`}>
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
                  {showFilters && c.options && (
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
                  )}
                  {showFilters && !c.options && (
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
              <th style={{ width: '150px' }}>Thao tác</th>
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
                onView={setViewing}
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
      {viewing && employees.find((e) => e.code === viewing) && (
        <EmployeeDetail
          emp={employees.find((e) => e.code === viewing)}
          count={counts.get(viewing) || 0}
          onClose={() => setViewing(null)}
        />
      )}
      {importing && <BulkImport employees={employees} onCreated={saved} onClose={() => setImporting(false)} />}
    </div>
  )
}
