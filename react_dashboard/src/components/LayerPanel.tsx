import { useState } from 'react'
import { useStore, type LayerVisibility, type LayerSettings } from '../store'

const LAYER_LABELS: Record<keyof LayerVisibility, string> = {
  point: '📍 Point',
  arc: '🌈 Arc',
  heatmap: '🔥 Heatmap',
  hexbin: '⬡ Hexbin',
  cluster: '🔵 Cluster',
  route: '🛣️ Route',
  trip: '🚗 Trip',
}

const RADIUS_LABELS: Partial<Record<keyof LayerVisibility, { label: string; min: number; max: number; step: number }>> = {
  point: { label: '크기', min: 10, max: 200, step: 10 },
  arc: { label: '두께', min: 0.5, max: 5, step: 0.5 },
  heatmap: { label: '반경(px)', min: 10, max: 80, step: 5 },
  hexbin: { label: '반경(m)', min: 50, max: 500, step: 50 },
  cluster: { label: '크기', min: 30, max: 200, step: 10 },
}

function SettingsPanel({
  layerKey,
  settings,
  onChange,
}: {
  layerKey: keyof LayerVisibility
  settings: LayerSettings
  onChange: (key: keyof LayerSettings, value: number) => void
}) {
  const radiusCfg = RADIUS_LABELS[layerKey]

  return (
    <div style={{ paddingLeft: 24, paddingBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <span style={{ color: '#aaa', fontSize: 11, width: 50 }}>투명도</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.opacity}
          onChange={(e) => onChange('opacity', parseFloat(e.target.value))}
          style={{ flex: 1, height: 4, accentColor: '#4285f4' }}
        />
        <span style={{ color: '#888', fontSize: 10, width: 28, textAlign: 'right' }}>
          {Math.round(settings.opacity * 100)}%
        </span>
      </div>
      {radiusCfg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ color: '#aaa', fontSize: 11, width: 50 }}>{radiusCfg.label}</span>
          <input
            type="range"
            min={radiusCfg.min}
            max={radiusCfg.max}
            step={radiusCfg.step}
            value={settings.radius}
            onChange={(e) => onChange('radius', parseFloat(e.target.value))}
            style={{ flex: 1, height: 4, accentColor: '#4285f4' }}
          />
          <span style={{ color: '#888', fontSize: 10, width: 28, textAlign: 'right' }}>
            {settings.radius}
          </span>
        </div>
      )}
    </div>
  )
}

export default function LayerPanel() {
  const layers = useStore((s) => s.layers)
  const layerSettings = useStore((s) => s.layerSettings)
  const toggleLayer = useStore((s) => s.toggleLayer)
  const updateLayerSetting = useStore((s) => s.updateLayerSetting)
  const dataCount = useStore((s) => s.data.length)

  const [expanded, setExpanded] = useState<keyof LayerVisibility | null>(null)

  return (
    <div
      style={{
        position: 'absolute',
        top: 70,
        left: 16,
        zIndex: 10,
        background: 'rgba(30,30,30,0.9)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '12px 14px',
        backdropFilter: 'blur(8px)',
        minWidth: 180,
      }}
    >
      <div style={{ color: '#999', fontSize: 11, marginBottom: 8 }}>
        레이어 ({dataCount.toLocaleString()}건)
      </div>
      {(Object.keys(LAYER_LABELS) as (keyof LayerVisibility)[]).map((key) => (
        <div key={key}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
                color: layers[key] ? '#fff' : '#666',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'color 0.15s',
                flex: 1,
              }}
            >
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={() => toggleLayer(key)}
                style={{ accentColor: '#4285f4' }}
              />
              {LAYER_LABELS[key]}
            </label>
            {layers[key] && (
              <button
                onClick={() => setExpanded(expanded === key ? null : key)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: expanded === key ? '#4285f4' : '#666',
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: '2px 4px',
                }}
                title="설정"
              >
                ⚙
              </button>
            )}
          </div>
          {expanded === key && layers[key] && (
            <SettingsPanel
              layerKey={key}
              settings={layerSettings[key]}
              onChange={(k, v) => updateLayerSetting(key, k, v)}
            />
          )}
        </div>
      ))}
    </div>
  )
}
