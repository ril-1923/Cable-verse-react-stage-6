import { create } from 'zustand'

export interface GoalView { title: string; reward: number; done: boolean; progress: number }
export interface EventView {
  id: number
  title: string
  text: string
  options: { key: string; label: string }[]
  left: number
  total: number
}

export interface SeasonView { name: string; icon: string; day: number; of: number }

export interface GameView {
  cash: number
  day: number
  dayPct: number // progress through the current day, 0..1
  stars: number
  score: number
  highScore: number
  goals: GoalView[]
  goalIndex: number
  allDone: boolean
  upgrades: Record<string, number>
  toast: { id: number; msg: string } | null
  over: boolean
  event: EventView | null
  boostLabel: string
  vip: boolean
  haltLeft: number
  season: SeasonView
  skin: string
  skinsOwned: string[]
  fireworks: boolean
}

export const useGameStore = create<GameView>(() => ({
  cash: 500,
  day: 1,
  dayPct: 0,
  stars: 3,
  score: 0,
  highScore: 0,
  goals: [],
  goalIndex: 0,
  allDone: false,
  upgrades: {},
  toast: null,
  over: false,
  event: null,
  boostLabel: '',
  vip: false,
  haltLeft: 0,
  season: { name: 'Spring', icon: '🌸', day: 1, of: 4 },
  skin: 'classic',
  skinsOwned: ['classic'],
  fireworks: false,
}))
