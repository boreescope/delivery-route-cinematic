import { create } from 'zustand'

interface AppState {
  // Will be expanded in Task 2
}

export const useStore = create<AppState>(() => ({}))
