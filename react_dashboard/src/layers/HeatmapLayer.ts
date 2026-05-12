import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import type { DeliveryRecord } from '../types'

export interface HeatmapSettings {
  opacity: number
  radius: number
}

const DEFAULTS: HeatmapSettings = { opacity: 0.8, radius: 30 }

export function createHeatmapLayer(
  data: DeliveryRecord[],
  settings: Partial<HeatmapSettings> = {}
) {
  const { opacity, radius } = { ...DEFAULTS, ...settings }

  return new HeatmapLayer<DeliveryRecord>({
    id: 'delivery-heatmap',
    data,
    getPosition: (d) => [d.dlvry_lon, d.dlvry_lat],
    getWeight: () => 1,
    radiusPixels: radius,
    intensity: 1.5,
    threshold: 0.05,
    opacity,
    pickable: false,
  })
}
