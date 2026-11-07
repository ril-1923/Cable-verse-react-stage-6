import { useEffect } from 'react'
import { writeSave } from '../lib/save'

/** Autosaves every few seconds, and when the tab is hidden or closed. */
export function SaveDriver() {
  useEffect(() => {
    const id = window.setInterval(writeSave, 4000)
    const onHide = () => {
      if (document.visibilityState === 'hidden') writeSave()
    }
    window.addEventListener('beforeunload', writeSave)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('beforeunload', writeSave)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])
  return null
}
