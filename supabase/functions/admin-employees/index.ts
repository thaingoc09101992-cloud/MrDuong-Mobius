// Edge Function: admin-employees
// Cho admin tạo tài khoản nhân viên, đặt lại mật khẩu, đổi email, xóa nhân viên.
// Cần quyền service role nên không thể làm trực tiếp từ trình duyệt.
// Mật khẩu tạm được sinh ngẫu nhiên, trả về một lần cho admin, không ghi log, không lưu ở đâu khác.
import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_DOMAINS = ['thophat.vn', 'kdc.vn']
const CODE_PATTERN = /^[A-Z0-9_-]{3,20}$/
const PHONE_PATTERN = /^\+?[0-9]{9,12}$/
const ROLES = ['staff', 'manager']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function fail(message: string, status = 400) {
  return json({ error: message }, status)
}

function isCompanyEmail(email: string) {
  const m = /^[a-z0-9._%+-]+@([a-z0-9.-]+)$/i.exec(email)
  return !!m && ALLOWED_DOMAINS.includes(m[1].toLowerCase())
}

function domainHint() {
  return ALLOWED_DOMAINS.map((d) => '@' + d).join(', ')
}

function tempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const buf = new Uint32Array(12)
  crypto.getRandomValues(buf)
  let p = ''
  for (const n of buf) p += alphabet[n % alphabet.length]
  const digit = '23456789'[crypto.getRandomValues(new Uint32Array(1))[0] % 8]
  return `${p}#${digit}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail('Phương thức không hợp lệ', 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Xác thực người gọi và kiểm tra là admin
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller.user) return fail('Chưa đăng nhập', 401)
  const { data: isAdmin } = await admin.from('admins').select('user_id').eq('user_id', caller.user.id).maybeSingle()
  if (!isAdmin) return fail('Chỉ admin mới thực hiện được thao tác này', 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('Dữ liệu không hợp lệ')
  }

  const action = String(body.action || '')
  const code = String(body.code || '').trim().toUpperCase()
  if (!CODE_PATTERN.test(code)) return fail('Mã nhân viên gồm 3 đến 20 ký tự: chữ không dấu, số, gạch ngang hoặc gạch dưới.')

  const { data: existing } = await admin.from('employees').select('*').eq('code', code).maybeSingle()

  // ---------- Tạo nhân viên (hoặc cấp tài khoản cho mã cũ chưa có email) ----------
  if (action === 'create') {
    const email = String(body.email || '').trim().toLowerCase()
    if (!isCompanyEmail(email)) return fail(`Email phải thuộc tên miền công ty (${domainHint()}).`)
    const role = String(body.role || 'staff')
    if (!ROLES.includes(role)) return fail('Vai trò không hợp lệ')
    const fullName = body.full_name ? String(body.full_name).trim().slice(0, 100) || null : null
    const phone = body.phone ? String(body.phone).replace(/[\s.\-()]/g, '') : null
    if (phone && !PHONE_PATTERN.test(phone)) return fail('Số điện thoại gồm 9 đến 12 chữ số.')
    const isActive = body.is_active === undefined ? true : Boolean(body.is_active)

    if (existing && existing.user_id) return fail('Mã nhân viên này đã có tài khoản.', 409)

    const password = tempPassword()
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { employee_code: code },
    })
    if (createErr || !created.user) {
      const dup = /already|registered|exists/i.test(createErr?.message || '')
      return fail(dup ? 'Email này đã được dùng cho tài khoản khác.' : 'Không tạo được tài khoản. Vui lòng thử lại.', dup ? 409 : 500)
    }

    const row = {
      code,
      email,
      full_name: fullName,
      phone,
      role,
      is_active: isActive,
      user_id: created.user.id,
      must_change_password: true,
    }
    const { data: emp, error: dbErr } = existing
      ? await admin.from('employees').update(row).eq('code', code).select().single()
      : await admin.from('employees').insert(row).select().single()
    if (dbErr || !emp) {
      await admin.auth.admin.deleteUser(created.user.id) // hoàn tác để không để lại tài khoản mồ côi
      const dup = dbErr?.code === '23505'
      return fail(dup ? 'Email hoặc mã nhân viên đã tồn tại.' : 'Không lưu được nhân viên. Vui lòng thử lại.', dup ? 409 : 500)
    }
    return json({ employee: emp, temp_password: password })
  }

  // ---------- Xóa nhân viên ----------
  if (action === 'delete') {
    if (!existing) return fail('Không tìm thấy nhân viên.', 404)
    // Giữ nguyên dữ liệu điểm bán: nhân viên đã có điểm bán thì chỉ được chuyển sang Inactive
    const { count } = await admin.from('outlets').select('id', { count: 'exact', head: true }).eq('employee_code', code)
    if (count && count > 0) {
      return fail(`Nhân viên đã có ${count} điểm bán nên không thể xóa. Hãy chuyển sang Inactive để giữ dữ liệu.`, 409)
    }
    if (existing.user_id) {
      const { error: delUserErr } = await admin.auth.admin.deleteUser(existing.user_id)
      if (delUserErr) return fail('Không xóa được tài khoản đăng nhập. Vui lòng thử lại.', 500)
    }
    const { error: delErr } = await admin.from('employees').delete().eq('code', code)
    if (delErr) return fail('Không xóa được nhân viên. Vui lòng thử lại.', 500)
    return json({ deleted: code })
  }

  // Các thao tác sau cần nhân viên đã có tài khoản
  if (!existing || !existing.user_id) return fail('Nhân viên này chưa có tài khoản.', 404)

  // ---------- Đặt lại mật khẩu ----------
  if (action === 'reset_password') {
    const password = tempPassword()
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.user_id, { password })
    if (updErr) return fail('Không đặt lại được mật khẩu. Vui lòng thử lại.', 500)
    const { data: emp, error: dbErr } = await admin
      .from('employees')
      .update({ must_change_password: true })
      .eq('code', code)
      .select()
      .single()
    if (dbErr || !emp) return fail('Không lưu được thay đổi. Vui lòng thử lại.', 500)
    return json({ employee: emp, temp_password: password })
  }

  // ---------- Đổi email ----------
  if (action === 'change_email') {
    const email = String(body.email || '').trim().toLowerCase()
    if (!isCompanyEmail(email)) return fail(`Email phải thuộc tên miền công ty (${domainHint()}).`)
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.user_id, { email, email_confirm: true })
    if (updErr) {
      const dup = /already|registered|exists/i.test(updErr.message || '')
      return fail(dup ? 'Email này đã được dùng cho tài khoản khác.' : 'Không đổi được email. Vui lòng thử lại.', dup ? 409 : 500)
    }
    const { data: emp, error: dbErr } = await admin.from('employees').update({ email }).eq('code', code).select().single()
    if (dbErr || !emp) return fail('Không lưu được thay đổi. Vui lòng thử lại.', 500)
    return json({ employee: emp })
  }

  return fail('Thao tác không hợp lệ')
})
