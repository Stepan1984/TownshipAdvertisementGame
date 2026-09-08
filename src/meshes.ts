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

/**
 * Flat walkable asphalt ribbon along a closed curve (XZ plane).
 */
function makeFlatRoadRibbon(
  curve: THREE.CatmullRomCurve3,
  width: number,
  segments: number,
  y = 0.04,
  color = 0x57534e,
): THREE.Mesh {
  const pts = curve.getSpacedPoints(segments)
  const halfW = width * 0.5
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const pushVertexPair = (i: number) => {
    const p = pts[i]!
    const pNext = pts[(i + 1) % pts.length]!
    const pPrev = pts[(i - 1 + pts.length) % pts.length]!
    const tangent = pNext.clone().sub(pPrev).setY(0)
    if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0)
    else tangent.normalize()
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const left = p.clone().addScaledVector(side, halfW)
    const right = p.clone().addScaledVector(side, -halfW)
    left.y = y
    right.y = y
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z)
    normals.push(0, 1, 0, 0, 1, 0)
    const v = i / pts.length
    uvs.push(0, v * 24, 1, v * 24)
  }

  for (let i = 0; i < pts.length; i++) pushVertexPair(i)
  pushVertexPair(0)

  const ring = pts.length
  for (let i = 0; i < ring; i++) {
    const a = i * 2
    // CCW from above: left → nextLeft → right
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  // BasicMaterial: same look as rail ballast, not crushed to black by lighting
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
  )
}

function offsetTrackPoints(curve: THREE.CatmullRomCurve3, offset: number, segments: number) {
  const pts = curve.getSpacedPoints(segments)
  const out: THREE.Vector3[] = []
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const pNext = pts[(i + 1) % pts.length]!
    const pPrev = pts[(i - 1 + pts.length) % pts.length]!
    const tangent = pNext.clone().sub(pPrev).setY(0)
    if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0)
    else tangent.normalize()
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x)
    out.push(p.clone().addScaledVector(side, offset))
  }
  return out
}

/** Axis-aligned collision segment in local XZ (player slides off these). */
export type TrackWallSeg = { ax: number; az: number; bx: number; bz: number; halfT: number }

/** Continuous wall: box depth = segment length, yaw aligns local Z with the road. */
function addBarrierChain(
  parent: THREE.Group,
  points: THREE.Vector3[],
  height: number,
  thickness: number,
  color: number,
  skipIndex?: (i: number, n: number) => boolean,
): TrackWallSeg[] {
  const mat = new THREE.MeshLambertMaterial({ color })
  const walls: TrackWallSeg[] = []
  const n = points.length
  for (let i = 0; i < n; i++) {
    if (skipIndex?.(i, n)) continue
    const a = points[i]!
    const b = points[(i + 1) % n]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    if (len < 0.05) continue
    const wall = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, len), mat)
    wall.position.set((a.x + b.x) * 0.5, height * 0.5, (a.z + b.z) * 0.5)
    wall.rotation.y = Math.atan2(dx, dz)
    parent.add(wall)
    walls.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, halfT: thickness * 0.5 + 0.08 })
  }
  return walls
}

function addPaintedKerbs(
  parent: THREE.Group,
  curve: THREE.CatmullRomCurve3,
  edgeOffset: number,
  segments: number,
) {
  const pts = offsetTrackPoints(curve, edgeOffset, segments)
  const red = new THREE.MeshLambertMaterial({ color: 0xef4444 })
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff })
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    if (len < 0.08) continue
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, len * 0.98), i % 2 === 0 ? red : white)
    slab.position.set((a.x + b.x) * 0.5, 0.07, (a.z + b.z) * 0.5)
    slab.rotation.y = Math.atan2(dx, dz)
    parent.add(slab)
  }
}

/**
 * Norisring (Nürnberg): flat walkable street circuit.
 * Layout: SF → Grundigkehre → Schöller-S → Dutzendteichkehre → SF.
 */
