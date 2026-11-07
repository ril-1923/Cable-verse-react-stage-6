import { create } from 'zustand'

interface RideState {
  speed: number // simulation rate multiplier (1 = nominal)
  riding: boolean
  paused: boolean
  tour: number | null // tutorial step, or null when closed
  hour: number // time of day, 0-24
  autoTime: boolean
  sound: boolean
  weather: Weather
  autoWeather: boolean
  focus: { x: number; z: number; n: number } | null
  volume: number
  setSpeed: (speed: number) => void
  toggleRide: () => void
  setPaused: (on: boolean) => void
  setTour: (step: number | null) => void
  setHour: (hour: number) => void
  setAutoTime: (on: boolean) => void
  setSound: (on: boolean) => void
  setWeather: (w: Weather) => void
  setAutoWeather: (on: boolean) => void
  focusOn: (x: number, z: number) => void
  setVolume: (v: number) => void
}

export type Weather = 'clear' | 'rain' | 'snow'

export const useRideStore = create<RideState>((set) => ({
  speed: 1,
  riding: false,
  paused: false,
  tour: null,
  hour: 9,
  autoTime: true,
  sound: false,
  weather: 'clear',
  autoWeather: true,
  focus: null,
  volume: 0.6,
  setSpeed: (speed) => set({ speed }),
  toggleRide: () => set((s) => ({ riding: !s.riding })),
  setPaused: (paused) => set({ paused }),
  setTour: (tour) => set({ tour }),
  setHour: (hour) => set({ hour }),
  setAutoTime: (autoTime) => set({ autoTime }),
  setSound: (sound) => set({ sound }),
  setWeather: (weather) => set({ weather }),
  setAutoWeather: (autoWeather) => set({ autoWeather }),
  focusOn: (x, z) => set((s) => ({ focus: { x, z, n: (s.focus?.n ?? 0) + 1 } })),
  setVolume: (volume) => set({ volume }),
}))
