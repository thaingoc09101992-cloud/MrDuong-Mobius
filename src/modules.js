// Danh sách chức năng của nền tảng MOBIUS. Thêm chức năng mới: thêm một dòng vào MODULES
// và cập nhật ràng buộc tương ứng ở cơ sở dữ liệu (cột employees.modules).
export const PLATFORM_NAME = 'MOBIUS'

export const MODULES = [
  {
    id: 'dinh-vi-diem-ban',
    name: 'Định vị điểm bán',
    category: 'Công cụ thị trường',
    image: '/tools/dinh-vi-diem-ban.jpg', // ảnh đen trắng nền phần đầu thẻ, bỏ trống thì thẻ không có ảnh
    desc: 'Chụp ảnh, lấy định vị và ghi nhận thông tin điểm bán tại thị trường.',
    icon: 'map',
  },
  {
    id: 'bo-tran-diem-ban',
    name: 'Bố trận điểm bán',
    category: 'Công cụ thị trường',
    image: '/tools/bo-tran-diem-ban.jpg',
    desc: 'Tải danh sách điểm bán từ Excel, xem trên bản đồ và tô màu theo doanh số, đơn hàng.',
    icon: 'target',
  },
]

export const ALL_MODULE_IDS = MODULES.map((m) => m.id)

/** Nhân viên cũ chưa có cột modules được coi là dùng được mọi chức năng. */
export function modulesOf(emp) {
  return Array.isArray(emp && emp.modules) ? emp.modules : ALL_MODULE_IDS
}

export function moduleNames(ids) {
  const list = Array.isArray(ids) ? ids : ALL_MODULE_IDS
  const names = MODULES.filter((m) => list.includes(m.id)).map((m) => m.name)
  return names.length > 0 ? names.join(', ') : 'Chưa được cấp'
}
