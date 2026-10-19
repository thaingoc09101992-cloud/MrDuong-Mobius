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

/** Danh sách bài học (admin và nhân viên Active đều đọc được). */
export async function listLessons() {
  const { data, error } = await supabase.rpc('app_list_lessons')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

/** Đổi tên hiển thị (chỉ admin). Trả về tên đã lưu; ném lỗi có thông báo thân thiện khi thất bại. */
export async function renameLesson(id, title) {
  const { data, error } = await supabase.rpc('app_rename_lesson', { p_id: id, p_title: title })
  if (error) throw new Error(lessonError(error))
  return data
}