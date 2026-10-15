import { CODE_PATTERN, COMPANY_DOMAINS, isCompanyEmail, normalizePhone, isPhone } from '../supabase.js'
import { fold, pad } from './util.js'

export const MAX_IMPORT_ROWS = 300

const INK = 'FF111111'
const HEADERS = ['Mã nhân viên', 'Tên nhân viên', 'Email công ty', 'Số điện thoại', 'Vai trò', 'Trạng thái']
const SHEET = 'Nhân viên'

async function loadExcel() {
  const mod = await import('exceljs')
  return mod.default || mod
}

async function saveWorkbook(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.alignment = { vertical: 'middle', horizontal: 'left' }
  row.height = 26
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } }
  })
}

function stamp() {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

/** Tải file mẫu import nhân viên (.xlsx) để điền thông tin trước khi import. */
export async function downloadTemplate() {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Thu thập điểm bán'

  const ws = wb.addWorksheet(SHEET, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: HEADERS[0], key: 'code', width: 18 },
    { header: HEADERS[1], key: 'name', width: 28 },
    { header: HEADERS[2], key: 'email', width: 34 },
    { header: HEADERS[3], key: 'phone', width: 18 },
    { header: HEADERS[4], key: 'role', width: 16 },
    { header: HEADERS[5], key: 'status', width: 16 },
  ]
  styleHeader(ws.getRow(1))

  // Định dạng văn bản cho cột mã và số điện thoại để Excel không làm mất số 0 đầu; danh sách chọn cho vai trò, trạng thái
  for (let r = 2; r <= MAX_IMPORT_ROWS + 1; r += 1) {
    ws.getCell(`A${r}`).numFmt = '@'
    ws.getCell(`D${r}`).numFmt = '@'
    ws.getCell(`E${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Nhân viên,Quản lý"'],
    }
    ws.getCell(`F${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Active,Inactive"'],
    }
  }

  const guide = wb.addWorksheet('Hướng dẫn')
  guide.getColumn(1).width = 30
  guide.getColumn(2).width = 78
  const lines = [
    ['HƯỚNG DẪN ĐIỀN FILE IMPORT NHÂN VIÊN', ''],
    ['', ''],
    ['Cách làm', `Điền thông tin ở sheet "${SHEET}" từ dòng 2 trở đi, mỗi dòng một nhân viên, rồi lưu file và import trong trang admin. Không đổi tên cột, không xóa dòng tiêu đề. Tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần.`],
    ['Mã nhân viên (bắt buộc)', '3 đến 20 ký tự: chữ không dấu, số, gạch ngang (-) hoặc gạch dưới (_). Không được trùng. Ví dụ: NV001'],
    ['Tên nhân viên', 'Họ và tên, tối đa 100 ký tự. Ví dụ: Nguyễn Văn A'],
    ['Email công ty (bắt buộc)', `Email thuộc tên miền ${COMPANY_DOMAINS.map((d) => '@' + d).join(' hoặc ')}. Mỗi nhân viên một email riêng. Ví dụ: nguyenvana@${COMPANY_DOMAINS[0]}`],
    ['Số điện thoại', 'Từ 9 đến 12 chữ số, có thể bắt đầu bằng dấu +. Ví dụ: 0901234567. Có thể để trống.'],
    ['Vai trò', 'Nhân viên hoặc Quản lý. Để trống sẽ hiểu là Nhân viên.'],
    ['Trạng thái', 'Active hoặc Inactive. Để trống sẽ hiểu là Active.'],
    ['', ''],
    ['Sau khi import', 'Hệ thống tạo tài khoản và mật khẩu tạm cho từng nhân viên, hiển thị một lần và cho tải về file danh sách. Nhân viên phải đổi mật khẩu ở lần đăng nhập đầu tiên.'],
  ]
  lines.forEach((l, i) => {
    const row = guide.addRow(l)
    row.alignment = { vertical: 'top', wrapText: true }
    if (i === 0) row.font = { bold: true, size: 13 }
    else row.getCell(1).font = { bold: true }
  })

  await saveWorkbook(wb, 'mau-import-nhan-vien.xlsx')
}

function cellText(cell) {
  const v = cell.value
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('')
    if (v.text !== undefined) return String(v.text)
    if (v.result !== undefined) return String(v.result)
    return ''
  }
  return String(v)
}

function parseRole(text) {
  const t = fold(text.trim())
  if (!t || t === 'nhan vien' || t === 'staff') return 'staff'
  if (t === 'quan ly' || t === 'manager') return 'manager'
  return null
}

function parseStatus(text) {
  const t = fold(text.trim())
  if (!t || t === 'active') return true
  if (t === 'inactive') return false
  return null
}

