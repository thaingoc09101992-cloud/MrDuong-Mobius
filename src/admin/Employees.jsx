import { useMemo, useState } from 'react'
import { sb } from './adminClient.js'
import { formatTime, CODE_PATTERN } from '../supabase.js'

function EmployeeRow({ emp, count, onSaved, onError }) {
  const [name, setName] = useState(emp.full_name || '')
  const [busy, setBusy] = useState(false)

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
      <td className="center">{count}</td>
      <td className="ad-nowrap small muted">{formatTime(emp.created_at)}</td>
      <td>
        <button
          type="button"
          className={`btn btn-sm ${emp.is_active ? 'btn-ghost' : 'btn-primary'}`}
          disabled={busy}
          onClick={() => patch({ is_active: !emp.is_active })}
        >
          {emp.is_active ? 'Khóa' : 'Mở khóa'}
        </button>
      </td>
    </tr>
  )
}

export default function Employees({ employees, rows, onSaved, onAdded }) {
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('staff')
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')

  const counts = useMemo(() => {
    const m = new Map()
    rows.forEach((r) => m.set(r.employee_code, (m.get(r.employee_code) || 0) + 1))
    return m
  }, [rows])

  const shown = employees.filter((e) => {
    const s = q.trim().toLowerCase()
    return !s || e.code.toLowerCase().includes(s) || (e.full_name || '').toLowerCase().includes(s)
  })

  async function add(e) {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!CODE_PATTERN.test(c)) {
      setError('Mã nhân viên gồm 3 đến 20 ký tự: chữ không dấu, số, gạch ngang hoặc gạch dưới.')
      return
    }
    setAdding(true)
    setError('')
    const { data, error: err } = await sb
      .from('employees')
      .insert({ code: c, full_name: fullName.trim() || null, role })
      .select()
      .single()
    setAdding(false)
    if (err) {
      setError(err.code === '23505' ? 'Mã nhân viên này đã tồn tại.' : 'Không thêm được nhân viên. Vui lòng thử lại.')
      return
    }
    onAdded(data)
    setCode('')
    setFullName('')
    setRole('staff')
  }

  return (
    <div className="stack">
      <form className="card ad-addform" onSubmit={add} noValidate>
        <label className="field field-sm">
          <span>Mã nhân viên</span>
          <input value={code} maxLength={20} onChange={(e) => setCode(e.target.value)} placeholder="Ví dụ: NV002" />
        </label>
        <label className="field field-sm">
          <span>Họ tên</span>
          <input value={fullName} maxLength={100} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="field field-sm">
          <span>Vai trò</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="staff">Nhân viên</option>
            <option value="manager">Quản lý</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary btn-sm" disabled={adding || !code.trim()}>
          {adding ? 'Đang thêm...' : 'Thêm nhân viên'}
        </button>
      </form>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="row between wrap-row">
        <label className="field field-sm ad-search">
          <span>Tìm nhân viên</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mã hoặc họ tên" />
        </label>
        <span className="small muted">
          {shown.length} / {employees.length} mã. Khóa một mã sẽ chặn đăng nhập mã đó ở app nhân viên.
        </span>
      </div>

      <div className="card ad-tablewrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Mã NV</th>
              <th>Họ tên</th>
              <th>Vai trò</th>
              <th>Số điểm</th>
              <th>Tạo lúc</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((emp) => (
              <EmployeeRow
                key={emp.code}
                emp={emp}
                count={counts.get(emp.code) || 0}
                onSaved={onSaved}
                onError={setError}
              />
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="center muted">
                  Chưa có nhân viên nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
