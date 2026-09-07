import * as THREE from 'three'

export const COLORS = {
  grass: 0x5fbf4a,
  dirt: 0xc4a574,
  fence: 0x8b5a2b,
  hay: 0xd4a017,
  crop: 0x8b4dff,
  cropLeaf: 0x4caf50,
  counter: 0x3b82f6,
  counterTop: 0x60a5fa,
  sellZone: 0x22d3ee,
  money: 0x22c55e,
  moneyDark: 0x15803d,
  player: 0xe11d48,
  playerPants: 0x1e3a8a,
  skin: 0xfbbf24,
  npc: [0x2563eb, 0xdc2626, 0x7c3aed, 0xea580c, 0x0891b2],
  unlock: 0xffffff,
  wood: 0x92632a,
}

export function makeGround(size = 40): THREE.Group {
  const g = new THREE.Group()
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ color: COLORS.grass }),
  )
  grass.rotation.x = -Math.PI / 2
  grass.receiveShadow = true
  g.add(grass)

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 28),
    new THREE.MeshLambertMaterial({ color: COLORS.dirt }),
  )
  path.rotation.x = -Math.PI / 2
  path.position.set(0, 0.01, 2)
  path.receiveShadow = true
  g.add(path)

  const path2 = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 5),
    new THREE.MeshLambertMaterial({ color: COLORS.dirt }),
  )
  path2.rotation.x = -Math.PI / 2
  path2.position.set(2, 0.015, -2)
  path2.receiveShadow = true
  g.add(path2)

  return g
}

export function makeFence(x1: number, z1: number, x2: number, z2: number): THREE.Group {
  const g = new THREE.Group()
  const dx = x2 - x1
  const dz = z2 - z1
  const len = Math.hypot(dx, dz)
  const posts = Math.max(2, Math.ceil(len / 1.2))
  for (let i = 0; i <= posts; i++) {
    const t = i / posts
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.9, 0.15),
      new THREE.MeshLambertMaterial({ color: COLORS.fence }),
    )
    post.position.set(x1 + dx * t, 0.45, z1 + dz * t)
    post.castShadow = true
    g.add(post)
  }
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(len, 0.08, 0.08),
    new THREE.MeshLambertMaterial({ color: COLORS.fence }),
  )
  rail.position.set((x1 + x2) / 2, 0.55, (z1 + z2) / 2)
  rail.rotation.y = -Math.atan2(dz, dx)
  g.add(rail)
  const rail2 = rail.clone()
  rail2.position.y = 0.3
  g.add(rail2)
  return g
}

export function makeHay(x: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.7, 0.7),
    new THREE.MeshLambertMaterial({ color: COLORS.hay }),
  )
  m.position.set(x, 0.35, z)
  m.castShadow = true
  return m
}

export function makeCrate(x: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.55, 0.7),
    new THREE.MeshLambertMaterial({ color: COLORS.wood }),
  )
  m.position.set(x, 0.28, z)
  m.castShadow = true
  return m
}

const GEO = {
  crop: new THREE.BoxGeometry(0.45, 0.35, 0.45),
  jarBody: new THREE.CylinderGeometry(0.18, 0.2, 0.38, 8),
  jarLid: new THREE.CylinderGeometry(0.16, 0.16, 0.08, 8),
  egg: new THREE.SphereGeometry(0.18, 8, 8),
  bill: new THREE.BoxGeometry(0.55, 0.06, 0.3),
  wheat: new THREE.BoxGeometry(0.35, 0.55, 0.35),
}

const MAT = {
  crop: new THREE.MeshLambertMaterial({ color: COLORS.crop }),
  jarBody: new THREE.MeshLambertMaterial({ color: 0xf59e0b }),
  jarLid: new THREE.MeshLambertMaterial({ color: 0xb45309 }),
  egg: new THREE.MeshLambertMaterial({ color: 0xfff7ed }),
  bill: new THREE.MeshLambertMaterial({ color: COLORS.money }),
  wheat: new THREE.MeshLambertMaterial({ color: 0xca8a04 }),
}

export function makeCropItem(_color: number = COLORS.crop): THREE.Mesh {
  const m = new THREE.Mesh(GEO.crop, MAT.crop)
  m.userData.kind = 'crop'
  m.userData.value = 8
  return m
}

