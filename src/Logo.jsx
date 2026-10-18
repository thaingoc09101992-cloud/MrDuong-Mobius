/**
 * Logo MOBIUS: tự đổi bản cho nền sáng (chữ đen) và nền tối (chữ ngà) theo giao diện.
 * size là số pixel; size="auto" để CSS (className) tự quyết định kích thước, dùng cho bố cục co giãn.
 */
export default function Logo({ size = 36, className = '' }) {
  const fixed = typeof size === 'number'
  const dim = fixed ? { width: size, height: size } : {}
  return (
    <span className={`logo ${className}`} style={fixed ? dim : undefined} aria-hidden="true">
      <img className="logo-on-light" src="/logo.png" alt="" {...dim} />
      <img className="logo-on-dark" src="/logo-light.png" alt="" {...dim} />
    </span>
  )
}