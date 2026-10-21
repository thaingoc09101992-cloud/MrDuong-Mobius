import { useEffect, useMemo, useState } from 'react'
import { sb, callEmployeesFn } from './adminClient.js'
import { formatTime, CODE_PATTERN, COMPANY_DOMAINS, isCompanyEmail, normalizePhone, isPhone } from '../supabase.js'
import { fold } from './util.js'
import BulkImport from './BulkImport.jsx'
import { exportEmployees } from './employeeExcel.js'
import Icon from '../icons.jsx'
import { confirmDialog } from '../ConfirmDialog.jsx'
import { SortLabel, SORT_HINT, compareValues } from './tableKit.jsx'
import { MODULES, ALL_MODULE_IDS, modulesOf, moduleNames } from '../modules.js'

const DOMAIN_HINT = COMPANY_DOMAINS.map((d) => `@${d}`).join(' hoặc ')
const ROLE_LABEL = { staff: 'Nhân viên', manager: 'Quản lý' }

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

function personLabel(emp, code) {
  if (!code) return ''
  return emp && emp.full_name ? emp.full_name : code
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

/** Chọn quản lý trực tiếp: chỉ những nhân viên có vai trò Quản lý. */
function ManagerSelect({ value, onChange, employees, selfCode, disabled }) {
  const options = employees.filter((e) => e.role === 'manager' && e.code !== selfCode && (e.is_active || e.code === value))
  return (
    <select
      className={value ? '' : 'is-empty'}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Không có quản lý trực tiếp</option>
      {options.map((m) => (
        <option key={m.code} value={m.code}>
          {m.full_name ? `${m.full_name} (${m.code})` : m.code}
        </option>
      ))}
    </select>
  )
}

/** Quyền sử dụng từng chức năng của MOBIUS. */
function ModulePicker({ value, onChange, disabled }) {
  function toggle(id) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }
  return (
    <div className="ad-modules" role="group" aria-label="Chức năng được dùng">
      {MODULES.map((m) => (
        <label className="ad-check" key={m.id}>
          <input type="checkbox" checked={value.includes(m.id)} disabled={disabled} onChange={() => toggle(m.id)} />
          <span>{m.name}</span>
        </label>
      ))}
    </div>
  )
}

