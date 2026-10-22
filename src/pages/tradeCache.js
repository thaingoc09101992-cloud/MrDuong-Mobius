// Bộ đệm danh sách điểm bán của Bố trận: mở lại công cụ thì hiện ngay, không tải lại hàng chục nghìn điểm.
// Hai tầng: bộ nhớ (còn khi chuyển qua lại giữa các mục trong app) và IndexedDB (còn sau khi tải lại trang).
// Mỗi bản lưu gắn với tài khoản và "phiên bản" dữ liệu (số điểm + thời điểm cập nhật); đăng xuất thì xóa.

const DB_NAME = 'mobius-cache'
const STORE = 'kv'
const KEY = 'trade-stores'

let memory = null // { owner, version, stores }

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idb(mode, fn) {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req && req.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/** Phiên bản dữ liệu: đổi khi số điểm hoặc thời điểm nhập Excel gần nhất đổi. */
export function storesVersion(count, uploadedAt) {
  return `${count}|${uploadedAt || ''}`
}

/** Bản lưu của tài khoản này (bộ nhớ trước, rồi IndexedDB), hoặc null. */
export async function readTradeCache(owner) {
  if (memory && memory.owner === owner) return memory
  try {
    const saved = await idb('readonly', (s) => s.get(KEY))
    if (saved && saved.owner === owner && Array.isArray(saved.stores)) {
      memory = saved
      return saved
    }
  } catch {
    // Trình duyệt chặn IndexedDB (chế độ ẩn danh...): coi như chưa có bản lưu
  }
  return null
}

export async function writeTradeCache(owner, version, stores) {
  memory = { owner, version, stores }
  try {
    await idb('readwrite', (s) => s.put(memory, KEY))
  } catch {
    // Không lưu được vào máy thì vẫn còn bản trong bộ nhớ
  }
}

/** Xóa bản lưu (gọi khi đăng xuất để máy dùng chung không giữ dữ liệu của người khác). */
export async function clearTradeCache() {
  memory = null
  try {
    await idb('readwrite', (s) => s.delete(KEY))
  } catch {
    // Bỏ qua: không có gì để xóa
  }
}
