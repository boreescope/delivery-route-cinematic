/**
 * 플레이바 컨트롤 — 재생/역재생/속도 조절/시크바 (하단 고정)
 * delivery_viewer.html의 playbar 포팅
 */
import { useState, useCallback } from 'react'

interface PlaybarProps {
  visible: boolean
  onSpeedChange?: (speed: number) => void
}

const SPEEDS = [0.5, 1, 2, 4]

export default function Playbar({ visible, onSpeedChange }: PlaybarProps) {
  const [playing, setPlaying] = useState(false)
  const [reversed, setReversed] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(1) // default 1x
  const [seekValue, setSeekValue] = useState(0)

  const handlePlay = useCallback(() => {
    setPlaying((p) => !p)
    setReversed(false)
  }, [])

  const handleReverse = useCallback(() => {
    setReversed((r) => !r)
    setPlaying(true)
  }, [])

  const handleReset = useCallback(() => {
    setPlaying(false)
    setReversed(false)
    setSeekValue(0)
  }, [])

  const handleSlower = useCallback(() => {
    setSpeedIdx((i) => {
      const next = Math.max(0, i - 1)
      onSpeedChange?.(SPEEDS[next])
      return next
    })
  }, [onSpeedChange])

  const handleFaster = useCallback(() => {
    setSpeedIdx((i) => {
      const next = Math.min(SPEEDS.length - 1, i + 1)
      onSpeedChange?.(SPEEDS[next])
      return next
    })
  }, [onSpeedChange])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: '#fff',
        padding: '10px 20px',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.15)',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <button
        onClick={handleReverse}
        style={btnStyle(reversed)}
        title="역재생"
      >
        ◀◀
      </button>
      <button
        onClick={handlePlay}
        style={btnStyle(playing && !reversed)}
        title="재생/정지"
      >
        {playing && !reversed ? '⏸' : '▶'}
      </button>
      <button onClick={handleReset} style={btnStyle(false)} title="처음으로">
        ⏮
      </button>
      <span
        style={{
          minWidth: 80,
          textAlign: 'center',
          fontWeight: 600,
          color: '#333',
          fontSize: 12,
        }}
      >
        {formatTime(seekValue)}
      </span>
      <input
        type="range"
        min={0}
        max={1000}
        value={seekValue}
        onChange={(e) => setSeekValue(Number(e.target.value))}
        style={{ flex: 1, height: 6, cursor: 'pointer', accentColor: '#333' }}
      />
      <span
        style={{ minWidth: 40, textAlign: 'center', fontSize: 12, color: '#666' }}
      >
        {SPEEDS[speedIdx]}x
      </span>
      <button onClick={handleSlower} style={btnStyle(false)}>
        −
      </button>
      <button onClick={handleFaster} style={btnStyle(false)}>
        +
      </button>
    </div>
  )
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? '#333' : 'none',
    color: active ? '#fff' : '#333',
    border: active ? '1px solid #333' : '1px solid #ddd',
    borderRadius: 6,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
  }
}

function formatTime(value: number): string {
  const totalSec = Math.round((value / 1000) * 3600)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
