import { useGameStore } from '../store/useGameStore'
import type { EventView, GoalView } from '../store/useGameStore'
import { useRideStore } from '../store/useRideStore'
import { useTicketStore } from '../store/useTicketStore'
import { env } from './env'
import { SEASONS, SEASON_DAYS, seasonIndex, seasonPos } from './seasons'
import { SKINS, skinById } from './skins'

/**
 * Tycoon layer. Money comes from tickets; each full day (24 hours of the running day clock)
 * costs a fixed amount plus energy and a little per rider. Guest happiness sets the star rating.
 * Spend cash on upgrades, handle random events and work through the goals.
 */
export const DAY_COST_BASE = 90
export const COST_PER_RIDER = 1
export const ENERGY_PER_DAY = 40 // cost of a day at normal speed; scales with how fast you run
export const LINE_UPKEEP = 100 // per day for the second line
const DAY_SECONDS = 150
const BANKRUPT_BELOW = -300

export interface Upgrade { id: string; name: string; desc: string; costs: number[] }
export const UPGRADES: Upgrade[] = [
  { id: 'cabins', name: 'Extra cabins', desc: '+1 cabin on every line (you start with 2)', costs: [350, 550] },
  { id: 'line2', name: 'Second cable car line', desc: 'A parallel line with its own stations. Doubles your visitors. Upkeep $100 a day', costs: [1400] },
  { id: 'marketing', name: 'Marketing', desc: '+25% visitors per level', costs: [300, 600, 1000] },
  { id: 'nightops', name: 'Night opening', desc: 'More visitors after dark', costs: [400, 800] },
  { id: 'shelters', name: 'Weather shelters', desc: 'Halves bad-weather losses', costs: [350, 700] },
  { id: 'queue', name: 'Bigger queue area', desc: '+8 waiting spaces', costs: [250, 500] },
]

export const game = {
  cash: 500,
  day: 1,
  dayHours: 0,
  todayRevenue: 0,
  todaySold: 0,
  energy: 0, // speed-seconds used today
  totalEarned: 0,
  totalPax: 0,
  happiness: 0.5,
  upgrades: {} as Record<string, number>,
  goalsDone: 0,
  highScore: 0,
  over: false,
  // tracked for goals
  bestProfit: 0,
  stormProfits: 0,
  nightPax: 0,
  eventsDone: 0,
  badHours: 0,
  // events
  boost: 1, // visitor multiplier from festivals and publicity, until the day ends
  boostLabel: '',
  vip: false,
  nightPremium: 0, // extra per ticket after dark, until the day ends
  skin: 'classic',
  skinsOwned: ['classic'] as string[],
  eventTimer: 20, // day-clock hours until the next event
  // not saved
  haltLeft: 0, // seconds the cabins are stopped
  fireworksLeft: 0, // seconds of fireworks to go
  event: null as { kind: string; id: number; left: number; total: number } | null,
}

const level = (id: string) => game.upgrades[id] ?? 0
export const currentSeason = () => seasonIndex(seasonPos(game.day, game.dayHours))
export const stars = () => Math.round((1 + 4 * game.happiness) * 2) / 2
export const lineCount = () => 1 + level('line2')
export const activeCabinCount = () => 2 + level('cabins')
const SLOT_ORDER = [0, 2, 1, 3] // which cabin slots come into service first
export const isActiveSlot = (slot: number) => SLOT_ORDER.indexOf(slot) < activeCabinCount()
const upgradesBought = () => Object.values(game.upgrades).reduce((a, b) => a + b, 0)

/** Speed the cabins really run at: zero while paused or broken down. */
export function effSpeed(): number {
  const r = useRideStore.getState()
  return r.paused || game.haltLeft > 0 ? 0 : r.speed
}

// ---- goals -------------------------------------------------------------------------------

