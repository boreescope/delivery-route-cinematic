/**
 * RouteLayer — PathLayer + ScatterplotLayer + 엔드포인트 통합 렌더링
 * delivery_viewer.html의 animateRouteInternal, replayRoute, hover/click 인터랙션 포팅
 */
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { Layer, PickingInfo } from '@deck.gl/core'
import { getRoute } from '../utils/osrm'
import { buildSegments, offsetCoords } from '../utils/segments'
import type { DeliveryRecord } from '../types'

// ===== Constants =====
const SCALE = 10000 / 3600000
const PATH_WIDTH = 5
const DOT_RADIUS = 2.5
const ENDPOINT_RADIUS = 4.5
const OUTLINE_ADD = 3

// ===== Color palette =====
const PALETTE = [
  '#4dd0e1','#81c784','#aed581','#fff176','#4fc3f7','#80deea','#a5d6a7','#c5e1a5','#dce775','#fff59d',
  '#f48fb1','#ce93d8','#b39ddb','#9fa8da','#90caf9','#80cbc4','#ef9a9a','#ffcc80','#ffe082','#ffab91',
  '#7986cb','#64b5f6','#4db6ac','#ff8a65','#ba68c8','#f06292','#ffd54f','#81d4fa','#ffb74d','#e57373',
]

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function randColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}

// ===== Data types =====
interface PathDatum {
  id: string
  path: [number, number][] // [lon, lat][]
  color: [number, number, number]
  width: number
  tipText: string
  groupId: string
}

interface DotDatum {
  position: [number, number] // [lon, lat]
  color: [number, number, number]
  radius: number
  tipText: string
  groupId: string
}

interface EndpointDatum {
  position: [number, number] // [lon, lat]
  color: [number, number, number]
  radius: number
  tipText: string
  groupId: string
  label: string
}

interface RouteMeta {
  coords: [number, number][]
  color: string
  tipText: string
  durationMs: number
  _replaying?: boolean
}

// ===== Route Animation Engine =====
export class RouteAnimationEngine {
  pathData: PathDatum[] = []
  dotData: DotDatum[] = []
  endpointData: EndpointDatum[] = []
  hoveredGroupId: string | null = null
  clickedGroupId: string | null = null
  routeMetadata: Record<string, RouteMeta> = {}

  private _generationId = 0
  private _skipAnimation = false
  private _onUpdate: () => void
  private _pathIdCounter = 0
  speed = 1 // 애니메이션 속도 배율 (1x ~ 30x)

