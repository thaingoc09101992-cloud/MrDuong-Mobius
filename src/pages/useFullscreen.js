import { useEffect, useState } from 'react'

/** Chế độ toàn màn hình cho một phần tử: dùng Fullscreen API, trình duyệt không hỗ trợ (ví dụ iPhone) thì phủ kín màn hình. */
export default function useFullscreen(ref) {
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    function onChange() {
      setFullscreen(document.fullscreenElement === ref.current)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [ref])

  async function toggle() {
    const node = ref.current
    if (!node) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (node.requestFullscreen) await node.requestFullscreen()
      else setFullscreen((v) => !v)
    } catch {
      setFullscreen((v) => !v)
    }
  }

  return [fullscreen, toggle]
}