export interface Goal { title: string; reward: number; progress: () => number }
export const GOALS: Goal[] = [
  { title: 'Carry your first 50 passengers', reward: 150, progress: () => game.totalPax / 50 },
  { title: 'Build a $1,000 cash reserve', reward: 250, progress: () => game.cash / 1000 },
  { title: 'Earn a 4-star rating', reward: 300, progress: () => stars() / 4 },
  { title: 'Buy your first upgrade', reward: 200, progress: () => (upgradesBought() >= 1 ? 1 : 0) },
  { title: 'Run a full fleet of 4 cabins', reward: 400, progress: () => (2 + level('cabins')) / 4 },
  { title: 'Survive 5 days', reward: 400, progress: () => (game.day - 1) / 5 },
  { title: 'Make $400 profit in a single day', reward: 500, progress: () => game.bestProfit / 400 },
  { title: 'Weather the storm: end a rainy or snowy day in profit', reward: 500, progress: () => game.stormProfits },
  { title: 'Night shift: carry 40 passengers after dark', reward: 400, progress: () => game.nightPax / 40 },
  { title: 'Event manager: deal with 5 events', reward: 500, progress: () => game.eventsDone / 5 },
  { title: 'Open the second cable car line', reward: 800, progress: () => level('line2') },
  { title: 'Reach a perfect 5-star rating', reward: 600, progress: () => stars() / 5 },
  { title: 'Carry 1,000 passengers', reward: 800, progress: () => game.totalPax / 1000 },
  { title: 'Dress your fleet: own 3 cabin skins', reward: 300, progress: () => game.skinsOwned.length / 3 },
  { title: 'Survive a full year (4 seasons)', reward: 600, progress: () => (game.day - 1) / (SEASON_DAYS * 4) },
  { title: 'Become a tycoon: $10,000 cash', reward: 2000, progress: () => game.cash / 10000 },
]

export const score = () =>
  Math.round(game.totalEarned / 5 + stars() * 100 + game.goalsDone * 400 + game.totalPax * 2 + (game.skinsOwned.length - 1) * 50)

// ---- demand ------------------------------------------------------------------------------

export function demandFactor(daylight: number): number {
  const nightFloor = 0.3 + 0.2 * level('nightops')
  const dayF = nightFloor + (1 - nightFloor) * daylight
  const w = useRideStore.getState().weather
  const season = currentSeason()
  // snow in winter means skiers, so it barely puts anyone off
  const penalty = w === 'rain' ? 0.35 : w === 'snow' ? (season === 3 ? 0.05 : 0.25) : 0
  const weatherF = 1 - penalty * Math.pow(0.5, level('shelters'))
  return dayF * SEASONS[season].demand * (1 + 0.25 * level('marketing')) * weatherF * game.boost
}

export const queueMax = () => 16 + 8 * level('queue')

/** tickets.ts registers these so events can touch the queues without a circular import. */
export const hooks = {
  addVisitors: (_station: number, _n: number) => {},
}

// ---- toasts ------------------------------------------------------------------------------

let toastId = 0
export function toast(msg: string) {
  const id = ++toastId
  useGameStore.setState({ toast: { id, msg } })
  window.setTimeout(() => {
    if (useGameStore.getState().toast?.id === id) useGameStore.setState({ toast: null })
  }, 6000)
}

// ---- money -------------------------------------------------------------------------------

export function sale(pax: number, amount: number) {
  game.cash += amount
  game.totalEarned += amount
  game.todayRevenue += amount
  game.todaySold += pax
  game.totalPax += pax
  if (env.daylight < 0.25) game.nightPax += pax
}

export function turnedAway() {
  game.happiness = Math.max(0, game.happiness - 0.02)
}

export function buyUpgrade(id: string) {
  const u = UPGRADES.find((x) => x.id === id)
  if (!u || game.over) return
  const lv = level(id)
  if (lv >= u.costs.length || game.cash < u.costs[lv]) return
  game.cash -= u.costs[lv]
  game.upgrades[id] = lv + 1
  if (id === 'line2') {
    hooks.addVisitors(2, 2)
    hooks.addVisitors(3, 2)
    toast('The second cable car line is open!')
  } else {
    toast(`${u.name} upgraded to level ${lv + 1}`)
  }
  pushGame()
}

