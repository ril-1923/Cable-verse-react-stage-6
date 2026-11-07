import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRideStore } from '../store/useRideStore'

const DONE_KEY = 'cableverse-tour-v1'

interface Step { title: string; text: string; target?: string; open?: boolean }

const STEPS: Step[] = [
  {
    title: 'Welcome to Cableverse',
    text: 'You run a mountain cable car. Carry visitors, keep them happy, earn money and grow your business. This short tour shows you around. The game is paused while it runs.',
  },
  {
    title: 'Look around',
    text: 'Drag to orbit, scroll to zoom. Press Ride a cabin to sit inside one and drag to look out of the windows. Pause stops everything whenever you need a breather.',
    target: 'ride',
  },
  {
    title: 'The minimap',
    text: 'Shows your stations (with how many people are waiting), cabins and where the camera is looking. Click it to fly straight there.',
    target: 'minimap',
  },
  {
    title: 'Tycoon',
    text: 'Your cash, star rating and the day clock. Tickets earn money, and every day costs money to run. Long queues and turned-away visitors lower your rating. Run out of money and the bank closes you.',
    target: 'tycoon',
  },
  {
    title: 'Ticket office',
    text: 'Set the ticket price and how many seats each cabin may fill. Cheap tickets bring crowds but little profit, dear ones bring few visitors. Find the sweet spot, and watch the queues.',
    target: 'tickets',
  },
  {
    title: 'Upgrades',
    text: 'Spend your cash on extra cabins, marketing, night opening, weather shelters, bigger queues and, eventually, a whole second cable car line.',
    target: 'upgrades',
    open: true,
  },
  {
    title: 'Cabin skins',
    text: 'Dress your fleet. Skins are cosmetic: some shine, and Midnight glows with neon trim after dark. Buy one, then pick which skin to use any time.',
    target: 'skins',
    open: true,
  },
  {
    title: 'Goals',
    text: 'Work through a ladder of goals for bonus cash and a higher score. The next goal is always shown under your cash.',
    target: 'goals',
    open: true,
  },
  {
    title: 'Time and weather',
    text: 'Days run automatically, four to a season. Summer is busy with long days, winter is quiet with short ones, and each season has its own weather. Rain puts visitors off, so shelters help. You can set the weather and time yourself, and turn the sound on.',
    target: 'time',
  },
  {
    title: 'Expect surprises',
    text: 'Random events pop up with a choice and a timer: school trips, inspections, sponsors, power cuts, and after dark even fireworks and deer on the line. Choose wisely. Everything saves automatically, so you can come back any time. Good luck!',
  },
]

export const tourSeen = () => {
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return true
  }
}

export function Tutorial() {
  const tour = useRideStore((s) => s.tour)
  const setTour = useRideStore((s) => s.setTour)
  const setPaused = useRideStore((s) => s.setPaused)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [card, setCard] = useState({ left: 0, top: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const wasPaused = useRef(false)

  const open = tour !== null
  const step = open ? STEPS[Math.min(tour, STEPS.length - 1)] : null

  // pause while the tour is showing and restore afterwards
  useEffect(() => {
    if (!open) return
    wasPaused.current = useRideStore.getState().paused
    setPaused(true)
    return () => setPaused(wasPaused.current)
  }, [open, setPaused])

  const close = () => {
    try {
      localStorage.setItem(DONE_KEY, '1')
    } catch {
      // ignore
    }
    setTour(null)
  }

  // find and track the highlighted element
  useLayoutEffect(() => {
    if (!step) return
    const find = () => (step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null)
    const measure = () => {
      const el = find()
      setRect(el ? el.getBoundingClientRect() : null)
    }
    const first = find()
    if (first instanceof HTMLDetailsElement && step.open) first.open = true
    first?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) // panels scroll, so bring it into view
    measure()
    const id = window.setInterval(measure, 250)
    window.addEventListener('resize', measure)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', measure)
    }
  }, [step])

  // place the card beside the highlight, or centre it
  useLayoutEffect(() => {
    const c = cardRef.current
    if (!c) return
    const w = c.offsetWidth
    const h = c.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (!rect) {
      setCard({ left: (vw - w) / 2, top: (vh - h) / 2 })
      return
    }
    const onRight = rect.left + rect.width / 2 > vw / 2
    let left = onRight ? rect.left - w - 16 : rect.right + 16
    let top = rect.top
    if (left < 8 || left + w > vw - 8) {
      left = Math.min(Math.max(8, rect.left), vw - w - 8)
      top = rect.top > vh / 2 ? rect.top - h - 16 : rect.bottom + 16
    }
    setCard({ left, top: Math.min(Math.max(8, top), vh - h - 8) })
  }, [rect, tour])

  useEffect(() => {
    if (open) nextRef.current?.focus()
  }, [open, tour])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') setTour(Math.min((tour ?? 0) + 1, STEPS.length - 1))
      if (e.key === 'ArrowLeft') setTour(Math.max((tour ?? 0) - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tour])

  if (!open || !step) return null
  const last = tour === STEPS.length - 1

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div
          className="tour-spot"
          style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-card" ref={cardRef} style={{ left: card.left, top: card.top }}>
        <small>Step {tour + 1} of {STEPS.length}</small>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.text}</p>
        <div className="row">
          <button className="secondary" onClick={close}>Skip</button>
          {tour > 0 && <button className="secondary" onClick={() => setTour(tour - 1)}>Back</button>}
          <button ref={nextRef} onClick={() => (last ? close() : setTour(tour + 1))}>
            {last ? "Let's go" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
