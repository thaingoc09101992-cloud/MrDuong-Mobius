import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import { buildPopup, pinIcon } from '../pages/MapReport.jsx'

export default function AdminMap({ rows }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const clusterRef = useRef(null)

  useEffect(() => {
    const map = L.map(elRef.current).setView([10.78, 106.7], 11)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    const cluster = L.markerClusterGroup({ maxClusterRadius: 50 })
    map.addLayer(cluster)
    mapRef.current = map
    clusterRef.current = cluster
    return () => {
      map.remove()
      mapRef.current = null
      clusterRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const cluster = clusterRef.current
    if (!map || !cluster) return
    cluster.clearLayers()
    const markers = rows.map((o) => {
      const m = L.marker([o.lat, o.lng], { icon: pinIcon, title: o.name })
      m.bindPopup(() => buildPopup(o), { maxWidth: 260, minWidth: 200, autoPanPadding: [24, 24] })
      return m
    })
    cluster.addLayers(markers)
    if (rows.length > 0) map.fitBounds(cluster.getBounds().pad(0.2), { maxZoom: 17 })
  }, [rows])

  return <div className="ad-map" ref={elRef} />
}
