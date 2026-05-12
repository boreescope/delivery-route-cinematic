import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Layer, PickingInfo } from '@deck.gl/core'
import { useStore } from '../store'
import { createPointLayers, createArcLayer } from '../layers'
import { parseCSV } from '../utils/csv'
import type { DeliveryRecord } from '../types'

const CARTO_DARK_MATTER =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const INITIAL_VIEW = {
  center: [126.978, 37.5665] as [number, number],
  zoom: 11,
}

interface TooltipInfo {
  x: number
  y: number
  record: DeliveryRecord
  layerType: string
}

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calcDuration(pickUp: string, handOver: string): number | null {
  if (!pickUp || !handOver) return null
  const diff = new Date(handOver).getTime() - new Date(pickUp).getTime()
  return diff > 0 ? Math.round(diff / 60000) : null
}

export default function Map() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  const data = useStore((s) => s.data)
  const layers = useStore((s) => s.layers)
  const setData = useStore((s) => s.setData)

  // Auto-load sample data on first mount
  useEffect(() => {
    if (data.length > 0) return
    fetch('/sample_data.csv')
      .then((r) => r.text())
      .then((text) => {
        const records = parseCSV(text)
        if (records.length > 0) setData(records)
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Hover handler
  const onHover = useCallback((info: PickingInfo) => {
    if (info.object) {
      const layerType = info.layer?.id?.includes('arc') ? 'arc' : 'point'
      setTooltip({ x: info.x, y: info.y, record: info.object as DeliveryRecord, layerType })
    } else {
      setTooltip(null)
    }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CARTO_DARK_MATTER,
      center: INITIAL_VIEW.center,
      zoom: INITIAL_VIEW.zoom,
    })

    const overlay = new MapboxOverlay({
      layers: [],
      getTooltip: () => null,
    })
    map.addControl(overlay as unknown as maplibregl.IControl)

    mapRef.current = map
    overlayRef.current = overlay

    return () => {
      map.remove()
      mapRef.current = null
      overlayRef.current = null
    }
  }, [])

  // Update layers when data or visibility changes
  useEffect(() => {
    if (!overlayRef.current) return

    const deckLayers: Layer[] = []

    if (layers.point && data.length > 0) {
      deckLayers.push(...createPointLayers(data))
    }
    if (layers.arc && data.length > 0) {
      deckLayers.push(createArcLayer(data))
    }

    overlayRef.current.setProps({
      layers: deckLayers,
      onHover,
    })
  }, [data, layers, onHover])

  return (
    <div ref={containerRef} style={{ width: '100vw', height: '100vh' }}>
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 12,
            top: tooltip.y + 12,
            zIndex: 20,
            background: 'rgba(20,20,20,0.92)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            padding: '8px 12px',
            color: '#eee',
            fontSize: 12,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            🛵 {tooltip.record.ord_no}
          </div>
          <div>
            거리: {calcDistance(
              tooltip.record.shop_lat,
              tooltip.record.shop_lon,
              tooltip.record.dlvry_lat,
              tooltip.record.dlvry_lon
            ).toFixed(2)} km
          </div>
          {calcDuration(tooltip.record.pick_up_date, tooltip.record.hand_over_date) !== null && (
            <div>
              소요: {calcDuration(tooltip.record.pick_up_date, tooltip.record.hand_over_date)}분
            </div>
          )}
        </div>
      )}
    </div>
  )
}
