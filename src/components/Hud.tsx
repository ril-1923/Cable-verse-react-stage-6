import { useRideStore } from '../store/useRideStore'
import type { Weather } from '../store/useRideStore'
import { useTicketStore } from '../store/useTicketStore'
import { useGameStore } from '../store/useGameStore'
import { resetStats } from '../lib/tickets'
import { UPGRADES, buySkin, buyUpgrade, selectSkin } from '../lib/game'
import { SKINS } from '../lib/skins'
import { wipeSave } from '../lib/save'
import { CURRENCY } from '../lib/config'

const clock = (h: number) => {
  const hh = Math.floor(h) % 24
  const mm = Math.round((h - Math.floor(h)) * 60) % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

const WEATHER: { id: Weather; label: string }[] = [
  { id: 'clear', label: '☀️ Clear' },
  { id: 'rain', label: '🌧️ Rain' },
  { id: 'snow', label: '❄️ Snow' },
]

function Stars({ value }: { value: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={value >= i ? 'on' : value >= i - 0.5 ? 'half' : ''}>★</span>
      ))}
    </span>
  )
}

export function Hud() {
  const speed = useRideStore((s) => s.speed)
  const riding = useRideStore((s) => s.riding)
  const paused = useRideStore((s) => s.paused)
  const hour = useRideStore((s) => Math.round(s.hour * 4) / 4)
  const autoTime = useRideStore((s) => s.autoTime)
  const sound = useRideStore((s) => s.sound)
  const volume = useRideStore((s) => s.volume)
  const weather = useRideStore((s) => s.weather)
  const autoWeather = useRideStore((s) => s.autoWeather)
  const setSpeed = useRideStore((s) => s.setSpeed)
  const toggleRide = useRideStore((s) => s.toggleRide)
  const setPaused = useRideStore((s) => s.setPaused)
  const setHour = useRideStore((s) => s.setHour)
  const setAutoTime = useRideStore((s) => s.setAutoTime)
  const setSound = useRideStore((s) => s.setSound)
  const setVolume = useRideStore((s) => s.setVolume)
  const setWeather = useRideStore((s) => s.setWeather)
  const setAutoWeather = useRideStore((s) => s.setAutoWeather)
  const setTour = useRideStore((s) => s.setTour)

  const price = useTicketStore((s) => s.price)
  const capacity = useTicketStore((s) => s.capacity)
  const stats = useTicketStore((s) => s.stats)
  const setPrice = useTicketStore((s) => s.setPrice)
  const setCapacity = useTicketStore((s) => s.setCapacity)

  const g = useGameStore()
  const second = (g.upgrades.line2 ?? 0) > 0
  const current = g.goals[g.goalIndex] ?? g.goals[g.goals.length - 1]

  return (
    <>
      <div className="hud">
        <h1>Cableverse 3D</h1>
        <div className="row">
          <button data-tour="ride" onClick={toggleRide}>{riding ? 'Leave cabin' : 'Ride a cabin'}</button>
          <button className="secondary" onClick={() => setPaused(!paused)} aria-pressed={paused}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
        <div className="stack" data-tour="time">
          <label>
            Simulation speed: {speed.toFixed(1)}×
            <input type="range" min={0} max={2.5} step={0.1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          </label>
          <label>
            Time of day: {clock(hour)}
            <input type="range" min={0} max={24} step={0.25} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
          </label>
          <label className="check">
            <input type="checkbox" checked={autoTime} onChange={(e) => setAutoTime(e.target.checked)} />
            Run the day automatically
          </label>
          <div className="group" role="group" aria-label="Weather">
            {WEATHER.map((w) => (
              <button
                key={w.id}
                className={'secondary' + (weather === w.id ? ' active' : '')}
                aria-pressed={weather === w.id}
                onClick={() => setWeather(w.id)}
              >
                {w.label}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={autoWeather} onChange={(e) => setAutoWeather(e.target.checked)} />
            Weather changes each day
          </label>
        </div>

        <button className="secondary" onClick={() => setSound(!sound)} aria-pressed={sound}>
          {sound ? '🔊 Sound on' : '🔇 Sound off'}
        </button>
        {sound && (
          <label>
            Volume
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
          </label>
        )}
        <button className="secondary" onClick={() => setTour(0)}>❓ Show the tutorial</button>
        <p>{riding ? 'Drag to look around.' : 'Drag to orbit, scroll to zoom.'}</p>
        <p className="muted">Progress saves automatically in this browser.</p>
      </div>

      <div className="hud right">
        <section data-tour="tycoon">
          <h2>Tycoon</h2>
          <div className="big">
            <span>{CURRENCY}{g.cash.toLocaleString()}</span>
            <Stars value={g.stars} />
          </div>
          <div className="meter" aria-label="Progress through the day">
            <span style={{ width: `${g.dayPct * 100}%` }} />
          </div>
          <p className="muted">
            <span className="season">{g.season.icon} {g.season.name}</span> · day {g.season.day} of {g.season.of} · Day {g.day}
            {autoTime ? '' : ' (clock paused)'}
            <br />
            Score {g.score.toLocaleString()} · Best {g.highScore.toLocaleString()}
          </p>
          {current && (
            <div className="goal">
              <strong>{g.allDone ? 'All goals complete!' : `Goal ${g.goalIndex + 1} of ${g.goals.length}`}</strong>
              <span>{current.title}</span>
              <div className="meter"><span style={{ width: `${current.progress * 100}%` }} /></div>
              {!g.allDone && <small>Reward {CURRENCY}{current.reward}</small>}
            </div>
          )}
        </section>

        <details data-tour="tickets" open>
          <summary>Ticket office</summary>
          <label>
            Ticket price: {CURRENCY}{price}
            <input type="range" min={0} max={20} step={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </label>
          <label>
            Cabin capacity: {capacity} {capacity === 1 ? 'seat' : 'seats'}
            <input type="range" min={1} max={5} step={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </label>
          <dl className="stats">
            <dt>Waiting at summit</dt><dd>{stats.queue[0]}</dd>
            <dt>Waiting at valley</dt><dd>{stats.queue[1]}</dd>
            {second && (
              <>
                <dt>Line 2 summit</dt><dd>{stats.queue[2]}</dd>
                <dt>Line 2 valley</dt><dd>{stats.queue[3]}</dd>
              </>
            )}
            <dt>Tickets sold</dt><dd>{stats.sold}</dd>
            <dt>Ticket income</dt><dd>{CURRENCY}{stats.revenue}</dd>
            <dt>Average load</dt><dd>{Math.round(stats.load * 100)}%</dd>
            <dt>Turned away</dt><dd>{stats.turnedAway}</dd>
          </dl>
          <button className="secondary" onClick={resetStats}>Reset counters</button>
        </details>

        <details data-tour="upgrades">
          <summary>Upgrades</summary>
          <ul className="upgrades">
            {UPGRADES.map((u) => {
              const lv = g.upgrades[u.id] ?? 0
              const maxed = lv >= u.costs.length
              const cost = u.costs[lv]
              return (
                <li key={u.id}>
                  <div>
                    <strong>{u.name}</strong> <small>level {lv}/{u.costs.length}</small>
                    <br />
                    <small>{u.desc}</small>
                  </div>
                  <button className="secondary" disabled={maxed || g.cash < cost} onClick={() => buyUpgrade(u.id)}>
                    {maxed ? 'Max' : `${CURRENCY}${cost}`}
                  </button>
                </li>
              )
            })}
          </ul>
        </details>

        <details data-tour="skins">
          <summary>Cabin skins ({g.skinsOwned.length}/{SKINS.length})</summary>
          <ul className="skins">
            {SKINS.map((k) => {
              const owned = g.skinsOwned.includes(k.id)
              const selected = g.skin === k.id
              const swatch = `linear-gradient(90deg, ${k.bodies.join(', ')})`
              return (
                <li key={k.id}>
                  <span className="swatch" style={{ background: swatch, borderColor: k.stripe ?? '#c3d0dc' }} aria-hidden="true" />
                  <span className="skin-name">
                    <strong>{k.name}</strong>
                    <small>{k.glow >= 1 ? 'Glows at night' : k.metal >= 0.8 ? 'Shiny metal' : owned ? 'Owned' : ' '}</small>
                  </span>
                  <button
                    className={'secondary' + (selected ? ' active' : '')}
                    disabled={selected || (!owned && g.cash < k.price)}
                    aria-pressed={selected}
                    onClick={() => (owned ? selectSkin(k.id) : buySkin(k.id))}
                  >
                    {selected ? 'In use' : owned ? 'Use' : `${CURRENCY}${k.price}`}
                  </button>
                </li>
              )
            })}
          </ul>
        </details>

        <details data-tour="goals">
          <summary>All goals ({g.goalIndex}/{g.goals.length})</summary>
          <ol className="goals">
            {g.goals.map((goal, i) => (
              <li key={goal.title} className={goal.done ? 'done' : i === g.goalIndex ? 'now' : ''}>
                <span aria-hidden="true">{goal.done ? '✓' : i === g.goalIndex ? '▸' : '○'}</span>
                <span>
                  {goal.title}
                  <small> {CURRENCY}{goal.reward}</small>
                </span>
              </li>
            ))}
          </ol>
        </details>

        <details>
          <summary>Save</summary>
          <button
            className="secondary"
            onClick={() => {
              if (window.confirm('Erase your saved game and start over?')) wipeSave()
            }}
          >
            Erase save and restart
          </button>
        </details>
      </div>
    </>
  )
}
