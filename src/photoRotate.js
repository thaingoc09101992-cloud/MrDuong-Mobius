import { supabase } from './supabase.js'

export const nextRotation = (r) => (((r || 0) + 90) % 360)

/** Lưu góc xoay mới của ảnh điểm bán (admin xoay mọi ảnh, nhân viên chỉ ảnh của mình). Trả về lỗi nếu có. */
export async function saveRotation(outletId, rotation) {
  const { error } = await supabase.rpc('app_rotate_outlet_photo', { p_outlet: outletId, p_rotation: rotation })
  return error
}