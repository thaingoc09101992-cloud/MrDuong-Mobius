import { useEffect, useState } from 'react'

const RAIL_QUERY = '(min-width: 901px) and (max-width: 1099px)'

/** true khi màn hình 901-1099px: thanh bên (app nhân viên và trang quản trị) tự thu gọn thành cột biểu tượng. */
export default function useNarrowRail() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(RAIL_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(RAIL_QUERY)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}