import { useStore } from '../store'

function DualSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  unit,
}: {
  label: string
  min: number
  max: number
  step: number
  value: [number, number]
  onChange: (v: [number, number]) => void
  unit: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span style={{ color: '#aaa', fontSize: 11, whiteSpace: 'nowrap', minWidth: 44 }}>
        {label}
      </span>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 80 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            onChange([Math.min(v, value[1]), value[1]])
          }}
          style={{ width: '100%', height: 3, accentColor: '#4285f4' }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[1]}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            onChange([value[0], Math.max(v, value[0])])
          }}
          style={{ width: '100%', height: 3, accentColor: '#4285f4' }}
        />
      </div>
      <span style={{ color: '#888', fontSize: 10, whiteSpace: 'nowrap', minWidth: 60, textAlign: 'right' }}>
        {value[0]}~{value[1]}{unit}
      </span>
    </div>
  )
}

export default function FilterPanel() {
  const filters = useStore((s) => s.filters)
  const setFilter = useStore((s) => s.setFilter)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        background: 'rgba(30,30,30,0.92)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: '10px 18px',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        gap: 20,
        alignItems: 'center',
        maxWidth: '90vw',
      }}
    >
      <DualSlider
        label="시간대"
        min={0}
        max={24}
        step={1}
        value={filters.timeRange}
        onChange={(v) => setFilter('timeRange', v)}
        unit="시"
      />
      <DualSlider
        label="소요"
        min={0}
        max={120}
        step={5}
        value={filters.durationRange}
        onChange={(v) => setFilter('durationRange', v)}
        unit="분"
      />
      <DualSlider
        label="거리"
        min={0}
        max={20}
        step={0.5}
        value={filters.distanceRange}
        onChange={(v) => setFilter('distanceRange', v)}
        unit="km"
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: '#aaa', fontSize: 11, whiteSpace: 'nowrap' }}>검색</span>
        <input
          type="text"
          placeholder="주문번호/지역"
          value={filters.regionQuery}
          onChange={(e) => setFilter('regionQuery', e.target.value)}
          style={{
            width: 90,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 4,
            color: '#eee',
            fontSize: 11,
            padding: '3px 6px',
            outline: 'none',
          }}
        />
      </div>
    </div>
  )
}
