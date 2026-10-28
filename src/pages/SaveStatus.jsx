import { useEffect, useState } from 'react'
import { retryNow, discardItem, onItemSaved, secondsLeft, useSaveQueue } from './saveQueue.js'

/**
 * Trạng thái lưu nền: còn điểm chưa gửi thì báo đừng thoát kèm số giây ước tính,
 * gửi xong hết thì báo an toàn để thoát. `floating` = nổi cố định ở đáy màn hình (các tab ngoài màn chụp).
 */
export default function SaveStatus({ floating = false }) {
  const queue = useSaveQueue()
  const [, tick] = useState(0)
  const [justSaved, setJustSaved] = useState(false)
  useEffect(() => {
    let timer = 0
    const off = onItemSaved(() => {
      setJustSaved(true)
      clearTimeout(timer)
      timer = setTimeout(() => setJustSaved(false), 5000)
    })
    return () => {
      off()
      clearTimeout(timer)
    }
  }, [])
  const pending = queue.some((i) => i.state === 'sending')
  useEffect(() => {
    if (!pending) return undefined
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [pending])

  const cls = (mod) => `queue-chip ${mod} ${floating ? 'is-floating' : ''}`
  const rejected = queue.filter((i) => i.state === 'rejected')
  const waiting = queue.filter((i) => i.state === 'waiting')
  const sending = queue.filter((i) => i.state === 'sending')

  if (rejected.length) {
    const it = rejected[0]
    return (
      <div className={cls('is-bad')} role="alert">
        <span>
          {it.name}: {it.error}
        </span>
        <button type="button" className="btn btn-sm" onClick={() => discardItem(it.id)}>
          Xóa
        </button>
      </div>
    )
  }
  if (waiting.length) {
    return (
      <div className={cls('is-wait')} role="status">
        <span>Còn {waiting.length + sending.length} điểm chưa gửi (chờ mạng), thoát bây giờ có thể mất. Sẽ tự gửi lại khi có mạng.</span>
        <button type="button" className="btn btn-sm" onClick={retryNow}>
          Thử lại
        </button>
      </div>
    )
  }
  if (sending.length) {
    const s = secondsLeft()
    return (
      <div className={cls('is-wait')} role="status" aria-live="polite">
        <span>
          Còn {sending.length} điểm chưa gửi, thoát bây giờ có thể mất. Vui lòng chờ {s > 0 ? `khoảng ${s} giây` : 'thêm chút nữa'}...
        </span>
      </div>
    )
  }
  if (justSaved) {
    return (
      <div className={cls('is-ok')} role="status" aria-live="polite">
        <span>Đã gửi xong. An toàn để thoát.</span>
      </div>
    )
  }
  return null
}