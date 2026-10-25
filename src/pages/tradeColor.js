// Tô màu điểm bán theo các trường dữ liệu có trong file import.
// buildScheme() chia điểm bán thành các nhóm (tối đa 5 mức theo phân vị, hoặc theo từng giá trị khi ít giá trị, hoặc theo SKU chính)
// và trả về: danh sách nhóm (nhãn, màu, số điểm) cùng mảng chỉ số nhóm của từng điểm bán, để lớp vẽ bản đồ tô màu nhanh.

import { compactMoney, summarize } from './tradePopup.js'
import { DIMENSIONS } from './tradeExcel.js'

const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

// Thang màu liền mạch từ thấp đến cao (xanh nhạt đến xanh đậm)
const SEQ = ['#9fd0ea', '#5fb0dc', '#2f8ac4', '#1b5f96', '#0a3560']
// Màu cho các nhóm rời rạc (SKU chính)
const CAT = ['#0284c7', '#dc2626', '#16a34a', '#ea580c', '#7c3aed', '#0f766e', '#c026d3']
const OTHER = '#6b7280'
const NA = '#b4ada1'

const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v))
const monthlyOf = (s) => (Array.isArray(s.monthly) && s.monthly.length > 0 ? s.monthly : null)

/**
 * Các trường có thể tô màu: kind 'money' dùng nhãn rút gọn (tr, tỷ), 'count' là số đếm, 'text' là nhóm rời rạc.
 * group 'filter': cùng các mục của bộ lọc (Kênh, Miền...); group 'metric': chỉ số doanh thu, đơn hàng, tủ, SKU.
 */
export const COLOR_GROUPS = [
  { id: 'filter', label: 'Theo bộ lọc' },
  { id: 'metric', label: 'Theo chỉ số' },
]
const textOf = (v) => {
  const t = String(v || '').trim()
  return t || null
}
export const COLOR_FIELDS = [
  ...DIMENSIONS.map((d) => ({ id: d.key, label: d.label, kind: 'text', group: 'filter', otherLabel: `${d.label} khác`, get: (s) => textOf(s[d.key]) })),
  { id: 'rev-now', label: 'Doanh thu tháng này', kind: 'money', get: (s) => (monthlyOf(s) ? num(monthlyOf(s)[0].v) : num(s.revenue_current)) },
  { id: 'avg3', label: 'Bình quân 3 tháng', kind: 'money', get: (s) => (monthlyOf(s) ? summarize(monthlyOf(s)).avg3 : null) },
  { id: 'avg9', label: 'Bình quân 9 tháng', kind: 'money', get: (s) => (monthlyOf(s) ? summarize(monthlyOf(s)).avg9 : null) },
  { id: 'avg-year', label: 'Bình quân năm', kind: 'money', get: (s) => (monthlyOf(s) ? summarize(monthlyOf(s)).avgYear : null) },
  { id: 'rev6', label: 'Doanh thu 6 tháng', kind: 'money', get: (s) => num(s.revenue_6m) },
  { id: 'avg6', label: 'Trung bình 6 tháng', kind: 'money', get: (s) => num(s.avg_6m) },
  { id: 'orders', label: 'Số đơn hàng mỗi tháng', kind: 'count', get: (s) => num(s.orders_per_month) },
  { id: 'cabinets', label: 'Số tủ', kind: 'count', get: (s) => num(s.cabinet_count) },
  { id: 'sku', label: 'SKU chính (SKU đầu tiên)', kind: 'text', otherLabel: 'SKU khác', get: (s) => firstSku(s.top_skus) },
].map((f) => ({ group: 'metric', ...f }))

function firstSku(text) {
  const first = String(text || '').split(/[,;\n]+/)[0].trim()
  return first || null
}

const fmtValue = (kind, v) => (kind === 'money' ? compactMoney(v) : nf.format(v))

function seqColor(i, count) {
  if (count <= 1) return SEQ[SEQ.length - 1]
  return SEQ[Math.round((i * (SEQ.length - 1)) / (count - 1))]
}

