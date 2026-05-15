/**
 * RouteLayer — 실시간 배달 동선 시각화
 *
 * 로직:
 * 1. 폴링 → ord_no별 pickup_ms, completed_ms 받음
 * 2. 신규 job (이전에 없던 ord_no + pickup_ms 있음 + completed_ms 없음)
 *    → OSRM 경로 요청 → duration 기반 애니메이션 시작
 * 3. 기존 job이 완료됨 (completed_ms 생김)
 *    → 남은 경로를 실제 완료 시각에 맞게 scale
 * 4. OSRM duration 지나면 → 도착 처리
 */
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { Layer, PickingInfo } from '@deck.gl/core'
import { getRoute, type RouteResult } from '../utils/osrm'
import type { DeliveryRecord } from '../types'

const PATH_WIDTH = 3
const DOT_RADIUS = 4
const PALETTE = [
  '#4dd0e1','#81c784','#aed581','#fff176','#4fc3f7','#80deea',
  '#f48fb1','#ce93d8','#b39ddb','#9fa8da','#90caf9','#80cbc4',
  '#7986cb','#64b5f6','#4db6ac','#ff8a65','#ba68c8','#f06292',
]

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function randColor(): [number, number, number] {
  return hexToRgb(PALETTE[Math.floor(Math.random() * PALETTE.length)])
}

interface Job {
  ord_no: string
  shopLat: number
  shopLon: number
  dlvryLat: number
  dlvryLon: number
  pickupMs: number
  completedMs: number | null // null = 진행 중
  route: RouteResult | null
  osrmDurationMs: number // OSRM 예상 이동 시간
  color: [number, number, number]
  startedAt: number // 애니메이션 시작 시각 (Date.now 기준)
  // scale 전환용
  scaleAnchorProgress: number // scale 변경 시점의 progress (0~1)
  scaleAnchorTime: number // scale 변경 시점의 Date.now()
  scaledRemainingMs: number // 남은 구간에 할당된 시간
}

export class RouteAnimationEngine {
  private jobs: Map<string, Job> = new Map()
  private _onUpdate: () => void
  private _animFrame: number | null = null

  constructor(onUpdate: () => void) {
    this._onUpdate = onUpdate
  }

