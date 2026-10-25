import useDotMap from '../pages/useDotMap.jsx'

export default function AdminMap({ rows }) {
  const { mapElRef, controls, legend } = useDotMap({ points: rows, isManager: true })

  return (
    <div className="ad-mapwrap">
      <div className="card ad-map-controls">{controls}</div>
      <div className="map-box">
        <div className="ad-map" ref={mapElRef} />
        {legend}
      </div>
    </div>
  )
}