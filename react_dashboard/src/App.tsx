import { useState } from 'react'
import Map from './components/Map'
import FileUpload from './components/FileUpload'
import LayerPanel from './components/LayerPanel'
import FilterPanel from './components/FilterPanel'
import SettingsPanel from './components/SettingsPanel'
import QueryBuilder from './components/QueryBuilder'

function App() {
  const [showQuery, setShowQuery] = useState(false)

  return (
    <>
      <Map />
      <FileUpload />
      <LayerPanel />
      <SettingsPanel />
      <FilterPanel />

      {/* Query Builder trigger button */}
      <button
        onClick={() => setShowQuery(true)}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 11,
          background: 'rgba(30,30,30,0.9)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8,
          color: '#ccc',
          fontSize: 12,
          padding: '8px 12px',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
        title="쿼리 빌더"
      >
        🔍 SQL
      </button>

      {showQuery && <QueryBuilder onClose={() => setShowQuery(false)} />}
    </>
  )
}

export default App
