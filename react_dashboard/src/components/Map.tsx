import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Layer, PickingInfo } from '@deck.gl/core'
import { useStore } from '../store'
import {
  createPointLayers,
  createArcLayer,
  createHeatmapLayer,
  createHexbinLayer,
  createClusterLayers,
  RouteAnimationEngine,
  createTripLayer,
  buildTripData,
  getTripTimeRange,
} from '../layers'
import type { TripData } from '../layers'
import { parseCSV } from '../utils/csv'
import type { DeliveryRecord } from '../types'
import Playbar from './Playbar'

const CARTO_DARK_MATTER =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const INITIAL_VIEW = {
  center: [126.978, 37.5665] as [number, number],
  zoom: 11,
}

interface TooltipInfo {
  x: number
  y: number
  text: string
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
  const routeEngineRef = useRef<RouteAnimationEngine | null>(null)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const [routeRevision, setRouteRevision] = useState(0)

  // Trip layer state
  const [tripData, setTripData] = useState<TripData[]>([])
  const [tripTime, setTripTime] = useState(0)
  const tripAnimRef = useRef<number | null>(null)

  const data = useStore((s) => s.data)
  const layers = useStore((s) => s.layers)
  const layerSettings = useStore((s) => s.layerSettings)
  const setData = useStore((s) => s.setData)

  // Initialize route engine
  useEffect(() => {
    routeEngineRef.current = new RouteAnimationEngine(() => {
      setRouteRevision((r) => r + 1)
    })
  }, [])

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

  // Route layer: process records when toggled on
  useEffect(() => {
    if (!routeEngineRef.current) return
    if (layers.route && data.length > 0) {
      routeEngineRef.current.processRecords(data)
    } else {
      routeEngineRef.current.reset()
    }
  }, [layers.route, data])

  // Trip layer: build data when toggled on
  useEffect(() => {
    if (layers.trip && data.length > 0) {
      // Limit to first 50 records for performance
      const subset = data.slice(0, 50)
      buildTripData(subset).then((td) => {
        setTripData(td)
      })
    } else {
      setTripData([])
      if (tripAnimRef.current) {
        cancelAnimationFrame(tripAnimRef.current)
        tripAnimRef.current = null
      }
    }
  }, [layers.trip, data])

  // Trip animation loop
  useEffect(() => {
    if (tripData.length === 0) return
    const [minT, maxT] = getTripTimeRange(tripData)
    const duration = 30000 // 30 seconds loop
    const startMs = performance.now()

    const animate = () => {
      const elapsed = performance.now() - startMs
      const progress = (elapsed % duration) / duration
      const currentTime = minT + progress * (maxT - minT)
      setTripTime(currentTime)
      tripAnimRef.current = requestAnimationFrame(animate)
    }
    tripAnimRef.current = requestAnimationFrame(animate)

    return () => {
      if (tripAnimRef.current) {
        cancelAnimationFrame(tripAnimRef.current)
        tripAnimRef.current = null
      }
    }
  }, [tripData])

  // Route hover/click handlers
  const onRouteHover = useCallback((info: PickingInfo) => {
    if (!routeEngineRef.current) return
    const gid = routeEngineRef.current.handleHover(info)
    if (gid && info.object && 'tipText' in info.object) {
      const obj = info.object as { tipText: string; label?: string }
      setTooltip({
        x: info.x,
        y: info.y,
        text: obj.tipText + (obj.label ? ' ' + obj.label : ''),
      })
    } else {
      setTooltip(null)
    }
    setRouteRevision((r) => r + 1)
  }, [])

  const onRouteClick = useCallback((info: PickingInfo) => {
    if (!routeEngineRef.current) return
    routeEngineRef.current.handleClick(info)
    setRouteRevision((r) => r + 1)
  }, [])

  // Standard layer hover
  const onHover = useCallback((info: PickingInfo) => {
    if (info.object) {
      const record = info.object as DeliveryRecord
      const dist = calcDistance(record.shop_lat, record.shop_lon, record.dlvry_lat, record.dlvry_lon)
      const dur = calcDuration(record.pick_up_date, record.hand_over_date)
      setTooltip({
        x: info.x,
        y: info.y,
        text: `🛵 ${record.ord_no} | ${dist.toFixed(2)}km${dur ? ` | ${dur}분` : ''}`,
      })
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
    if (layers.heatmap && data.length > 0) {
      deckLayers.push(createHeatmapLayer(data, layerSettings.heatmap))
    }
    if (layers.hexbin && data.length > 0) {
      deckLayers.push(createHexbinLayer(data, layerSettings.hexbin))
    }
    if (layers.cluster && data.length > 0) {
      deckLayers.push(...createClusterLayers(data, layerSettings.cluster))
    }

    // Route layers
    if (layers.route && routeEngineRef.current) {
      deckLayers.push(...routeEngineRef.current.createLayers(onRouteHover, onRouteClick))
    }

    // Trip layer
    if (layers.trip && tripData.length > 0) {
      deckLayers.push(createTripLayer(tripData, tripTime))
    }

    overlayRef.current.setProps({
      layers: deckLayers,
      onHover: layers.route ? undefined : onHover,
    })
  }, [data, layers, layerSettings, onHover, onRouteHover, onRouteClick, routeRevision, tripData, tripTime])

  const showPlaybar = layers.route && routeEngineRef.current?.hasData()

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
          {tooltip.text}
        </div>
      )}
      <Playbar visible={!!showPlaybar} />
    </div>
  )
}