export function makeNorisring(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'norisring'

  const S = 3.35
  const layout = [
    new THREE.Vector3(-7 * S, 0, -11 * S),
    new THREE.Vector3(-7 * S, 0, -4 * S),
    new THREE.Vector3(-7 * S, 0, 3 * S),
    new THREE.Vector3(-6 * S, 0, 9 * S),
    new THREE.Vector3(-3 * S, 0, 13 * S),
    new THREE.Vector3(1 * S, 0, 14.5 * S),
    new THREE.Vector3(5 * S, 0, 13 * S),
    new THREE.Vector3(7 * S, 0, 9 * S),
    new THREE.Vector3(7.5 * S, 0, 4 * S),
    new THREE.Vector3(8.8 * S, 0, 1.5 * S),
    new THREE.Vector3(5.8 * S, 0, -0.4 * S),
    new THREE.Vector3(8.2 * S, 0, -2.8 * S),
    new THREE.Vector3(7.5 * S, 0, -7 * S),
    new THREE.Vector3(6 * S, 0, -11 * S),
    new THREE.Vector3(3 * S, 0, -14 * S),
    new THREE.Vector3(-1 * S, 0, -14.5 * S),
    new THREE.Vector3(-5 * S, 0, -13 * S),
    new THREE.Vector3(-7 * S, 0, -11 * S),
  ]
  const curve = new THREE.CatmullRomCurve3(layout, true, 'catmullrom', 0.4)
  const trackWidth = 5.2
  const halfW = trackWidth * 0.5

  // Asphalt = same hex as train rail ballast (0x57534e)
  const ASPHALT = 0x57534e
  const shoulder = makeFlatRoadRibbon(curve, trackWidth + 2.2, 200, 0.03, ASPHALT)
  shoulder.name = 'asphalt-shoulder'
  g.add(shoulder)
  const road = makeFlatRoadRibbon(curve, trackWidth, 240, 0.06, ASPHALT)
  road.name = 'asphalt'
  road.receiveShadow = true
  g.add(road)

  addPaintedKerbs(g, curve, halfW - 0.12, 128)
  addPaintedKerbs(g, curve, -(halfW - 0.12), 128)

  // Outer barrier opens at the northern tip (toward the farm) for pit entry
  const outerPts = offsetTrackPoints(curve, halfW + 1.15, 110)
  let northI = 0
  for (let i = 1; i < outerPts.length; i++) {
    if (outerPts[i]!.z > outerPts[northI]!.z) northI = i
  }
  const gapHalf = 4 // ~8 segments ≈ 4–5 u wide entrance
  const inEntranceGap = (i: number, n: number) => {
    const d = Math.min(Math.abs(i - northI), n - Math.abs(i - northI))
    return d <= gapHalf
  }
  const outerWalls = addBarrierChain(g, outerPts, 0.85, 0.22, 0xd4d4d8, inEntranceGap)
  const innerWalls = addBarrierChain(
    g,
    offsetTrackPoints(curve, -(halfW + 1.15), 110),
    0.85,
    0.22,
    0xd4d4d8,
  )
  g.userData.walls = [...outerWalls, ...innerWalls] as TrackWallSeg[]

  // Gate posts at the entrance (no apron / label)
  const gateA = outerPts[(northI - gapHalf + outerPts.length) % outerPts.length]!
  const gateB = outerPts[(northI + gapHalf) % outerPts.length]!
  const gateMid = new THREE.Vector3(
    (gateA.x + gateB.x) * 0.5,
    0,
    (gateA.z + gateB.z) * 0.5,
  )
  const postMat = new THREE.MeshLambertMaterial({ color: 0x78716c })
  for (const p of [gateA, gateB]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.5, 0.35), postMat)
    post.position.set(p.x, 0.75, p.z)
    g.add(post)
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xef4444 }),
    )
    cap.position.set(p.x, 1.55, p.z)
    g.add(cap)
  }
  g.userData.entrance = { x: gateMid.x, z: gateMid.z + 1.4 }

  const dashMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc })
  const spaced = curve.getSpacedPoints(100)
  for (let i = 0; i < spaced.length; i += 2) {
    const p = spaced[i]!
    const q = spaced[(i + 1) % spaced.length]!
    const dx = q.x - p.x
    const dz = q.z - p.z
    const len = Math.min(Math.hypot(dx, dz), 1.15)
    if (len < 0.25) continue
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, len * 0.8), dashMat)
    dash.position.set((p.x + q.x) * 0.5, 0.08, (p.z + q.z) * 0.5)
    dash.rotation.y = Math.atan2(dx, dz)
    g.add(dash)
  }

  const sfX = -7 * S
  const sfZ = -2 * S
  for (let i = 0; i < 8; i++) {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(trackWidth / 8, 0.05, 0.65),
      new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? 0xffffff : 0x111827 }),
    )
    block.position.set(sfX - halfW + trackWidth / 16 + i * (trackWidth / 8), 0.085, sfZ)
    g.add(block)
  }

  const tribune = new THREE.Group()
  tribune.position.set(-12.8 * S, 0, 0)
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7, 1.4, 22 * S * 0.55),
    new THREE.MeshLambertMaterial({ color: 0xa8a29e }),
  )
  base.position.y = 0.7
  tribune.add(base)
  for (let i = 0; i < 7; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(6.2 - i * 0.4, 0.4, 21 * S * 0.55),
      new THREE.MeshLambertMaterial({ color: 0xd6d3d1 }),
    )
    step.position.set(-0.3 - i * 0.18, 1.25 + i * 0.38, 0)
    tribune.add(step)
  }
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 4.2, 22 * S * 0.55),
    new THREE.MeshLambertMaterial({ color: 0x78716c }),
  )
  wall.position.set(-3.4, 2.1, 0)
  tribune.add(wall)
  g.add(tribune)

  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(4.5 * S * 0.55, 24),
    new THREE.MeshLambertMaterial({ color: 0x38bdf8 }),
  )
  lake.rotation.x = -Math.PI / 2
  lake.position.set(10 * S * 0.7, 0.02, -14 * S)
  g.add(lake)

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

  const yellow = new THREE.MeshLambertMaterial({ color: 0xeab308 })
  const darkYellow = new THREE.MeshLambertMaterial({ color: 0xca8a04 })
  const black = new THREE.MeshLambertMaterial({ color: 0x1c1917 })
  const steel = new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
  const glass = new THREE.MeshLambertMaterial({ color: 0x7dd3fc })
  const rubber = new THREE.MeshLambertMaterial({ color: 0x111827 })

  // Chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 1.85), black)
  chassis.position.y = 0.42
  g.add(chassis)

  // Engine hood (front)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.95), yellow)
  hood.position.set(0, 0.75, 0.55)
  g.add(hood)
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.08), steel)
  grille.position.set(0, 0.72, 1.05)
  g.add(grille)
  for (const x of [-0.28, 0.28] as const) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshLambertMaterial({ color: 0xfef08a }))
    light.position.set(x, 0.7, 1.08)
    g.add(light)
  }

  // Exhaust stack
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 8), black)
  stack.position.set(-0.38, 1.25, 0.35)
  g.add(stack)

  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 0.7), darkYellow)
  cabin.position.set(0, 1.15, -0.15)
  g.add(cabin)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.08, 0.78), black)
  roof.position.set(0, 1.55, -0.15)
  g.add(roof)
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.35, 0.05), glass)
  windshield.position.set(0, 1.2, 0.22)
  g.add(windshield)
  for (const x of [-0.46, 0.46] as const) {
    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.45), glass)
    sideWin.position.set(x, 1.2, -0.15)
    g.add(sideWin)
  }

  // Fenders over rear wheels
  for (const x of [-0.55, 0.55] as const) {
    const fender = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.7), yellow)
    fender.position.set(x, 0.85, -0.55)
    g.add(fender)
  }

  // Large rear wheels + smaller front
  const addWheel = (x: number, z: number, r: number, width: number) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 12), rubber)
    w.rotation.z = Math.PI / 2
    w.position.set(x, r, z)
    g.add(w)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, width + 0.04, 8), steel)
    hub.rotation.z = Math.PI / 2
    hub.position.copy(w.position)
    g.add(hub)
  }
  addWheel(0.58, -0.55, 0.48, 0.32)
  addWheel(-0.58, -0.55, 0.48, 0.32)
  addWheel(0.48, 0.7, 0.28, 0.22)
  addWheel(-0.48, 0.7, 0.28, 0.22)

  // Front weight / bumper
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.2), steel)
  bumper.position.set(0, 0.35, 1.15)
  g.add(bumper)

  const cargo = new THREE.Group()
  cargo.name = 'cargo'
  cargo.position.set(0, 1.05, -0.55)
  g.add(cargo)
  return g
}

