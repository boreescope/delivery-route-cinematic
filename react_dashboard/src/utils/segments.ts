/**
 * 세그먼트 빌더 — delivery_viewer.html의 buildSegments, interpolateDots, offsetCoords 포팅
 */

export const BREAK_PROB = 0.02
export const MAX_LINE_LEN = 50

export interface LineSegment {
  type: 'line'
  coords: [number, number][]
}

export interface DotSegment {
  type: 'dots'
  coords: [number, number][]
}

export type Segment = LineSegment | DotSegment

/** 두 좌표 사이 거리 (미터 근사) */
export function approxDist(a: [number, number], b: [number, number]): number {
  const dlat = (b[0] - a[0]) * 111320
  const dlon = (b[1] - a[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180)
  return Math.sqrt(dlat * dlat + dlon * dlon)
}

/** 경로에 랜덤 오프셋 적용 (겹침 방지) */
export function offsetCoords(coords: [number, number][]): [number, number][] {
  const dx = (Math.random() - 0.5) * 0.0003
  const dy = (Math.random() - 0.5) * 0.0003
  return coords.map((c) => [c[0] + dy, c[1] + dx])
}

/** 두 좌표 사이를 보간하여 점 배열 생성 */
export function interpolateDots(
  from: [number, number],
  to: [number, number],
  congestion: number
): [number, number][] {
  const dist = approxDist(from, to)
  if (dist < 1) return [from]
  const baseGap = 8 + Math.random() * 12
  const gap = Math.max(2, baseGap * (1 - congestion * 0.85))
  const n = Math.max(1, Math.floor(dist / gap))
  const pts: [number, number][] = []
  for (let k = 0; k <= n; k++) {
    const t = k / n
    const jt = k === 0 || k === n ? t : t + ((Math.random() - 0.5) * 0.3) / n
    pts.push([from[0] + (to[0] - from[0]) * jt, from[1] + (to[1] - from[1]) * jt])
  }
  return pts
}

/** 세그먼트 빌더: 선 구간 + 점 구간 */
export function buildSegments(coords: [number, number][]): Segment[] {
  const segs: Segment[] = []
  let i = 0
  while (i < coords.length) {
    if (i > 0 && Math.random() < BREAK_PROB) {
      // 점 구간
      const n = 2 + Math.floor(Math.random() * 5)
      const end = Math.min(i + n, coords.length)
      const congestion = Math.random()
      const dots: [number, number][] = []
      for (let d = i; d < end - 1; d++) {
        const seg = interpolateDots(coords[d], coords[d + 1], congestion)
        if (dots.length) {
          dots.push(...seg.slice(1))
        } else {
          dots.push(...seg)
        }
      }
      if (dots.length === 0) dots.push(coords[i])
      segs.push({ type: 'dots', coords: dots })
      i = end - 1
    } else {
      // 선 구간
      const maxLen = Math.floor(5 + Math.random() * MAX_LINE_LEN)
      const end = Math.min(i + maxLen, coords.length)
      if (end - i >= 2) {
        segs.push({ type: 'line', coords: coords.slice(i, end) })
        i = end - 1
      } else {
        segs.push({ type: 'dots', coords: [coords[i]] })
        i++
      }
    }
    if (i <= 0) i = 1
  }
  return segs
}
