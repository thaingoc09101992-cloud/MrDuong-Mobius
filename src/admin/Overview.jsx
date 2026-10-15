import { useMemo } from 'react'
import { dayKey, pad } from './util.js'

function Kpi({ label, value, hint }) {
  return (
    <div className="card ad-kpi">
      <span className="small muted">{label}</span>
      <strong className="ad-kpi-value">{value}</strong>
      {hint && <span className="small muted">{hint}</span>}
    </div>
  )
}

/** Cột theo ngày: một dãy dữ liệu, một màu, giá trị ghi trực tiếp trên cột. */
function DayBars({ days }) {
  const max = Math.max(1, ...days.map((d) => d.value))
  return (
    <div className="ad-daybars" role="img" aria-label="Số điểm bán theo ngày, 14 ngày gần nhất">
      {days.map((d) => (
        <div className="ad-daycol" key={d.key} title={`${d.label}: ${d.value} điểm`}>
          <span className="ad-daycol-val">{d.value > 0 ? d.value : ''}</span>
          <div className="ad-daycol-track">
            <div className="ad-daycol-bar" style={{ height: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="ad-daycol-label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Thanh ngang: nhãn bên trái, giá trị ghi ở đầu thanh. */
function HBars({ items, empty }) {
  if (items.length === 0) return <p className="muted small">{empty}</p>
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="ad-hbars">
      {items.map((i) => (
        <li key={i.label} className="ad-hbar" title={`${i.label}: ${i.value} điểm`}>
          <span className="ad-hbar-label">{i.label}</span>
          <span className="ad-hbar-track">
            <span className="ad-hbar-fill" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="ad-hbar-val">{i.value}</span>
        </li>
      ))}
    </ul>
  )
}

export default function Overview({ rows, employees }) {
  const stats = useMemo(() => {
    const todayKey = dayKey(new Date())
    const today = rows.filter((r) => dayKey(r.captured_at) === todayKey).length

    const perDay = new Map()
    rows.forEach((r) => {
      const k = dayKey(r.captured_at)
      perDay.set(k, (perDay.get(k) || 0) + 1)
    })
    const days = []
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = dayKey(d)
      days.push({ key, label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, value: perDay.get(key) || 0 })
    }

    const empName = new Map(employees.map((e) => [e.code, e.full_name || '']))
    const perEmp = new Map()
    rows.forEach((r) => perEmp.set(r.employee_code, (perEmp.get(r.employee_code) || 0) + 1))
    const byEmployee = [...perEmp.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, value]) => ({ label: empName.get(code) ? `${empName.get(code)} (${code})` : code, value }))

    const perChannel = new Map()
    rows.forEach((r) => {
      const k = r.channel || 'Chưa chọn loại hình'
      perChannel.set(k, (perChannel.get(k) || 0) + 1)
    })
    const byChannel = [...perChannel.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))

    return { today, days, byEmployee, byChannel, withData: perEmp.size }
  }, [rows, employees])

  const activeEmployees = employees.filter((e) => e.is_active).length

  return (
    <div className="stack">
      <div className="ad-kpis">
        <Kpi label="Tổng số điểm bán" value={rows.length} />
        <Kpi label="Chụp hôm nay" value={stats.today} />
        <Kpi label="Nhân viên đã có dữ liệu" value={stats.withData} hint={`trên ${employees.length} mã`} />
        <Kpi label="Mã đang hoạt động" value={activeEmployees} />
      </div>

      <div className="card stack">
        <h2>Điểm bán theo ngày (14 ngày gần nhất)</h2>
        <DayBars days={stats.days} />
      </div>

      <div className="ad-two">
        <div className="card stack">
          <h2>Theo nhân viên (10 người nhiều nhất)</h2>
          <HBars items={stats.byEmployee} empty="Chưa có dữ liệu." />
        </div>
        <div className="card stack">
          <h2>Theo loại hình</h2>
          <HBars items={stats.byChannel} empty="Chưa có dữ liệu." />
        </div>
      </div>
    </div>
  )
}