/** Hitch + wagon bed behind the tractor; holds overflow harvest. */
export function attachTractorTrailer(tractor: THREE.Group): THREE.Group {
  if (tractor.getObjectByName('trailer')) return tractor.getObjectByName('trailer') as THREE.Group

  const trailer = new THREE.Group()
  trailer.name = 'trailer'
  trailer.position.set(0, 0, -2.05)

  const hitch = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.55),
    new THREE.MeshLambertMaterial({ color: 0x57534e }),
  )
  hitch.position.set(0, 0.35, 0.85)
  trailer.add(hitch)

  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.22, 1.7),
    new THREE.MeshLambertMaterial({ color: 0xa16207 }),
  )
  bed.position.set(0, 0.55, -0.15)
  trailer.add(bed)

  const railMat = new THREE.MeshLambertMaterial({ color: 0x854d0e })
  for (const [x, z, sx, sz] of [
    [0, 0.65, 1.35, 0.1],
    [0, -0.95, 1.35, 0.1],
    [0.62, -0.15, 0.1, 1.7],
    [-0.62, -0.15, 0.1, 1.7],
  ] as const) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.45, sz), railMat)
    rail.position.set(x, 0.85, z)
    trailer.add(rail)
  }

  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111827 })
  for (const [x, z] of [
    [0.65, -0.35],
    [-0.65, -0.35],
    [0.65, -0.95],
    [-0.65, -0.95],
  ] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 10), wheelMat)
    w.rotation.z = Math.PI / 2
    w.position.set(x, 0.28, z)
    trailer.add(w)
  }

  const cargo = new THREE.Group()
  cargo.name = 'trailerCargo'
  cargo.position.set(0, 0.78, -0.15)
  trailer.add(cargo)

  tractor.add(trailer)
  return trailer
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