export function makeItem(kind: 'crop' | 'jar' | 'egg' | 'wheat'): THREE.Object3D {
  if (kind === 'jar') {
    const root = new THREE.Group()
    const body = new THREE.Mesh(GEO.jarBody, MAT.jarBody)
    const lid = new THREE.Mesh(GEO.jarLid, MAT.jarLid)
    lid.position.y = 0.22
    root.add(body)
    root.add(lid)
    root.userData.kind = 'jar'
    root.userData.value = 20
    return root
  }
  if (kind === 'egg') {
    const egg = new THREE.Mesh(GEO.egg, MAT.egg)
    egg.scale.set(1, 1.25, 1)
    egg.userData.kind = 'egg'
    egg.userData.value = 12
    return egg
  }
  if (kind === 'wheat') {
    const wheat = new THREE.Mesh(GEO.wheat, MAT.wheat)
    wheat.userData.kind = 'wheat'
    wheat.userData.value = 14
    return wheat
  }
  return makeCropItem()
}

export function makeBill(): THREE.Mesh {
  return new THREE.Mesh(GEO.bill, MAT.bill)
}

export function makeTractorMesh(): THREE.Group {
  const g = new THREE.Group()
  // Faces +Z (same as characters / moveToward)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.7, 1.6),
    new THREE.MeshLambertMaterial({ color: 0xeab308 }),
  )
  body.position.y = 0.55
  g.add(body)
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.6, 0.7),
    new THREE.MeshLambertMaterial({ color: 0x1d4ed8 }),
  )
  cabin.position.set(0, 1.1, 0.35)
  g.add(cabin)
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111827 })
  for (const [x, z, s] of [
    [0.55, 0.55, 0.45],
    [-0.55, 0.55, 0.45],
    [0.55, -0.55, 0.35],
    [-0.55, -0.55, 0.35],
  ] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(s, s, 0.25, 10), wheelMat)
    w.rotation.z = Math.PI / 2
    w.position.set(x, s, z)
    g.add(w)
  }
  const cargo = new THREE.Group()
  cargo.name = 'cargo'
  cargo.position.set(0, 1.0, -0.55)
  g.add(cargo)
  return g
}

export function makeProcessor(): THREE.Group {
  const g = new THREE.Group()
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.1, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x64748b }),
  )
  base.position.y = 0.55
  base.castShadow = true
  g.add(base)
  const funnel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.55, 0.7, 10),
    new THREE.MeshLambertMaterial({ color: 0x94a3b8 }),
  )
  funnel.position.set(0, 1.4, 0)
  g.add(funnel)
  const spout = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.25, 0.7),
    new THREE.MeshLambertMaterial({ color: 0x475569 }),
  )
  spout.position.set(0.9, 0.7, 0)
  g.add(spout)
  return g
}

export function makeBarn(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4, 2.2, 3.2),
    new THREE.MeshLambertMaterial({ color: 0xb91c1c }),
  )
  body.position.y = 1.1
  body.castShadow = true
  g.add(body)
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.8, 1.2, 4),
    new THREE.MeshLambertMaterial({ color: 0x7f1d1d }),
  )
  roof.position.y = 2.7
  roof.rotation.y = Math.PI / 4
  g.add(roof)
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.6, 0.1),
    new THREE.MeshLambertMaterial({ color: 0x78350f }),
  )
  door.position.set(0, 0.8, 1.65)
  g.add(door)
  return g
}

export function makeChicken(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 10),
    new THREE.MeshLambertMaterial({ color: 0xf8fafc }),
  )
  body.position.y = 0.35
  body.castShadow = true
  g.add(body)
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    new THREE.MeshLambertMaterial({ color: 0xf8fafc }),
  )
  head.position.set(0.18, 0.55, 0)
  g.add(head)
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.14, 6),
    new THREE.MeshLambertMaterial({ color: 0xf97316 }),
  )
  beak.rotation.z = -Math.PI / 2
  beak.position.set(0.32, 0.52, 0)
  g.add(beak)
  const comb = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.12, 0.08),
    new THREE.MeshLambertMaterial({ color: 0xdc2626 }),
  )
  comb.position.set(0.12, 0.72, 0)
  g.add(comb)
  return g
}

export function makeCoop(): THREE.Group {
  // Open on local -X; with rotation.y = π/2 that face points toward +Z (EGGS)
  const g = new THREE.Group()
  const wood = new THREE.MeshLambertMaterial({ color: 0xd97706 })
  const dark = new THREE.MeshLambertMaterial({ color: 0x92400e })

  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.8), dark)
  floor.position.y = 0.06
  g.add(floor)

  // Back wall (local +X)
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 1.8), wood)
  back.position.set(1.14, 0.72, 0)
  g.add(back)

  // Side walls (local ±Z)
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.35, 0.12), wood)
  sideL.position.set(0, 0.72, 0.84)
  g.add(sideL)
  const sideR = sideL.clone()
  sideR.position.z = -0.84
  g.add(sideR)

  // Roof (slightly overhanging, open side uncovered visually)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 2.0), dark)
  roof.position.set(0.05, 1.45, 0)
  roof.rotation.z = -0.12
  g.add(roof)

  return g
}