/** Xem chi tiết một nhân viên (chỉ đọc). */
function EmployeeDetail({ emp, count, managerName, onClose }) {
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
    ['Vai trò', ROLE_LABEL[emp.role] || emp.role],
    ['Quản lý trực tiếp', managerName || '-'],
    ['Chức năng được dùng', moduleNames(emp.modules)],
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

/** Sửa thông tin và phân quyền của một nhân viên. */
function EmployeeEditDialog({ emp, employees, onSaved, onSecret, onClose }) {
  const [name, setName] = useState(emp.full_name || '')
  const [email, setEmail] = useState(emp.email || '')
  const [phone, setPhone] = useState(emp.phone || '')
  const [role, setRole] = useState(emp.role)
  const [active, setActive] = useState(emp.is_active)
  const [manager, setManager] = useState(emp.manager_code || '')
  const [modules, setModules] = useState(modulesOf(emp))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const hasAccount = Boolean(emp.user_id)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function save(e) {
    e.preventDefault()
    const mail = email.trim().toLowerCase()
    const ph = normalizePhone(phone)
    if (ph && !isPhone(ph)) {
      setError('Số điện thoại gồm 9 đến 12 chữ số.')
      return
    }
    if (mail && !isCompanyEmail(mail)) {
      setError(`Email phải thuộc tên miền công ty (${DOMAIN_HINT}).`)
      return
    }
    setBusy(true)
    setError('')
    try {
      // 1. Thông tin thường và phân quyền
      const changes = {}
      const nm = name.trim() || null
      if (nm !== (emp.full_name || null)) changes.full_name = nm
      if ((ph || null) !== (emp.phone || null)) changes.phone = ph || null
      if (role !== emp.role) changes.role = role
      if (active !== emp.is_active) changes.is_active = active
      if ((manager || null) !== (emp.manager_code || null)) changes.manager_code = manager || null
      const before = [...modulesOf(emp)].sort().join(',')
      if ([...modules].sort().join(',') !== before) changes.modules = modules
      let latest = emp
      if (Object.keys(changes).length > 0) {
        const { data, error: err } = await sb.from('employees').update(changes).eq('code', emp.code).select().single()
        if (err) throw new Error(err.code === 'P0001' ? err.message : 'Không lưu được thay đổi. Vui lòng thử lại.')
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
            manager_code: latest.manager_code,
            modules: modulesOf(latest),
          })
          if (res.employee) onSaved(res.employee)
          if (res.temp_password) {
            onSecret({
              title: 'Đã cấp tài khoản',
              code: res.employee.code,
              name: res.employee.full_name || res.employee.code,
              email: res.employee.email,
              password: res.temp_password,
            })
          }
        }
      }
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="ad-modal" role="dialog" aria-modal="true" aria-label="Sửa nhân viên">
      <form className="ad-modal-box ad-modal-form card" onSubmit={save} noValidate>
        <div className="row between">
          <div>
            <span className="eyebrow">Sửa nhân viên</span>
            <h2>{emp.full_name || emp.code}</h2>
          </div>
          <span className="small muted">Mã: {emp.code}</span>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <div className="ad-addform-fields">
          <label className="field field-sm">
            <span>Tên nhân viên</span>
            <input
              value={name}
              maxLength={100}
              disabled={busy}
              placeholder="Ví dụ: Nguyễn Văn An"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field field-sm">
            <span>Email công ty</span>
            <input
              type="email"
              value={email}
              disabled={busy}
              placeholder={hasAccount ? `Ví dụ: ten@${COMPANY_DOMAINS[0]}` : 'Nhập email để cấp tài khoản'}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field field-sm">
            <span>Số điện thoại</span>
            <input
              type="tel"
              inputMode="tel"
              maxLength={16}
              value={phone}
              disabled={busy}
              placeholder="Ví dụ: 0901234567"
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="field field-sm">
            <span>Vai trò</span>
            <select value={role} disabled={busy} onChange={(e) => setRole(e.target.value)}>
              <option value="staff">Nhân viên</option>
              <option value="manager">Quản lý</option>
            </select>
          </label>
          <label className="field field-sm">
            <span>Trạng thái</span>
            <select value={active ? 'active' : 'inactive'} disabled={busy} onChange={(e) => setActive(e.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="field field-sm">
            <span>Quản lý trực tiếp</span>
            <ManagerSelect value={manager} onChange={setManager} employees={employees} selfCode={emp.code} disabled={busy} />
          </label>
          <div className="field field-sm ad-span-all">
            <span>Chức năng được dùng</span>
            <ModulePicker value={modules} onChange={setModules} disabled={busy} />
          </div>
        </div>

        <div className="row ad-dialog-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
  )
}

function EmployeeRow({ emp, count, managerName, onSaved, onDeleted, onError, onSecret, onView, onEdit }) {
  const [busy, setBusy] = useState(false)
  const hasAccount = Boolean(emp.user_id)

  async function resetPassword() {
    const ok = await confirmDialog({
      title: `Reset mật khẩu cho ${emp.email}?`,
      message: 'Mật khẩu cũ sẽ không dùng được nữa.',
      confirmLabel: 'Reset mật khẩu',
    })
    if (!ok) return
    setBusy(true)
    onError('')
    try {
      const res = await callEmployeesFn({ action: 'reset_password', code: emp.code })
      if (res.employee) onSaved(res.employee)
      if (res.temp_password) {
        onSecret({
          title: 'Đã reset mật khẩu',
          code: res.employee.code,
          name: res.employee.full_name || res.employee.code,
          email: res.employee.email,
          password: res.temp_password,
        })
      }
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
    const extra = emp.email ? `Tài khoản đăng nhập ${emp.email} cũng sẽ bị xóa.\n` : ''
    const ok = await confirmDialog({
      title: `Xóa vĩnh viễn nhân viên ${label}?`,
      message: `${extra}Thao tác này không thể hoàn tác.`,
      confirmLabel: 'Xóa',
      danger: true,
    })
    if (!ok) return
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
    <tr className={emp.is_active ? '' : 'ad-inactive'}>
      <td>
        <strong>{emp.code}</strong>
      </td>
      <td>
        <span className="ad-cell-text" title={emp.full_name || undefined}>
          {emp.full_name || dash}
        </span>
      </td>
      <td>
        <div className="ad-emailcell">
          <AccountDot emp={emp} />
          {emp.email ? (
            <span className="ad-email-text" title={emp.email}>
              {emp.email}
            </span>
          ) : (
            <button type="button" className="link small" onClick={() => onEdit(emp.code)}>
              + Cấp tài khoản
            </button>
          )}
        </div>
      </td>
      <td>
        <span className="ad-cell-text">{emp.phone || dash}</span>
      </td>
      <td>
        <span className="ad-cell-text">{ROLE_LABEL[emp.role] || emp.role}</span>
      </td>
      <td>
        <span className="ad-cell-text" title={emp.manager_code || undefined}>
          {managerName || dash}
        </span>
      </td>
      <td>
        <span className="ad-cell-text">{emp.is_active ? 'Active' : 'Inactive'}</span>
      </td>
      <td className="ad-nowrap small muted" title={emp.active_at ? formatTime(emp.active_at) : undefined}>
        {emp.active_at ? formatDay(emp.active_at) : '-'}
      </td>
      <td className="ad-nowrap small muted" title={emp.inactive_at ? formatTime(emp.inactive_at) : undefined}>
        {emp.inactive_at ? formatDay(emp.inactive_at) : '-'}
      </td>
      <td>
        <div className="ad-iconbtns">
          <IconBtn icon="eye" label="Xem chi tiết" disabled={busy} onClick={() => onView(emp.code)} />
          <IconBtn icon="edit" label="Sửa thông tin và phân quyền" disabled={busy} onClick={() => onEdit(emp.code)} />
          {hasAccount && (
            <IconBtn icon="key" label="Reset mật khẩu (tạo mật khẩu ngẫu nhiên)" disabled={busy} onClick={resetPassword} />
          )}
          <IconBtn icon="trash" label="Xóa nhân viên" tone="danger" disabled={busy} onClick={remove} />
        </div>
      </td>
    </tr>
  )
}

// Cấu hình các cột của bảng: kiểu dữ liệu quyết định cách sắp xếp (chữ A-Z, ngày cũ/mới, số tăng/giảm)
const COLUMNS = [
  { key: 'code', w: 76, label: 'Mã NV', type: 'text', get: (e) => e.code },
  { key: 'full_name', w: 124, label: 'Tên nhân viên', type: 'text', get: (e) => e.full_name || '' },
  { key: 'email', w: 152, label: 'Email', type: 'text', get: (e) => e.email || '' },
  { key: 'phone', w: 110, label: 'Số điện thoại', type: 'text', get: (e) => e.phone || '' },
  {
    key: 'role',
    w: 92,
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
    key: 'manager',
    w: 120,
    label: 'Quản lý trực tiếp',
    type: 'text',
    get: (e, ctx) => personLabel(ctx.byCode.get(e.manager_code), e.manager_code),
  },
  {
    key: 'status',
    w: 92,
    label: 'Trạng thái',
    type: 'text',
    get: (e) => (e.is_active ? 'Active' : 'Inactive'),
    options: [
      ['active', 'Active'],
      ['inactive', 'Inactive'],
    ],
    match: (e, v) => (e.is_active ? 'active' : 'inactive') === v,
  },
  { key: 'active_at', w: 94, label: 'Ngày Active', type: 'date', get: (e) => e.active_at },
  { key: 'inactive_at', w: 94, label: 'Ngày Inactive', type: 'date', get: (e) => e.inactive_at },
]

function sortValue(col, emp, ctx) {
  const raw = col.get(emp, ctx)
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
  const [managerCode, setManagerCode] = useState('')
  const [modules, setModules] = useState(ALL_MODULE_IDS)
  const [adding, setAdding] = useState(false)
  const [filters, setFilters] = useState({})
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [secret, setSecret] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [exporting, setExporting] = useState(false)

  const counts = useMemo(() => {
    const m = new Map()
    rows.forEach((r) => m.set(r.employee_code, (m.get(r.employee_code) || 0) + 1))
    return m
  }, [rows])

  const byCode = useMemo(() => new Map(employees.map((e) => [e.code, e])), [employees])
  const ctx = useMemo(() => ({ counts, byCode }), [counts, byCode])

  const visible = useMemo(() => {
    let list = employees.filter((e) =>
      COLUMNS.every((c) => {
        const f = (filters[c.key] || '').trim()
        if (!f) return true
        if (c.match) return c.match(e, f)
        const raw = c.get(e, ctx)
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
        return compareValues(sortValue(col, a, ctx), sortValue(col, b, ctx), dir)
      })
    }
    return list
  }, [employees, filters, sort, ctx])

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
      await exportEmployees(visible, counts, employees)
    } catch {
      setError('Xuất danh sách thất bại. Vui lòng thử lại.')
    }
    setExporting(false)
  }

  function saved(emp) {
    if (employees.some((e) => e.code === emp.code)) onSaved(emp)
    else onAdded(emp)
  }

  const dirty = Boolean(
    code || fullName || email || phone || role || status || managerCode || modules.length !== ALL_MODULE_IDS.length,
  )

  function clearForm() {
    setCode('')
    setFullName('')
    setEmail('')
    setPhone('')
    setRole('')
    setStatus('')
    setManagerCode('')
    setModules(ALL_MODULE_IDS)
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
        manager_code: managerCode || null,
        modules,
      })
      saved(res.employee)
      setSecret({
        title: 'Đã tạo nhân viên',
        code: res.employee.code,
        name: res.employee.full_name || res.employee.code,
        email: res.employee.email,
        password: res.temp_password,
      })
      clearForm()
    } catch (err) {
      setError(err.message)
    }
    setAdding(false)
  }

  const editingEmp = editing ? byCode.get(editing) : null
  const viewingEmp = viewing ? byCode.get(viewing) : null

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
            <select className={role ? '' : 'is-empty'} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="" disabled hidden>
                Mặc định: Nhân viên
              </option>
              <option value="staff">Nhân viên</option>
              <option value="manager">Quản lý</option>
            </select>
          </label>
          <label className="field field-sm ad-col-4">
            <span>Trạng thái</span>
            <select className={status ? '' : 'is-empty'} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="" disabled hidden>
                Mặc định: Active
              </option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="field field-sm ad-col-4">
            <span>Quản lý trực tiếp</span>
            <ManagerSelect value={managerCode} onChange={setManagerCode} employees={employees} selfCode="" />
          </label>
          <div className="field field-sm ad-span-2">
            <span>Chức năng được dùng</span>
            <ModulePicker value={modules} onChange={setModules} />
          </div>
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
                    <SortLabel label={c.label} state={sort.key === c.key ? sort.dir : null} />
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
              <th style={{ width: '140px' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((emp) => (
              <EmployeeRow
                key={emp.code}
                emp={emp}
                count={counts.get(emp.code) || 0}
                managerName={personLabel(byCode.get(emp.manager_code), emp.manager_code)}
                onSaved={saved}
                onDeleted={onDeleted}
                onError={setError}
                onSecret={setSecret}
                onView={setViewing}
                onEdit={setEditing}
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
      {viewingEmp && (
        <EmployeeDetail
          emp={viewingEmp}
          count={counts.get(viewingEmp.code) || 0}
          managerName={personLabel(byCode.get(viewingEmp.manager_code), viewingEmp.manager_code)}
          onClose={() => setViewing(null)}
        />
      )}
      {editingEmp && (
        <EmployeeEditDialog
          key={editingEmp.code}
          emp={editingEmp}
          employees={employees}
          onSaved={saved}
          onSecret={setSecret}
          onClose={() => setEditing(null)}
        />
      )}
      {importing && <BulkImport employees={employees} onCreated={saved} onClose={() => setImporting(false)} />}
    </div>
  )
}
