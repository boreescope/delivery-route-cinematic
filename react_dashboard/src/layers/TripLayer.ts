/**
 * TripLayer — deck.gl TripsLayer 기반 시간 경로 애니메이션
 * 별도 모드로 동작 (Route 애니메이션과 독립)
 */
import { TripsLayer } from '@deck.gl/geo-layers'
import type { Layer } from '@deck.gl/core'
import type { DeliveryRecord } from '../types'
import { getRoute } from '../utils/osrm'

export interface TripData {
  path: [number, number, number][] // [lon, lat, timestamp][]
  color: [number, number, number]
}

/**
 * 배달 레코드들로부터 TripData 배열 생성
 * 각 경로의 timestamp는 pick_up_date ~ hand_over_date 사이를 보간
 */
export async function buildTripData(records: DeliveryRecord[]): Promise<TripData[]> {
  const trips: TripData[] = []
  const colors: [number, number, number][] = [
    [253, 128, 93],
    [23, 184, 190],
    [99, 173, 242],
    [255, 204, 0],
    [168, 120, 255],
  ]

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const rt = await getRoute(r.shop_lat, r.shop_lon, r.dlvry_lat, r.dlvry_lon)
    if (!rt) continue

    // Calculate timestamps
    let startTime = 0
    let endTime = 1000 // default 1000 units
    if (r.pick_up_date && r.hand_over_date) {
      startTime = new Date(r.pick_up_date.replace(' ', 'T')).getTime() / 1000
      endTime = new Date(r.hand_over_date.replace(' ', 'T')).getTime() / 1000
    }

    const totalDist = rt.coords.length - 1
    const path: [number, number, number][] = rt.coords.map((c, idx) => {
      const t = startTime + ((endTime - startTime) * idx) / Math.max(totalDist, 1)
      return [c[1], c[0], t] // [lon, lat, timestamp]
    })

    trips.push({
      path,
      color: colors[i % colors.length],
    })
  }

  return trips
}

/**
 * TripsLayer 생성
 * @param tripData - buildTripData로 생성된 데이터
 * @param currentTime - 현재 애니메이션 시간 (timestamp)
 * @param trailLength - 트레일 길이 (초)
 */
export function createTripLayer(
  tripData: TripData[],
  currentTime: number,
  trailLength = 180
): Layer {
  return new TripsLayer<TripData>({
    id: 'trip-layer',
    data: tripData,
    getPath: (d) => d.path,
    getTimestamps: (d) => d.path.map((p) => p[2]),
    getColor: (d) => d.color,
    opacity: 0.8,
    widthMinPixels: 3,
    jointRounded: true,
    capRounded: true,
    trailLength,
    currentTime,
  })
}

/**
 * TripLayer 시간 범위 계산
 */
export function getTripTimeRange(tripData: TripData[]): [number, number] {
  if (tripData.length === 0) return [0, 1000]
  let min = Infinity
  let max = -Infinity
  for (const trip of tripData) {
    for (const p of trip.path) {
      if (p[2] < min) min = p[2]
      if (p[2] > max) max = p[2]
    }
  }
  return [min, max]
}