export function buySkin(id: string) {
  const skin = SKINS.find((k) => k.id === id)
  if (!skin || game.over || game.skinsOwned.includes(id) || game.cash < skin.price) return
  game.cash -= skin.price
  game.skinsOwned.push(id)
  game.skin = id
  toast(`${skin.name} cabins bought and fitted.`)
  pushGame()
}

export function selectSkin(id: string) {
  if (!game.skinsOwned.includes(id)) return
  game.skin = skinById(id).id
  pushGame()
}

// ---- random events -----------------------------------------------------------------------

interface EventDef {
  kind: string
  weight: number
  title: string
  text: string
  options: { key: string; label: string }[]
  fallback: string // what happens if you ignore it
  when?: () => boolean
  start?: () => void
  resolve: (key: string) => void
}

function breakdown(seconds: number, why: string) {
  game.haltLeft = seconds
  game.happiness = Math.max(0, game.happiness - 0.1)
  toast(`${why} The cabins are stopped for ${seconds} seconds.`)
}

const EVENTS: EventDef[] = [
  {
    kind: 'festival', weight: 2, title: 'Mountain festival',
    text: 'A local festival starts today. Expect big crowds until the end of the day.',
    options: [{ key: 'ok', label: 'Great!' }], fallback: 'ok',
    start: () => { game.boost = Math.max(game.boost, 1.8); game.boostLabel = 'Festival' },
    resolve: () => {},
  },
  {
    kind: 'media', weight: 2, title: 'TV crew visiting',
    text: 'A TV crew is filming your cable car. Free publicity brings more visitors today.',
    options: [{ key: 'ok', label: 'Smile!' }], fallback: 'ok',
    start: () => { game.boost = Math.max(game.boost, 1.4); game.boostLabel = 'TV buzz' },
    resolve: () => {},
  },
  {
    kind: 'vip', weight: 2, title: 'VIP guest',
    text: 'A VIP is visiting. Have a 4-star rating or better when the day ends for a $250 bonus.',
    options: [{ key: 'ok', label: 'Understood' }], fallback: 'ok',
    start: () => { game.vip = true },
    resolve: () => {},
  },
  {
    kind: 'group', weight: 3, title: 'School trip',
    text: 'A school wants to ride today: about 10 children are on their way. They will queue at one of your stations.',
    options: [{ key: 'accept', label: 'Welcome them' }, { key: 'decline', label: 'Decline' }], fallback: 'decline',
    resolve: (key) => {
      if (key !== 'accept') return
      const stations = lineCount() * 2
      hooks.addVisitors(Math.floor(Math.random() * stations), 10)
      toast('The school group is arriving. Keep an eye on the queue.')
    },
  },
  {
    kind: 'inspection', weight: 3, title: 'Rope inspection due',
    text: 'The inspector is due. Pay $150 for proper maintenance now, or skip it and risk a breakdown.',
    options: [{ key: 'pay', label: 'Pay $150' }, { key: 'skip', label: 'Skip it' }], fallback: 'skip',
    resolve: (key) => {
      if (key === 'pay') {
        game.cash -= 150
        toast('Inspection passed. Safe to run.')
      } else if (Math.random() < 0.55) {
        breakdown(25, 'The rope jammed!')
      } else {
        toast('You got away with skipping the inspection this time.')
      }
    },
  },
  {
    kind: 'sponsor', weight: 2, title: 'Sponsor offer',
    text: 'A drinks brand offers $200 to put banners on your cabins. Some guests may find it tacky.',
    options: [{ key: 'accept', label: 'Take $200' }, { key: 'decline', label: 'No thanks' }], fallback: 'decline',
    resolve: (key) => {
      if (key !== 'accept') return
      game.cash += 200
      game.totalEarned += 200
      game.happiness = Math.max(0, game.happiness - 0.06)
      toast('Sponsorship money received (+$200).')
    },
  },
  {
    kind: 'powercut', weight: 2, title: 'Power cut',
    text: 'The grid has failed. Hire a generator for $120 to keep the cabins moving, or wait it out.',
    options: [{ key: 'pay', label: 'Hire for $120' }, { key: 'wait', label: 'Wait it out' }], fallback: 'wait',
    when: () => env.night > 0.4,
    resolve: (key) => {
      if (key === 'pay') {
        game.cash -= 120
        toast('The generator kicks in. Business as usual.')
      } else {
        breakdown(20, 'No power!')
      }
    },
  },
  // ---- night events ----
  {
    kind: 'fireworks', weight: 3, title: 'Fireworks night',
    text: 'The village is setting off fireworks! Crowds will flock to ride up and watch. Look at the sky.',
    options: [{ key: 'ok', label: 'Enjoy the show' }], fallback: 'ok',
    when: () => env.night > 0.5,
    start: () => {
      game.fireworksLeft = 45
      game.boost = Math.max(game.boost, 1.6)
      game.boostLabel = 'Fireworks'
    },
    resolve: () => {},
  },
  {
    kind: 'stargazers', weight: 3, title: 'Stargazing club',
    text: 'An astronomy club wants a late-night ride to the summit. Six guests will queue and pay a $60 booking fee.',
    options: [{ key: 'accept', label: 'Book them in' }, { key: 'decline', label: 'Decline' }], fallback: 'decline',
    when: () => env.night > 0.5,
    resolve: (key) => {
      if (key !== 'accept') return
      game.cash += 60
      game.totalEarned += 60
      hooks.addVisitors(Math.floor(Math.random() * lineCount()) * 2 + 1, 6)
      toast('The stargazers are arriving at the valley station (+$60).')
    },
  },
  {
    kind: 'moonlight', weight: 3, title: 'Moonlight rides',
    text: 'Guests would love a romantic ride under the moon. Charge $4 extra per ticket after dark until the day ends?',
    options: [{ key: 'accept', label: 'Charge extra' }, { key: 'decline', label: 'Keep prices' }], fallback: 'decline',
    when: () => env.night > 0.5,
    resolve: (key) => {
      if (key !== 'accept') return
      game.nightPremium = 4
      toast('Moonlight premium on: +$4 per ticket after dark.')
    },
  },
  {
    kind: 'wildlife', weight: 3, title: 'Deer on the line',
    text: 'A herd of deer is wandering under the rope. Slow to a stop for 15 seconds, or sound the horn and carry on?',
    options: [{ key: 'stop', label: 'Stop for 15s' }, { key: 'go', label: 'Sound the horn' }], fallback: 'go',
    when: () => env.night > 0.4,
    resolve: (key) => {
      if (key === 'stop') {
        game.haltLeft = 15
        toast('You stop for the deer. Everyone enjoys the view.')
      } else if (Math.random() < 0.5) {
        game.happiness = Math.max(0, game.happiness - 0.1)
        toast('The horn startled the guests. Complaints roll in.')
      } else {
        toast('The deer scatter and the cabins roll on.')
      }
    },
  },
  // ---- seasonal events ----
  {
    kind: 'skiweek', weight: 4, title: 'Ski week',
    text: 'The ski resort is holding its big week. Winter sports fans are flooding the mountain.',
    options: [{ key: 'ok', label: 'Bring them on' }], fallback: 'ok',
    when: () => currentSeason() === 3,
    start: () => { game.boost = Math.max(game.boost, 1.5); game.boostLabel = 'Ski week' },
    resolve: () => {},
  },
  {
    kind: 'avalanche', weight: 3, title: 'Avalanche warning',
    text: 'Heavy snow on the slopes. Close the line for 20 seconds to be safe, or run anyway and hope.',
    options: [{ key: 'close', label: 'Close for 20s' }, { key: 'run', label: 'Run anyway' }], fallback: 'run',
    when: () => currentSeason() === 3,
    resolve: (key) => {
      if (key === 'close') {
        game.haltLeft = 20
        toast('You close the line until the all-clear.')
      } else if (Math.random() < 0.4) {
        breakdown(25, 'Snow slid onto the rope!')
      } else {
        toast('Nothing came down. Phew.')
      }
    },
  },
  {
    kind: 'leaves', weight: 4, title: 'Leaf season',
    text: 'The autumn colours are spectacular and photographers are arriving by the coachload.',
    options: [{ key: 'ok', label: 'Say cheese' }], fallback: 'ok',
    when: () => currentSeason() === 2,
    start: () => { game.boost = Math.max(game.boost, 1.4); game.boostLabel = 'Leaf season' },
    resolve: () => {},
  },
  {
    kind: 'holiday', weight: 4, title: 'Summer holidays',
    text: 'Schools are out and families are heading for the hills. Expect a very busy day.',
    options: [{ key: 'ok', label: 'All aboard' }], fallback: 'ok',
    when: () => currentSeason() === 1,
    start: () => { game.boost = Math.max(game.boost, 1.5); game.boostLabel = 'Holidays' },
    resolve: () => {},
  },
  {
    kind: 'meltwater', weight: 3, title: 'Meltwater flood',
    text: 'Spring melt is flooding the station paths. Pay $100 for drainage, or risk a messy day.',
    options: [{ key: 'pay', label: 'Pay $100' }, { key: 'skip', label: 'Hope for the best' }], fallback: 'skip',
    when: () => currentSeason() === 0,
    resolve: (key) => {
      if (key === 'pay') {
        game.cash -= 100
        toast('Drains cleared. Dry feet all round.')
      } else {
        game.happiness = Math.max(0, game.happiness - 0.12)
        toast('Soggy queues. Guests are grumbling.')
      }
    },
  },
]

