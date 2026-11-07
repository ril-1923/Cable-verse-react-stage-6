export interface Skin {
  id: string
  name: string
  price: number
  bodies: [string, string, string, string] // one colour per cabin slot
  roof: string | null // null = same as the body
  stripe: string | null
  seat: string
  metal: number
  rough: number
  glow: number // how brightly the stripe glows at night
}

export const SKINS: Skin[] = [
  { id: 'classic', name: 'Classic', price: 0, bodies: ['#e8b33a', '#d9483b', '#3b8fd9', '#4fb37a'], roof: null, stripe: null, seat: '#5a3a2e', metal: 0.15, rough: 0.45, glow: 0 },
  { id: 'alpine', name: 'Alpine', price: 150, bodies: ['#c8412f', '#c8412f', '#c8412f', '#c8412f'], roof: '#f2f2f2', stripe: '#f2f2f2', seat: '#3b2a24', metal: 0.15, rough: 0.45, glow: 0 },
  { id: 'glacier', name: 'Glacier', price: 200, bodies: ['#7fc4e8', '#9ad3ee', '#6fb6dc', '#a9ddf2'], roof: '#ffffff', stripe: '#ffffff', seat: '#2f4a6b', metal: 0.3, rough: 0.25, glow: 0 },
  { id: 'forest', name: 'Forest', price: 200, bodies: ['#2f6b3a', '#3a7a45', '#285a31', '#44864f'], roof: '#5a3a1e', stripe: '#e8d9a8', seat: '#6b4a2a', metal: 0.1, rough: 0.6, glow: 0 },
  { id: 'sunset', name: 'Sunset', price: 250, bodies: ['#f08a3a', '#e8607a', '#f2a65a', '#d94f6a'], roof: '#4a2c5a', stripe: '#ffd9a0', seat: '#4a2c3a', metal: 0.2, rough: 0.4, glow: 0.3 },
  { id: 'festive', name: 'Festive', price: 300, bodies: ['#c8412f', '#2f7a45', '#c8412f', '#2f7a45'], roof: '#ffffff', stripe: '#ffffff', seat: '#7a2a2a', metal: 0.1, rough: 0.5, glow: 0.4 },
  { id: 'midnight', name: 'Midnight', price: 400, bodies: ['#1a2540', '#1a2540', '#1a2540', '#1a2540'], roof: '#0f1628', stripe: '#36d1ff', seat: '#20304f', metal: 0.5, rough: 0.3, glow: 2.4 },
  { id: 'gold', name: 'Gold', price: 800, bodies: ['#d9a82a', '#d9a82a', '#d9a82a', '#d9a82a'], roof: '#f2d36a', stripe: '#fff2b0', seat: '#5a1f1f', metal: 0.85, rough: 0.25, glow: 0.5 },
]

export const skinById = (id: string): Skin => SKINS.find((s) => s.id === id) ?? SKINS[0]