  constructor(onUpdate: () => void) {
    this._onUpdate = onUpdate
    // Tab visibility handling
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this._skipAnimation = true
          requestAnimationFrame(() => {
            this._skipAnimation = false
            this._onUpdate()
          })
        }
      })
    }
  }

  /** 새 데이터 로드 시 초기화 */
  reset(): void {
    this._generationId++
    this.pathData = []
    this.dotData = []
    this.endpointData = []
    this.hoveredGroupId = null
    this.clickedGroupId = null
    this.routeMetadata = {}
    this._pathIdCounter = 0
    this._onUpdate()
  }

  /** 전체 데이터에 대해 라우팅 + 애니메이션 시작 */
  async processRecords(records: DeliveryRecord[]): Promise<void> {
    this.reset()
    const gen = this._generationId
    const total = records.length

    // Shuffle for visual variety
    const shuffled = [...records].sort(() => Math.random() - 0.5)

    // Concurrent fetch (2 workers)
    const queue = shuffled.map((r, i) => ({ record: r, index: i }))
    const worker = async () => {
      while (queue.length > 0) {
        if (gen !== this._generationId) return
        const item = queue.shift()
        if (!item) return
        await this._fetchAndAnimate(item.record, item.index, total, gen)
      }
    }
    await Promise.all(Array(Math.min(2, total)).fill(null).map(() => worker()))
  }

  private async _fetchAndAnimate(
    record: DeliveryRecord,
    index: number,
    _total: number,
    gen: number
  ): Promise<void> {
    if (gen !== this._generationId) return

    const rt = await getRoute(record.shop_lat, record.shop_lon, record.dlvry_lat, record.dlvry_lon)
    if (!rt || gen !== this._generationId) return

    // Fix start/end to exact coords
    rt.coords[0] = [record.shop_lat, record.shop_lon]
    rt.coords[rt.coords.length - 1] = [record.dlvry_lat, record.dlvry_lon]

    // Calculate animation duration
    let animDur = 2000
    let durText = ''
    if (record.pick_up_date && record.hand_over_date) {
      const pickup = new Date(record.pick_up_date.replace(' ', 'T'))
      const handover = new Date(record.hand_over_date.replace(' ', 'T'))
      const dur = handover.getTime() - pickup.getTime()
      if (dur > 0) {
        animDur = Math.max(dur * SCALE, 300)
        const mins = Math.round(dur / 60000)
        durText = mins < 60 ? `${mins}분` : `${Math.floor(mins / 60)}시간 ${mins % 60}분`
      }
    }

    const color = randColor()
    const gid = `g${index}`
    const tip = `#${index + 1} ${Math.round(rt.dist)}m${durText ? ' / ' + durText : ''}`

    await this._animateRoute(rt.coords, color, animDur, gid, tip, gen)
  }

  /** 경로 리플레이 (클릭 시) */
  replayRoute(gid: string): void {
    const meta = this.routeMetadata[gid]
    if (!meta || meta._replaying) return
    meta._replaying = true

    // 기존 데이터 제거
    this.pathData = this.pathData.filter((d) => d.groupId !== gid)
    this.dotData = this.dotData.filter((d) => d.groupId !== gid)
    this.endpointData = this.endpointData.filter((d) => d.groupId !== gid)

    const { coords, color, tipText, durationMs } = meta
    this._animateRoute(coords, color, durationMs, gid, tipText, this._generationId).then(() => {
      meta._replaying = false
    })
  }

  /** 핵심 애니메이션 로직 — animateRouteInternal 포팅 */
  private _animateRoute(
    origCoords: [number, number][],
    colorHex: string,
    durationMs: number,
    gid: string,
    tipText: string,
    gen: number
  ): Promise<void> {
    const coords = offsetCoords(origCoords)
    const rgb = hexToRgb(colorHex)
    const segs = buildSegments(coords)
    const totalPts = segs.reduce((s, seg) => s + seg.coords.length, 0)

    // 메타데이터 저장
    this.routeMetadata[gid] = { coords: origCoords, color: colorHex, tipText, durationMs }

    // 시작점 추가
    this.endpointData = [
      ...this.endpointData,
      {
        position: [coords[0][1], coords[0][0]],
        color: rgb,
        radius: ENDPOINT_RADIUS,
        tipText,
        groupId: gid,
        label: '가게',
      },
    ]
    this._onUpdate()

    return new Promise<void>((resolve) => {
      let segIdx = 0

      const drawNext = () => {
        if (gen !== this._generationId) return resolve()
        if (segIdx >= segs.length) {
          // 끝점 추가
          const ec = coords[coords.length - 1]
          this.endpointData = [
            ...this.endpointData,
            {
              position: [ec[1], ec[0]],
              color: rgb,
              radius: ENDPOINT_RADIUS,
              tipText,
              groupId: gid,
              label: '배달지',
            },
          ]
          this._onUpdate()
          return resolve()
        }

        const seg = segs[segIdx]
        segIdx++

        if (seg.type === 'line') {
          const pathId = `${gid}_p${this._pathIdCounter++}`
          const fullPath: [number, number][] = seg.coords.map((c) => [c[1], c[0]])
          let di = 2

          const pathObj: PathDatum = {
            id: pathId,
            path: fullPath.slice(0, di),
            color: rgb,
            width: PATH_WIDTH,
            tipText,
            groupId: gid,
          }
          this.pathData = [...this.pathData, pathObj]

          const segDur = Math.max(durationMs * (seg.coords.length / totalPts) / this.speed, 50)
          const sStart = performance.now()

          const stepLine = (now: number) => {
            if (gen !== this._generationId) return resolve()
            if (this._skipAnimation) {
              pathObj.path = fullPath
              this.pathData = [...this.pathData]
              this._onUpdate()
              drawNext()
              return
            }
            const t = Math.min((now - sStart) / segDur, 1)
            const target = Math.min(Math.floor(t * (fullPath.length - 1)) + 1, fullPath.length)
            if (target > di) {
              di = target
              pathObj.path = fullPath.slice(0, di)
              this.pathData = [...this.pathData]
              this._onUpdate()
            }
            if (t < 1) {
              requestAnimationFrame(stepLine)
            } else {
              pathObj.path = fullPath
              this.pathData = [...this.pathData]
              this._onUpdate()
              drawNext()
            }
          }
          requestAnimationFrame(stepLine)
        } else {
          // 도트 구간
          let di = 0
          const segDur = Math.max(durationMs * (seg.coords.length / totalPts) * 1.5 / this.speed, 50)
          const sStart = performance.now()

          const stepDots = (now: number) => {
            if (gen !== this._generationId) return resolve()
            if (this._skipAnimation) {
              const newDots: DotDatum[] = []
              while (di < seg.coords.length) {
                newDots.push({
                  position: [seg.coords[di][1], seg.coords[di][0]],
                  color: rgb,
                  radius: DOT_RADIUS,
                  tipText,
                  groupId: gid,
                })
                di++
              }
              this.dotData = [...this.dotData, ...newDots]
              this._onUpdate()
              drawNext()
              return
            }
            const t = Math.min((now - sStart) / segDur, 1)
            const target = Math.floor(t * (seg.coords.length - 1))
            const newDots: DotDatum[] = []
            while (di <= target && di < seg.coords.length) {
              newDots.push({
                position: [seg.coords[di][1], seg.coords[di][0]],
                color: rgb,
                radius: DOT_RADIUS,
                tipText,
                groupId: gid,
              })
              di++
            }
            if (newDots.length > 0) {
              this.dotData = [...this.dotData, ...newDots]
              this._onUpdate()
            }
            if (t < 1) {
              requestAnimationFrame(stepDots)
            } else {
              const remaining: DotDatum[] = []
              while (di < seg.coords.length) {
                remaining.push({
                  position: [seg.coords[di][1], seg.coords[di][0]],
                  color: rgb,
                  radius: DOT_RADIUS,
                  tipText,
                  groupId: gid,
                })
                di++
              }
              if (remaining.length > 0) {
                this.dotData = [...this.dotData, ...remaining]
                this._onUpdate()
              }
              drawNext()
            }
          }
          requestAnimationFrame(stepDots)
        }
      }
      drawNext()
    })
  }

  /** deck.gl 레이어 배열 생성 */
  createLayers(onHover?: (info: PickingInfo) => void, onClick?: (info: PickingInfo) => void): Layer[] {
    const layers: Layer[] = []
    const hl = this.hoveredGroupId || this.clickedGroupId

    if (this.pathData.length > 0) {
      // Outline layer
      layers.push(
        new PathLayer<PathDatum>({
          id: 'route-outline',
          data: this.pathData,
          getPath: (d) => d.path,
          getColor: (d) => {
            if (hl && d.groupId === hl) return [255, 255, 255, 255]
            if (hl) return [85, 85, 85, 140]
            return [85, 85, 85, 255]
          },
          getWidth: (d) => {
            if (hl && d.groupId === hl) return (d.width * 2 + OUTLINE_ADD + 2)
            return d.width + OUTLINE_ADD
          },
          widthUnits: 'pixels',
          widthMinPixels: 1,
          widthMaxPixels: 40,
          jointRounded: true,
          capRounded: true,
          pickable: false,
          updateTriggers: {
            getColor: [hl],
            getWidth: [hl],
          },
        })
      )
      // Main path layer
      layers.push(
        new PathLayer<PathDatum>({
          id: 'route-path',
          data: this.pathData,
          getPath: (d) => d.path,
          getColor: (d) => {
            if (hl && d.groupId === hl) return [...d.color, 255] as [number, number, number, number]
            if (hl) return [...d.color, 160] as [number, number, number, number]
            return [...d.color, 255] as [number, number, number, number]
          },
          getWidth: (d) => {
            if (hl && d.groupId === hl) return d.width * 2
            return d.width
          },
          widthUnits: 'pixels',
          widthMinPixels: 1,
          widthMaxPixels: 30,
          jointRounded: true,
          capRounded: true,
          pickable: true,
          autoHighlight: false,
          onHover,
          onClick,
          updateTriggers: {
            getColor: [hl],
            getWidth: [hl],
          },
        })
      )
    }

    if (this.dotData.length > 0) {
      layers.push(
        new ScatterplotLayer<DotDatum>({
          id: 'route-dots',
          data: this.dotData,
          getPosition: (d) => d.position,
          getFillColor: (d) => {
            if (hl && d.groupId === hl) return [...d.color, 255] as [number, number, number, number]
            if (hl) return [...d.color, 160] as [number, number, number, number]
            return [...d.color, 255] as [number, number, number, number]
          },
          getRadius: (d) => {
            if (hl && d.groupId === hl) return d.radius * 1.5
            return d.radius
          },
          radiusUnits: 'pixels',
          radiusMinPixels: 1,
          radiusMaxPixels: 20,
          pickable: true,
          autoHighlight: false,
          stroked: true,
          getLineColor: [85, 85, 85, 255],
          getLineWidth: 1.5,
          lineWidthUnits: 'pixels',
          onHover,
          onClick,
          updateTriggers: {
            getFillColor: [hl],
            getRadius: [hl],
          },
        })
      )
    }

    if (this.endpointData.length > 0) {
      layers.push(
        new ScatterplotLayer<EndpointDatum>({
          id: 'route-endpoints',
          data: this.endpointData,
          getPosition: (d) => d.position,
          getFillColor: (d) => {
            if (hl && d.groupId === hl) return [...d.color, 255] as [number, number, number, number]
            if (hl) return [...d.color, 160] as [number, number, number, number]
            return [...d.color, 255] as [number, number, number, number]
          },
          getRadius: (d) => {
            if (hl && d.groupId === hl) return d.radius * 1.8
            return d.radius
          },
          radiusUnits: 'pixels',
          radiusMinPixels: 1,
          radiusMaxPixels: 24,
          pickable: true,
          autoHighlight: false,
          stroked: true,
          getLineColor: (d) => {
            if (hl && d.groupId === hl) return [255, 255, 255, 255]
            return [85, 85, 85, 255]
          },
          getLineWidth: (d) => {
            if (hl && d.groupId === hl) return 3
            return 1.5
          },
          lineWidthUnits: 'pixels',
          onHover,
          onClick,
          updateTriggers: {
            getFillColor: [hl],
            getRadius: [hl],
            getLineColor: [hl],
            getLineWidth: [hl],
          },
        })
      )
    }

    return layers
  }

  /** 호버 처리 */
  handleHover(info: PickingInfo): string | null {
    if (info.object && 'groupId' in info.object) {
      this.hoveredGroupId = (info.object as { groupId: string }).groupId
    } else {
      this.hoveredGroupId = null
    }
    return this.hoveredGroupId
  }

  /** 클릭 처리 */
  handleClick(info: PickingInfo): void {
    if (info.object && 'groupId' in info.object) {
      const gid = (info.object as { groupId: string }).groupId
      this.clickedGroupId = gid
      this.replayRoute(gid)
    } else {
      this.clickedGroupId = null
    }
  }

  /** 데이터 존재 여부 */
  hasData(): boolean {
    return this.pathData.length > 0 || this.dotData.length > 0 || this.endpointData.length > 0
  }
}
