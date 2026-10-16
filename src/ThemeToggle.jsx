import Icon from './icons.jsx'

/** Nút đổi giao diện sáng/tối dùng chung toàn trang: mặt trời khi đang tối, mặt trăng khi đang sáng. */
export default function ThemeToggle({ theme, onToggle, className = '' }) {
  const dark = theme === 'dark'
  const label = dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm btn-icon ${className}`}
      onClick={onToggle}
      aria-label={label}
      title={label}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  )
}
