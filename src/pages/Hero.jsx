import { useEffect, useRef, useState } from 'react'
import { bannerUrl } from '../banners.js'
import Icon from '../icons.jsx'

const INTERVAL_MS = 6500

function Slide({ banner, state }) {
  const external = /^https?:\/\//i.test(banner.link_url || '')
  const active = state === 'active'
  const body = (
    <>
      <span className="hero-img" style={{ backgroundImage: `url("${bannerUrl(banner.image_path)}")` }} />
      {(banner.title || banner.subtitle) && (
        <span className="hero-caption">
          {banner.title && <span className="hero-title">{banner.title}</span>}
          {banner.subtitle && <span className="hero-sub">{banner.subtitle}</span>}
        </span>
      )}
    </>
  )
  const common = {
    className: `hero-slide ${state === 'active' ? 'is-active' : state === 'leaving' ? 'is-leaving' : ''}`,
    'aria-hidden': !active,
    tabIndex: active ? 0 : -1,
  }
  if (banner.link_url) {
    return (
      <a {...common} href={banner.link_url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {body}
      </a>
    )
  }
  return <div {...common}>{body}</div>
}

/**
 * Banner trang chủ: tối đa 5 ảnh do admin đăng. Chuyển banner bằng hiệu ứng trượt ngang theo chiều chuyển,
 * ảnh phóng nhẹ và chữ hiện dần. Chưa có ảnh nào thì hiện banner mặc định của MOBIUS.
 */
export default function Hero({ banners }) {
  const [index, setIndex] = useState(0)
  const [prev, setPrev] = useState(-1)
  const [dir, setDir] = useState(1) // 1: sang banner kế tiếp, -1: quay lại banner trước
  const [paused, setPaused] = useState(false)
  const touch = useRef(null)
  const count = banners.length

  useEffect(() => {
    if (index >= count) {
      setIndex(0)
      setPrev(-1)
    }
  }, [count, index])

  // Đổi chiều trước, khung hình kế tiếp mới đổi banner để các banner đang chờ đứng đúng phía trước khi trượt vào
  function go(target, d) {
    if (count < 2 || target === index) return
    setDir(d)
    requestAnimationFrame(() => {
      setPrev(index)
      setIndex(target)
    })
  }
  const next = () => go((index + 1) % count, 1)
  const back = () => go((index - 1 + count) % count, -1)

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (count < 2 || paused || reduce) return undefined
    const t = setInterval(() => go((index + 1) % count, 1), INTERVAL_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, paused, index])

  if (count === 0) {
    return (
      <div className="hero hero-default" role="img" aria-label="MOBIUS">
        <span className="hero-caption hero-caption-default">
          <span className="hero-eyebrow">Nền tảng nội bộ</span>
          <span className="hero-title">MOBIUS</span>
          <span className="hero-sub">Nơi tập hợp các công cụ làm việc dành cho nhân viên.</span>
        </span>
      </div>
    )
  }

  function onTouchStart(e) {
    touch.current = e.touches[0].clientX
  }
  function onTouchEnd(e) {
    if (touch.current === null) return
    const dx = e.changedTouches[0].clientX - touch.current
    touch.current = null
    if (Math.abs(dx) > 40) (dx < 0 ? next : back)()
  }

  return (
    <div
      className="hero"
      style={{ '--dir': dir }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {banners.map((b, i) => (
        <Slide key={b.slot} banner={b} state={i === index ? 'active' : i === prev ? 'leaving' : 'hidden'} />
      ))}

      {count > 1 && (
        <>
          <button type="button" className="hero-nav hero-prev" aria-label="Banner trước" onClick={back}>
            <Icon name="chevron-left" size={20} />
          </button>
          <button type="button" className="hero-nav hero-next" aria-label="Banner sau" onClick={next}>
            <Icon name="chevron-right" size={20} />
          </button>
          <div className="hero-dots" role="tablist" aria-label="Chọn banner">
            {banners.map((b, i) => (
              <button
                key={b.slot}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Banner ${i + 1}`}
                className={`hero-dot ${i === index ? 'is-active' : ''}`}
                onClick={() => go(i, i > index ? 1 : -1)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
