import { Scene } from './components/Scene'
import { Hud } from './components/Hud'
import { Minimap } from './components/Minimap'
import { Overlays } from './components/Overlays'
import { SaveDriver } from './components/SaveDriver'
import { Tutorial, tourSeen } from './components/Tutorial'
import { useEffect } from 'react'
import { useRideStore } from './store/useRideStore'

export default function App() {
  // first visit: start the tutorial
  useEffect(() => {
    if (!tourSeen()) useRideStore.getState().setTour(0)
  }, [])

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Scene />
      <Hud />
      <Minimap />
      <Overlays />
      <SaveDriver />
      <Tutorial />
    </div>
  )
}