const EVENT_SECONDS = 30

function spawnEvent() {
  const pool = EVENTS.filter((e) => !e.when || e.when())
  let r = Math.random() * pool.reduce((a, e) => a + e.weight, 0)
  const def = pool.find((e) => (r -= e.weight) < 0) ?? pool[0]
  game.event = { kind: def.kind, id: Date.now(), left: EVENT_SECONDS, total: EVENT_SECONDS }
  def.start?.()
  pushGame()
}

export function resolveEvent(key: string) {
  const ev = game.event
  if (!ev) return
  const def = EVENTS.find((e) => e.kind === ev.kind)
  game.event = null
  game.eventsDone++
  def?.resolve(key)
  pushGame()
}

// ---- days --------------------------------------------------------------------------------

function pickWeather() {
  const [clear, rain] = SEASONS[currentSeason()].weather
  const r = Math.random()
  return r < clear ? 'clear' : r < clear + rain ? 'rain' : 'snow'
}

function endOfDay() {
  const energyCost = Math.round(ENERGY_PER_DAY * (game.energy / DAY_SECONDS))
  const upkeep = level('line2') > 0 ? LINE_UPKEEP : 0
  const costs = DAY_COST_BASE + energyCost + upkeep + COST_PER_RIDER * game.todaySold
  const profit = game.todayRevenue - costs
  game.cash -= costs
  game.bestProfit = Math.max(game.bestProfit, profit)
  if (profit > 0 && game.badHours > 8) game.stormProfits++
  let extra = ''
  if (game.vip) {
    if (stars() >= 4) {
      game.cash += 250
      game.totalEarned += 250
      extra = ' VIP bonus +$250!'
    } else {
      extra = ' The VIP left unimpressed.'
    }
  }
  const sign = profit >= 0 ? '+' : '-'
  toast(`Day ${game.day}: income $${game.todayRevenue}, costs $${costs}, profit ${sign}$${Math.abs(profit)}.${extra}`)

  game.day++
  const newSeason = currentSeason()
  if ((game.day - 1) % SEASON_DAYS === 0) toast(`${SEASONS[newSeason].icon} ${SEASONS[newSeason].name} has arrived.`)
  game.todayRevenue = 0
  game.todaySold = 0
  game.energy = 0
  game.badHours = 0
  game.boost = 1
  game.boostLabel = ''
  game.vip = false
  game.nightPremium = 0
  game.highScore = Math.max(game.highScore, score())
  if (game.cash < BANKRUPT_BELOW) {
    game.over = true
  } else if (useRideStore.getState().autoWeather && game.day >= 2) {
    useRideStore.getState().setWeather(pickWeather())
  }
}

