import { photoUrl } from '../supabase.js'
import { dayKey, mapsUrl, pad } from './util.js'

const HEADER_FILL = 'FF111111'

function toLocalExcelDate(iso) {
  const d = new Date(iso)
  // Excel lưu ngày giờ không kèm múi giờ: dịch để hiển thị đúng giờ địa phương
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  row.height = 24
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF0B5A54' } } }
  })
}

function countBy(rows, keyFn) {
  const m = new Map()
  rows.forEach((r) => {
    const k = keyFn(r)
    m.set(k, (m.get(k) || 0) + 1)
  })
  return m
}

/** Xuất danh sách điểm bán (đã lọc) ra file .xlsx và tải xuống trên trình duyệt. */
export async function exportExcel(rows) {
  const mod = await import('exceljs')
  const ExcelJS = mod.default || mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Thu thập điểm bán'
  wb.created = new Date()

  // ---- Sheet 1: Điểm bán ----
  const ws = wb.addWorksheet('Điểm bán', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Mã NV', key: 'code', width: 12 },
    { header: 'Họ tên NV', key: 'emp', width: 22 },
    { header: 'Tên điểm bán', key: 'name', width: 32 },
    { header: 'Địa chỉ', key: 'address', width: 42 },
    { header: 'Loại hình', key: 'channel', width: 24 },
    { header: 'Vĩ độ', key: 'lat', width: 13 },
    { header: 'Kinh độ', key: 'lng', width: 13 },
    { header: 'Sai số GPS (m)', key: 'acc', width: 15 },
    { header: 'Link Google Maps', key: 'map', width: 18 },
    { header: 'Link ảnh', key: 'photo', width: 14 },
    { header: 'Thời gian chụp', key: 'time', width: 19 },
  ]
  styleHeader(ws.getRow(1))

  const linkFont = { color: { argb: 'FF0563C1' }, underline: true }
  rows.forEach((o, i) => {
    const row = ws.addRow({
      stt: i + 1,
      code: o.employee_code,
      emp: o.employee_name || '',
      name: o.name,
      address: o.address || '',
      channel: o.channel || '',
      lat: Number(o.lat),
      lng: Number(o.lng),
      acc: Math.round(Number(o.accuracy_m) * 10) / 10,
      map: { text: 'Mở bản đồ', hyperlink: mapsUrl(o.lat, o.lng) },
      photo: { text: 'Xem ảnh', hyperlink: photoUrl(o.photo_path) },
      time: toLocalExcelDate(o.captured_at),
    })
    row.getCell('lat').numFmt = '0.000000'
    row.getCell('lng').numFmt = '0.000000'
    row.getCell('acc').numFmt = '0.0'
    row.getCell('time').numFmt = 'dd/mm/yyyy hh:mm'
    row.getCell('map').font = linkFont
    row.getCell('photo').font = linkFont
    row.getCell('address').alignment = { wrapText: true, vertical: 'top' }
    row.getCell('name').alignment = { wrapText: true, vertical: 'top' }
  })
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 12 } }

  // ---- Sheet 2: Thống kê ----
  const st = wb.addWorksheet('Thống kê')
  st.columns = [
    { width: 26 },
    { width: 26 },
    { width: 14 },
  ]
  let r = 1
  function block(title, headers, entries) {
    const t = st.getRow(r)
    t.getCell(1).value = title
    t.font = { bold: true, size: 12 }
    r += 1
    const h = st.getRow(r)
    headers.forEach((text, idx) => {
      h.getCell(idx + 1).value = text
    })
    styleHeader(h)
    r += 1
    entries.forEach((e) => {
      const row = st.getRow(r)
      e.forEach((v, idx) => {
        row.getCell(idx + 1).value = v
      })
      r += 1
    })
    const totalRow = st.getRow(r)
    totalRow.getCell(1).value = 'Tổng'
    totalRow.getCell(headers.length).value = entries.reduce((s, e) => s + e[headers.length - 1], 0)
    totalRow.font = { bold: true }
    r += 2
  }

  const empNames = new Map(rows.map((o) => [o.employee_code, o.employee_name || '']))
  block(
    'Số điểm theo nhân viên',
    ['Mã NV', 'Họ tên', 'Số điểm'],
    [...countBy(rows, (o) => o.employee_code).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([code, n]) => [code, empNames.get(code) || '', n]),
  )
  block(
    'Số điểm theo loại hình',
    ['Loại hình', 'Số điểm'],
    [...countBy(rows, (o) => o.channel || 'Chưa chọn').entries()].sort((a, b) => b[1] - a[1]),
  )
  block(
    'Số điểm theo ngày',
    ['Ngày', 'Số điểm'],
    [...countBy(rows, (o) => dayKey(o.captured_at)).entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([k, n]) => [`${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`, n]),
  )

  // ---- Tải xuống ----
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const now = new Date()
  const filename = `diem-ban_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return filename
}
