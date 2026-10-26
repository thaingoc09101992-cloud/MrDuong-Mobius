import { supabase } from './supabase.js'

/** Góc xoay mới sau khi xoay 90 độ: dir = 1 là xoay phải (theo chiều kim đồng hồ), dir = -1 là xoay trái. */
export const nextRotation = (r, dir = 1) => ((((r || 0) + 90 * dir) % 360) + 360) % 360

/** Lưu góc xoay mới của ảnh điểm bán (admin xoay mọi ảnh, nhân viên chỉ ảnh của mình). Trả về lỗi nếu có. */
export async function saveRotation(outletId, rotation) {
  const { error } = await supabase.rpc('app_rotate_outlet_photo', { p_outlet: outletId, p_rotation: rotation })
  return error
}