/** Simple player-drivable kart / street car. Faces +Z. */
export function makeRaceCar(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'raceCar'

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2563eb })
  const dark = new THREE.MeshLambertMaterial({ color: 0x1e3a8a })
  const black = new THREE.MeshLambertMaterial({ color: 0x1c1917 })
  const glass = new THREE.MeshLambertMaterial({ color: 0x7dd3fc })
  const steel = new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
  const rubber = new THREE.MeshLambertMaterial({ color: 0x111827 })

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 2.1), dark)
  chassis.position.y = 0.35
  g.add(chassis)

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.9), bodyMat)
  body.position.y = 0.58
  g.add(body)

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 0.85), dark)
  cabin.position.set(0, 0.95, -0.1)
  g.add(cabin)

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 0.05), glass)
  windshield.position.set(0, 0.95, 0.35)
  g.add(windshield)

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.22, 0.55), bodyMat)
  hood.position.set(0, 0.72, 0.75)
  g.add(hood)

  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 0.18), black)
  bumperF.position.set(0, 0.32, 1.15)
  g.add(bumperF)
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 0.18), black)
  bumperR.position.set(0, 0.32, -1.15)
  g.add(bumperR)

  for (const x of [-0.35, 0.35] as const) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshLambertMaterial({ color: 0xfef9c3 }))
    light.position.set(x, 0.55, 1.12)
    g.add(light)
  }

  const addWheel = (x: number, z: number) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12), rubber)
    w.rotation.z = Math.PI / 2
    w.position.set(x, 0.28, z)
    g.add(w)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 8), steel)
    hub.rotation.z = Math.PI / 2
    hub.position.copy(w.position)
    g.add(hub)
  }
  addWheel(0.58, 0.7)
  addWheel(-0.58, 0.7)
  addWheel(0.58, -0.75)
  addWheel(-0.58, -0.75)

  return g
}

/** Low hypercar — wider stance, rear wing, darker body. */
export function makeSuperRaceCar(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'superCar'

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x0f172a })
  const accent = new THREE.MeshLambertMaterial({ color: 0xf59e0b })
  const dark = new THREE.MeshLambertMaterial({ color: 0x020617 })
  const black = new THREE.MeshLambertMaterial({ color: 0x1c1917 })
  const glass = new THREE.MeshLambertMaterial({ color: 0x38bdf8 })
  const steel = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 })
  const rubber = new THREE.MeshLambertMaterial({ color: 0x0a0a0a })

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.22, 2.35), dark)
  chassis.position.y = 0.28
  g.add(chassis)

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.32, 2.15), bodyMat)
  body.position.y = 0.48
  g.add(body)

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 2.0), accent)
  stripe.position.y = 0.5
  g.add(stripe)

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.38, 0.95), dark)
  cabin.position.set(0, 0.78, -0.05)
  g.add(cabin)

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 0.9), glass)
  canopy.position.set(0, 1.0, -0.05)
  g.add(canopy)

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.28, 0.05), glass)
  windshield.position.set(0, 0.82, 0.42)
  g.add(windshield)

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.18, 0.55), bodyMat)
  nose.position.set(0, 0.42, 1.05)
  g.add(nose)

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.28), accent)
  splitter.position.set(0, 0.18, 1.28)
  g.add(splitter)

  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.16), black)
  bumperF.position.set(0, 0.26, 1.32)
  g.add(bumperF)

  for (const x of [-0.42, 0.42] as const) {
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.08, 0.06),
      new THREE.MeshLambertMaterial({ color: 0xfef9c3 }),
    )
    light.position.set(x, 0.4, 1.3)
    g.add(light)
  }

  const wingPosts = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.28, 0.08), steel)
  wingPosts.position.set(0, 0.72, -1.05)
  g.add(wingPosts)
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.35), accent)
  wing.position.set(0, 0.92, -1.05)
  g.add(wing)

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, 0.3), black)
  diffuser.position.set(0, 0.2, -1.2)
  g.add(diffuser)

  for (const x of [-0.78, 0.78] as const) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.55), dark)
    intake.position.set(x, 0.45, 0.15)
    g.add(intake)
  }

  const addWheel = (x: number, z: number, r: number) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.28, 14), rubber)
    w.rotation.z = Math.PI / 2
    w.position.set(x, r, z)
    g.add(w)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.38, r * 0.38, 0.3, 8), steel)
    hub.rotation.z = Math.PI / 2
    hub.position.copy(w.position)
    g.add(hub)
  }
  addWheel(0.72, 0.78, 0.32)
  addWheel(-0.72, 0.78, 0.32)
  addWheel(0.75, -0.85, 0.34)
  addWheel(-0.75, -0.85, 0.34)

  return g
}

