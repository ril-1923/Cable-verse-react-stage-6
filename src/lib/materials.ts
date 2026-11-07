import * as THREE from 'three'

/** Lamps share one material so a single value switches every lamp on at night. */
export const lampMat = new THREE.MeshStandardMaterial({
  color: '#fff1cf', emissive: '#ffcf7a', emissiveIntensity: 0.1,
})
/** Unlit so the cabin lamp doesn't fog the windows; Lighting dims its colour at night. */
export const glassMat = new THREE.MeshBasicMaterial({
  color: '#d6ecf8', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide,
})
export const metalMat = new THREE.MeshStandardMaterial({ color: '#2a2d33', metalness: 0.6, roughness: 0.4 })
export const seatMat = new THREE.MeshStandardMaterial({ color: '#5a3a2e', roughness: 0.9 })
export const floorMat = new THREE.MeshStandardMaterial({ color: '#4a5059', roughness: 0.95 })
export const chromeMat = new THREE.MeshStandardMaterial({ color: '#c9d0d8', metalness: 0.9, roughness: 0.25 })
