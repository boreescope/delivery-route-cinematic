import { ArcLayer } from '@deck.gl/layers'
import type { DeliveryRecord } from '../types'
import { ARC_SOURCE_COLOR, ARC_TARGET_COLOR } from '../utils/colors'

export function createArcLayer(data: DeliveryRecord[]) {
  return new ArcLayer<DeliveryRecord>({
    id: 'delivery-arcs',
    data,
    getSourcePosition: (d) => [d.shop_lon, d.shop_lat],
    getTargetPosition: (d) => [d.dlvry_lon, d.dlvry_lat],
    getSourceColor: ARC_SOURCE_COLOR,
    getTargetColor: ARC_TARGET_COLOR,
    getWidth: 1.5,
    pickable: true,
  })
}
