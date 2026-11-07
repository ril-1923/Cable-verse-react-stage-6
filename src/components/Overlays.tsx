import { useGameStore } from '../store/useGameStore'
import { useRideStore } from '../store/useRideStore'
import { resolveEvent } from '../lib/game'
import { newGame } from '../lib/save'

export function Overlays() {
  const toast = useGameStore((s) => s.toast)
  const over = useGameStore((s) => s.over)
  const score = useGameStore((s) => s.score)
  const highScore = useGameStore((s) => s.highScore)
  const day = useGameStore((s) => s.day)
  const event = useGameStore((s) => s.event)
  const boostLabel = useGameStore((s) => s.boostLabel)
  const vip = useGameStore((s) => s.vip)
  const haltLeft = useGameStore((s) => s.haltLeft)
  const paused = useRideStore((s) => s.paused)

  return (
    <>
      <div className="chips" aria-live="polite">
        {paused && <span className="chip">⏸ Paused</span>}
        {haltLeft > 0 && <span className="chip bad">⚠️ Cabins stopped: {haltLeft}s</span>}
        {boostLabel && <span className="chip good">🎉 {boostLabel}: busier today</span>}
        {vip && <span className="chip good">⭐ VIP today: finish with 4★+</span>}
      </div>

      {event && (
        <div className="event" role="alertdialog" aria-labelledby="event-title" key={event.id}>
          <h2 id="event-title">{event.title}</h2>
          <p>{event.text}</p>
          <div className="meter"><span style={{ width: `${(event.left / event.total) * 100}%` }} /></div>
          <div className="row">
            {event.options.map((o) => (
              <button key={o.key} className={o.key === event.options[0].key ? '' : 'secondary'} onClick={() => resolveEvent(o.key)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          {toast.msg}
        </div>
      )}
      {over && (
        <div className="overlay" role="alertdialog" aria-label="Game over">
          <div className="dialog">
            <h2>Closed by the bank</h2>
            <p>The cable car ran out of money on day {day - 1}.</p>
            <p>
              Score <strong>{score}</strong> · Best <strong>{highScore}</strong>
            </p>
            <button onClick={newGame}>Start again</button>
          </div>
        </div>
      )}
    </>
  )
}