function finish(field, bands, assign) {
  const counts = new Array(bands.length).fill(0)
  for (let i = 0; i < assign.length; i += 1) counts[assign[i]] += 1
  return { fieldId: field.id, label: field.label, bands: bands.map((b, i) => ({ ...b, id: i, count: counts[i] })), assign }
}

function numberScheme(field, values) {
  const n = values.length
  const valid = []
  values.forEach((v) => {
    if (v !== null) valid.push(v)
  })
  const na = { label: 'Chưa có dữ liệu', color: NA }
  const assign = new Uint8Array(n)
  if (valid.length === 0) {
    assign.fill(0)
    return finish(field, [na], assign)
  }
  const distinct = [...new Set(valid)].sort((a, b) => a - b)

  // Ít giá trị khác nhau (ví dụ số tủ): mỗi giá trị một nhóm
  if (distinct.length <= 6) {
    const bands = distinct.map((v, i) => ({ label: fmtValue(field.kind, v), color: seqColor(i, distinct.length) }))
    bands.push(na)
    const index = new Map(distinct.map((v, i) => [v, i]))
    values.forEach((v, i) => {
      assign[i] = v === null ? bands.length - 1 : index.get(v)
    })
    return finish(field, bands, assign)
  }

  // Nhiều giá trị: 5 nhóm theo phân vị để mỗi nhóm có số điểm gần bằng nhau
  const sorted = Float64Array.from(valid).sort()
  const cuts = []
  for (let k = 1; k <= 4; k += 1) {
    const t = sorted[Math.floor((sorted.length * k) / 5)]
    if (cuts.length === 0 || t > cuts[cuts.length - 1]) cuts.push(t)
  }
  const bands = []
  for (let i = 0; i <= cuts.length; i += 1) {
    let label
    if (i === 0) label = `Dưới ${fmtValue(field.kind, cuts[0])}`
    else if (i === cuts.length) label = `Từ ${fmtValue(field.kind, cuts[cuts.length - 1])}`
    else label = `${fmtValue(field.kind, cuts[i - 1])} đến dưới ${fmtValue(field.kind, cuts[i])}`
    bands.push({ label, color: seqColor(i, cuts.length + 1) })
  }
  bands.push(na)
  values.forEach((v, i) => {
    if (v === null) {
      assign[i] = bands.length - 1
      return
    }
    let b = 0
    while (b < cuts.length && v >= cuts[b]) b += 1
    assign[i] = b
  })
  return finish(field, bands, assign)
}

function textScheme(field, values) {
  const freq = new Map()
  values.forEach((v) => {
    if (v !== null) freq.set(v, (freq.get(v) || 0) + 1)
  })
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, CAT.length).map((e) => e[0])
  const bands = top.map((v, i) => ({ label: v, color: CAT[i] }))
  const rest = freq.size > top.length
  if (rest) bands.push({ label: field.otherLabel || 'Khác', color: OTHER })
  bands.push({ label: 'Chưa có dữ liệu', color: NA })
  const index = new Map(top.map((v, i) => [v, i]))
  const assign = new Uint8Array(values.length)
  values.forEach((v, i) => {
    if (v === null) assign[i] = bands.length - 1
    else if (index.has(v)) assign[i] = index.get(v)
    else assign[i] = top.length // nhóm "... khác"
  })
  return finish(field, bands, assign)
}

/** Chia nhóm theo giá trị chữ của một danh sách bất kỳ (field cần id, label, otherLabel). Dùng cho bản đồ Định vị điểm bán. */
export const buildTextScheme = textScheme

/** Trả về { fieldId, label, bands: [{id, label, color, count}], assign: Uint8Array } hoặc null nếu không tô màu. */
export function buildScheme(stores, fieldId) {
  const field = COLOR_FIELDS.find((f) => f.id === fieldId)
  if (!field || stores.length === 0) return null
  const values = new Array(stores.length)
  for (let i = 0; i < stores.length; i += 1) values[i] = field.get(stores[i])
  return field.kind === 'text' ? textScheme(field, values) : numberScheme(field, values)
}