import { useCallback, useEffect, useRef, useState } from 'react'
import { CHANNELS, MAX_ACCURACY_M } from '../supabase.js'
import { enqueueSave, retryNow, discardItem, onItemSaved, useSaveQueue } from './saveQueue.js'
import Icon from '../icons.jsx'

// Chỉ cần đọc được chữ trên ảnh: cạnh rộng 1024px, JPEG 0.6 (~100KB/ảnh thay vì ~330KB)
const MAX_WIDTH = 1024
const JPEG_QUALITY = 0.6
const MAX_DIGITAL_ZOOM = 4 // khi máy không cho zoom bằng phần cứng thì phóng to bằng cách cắt ảnh
const MAX_HW_ZOOM = 8

/** Dòng trạng thái lưu nền trên màn camera: đang gửi, chờ mạng, bị từ chối hoặc vừa lưu xong. */
function QueueChip({ queue, justSaved }) {
  const rejected = queue.filter((i) => i.state === 'rejected')
  const waiting = queue.filter((i) => i.state === 'waiting')
  const sending = queue.filter((i) => i.state === 'sending')
  if (!queue.length && !justSaved) return null
  if (rejected.length) {
    const it = rejected[0]
    return (
      <div className="queue-chip is-bad" role="alert">
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
      <div className="queue-chip is-wait" role="status">
        <span>Chưa gửi được {waiting.length} điểm (mất mạng), sẽ tự gửi lại.</span>
        <button type="button" className="btn btn-sm" onClick={retryNow}>
          Thử lại
        </button>
      </div>
    )
  }
  if (sending.length) {
    return (
      <div className="queue-chip" role="status" aria-live="polite">
        <span>Đang lưu {sending.length} điểm...</span>
      </div>
    )
  }
  return (
    <div className="queue-chip is-ok" role="status" aria-live="polite">
      <span>Đã lưu: {justSaved}</span>
    </div>
  )
}

