import { HexagonLayer } from '@deck.gl/aggregation-layers'
import type { DeliveryRecord } from '../types'

export interface HexbinSettings {
  opacity: number
  radius: number
}

const DEFAULTS: HexbinSettings = { opacity: 0.7, radius: 200 }

function getDurationMinutes(d: DeliveryRecord): number {
  if (!d.pick_up_date || !d.hand_over_date) return 0
  const diff = new Date(d.hand_over_date).getTime() - new Date(d.pick_up_date).getTime()
  return diff > 0 ? diff / 60000 : 0
}

export function createHexbinLayer(
  data: DeliveryRecord[],
  settings: Partial<HexbinSettings> = {}
) {
  const { opacity, radius } = { ...DEFAULTS, ...settings }

  return new HexagonLayer<DeliveryRecord>({
    id: 'delivery-hexbin',
    data,
    getPosition: (d) => [d.dlvry_lon, d.dlvry_lat],
    getElevationWeight: (d) => getDurationMinutes(d),
    elevationAggregation: 'MEAN',
    radius,
    elevationScale: 50,
    extruded: true,
    opacity,
    pickable: true,
    colorRange: [
      [1, 152, 189],
      [73, 227, 206],
      [216, 254, 181],
      [254, 237, 177],
      [254, 173, 84],
      [209, 55, 78],
    ],
  })
}