export function makeTruck(): THREE.Group {
  const g = new THREE.Group()
  // Cab faces +Z so moveToward rotation is correct

  const blue = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 })
  const darkBlue = new THREE.MeshLambertMaterial({ color: 0x1e3a8a })
  const white = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
  const black = new THREE.MeshLambertMaterial({ color: 0x1c1917 })
  const steel = new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
  const glass = new THREE.MeshLambertMaterial({ color: 0x7dd3fc })
  const rubber = new THREE.MeshLambertMaterial({ color: 0x111827 })
  const orange = new THREE.MeshLambertMaterial({ color: 0xf97316 })

  // Frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 3.2), black)
  frame.position.y = 0.38
  g.add(frame)

  // Cab
  const cabLower = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.55, 1.15), blue)
  cabLower.position.set(0, 0.72, 1.05)
  g.add(cabLower)
  const cabUpper = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 1.0), darkBlue)
  cabUpper.position.set(0, 1.25, 1.0)
  g.add(cabUpper)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 1.05), black)
  roof.position.set(0, 1.56, 1.0)
  g.add(roof)

  // Hood / nose
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.55), blue)
  hood.position.set(0, 0.72, 1.75)
  g.add(hood)
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 0.06), steel)
  grille.position.set(0, 0.7, 2.05)
  g.add(grille)
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.18, 0.22), steel)
  bumper.position.set(0, 0.38, 2.15)
  g.add(bumper)
  for (const x of [-0.4, 0.4] as const) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshLambertMaterial({ color: 0xfef9c3 }))
    hl.position.set(x, 0.68, 2.08)
    g.add(hl)
  }
  for (const x of [-0.55, 0.55] as const) {
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.12), black)
    mir.position.set(x, 1.15, 1.45)
    g.add(mir)
  }

  // Windshield + side glass
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 0.05), glass)
  windshield.position.set(0, 1.25, 1.52)
  g.add(windshield)
  for (const x of [-0.66, 0.66] as const) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.7), glass)
    sw.position.set(x, 1.25, 1.0)
    g.add(sw)
  }

  // Cargo box
  const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 2.0), white)
  bedFloor.position.set(0, 0.58, -0.55)
  g.add(bedFloor)
  const wallH = 0.75
  const wallY = 0.58 + wallH * 0.5
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallH, 2.0), white)
  sideL.position.set(0.7, wallY, -0.55)
  g.add(sideL)
  const sideR = sideL.clone()
  sideR.position.x = -0.7
  g.add(sideR)
  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(1.45, wallH, 0.08), white)
  frontWall.position.set(0, wallY, 0.42)
  g.add(frontWall)
  const rearWall = new THREE.Mesh(new THREE.BoxGeometry(1.45, wallH * 0.85, 0.08), white)
  rearWall.position.set(0, wallY - 0.05, -1.52)
  g.add(rearWall)
  // Roof rails
  for (const x of [-0.55, 0.55] as const) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.9), steel)
    rail.position.set(x, 1.4, -0.55)
    g.add(rail)
  }
  // Marker lights
  for (const x of [-0.5, 0, 0.5] as const) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.06), orange)
    m.position.set(x, 1.52, 1.45)
    g.add(m)
  }

  const addWheel = (x: number, z: number, r = 0.3) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.28, 12), rubber)
    w.rotation.z = Math.PI / 2
    w.position.set(x, r, z)
    g.add(w)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8), steel)
    hub.rotation.z = Math.PI / 2
    hub.position.copy(w.position)
    g.add(hub)
  }
  addWheel(0.7, 1.15)
  addWheel(-0.7, 1.15)
  addWheel(0.7, -0.35)
  addWheel(-0.7, -0.35)
  addWheel(0.7, -1.15)
  addWheel(-0.7, -1.15)

  const cargo = new THREE.Group()
  cargo.name = 'cargo'
  cargo.position.set(0, 0.75, -0.55)
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

