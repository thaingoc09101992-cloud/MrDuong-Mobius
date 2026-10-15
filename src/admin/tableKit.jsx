// Thành phần dùng chung cho các bảng quản trị có sắp xếp và lọc theo cột.

export const SORT_HINT = {
  text: 'Sắp xếp A → Z / Z → A',
  date: 'Sắp xếp cũ → mới / mới → cũ',
  number: 'Sắp xếp tăng dần / giảm dần',
}

/** Nhãn cột kèm mũi tên sắp xếp: mũi tên dính liền với từ cuối nên không bao giờ rơi xuống dòng riêng. */
export function SortLabel({ label, state }) {
  const words = label.split(' ')
  const last = words.pop()
  return (
    <>
      {words.length > 0 ? `${words.join(' ')} ` : ''}
      <span className="ad-nw">
        {last}
        <span className="ad-sort-ico" aria-hidden="true">
          {state === 'asc' ? '▲' : state === 'desc' ? '▼' : '↕'}
        </span>
      </span>
    </>
  )
}

/** So sánh hai giá trị khi sắp xếp: chữ A-Z, số tăng giảm, ngày cũ/mới; ô trống luôn nằm cuối. */
export function compareValues(va, vb, dir) {
  if (va === null && vb === null) return 0
  if (va === null) return 1
  if (vb === null) return -1
  return (typeof va === 'number' ? va - vb : va.localeCompare(vb, 'vi')) * dir
}