export function makeTruck(): THREE.Group {
  const g = new THREE.Group()
  // Cab faces +Z so moveToward rotation is correct
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.0, 1.2),
    new THREE.MeshLambertMaterial({ color: 0x2563eb }),
  )
  cab.position.set(0, 0.7, 1.1)
  g.add(cab)
  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.7, 2.2),
    new THREE.MeshLambertMaterial({ color: 0xe2e8f0 }),
  )
  bed.position.set(0, 0.55, -0.5)
  g.add(bed)
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111827 })
  for (const [x, z] of [
    [0.65, 1.0],
    [-0.65, 1.0],
    [0.65, -1.1],
    [-0.65, -1.1],
  ] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 10), wheelMat)
    w.rotation.z = Math.PI / 2
    w.position.set(x, 0.28, z)
    g.add(w)
  }
  const cargo = new THREE.Group()
  cargo.name = 'cargo'
  cargo.position.set(0, 1.0, -0.5)
  g.add(cargo)
  return g
}

export function makeCharacter(bodyColor: number): THREE.Group {
  const g = new THREE.Group()
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.45, 0.3),
    new THREE.MeshLambertMaterial({ color: COLORS.playerPants }),
  )
  legs.position.y = 0.25
  g.add(legs)

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.55, 0.35),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  )
  body.position.y = 0.7
  body.castShadow = true
  g.add(body)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 12),
    new THREE.MeshLambertMaterial({ color: COLORS.skin }),
  )
  head.position.y = 1.15
  head.castShadow = true
  g.add(head)

  g.userData.height = 1.3
  return g
}

export function makeCounter(): THREE.Group {
  const g = new THREE.Group()
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.9, 1.1),
    new THREE.MeshLambertMaterial({ color: COLORS.counter }),
  )
  base.position.y = 0.45
  base.castShadow = true
  g.add(base)

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.08, 1.2),
    new THREE.MeshLambertMaterial({ color: COLORS.counterTop }),
  )
  top.position.y = 0.94
  g.add(top)

  const register = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.35, 0.35),
    new THREE.MeshLambertMaterial({ color: 0x1e293b }),
  )
  register.position.set(0.7, 1.15, 0)
  g.add(register)

  return g
}

export function makeLabelSprite(text: string, color = '#ffffff'): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 256, 96)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  roundRect(ctx, 16, 16, 224, 64, 12)
  ctx.fill()
  ctx.fillStyle = color
  ctx.font = 'bold 42px Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 128, 48)
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(2.2, 0.85, 1)
  return sprite
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function makeZonePlane(w: number, d: number, color: number, opacity = 0.35): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  )
  m.rotation.x = -Math.PI / 2
  m.position.y = 0.03
  return m
}

export function makeFactory(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 2.2, 2.4),
    new THREE.MeshLambertMaterial({ color: 0x64748b }),
  )
  body.position.y = 1.1
  g.add(body)
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.25, 2.7),
    new THREE.MeshLambertMaterial({ color: 0x334155 }),
  )
  roof.position.y = 2.3
  g.add(roof)
  const chimney = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.3, 1.4, 8),
    new THREE.MeshLambertMaterial({ color: 0x475569 }),
  )
  chimney.position.set(1.0, 2.9, -0.5)
  g.add(chimney)
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.2, 0.1),
    new THREE.MeshLambertMaterial({ color: 0xf59e0b }),
  )
  door.position.set(0, 0.7, 1.25)
  g.add(door)
  return g
}

export function makeConveyorSegment(length = 2.2): THREE.Group {
  const g = new THREE.Group()
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.18, length),
    new THREE.MeshLambertMaterial({ color: 0x1e293b }),
  )
  belt.position.y = 0.2
  g.add(belt)
  const railL = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.28, length),
    new THREE.MeshLambertMaterial({ color: 0x94a3b8 }),
  )
  railL.position.set(-0.65, 0.28, 0)
  g.add(railL)
  const railR = railL.clone()
  railR.position.x = 0.65
  g.add(railR)
  return g
}

