import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import useDotMap from '../pages/useDotMap.jsx'

export default function AdminMap({ rows }) {
  const { mapElRef, controls, legend } = useDotMap({ points: rows, isManager: true })
  // Các ô tô màu nằm trong khung bộ lọc phía trên (FilterBar chừa chỗ #ad-map-controls); undefined = chưa tìm, null = không có chỗ
  const [slot, setSlot] = useState(undefined)
  useLayoutEffect(() => {
    setSlot(document.getElementById('ad-map-controls'))
  }, [])

  return (
    <div className="ad-mapwrap">
      {slot ? createPortal(controls, slot) : slot === null && <div className="card ad-map-controls">{controls}</div>}
      <div className="map-box">
        <div className="ad-map" ref={mapElRef} />
        {legend}
      </div>
    </div>
  )
}