import { supabase } from './supabase.js'

/**
 * Hồ sơ của tài khoản đang đăng nhập (một trang đăng nhập duy nhất cho cả nhân viên và admin).
 * - Nhân viên Active có email: có hồ sơ nhân viên (hasEmployee = true).
 * - Tài khoản admin: isAdmin = true, có thể không phải nhân viên.
 * Trả về null nếu tài khoản không được phép dùng MOBIUS.
 */
export async function loadProfile() {
  const [me, adm] = await Promise.all([supabase.rpc('app_me'), supabase.rpc('is_admin')])
  const isAdmin = !adm.error && adm.data === true
  const employee = !me.error && me.data ? me.data : null
  if (employee) return { ...employee, isAdmin, hasEmployee: true }
  if (!isAdmin) return null
  const { data } = await supabase.auth.getSession()
  const email = (data.session && data.session.user && data.session.user.email) || ''
  return {
    code: '',
    full_name: null,
    role: 'admin',
    email,
    modules: [],
    must_change_password: false,
    isAdmin: true,
    hasEmployee: false,
  }
}