export function makeTrain(): THREE.Group {
  const g = new THREE.Group()
  const engine = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 1.4, 1.3),
    new THREE.MeshLambertMaterial({ color: 0xb91c1c }),
  )
  engine.position.set(0.4, 0.9, 0)
  g.add(engine)
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.1, 1.2),
    new THREE.MeshLambertMaterial({ color: 0x7f1d1d }),
  )
  cabin.position.set(-1.0, 1.15, 0)
  g.add(cabin)
  const car = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.85, 1.45),
    new THREE.MeshLambertMaterial({ color: 0x57534e }),
  )
  car.position.set(2.4, 0.7, 0)
  g.add(car)
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111827 })
  for (const [x, z] of [
    [-0.8, 0.55],
    [-0.8, -0.55],
    [0.4, 0.55],
    [0.4, -0.55],
    [1.9, 0.55],
    [1.9, -0.55],
    [2.9, 0.55],
    [2.9, -0.55],
  ] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 10), wheelMat)
    w.rotation.z = Math.PI / 2
    w.position.set(x, 0.28, z)
    g.add(w)
  }
  const cargo = new THREE.Group()
  cargo.name = 'cargo'
  cargo.position.set(2.4, 1.2, 0)
  g.add(cargo)
  return g
}

/** Straight track along +Z from zStart to zEnd (world coords via caller position). */
export function makeTrainRails(length: number): THREE.Group {
  const g = new THREE.Group()
  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.08, length),
    new THREE.MeshLambertMaterial({ color: 0x57534e }),
  )
  bed.position.y = 0.04
  g.add(bed)
  const railMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, length), railMat)
  railL.position.set(-0.42, 0.12, 0)
  g.add(railL)
  const railR = railL.clone()
  railR.position.x = 0.42
  g.add(railR)
  const tieMat = new THREE.MeshLambertMaterial({ color: 0x78350f })
  const tieCount = Math.max(2, Math.floor(length / 0.85))
  for (let i = 0; i < tieCount; i++) {
    const t = (i + 0.5) / tieCount - 0.5
    const tie = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.06, 0.22), tieMat)
    tie.position.set(0, 0.07, t * length)
    g.add(tie)
  }
  return g
}

/** Open cargo shed between belt end and train bay. */
export function makeTrainDepot(): THREE.Group {
  const g = new THREE.Group()
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.22, 3.2),
    new THREE.MeshLambertMaterial({ color: 0x78716c }),
  )
  platform.position.y = 0.12
  g.add(platform)
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.08, 2.6),
    new THREE.MeshLambertMaterial({ color: 0xa8a29e }),
  )
  deck.position.y = 0.26
  g.add(deck)
  const postMat = new THREE.MeshLambertMaterial({ color: 0x44403c })
  for (const [x, z] of [
    [-1.7, -1.2],
    [1.7, -1.2],
    [-1.7, 1.2],
    [1.7, 1.2],
  ] as const) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 0.22), postMat)
    post.position.set(x, 1.35, z)
    g.add(post)
  }
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.16, 3.4),
    new THREE.MeshLambertMaterial({ color: 0xb45309 }),
  )
  roof.position.y = 2.65
  g.add(roof)
  // Side walls only — open south to belt and north for the train bay
  const sideMat = new THREE.MeshLambertMaterial({ color: 0x57534e })
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.6, 2.8), sideMat)
  sideL.position.set(-1.95, 1.1, 0.1)
  g.add(sideL)
  const sideR = sideL.clone()
  sideR.position.x = 1.95
  g.add(sideR)
  const ramp = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.12, 1.2),
    new THREE.MeshLambertMaterial({ color: 0xa8a29e }),
  )
  ramp.position.set(0, 0.14, -1.9)
  ramp.rotation.x = -0.18
  g.add(ramp)
  return g
}

export function makePortalGate(color = 0xa855f7): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial({ color })
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.0, 0.25), mat)
  left.position.set(-0.95, 1.0, 0)
  g.add(left)
  const right = left.clone()
  right.position.x = 0.95
  g.add(right)
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.25, 0.25), mat)
  top.position.set(0, 2.05, 0)
  g.add(top)
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  glow.position.set(0, 1.0, 0)
  g.add(glow)
  return g
}

const GOODS_COLORS = [0xfbbf24, 0x22d3ee, 0xa855f7, 0xf43f5e]

export function makeGoods(tier: 0 | 1 | 2 | 3 = 0): THREE.Group {
  const g = new THREE.Group()
  const size = 0.45 + tier * 0.12
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshLambertMaterial({ color: GOODS_COLORS[tier] ?? GOODS_COLORS[0] }),
  )
  box.position.y = size * 0.5
  g.add(box)
  if (tier >= 2) {
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12 + tier * 0.03, 0),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
    )
    gem.position.y = size + 0.15
    g.add(gem)
  }
  g.userData.tier = tier
  return g
}
