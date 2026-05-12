import { useStore, type LayerVisibility } from '../store'

const LAYER_LABELS: Record<keyof LayerVisibility, string> = {
  point: '📍 Point',
  arc: '🌈 Arc',
  heatmap: '🔥 Heatmap',
  hexbin: '⬡ Hexbin',
  cluster: '🔵 Cluster',
  route: '🛣️ Route',
  trip: '🚗 Trip',
}

export default function LayerPanel() {
  const layers = useStore((s) => s.layers)
  const toggleLayer = useStore((s) => s.toggleLayer)
  const dataCount = useStore((s) => s.data.length)

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
        minWidth: 150,
      }}
    >
      <div style={{ color: '#999', fontSize: 11, marginBottom: 8 }}>
        레이어 ({dataCount.toLocaleString()}건)
      </div>
      {(Object.keys(LAYER_LABELS) as (keyof LayerVisibility)[]).map((key) => (
        <label
          key={key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 0',
            color: layers[key] ? '#fff' : '#666',
            fontSize: 13,
            cursor: 'pointer',
            transition: 'color 0.15s',
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
      ))}
    </div>
  )
}
