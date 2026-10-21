import { useEffect, useId, useRef } from 'react'
import { createRoot } from 'react-dom/client'

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, danger, onClose }) {
  const id = useId()
  const cancelRef = useRef(null)
  const okRef = useRef(null)

  useEffect(() => {
    // Thao tác nguy hiểm: focus sẵn vào "Hủy" để bấm Enter nhầm không xóa mất dữ liệu
    const first = danger ? cancelRef.current : okRef.current
    if (first) first.focus()
    // Bắt phím ở pha capture và chặn lan: Esc chỉ đóng hộp xác nhận, không đóng luôn modal bên dưới
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose(false)
      }
      if (e.key === 'Tab') {
        // Giữ focus trong hộp thoại (chỉ có hai nút)
        e.stopPropagation()
        e.preventDefault()
        const order = [cancelRef.current, okRef.current]
        const i = order.indexOf(document.activeElement)
        order[(i + (e.shiftKey ? order.length - 1 : 1)) % order.length].focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [danger, onClose])

  return (
    <div className="dialog" onClick={() => onClose(false)}>
      <div
        className="dialog-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={message ? `${id}-m` : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="dialog-title" id={`${id}-t`}>
          {title}
        </h2>
        {message && (
          <p className="dialog-message" id={`${id}-m`}>
            {message}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" ref={cancelRef} onClick={() => onClose(false)}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn btn-primary ${danger ? 'is-danger' : ''}`} ref={okRef} onClick={() => onClose(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Hộp xác nhận dùng chung, thay cho window.confirm. Trả về Promise<boolean>.
 * Ví dụ: if (!(await confirmDialog({ title: 'Xóa bài học?', message: '...', confirmLabel: 'Xóa', danger: true }))) return
 */
export function confirmDialog({ title, message = '', confirmLabel = 'Đồng ý', cancelLabel = 'Hủy', danger = false }) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement // trả focus về nút đã mở hộp thoại sau khi đóng
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    let done = false
    const close = (ok) => {
      if (done) return
      done = true
      resolve(ok)
      // Gỡ hộp thoại sau khi sự kiện hiện tại xử lý xong
      setTimeout(() => {
        root.unmount()
        host.remove()
        if (prevFocus && prevFocus.isConnected && prevFocus.focus) prevFocus.focus()
      })
    }
    root.render(<ConfirmDialog title={title} message={message} confirmLabel={confirmLabel} cancelLabel={cancelLabel} danger={danger} onClose={close} />)
  })
}
