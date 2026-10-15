import { createClient } from '@supabase/supabase-js'

// Client riêng cho admin: giữ phiên đăng nhập (email + mật khẩu), tách khỏi app nhân viên.
export const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'admin-auth',
    },
  },
)

const PAGE = 1000

/** Tải toàn bộ điểm bán (phân trang 1000 dòng/lần). */
export async function fetchAllOutlets() {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('outlets')
      .select('*')
      .order('captured_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

export async function fetchEmployees() {
  const { data, error } = await sb.from('employees').select('*').order('code', { ascending: true })
  if (error) throw error
  return data
}
