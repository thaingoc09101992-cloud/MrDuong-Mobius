import { useSyncExternalStore } from 'react'
import { supabase, BUCKET } from '../supabase.js'

/**
 * Hàng đợi lưu điểm bán chạy nền: bấm Lưu là chụp tiếp được ngay, ảnh được tải lên sau.
 * Mỗi mục được giữ trong IndexedDB đến khi lưu xong, nên mất sóng hay tắt trình duyệt vẫn không mất ảnh;
 * mở lại ứng dụng sẽ tự gửi tiếp.
 *
 * state của mục: 'sending' (đang gửi), 'waiting' (lỗi mạng, tự thử lại), 'rejected' (máy chủ từ chối, cần người xử lý)
 */

const DB_NAME = 'mb-save-queue'
const STORE = 'items'
const RETRY_MS = [5000, 10000, 20000, 40000, 60000]

let all = [] // toàn bộ mục (mọi tài khoản trên máy này)
let userCode = ''
let snapshot = []
let working = false
let retryTimer = 0
let attempts = 0
const listeners = new Set()
const savedListeners = new Set()

function emit() {
  snapshot = all.filter((i) => i.userCode === userCode).map(({ id, name, state, error }) => ({ id, name, state, error }))
  listeners.forEach((fn) => fn())
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no-idb'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbRun(mode, fn) {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const out = fn(tx.objectStore(STORE))
      tx.oncomplete = () => {
        db.close()
        resolve(out && out.result)
      }
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    return undefined // không có IndexedDB: vẫn chạy được, chỉ không sống sót qua lần tải lại trang
  }
}

function isNetworkError(err) {
  const msg = String((err && err.message) || '')
  return !err || /fetch|network|timeout|failed to load|load failed/i.test(msg) || err.status === 0
}

async function sendOne(it) {
  const up = await supabase.storage.from(BUCKET).upload(it.path, it.blob, { contentType: 'image/jpeg', upsert: false })
  // Ảnh đã lên từ lần thử trước thì coi như xong bước này
  if (up.error && !/exist|duplicate/i.test(String(up.error.message || ''))) {
    return isNetworkError(up.error) ? 'waiting' : { rejected: 'Tải ảnh lên thất bại.' }
  }
  const { error } = await supabase.rpc('app_save_outlet', {
    p_name: it.name,
    p_address: it.address,
    p_channel: it.channel,
    p_lat: it.lat,
    p_lng: it.lng,
    p_accuracy: it.accuracy,
    p_photo_path: it.path,
  })
  if (!error) return 'ok'
  if (isNetworkError(error)) return 'waiting'
  const msg = String(error.message || '')
  if (msg.includes('50m')) return { rejected: 'Độ chính xác GPS vượt quá 50m. Hãy xóa điểm này và chụp lại ở nơi thoáng hơn.' }
  if (/khong duoc phep/i.test(msg)) return 'waiting' // phiên đăng nhập có thể đang được làm mới
  return { rejected: 'Máy chủ không nhận điểm này.' }
}

async function work() {
  if (working) return
  working = true
  clearTimeout(retryTimer)
  let needRetry = false
  try {
    for (;;) {
      const it = all.find((i) => i.userCode === userCode && (i.state === 'sending' || i.state === 'waiting'))
      if (!it) break
      it.state = 'sending'
      emit()
      let res
      try {
        res = await sendOne(it)
      } catch {
        res = 'waiting'
      }
      if (res === 'ok') {
        all = all.filter((i) => i.id !== it.id)
        dbRun('readwrite', (s) => s.delete(it.id))
        attempts = 0
        emit()
        savedListeners.forEach((fn) => fn(it.name))
      } else if (res === 'waiting') {
        it.state = 'waiting'
        needRetry = true
        emit()
        break // mạng đang lỗi: dừng, hẹn thử lại
      } else {
        it.state = 'rejected'
        it.error = res.rejected
        emit()
      }
    }
  } finally {
    working = false
  }
  if (needRetry) {
    const wait = RETRY_MS[Math.min(attempts, RETRY_MS.length - 1)]
    attempts += 1
    retryTimer = setTimeout(work, wait)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    attempts = 0
    work()
  })
}

/** Gọi khi đã biết tài khoản: nạp lại các mục còn dang dở từ lần trước và gửi tiếp. */
export async function resumeQueue(code) {
  userCode = code || ''
  const stored = (await dbRun('readonly', (s) => s.getAll())) || []
  const known = new Set(all.map((i) => i.id))
  stored.forEach((i) => {
    if (!known.has(i.id)) all.push({ ...i, state: 'waiting' })
  })
  emit()
  work()
}

export function enqueueSave(item) {
  const entry = { ...item, userCode, state: 'sending' }
  all.push(entry)
  dbRun('readwrite', (s) => s.put({ ...entry, state: undefined }))
  emit()
  work()
}

export function retryNow() {
  attempts = 0
  all.forEach((i) => {
    if (i.state === 'rejected') i.state = 'waiting'
  })
  emit()
  work()
}

export function discardItem(id) {
  all = all.filter((i) => i.id !== id)
  dbRun('readwrite', (s) => s.delete(id))
  emit()
}

export function onItemSaved(fn) {
  savedListeners.add(fn)
  return () => savedListeners.delete(fn)
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useSaveQueue() {
  return useSyncExternalStore(subscribe, () => snapshot)
}