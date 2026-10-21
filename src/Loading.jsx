/** Trạng thái đang tải dùng chung: vòng quay + chữ. full = phủ cả màn hình (lúc khởi động app). */
export default function Loading({ label = 'Đang tải...', full = false }) {
  return (
    <div className={`loading ${full ? 'loading-full' : ''}`} role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