/** Large wooden sandbox pad where the tractor dumps crops. */
export function makeDumpSandbox(sizeX = 5.2, sizeZ = 4.0): THREE.Group {
  const g = new THREE.Group()
  g.name = 'dumpSandbox'

  const wood = new THREE.MeshLambertMaterial({ color: 0x8b5a2b })
  const woodDark = new THREE.MeshLambertMaterial({ color: 0x6b4423 })
  const sand = new THREE.MeshLambertMaterial({ color: 0xe7c48a })
  const sandDeep = new THREE.MeshLambertMaterial({ color: 0xd2a679 })
  const board = 0.32
  const wallH = 0.42
  const innerX = sizeX - board * 2
  const innerZ = sizeZ - board * 2

  // Raised sand bed
  const bed = new THREE.Mesh(new THREE.BoxGeometry(innerX, 0.22, innerZ), sand)
  bed.position.y = 0.12
  bed.receiveShadow = true
  g.add(bed)

  // Softer top sand slab
  const top = new THREE.Mesh(new THREE.BoxGeometry(innerX - 0.15, 0.06, innerZ - 0.15), sandDeep)
  top.position.y = 0.25
  g.add(top)

  // Raked furrows for sandbox feel
  const furrowN = 5
  for (let i = 0; i < furrowN; i++) {
    const t = i / (furrowN - 1)
    const z = (t - 0.5) * (innerZ - 0.7)
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(innerX - 0.45, 0.04, 0.18),
      i % 2 === 0 ? sand : sandDeep,
    )
    ridge.position.set(0, 0.29, z)
    g.add(ridge)
  }

  // Wooden frame (four planks)
  const longN = new THREE.Mesh(new THREE.BoxGeometry(sizeX, wallH, board), wood)
  longN.position.set(0, wallH * 0.5, sizeZ * 0.5 - board * 0.5)
  g.add(longN)
  const longS = longN.clone()
  longS.material = woodDark
  longS.position.z = -sizeZ * 0.5 + board * 0.5
  g.add(longS)
  const shortE = new THREE.Mesh(new THREE.BoxGeometry(board, wallH, sizeZ - board * 2), woodDark)
  shortE.position.set(sizeX * 0.5 - board * 0.5, wallH * 0.5, 0)
  g.add(shortE)
  const shortW = shortE.clone()
  shortW.material = wood
  shortW.position.x = -sizeX * 0.5 + board * 0.5
  g.add(shortW)

  // Corner posts
  const postGeo = new THREE.BoxGeometry(0.38, 0.7, 0.38)
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const post = new THREE.Mesh(postGeo, woodDark)
    post.position.set(sx * (sizeX * 0.5 - 0.12), 0.35, sz * (sizeZ * 0.5 - 0.12))
    g.add(post)
  }

  // Small entrance notch on the north side (toward shop) — lower lip
  const lip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, board * 0.7), wood)
  lip.position.set(0, 0.08, sizeZ * 0.5 - board * 0.35)
  g.add(lip)

  return g
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
  // Local −X = nose (north in world after rot.y=π/2); +X = cargo toward depot.

  const metal = new THREE.MeshLambertMaterial({ color: 0x44403c })
  const red = new THREE.MeshLambertMaterial({ color: 0xb91c1c })
  const darkRed = new THREE.MeshLambertMaterial({ color: 0x7f1d1d })
  const black = new THREE.MeshLambertMaterial({ color: 0x1c1917 })
  const yellow = new THREE.MeshLambertMaterial({ color: 0xfbbf24 })
  const glass = new THREE.MeshLambertMaterial({ color: 0x7dd3fc })
  const steel = new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
  const wood = new THREE.MeshLambertMaterial({ color: 0x78716c })

  const addBogie = (parent: THREE.Object3D, x: number) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.18, 1.15), metal)
    frame.position.set(x, 0.32, 0)
    parent.add(frame)
    for (const [wx, wz] of [
      [-0.28, 0.48],
      [0.28, 0.48],
      [-0.28, -0.48],
      [0.28, -0.48],
    ] as const) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.18, 12), black)
      w.rotation.z = Math.PI / 2
      w.position.set(x + wx, 0.26, wz)
      parent.add(w)
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 8), steel)
      hub.rotation.z = Math.PI / 2
      hub.position.copy(w.position)
      parent.add(hub)
    }
  }

  // —— Locomotive ——
  const loco = new THREE.Group()
  loco.name = 'loco'

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, 1.25), metal)
  chassis.position.set(-0.55, 0.55, 0)
  loco.add(chassis)

  // Long hood / engine block toward the nose (−X)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.95, 1.05), red)
  hood.position.set(-0.95, 1.15, 0)
  loco.add(hood)
  const hoodTop = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 0.95), darkRed)
  hoodTop.position.set(-0.95, 1.68, 0)
  loco.add(hoodTop)

  // Exhaust / fan housing
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.35, 10), black)
  stack.position.set(-1.35, 1.95, 0)
  loco.add(stack)
  const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12), metal)
  fan.position.set(-0.55, 1.78, 0)
  loco.add(fan)

  // Cabin (rear of loco, toward coupler)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 1.2), darkRed)
  cabin.position.set(0.35, 1.35, 0)
  loco.add(cabin)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 1.28), black)
  roof.position.set(0.35, 1.98, 0)
  loco.add(roof)
  // Windows
  for (const [wx, wz] of [
    [0.35, 0.58],
    [0.35, -0.58],
  ] as const) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.06), glass)
    win.position.set(wx, 1.45, wz)
    loco.add(win)
  }
  const frontWin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.7), glass)
  frontWin.position.set(-0.14, 1.48, 0)
  loco.add(frontWin)

  // Nose plow / buffer beam
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 1.15), red)
  nose.position.set(-1.9, 0.85, 0)
  loco.add(nose)
  const buffer = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 1.3), yellow)
  buffer.position.set(-2.15, 0.55, 0)
  loco.add(buffer)
  for (const z of [-0.35, 0.35] as const) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), yellow)
    light.position.set(-2.28, 0.95, z)
    loco.add(light)
  }

  // Side handrails
  for (const z of [-0.58, 0.58] as const) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.05), steel)
    rail.position.set(-0.9, 1.35, z)
    loco.add(rail)
  }

  addBogie(loco, -1.35)
  addBogie(loco, 0.15)

  // Coupler toward freight car
  const coupler = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.22), steel)
  coupler.position.set(1.05, 0.55, 0)
  loco.add(coupler)

  g.add(loco)

  // —— Open gondola freight car ——
  const car = new THREE.Group()
  car.name = 'freight'
  car.position.set(2.55, 0, 0)

  const carFrame = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.22, 1.35), metal)
  carFrame.position.y = 0.55
  car.add(carFrame)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.1, 1.25), wood)
  floor.position.y = 0.7
  car.add(floor)

  // Gondola walls
  const wallH = 0.7
  const wallY = 0.7 + wallH * 0.5
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(2.35, wallH, 0.08), steel)
  sideL.position.set(0, wallY, 0.62)
  car.add(sideL)
  const sideR = sideL.clone()
  sideR.position.z = -0.62
  car.add(sideR)
  const endF = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallH, 1.25), steel)
  endF.position.set(-1.14, wallY, 0)
  car.add(endF)
  const endB = endF.clone()
  endB.position.x = 1.14
  car.add(endB)

  // Ribs on sides
  for (const x of [-0.7, 0, 0.7] as const) {
    for (const z of [-0.62, 0.62] as const) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallH + 0.05, 0.1), metal)
      rib.position.set(x, wallY, z)
      car.add(rib)
    }
  }

  addBogie(car, -0.7)
  addBogie(car, 0.7)

  const hitch = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.2), steel)
  hitch.position.set(-1.4, 0.55, 0)
  car.add(hitch)

  g.add(car)

  const cargo = new THREE.Group()
  cargo.name = 'cargo'
  // Sit inside the gondola bed (world-ish local to train root)
  cargo.position.set(2.55, 0.85, 0)
  g.add(cargo)

  return g
}