/** Theo dõi GPS liên tục, luôn giữ vị trí mới nhất trong ref để lấy đúng thời điểm bấm chụp. */
function useGps() {
  const [pos, setPos] = useState(null)
  const [error, setError] = useState('')
  const latest = useRef(null)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Thiết bị không hỗ trợ định vị.')
      return undefined
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const next = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          at: Date.now(),
        }
        latest.current = next
        setPos(next)
        setError('')
      },
      (err) => {
        if (err.code === 1) {
          setError('Bạn đã từ chối quyền định vị. Hãy cho phép vị trí cho trang này trong cài đặt trình duyệt rồi tải lại.')
        } else if (err.code === 2) {
          setError('Không xác định được vị trí. Hãy bật GPS và ra nơi thoáng.')
        } else {
          setError('Lấy định vị quá thời gian. Hãy bật GPS và ra nơi thoáng.')
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  return { pos, error, latest }
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function stampText(date, gps) {
  const d = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  return `${d}  |  ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}  |  +/-${Math.round(gps.accuracy)}m`
}

/**
 * Xoay ảnh gốc (chưa có dòng giờ/GPS) theo góc rotation rồi vẽ dòng giờ/GPS ở đáy ảnh,
 * để dòng chữ luôn nằm ngang dù ảnh được xoay. Trả về Blob JPEG.
 */
function renderShot(raw, rotation, gps, takenAt) {
  const quarter = rotation % 180 !== 0
  const w = quarter ? raw.height : raw.width
  const h = quarter ? raw.width : raw.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.translate(w / 2, h / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(raw, -raw.width / 2, -raw.height / 2)
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  const barH = Math.max(28, Math.round(h * 0.045))
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, h - barH, w, barH)
  ctx.fillStyle = '#fff'
  ctx.font = `${Math.round(barH * 0.55)}px sans-serif`
  ctx.textBaseline = 'middle'
  ctx.fillText(stampText(takenAt, gps), 12, h - barH / 2)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
}

export default function Capture({ user }) {
  const { pos, error: gpsError, latest } = useGps()
  const [stage, setStage] = useState('camera') // camera | form
  const [shot, setShot] = useState(null) // { blob, url, gps, takenAt }
  const [camError, setCamError] = useState('')
  const [camReady, setCamReady] = useState(false)
  const [needTap, setNeedTap] = useState(false) // trình duyệt chặn tự phát video

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [channel, setChannel] = useState('')
  const [formError, setFormError] = useState('')
  const [justSaved, setJustSaved] = useState('')
  const queue = useSaveQueue()

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const startId = useRef(0)
  const camRef = useRef(null)
  const zoomRef = useRef(1)
  const pinch = useRef({ pts: new Map(), startDist: 0, startZoom: 1 })
  const [zoom, setZoom] = useState(1)
  const [hwZoom, setHwZoom] = useState(null) // { min, max } khi camera hỗ trợ zoom phần cứng (Android); iPhone dùng zoom số
  const stopCamera = useCallback(() => {
    startId.current += 1
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCamReady(false)
    setNeedTap(false)
  }, [])

  // Gắn luồng camera vào thẻ video hiện tại và phát
  const attachStream = useCallback(async (stream) => {
    const v = videoRef.current
    if (!v) return
    v.muted = true
    v.setAttribute('playsinline', '')
    v.srcObject = stream
    try {
      await v.play()
    } catch {
      // iOS hoặc trình duyệt trong ứng dụng có thể chặn tự phát: chờ người dùng chạm
      setNeedTap(true)
    }
    setCamReady(true)
  }, [])

  const startCamera = useCallback(async () => {
    setCamError('')
    setNeedTap(false)
    zoomRef.current = 1
    setZoom(1)
    setHwZoom(null)
    const id = (startId.current += 1)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamError('Trình duyệt không hỗ trợ camera hoặc trang chưa chạy bằng HTTPS.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 } },
        audio: false,
      })
      if (id !== startId.current) {
        // Lần mở này đã bị thay thế hoặc hủy trong lúc chờ cấp quyền
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream
      const caps = stream.getVideoTracks()[0].getCapabilities ? stream.getVideoTracks()[0].getCapabilities() : {}
      if (caps.zoom && caps.zoom.max > Math.max(1, caps.zoom.min)) {
        setHwZoom({ min: Math.max(1, caps.zoom.min), max: Math.min(caps.zoom.max, MAX_HW_ZOOM) })
      }
      await attachStream(stream)
    } catch (err) {
      setCamError(
        err && err.name === 'NotAllowedError'
          ? 'Bạn đã từ chối quyền camera. Hãy cho phép camera cho trang này trong cài đặt trình duyệt rồi tải lại.'
          : 'Không mở được camera. Hãy kiểm tra thiết bị và quyền truy cập.',
      )
    }
  }, [attachStream])

  // Camera chỉ tắt khi rời trang chụp; qua màn nhập thông tin vẫn giữ luồng để chụp tiếp không phải chờ mở lại
  useEffect(() => stopCamera, [stopCamera])

  useEffect(() => {
    if (stage !== 'camera') return
    const s = streamRef.current
    if (s && s.getVideoTracks().some((t) => t.readyState === 'live')) {
      attachStream(s)
    } else {
      setCamReady(false)
      startCamera()
    }
  }, [stage, startCamera, attachStream])

  // Báo Đã lưu ngắn trên màn camera mỗi khi một điểm được gửi xong
  useEffect(() => {
    let timer = 0
    const off = onItemSaved((name) => {
      setJustSaved(name)
      clearTimeout(timer)
      timer = setTimeout(() => setJustSaved(''), 3000)
    })
    return () => {
      off()
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (shot && shot.url) URL.revokeObjectURL(shot.url)
    }
  }, [shot])

  // Camera luôn tự chạy: nếu trình duyệt chặn tự phát, lần chạm đầu tiên ở bất kỳ đâu sẽ bật lại
  useEffect(() => {
    if (stage !== 'camera') return undefined
    const play = () => {
      const v = videoRef.current
      if (v && v.srcObject && v.paused) v.play().catch(() => {})
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') play()
    }
    document.addEventListener('visibilitychange', onVisible)
    if (needTap) {
      document.addEventListener('touchstart', play, { once: true, passive: true })
      document.addEventListener('pointerdown', play, { once: true })
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('touchstart', play)
      document.removeEventListener('pointerdown', play)
    }
  }, [stage, needTap])

  function resumeVideo() {
    const v = videoRef.current
    if (!v) return
    v.play().then(() => setNeedTap(false)).catch(() => {})
  }

  // Điện thoại: khung camera kéo dài từ vị trí của nó đến sát thanh tab dưới
  useEffect(() => {
    if (stage !== 'camera') return undefined
    const fit = () => {
      const cam = camRef.current
      if (!cam) return
      const bar = document.querySelector('.tabbar')
      if (!window.matchMedia('(max-width: 900px)').matches || !bar) {
        cam.style.height = ''
        cam.style.maxHeight = ''
        cam.style.aspectRatio = ''
        return
      }
      const top = cam.getBoundingClientRect().top + window.scrollY
      cam.style.aspectRatio = 'auto'
      cam.style.maxHeight = 'none'
      cam.style.height = `${Math.max(240, Math.floor(bar.getBoundingClientRect().top - top))}px`
    }
    fit()
    const raf = requestAnimationFrame(fit)
    const timer = setTimeout(fit, 400)
    window.addEventListener('resize', fit)
    window.addEventListener('orientationchange', fit)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      window.removeEventListener('resize', fit)
      window.removeEventListener('orientationchange', fit)
    }
  }, [stage])

  const gpsOk = pos && pos.accuracy <= MAX_ACCURACY_M
  const canShoot = camReady && gpsOk

  function applyZoom(next) {
    const lo = hwZoom ? hwZoom.min : 1
    const hi = hwZoom ? hwZoom.max : MAX_DIGITAL_ZOOM
    const z = Math.min(hi, Math.max(lo, next))
    if (Math.abs(z - zoomRef.current) < 0.02) return
    zoomRef.current = z
    setZoom(z)
    if (hwZoom && streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0]
      track.applyConstraints({ advanced: [{ zoom: z }] }).catch(() => {})
    }
  }

  // Chụm hai ngón để zoom: khoảng cách hai ngón so với lúc bắt đầu chụm quyết định mức zoom
  const touchDist = () => {
    const [a, b] = [...pinch.current.pts.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  function onPinchDown(e) {
    if (e.target.closest('.shutter')) return
    pinch.current.pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current.pts.size === 2) {
      pinch.current.startDist = touchDist() || 1
      pinch.current.startZoom = zoomRef.current
    }
  }
  function onPinchMove(e) {
    if (!pinch.current.pts.has(e.pointerId)) return
    pinch.current.pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current.pts.size === 2) applyZoom(pinch.current.startZoom * (touchDist() / pinch.current.startDist))
  }
  function onPinchUp(e) {
    pinch.current.pts.delete(e.pointerId)
  }

  function takePhoto() {
    const v = videoRef.current
    const gps = latest.current
    if (!v || !gps || gps.accuracy > MAX_ACCURACY_M || !v.videoWidth) return

    // Zoom số: lấy vùng chính giữa khung hình, đúng phần người chụp đang thấy
    const z = hwZoom ? 1 : zoomRef.current
    const sw = v.videoWidth / z
    const sh = v.videoHeight / z
    const scale = Math.min(1, MAX_WIDTH / sw)
    const w = Math.round(sw * scale)
    const h = Math.round(sh * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, w, h)

    const takenAt = new Date()
    renderShot(canvas, 0, gps, takenAt).then((blob) => {
      if (!blob) {
        setCamError('Không tạo được ảnh. Vui lòng chụp lại.')
        return
      }
      setShot({ raw: canvas, rotation: 0, blob, url: URL.createObjectURL(blob), gps: { ...gps }, takenAt })
      setStage('form')
    })
  }

  // Ảnh chụp ngang bị nằm nghiêng: xoay trái (dir = -1) hoặc phải (dir = 1) 90 độ rồi dựng lại ảnh từ ảnh gốc
  async function rotateShot(dir) {
    if (!shot) return
    const rotation = (((shot.rotation + 90 * dir) % 360) + 360) % 360
    const blob = await renderShot(shot.raw, rotation, shot.gps, shot.takenAt)
    if (!blob) return
    setShot({ ...shot, rotation, blob, url: URL.createObjectURL(blob) })
  }

  function retake() {
    setShot(null)
    setFormError('')
    setStage('camera')
  }

  // Bấm Lưu: đưa vào hàng đợi chạy nền rồi mở lại camera ngay, không chờ tải ảnh
  function save(e) {
    e.preventDefault()
    if (!shot) return
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('Vui lòng nhập tên điểm bán.')
      return
    }
    enqueueSave({
      id: crypto.randomUUID(),
      path: `${user.code}/${crypto.randomUUID()}.jpg`,
      blob: shot.blob,
      name: trimmed,
      address: address.trim() || null,
      channel: channel || null,
      lat: shot.gps.lat,
      lng: shot.gps.lng,
      accuracy: shot.gps.accuracy,
    })
    setShot(null)
    setName('')
    setAddress('')
    setChannel('')
    setFormError('')
    setStage('camera')
  }
  if (stage === 'form' && shot) {
    return (
      <form className="card stack" onSubmit={save} noValidate>
        <h2>Thông tin điểm bán</h2>
        <img className="preview" src={shot.url} alt="Ảnh điểm bán vừa chụp" />
        <p className="muted small">
          Vị trí: {shot.gps.lat.toFixed(6)}, {shot.gps.lng.toFixed(6)} (sai số khoảng{' '}
          {Math.round(shot.gps.accuracy)}m)
        </p>

        <label className="field">
          <span>
            Tên điểm bán <b className="req">*</b>
          </span>
          <input
            type="text"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Tạp hóa Bà Sáu"
            autoFocus
          />
        </label>

        <label className="field">
          <span>Địa chỉ</span>
          <input
            type="text"
            value={address}
            maxLength={500}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ví dụ: 12 Lê Lợi, phường Bến Nghé"
          />
        </label>

        <label className="field">
          <span>Loại hình / kênh</span>
          <select
            className={channel ? '' : 'is-empty'}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="" disabled hidden>
              Chọn loại hình
            </option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}

        <div className="row">
          <button type="button" className="btn btn-ghost" onClick={retake}>
            Chụp lại
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => rotateShot(-1)} title="Xoay trái" aria-label="Xoay trái">
            <Icon name="rotate-left" size={20} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => rotateShot(1)} title="Xoay phải" aria-label="Xoay phải">
            <Icon name="rotate" size={20} />
          </button>
          <button type="submit" className="btn btn-primary grow">
            Lưu điểm bán
          </button>
        </div>
      </form>
    )
  }

  return (
    <section className="stack capture">
      <div
        className="camera"
        ref={camRef}
        onPointerDown={onPinchDown}
        onPointerMove={onPinchMove}
        onPointerUp={onPinchUp}
        onPointerCancel={onPinchUp}
      >
        {/* Chỉ báo khi định vị chưa dùng được (nút chụp đang khóa); định vị tốt thì không hiện gì */}
        {!gpsOk && (
          <div className="gps-chip gps-wait" role="status" aria-live="polite">
            {gpsError
              ? gpsError
              : !pos
                ? 'Đang lấy định vị...'
                : `Định vị chưa đủ chính xác (${Math.round(pos.accuracy)}m). Cần không quá ${MAX_ACCURACY_M}m, hãy ra nơi thoáng.`}
          </div>
        )}
        <QueueChip queue={queue} justSaved={justSaved} />
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          disablePictureInPicture
          controlsList="nofullscreen noremoteplayback"
          webkit-playsinline="true"
          x-webkit-airplay="deny"
          style={!hwZoom && zoom > 1 ? { transform: `scale(${zoom})` } : undefined}
          controls={false}
          onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
          onPlaying={() => setNeedTap(false)}
          onPause={() => camReady && setNeedTap(true)}
        />
        {zoom > 1.01 && <div className="camera-zoom">{zoom.toFixed(1)}x</div>}
        {!camReady && !camError && <div className="camera-msg">Đang mở camera...</div>}
        {camReady && needTap && !camError && (
          <div className="camera-msg">
            Camera đang tạm dừng
            <button type="button" className="btn btn-primary btn-sm" onClick={resumeVideo}>
              Chạm để bật camera
            </button>
          </div>
        )}
        {camError && (
          <div className="camera-msg">
            {camError}
            <button type="button" className="btn btn-primary btn-sm" onClick={startCamera}>
              Thử lại
            </button>
          </div>
        )}
        <button
          type="button"
          className="shutter"
          onClick={takePhoto}
          disabled={!canShoot}
          aria-label="Chụp ảnh điểm bán"
        >
          <Icon name="camera" size={28} />
        </button>
      </div>
    </section>
  )
}
