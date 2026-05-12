import { create } from 'zustand'
import type { DeliveryRecord } from '../types'

export interface LayerVisibility {
  point: boolean
  arc: boolean
  heatmap: boolean
  hexbin: boolean
  cluster: boolean
  route: boolean
  trip: boolean
}

export interface LayerSettings {
  opacity: number
  radius: number
}

export interface Filters {
  timeRange: [number, number]
  durationRange: [number, number]
  distanceRange: [number, number]
  regionQuery: string
}

export type MapTheme = 'dark-matter' | 'positron' | 'voyager' | 'dark-matter-nolabels' | 'positron-nolabels' | 'liberty' | 'osm-bright'
export type ColorPalette = 'default' | 'rainbow' | 'mint' | 'warm' | 'cool'

export const MAP_THEME_URLS: Record<MapTheme, string> = {
  'dark-matter': 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  positron: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  voyager: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  'dark-matter-nolabels': 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
  'positron-nolabels': 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  'osm-bright': 'https://tiles.openfreemap.org/styles/bright',
}

export const COLOR_PALETTES: Record<ColorPalette, [number, number, number][]> = {
  default: [
    [255, 99, 71], [30, 144, 255], [50, 205, 50], [255, 215, 0],
    [148, 103, 189], [255, 127, 80], [0, 206, 209], [255, 105, 180],
  ],
  rainbow: [
    [255, 0, 0], [255, 127, 0], [255, 255, 0], [0, 255, 0],
    [0, 0, 255], [75, 0, 130], [148, 0, 211], [255, 20, 147],
  ],
  mint: [
    [0, 255, 200], [0, 200, 180], [50, 230, 150], [100, 255, 200],
    [0, 180, 160], [80, 220, 180], [30, 200, 140], [60, 240, 190],
  ],
  warm: [
    [255, 69, 0], [255, 140, 0], [255, 165, 0], [255, 200, 0],
    [255, 99, 71], [220, 80, 50], [240, 120, 40], [255, 180, 60],
  ],
  cool: [
    [0, 100, 255], [30, 60, 200], [70, 130, 255], [100, 180, 255],
    [0, 150, 220], [50, 100, 180], [80, 160, 240], [20, 120, 200],
  ],
}

interface AppState {
  data: DeliveryRecord[]
  layers: LayerVisibility
  layerSettings: Record<keyof LayerVisibility, LayerSettings>
  filters: Filters
  theme: MapTheme
  palette: ColorPalette
  setData: (records: DeliveryRecord[]) => void
  toggleLayer: (name: keyof LayerVisibility) => void
  updateLayerSetting: (
    name: keyof LayerVisibility,
    key: keyof LayerSettings,
    value: number
  ) => void
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void
  setTheme: (theme: MapTheme) => void
  setPalette: (palette: ColorPalette) => void
  exportSettings: () => string
  importSettings: (json: string) => boolean
}

const defaultSettings: LayerSettings = { opacity: 0.8, radius: 40 }

export const useStore = create<AppState>((set, get) => ({
  data: [],
  layers: {
    point: true,
    arc: true,
    heatmap: false,
    hexbin: false,
    cluster: false,
    route: false,
    trip: false,
  },
  layerSettings: {
    point: { opacity: 0.8, radius: 40 },
    arc: { opacity: 0.7, radius: 1.5 },
    heatmap: { opacity: 0.8, radius: 30 },
    hexbin: { opacity: 0.7, radius: 200 },
    cluster: { opacity: 0.8, radius: 80 },
    route: { ...defaultSettings },
    trip: { ...defaultSettings },
  },
  filters: {
    timeRange: [0, 24],
    durationRange: [0, 120],
    distanceRange: [0, 20],
    regionQuery: '',
  },
  theme: 'dark-matter',
  palette: 'default',
  setData: (records) => set({ data: records }),
  toggleLayer: (name) =>
    set((state) => ({
      layers: { ...state.layers, [name]: !state.layers[name] },
    })),
  updateLayerSetting: (name, key, value) =>
    set((state) => ({
      layerSettings: {
        ...state.layerSettings,
        [name]: { ...state.layerSettings[name], [key]: value },
      },
    })),
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  setTheme: (theme) => set({ theme }),
  setPalette: (palette) => set({ palette }),
  exportSettings: () => {
    const { layers, layerSettings, filters, theme, palette } = get()
    return JSON.stringify({ layers, layerSettings, filters, theme, palette }, null, 2)
  },
  importSettings: (json: string) => {
    try {
      const parsed = JSON.parse(json)
      const updates: Partial<AppState> = {}
      if (parsed.layers) updates.layers = parsed.layers
      if (parsed.layerSettings) updates.layerSettings = parsed.layerSettings
      if (parsed.filters) updates.filters = parsed.filters
      if (parsed.theme) updates.theme = parsed.theme
      if (parsed.palette) updates.palette = parsed.palette
      set(updates)
      return true
    } catch {
      return false
    }
  },
}))
