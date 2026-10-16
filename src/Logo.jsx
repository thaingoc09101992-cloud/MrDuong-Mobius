/** Logo MOBIUS: tự đổi bản cho nền sáng (chữ đen) và nền tối (chữ ngà) theo giao diện. */
export default function Logo({ size = 36, className = '' }) {
  return (
    <span className={`logo ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <img className="logo-on-light" src="/logo.png" alt="" width={size} height={size} />
      <img className="logo-on-dark" src="/logo-light.png" alt="" width={size} height={size} />
    </span>
  )
}
