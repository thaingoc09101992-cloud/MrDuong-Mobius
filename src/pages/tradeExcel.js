import { fold } from '../admin/util.js'

export const MAX_STORES = 100000

// 9 trường phân cấp bán hàng (chữ, không bắt buộc): dùng cho bộ lọc và "Tô màu theo" của Bố trận, theo thứ tự từ rộng đến hẹp
export const DIMENSIONS = [
  { key: 'channel', label: 'Kênh', aliases: ['kenh', 'kenh ban hang', 'channel'] },
  { key: 'region', label: 'Miền', aliases: ['mien', 'region'] },
  { key: 'area', label: 'Vùng', aliases: ['vung', 'area'] },
  { key: 'zone', label: 'Khu vực', aliases: ['khu vuc', 'zone'] },
  { key: 'province', label: 'Tỉnh', aliases: ['tinh', 'tinh thanh', 'tinh/thanh pho', 'tinh thanh pho', 'province'] },
  { key: 'distributor', label: 'NPP', aliases: ['npp', 'nha phan phoi', 'distributor'] },
  { key: 'dhkd', label: 'ĐHKD', aliases: ['dhkd', 'dieu hanh kinh doanh'] },
  { key: 'route', label: 'Tuyến', aliases: ['tuyen', 'tuyen ban hang', 'route'] },
  { key: 'salesman', label: 'Tên NVBH', aliases: ['ten nvbh', 'nvbh', 'nhan vien ban hang', 'ten nhan vien ban hang'] },
]

// Cột của file Excel: key trong dữ liệu, tên cột hiển thị ở file mẫu và các tên gọi khác được chấp nhận
export const COLUMNS = [
  { key: 'store_code', label: 'Mã điểm bán', aliases: ['ma diem ban', 'ma khach hang', 'ma kh', 'ma cua hang', 'code'] },
  { key: 'name', label: 'Tên điểm bán', aliases: ['ten diem ban', 'ten khach hang', 'ten kh', 'ten cua hang', 'ten', 'name'], required: true },
  { key: 'address', label: 'Địa chỉ', aliases: ['dia chi', 'address'] },
  { key: 'lat', label: 'Vĩ độ', aliases: ['vi do', 'latitude', 'lat'] },
  { key: 'lng', label: 'Kinh độ', aliases: ['kinh do', 'longitude', 'lng', 'long'] },
  { key: 'coords', label: 'Tọa độ', aliases: ['toa do', 'coordinates', 'gps'] },
  { key: 'revenue_current', label: 'Doanh số tháng hiện tại', aliases: ['doanh so thang hien tai', 'doanh so thang nay', 'doanh so thang'] },
  { key: 'revenue_6m', label: 'Doanh thu 6 tháng', aliases: ['doanh thu 6 thang', 'tong doanh thu 6 thang', 'doanh so 6 thang'] },
  { key: 'avg_6m', label: 'Trung bình 6 tháng', aliases: ['trung binh 6 thang', 'tb 6 thang', 'doanh thu trung binh 6 thang'] },
  { key: 'orders_per_month', label: 'Số đơn hàng mỗi tháng', aliases: ['so don hang moi thang', 'so don moi thang', 'so don thang', 'so don hang', 'don hang trung binh thang'] },
  { key: 'cabinet_count', label: 'Số tủ', aliases: ['so tu', 'so luong tu', 'so tu trung bay', 'tu'] },
  { key: 'top_skus', label: 'SKU hay mua', aliases: ['sku hay mua', 'sku', 'san pham hay mua'] },
  ...DIMENSIONS,
]

// Sheet thứ hai: doanh thu theo tháng, mỗi điểm bán 12 dòng, xếp từ tháng mới nhất đến cũ nhất
export const HISTORY_SHEET = 'Doanh thu tháng'
const HISTORY_COLUMNS = [
  { key: 'code', label: 'Mã điểm bán', aliases: ['ma diem ban', 'ma khach hang', 'ma kh', 'ma cua hang', 'code'] },
  { key: 'month', label: 'Tháng', aliases: ['thang', 'thang nam', 'ky', 'month'] },
  { key: 'revenue', label: 'Doanh thu', aliases: ['doanh thu', 'doanh so', 'doanh thu thang', 'doanh so thang', 'revenue'] },
]

