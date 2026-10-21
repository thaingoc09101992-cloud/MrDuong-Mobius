import { useEffect, useMemo, useRef, useState } from 'react'
import { callEmployeesFn } from './adminClient.js'
import { confirmDialog } from '../ConfirmDialog.jsx'
import { downloadTemplate, parseEmployeeFile, exportAccounts, MAX_IMPORT_ROWS } from './employeeExcel.js'

const CONCURRENCY = 3
const ROLE_LABEL = { staff: 'Nhân viên', manager: 'Quản lý' }

/** Import nhân viên hàng loạt từ Excel: chọn file, kiểm tra, tạo tài khoản, xuất danh sách email và mật khẩu. */
export default function BulkImport({ employees, onCreated, onClose }) {
  const [step, setStep] = useState('pick') // pick | preview | running | done
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState([])
  const [saved, setSaved] = useState(false) // đã tải file hoặc sao chép danh sách tài khoản
  const inputRef = useRef(null)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && step !== 'running') requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, saved, results])

  const withAccount = useMemo(() => new Set(employees.filter((e) => e.user_id).map((e) => e.code)), [employees])
  // Những mã có thể làm quản lý trực tiếp: đã là Quản lý trong hệ thống hoặc là Quản lý hợp lệ trong chính file này
  const managerCodes = useMemo(
    () =>
      new Set([
        ...employees.filter((e) => e.role === 'manager').map((e) => e.code),
        ...rows.filter((r) => r.role === 'manager' && r.errors.length === 0).map((r) => r.code),
      ]),
    [employees, rows],
  )

  // Thêm lỗi "đã có tài khoản" dựa trên dữ liệu hiện tại
  const checked = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        problems: [
          ...r.errors,
          ...(withAccount.has(r.code) ? ['Mã này đã có tài khoản'] : []),
          ...(r.manager_code && !managerCodes.has(r.manager_code)
            ? ['Quản lý trực tiếp chưa có hoặc không phải vai trò Quản lý']
            : []),
        ],
      })),
    [rows, withAccount, managerCodes],
  )
  const valid = checked.filter((r) => r.problems.length === 0)
  const invalid = checked.length - valid.length

  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount

  async function requestClose() {
    if (step === 'running') return
    if (step === 'done' && okCount > 0 && !saved) {
      const ok = await confirmDialog({
        title: 'Đóng khi chưa lưu danh sách tài khoản?',
        message: 'Bạn chưa tải hoặc sao chép danh sách tài khoản. Mật khẩu sẽ không hiển thị lại.',
        confirmLabel: 'Vẫn đóng',
        cancelLabel: 'Quay lại',
        danger: true,
      })
      if (!ok) return
    }
    onClose()
  }

  async function onTemplate() {
    setError('')
    try {
      await downloadTemplate()
    } catch {
      setError('Không tạo được file mẫu. Vui lòng thử lại.')
    }
  }

  async function onFile(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const parsed = await parseEmployeeFile(file)
      setRows(parsed)
      setFileName(file.name)
      setStep('preview')
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  async function run() {
    const list = valid
    if (list.length === 0) return
    setStep('running')
    setProgress(0)
    const outMap = new Map()
    let done = 0

    async function runBatch(items) {
      let next = 0
      async function worker() {
        while (next < items.length) {
          const r = items[next]
          next += 1
          try {
            const res = await callEmployeesFn({
              action: 'create',
              code: r.code,
              email: r.email,
              full_name: r.full_name || null,
              phone: r.phone || null,
              role: r.role,
              is_active: r.is_active,
              manager_code: r.manager_code || null,
            })
            outMap.set(r.line, { ...r, ok: true, password: res.temp_password })
            if (res.employee) onCreated(res.employee)
          } catch (err) {
            outMap.set(r.line, { ...r, ok: false, error: err.message })
          }
          done += 1
          setProgress(done)
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker))
    }

    // Người chưa có quản lý trực tiếp được tạo trước để làm quản lý cho những người sau
    await runBatch(list.filter((r) => !r.manager_code))
    await runBatch(list.filter((r) => r.manager_code))
    setResults(list.map((r) => outMap.get(r.line)))
    setStep('done')
  }

  async function download() {
    setError('')
    try {
      await exportAccounts(results)
      setSaved(true)
    } catch {
      setError('Không tạo được file danh sách. Vui lòng thử lại hoặc dùng nút Sao chép.')
    }
  }

  async function copyAll() {
    const text = results
      .filter((r) => r.ok)
      .map((r) => `${r.email}\t${r.password}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setSaved(true)
    } catch {
      setError('Không sao chép được. Vui lòng dùng nút Tải danh sách.')
    }
  }

  return (
    <div className="ad-modal" role="dialog" aria-modal="true" aria-label="Import nhân viên hàng loạt">
      <div className="ad-modal-box ad-modal-wide card">
        <div className="row between">
          <div>
            <span className="eyebrow">Tạo tài khoản hàng loạt</span>
            <h2>Import nhân viên từ Excel</h2>
          </div>
          {step !== 'running' && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={requestClose}>
              Đóng
            </button>
          )}
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        {step === 'pick' && (
          <div className="stack">
            <ol className="ad-steps">
              <li>Tải file mẫu và điền thông tin nhân viên (tối đa {MAX_IMPORT_ROWS} dòng).</li>
              <li>Chọn file đã điền để kiểm tra dữ liệu.</li>
              <li>Xác nhận tạo tài khoản, sau đó tải danh sách email và mật khẩu lần đầu.</li>
            </ol>
            <div className="row wrap-row">
              <button type="button" className="btn btn-ghost" onClick={onTemplate}>
                Tải file mẫu (.xlsx)
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => inputRef.current && inputRef.current.click()}>
                {busy ? 'Đang đọc file...' : 'Chọn file đã điền'}
              </button>
              <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={onFile} />
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="stack">
            <p className="small muted">
              File: <strong>{fileName}</strong> - {checked.length} dòng, <strong>{valid.length} hợp lệ</strong>
              {invalid > 0 ? `, ${invalid} có lỗi (sẽ bỏ qua)` : ''}.
            </p>
            <div className="ad-tablewrap ad-modal-table">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>Mã NV</th>
                    <th>Tên</th>
                    <th>Email</th>
                    <th>SĐT</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Quản lý</th>
                    <th>Kiểm tra</th>
                  </tr>
                </thead>
                <tbody>
                  {checked.map((r) => (
                    <tr key={r.line} className={r.problems.length ? 'ad-rowbad' : ''}>
                      <td>{r.line}</td>
                      <td>
                        <strong>{r.code}</strong>
                      </td>
                      <td>{r.full_name}</td>
                      <td className="ad-wrap">{r.email}</td>
                      <td>{r.phone}</td>
                      <td>{ROLE_LABEL[r.role]}</td>
                      <td>{r.is_active ? 'Active' : 'Inactive'}</td>
                      <td>{r.manager_code || '-'}</td>
                      <td className="small">{r.problems.length ? r.problems.join('; ') : 'Hợp lệ'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row wrap-row">
              <button type="button" className="btn btn-ghost" onClick={() => setStep('pick')}>
                Chọn file khác
              </button>
              <button type="button" className="btn btn-primary grow" disabled={valid.length === 0} onClick={run}>
                Tạo {valid.length} tài khoản
              </button>
            </div>
          </div>
        )}

        {step === 'running' && (
          <div className="stack">
            <p>
              Đang tạo tài khoản... {progress} / {valid.length}
            </p>
            <div className="ad-progress" aria-hidden="true">
              <div className="ad-progress-bar" style={{ width: `${(progress / Math.max(1, valid.length)) * 100}%` }} />
            </div>
            <p className="small muted">Vui lòng không đóng cửa sổ này.</p>
          </div>
        )}

        {step === 'done' && (
          <div className="stack">
            <p>
              Đã tạo <strong>{okCount}</strong> tài khoản{failCount > 0 ? `, ${failCount} dòng không tạo được` : ''}.
            </p>
            {okCount > 0 && (
              <div className="alert ad-notice">
                Mật khẩu lần đầu chỉ hiển thị <strong>một lần</strong>. Hãy tải danh sách hoặc sao chép ngay, rồi gửi cho nhân
                viên. Nhân viên phải đổi mật khẩu ở lần đăng nhập đầu tiên.
              </div>
            )}
            <div className="row wrap-row">
              <button type="button" className="btn btn-primary" disabled={okCount === 0} onClick={download}>
                Tải danh sách tài khoản (.xlsx)
              </button>
              <button type="button" className="btn btn-ghost" disabled={okCount === 0} onClick={copyAll}>
                {saved ? 'Đã lưu danh sách' : 'Sao chép email + mật khẩu'}
              </button>
            </div>
            <div className="ad-tablewrap ad-modal-table">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Mã NV</th>
                    <th>Tên</th>
                    <th>Email đăng nhập</th>
                    <th>Mật khẩu lần đầu</th>
                    <th>Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.line} className={r.ok ? '' : 'ad-rowbad'}>
                      <td>
                        <strong>{r.code}</strong>
                      </td>
                      <td>{r.full_name}</td>
                      <td className="ad-wrap">{r.email}</td>
                      <td className="ad-secret-pass">{r.ok ? r.password : ''}</td>
                      <td className="small">{r.ok ? 'Đã tạo' : r.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={requestClose}>
                Hoàn tất
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
