import { ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import type { Layer } from '@deck.gl/core'
import type { DeliveryRecord } from '../types'

export interface ClusterSettings {
  opacity: number
  radius: number
}

const DEFAULTS: ClusterSettings = { opacity: 0.8, radius: 80 }

interface ClusterPoint {
  lon: number
  lat: number
  count: number
}

/**
 * Simple grid-based clustering.
 * Groups delivery points into cells and returns cluster centers with counts.
 */
function clusterPoints(data: DeliveryRecord[], cellSize: number): ClusterPoint[] {
  const grid = new Map<string, { sumLon: number; sumLat: number; count: number }>()

  for (const d of data) {
    const cellX = Math.floor(d.dlvry_lon / cellSize)
    const cellY = Math.floor(d.dlvry_lat / cellSize)
    const key = `${cellX}:${cellY}`
    const cell = grid.get(key)
    if (cell) {
      cell.sumLon += d.dlvry_lon
      cell.sumLat += d.dlvry_lat
      cell.count++
    } else {
      grid.set(key, { sumLon: d.dlvry_lon, sumLat: d.dlvry_lat, count: 1 })
    }
  }

  const clusters: ClusterPoint[] = []
  for (const cell of grid.values()) {
    clusters.push({
      lon: cell.sumLon / cell.count,
      lat: cell.sumLat / cell.count,
      count: cell.count,
    })
  }
  return clusters
}

export function createClusterLayers(
  data: DeliveryRecord[],
  settings: Partial<ClusterSettings> = {}
): Layer[] {
  const { opacity, radius } = { ...DEFAULTS, ...settings }

  // Cell size in degrees (~200m at mid-latitudes)
  const cellSize = 0.002
  const clusters = clusterPoints(data, cellSize)

  const maxCount = Math.max(...clusters.map((c) => c.count), 1)

  const circleLayer = new ScatterplotLayer<ClusterPoint>({
    id: 'cluster-circles',
    data: clusters,
    getPosition: (d) => [d.lon, d.lat],
    getRadius: (d) => radius * (0.4 + 0.6 * (d.count / maxCount)),
    getFillColor: (d) => {
      const t = d.count / maxCount
      return [66 + t * 180, 133 - t * 80, 244 - t * 150, 180]
    },
    radiusMinPixels: 10,
    radiusMaxPixels: 60,
    opacity,
    pickable: true,
  })

  const labelLayer = new TextLayer<ClusterPoint>({
    id: 'cluster-labels',
    data: clusters,
    getPosition: (d) => [d.lon, d.lat],
    getText: (d) => String(d.count),
    getSize: 12,
    getColor: [255, 255, 255, 230],
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    pickable: false,
  })

  return [circleLayer, labelLayer]
}
