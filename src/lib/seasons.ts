import { smoothstep } from './math'

/** A year is four seasons of SEASON_DAYS game days each. The game starts at the beginning of summer. */
export const SEASON_DAYS = 4
const START_DAYS = SEASON_DAYS // day 1 is the first day of summer

export interface Season {
  id: string
  name: string
  icon: string
  grass: string // meadow colour
  leaf: string // deciduous tree colour
  demand: number // visitor multiplier
  weather: [number, number, number] // chance of clear, rain, snow when the weather changes
}

export const SEASONS: Season[] = [
  { id: 'spring', name: 'Spring', icon: '🌸', grass: '#6fae4f', leaf: '#7bbf5a', demand: 1.0, weather: [0.45, 0.5, 0.05] },
  { id: 'summer', name: 'Summer', icon: '☀️', grass: '#4f8a3a', leaf: '#2f6b34', demand: 1.25, weather: [0.8, 0.2, 0] },
  { id: 'autumn', name: 'Autumn', icon: '🍂', grass: '#b0762f', leaf: '#c96f22', demand: 1.0, weather: [0.5, 0.45, 0.05] },
  { id: 'winter', name: 'Winter', icon: '⛄', grass: '#9aa392', leaf: '#8a8f86', demand: 0.85, weather: [0.35, 0.05, 0.6] },
]

/** Continuous position in the year, 0..4 (0 = start of spring, 1 = start of summer). */
export const seasonPos = (day: number, dayHours: number) => (((day - 1) + dayHours / 24 + START_DAYS) / SEASON_DAYS) % 4
export const seasonIndex = (pos: number) => Math.floor(pos) % 4

/** Summer days are longer and winter days shorter. Added to the sun's height. */
export const daylightOffset = (pos: number) => 0.19 * Math.cos(2 * Math.PI * (pos / 4 - 0.375))

/** 0..1, how wintry the ground looks: full through winter, fading in and out around it. */
export function winterAmount(pos: number): number {
  if (pos >= 3) return Math.min(1, (pos - 3) / 0.3)
  if (pos < 0.4) return 1 - pos / 0.4
  return 0
}

/** Blend between this season and the next, holding steady for most of the season. */
export function blend(pos: number): { a: number; b: number; t: number } {
  const a = seasonIndex(pos)
  const t = smoothstep(0.65, 1, pos - Math.floor(pos))
  return { a, b: (a + 1) % 4, t }
}
