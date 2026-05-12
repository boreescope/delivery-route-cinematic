import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Layer, PickingInfo } from '@deck.gl/core'
import { useStore, MAP_THEME_URLS } from '../store'
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

const INITIAL_VIEW = {
  center: [126.978, 37.5665] as [number, number],
  zoom: 11,
  pitch: 0,
  bearing: 0,
}

const VIEW_PRESETS = [
  { label: '🗺️', title: '탑뷰', pitch: 0, bearing: 0 },
  { label: '📐', title: '틸트', pitch: 45, bearing: -20 },
  { label: '🦅', title: '버드아이', pitch: 60, bearing: -45 },
] as const

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

function getHour(dateStr: string): number {
  if (!dateStr) return -1
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? -1 : d.getHours()
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
  const filters = useStore((s) => s.filters)
  const theme = useStore((s) => s.theme)
  const setData = useStore((s) => s.setData)

  // Filter data based on store filters
  const filteredData = useMemo(() => {
    if (data.length === 0) return data
    return data.filter((r) => {
      // Time range filter
      const hour = getHour(r.pick_up_date)
      if (hour >= 0) {
        if (hour < filters.timeRange[0] || hour >= filters.timeRange[1]) return false
      }

      // Duration filter
      const dur = calcDuration(r.pick_up_date, r.hand_over_date)
      if (dur !== null) {
        if (dur < filters.durationRange[0] || dur > filters.durationRange[1]) return false
      }

      // Distance filter
      const dist = calcDistance(r.shop_lat, r.shop_lon, r.dlvry_lat, r.dlvry_lon)
      if (dist < filters.distanceRange[0] || dist > filters.distanceRange[1]) return false

      // Region/text search filter
      if (filters.regionQuery) {
        const q = filters.regionQuery.toLowerCase()
        if (!r.ord_no.toLowerCase().includes(q)) return false
      }

      return true
    })
  }, [data, filters])

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
    if (layers.route && filteredData.length > 0) {
      routeEngineRef.current.processRecords(filteredData)
    } else {
      routeEngineRef.current.reset()
    }
  }, [layers.route, filteredData])

  // Trip layer: build data when toggled on
  useEffect(() => {
    if (layers.trip && filteredData.length > 0) {
      const subset = filteredData.slice(0, 50)
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
  }, [layers.trip, filteredData])

  // Trip animation loop
  useEffect(() => {
    if (tripData.length === 0) return
    const [minT, maxT] = getTripTimeRange(tripData)
    const duration = 30000
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
      style: MAP_THEME_URLS[theme],
      center: INITIAL_VIEW.center,
      zoom: INITIAL_VIEW.zoom,
      pitch: INITIAL_VIEW.pitch,
      bearing: INITIAL_VIEW.bearing,
      pitchWithRotate: true,
      dragRotate: true,
      touchPitch: true,
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update map style when theme changes
  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.setStyle(MAP_THEME_URLS[theme])
  }, [theme])

  // Update layers when data or visibility changes
  useEffect(() => {
    if (!overlayRef.current) return

    const deckLayers: Layer[] = []

    if (layers.point && filteredData.length > 0) {
      deckLayers.push(...createPointLayers(filteredData))
    }
    if (layers.arc && filteredData.length > 0) {
      deckLayers.push(createArcLayer(filteredData))
    }
    if (layers.heatmap && filteredData.length > 0) {
      deckLayers.push(createHeatmapLayer(filteredData, layerSettings.heatmap))
    }
    if (layers.hexbin && filteredData.length > 0) {
      deckLayers.push(createHexbinLayer(filteredData, layerSettings.hexbin))
    }
    if (layers.cluster && filteredData.length > 0) {
      deckLayers.push(...createClusterLayers(filteredData, layerSettings.cluster))
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
  }, [filteredData, layers, layerSettings, onHover, onRouteHover, onRouteClick, routeRevision, tripData, tripTime])

  const showPlaybar = layers.route && routeEngineRef.current?.hasData()

  const flyToPreset = useCallback((pitch: number, bearing: number) => {
    if (!mapRef.current) return
    mapRef.current.flyTo({
      pitch,
      bearing,
      duration: 1200,
    })
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
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

      {/* View Preset Buttons */}
      <div
        style={{
          position: 'absolute',
          bottom: showPlaybar ? 72 : 16,
          right: 16,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {VIEW_PRESETS.map((preset) => (
          <button
            key={preset.title}
            onClick={() => flyToPreset(preset.pitch, preset.bearing)}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-card/90 border border-border backdrop-blur-sm text-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
            title={preset.title}
          >
            <span className="text-base">{preset.label}</span>
          </button>
        ))}
      </div>

      <Playbar visible={!!showPlaybar} />
    </div>
  )
}
