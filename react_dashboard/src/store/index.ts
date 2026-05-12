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
}

interface AppState {
  data: DeliveryRecord[]
  layers: LayerVisibility
  layerSettings: Record<keyof LayerVisibility, LayerSettings>
  filters: Filters
  setData: (records: DeliveryRecord[]) => void
  toggleLayer: (name: keyof LayerVisibility) => void
  updateLayerSetting: (
    name: keyof LayerVisibility,
    key: keyof LayerSettings,
    value: number
  ) => void
}

const defaultSettings: LayerSettings = { opacity: 0.8, radius: 40 }

export const useStore = create<AppState>((set) => ({
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
  },
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
}))
