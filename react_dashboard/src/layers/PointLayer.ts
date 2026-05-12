import { ScatterplotLayer } from '@deck.gl/layers'
import type { DeliveryRecord } from '../types'
import { SHOP_COLOR, DELIVERY_COLOR } from '../utils/colors'

export function createPointLayers(data: DeliveryRecord[]) {
  const shopLayer = new ScatterplotLayer<DeliveryRecord>({
    id: 'shop-points',
    data,
    getPosition: (d) => [d.shop_lon, d.shop_lat],
    getFillColor: SHOP_COLOR,
    getRadius: 40,
    radiusMinPixels: 3,
    radiusMaxPixels: 12,
    pickable: true,
  })

  const deliveryLayer = new ScatterplotLayer<DeliveryRecord>({
    id: 'delivery-points',
    data,
    getPosition: (d) => [d.dlvry_lon, d.dlvry_lat],
    getFillColor: DELIVERY_COLOR,
    getRadius: 40,
    radiusMinPixels: 3,
    radiusMaxPixels: 12,
    pickable: true,
  })

  return [shopLayer, deliveryLayer]
}
