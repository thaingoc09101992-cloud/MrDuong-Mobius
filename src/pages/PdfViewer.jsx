import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase.js'
import Icon from '../icons.jsx'

// pdf.js được nạp khi mở bài học đầu tiên để không làm nặng trang chính
let pdfjsPromise = null
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default
      return lib
    })
  }
  return pdfjsPromise
}

/** Xem một bài học (PDF): chuyển trang, phím mũi tên, toàn màn hình. File được tải về có xác thực từ kho riêng tư. */
export default function PdfViewer({ lesson, onClose }) {
  const wrapRef = useRef(null)
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const docRef = useRef(null)
  const taskRef = useRef(null)

  const [status, setStatus] = useState('loading') // loading | ready | error
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  // Tải và mở file PDF
  useEffect(() => {
    let alive = true
    setStatus('loading')
    ;(async () => {
      const [dl, lib] = await Promise.all([supabase.storage.from('lessons').download(lesson.file_path), loadPdfjs()])
      if (dl.error || !dl.data) throw new Error('download')
      const doc = await lib.getDocument({ data: await dl.data.arrayBuffer() }).promise
      if (!alive) {
        doc.destroy()
        return
      }
      docRef.current = doc
      setTotal(doc.numPages)
      setPage(1)
      setStatus('ready')
    })().catch(() => alive && setStatus('error'))
    return () => {
      alive = false
      if (taskRef.current) taskRef.current.cancel()
      if (docRef.current) {
        docRef.current.destroy()
        docRef.current = null
      }
    }
  }, [lesson.file_path])

  // Vẽ trang hiện tại vừa khít khung xem
  const render = useCallback(async () => {
    const doc = docRef.current
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!doc || !canvas || !stage) return
    const pdfPage = await doc.getPage(page)
    const base = pdfPage.getViewport({ scale: 1 })
    const scale = Math.min(stage.clientWidth / base.width, stage.clientHeight / base.height)
    if (!(scale > 0)) return
    const dpr = window.devicePixelRatio || 1
    const vp = pdfPage.getViewport({ scale: scale * dpr })
    canvas.width = Math.floor(vp.width)
    canvas.height = Math.floor(vp.height)
    canvas.style.width = `${vp.width / dpr}px`
    canvas.style.height = `${vp.height / dpr}px`
    if (taskRef.current) taskRef.current.cancel()
    const task = pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport: vp })
    taskRef.current = task
    try {
      await task.promise
    } catch {
      /* bị hủy vì đã chuyển trang hoặc đổi kích thước: bỏ qua */
    }
  }, [page])

  useEffect(() => {
    if (status !== 'ready') return undefined
    render()
    const stage = stageRef.current
    const ro = new ResizeObserver(() => render())
    ro.observe(stage)
    return () => ro.disconnect()
  }, [status, render, fullscreen])

  const go = useCallback(
    (delta) => setPage((p) => Math.min(Math.max(1, p + delta), Math.max(1, total))),
    [total],
  )

  // Phím tắt
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'Home') {
        setPage(1)
      } else if (e.key === 'End') {
        setPage(Math.max(1, total))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, total])

  // Lăn chuột (hoặc vuốt hai ngón trên bàn di chuột) trong khung xem để chuyển slide
  useEffect(() => {
    const stage = stageRef.current
    if (status !== 'ready' || !stage) return undefined
    let acc = 0
    let lockedUntil = 0
    function onWheel(e) {
      e.preventDefault() // không cuộn trang phía sau khi đang xem slide
      const now = Date.now()
      if (now < lockedUntil) return // chờ hết đà lăn của lần trước để không nhảy nhiều trang
      acc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      if (Math.abs(acc) < 40) return
      go(acc > 0 ? 1 : -1)
      acc = 0
      lockedUntil = now + 380
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [status, go])

  // Theo dõi chế độ toàn màn hình (kể cả khi thoát bằng phím Esc)
  useEffect(() => {
    function onChange() {
      setFullscreen(document.fullscreenElement === wrapRef.current)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  async function toggleFullscreen() {
    const node = wrapRef.current
    if (!node) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (node.requestFullscreen) await node.requestFullscreen()
      else setFullscreen((v) => !v) // trình duyệt không hỗ trợ (ví dụ iPhone): dùng chế độ phủ kín
    } catch {
      setFullscreen((v) => !v)
    }
  }

  return (
    <section className={`ls-viewer ${fullscreen ? 'ls-full' : ''}`} ref={wrapRef}>
      <div className="ls-vbar">
        <button type="button" className="ls-btn" onClick={onClose}>
          <Icon name="chevron-left" size={18} />
          <span>Danh sách</span>
        </button>
        <strong className="ls-vtitle" title={lesson.title}>{lesson.title}</strong>
        <div className="ls-pager">
          <button type="button" className="ls-btn ls-btn-icon" aria-label="Trang trước" onClick={() => go(-1)} disabled={status !== 'ready' || page <= 1}>
            <Icon name="chevron-left" size={18} />
          </button>
          <span className="ls-count" aria-live="polite">
            {status === 'ready' ? `${page} / ${total}` : '- / -'}
          </span>
          <button type="button" className="ls-btn ls-btn-icon" aria-label="Trang sau" onClick={() => go(1)} disabled={status !== 'ready' || page >= total}>
            <Icon name="chevron-right" size={18} />
          </button>
          <button
            type="button"
            className="ls-btn ls-btn-icon"
            aria-label={fullscreen ? 'Thoát toàn màn hình' : 'Xem toàn màn hình'}
            title={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            onClick={toggleFullscreen}
          >
            <Icon name={fullscreen ? 'collapse' : 'expand'} size={18} />
          </button>
        </div>
      </div>
      <div className="ls-stage" ref={stageRef} title="Lăn chuột hoặc dùng phím mũi tên để chuyển slide">
        {status === 'loading' && <p className="muted">Đang tải bài học...</p>}
        {status === 'error' && <p className="muted">Không mở được bài học. Vui lòng kiểm tra mạng và thử lại.</p>}
        <canvas ref={canvasRef} className="ls-canvas" hidden={status !== 'ready'} />
      </div>
    </section>
  )
}