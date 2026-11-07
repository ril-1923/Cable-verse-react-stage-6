import * as THREE from 'three'

const mat = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })
const SHIRTS = ['#d9483b', '#3b8fd9', '#e8b33a', '#4fb37a', '#8e5bd1', '#e07a9a', '#f0f0f0', '#2f9aa6'].map(mat)
const PANTS = ['#2b3442', '#4a4036', '#1f2a44', '#59606b'].map(mat)
const SKIN = ['#f1c9a5', '#d9a47c', '#a9714b', '#7a4b30'].map(mat)

const legGeo = new THREE.BoxGeometry(0.15, 0.8, 0.17).translate(0, -0.4, 0)
const torsoGeo = new THREE.CapsuleGeometry(0.17, 0.4, 4, 8)
const headGeo = new THREE.SphereGeometry(0.13, 12, 10)

/** A low-poly person. Origin is at the feet, facing +z. */
export function createPerson(): THREE.Group {
  const root = new THREE.Group()
  const legs = new THREE.Group()
  const legL = new THREE.Group()
  const legR = new THREE.Group()
  legL.position.set(-0.09, 0.8, 0)
  legR.position.set(0.09, 0.8, 0)
  const legMeshL = new THREE.Mesh(legGeo, PANTS[0])
  const legMeshR = new THREE.Mesh(legGeo, PANTS[0])
  legL.add(legMeshL)
  legR.add(legMeshR)
  legs.add(legL, legR)

  const upper = new THREE.Group()
  upper.position.y = 0.8
  const torso = new THREE.Mesh(torsoGeo, SHIRTS[0])
  torso.position.y = 0.37
  const head = new THREE.Mesh(headGeo, SKIN[0])
  head.position.y = 0.88
  upper.add(torso, head)

  root.add(legs, upper)
  root.visible = false
  root.userData = { legs, upper, legL, legR, legMeshL, legMeshR, torso, head, leg: Number.NaN, yaw: undefined }
  return root
}

export function dressPerson(p: THREE.Group, seed: number) {
  const u = p.userData
  u.torso.material = SHIRTS[seed % SHIRTS.length]
  const pants = PANTS[(seed >>> 3) % PANTS.length]
  u.legMeshL.material = pants
  u.legMeshR.material = pants
  u.head.material = SKIN[(seed >>> 6) % SKIN.length]
}

export function posePerson(p: THREE.Group, seat: number, swing: number, stride: number) {
  const u = p.userData
  const legScale = 1 - 0.5 * seat
  u.legs.scale.y = legScale
  u.upper.position.y = 0.8 * legScale
  const s = Math.sin(stride * 3.6) * swing
  u.legL.rotation.x = s
  u.legR.rotation.x = -s
}
