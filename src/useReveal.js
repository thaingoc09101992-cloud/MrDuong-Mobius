import { useEffect } from 'react'

// Các khối trượt nhẹ vào màn hình khi lăn chuột: lăn xuống thì trượt lên, lăn lên thì trượt xuống.
const SELECTOR = [
  '.ad-main .card',
  '.ad-main .module-card',
  '.ad-main .profile-list',
  '.ad-main .list',
  '.ad-main .hero',
  '.ad-main .empty-state',
  '.ad-main .ad-kpis',
  '.ad-main .map-toolbar',
].join(',')

// Không áp dụng cho hộp thoại và bản đồ (hộp thoại dùng vị trí cố định, bản đồ tự tính kích thước)
const SKIP = '.ad-modal, .map-canvas, .ad-map'

const OFFSET = 22
const CLEAN_AFTER_MS = 1100

export default function useReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const seen = new WeakSet()
    const hidden = new Set()
    let dir = 1
    let lastY = window.scrollY
    let raf = 0

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target
          io.unobserve(el)
          hidden.delete(el)
          // Các khối cùng xuất hiện một lúc thì trượt lệch nhau một chút cho mềm
          const siblings = el.parentElement ? Array.from(el.parentElement.children) : []
          const order = Math.max(0, siblings.indexOf(el))
          el.style.setProperty('--rd', `${Math.min(order, 4) * 70}ms`)
          requestAnimationFrame(() => {
            el.classList.add('is-visible')
            setTimeout(() => {
              el.classList.remove('reveal', 'is-visible')
              el.style.removeProperty('--rd')
              el.style.removeProperty('--ry')
            }, CLEAN_AFTER_MS)
          })
        })
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.04 },
    )

    function scan() {
      raf = 0
      document.querySelectorAll(SELECTOR).forEach((el) => {
        if (seen.has(el) || el.closest(SKIP)) return
        seen.add(el)
        el.style.setProperty('--ry', `${dir * OFFSET}px`)
        el.classList.add('reveal')
        hidden.add(el)
        io.observe(el)
      })
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(scan)
    }

    const mo = new MutationObserver(schedule)
    mo.observe(document.getElementById('root') || document.body, { childList: true, subtree: true })
    schedule()

    function onScroll(e) {
      const t = e.target
      const y = t && t !== document && t.scrollTop !== undefined ? t.scrollTop : window.scrollY
      const d = y > lastY ? 1 : y < lastY ? -1 : dir
      lastY = y
      if (d !== dir) {
        dir = d
        hidden.forEach((el) => el.style.setProperty('--ry', `${dir * OFFSET}px`))
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })

    return () => {
      io.disconnect()
      mo.disconnect()
      window.removeEventListener('scroll', onScroll, true)
      if (raf) cancelAnimationFrame(raf)
      document.querySelectorAll('.reveal').forEach((el) => el.classList.remove('reveal', 'is-visible'))
    }
  }, [])
}
