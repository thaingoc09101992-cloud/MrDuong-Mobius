import { fold } from '../admin/util.js'

export const MAX_STORES = 10000

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
  { key: 'top_skus', label: 'SKU hay mua', aliases: ['sku hay mua', 'sku', 'san pham hay mua'] },
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
export function parseNumber(raw) {
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
      top_skus: cellText(get(row, 'top_skus')).slice(0, 500) || null,
    })
  }

  if (total > MAX_STORES) throw new Error(`File có ${total} dòng, tối đa ${MAX_STORES} điểm bán mỗi lần tải.`)
  return { rows, errors, total }
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
    top_skus: 'SKU001, SKU014, SKU102',
  })
  ;['revenue_current', 'revenue_6m', 'avg_6m'].forEach((key) => {
    ws.getColumn(key).numFmt = '#,##0'
  })
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