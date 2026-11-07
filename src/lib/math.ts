export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))

export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export const wrapAngle = (a: number) => {
  let r = (a + Math.PI) % (2 * Math.PI)
  if (r < 0) r += 2 * Math.PI
  return r - Math.PI
}

export function hash(a: number, b: number): number {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}