/** Đọc file import. Trả về các dòng đã chuẩn hóa kèm danh sách lỗi của từng dòng. */
export async function parseEmployeeFile(file) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(await file.arrayBuffer())
  } catch {
    throw new Error('Không đọc được file. Vui lòng dùng file Excel (.xlsx) theo đúng mẫu.')
  }
  const ws = wb.getWorksheet(SHEET) || wb.worksheets[0]
  if (!ws) throw new Error('File không có dữ liệu.')

  const head = HEADERS.map((_, i) => fold(cellText(ws.getRow(1).getCell(i + 1)).trim()))
  if (!HEADERS.every((h, i) => head[i] === fold(h))) {
    throw new Error('File không đúng mẫu. Vui lòng tải file mẫu và điền thông tin theo đúng các cột.')
  }

  const rows = []
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r)
    const raw = HEADERS.map((_, i) => cellText(row.getCell(i + 1)).trim())
    if (raw.every((x) => x === '')) continue

    const phoneCell = row.getCell(4)
    let phone = normalizePhone(raw[3])
    // Excel lưu số điện thoại dạng số sẽ mất số 0 đầu
    if (typeof phoneCell.value === 'number' && /^[1-9][0-9]{8}$/.test(phone)) phone = `0${phone}`

    const role = parseRole(raw[4])
    const active = parseStatus(raw[5])
    const item = {
      line: r,
      code: raw[0].toUpperCase(),
      full_name: raw[1].slice(0, 100),
      email: raw[2].toLowerCase(),
      phone,
      role: role || 'staff',
      is_active: active === null ? true : active,
      errors: [],
    }
    if (!CODE_PATTERN.test(item.code)) item.errors.push('Mã nhân viên không hợp lệ')
    if (!item.email) item.errors.push('Thiếu email')
    else if (!isCompanyEmail(item.email)) item.errors.push(`Email phải thuộc ${COMPANY_DOMAINS.map((d) => '@' + d).join(' hoặc ')}`)
    if (item.phone && !isPhone(item.phone)) item.errors.push('Số điện thoại không hợp lệ')
    if (role === null) item.errors.push('Vai trò chỉ nhận Nhân viên hoặc Quản lý')
    if (active === null) item.errors.push('Trạng thái chỉ nhận Active hoặc Inactive')
    rows.push(item)
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new Error(`File có quá ${MAX_IMPORT_ROWS} dòng. Vui lòng chia nhỏ file.`)
    }
  }
  if (rows.length === 0) throw new Error('File chưa có nhân viên nào. Vui lòng điền thông tin từ dòng 2.')

  // Trùng lặp ngay trong file
  const seenCode = new Map()
  const seenEmail = new Map()
  rows.forEach((it) => {
    if (it.code) {
      if (seenCode.has(it.code)) {
        it.errors.push(`Trùng mã với dòng ${seenCode.get(it.code)}`)
      } else seenCode.set(it.code, it.line)
    }
    if (it.email) {
      if (seenEmail.has(it.email)) {
        it.errors.push(`Trùng email với dòng ${seenEmail.get(it.email)}`)
      } else seenEmail.set(it.email, it.line)
    }
  })
  return rows
}

/** Xuất danh sách tài khoản vừa tạo (email và mật khẩu lần đầu) ra file .xlsx. */
export async function exportAccounts(results) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Thu thập điểm bán'
  const ws = wb.addWorksheet('Tài khoản', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Mã nhân viên', key: 'code', width: 16 },
    { header: 'Tên nhân viên', key: 'name', width: 26 },
    { header: 'Email đăng nhập', key: 'email', width: 34 },
    { header: 'Mật khẩu lần đầu', key: 'password', width: 22 },
    { header: 'Kết quả', key: 'result', width: 44 },
  ]
  styleHeader(ws.getRow(1))
  results.forEach((r, i) => {
    const row = ws.addRow({
      stt: i + 1,
      code: r.code,
      name: r.full_name || '',
      email: r.email,
      password: r.ok ? r.password : '',
      result: r.ok ? 'Đã tạo' : `Không tạo được: ${r.error}`,
    })
    row.getCell('password').font = { name: 'Consolas', bold: true }
    if (!r.ok) row.font = { color: { argb: 'FF9B3B32' } }
  })
  const note = ws.addRow([])
  ws.addRow(['', 'Lưu ý: mật khẩu chỉ dùng cho lần đăng nhập đầu tiên, nhân viên bắt buộc đổi mật khẩu ngay. Bảo mật file này và xóa sau khi đã gửi cho nhân viên.'])
  note.height = 8
  await saveWorkbook(wb, `tai-khoan-nhan-vien-${stamp()}.xlsx`)
}