/** Rail bed + tracks following a world-space curve (XZ). */
export function makeTrainRailsAlong(curve: THREE.Curve<THREE.Vector3>, samples = 120): THREE.Group {
  const g = new THREE.Group()
  g.name = 'trainRails'
  const pts = curve.getSpacedPoints(samples)
  const ballastMat = new THREE.MeshLambertMaterial({ color: 0x57534e })
  const railMat = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 })
  const tieMat = new THREE.MeshLambertMaterial({ color: 0x78350f })
  const gauge = 0.45

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    if (len < 0.05) continue
    const yaw = Math.atan2(dx, dz)
    const mx = (a.x + b.x) * 0.5
    const mz = (a.z + b.z) * 0.5
    const sideX = Math.cos(yaw) * gauge
    const sideZ = -Math.sin(yaw) * gauge

    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, len + 0.05), ballastMat)
    bed.position.set(mx, 0.04, mz)
    bed.rotation.y = yaw
    g.add(bed)

    for (const sign of [-1, 1] as const) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, len + 0.04), railMat)
      rail.position.set(mx + sideX * sign, 0.14, mz + sideZ * sign)
      rail.rotation.y = yaw
      g.add(rail)
    }

    if (i % 2 === 0) {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.06, 0.2), tieMat)
      tie.position.set(mx, 0.08, mz)
      tie.rotation.y = yaw
      g.add(tie)
    }
  }
  return g
}

