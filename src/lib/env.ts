/** Shared state written once per frame and read by lamps, sound, weather and the minimap. */
export const env = {
  night: 0,
  daylight: 1,
  dusk: 0, // 1 at sunrise/sunset, 0 in full day or night
  sun: [0, 1, 0] as [number, number, number],
  rope: 0, // fastest line's cabin speed 0..1, scaled by simulation speed
  ropeLine: [0, 0], // per line
  phase: 0, // shared simulation clock, in nominal seconds
  // weather, all eased 0..1
  rain: 0,
  snowfall: 0,
  snowCover: 0, // how much of the mountain is white
  wet: 0, // how wet the ground looks
  overcast: 0,
  flash: 0, // lightning
  // seasons
  seasonPos: 0,
  dayOffset: 0, // added to the sun's height: longer days in summer, shorter in winter
  winter: 0, // 0..1, how wintry the ground is
  grass: [0.1, 0.25, 0.06] as [number, number, number], // current meadow colour (linear)
  leaf: [0.2, 0.4, 0.1] as [number, number, number], // current deciduous tree colour (linear)
  fireworks: 0, // 1 while a fireworks show is on
  // published for the minimap
  cabins: Array.from({ length: 8 }, () => ({ x: 0, z: 0, st: -2 })),
  cam: { x: 0, z: 0, dx: 0, dz: -1 },
}
