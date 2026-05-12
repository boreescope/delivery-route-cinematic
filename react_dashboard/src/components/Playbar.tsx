/**
 * 플레이바 컨트롤 — 재생/역재생/속도 조절/시크바 (하단 고정)
 */
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

interface PlaybarProps {
  visible: boolean
  onSpeedChange?: (speed: number) => void
}

const SPEEDS = [0.5, 1, 2, 4]

export default function Playbar({ visible, onSpeedChange }: PlaybarProps) {
  const [playing, setPlaying] = useState(false)
  const [reversed, setReversed] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(1)
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
    <div className="fixed bottom-0 left-0 right-0 z-[1000] bg-card/95 backdrop-blur-md border-t border-border px-5 py-2.5 flex items-center gap-3">
      <Button
        variant={reversed ? 'default' : 'outline'}
        size="sm"
        className="h-7 w-7 p-0 text-xs"
        onClick={handleReverse}
        title="역재생"
      >
        ◀◀
      </Button>
      <Button
        variant={playing && !reversed ? 'default' : 'outline'}
        size="sm"
        className="h-7 w-7 p-0 text-xs"
        onClick={handlePlay}
        title="재생/정지"
      >
        {playing && !reversed ? '⏸' : '▶'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-7 p-0 text-xs"
        onClick={handleReset}
        title="처음으로"
      >
        ⏮
      </Button>

      <span className="min-w-[60px] text-center text-xs font-medium text-foreground">
        {formatTime(seekValue)}
      </span>

      <Slider
        min={0}
        max={1000}
        step={1}
        value={[seekValue]}
        onValueChange={([v]) => setSeekValue(v)}
        className="flex-1"
      />

      <span className="min-w-[36px] text-center text-xs text-muted-foreground">
        {SPEEDS[speedIdx]}x
      </span>

      <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs" onClick={handleSlower}>
        −
      </Button>
      <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs" onClick={handleFaster}>
        +
      </Button>
    </div>
  )
}

function formatTime(value: number): string {
  const totalSec = Math.round((value / 1000) * 3600)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
