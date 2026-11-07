import { useEffect, useRef } from 'react'
import { LOOP, STATIONS, TOWER_X, pathAt } from '../lib/cableway'
import { LINE2_Z, terrainHeight } from '../lib/terrain'
import { useGameStore } from '../store/useGameStore'
import { skinById } from '../lib/skins'
import { clamp } from '../lib/math'
import { env } from '../lib/env'
import { sim } from '../lib/tickets'
import { useRideStore } from '../store/useRideStore'

// world extent covered by the map (matches the terrain mesh)
const WX = 150
const WZ = 90
const W = 240
const H = 144

const toPx = (x: number, z: number): [number, number] => [((x + WX / 2) / WX) * W, ((z + WZ / 2) / WZ) * H]

function colorAt(h: number): [number, number, number] {
  if (h < 10) return [91, 122, 67]
  if (h < 26) {
    const t = (h - 10) / 16
    return [91 + (138 - 91) * t, 122 + (128 - 122) * t, 67 + (116 - 67) * t]
  }
  if (h < 40) return [138, 128, 116]
  const t = clamp((h - 40) / 8)
  return [138 + (238 - 138) * t, 128 + (243 - 128) * t, 116 + (246 - 116) * t]
}

/** Terrain painted once: height colours with simple hill shading. */
function paintTerrain(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(W, H)
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = (px / W) * WX - WX / 2
      const z = (py / H) * WZ - WZ / 2
      const h = terrainHeight(x, z)
      const dx = terrainHeight(x + 1, z) - terrainHeight(x - 1, z)
      const dz = terrainHeight(x, z + 1) - terrainHeight(x, z - 1)
      const shade = clamp(1 - (dx + dz) * 0.1, 0.55, 1.3)
      const [r, g, b] = colorAt(h)
      const i = (py * W + px) * 4
      img.data[i] = Math.min(255, r * shade)
      img.data[i + 1] = Math.min(255, g * shade)
      img.data[i + 2] = Math.min(255, b * shade)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

export function Minimap() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const terrain = paintTerrain()
    const ctx = canvas.current!.getContext('2d')!
    // the rope loop never changes, so build its outline once
    const ropes = [0, LINE2_Z].map((zOff) => {
      const pts: [number, number][] = []
      for (let s = 0; s < LOOP; s += 2) {
        const p = pathAt(s)
        pts.push(toPx(p.x, p.z + zOff))
      }
      return pts
    })

    let raf = 0
    let last = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 66) return // ~15 fps is plenty
      last = now

      ctx.drawImage(terrain, 0, 0)
      // darken with the night, tint with the weather
      const dark = env.night * 0.55 + env.overcast * 0.15
      if (dark > 0.01) {
        ctx.fillStyle = `rgba(6,10,24,${dark})`
        ctx.fillRect(0, 0, W, H)
      }
      if (env.snowCover > 0.02) {
        ctx.fillStyle = `rgba(240,246,250,${env.snowCover * 0.35})`
        ctx.fillRect(0, 0, W, H)
      }

      const lines = (useGameStore.getState().upgrades.line2 ?? 0) > 0 ? 2 : 1
      for (let line = 0; line < lines; line++) {
        const zOff = line * LINE2_Z
        ctx.strokeStyle = 'rgba(20,24,30,0.9)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ropes[line].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.closePath()
        ctx.stroke()

        ctx.fillStyle = '#c8412f'
        for (const x of TOWER_X) {
          const [px, py] = toPx(x, zOff)
          ctx.fillRect(px - 2, py - 2, 4, 4)
        }

        ctx.font = '600 10px system-ui, sans-serif'
        ctx.textAlign = 'center'
        for (const st of STATIONS) {
          const [px, py] = toPx(st.x - st.sign * 5, zOff)
          ctx.fillStyle = '#c8412f'
          ctx.fillRect(px - 8, py - 8, 16, 16)
          ctx.fillStyle = '#fff'
          ctx.fillText(String(sim.queue[line * 2 + st.index] ?? 0), px, py + 4)
        }
      }

      const bodies = skinById(useGameStore.getState().skin).bodies
      env.cabins.forEach((c, i) => {
        if (c.st === -2 || i >= lines * 4) return
        const [px, py] = toPx(c.x, c.z)
        ctx.fillStyle = bodies[i % 4]
        ctx.strokeStyle = '#111'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(px, py, c.st >= 0 ? 4.5 : 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      })

      // camera: a small view cone
      const [cx, cy] = toPx(env.cam.x, env.cam.z)
      const { dx, dz } = env.cam
      const a = Math.atan2(dz, dx)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.strokeStyle = '#111'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, 20, a - 0.5, a + 0.5)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * WX - WX / 2
    const z = ((e.clientY - r.top) / r.height) * WZ - WZ / 2
    useRideStore.getState().focusOn(x, z)
  }

  return (
    <div className="minimap" data-tour="minimap">
      <canvas ref={canvas} width={W} height={H} onClick={onClick} aria-label="Minimap. Click to move the camera there." />
      <span>Click the map to fly there</span>
    </div>
  )
}
