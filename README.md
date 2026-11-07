# Cableverse 3D

A 3D cable car (aerial gondola) on a mountain. React + Vite + TypeScript + react-three-fiber.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
```

## Structure
- `src/lib/terrain.ts`: mountain height function
- `src/lib/cableway.ts`: tower positions, rope sag, loop path
- `src/lib/seasons.ts`, `skins.ts`: the calendar and the skin catalogue
- `src/lib/game.ts`: cash, days, rating, upgrades, goals, random events
- `src/lib/save.ts`: localStorage save and load
- `src/lib/tickets.ts`: visitor queues, ticket sales, capacity
- `src/lib/audio.ts`: Web Audio soundscape
- `src/components/`: Terrain, Cableway (rope, towers, stations), Cabins (motion and ride camera), Hud
- `src/store/useRideStore.ts`: speed and ride state
