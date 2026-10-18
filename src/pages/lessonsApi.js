import { supabase } from '../supabase.js'

export const LESSON_BUCKET = 'lessons'
export const LESSON_MAX_FILE = 50 * 1024 * 1024

export function lessonError(error) {
  const msg = (error && error.message) || ''
  if (/khong duoc phep|chi quan tri/i.test(msg)) return 'Tài khoản không có quyền thực hiện thao tác này.'
  if (/does not exist|could not find the function|PGRST202|bucket not found/i.test(msg)) {
    return 'Chức năng này chưa được kích hoạt trên máy chủ dữ liệu. Vui lòng liên hệ quản trị viên hệ thống.'
  }
  return 'Không thực hiện được. Vui lòng kiểm tra mạng và thử lại.'
}

export function formatSize(bytes) {
  if (!bytes) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Danh sách bài học (admin và nhân viên Active đều đọc được). */
export async function listLessons() {
  const { data, error } = await supabase.rpc('app_list_lessons')
  if (error) throw error
  return Array.isArray(data) ? data : []
}