async function loadExcel() {
  const mod = await import('exceljs')
  return mod.default || mod
}

function cellText(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('')
    if (v.text !== undefined) return String(v.text)
    if (v.result !== undefined) return cellText(v.result)
    if (v instanceof Date) return v.toISOString()
    return ''
  }
  return String(v).trim()
}

/** Đọc số theo định dạng Việt Nam hoặc quốc tế: 1.234.567 | 1,234,567 | 1234,5 | 1234.5 */
function parseNumber(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN
  let s = cellText(raw).replace(/\s| /g, '').replace(/[đ₫]|vnd|vnđ/gi, '')
  if (s === '') return null
  const hasDot = s.includes('.')
  const hasComma = s.includes(',')
  if (hasDot && hasComma) {
    const decimal = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ','
    const group = decimal === '.' ? ',' : '.'
    s = s.split(group).join('').replace(decimal, '.')
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.split('.').join('')
  } else if (hasComma) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.split(',').join('') : s.replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

/** Tọa độ luôn dùng dấu chấm hoặc phẩy làm dấu thập phân (không có dấu phân nhóm nghìn). */
function parseCoord(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return raw
  const n = Number(cellText(raw).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function splitCoords(raw) {
  const parts = cellText(raw).split(/[;,\s]+/).filter(Boolean)
  if (parts.length !== 2) return [NaN, NaN]
  return [parseCoord(parts[0]), parseCoord(parts[1])]
}

/** Đưa nhiều cách ghi tháng về 'YYYY-MM': 10/2026, 2026-10, T10/2026, 31/10/2026, 202610, hoặc ô ngày của Excel. Không nhận ra thì null. */
function normMonth(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const done = (y, m) => (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 ? `${y}-${String(m).padStart(2, '0')}` : null)
  if (raw instanceof Date) return done(raw.getUTCFullYear(), raw.getUTCMonth() + 1)
  if (typeof raw === 'number') {
    const s = String(Math.round(raw))
    return /^\d{6}$/.test(s) ? done(Number(s.slice(0, 4)), Number(s.slice(4))) : null
  }
  const s = fold(cellText(raw)).replace(/\s+/g, ' ').trim()
  let m = /^(\d{4})[-/.](\d{1,2})$/.exec(s)
  if (m) return done(Number(m[1]), Number(m[2]))
  m = /^(?:t|thang\s*)?(\d{1,2})[-/. ](\d{4})$/.exec(s)
  if (m) return done(Number(m[2]), Number(m[1]))
  m = /^\d{1,2}[-/.](\d{1,2})[-/.](\d{4})$/.exec(s)
  if (m) return done(Number(m[2]), Number(m[1]))
  m = /^(\d{4})(\d{2})$/.exec(s)
  return m ? done(Number(m[1]), Number(m[2])) : null
}

function headerMap(ws, defs) {
  const map = {}
  ws.getRow(1).eachCell((cell, col) => {
    const h = fold(cellText(cell.value)).replace(/\s+/g, ' ').trim()
    const def = defs.find((c) => fold(c.label) === h || c.aliases.includes(h))
    if (def && map[def.key] === undefined) map[def.key] = col
  })
  return map
}

/** Sheet doanh thu theo tháng: sheet khác trang chính có cột mã điểm bán và cột doanh thu. */
function findHistorySheet(wb, main) {
  for (const sheet of wb.worksheets) {
    if (sheet === main) continue
    const cols = headerMap(sheet, HISTORY_COLUMNS)
    if (cols.code !== undefined && cols.revenue !== undefined) return { sheet, cols }
  }
  return null
}

/** Đọc sheet doanh thu tháng thành Map: mã điểm bán (in hoa) -> [{ m, v }] mới nhất trước, tối đa 12. */
function readHistory(found, errors) {
  const { sheet, cols } = found
  const byCode = new Map()
  let rowsRead = 0
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r)
    const code = cellText(row.getCell(cols.code).value).toUpperCase()
    const rawRevenue = row.getCell(cols.revenue).value
    if (code === '' && cellText(rawRevenue) === '') continue
    rowsRead += 1
    if (code === '') {
      errors.push({ row: r, message: `sheet "${sheet.name}": thiếu mã điểm bán` })
      continue
    }
    const v = parseNumber(rawRevenue)
    if (Number.isNaN(v) || (v !== null && v < 0)) {
      errors.push({ row: r, message: `sheet "${sheet.name}": doanh thu của ${code} không phải số hợp lệ` })
      continue
    }
    const m = cols.month === undefined ? null : normMonth(row.getCell(cols.month).value)
    if (!byCode.has(code)) byCode.set(code, [])
    byCode.get(code).push({ m, v: v === null ? 0 : v })
  }
  byCode.forEach((list, code) => {
    // Có đủ tháng thì sắp từ mới đến cũ theo tháng; không thì giữ thứ tự dòng (đã xếp mới đến cũ)
    if (list.every((x) => x.m)) list.sort((a, b) => (a.m < b.m ? 1 : a.m > b.m ? -1 : 0))
    byCode.set(code, list.slice(0, 12))
  })
  return { byCode, rowsRead, name: sheet.name }
}
/** Đọc file Excel: trả về { rows, errors, total }. Mỗi lỗi có số dòng và nội dung. */
export async function parseStoresFile(file) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('File Excel không có trang tính nào.')

  const headerRow = ws.getRow(1)
  const colOf = {}
  headerRow.eachCell((cell, col) => {
    const h = fold(cellText(cell.value)).replace(/\s+/g, ' ').trim()
    const def = COLUMNS.find((c) => fold(c.label) === h || c.aliases.includes(h))
    if (def && colOf[def.key] === undefined) colOf[def.key] = col
  })

  if (colOf.name === undefined) throw new Error('Không tìm thấy cột "Tên điểm bán". Hãy dùng file mẫu.')
  if (colOf.coords === undefined && (colOf.lat === undefined || colOf.lng === undefined)) {
    throw new Error('Không tìm thấy cột tọa độ. Cần cột "Vĩ độ" và "Kinh độ", hoặc cột "Tọa độ".')
  }

  const get = (row, key) => (colOf[key] === undefined ? null : row.getCell(colOf[key]).value)
  const rows = []
  const errors = []
  let total = 0

  for (let r = 2; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r)
    const name = cellText(get(row, 'name'))
    const coordsEmpty = colOf.coords === undefined
      ? cellText(get(row, 'lat')) === '' && cellText(get(row, 'lng')) === ''
      : cellText(get(row, 'coords')) === ''
    if (name === '' && coordsEmpty) continue // dòng trống
    total += 1

    const problems = []
    if (name === '') problems.push('thiếu tên điểm bán')
    if (name.length > 200) problems.push('tên quá dài (tối đa 200 ký tự)')

    let lat
    let lng
    if (colOf.lat !== undefined && colOf.lng !== undefined) {
      lat = parseCoord(get(row, 'lat'))
      lng = parseCoord(get(row, 'lng'))
    } else {
      ;[lat, lng] = splitCoords(get(row, 'coords'))
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) problems.push('tọa độ không hợp lệ')
    else if (lat < -90 || lat > 90 || lng < -180 || lng > 180) problems.push('tọa độ ngoài phạm vi')

    const metrics = {}
    ;['revenue_current', 'revenue_6m', 'avg_6m', 'orders_per_month'].forEach((key) => {
      const label = COLUMNS.find((c) => c.key === key).label
      const n = parseNumber(get(row, key))
      if (Number.isNaN(n) || (n !== null && n < 0)) problems.push(`"${label}" không phải số hợp lệ`)
      else metrics[key] = n
    })
    const cabinetRaw = parseNumber(get(row, 'cabinet_count'))
    if (Number.isNaN(cabinetRaw) || (cabinetRaw !== null && (cabinetRaw < 0 || !Number.isInteger(cabinetRaw)))) problems.push('"Số tủ" phải là số nguyên không âm')
    // Có doanh thu 6 tháng nhưng thiếu trung bình thì tự tính
    if (metrics.avg_6m == null && metrics.revenue_6m != null) metrics.avg_6m = Math.round(metrics.revenue_6m / 6)

    if (problems.length > 0) {
      errors.push({ row: r, message: problems.join('; ') })
      continue
    }
    rows.push({
      store_code: cellText(get(row, 'store_code')).slice(0, 50) || null,
      name,
      address: cellText(get(row, 'address')).slice(0, 500) || null,
      lat,
      lng,
      ...metrics,
      cabinet_count: Number.isNaN(cabinetRaw) ? null : cabinetRaw,
      top_skus: cellText(get(row, 'top_skus')).slice(0, 500) || null,
      ...Object.fromEntries(DIMENSIONS.map((d) => [d.key, cellText(get(row, d.key)).slice(0, 200) || null])),
    })
  }

  if (total > MAX_STORES) throw new Error(`File có ${total} dòng, tối đa ${MAX_STORES} điểm bán mỗi lần tải.`)

  // Doanh thu theo tháng (sheet thứ hai, không bắt buộc)
  let history = null
  const foundHistory = findHistorySheet(wb, ws)
  if (foundHistory) {
    const h = readHistory(foundHistory, errors)
    let matched = 0
    rows.forEach((row) => {
      const list = row.store_code ? h.byCode.get(row.store_code.toUpperCase()) : null
      if (list && list.length > 0) {
        row.monthly = list
        matched += 1
      }
    })
    const known = new Set(rows.map((x) => (x.store_code || '').toUpperCase()))
    let unmatched = 0
    h.byCode.forEach((_, code) => {
      if (!known.has(code)) unmatched += 1
    })
    history = { sheet: h.name, rowsRead: h.rowsRead, stores: matched, unmatched }
  }
  return { rows, errors, total, history }
}