/** Called by the day clock. Only the running day clock advances days and schedules events. */
export function advanceHours(dh: number) {
  if (game.over) return
  if (useRideStore.getState().weather !== 'clear') game.badHours += dh
  game.dayHours += dh
  while (game.dayHours >= 24) {
    game.dayHours -= 24
    endOfDay()
  }
  if (!game.event) {
    game.eventTimer -= dh
    if (game.eventTimer <= 0) {
      game.eventTimer = 14 + Math.random() * 16
      spawnEvent()
    }
  }
}

/** Called every frame with real seconds, the number of people waiting and the effective speed. */
export function gameTick(dt: number, waiting: number, speed: number) {
  if (game.over) return
  game.energy += speed * dt
  if (game.haltLeft > 0) game.haltLeft = Math.max(0, game.haltLeft - dt)
  if (game.fireworksLeft > 0) game.fireworksLeft = Math.max(0, game.fireworksLeft - dt)
  if (game.event) {
    game.event.left -= dt
    if (game.event.left <= 0) {
      const def = EVENTS.find((e) => e.kind === game.event!.kind)
      resolveEvent(def?.fallback ?? 'ok')
    }
  }
  const price = useTicketStore.getState().price
  // guests are unhappy in proportion to how full the queues are, so a bigger queue area never hurts
  const occupancy = waiting / (queueMax() * 2 * lineCount())
  const target = Math.max(0, Math.min(1, 1 - occupancy * 1.3 - Math.max(0, price - 12) * 0.02))
  game.happiness += (target - game.happiness) * (1 - Math.exp(-dt / 90))
  while (game.goalsDone < GOALS.length && GOALS[game.goalsDone].progress() >= 1) {
    const g = GOALS[game.goalsDone]
    game.cash += g.reward
    game.goalsDone++
    toast(
      game.goalsDone === GOALS.length
        ? `You did it, you are the Cableverse tycoon! (+$${g.reward})`
        : `Goal complete: ${g.title} (+$${g.reward})`,
    )
  }
  game.highScore = Math.max(game.highScore, score())
}

