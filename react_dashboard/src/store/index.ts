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

export interface Filters {
  timeRange: [number, number]
  durationRange: [number, number]
  distanceRange: [number, number]
}

interface AppState {
  data: DeliveryRecord[]
  layers: LayerVisibility
  filters: Filters
  setData: (records: DeliveryRecord[]) => void
  toggleLayer: (name: keyof LayerVisibility) => void
}

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
}))