/** Tải file mẫu (.xlsx). */
export async function downloadStoresTemplate() {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Điểm bán', { views: [{ state: 'frozen', ySplit: 1 }] })
  const cols = COLUMNS.filter((c) => c.key !== 'coords')
  ws.columns = cols.map((c) => ({ header: c.label, key: c.key, width: c.key === 'address' || c.key === 'top_skus' ? 36 : 22 }))
  const head = ws.getRow(1)
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.height = 26
  head.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } }
  })
  ws.addRow({
    store_code: 'DB0001',
    name: 'Tạp hóa Minh Anh',
    address: '12 Nguyễn Trãi, Quận 1, TP.HCM',
    lat: 10.7769,
    lng: 106.7009,
    revenue_current: 12500000,
    revenue_6m: 78000000,
    avg_6m: 13000000,
    orders_per_month: 9,
    cabinet_count: 3,
    top_skus: 'SKU001, SKU014, SKU102',
    channel: 'GT',
    region: 'Miền Nam',
    area: 'Vùng 1',
    zone: 'HCM 1',
    province: 'TP.HCM',
    distributor: 'NPP Minh Phát',
    dhkd: 'Nguyễn Văn An',
    route: 'T01',
    salesman: 'Trần Thị Bình',
  })
  ;['revenue_current', 'revenue_6m', 'avg_6m'].forEach((key) => {
    ws.getColumn(key).numFmt = '#,##0'
  })

  // Sheet doanh thu theo tháng: mỗi điểm bán 12 dòng, từ tháng mới nhất đến cũ nhất (dòng đầu là "tháng này")
  const hs = wb.addWorksheet(HISTORY_SHEET, { views: [{ state: 'frozen', ySplit: 1 }] })
  hs.columns = [
    { header: 'Mã điểm bán', key: 'code', width: 18 },
    { header: 'Tháng', key: 'month', width: 14 },
    { header: 'Doanh thu', key: 'revenue', width: 18 },
  ]
  const hh = hs.getRow(1)
  hh.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  hh.height = 26
  hh.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } }
  })
  const now = new Date()
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    hs.addRow({ code: 'DB0001', month: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`, revenue: 12500000 - i * 400000 })
  }
  hs.getColumn('code').numFmt = '@'
  hs.getColumn('month').numFmt = '@'
  hs.getColumn('revenue').numFmt = '#,##0'
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Mau-danh-sach-diem-ban.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}