  reset(): void {
    this.jobs.clear()
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame)
      this._animFrame = null
    }
    this._onUpdate()
  }

  /**
   * 폴링 데이터 처리
   * records: store의 DeliveryRecord[] (pick_up_date=pickup_ms, hand_over_date=completed_ms)
   */
  async processRecords(records: DeliveryRecord[]): Promise<void> {
    const now = Date.now()
    const fiveMinAgo = now - 5 * 60 * 1000
    const incomingIds = new Set<string>()

    // 신규 job 수집
    const newJobs: { record: DeliveryRecord; pickupMs: number; completedMs: number | null }[] = []

    for (const r of records) {
      const pickupMs = Number(r.pick_up_date)
      if (!pickupMs || isNaN(pickupMs)) continue
      if (pickupMs < fiveMinAgo) continue // 5분 이전 픽업은 무시

      const completedMs = Number(r.hand_over_date) || null
      incomingIds.add(r.ord_no)

      if (this.jobs.has(r.ord_no)) {
        // 기존 job — completed 업데이트
        const job = this.jobs.get(r.ord_no)!
        if (completedMs && !job.completedMs) {
          // scale 전환: 현재 위치 고정, 남은 구간만 조정
          const now = Date.now()
          const currentProgress = this._getProgress(job, now)
          job.completedMs = completedMs
          job.scaleAnchorProgress = currentProgress
          job.scaleAnchorTime = now
          job.scaledRemainingMs = Math.max(completedMs - now, 500) // 남은 시간 (최소 0.5초)
        }
      } else {
        // 신규 job
        if (!completedMs) {
          newJobs.push({ record: r, pickupMs, completedMs })
        }
      }
    }

    // 신규 건을 pickup_ts 순 정렬 → 실제 시각 간격에 맞춰 순차 추가
    newJobs.sort((a, b) => a.pickupMs - b.pickupMs)

    if (newJobs.length > 0) {
      const baseTime = newJobs[0].pickupMs
      const timeSpan = newJobs[newJobs.length - 1].pickupMs - baseTime
      // 실제 시간 간격을 60초 안에 재생 (1분 폴링 주기에 맞춤)
      const scale = timeSpan > 0 ? Math.min(60000 / timeSpan, 1) : 1

      for (const item of newJobs) {
        const delay = (item.pickupMs - baseTime) * scale
        setTimeout(() => {
          this._addJob(item.record, item.pickupMs, item.completedMs)
        }, delay)
      }
    }

    // 애니메이션 루프 시작
    if (!this._animFrame && (this.jobs.size > 0 || newJobs.length > 0)) {
      this._startAnimLoop()
    }

    this._onUpdate()
  }

  /** 단일 job 추가 (OSRM 요청 + jobs Map에 등록) */
  private async _addJob(record: DeliveryRecord, pickupMs: number, completedMs: number | null): Promise<void> {
    const route = await getRoute(record.shop_lat, record.shop_lon, record.dlvry_lat, record.dlvry_lon)
    if (!route) return

    const job: Job = {
      ord_no: record.ord_no,
      shopLat: record.shop_lat,
      shopLon: record.shop_lon,
      dlvryLat: record.dlvry_lat,
      dlvryLon: record.dlvry_lon,
      pickupMs,
      completedMs,
      route,
      osrmDurationMs: route.duration * 1000 * 3,
      color: randColor(),
      startedAt: Date.now(),
      scaleAnchorProgress: 0,
      scaleAnchorTime: Date.now(),
      scaledRemainingMs: route.duration * 1000 * 3,
    }
    this.jobs.set(record.ord_no, job)

    if (!this._animFrame) {
      this._startAnimLoop()
    }
    this._onUpdate()
  }

  private _startAnimLoop(): void {
    const tick = () => {
      this._onUpdate()
      // 완료된 job 정리 (도착 후 30초 지나면 제거)
      const now = Date.now()
      for (const [id, job] of this.jobs) {
        const progress = this._getProgress(job, now)
        if (progress >= 1) {
          const arrivalTime = job.completedMs || (job.startedAt + job.osrmDurationMs)
          if (now - arrivalTime > 30000) {
            this.jobs.delete(id)
            this._totalCompleted++
          }
        }
      }
      if (this.jobs.size > 0) {
        this._animFrame = requestAnimationFrame(tick)
      } else {
        this._animFrame = null
      }
    }
    this._animFrame = requestAnimationFrame(tick)
  }

  private _getProgress(job: Job, now: number): number {
    if (job.scaleAnchorProgress > 0) {
      // scale 전환됨: anchor 이후 남은 구간만 진행
      const elapsedSinceAnchor = now - job.scaleAnchorTime
      const remainingProgress = 1 - job.scaleAnchorProgress
      if (job.scaledRemainingMs <= 0) return 1
      const additionalProgress = remainingProgress * (elapsedSinceAnchor / job.scaledRemainingMs)
      return Math.min(job.scaleAnchorProgress + additionalProgress, 1)
    }

    // 기본: startedAt부터 osrmDurationMs 동안 0→1
    const elapsed = now - job.startedAt
    if (job.osrmDurationMs <= 0) return 1
    return Math.min(elapsed / job.osrmDurationMs, 1)
  }

  /** deck.gl 레이어 생성 */
  createLayers(_onHover?: (info: PickingInfo) => void, _onClick?: (info: PickingInfo) => void): Layer[] {
    if (this.jobs.size === 0) return []

    const now = Date.now()
    const pathData: { path: [number, number][]; color: [number, number, number]; width: number }[] = []
    const dotData: { position: [number, number]; color: [number, number, number]; radius: number }[] = []

    for (const job of this.jobs.values()) {
      if (!job.route) continue
      const progress = this._getProgress(job, now)
      const coords = job.route.coords // [lat, lon][]
      const idx = Math.min(Math.floor(progress * (coords.length - 1)), coords.length - 1)

      // 이미 지나간 경로
      if (idx >= 1) {
        const donePath = coords.slice(0, idx + 1).map(c => [c[1], c[0]] as [number, number])
        pathData.push({ path: donePath, color: job.color, width: PATH_WIDTH })
      }

      // 현재 위치 dot
      const currentCoord = coords[idx]
      dotData.push({
        position: [currentCoord[1], currentCoord[0]],
        color: job.color,
        radius: DOT_RADIUS,
      })
    }

    const layers: Layer[] = []

    if (pathData.length > 0) {
      layers.push(new PathLayer({
        id: 'realtime-paths',
        data: pathData,
        getPath: d => d.path,
        getColor: d => [...d.color, 180] as [number, number, number, number],
        getWidth: d => d.width,
        widthUnits: 'pixels',
        widthMinPixels: 1,
        widthMaxPixels: 6,
        jointRounded: true,
        capRounded: true,
        pickable: false,
      }))
    }

    if (dotData.length > 0) {
      layers.push(new ScatterplotLayer({
        id: 'realtime-dots',
        data: dotData,
        getPosition: d => d.position,
        getFillColor: d => [...d.color, 255] as [number, number, number, number],
        getRadius: d => d.radius,
        radiusUnits: 'pixels',
        radiusMinPixels: 2,
        radiusMaxPixels: 6,
        stroked: true,
        getLineColor: [40, 40, 40, 200],
        getLineWidth: 1,
        lineWidthUnits: 'pixels',
        pickable: false,
      }))
    }

    return layers
  }

  hasData(): boolean {
    return this.jobs.size > 0
  }

  /** 디버그 정보 */
  private _totalCompleted = 0
  getDebugInfo(): { total: number; inProgress: number; completed: number; totalCompleted: number } {
    let inProgress = 0
    let completed = 0
    const now = Date.now()
    for (const job of this.jobs.values()) {
      const progress = this._getProgress(job, now)
      if (progress >= 1) completed++
      else inProgress++
    }
    return { total: this.jobs.size, inProgress, completed, totalCompleted: this._totalCompleted }
  }

  // 호환성 유지
  handleHover(_info: PickingInfo): string | null { return null }
  handleClick(_info: PickingInfo): void {}
  replayRoute(_gid: string): void {}
  speed = 1
}
