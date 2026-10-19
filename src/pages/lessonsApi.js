import { supabase } from '../supabase.js'

export const LESSON_BUCKET = 'lessons'
export const LESSON_MAX_FILE = 50 * 1024 * 1024
export const LESSON_TITLE_MAX = 120

export function lessonError(error) {
  const msg = (error && error.message) || ''
  if (/khong duoc phep|chi quan tri/i.test(msg)) return 'Tài khoản không có quyền thực hiện thao tác này.'
  if (/ten bai hoc khong hop le/i.test(msg)) return `Tên bài học phải từ 1 đến ${LESSON_TITLE_MAX} ký tự.`
  if (/khong tim thay/i.test(msg)) return 'Không tìm thấy bài học (có thể đã bị xóa). Hãy tải lại trang.'
  if (/does not exist|could not find the function|PGRST202|bucket not found/i.test(msg)) {
    return 'Chức năng này chưa được kích hoạt trên máy chủ dữ liệu. Vui lòng liên hệ quản trị viên hệ thống.'
  }
  return 'Không thực hiện được. Vui lòng kiểm tra mạng và thử lại.'
}

export function formatSize(bytes) {
  if (!bytes) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * Tên hiển thị thân thiện. Tên đã lưu được ưu tiên; chỉ khi còn dạng tên file kỹ thuật (có dấu gạch dưới)
 * mới đổi gạch dưới thành khoảng trắng và "and" thành "&": AI_History_and_Evolution -> AI History & Evolution.
 */
export function displayTitle(title) {
  const raw = String(title || '').trim()
  if (!raw.includes('_')) return raw
  return raw.replace(/_+/g, ' ').replace(/\s+/g, ' ').replace(/\s(and)\s/gi, ' & ').trim()
}

/**
 * Tải file PDF lên kho riêng tư và báo tiến độ (supabase-js không có sự kiện tiến độ nên gọi trực tiếp API lưu trữ).
 * Trả về { promise, abort }. Khi hủy, promise bị từ chối bằng Error có thuộc tính aborted = true.
 */
export function uploadLessonFile(path, file, onProgress) {
  const xhr = new XMLHttpRequest()
  let cancelled = false
  const cancelError = () => Object.assign(new Error('Đã hủy tải lên.'), { aborted: true })

  const promise = (async () => {
    const { data } = await supabase.auth.getSession()
    const token = data.session && data.session.access_token
    if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    if (cancelled) throw cancelError()
    await new Promise((resolve, reject) => {
      xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${LESSON_BUCKET}/${path}`)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_ANON_KEY)
      xhr.setRequestHeader('Content-Type', 'application/pdf')
      xhr.setRequestHeader('x-upsert', 'false')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total)
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve()
        if (xhr.status === 401 || xhr.status === 403) return reject(new Error('Tài khoản không có quyền thực hiện thao tác này.'))
        if (xhr.status === 413) return reject(new Error('File quá lớn (tối đa 50 MB).'))
        return reject(new Error('Không tải lên được. Vui lòng kiểm tra mạng và thử lại.'))
      }
      xhr.onerror = () => reject(new Error('Mất kết nối khi tải lên. Vui lòng kiểm tra mạng và thử lại.'))
      xhr.onabort = () => reject(cancelError())
      xhr.send(file)
    })
  })()

  return {
    promise,
    abort: () => {
      cancelled = true
      xhr.abort()
    },
  }
}

// Chỉ nhận liên kết https của OneDrive, SharePoint, Office (khớp ràng buộc ở cơ sở dữ liệu)
const EMBED_HOSTS = /^https:\/\/(onedrive\.live\.com|1drv\.ms|[a-z0-9-]+\.sharepoint\.com|[a-z0-9-]+\.officeapps\.live\.com|[a-z0-9-]+\.office\.com)\//i

/**
 * Lấy địa chỉ nhúng từ nội dung admin dán vào: có thể là cả mã <iframe ...> hoặc chỉ là địa chỉ.
 * Trả về { url } hoặc { error } với thông báo thân thiện.
 */
export function parseEmbedInput(input) {
  const raw = String(input || '').trim()
  if (!raw) return { error: 'Hãy dán mã nhúng hoặc liên kết OneDrive.' }
  const m = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(raw)
  const url = (m ? m[1] : raw).replace(/&amp;/g, '&').trim()
  // Liên kết chia sẻ thường của 1drv.ms là trang xem, không nhúng được; địa chỉ nhúng chính thức có tham số em=
  if (/^https:\/\/1drv\.ms\//i.test(url) && !/[?&]em=/i.test(url)) {
    return { error: 'Đây là liên kết chia sẻ thường, không nhúng được. Hãy dùng chức năng Nhúng (Embed) của OneDrive và dán mã nhúng (có chứa em=2).' }
  }
  if (!EMBED_HOSTS.test(url)) {
    return { error: 'Chỉ nhận liên kết https của OneDrive, SharePoint hoặc Office. Hãy dùng chức năng Nhúng (Embed) của OneDrive.' }
  }
  if (url.length > 1500) return { error: 'Liên kết quá dài.' }
  return { url }
}

/** Thêm bài học dạng liên kết nhúng (chỉ admin). */
export async function addLessonLink(title, description, url) {
  const { error } = await supabase.rpc('app_add_lesson_link', {
    p_title: title,
    p_description: description,
    p_source_url: url,
  })
  if (error) {
    if (/lien ket khong hop le/i.test(error.message || '')) throw new Error('Liên kết không hợp lệ. Hãy dùng mã nhúng (Embed) của OneDrive.')
    throw new Error(lessonError(error))
  }
}

/** Mới đăng nhất lên đầu, cũ nhất xuống cuối (theo ngày đăng). Cùng thời điểm thì giữ thứ tự ổn định theo id. */
export function sortNewestFirst(list) {
  return [...list].sort((a, b) => {
    const diff = new Date(b.created_at) - new Date(a.created_at)
    return diff !== 0 ? diff : String(a.id).localeCompare(String(b.id))
  })
}

/** Danh sách bài học (admin và nhân viên Active đều đọc được), đã sắp xếp từ mới nhất đến cũ nhất. */
export async function listLessons() {
  const { data, error } = await supabase.rpc('app_list_lessons')
  if (error) throw error
  return sortNewestFirst(Array.isArray(data) ? data : [])
}

/** Đổi tên hiển thị (chỉ admin). Trả về tên đã lưu; ném lỗi có thông báo thân thiện khi thất bại. */
export async function renameLesson(id, title) {
  const { data, error } = await supabase.rpc('app_rename_lesson', { p_id: id, p_title: title })
  if (error) throw new Error(lessonError(error))
  return data
}