export function pushGame() {
  const goals: GoalView[] = GOALS.map((g, i) => ({
    title: g.title,
    reward: g.reward,
    done: i < game.goalsDone,
    progress: i < game.goalsDone ? 1 : i === game.goalsDone ? Math.min(1, Math.max(0, g.progress())) : 0,
  }))
  let event: EventView | null = null
  if (game.event) {
    const def = EVENTS.find((e) => e.kind === game.event!.kind)
    if (def) {
      event = {
        id: game.event.id, title: def.title, text: def.text, options: def.options,
        left: Math.max(0, Math.ceil(game.event.left)), total: game.event.total,
      }
    }
  }
  useGameStore.setState({
    cash: Math.round(game.cash),
    day: game.day,
    dayPct: game.dayHours / 24,
    stars: stars(),
    score: score(),
    highScore: game.highScore,
    goals,
    goalIndex: game.goalsDone,
    allDone: game.goalsDone >= GOALS.length,
    upgrades: { ...game.upgrades },
    over: game.over,
    event,
    boostLabel: game.boostLabel,
    vip: game.vip,
    haltLeft: Math.ceil(game.haltLeft),
    season: {
      name: SEASONS[currentSeason()].name,
      icon: SEASONS[currentSeason()].icon,
      day: Math.floor((seasonPos(game.day, game.dayHours) % 1) * SEASON_DAYS) + 1,
      of: SEASON_DAYS,
    },
    skin: game.skin,
    skinsOwned: [...game.skinsOwned],
    fireworks: game.fireworksLeft > 0,
  })
}

export function resetGame() {
  const high = game.highScore
  Object.assign(game, {
    cash: 500, day: 1, dayHours: 0, todayRevenue: 0, todaySold: 0, energy: 0, totalEarned: 0,
    totalPax: 0, happiness: 0.5, upgrades: {}, goalsDone: 0, highScore: high, over: false,
    bestProfit: 0, stormProfits: 0, nightPax: 0, eventsDone: 0, badHours: 0,
    boost: 1, boostLabel: '', vip: false, nightPremium: 0, skin: 'classic', skinsOwned: ['classic'],
    eventTimer: 20, haltLeft: 0, fireworksLeft: 0, event: null,
  })
  pushGame()
}
