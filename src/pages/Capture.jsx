import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, BUCKET, CHANNELS, MAX_ACCURACY_M } from '../supabase.js'

const MAX_WIDTH = 1280

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

export default function Capture({ user, onSaved }) {
  const { pos, error: gpsError, latest } = useGps()
  const [stage, setStage] = useState('camera') // camera | form
  const [shot, setShot] = useState(null) // { blob, url, gps, takenAt }
  const [camError, setCamError] = useState('')
  const [camReady, setCamReady] = useState(false)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [channel, setChannel] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [done, setDone] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCamReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCamError('')
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamError('Trình duyệt không hỗ trợ camera hoặc trang chưa chạy bằng HTTPS.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 } },
        audio: false,
      })
      streamRef.current = stream
      const v = videoRef.current
      if (v) {
        v.srcObject = stream
        await v.play().catch(() => {})
      }
      setCamReady(true)
    } catch (err) {
      setCamError(
        err && err.name === 'NotAllowedError'
          ? 'Bạn đã từ chối quyền camera. Hãy cho phép camera cho trang này trong cài đặt trình duyệt rồi tải lại.'
          : 'Không mở được camera. Hãy kiểm tra thiết bị và quyền truy cập.',
      )
    }
  }, [])

  useEffect(() => {
    if (stage === 'camera') startCamera()
    return stopCamera
  }, [stage, startCamera, stopCamera])

  useEffect(() => {
    return () => {
      if (shot && shot.url) URL.revokeObjectURL(shot.url)
    }
  }, [shot])

  const gpsOk = pos && pos.accuracy <= MAX_ACCURACY_M
  const canShoot = camReady && gpsOk

  function takePhoto() {
    const v = videoRef.current
    const gps = latest.current
    if (!v || !gps || gps.accuracy > MAX_ACCURACY_M || !v.videoWidth) return

    const scale = Math.min(1, MAX_WIDTH / v.videoWidth)
    const w = Math.round(v.videoWidth * scale)
    const h = Math.round(v.videoHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(v, 0, 0, w, h)

    const takenAt = new Date()
    const barH = Math.max(28, Math.round(h * 0.045))
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, h - barH, w, barH)
    ctx.fillStyle = '#fff'
    ctx.font = `${Math.round(barH * 0.55)}px sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(stampText(takenAt, gps), 12, h - barH / 2)

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCamError('Không tạo được ảnh. Vui lòng chụp lại.')
          return
        }
        setShot({ blob, url: URL.createObjectURL(blob), gps: { ...gps }, takenAt })
        setStage('form')
      },
      'image/jpeg',
      0.8,
    )
  }

  function retake() {
    setShot(null)
    setFormError('')
    setStage('camera')
  }

  function resetAll() {
    setShot(null)
    setName('')
    setAddress('')
    setChannel('')
    setFormError('')
    setDone(false)
    setStage('camera')
  }

  async function save(e) {
    e.preventDefault()
    if (!shot) return
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('Vui lòng nhập tên điểm bán.')
      return
    }
    setBusy(true)
    setFormError('')

    const path = `${user.code}/${crypto.randomUUID()}.jpg`
    const up = await supabase.storage
      .from(BUCKET)
      .upload(path, shot.blob, { contentType: 'image/jpeg', upsert: false })
    if (up.error) {
      setBusy(false)
      setFormError('Tải ảnh lên thất bại. Vui lòng kiểm tra mạng và thử lại.')
      return
    }

    const { error } = await supabase.rpc('app_save_outlet', {
      p_code: user.code,
      p_name: trimmed,
      p_address: address.trim() || null,
      p_channel: channel || null,
      p_lat: shot.gps.lat,
      p_lng: shot.gps.lng,
      p_accuracy: shot.gps.accuracy,
      p_photo_path: path,
    })
    setBusy(false)
    if (error) {
      setFormError(
        error.message && error.message.includes('50m')
          ? 'Độ chính xác GPS vượt quá 50m. Vui lòng chụp lại ở nơi thoáng hơn.'
          : 'Lưu thông tin thất bại. Vui lòng thử lại.',
      )
      return
    }
    setDone(true)
    onSaved()
  }

  if (done) {
    return (
      <section className="card center">
        <h2>Đã lưu điểm bán</h2>
        <p className="muted">{name.trim()}</p>
        <button type="button" className="btn btn-primary btn-block" onClick={resetAll}>
          Chụp điểm bán tiếp theo
        </button>
      </section>
    )
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
            placeholder="Số nhà, đường, phường/xã"
          />
        </label>

        <label className="field">
          <span>Loại hình / kênh</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">Chọn loại hình</option>
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
          <button type="button" className="btn btn-ghost" onClick={retake} disabled={busy}>
            Chụp lại
          </button>
          <button type="submit" className="btn btn-primary grow" disabled={busy}>
            {busy ? 'Đang lưu...' : 'Lưu điểm bán'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <section className="stack">
      <div className={`gps-chip ${gpsOk ? 'gps-ok' : 'gps-wait'}`} role="status" aria-live="polite">
        {gpsError
          ? gpsError
          : !pos
            ? 'Đang lấy định vị...'
            : gpsOk
              ? `Định vị tốt: sai số khoảng ${Math.round(pos.accuracy)}m`
              : `Định vị chưa đủ chính xác (${Math.round(pos.accuracy)}m). Cần không quá ${MAX_ACCURACY_M}m, hãy ra nơi thoáng.`}
      </div>

      <div className="camera">
        <video ref={videoRef} playsInline muted autoPlay />
        {!camReady && !camError && <div className="camera-msg">Đang mở camera...</div>}
        {camError && (
          <div className="camera-msg">
            {camError}
            <button type="button" className="btn btn-primary btn-sm" onClick={startCamera}>
              Thử lại
            </button>
          </div>
        )}
      </div>

      <button type="button" className="btn btn-primary btn-block btn-lg" onClick={takePhoto} disabled={!canShoot}>
        Chụp ảnh điểm bán
      </button>
      {!canShoot && (
        <p className="muted small center-text">
          Nút chụp sẽ mở khi camera sẵn sàng và định vị có sai số không quá {MAX_ACCURACY_M}m.
        </p>
      )}
    </section>
  )
}
