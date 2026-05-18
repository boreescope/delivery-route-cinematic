import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../store'
import { Button } from '@/components/ui/button'

// 모듈 레벨 타이머 (컴포넌트 언마운트에 영향 안 받음)
let _pollInterval: ReturnType<typeof setInterval> | null = null
let _countdown = 60
let _fetchFn: (() => void) | null = null
let _lastCount = 0
let _lastUpdate: string | null = null
let _lastStatus: 'idle' | 'loading' | 'ok' | 'error' = 'idle'

function startGlobalTimer(fetchFn: () => void) {
  _fetchFn = fetchFn
  _countdown = 0 // 즉시 첫 fetch
  if (_pollInterval) clearInterval(_pollInterval)
  _pollInterval = setInterval(() => {
    _countdown--
    if (_countdown <= 0) {
      _countdown = 60
      _fetchFn?.()
    }
  }, 1000)
  fetchFn() // 즉시 실행
}

function stopGlobalTimer() {
  if (_pollInterval) {
    clearInterval(_pollInterval)
    _pollInterval = null
  }
  _fetchFn = null
}

export default function RealtimePanel() {
  const [count, setCount] = useState(_lastCount)
  const [lastUpdate, setLastUpdate] = useState<string | null>(_lastUpdate)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>(_lastStatus)
  const [displayCountdown, setDisplayCountdown] = useState(300)
  const setData = useStore((s) => s.setData)
  const setRealtimeMode = useStore((s) => s.setRealtimeMode)
  const realtimeRunning = useStore((s) => s.realtimeRunning)
  const setRealtimeRunning = useStore((s) => s.setRealtimeRunning)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    setStatus('loading')
    _lastStatus = 'loading'
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 90000)
      const resp = await fetch('/api/poll', { signal: controller.signal })
      clearTimeout(timeout)
      if (!resp.ok) throw new Error('HTTP ' + resp.status)
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setCount(data.count)
      _lastCount = data.count
      setLastUpdate(new Date(data.updated_at).toLocaleTimeString('ko-KR'))
      _lastUpdate = new Date(data.updated_at).toLocaleTimeString('ko-KR')
      setStatus('ok')
      _lastStatus = 'ok'
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
      _lastStatus = 'error'
    }
  }, [setData])

  const start = useCallback(() => {
    setRealtimeRunning(true)
    setRealtimeMode(true)
    startGlobalTimer(fetchData)
  }, [fetchData, setRealtimeMode, setRealtimeRunning])

  const stop = useCallback(() => {
    setRealtimeRunning(false)
    setRealtimeMode(false)
    stopGlobalTimer()
    setStatus('idle')
  }, [setRealtimeMode, setRealtimeRunning])

  // UI 카운트다운 표시 업데이트 (1초마다)
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setDisplayCountdown(_countdown)
    }, 1000)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  // 컴포넌트 마운트 시 이미 실행 중이면 fetchFn 재연결
  useEffect(() => {
    if (realtimeRunning && !_pollInterval) {
      startGlobalTimer(fetchData)
    }
  }, [realtimeRunning, fetchData])

  const mm = Math.floor(displayCountdown / 60)
  const ss = displayCountdown % 60
  const now = new Date()
  const delayed = new Date(now.getTime() - 1 * 60 * 1000)
  const clock = `${String(delayed.getHours()).padStart(2, '0')}:${String(delayed.getMinutes()).padStart(2, '0')}:${String(delayed.getSeconds()).padStart(2, '0')}`

  return (
    <div className="px-3 pb-3 space-y-3">
      {/* 시계 */}
      <div className="text-center">
        <div className="text-2xl font-bold text-foreground tabular-nums">{clock}</div>
        <div className="text-[10px] text-muted-foreground">
          데이터 시각 <span className="text-muted-foreground/60 ml-1">(~1분 지연)</span>
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
      {realtimeRunning && (
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
        {!realtimeRunning ? (
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
                _countdown = 0
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
