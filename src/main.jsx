import React, { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import './styles.css'
import App from './App.jsx'

const isAdminPath = window.location.pathname.replace(/\/+$/, '').toLowerCase().startsWith('/admin')
const AdminApp = React.lazy(() => import('./admin/AdminApp.jsx'))

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdminPath ? (
      <Suspense fallback={<div className="boot">Đang tải trang quản trị...</div>}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
