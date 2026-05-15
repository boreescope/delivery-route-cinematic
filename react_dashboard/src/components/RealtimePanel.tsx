import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { Button } from '@/components/ui/button'

export default function RealtimePanel() {
  const [active, setActive] = useState(false)
  const [countdown, setCountdown] = useState(300)
  const [count, setCount] = useState(0)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const setData = useStore((s) => s.setData)
  const setRealtimeMode = useStore((s) => s.setRealtimeMode)

  const fetchData = useCallback(async () => {
    setStatus('loading')
    try {
      const resp = await fetch('http://localhost:8000/api/poll')
      if (!resp.ok) throw new Error('HTTP ' + resp.status)
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setCount(data.count)
      setLastUpdate(new Date(data.updated_at).toLocaleTimeString('ko-KR'))
      setStatus('ok')
      if (data.deliveries?.length > 0) {
        const records = data.deliveries.map((d: Record<string, unknown>) => ({
          ord_no: d.ord_no as string,
          shop_lat: d.shop_lat as number,
          shop_lon: d.shop_lon as number,
          dlvry_lat: d.dlvry_lat as number,
          dlvry_lon: d.dlvry_lon as number,
          pick_up_date: String(d.pickup_ms || ''),
          hand_over_date: String(d.completed_ms || ''),
        }))
        setData(records)
      }
    } catch {
      setStatus('error')
    }
  }, [setData])

  const start = useCallback(() => {
    setActive(true)
    setRealtimeMode(true)
    setCountdown(0)
    fetchData()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 0) {
          fetchData()
          return 300
        }
        return c - 1
      })
    }, 1000)
  }, [fetchData, setRealtimeMode])

  const stop = useCallback(() => {
    setActive(false)
    setRealtimeMode(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setStatus('idle')
  }, [setRealtimeMode])

  const mm = Math.floor(countdown / 60)
  const ss = countdown % 60
  const now = new Date()
  const delayed = new Date(now.getTime() - 5 * 60 * 1000)
  const clock = `${String(delayed.getHours()).padStart(2, '0')}:${String(delayed.getMinutes()).padStart(2, '0')}:${String(delayed.getSeconds()).padStart(2, '0')}`

  return (
    <div className="px-3 pb-3 space-y-3">
      {/* 시계 */}
      <div className="text-center">
        <div className="text-2xl font-bold text-foreground tabular-nums">{clock}</div>
        <div className="text-[10px] text-muted-foreground">
          데이터 시각 <span className="text-muted-foreground/60 ml-1">(5분 지연)</span>
        </div>
      </div>

      {/* 상태 */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            status === 'ok'
              ? 'bg-green-500 animate-pulse'
              : status === 'loading'
                ? 'bg-yellow-500'
                : status === 'error'
                  ? 'bg-red-500'
                  : 'bg-gray-400'
          }`}
        />
        <span className="text-xs text-muted-foreground">
          {status === 'ok'
            ? `${count.toLocaleString()}건`
            : status === 'loading'
              ? '로딩 중...'
              : status === 'error'
                ? '연결 실패'
                : '대기 중'}
        </span>
      </div>

      {/* 타이머 */}
      {active && (
        <div className="text-center">
          <div className="text-lg font-bold text-foreground tabular-nums">
            {mm}:{String(ss).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-muted-foreground">다음 갱신까지</div>
        </div>
      )}

      {/* 마지막 업데이트 */}
      {lastUpdate && (
        <div className="text-[10px] text-muted-foreground text-center">
          마지막 갱신: {lastUpdate}
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-2">
        {!active ? (
          <Button variant="default" size="sm" className="flex-1 text-xs h-7" onClick={start}>
            ▶ 시작
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={stop}>
              ⏹ 중지
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-xs h-7"
              onClick={() => {
                setCountdown(0)
                fetchData()
              }}
            >
              🔄 즉시
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