/** @deprecated straight N–S stub — prefer makeTrainRailsAlong */
export function makeTrainRails(length: number): THREE.Group {
  const g = new THREE.Group()
  const ballast = new THREE.Mesh(
    new THREE.BoxGeometry(1.85, 0.1, length),
    new THREE.MeshLambertMaterial({ color: 0x57534e }),
  )
  ballast.position.y = 0.04
  g.add(ballast)
  const railMat = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 })
  for (const x of [-0.45, 0.45] as const) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, length), railMat)
    rail.position.set(x, 0.14, 0)
    g.add(rail)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, length), railMat)
    head.position.set(x, 0.2, 0)
    g.add(head)
  }
  const tieMat = new THREE.MeshLambertMaterial({ color: 0x78350f })
  const tieCount = Math.max(2, Math.floor(length / 0.7))
  for (let i = 0; i < tieCount; i++) {
    const t = (i + 0.5) / tieCount - 0.5
    const tie = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.07, 0.2), tieMat)
    tie.position.set(0, 0.08, t * length)
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

/** Overhead irrigation pipes + sprinklers sized to a field footprint. tier 2 = denser. */
export function makeIrrigation(halfW: number, halfD: number, tier: 1 | 2 = 1): THREE.Group {
  const g = new THREE.Group()
  g.name = 'irrigation'
  const pipeMat = new THREE.MeshLambertMaterial({ color: 0x64748b })
  const headMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 })
  const sprayMat = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: tier === 2 ? 0.28 : 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

  const cols = tier === 2 ? 4 : 3
  const rows = tier === 2 ? 4 : 3
  const marginX = halfW * 0.78
  const marginZ = halfD * 0.78
  const xs: number[] = []
  const zs: number[] = []
  for (let c = 0; c < cols; c++) {
    xs.push(-marginX + (2 * marginX * c) / (cols - 1))
  }
  for (let r = 0; r < rows; r++) {
    zs.push(-marginZ + (2 * marginZ * r) / (rows - 1))
  }

  const x0 = xs[0]!
  const x1 = xs[cols - 1]!
  const z0 = zs[0]!
  const z1 = zs[rows - 1]!
  const lenX = Math.max(0.2, x1 - x0)
  const lenZ = Math.max(0.2, z1 - z0)
  const pipeY = 1.4 + (tier === 2 ? 0.1 : 0)

  // Frame pipes sit exactly on the sprinkler grid (row + column bars)
  for (const z of zs) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(lenX + 0.18, 0.1, 0.1), pipeMat)
    bar.position.set((x0 + x1) / 2, pipeY, z)
    g.add(bar)
  }
  for (const x of xs) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, lenZ + 0.18), pipeMat)
    bar.position.set(x, pipeY, (z0 + z1) / 2)
    g.add(bar)
  }

  const sprays = new THREE.Group()
  sprays.name = 'sprays'
  const riserH = pipeY - 0.12
  for (const z of zs) {
    for (const x of xs) {
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, riserH, 6), pipeMat)
      riser.position.set(x, riserH * 0.5 + 0.06, z)
      g.add(riser)
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), headMat)
      head.position.set(x, pipeY + 0.05, z)
      g.add(head)
      const spray = new THREE.Mesh(
        new THREE.CircleGeometry(0.5 + tier * 0.18, 16),
        sprayMat.clone(),
      )
      spray.rotation.x = -Math.PI / 2
      spray.position.set(x, 0.32 + tier * 0.06, z)
      sprays.add(spray)
    }
  }
  g.add(sprays)

  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.4, 0.9, 10),
    new THREE.MeshLambertMaterial({ color: 0x0ea5e9 }),
  )
  tank.position.set(-halfW + 0.35, 0.5, halfD - 0.35)
  g.add(tank)
  const tankTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.08, 10),
    new THREE.MeshLambertMaterial({ color: 0x0369a1 }),
  )
  tankTop.position.set(tank.position.x, 0.98, tank.position.z)
  g.add(tankTop)

  // Feeder from tank into nearest corner of the grid
  const feed = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, Math.hypot(xs[0]! - tank.position.x, zs[0]! - tank.position.z)),
    pipeMat,
  )
  feed.position.set(
    (xs[0]! + tank.position.x) / 2,
    pipeY,
    (zs[0]! + tank.position.z) / 2,
  )
  feed.rotation.y = Math.atan2(xs[0]! - tank.position.x, zs[0]! - tank.position.z)
  g.add(feed)
  const riserTank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, pipeY - 0.9, 6),
    pipeMat,
  )
  riserTank.position.set(tank.position.x, (pipeY + 0.9) / 2, tank.position.z)
  g.add(riserTank)

  g.userData.tier = tier
  return g
}
