import * as THREE from 'three'
import { Input } from './input'
import {
  COLORS,
  makeBarn,
  makeBill,
  makeCharacter,
  makeChicken,
  makeConveyorSegment,
  makeCoop,
  makeCounter,
  makeCropItem,
  makeFactory,
  makeFence,
  makeGoods,
  makeGround,
  makeItem,
  makeLabelSprite,
  makePortalGate,
  makeProcessor,
  makeTractorMesh,
  makeTrain,
  makeTrainDepot,
  makeTrainRails,
  makeTruck,
  makeZonePlane,
} from './meshes'

const GOODS_BASE_VALUE = 28
const BELT_X = -14
const BELT_Z_START = -6
/** Conveyor mesh/path ends at depot ramp — clear of parked train cargo. */
const BELT_Z_END = 6.4
const PORTAL_ZS = [-3, 1, 4.2] as const
/** Depot shed between belt tip and loco; cargo car sits over the deck. */
const DEPOT_POS = new THREE.Vector3(BELT_X, 0, 7.8)
/** Pickup at belt→depot handoff (south edge of shed). */
const TRAIN_LOAD_POINT = new THREE.Vector3(BELT_X, 0, 6.6)
/**
 * Train pivot further north of the depot/belt so cargo doesn't sit on the conveyor.
 * rot.y=π/2 → cargo local+X≈2.4 at z≈wait−2.4; south tip ≈ wait−3.5.
 */
const TRAIN_WAIT = new THREE.Vector3(BELT_X, 0, 11.6)
/** Matches makeGround(48) half-extent — rails run to the north grass edge. */
const GROUND_HALF = 24
const RAIL_Z_START = 6.5
const RAIL_Z_END = GROUND_HALF - 0.4

const MAX_STACK_BASE = 16
const PLAYER_SPEED = 6.2
const CROP_VALUE = 8
const JAR_VALUE = 20
const EGG_VALUE = 12
const WHEAT_VALUE = 14
const CUSTOMER_NEED = 3
const SAVE_KEY = 'townshipAdGame_v1'

const UNLOCK_ORDER = [
  'plots',
  'tractor',
  'helper',
  'processor',
  'cashier',
  'barn',
  'chickens',
  'boots',
  'collector',
  'collectorUp',
  'truck',
  'autoprocess',
  'mapExpand',
  'eggRunner',
  'jarLoader',
  'workerSpeed',
  'truckBay2',
  'field2',
  'shop2',
  'shop2Helper',
  'collector2',
  'collectorUp2',
  'cashier2',
  'truckBay3',
  'westExpand',
  'factory',
  'conveyor',
  'train',
  'trainCollector',
  'collectorUp3',
  'factoryUp',
  'conveyorUp',
  'trainUp',
  'portal1',
  'portal2',
  'portal3',
] as const

type ItemKind = 'crop' | 'jar' | 'egg' | 'wheat'

type GoodsItem = {
  mesh: THREE.Object3D
  pos: THREE.Vector3
  baseValue: number
  unitValue: number
  scale: number
  portalsPassed: number
}

type TrainAI = {
  mesh: THREE.Group
  state: 'arrive' | 'wait' | 'leave' | 'respawn'
  cargoValue: number
  cargoCount: number
  waitPos: THREE.Vector3
  leavePos: THREE.Vector3
  label: THREE.Sprite
  loadCooldown: number
  respawn: number
}

type CropPile = {
  mesh: THREE.Group
  count: number
  max: number
  pos: THREE.Vector3
  regen: number
  timer: number
  halfW: number
  halfD: number
  kind: 'crop' | 'wheat'
}

type GroundStack = {
  mesh: THREE.Group
  kinds: ItemKind[]
  pos: THREE.Vector3
}

type MoneyStack = {
  mesh: THREE.Group
  amount: number
  pos: THREE.Vector3
}

type Customer = {
  mesh: THREE.Group
  state: 'queue' | 'buying' | 'leaving'
  need: number
  held: number
  slot: number
  timer: number
  target: THREE.Vector3
  dead?: boolean
}

type UnlockPad = {
  mesh: THREE.Group
  cost: number
  paid: number
  id: string
  active: boolean
  done: boolean
  lastShown: number
  prefix: string
  requires?: string
}

type TractorAI = {
  mesh: THREE.Group
  cargo: ItemKind[]
  state: 'seek' | 'harvest' | 'dump'
  targetPile: CropPile | null
  timer: number
}

type HelperAI = {
  mesh: THREE.Group
  stack: ItemKind[]
  stackRoot: THREE.Group
  state: 'seek' | 'carry' | 'deposit'
  target: THREE.Vector3
  timer: number
}

type TruckOrder = {
  mesh: THREE.Group
  need: number
  filled: number
  state: 'arrive' | 'wait' | 'leave'
  waitPos: THREE.Vector3
  leavePos: THREE.Vector3
  label: THREE.Sprite
  cooldown: number
}

type TruckStation = {
  id: string
  loadZone: THREE.Vector3
  waitPos: THREE.Vector3
  leavePos: THREE.Vector3
  accepts: ItemKind[]
  truck: TruckOrder | null
  respawn: number
  active: boolean
}

type Goal = {
  id: string
  label: string
  current: number
  target: number
  reward: number
}

type SaveData = {
  v: 1 | 2
  money: number
  stage: number
  maxStack: number
  playerSpeedMul: number
  workerSpeedMul: number
  mapMax: number
  mapMaxWest?: number
  unlocked: string[]
  goalsDone: number
  goal: Goal
  fields: { kind: 'crop' | 'wheat'; max: number; regen: number; count: number }[]
  padPayments: Record<string, number>
  factoryRate?: number
  conveyorSpeed?: number
  trainCapacity?: number
  trainPayoutMul?: number
  portalsActive?: boolean[]
  collectorMoveMul?: number
  collectorGrabMul?: number
}

export class Game {
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  input = new Input()
  clock = new THREE.Clock()

  player: THREE.Group
  stackRoot: THREE.Group
  stack: ItemKind[] = []
  money = 0
  stage = 1
  maxStack = MAX_STACK_BASE
  playerSpeedMul = 1
  workerSpeedMul = 1
  collectorMoveMul = 1
  collectorGrabMul = 1
  autoCashier = false
  autoMoney = false
  autoMoney2 = false
  autoMoneyTrain = false
  autoProcess = false
  unlocked = new Set<string>()

  crops: CropPile[] = []
  groundStacks: GroundStack[] = []
  counterStock: ItemKind[] = []
  counterStockMesh: THREE.Group
  sellZoneCenter = new THREE.Vector3(0, 0, 7.3)
  servePos = new THREE.Vector3(0, 0, 9.9)
  customerSpawn = new THREE.Vector3(0, 0, 13.5)
  customerExit = new THREE.Vector3(0, 0, 14.5)
  moneyDropPos = new THREE.Vector3(2.2, 0, 7.3)
  moneyStacks: MoneyStack[] = []
  customers: Customer[] = []
  unlockPads: UnlockPad[] = []
  queuePoints: THREE.Vector3[] = []

  tractor: TractorAI | null = null
  helper: HelperAI | null = null
  collector: HelperAI | null = null
  collector2: HelperAI | null = null
  collectorTrain: HelperAI | null = null
  processorBot: HelperAI | null = null
  eggRunner: HelperAI | null = null
  jarLoader: HelperAI | null = null
  shop2Helper: HelperAI | null = null
  truckStations: TruckStation[] = []
  chickens: THREE.Group[] = []
  eggPos = new THREE.Vector3(7.5, 0, -6.0)
  eggTimer = 0
  goal: Goal = { id: 'sell_items', label: 'Sell items', current: 0, target: 15, reward: 50 }
  goalsDone = 0

  processorPos = new THREE.Vector3(-6.8, 0, -0.8)
  processZone = new THREE.Vector3(-5.3, 0, -0.8)
  processOutPos = new THREE.Vector3(-8.3, 0, -0.8)
  dumpPos = new THREE.Vector3(-2.5, 0, 5.0)
  fieldCenter = new THREE.Vector3(0, 0, -6.5)
  fieldCenter2 = new THREE.Vector3(12.5, 0, -7.5)

  // Shop 2 (east)
  shop2Ready = false
  autoCashier2 = false
  counterStock2: ItemKind[] = []
  counterStockMesh2: THREE.Group | null = null
  sellZone2 = new THREE.Vector3(12, 0, 7.3)
  servePos2 = new THREE.Vector3(12, 0, 9.9)
  moneyDropPos2 = new THREE.Vector3(14.2, 0, 7.3)
  customerSpawn2 = new THREE.Vector3(12, 0, 13.5)
  customerExit2 = new THREE.Vector3(12, 0, 14.5)
  customers2: Customer[] = []
  queuePoints2: THREE.Vector3[] = []
  spawnTimer2 = 0
  sellCooldown2 = 0

  // West factory → conveyor → train
  factoryReady = false
  conveyorReady = false
  factoryRate = 0.45
  conveyorSpeed = 2.2
  trainCapacity = 40
  trainPayoutMul = 1
  factorySpawnTimer = 0
  goodsOnBelt: GoodsItem[] = []
  portalsActive = [false, false, false]
  portalMeshes: (THREE.Group | null)[] = [null, null, null]
  train: TrainAI | null = null
  trainMoneyPos = new THREE.Vector3(BELT_X + 2.8, 0, 7.8)

  private hintEl = document.getElementById('hint')!
  private stageEl = document.getElementById('stage-num')!
  private moneyEl = document.getElementById('money-num')!
  private goalEl = document.getElementById('goal-text')!
  private goalFill = document.getElementById('goal-fill')!
  private hintTimer = 18
  private spawnTimer = 0
  private sellCooldown = 0
  private processCooldown = 0
  private harvestCooldown = 0
  private mapMax = 8.5
  private mapMaxWest = 8.5
  private fenceGroup = new THREE.Group()
  private fenceExtent = 9
  private fenceWest = 9
  private fenceNorth = 11
  private fieldGroundGroup = new THREE.Group()
  private fieldLabel: THREE.Sprite | null = null
  private wheatGroundGroup = new THREE.Group()
  private wheatLabel: THREE.Sprite | null = null
  private loadingSave = false
  private saveTimer = 0
  private conveyorGroup: THREE.Group | null = null
  private factoryMesh: THREE.Group | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 140)
    this.camera.position.set(14, 16, 14)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    this.renderer.shadowMap.enabled = false
    this.renderer.setClearColor(0x87ceeb)
    this.scene.fog = new THREE.Fog(0x87ceeb, 40, 80)

    const hemi = new THREE.HemisphereLight(0xfff2cc, 0x4a7c3a, 1.0)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xffffff, 0.85)
    sun.position.set(10, 18, 8)
    this.scene.add(sun)

    this.scene.add(makeGround(48))
    this.buildDecor()
    this.buildCounterArea()
    this.buildCropPlots()
    this.buildUnlockPads()

    this.player = makeCharacter(COLORS.player)
    this.player.position.set(-2.5, 0, 6.5)
    this.scene.add(this.player)

    this.stackRoot = new THREE.Group()
    this.stackRoot.position.set(0, 1.35, 0)
    this.player.add(this.stackRoot)

    this.counterStockMesh = new THREE.Group()
    this.counterStockMesh.position.set(0, 1.0, 8.85)
    this.scene.add(this.counterStockMesh)

    for (let i = 0; i < 6; i++) {
      // Queue from counter toward the entrance gate (+Z)
      this.queuePoints.push(new THREE.Vector3(0, 0, 9.9 + i * 1.05))
    }

    this.onResize()
    window.addEventListener('resize', () => this.onResize())
    this.loadProgress()
  }

  private buildDecor() {
    this.scene.add(this.fenceGroup)
    this.rebuildFence(9, 11)
  }

  private rebuildFence(east: number, northZ: number, west?: number) {
    while (this.fenceGroup.children.length) {
      this.fenceGroup.remove(this.fenceGroup.children[0]!)
    }
    this.fenceExtent = east
    this.fenceNorth = northZ
    if (west !== undefined) this.fenceWest = west
    else this.fenceWest = Math.max(this.fenceWest, east)
    const e = east
    const w = this.fenceWest
    const n = northZ
    const south = -Math.max(e, w)
    const gates: { x: number; half: number; label: string }[] = [
      { x: 0, half: 1.8, label: 'ENTER' },
    ]
    if (e >= 14) gates.push({ x: 12, half: 1.8, label: 'ENTER-B' })
    if (this.unlocked.has('train')) gates.push({ x: BELT_X, half: 2.6, label: 'TRAIN' })

    this.fenceGroup.add(makeFence(-w, south, e, south))
    this.fenceGroup.add(makeFence(-w, south, -w, n))
    this.buildEastFence(e, n, south)

    // North wall with gate openings
    const sorted = [...gates].sort((a, b) => a.x - b.x)
    let cursor = -w
    for (const gate of sorted) {
      const left = gate.x - gate.half
      const right = gate.x + gate.half
      if (left > cursor + 0.05) this.fenceGroup.add(makeFence(cursor, n, left, n))
      for (const x of [left, right]) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 1.2, 0.22),
          new THREE.MeshLambertMaterial({ color: COLORS.fence }),
        )
        post.position.set(x, 0.6, n)
        this.fenceGroup.add(post)
      }
      const gateLabel = makeLabelSprite(gate.label, '#ffffff')
      gateLabel.position.set(gate.x, 1.4, n)
      gateLabel.scale.set(gate.label === 'ENTER-B' ? 1.8 : 1.6, 0.6, 1)
      this.fenceGroup.add(gateLabel)
      cursor = right
    }
    if (cursor < e - 0.05) this.fenceGroup.add(makeFence(cursor, n, e, n))

    this.syncTruckLeavePositions()
    this.syncTrainLeavePosition()
  }

  /** East wall: solid until truck bays open gaps at their wait Z. */
  private buildEastFence(e: number, n: number, south: number) {
    const gaps = this.mergeFenceGaps(
      this.truckStations
        .filter((s) => s.active)
        .map((s) => ({ lo: s.waitPos.z - 1.9, hi: s.waitPos.z + 1.9 })),
    )
    let cursor = south
    for (const gap of gaps) {
      const lo = Math.max(gap.lo, south)
      const hi = Math.min(gap.hi, n)
      if (lo > cursor + 0.05) this.fenceGroup.add(makeFence(e, cursor, e, lo))
      cursor = Math.max(cursor, hi)
    }
    if (cursor < n - 0.05) this.fenceGroup.add(makeFence(e, cursor, e, n))
  }

  private mergeFenceGaps(gaps: { lo: number; hi: number }[]) {
    if (gaps.length === 0) return [] as { lo: number; hi: number }[]
    const sorted = [...gaps].sort((a, b) => a.lo - b.lo)
    const out: { lo: number; hi: number }[] = [{ ...sorted[0]! }]
    for (let i = 1; i < sorted.length; i++) {
      const g = sorted[i]!
      const last = out[out.length - 1]!
      if (g.lo <= last.hi + 0.1) last.hi = Math.max(last.hi, g.hi)
      else out.push({ ...g })
    }
    return out
  }

  private truckLeaveX() {
    return this.fenceExtent + 6
  }

  private syncTruckLeavePositions() {
    const leaveX = this.truckLeaveX()
    for (const st of this.truckStations) {
      st.leavePos.set(leaveX, 0, st.waitPos.z)
      if (st.truck) {
        st.truck.leavePos.set(leaveX, 0, st.waitPos.z)
        if (st.truck.state === 'arrive') {
          st.truck.mesh.position.x = Math.max(st.truck.mesh.position.x, leaveX - 0.5)
          st.truck.mesh.position.z = st.waitPos.z
        }
      }
    }
  }

  private trainLeaveZ() {
    return RAIL_Z_END
  }

  private syncTrainLeavePosition() {
    if (!this.train) return
    this.train.leavePos.set(this.train.waitPos.x, 0, this.trainLeaveZ())
    if (this.train.state === 'arrive') {
      this.train.mesh.position.x = this.train.waitPos.x
      this.train.mesh.position.z = Math.max(this.train.mesh.position.z, this.train.leavePos.z - 0.5)
    }
  }

  private buildCounterArea() {
    // Shop at the fenced entrance — customers approach from the gate (+Z)
    const counter = makeCounter()
    counter.position.set(0, 0, 8.7)
    this.scene.add(counter)

    // SELL pad behind the counter (inside the plot)
    const sell = makeZonePlane(2.2, 1.6, COLORS.sellZone, 0.4)
    sell.position.set(0, 0.04, 7.3)
    this.scene.add(sell)
    const sellLabel = makeLabelSprite('SELL', '#7fffff')
    sellLabel.position.set(0, 0.9, 7.3)
    this.scene.add(sellLabel)

    const moneyPad = makeZonePlane(1.4, 1.4, 0x94a3b8, 0.35)
    moneyPad.position.copy(this.moneyDropPos)
    moneyPad.position.y = 0.04
    this.scene.add(moneyPad)
  }

  private buildCropPlots() {
    const cx = this.fieldCenter.x
    const cz = this.fieldCenter.z
    const halfW = 4.2
    const halfD = 2.4

    this.scene.add(this.fieldGroundGroup)

    const mesh = new THREE.Group()
    mesh.position.set(cx, 0.14, cz)
    this.scene.add(mesh)

    const pile: CropPile = {
      mesh,
      count: 10,
      max: 12,
      pos: new THREE.Vector3(cx, 0, cz),
      regen: 1.0,
      timer: 0,
      halfW,
      halfD,
      kind: 'crop',
    }
    this.rebuildFieldGround(pile)
    this.rebuildCropVisual(pile)
    this.crops.push(pile)
  }

  private rebuildFieldGround(field: CropPile) {
    while (this.fieldGroundGroup.children.length) {
      const child = this.fieldGroundGroup.children[0]!
      this.fieldGroundGroup.remove(child)
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh) {
          mesh.geometry?.dispose()
          const mat = mesh.material
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat?.dispose()
        }
      })
    }
    if (this.fieldLabel) {
      this.scene.remove(this.fieldLabel)
      this.fieldLabel.material.map?.dispose()
      this.fieldLabel.material.dispose()
      this.fieldLabel = null
    }

    const cx = field.pos.x
    const cz = field.pos.z
    const halfW = field.halfW
    const halfD = field.halfD

    const soil = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 2, 0.14, halfD * 2),
      new THREE.MeshLambertMaterial({ color: 0x6b4423 }),
    )
    soil.position.set(cx, 0.07, cz)
    this.fieldGroundGroup.add(soil)

    const furrowCount = Math.max(5, Math.round(halfD * 2 / 0.55))
    for (let i = 0; i < furrowCount; i++) {
      const t = furrowCount === 1 ? 0 : i / (furrowCount - 1)
      const zOff = (t - 0.5) * (halfD * 2 - 0.4)
      const furrow = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 2 - 0.3, 0.02, 0.12),
        new THREE.MeshLambertMaterial({ color: 0x5a3a1e }),
      )
      furrow.position.set(cx, 0.15, cz + zOff)
      this.fieldGroundGroup.add(furrow)
    }

    this.fieldLabel = makeLabelSprite('FIELD', '#bbf7d0')
    this.fieldLabel.position.set(cx, 1.0, cz + halfD + 0.35)
    this.scene.add(this.fieldLabel)
  }

  /** Same Z span as main FIELD: north edge fixed, south just inside the fence. */
  private fieldDepthToSouthFence() {
    const inset = 0.45
    const zMin = -Math.max(this.fenceExtent, this.fenceWest) + inset
    const zMax = -5.5
    const halfD = (zMax - zMin) / 2
    const cz = (zMin + zMax) / 2
    return { zMin, zMax, halfD, cz }
  }

  /** Stretch crop / wheat fields on Z to the current south fence. */
  private expandFieldToFenceDepth() {
    const { halfD, cz } = this.fieldDepthToSouthFence()

    const crop = this.getField()
    if (crop) {
      crop.halfW = 4.2
      crop.halfD = halfD
      crop.pos.z = cz
      crop.mesh.position.set(crop.pos.x, 0.14, cz)
      this.fieldCenter.z = cz
      this.rebuildFieldGround(crop)
      this.rebuildCropVisual(crop)
    }

    const wheat = this.getWheatField()
    if (wheat) {
      wheat.halfD = halfD
      wheat.pos.z = cz
      wheat.mesh.position.set(wheat.pos.x, 0.14, cz)
      this.fieldCenter2.z = cz
      this.rebuildWheatGround(wheat)
      this.rebuildCropVisual(wheat)
    }
  }

  private inField(pos: THREE.Vector3, field: CropPile, pad = 0.35): boolean {
    return (
      Math.abs(pos.x - field.pos.x) <= field.halfW + pad &&
      Math.abs(pos.z - field.pos.z) <= field.halfD + pad
    )
  }

  private getField(): CropPile {
    return this.crops.find((c) => c.kind === 'crop') ?? this.crops[0]!
  }

  private getWheatField(): CropPile | null {
    return this.crops.find((c) => c.kind === 'wheat') ?? null
  }

  private boostField(opts: { max?: number; regen?: number; fillRatio?: number; kind?: 'crop' | 'wheat' }) {
    const field =
      opts.kind === 'wheat' ? this.getWheatField() : this.getField()
    if (!field) return
    if (opts.max !== undefined) field.max = Math.max(field.max, opts.max)
    if (opts.regen !== undefined) field.regen = Math.min(field.regen, opts.regen)
    const fill = opts.fillRatio ?? 0.35
    field.count = Math.min(field.max, Math.max(field.count, Math.floor(field.max * fill)))
    this.rebuildCropVisual(field)
  }

  private rebuildCropVisual(pile: CropPile) {
    const colSpacing = 0.85
    const rowSpacing = 0.65
    const cols = Math.max(8, Math.floor((pile.halfW * 2) / colSpacing))
    const rows = Math.max(6, Math.floor((pile.halfD * 2) / rowSpacing))
    const maxShow = cols * rows
    const show = Math.min(maxShow, pile.count)

    while (pile.mesh.children.length > show) {
      pile.mesh.remove(pile.mesh.children[pile.mesh.children.length - 1]!)
    }
    // Rebuild positions when field size changes
    for (let i = 0; i < pile.mesh.children.length; i++) {
      const item = pile.mesh.children[i]!
      const col = i % cols
      const row = Math.floor(i / cols) % rows
      const layer = Math.floor(i / maxShow)
      item.position.set(
        (col - (cols - 1) / 2) * colSpacing,
        0.22 + layer * 0.32,
        (row - (rows - 1) / 2) * rowSpacing,
      )
    }
    while (pile.mesh.children.length < show) {
      const i = pile.mesh.children.length
      const item = makeItem(pile.kind)
      const col = i % cols
      const row = Math.floor(i / cols) % rows
      const layer = Math.floor(i / maxShow)
      item.position.set(
        (col - (cols - 1) / 2) * colSpacing,
        0.22 + layer * 0.32,
        (row - (rows - 1) / 2) * rowSpacing,
      )
      item.rotation.y = (col + row) * 0.1
      pile.mesh.add(item)
    }
  }

  private buildUnlockPads() {
    this.unlockPads.push(
      this.createUnlockPad('plots', 80, new THREE.Vector3(5.6, 0, -5.5), '🌱'),
    )
    this.unlockPads.push(
      this.createUnlockPad('tractor', 200, new THREE.Vector3(-6.8, 0, -8.8), '🚜', 'plots'),
    )
    this.unlockPads.push(
      this.createUnlockPad('helper', 320, new THREE.Vector3(-3.2, 0, -1.0), '👷', 'tractor'),
    )
    this.unlockPads.push(
      this.createUnlockPad('processor', 450, new THREE.Vector3(-6.8, 0, 1.0), '🏭', 'helper'),
    )
    this.unlockPads.push(
      this.createUnlockPad('cashier', 380, new THREE.Vector3(-5.8, 0, 7.3), '🧾', 'processor'),
    )
    this.unlockPads.push(
      this.createUnlockPad('barn', 600, new THREE.Vector3(-7.5, 0, 1.2), '🏠', 'cashier'),
    )
    this.unlockPads.push(
      this.createUnlockPad('chickens', 700, new THREE.Vector3(9.0, 0, -5.8), '🐔', 'barn'),
    )
    this.unlockPads.push(
      this.createUnlockPad('boots', 500, new THREE.Vector3(-4.5, 0, 2.8), '👟', 'chickens'),
    )
    this.unlockPads.push(
      this.createUnlockPad('collector', 750, new THREE.Vector3(3.8, 0, 5.2), '💰', 'boots'),
    )
    this.unlockPads.push(
      this.createUnlockPad('collectorUp', 1100, new THREE.Vector3(2.0, 0, 4.0), '💨', 'collector'),
    )
    this.unlockPads.push(
      this.createUnlockPad('truck', 900, new THREE.Vector3(6.0, 0, 3.2), '🚚', 'collector'),
    )
    this.unlockPads.push(
      this.createUnlockPad('autoprocess', 1100, new THREE.Vector3(4.5, 0, 1.8), '⚙️', 'truck'),
    )
    // Late-game chain
    this.unlockPads.push(
      this.createUnlockPad('mapExpand', 1400, new THREE.Vector3(-7.5, 0, 5.0), '🗺️', 'autoprocess'),
    )
    this.unlockPads.push(
      this.createUnlockPad('eggRunner', 1600, new THREE.Vector3(1.2, 0, -1.8), '🥚', 'mapExpand'),
    )
    this.unlockPads.push(
      this.createUnlockPad('jarLoader', 1800, new THREE.Vector3(6.2, 0, 5.8), '📦', 'eggRunner'),
    )
    this.unlockPads.push(
      this.createUnlockPad('workerSpeed', 1900, new THREE.Vector3(3.5, 0, 0.5), '⚡', 'jarLoader'),
    )
    this.unlockPads.push(
      this.createUnlockPad('truckBay2', 2000, new THREE.Vector3(5.5, 0, -0.5), '🚚', 'workerSpeed'),
    )
    this.unlockPads.push(
      this.createUnlockPad('field2', 2400, new THREE.Vector3(15.8, 0, 5.0), '🌾', 'truckBay2'),
    )
    this.unlockPads.push(
      this.createUnlockPad('shop2', 2800, new THREE.Vector3(10.0, 0, 5.8), '🏪', 'field2'),
    )
    this.unlockPads.push(
      this.createUnlockPad('shop2Helper', 2900, new THREE.Vector3(12.0, 0, 4.0), '👷', 'shop2'),
    )
    this.unlockPads.push(
      this.createUnlockPad('collector2', 2950, new THREE.Vector3(15.5, 0, 5.5), '💰', 'shop2Helper'),
    )
    this.unlockPads.push(
      this.createUnlockPad('collectorUp2', 3300, new THREE.Vector3(16.2, 0, 7.2), '💨', 'collector2'),
    )
    // Avoid pad overlap with collector2 at (15.5, 5.5)
    this.unlockPads.push(
      this.createUnlockPad('cashier2', 3100, new THREE.Vector3(12.0, 0, 5.9), '🧾', 'collector2'),
    )
    this.unlockPads.push(
      this.createUnlockPad('truckBay3', 3400, new THREE.Vector3(5.5, 0, -3.0), '🚛', 'cashier2'),
    )
    // West endgame: factory → conveyor → train
    this.unlockPads.push(
      this.createUnlockPad('westExpand', 3600, new THREE.Vector3(-11.2, 0, 4.2), '🗺️', 'truckBay3'),
    )
    this.unlockPads.push(
      this.createUnlockPad('factory', 4000, new THREE.Vector3(-11.5, 0, -8.0), '🏭', 'westExpand'),
    )
    this.unlockPads.push(
      this.createUnlockPad('conveyor', 4500, new THREE.Vector3(-11.5, 0, -4.2), '➡️', 'factory'),
    )
    this.unlockPads.push(
      this.createUnlockPad('train', 5000, new THREE.Vector3(-11.2, 0, 7.8), '🚂', 'conveyor'),
    )
    this.unlockPads.push(
      this.createUnlockPad('trainCollector', 5300, new THREE.Vector3(-11.0, 0, 5.2), '💰', 'train'),
    )
    this.unlockPads.push(
      this.createUnlockPad('collectorUp3', 5800, new THREE.Vector3(-11.0, 0, 3.0), '💨', 'trainCollector'),
    )
    this.unlockPads.push(
      this.createUnlockPad('factoryUp', 5500, new THREE.Vector3(-16.8, 0, -8.0), '⚡', 'factory'),
    )
    this.unlockPads.push(
      this.createUnlockPad('conveyorUp', 6200, new THREE.Vector3(-16.8, 0, 0.0), '⏩', 'conveyor'),
    )
    this.unlockPads.push(
      this.createUnlockPad('trainUp', 7000, new THREE.Vector3(-16.8, 0, 7.8), '💎', 'train'),
    )
    this.unlockPads.push(
      this.createUnlockPad('portal1', 6000, new THREE.Vector3(-12.4, 0, -3.0), '🌀', 'conveyor'),
    )
    this.unlockPads.push(
      this.createUnlockPad('portal2', 7500, new THREE.Vector3(-12.4, 0, 1.0), '🌀', 'portal1'),
    )
    this.unlockPads.push(
      this.createUnlockPad('portal3', 9000, new THREE.Vector3(-12.4, 0, 4.2), '🌀', 'portal2'),
    )
    this.refreshPadVisibility()
  }

  private createUnlockPad(
    id: string,
    cost: number,
    pos: THREE.Vector3,
    prefix: string,
    requires?: string,
  ): UnlockPad {
    const mesh = new THREE.Group()
    mesh.position.copy(pos)
    const pad = makeZonePlane(1.8, 1.8, 0xffffff, 0.45)
    pad.position.y = 0.05
    mesh.add(pad)
    const sprite = makeLabelSprite(`${prefix} ${cost}`, '#ffffff')
    sprite.position.set(0, 1.1, 0)
    sprite.name = 'label'
    mesh.add(sprite)
    this.scene.add(mesh)
    mesh.visible = !requires
    return {
      mesh,
      cost,
      paid: 0,
      id,
      active: !requires,
      done: false,
      lastShown: cost,
      prefix,
      requires,
    }
  }

  private refreshPadVisibility() {
    for (const pad of this.unlockPads) {
      if (pad.done) continue
      const ready = !pad.requires || this.unlocked.has(pad.requires)
      pad.active = ready
      pad.mesh.visible = ready
    }
  }

  private refreshUnlockLabel(pad: UnlockPad) {
    const old = pad.mesh.getObjectByName('label')
    if (old) {
      const spr = old as THREE.Sprite
      spr.material.map?.dispose()
      spr.material.dispose()
      pad.mesh.remove(old)
    }
    const left = Math.max(0, Math.ceil(pad.cost - pad.paid))
    const sprite = makeLabelSprite(`${pad.prefix} ${left}`, '#ffffff')
    sprite.position.set(0, 1.1, 0)
    sprite.name = 'label'
    pad.mesh.add(sprite)
  }

  private onResize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  start() {
    const loop = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05)
      this.update(dt)
      this.renderer.render(this.scene, this.camera)
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }

  private update(dt: number) {
    this.updatePlayer(dt)
    this.updateCrops(dt)
    this.updateSelling(dt)
    this.updateCustomers(dt)
    this.updateShop2(dt)
    this.updateMoneyPickup(dt)
    this.updateUnlocks(dt)
    this.updateTractor(dt)
    this.updateHelper(dt)
    this.updateCollector(dt)
    this.updateCollector2(dt)
    this.updateCollectorTrain(dt)
    this.updateProcessorBot(dt)
    this.updateEggRunner(dt)
    this.updateJarLoader(dt)
    this.updateShop2Helper(dt)
    this.updateProcessing(dt)
    this.updateChickens(dt)
    this.updateTruckStations(dt)
    this.updateFactoryBeltTrain(dt)
    this.updateCamera(dt)
    this.updateHud(dt)

    const maxCust = Math.min(6, 3 + Math.floor(this.stage / 2))
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0 && this.customers.length < maxCust) {
      this.spawnCustomer()
      this.spawnTimer = Math.max(1.4, 2.6 - this.stage * 0.12)
    }
  }

  private updatePlayer(dt: number) {
    const m = this.input.move
    if (m.x !== 0 || m.y !== 0) {
      const forward = new THREE.Vector3(-1, 0, -1).normalize()
      const right = new THREE.Vector3(1, 0, -1).normalize()
      const dir = forward.multiplyScalar(-m.y).add(right.multiplyScalar(m.x))
      if (dir.lengthSq() > 0) {
        dir.normalize()
        this.player.position.x += dir.x * PLAYER_SPEED * this.playerSpeedMul * dt
        this.player.position.z += dir.z * PLAYER_SPEED * this.playerSpeedMul * dt
        this.player.rotation.y = Math.atan2(dir.x, dir.z)
      }
    }
    this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, -this.mapMaxWest, this.mapMax)
    const zBound = Math.max(this.mapMax, this.mapMaxWest)
    this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, -zBound, this.mapMax + 2)

    const t = this.clock.elapsedTime
    this.stackRoot.rotation.z = Math.sin(t * 8) * 0.04 * Math.min(this.stack.length, 10)
    this.stackRoot.rotation.x = Math.cos(t * 6) * 0.03 * Math.min(this.stack.length, 10)

    // Pick from fields (one item at a time)
    this.harvestCooldown -= dt
    if (this.stack.length < this.maxStack && this.harvestCooldown <= 0) {
      for (const field of this.crops) {
        if (field.count > 0 && this.inField(this.player.position, field)) {
          field.count--
          this.rebuildCropVisual(field)
          this.pushStack(field.kind)
          this.harvestCooldown = 0.1
          break
        }
      }
    }

    // Pick from ground stacks (tractor dumps / processor out)
    if (this.stack.length < this.maxStack) {
      for (const gs of this.groundStacks) {
        if (gs.kinds.length === 0) continue
        if (this.player.position.distanceTo(gs.pos) < 1.5) {
          const kind = gs.kinds.pop()!
          this.pushStack(kind)
          this.rebuildGroundStack(gs)
          break
        }
      }
    }

    if (this.stack.length > 0 && this.player.position.distanceTo(this.sellZoneCenter) < 1.4) {
      this.depositToCounter()
    }
    if (
      this.shop2Ready &&
      this.stack.length > 0 &&
      this.player.position.distanceTo(this.sellZone2) < 1.4
    ) {
      this.depositToCounter2()
    }
  }

  private pushStack(kind: ItemKind, root = this.stackRoot, list = this.stack) {
    if (list.length >= this.maxStack && list === this.stack) return
    const item = makeItem(kind)
    item.position.y = list.length * 0.32
    item.rotation.y = (list.length % 5) * 0.15
    root.add(item)
    list.push(kind)
  }

  private popStack(
    root = this.stackRoot,
    list = this.stack,
  ): ItemKind | null {
    if (list.length === 0) return null
    const kind = list.pop()!
    const child = root.children[root.children.length - 1]
    if (child) root.remove(child)
    return kind
  }

  private depositToCounter() {
    let changed = false
    while (this.stack.length > 0 && this.counterStock.length < 48) {
      const kind = this.popStack()
      if (!kind) break
      this.counterStock.push(kind)
      changed = true
    }
    if (changed) this.rebuildCounterStock()
  }

  private depositToCounter2() {
    if (!this.counterStockMesh2) return
    let changed = false
    while (this.stack.length > 0 && this.counterStock2.length < 48) {
      const kind = this.popStack()
      if (!kind) break
      this.counterStock2.push(kind)
      changed = true
    }
    if (changed) this.rebuildCounterStock2()
  }

  private rebuildCounterStock() {
    while (this.counterStockMesh.children.length) {
      this.counterStockMesh.remove(this.counterStockMesh.children[0]!)
    }
    const show = Math.min(this.counterStock.length, 16)
    for (let i = 0; i < show; i++) {
      const item = makeItem(this.counterStock[i]!)
      item.position.set(((i % 4) - 1.5) * 0.4, Math.floor(i / 4) * 0.32, 0)
      this.counterStockMesh.add(item)
    }
  }

  private rebuildCounterStock2() {
    if (!this.counterStockMesh2) return
    while (this.counterStockMesh2.children.length) {
      this.counterStockMesh2.remove(this.counterStockMesh2.children[0]!)
    }
    const show = Math.min(this.counterStock2.length, 16)
    for (let i = 0; i < show; i++) {
      const item = makeItem(this.counterStock2[i]!)
      item.position.set(((i % 4) - 1.5) * 0.4, Math.floor(i / 4) * 0.32, 0)
      this.counterStockMesh2.add(item)
    }
  }

  private getOrCreateGroundStack(pos: THREE.Vector3): GroundStack {
    let gs = this.groundStacks.find((g) => g.pos.distanceTo(pos) < 0.5)
    if (!gs) {
      const mesh = new THREE.Group()
      mesh.position.copy(pos)
      this.scene.add(mesh)
      gs = { mesh, kinds: [], pos: pos.clone() }
      this.groundStacks.push(gs)
    }
    return gs
  }

  private rebuildGroundStack(gs: GroundStack) {
    const show = Math.min(gs.kinds.length, 12)
    while (gs.mesh.children.length > show) {
      gs.mesh.remove(gs.mesh.children[gs.mesh.children.length - 1]!)
    }
    while (gs.mesh.children.length < show) {
      const i = gs.mesh.children.length
      const item = makeItem(gs.kinds[i]!)
      item.position.set(((i % 3) - 1) * 0.4, 0.2 + Math.floor(i / 3) * 0.32, 0)
      gs.mesh.add(item)
    }
  }

  private updateCrops(dt: number) {
    for (const field of this.crops) {
      if (field.count >= field.max) continue
      field.timer += dt
      if (field.timer >= field.regen) {
        field.timer = 0
        field.count++
        this.rebuildCropVisual(field)
      }
    }
  }

  private updateSelling(dt: number) {
    this.sellCooldown -= dt
    if (this.sellCooldown > 0) return

    const playerSelling = this.player.position.distanceTo(this.sellZoneCenter) < 1.5
    if (!this.autoCashier && !playerSelling) return

    const buyer = this.customers.find((c) => c.state === 'queue' && c.slot === 0)
    if (!buyer || this.counterStock.length === 0) return

    // Only start serving when customer is actually at the shop counter
    if (buyer.mesh.position.distanceTo(this.servePos) > 0.75) return

    buyer.state = 'buying'
    buyer.timer = 0
    this.sellCooldown = 0.05
  }

  private spawnCustomer() {
    const color = COLORS.npc[Math.floor(Math.random() * COLORS.npc.length)]!
    const mesh = makeCharacter(color)
    mesh.position.copy(this.customerSpawn)
    this.scene.add(mesh)
    this.customers.push({
      mesh,
      state: 'queue',
      need: CUSTOMER_NEED + Math.min(2, Math.floor(this.stage / 2)),
      held: 0,
      slot: this.customers.length,
      timer: 0,
      target: this.queuePoints[0]!.clone(),
    })
  }

  private updateCustomers(dt: number) {
    const queued = this.customers.filter((c) => c.state === 'queue' || c.state === 'buying')
    queued.forEach((c, i) => {
      c.slot = i
      if (c.state === 'queue') {
        c.target.copy(this.queuePoints[Math.min(i, this.queuePoints.length - 1)]!)
      }
    })

    for (const c of this.customers) {
      if (c.state === 'queue') {
        this.moveToward(c.mesh, c.target, 3.5 * dt)
      } else if (c.state === 'buying') {
        // Stay glued to the counter while receiving goods / paying
        this.moveToward(c.mesh, this.servePos, 4 * dt)
        if (c.mesh.position.distanceTo(this.servePos) > 0.9) {
          // Walked off somehow — pause trade until back at shop
          continue
        }

        const canTrade =
          this.autoCashier || this.player.position.distanceTo(this.sellZoneCenter) < 1.5
        if (!canTrade) continue

        c.timer += dt
        if (c.timer >= 0.26 && this.counterStock.length > 0 && c.held < c.need) {
          c.timer = 0
          const kind = this.counterStock.shift()!
          this.rebuildCounterStock()
          c.held++
          const item = makeItem(kind)
          item.position.set(0, 1.35 + (c.held - 1) * 0.32, 0)
          c.mesh.add(item)
          this.dropMoney(this.itemValue(kind))
          this.progressGoal(1, kind)
        }
        if (c.held >= c.need || (this.counterStock.length === 0 && c.held > 0 && c.timer > 0.7)) {
          c.state = 'leaving'
          c.target.copy(this.customerExit)
        }
      } else if (c.state === 'leaving') {
        // Leave back through the entrance gate
        this.moveToward(c.mesh, c.target, 4.2 * dt)
        if (c.mesh.position.distanceTo(c.target) < 0.5) {
          this.scene.remove(c.mesh)
          c.dead = true
        }
      }
    }
    this.customers = this.customers.filter((c) => !c.dead)
  }

  private moveToward(obj: THREE.Object3D, target: THREE.Vector3, step: number) {
    const dx = target.x - obj.position.x
    const dz = target.z - obj.position.z
    const dist = Math.hypot(dx, dz)
    if (dist < 0.05) return
    const s = Math.min(step, dist)
    obj.position.x += (dx / dist) * s
    obj.position.z += (dz / dist) * s
    obj.rotation.y = Math.atan2(dx, dz)
  }

  /** Movement step for delivery workers (helper, bots, runners). */
  private workerStep(speed: number, dt: number) {
    return speed * this.workerSpeedMul * dt
  }

  private itemValue(kind: ItemKind): number {
    if (kind === 'jar') return JAR_VALUE
    if (kind === 'egg') return EGG_VALUE
    if (kind === 'wheat') return WHEAT_VALUE
    return CROP_VALUE
  }

  private progressGoal(n: number, kind?: ItemKind) {
    if (this.goal.id === 'jars' && kind !== 'jar') return
    if (this.goal.id === 'eggs' && kind !== 'egg') return
    if (this.goal.id === 'truck') return

    this.goal.current = Math.min(this.goal.target, this.goal.current + n)
    if (this.goal.current >= this.goal.target) {
      const reward = this.goal.reward
      this.money += reward
      this.pulseMoney()
      this.goalsDone++
      this.nextGoal()
      this.setHint(`Goal complete! +$${reward}`)
      this.saveProgress()
    }
  }

  private nextGoal() {
    const goals: Goal[] = [
      { id: 'sell', label: 'Sell items', current: 0, target: 15, reward: 50 },
      { id: 'jars', label: 'Sell jars', current: 0, target: 10, reward: 120 },
      { id: 'truck', label: 'Fill truck orders', current: 0, target: 2, reward: 250 },
      { id: 'eggs', label: 'Sell eggs', current: 0, target: 20, reward: 200 },
      { id: 'empire', label: 'Sell anything', current: 0, target: 80, reward: 500 },
    ]
    const idx = Math.min(this.goalsDone, goals.length - 1)
    this.goal = { ...goals[idx]! }
    if (this.goalsDone >= goals.length) {
      this.goal.target = 40 + this.goalsDone * 10
      this.goal.reward = 200 + this.goalsDone * 50
      this.goal.label = 'Mega sales'
      this.goal.current = 0
    }
  }

  private dropMoney(amount: number, at: THREE.Vector3 = this.moneyDropPos) {
    let stack = this.moneyStacks.find((s) => s.pos.distanceTo(at) < 0.6)
    if (!stack) {
      const mesh = new THREE.Group()
      mesh.position.copy(at)
      this.scene.add(mesh)
      stack = { mesh, amount: 0, pos: at.clone() }
      this.moneyStacks.push(stack)
    }
    stack.amount += amount
    this.syncMoneyVisual(stack)
  }

  private syncMoneyVisual(stack: MoneyStack) {
    const MAX_BILLS = 12
    const want = Math.min(MAX_BILLS, Math.max(0, Math.ceil(stack.amount / CROP_VALUE)))
    while (stack.mesh.children.length < want) {
      const bill = makeBill()
      const i = stack.mesh.children.length
      bill.position.set((i % 3) * 0.08 - 0.08, 0.05 + i * 0.07, (i % 2) * 0.05)
      bill.rotation.y = (i % 5) * 0.2
      stack.mesh.add(bill)
    }
    while (stack.mesh.children.length > want) {
      stack.mesh.remove(stack.mesh.children[stack.mesh.children.length - 1]!)
    }
  }

  private updateMoneyPickup(_dt: number) {
    for (const stack of this.moneyStacks) {
      if (stack.amount <= 0) continue
      // Auto-collectors handle their own piles — player picks up the rest
      if (this.autoMoney && stack.pos.distanceTo(this.moneyDropPos) < 2.5) continue
      if (this.autoMoney2 && stack.pos.distanceTo(this.moneyDropPos2) < 2.5) continue
      if (this.autoMoneyTrain && stack.pos.distanceTo(this.trainMoneyPos) < 2.5) continue
      if (this.player.position.distanceTo(stack.pos) >= 1.5) continue
      const take = Math.min(stack.amount, 18 + this.stage * 2)
      stack.amount -= take
      this.money += take
      this.syncMoneyVisual(stack)
      this.pulseMoney()
    }
  }

  private pulseMoney() {
    this.moneyEl.style.transform = 'scale(1.12)'
    this.moneyEl.style.transition = 'transform 0.1s'
    // single rAF undo — avoid setTimeout spam
    requestAnimationFrame(() => {
      this.moneyEl.style.transform = 'scale(1)'
    })
  }

  private updateUnlocks(dt: number) {
    for (const pad of this.unlockPads) {
      if (!pad.active || pad.done) continue
      if (this.player.position.distanceTo(pad.mesh.position) < 1.3 && this.money > 0) {
        const rate = 55 * dt
        const pay = Math.min(this.money, rate, pad.cost - pad.paid)
        this.money -= pay
        pad.paid += pay
        const left = Math.max(0, Math.ceil(pad.cost - pad.paid))
        if (left !== pad.lastShown) {
          pad.lastShown = left
          this.refreshUnlockLabel(pad)
        }
        if (pad.paid >= pad.cost) {
          pad.done = true
          pad.active = false
          this.scene.remove(pad.mesh)
          this.onUnlock(pad.id)
        }
      }
    }
  }

  private onUnlock(id: string, opts?: { silent?: boolean }) {
    if (this.unlocked.has(id)) return
    const silent = opts?.silent ?? false
    this.unlocked.add(id)
    this.refreshPadVisibility()

    if (id === 'plots') {
      this.expandFieldToFenceDepth()
      this.boostField({ max: 22, regen: 0.75, fillRatio: 0.5 })
      this.stage = Math.max(this.stage, 2)
      if (!silent) this.setHint('Field expanded to the fence! Tractor will auto-harvest this field')
    }

    if (id === 'tractor') {
      this.spawnTractor()
      this.boostField({ max: 30, regen: 0.55, fillRatio: 0.45 })
      this.stage = Math.max(this.stage, 3)
      const dumpPad = makeZonePlane(1.6, 1.6, 0xfbbf24, 0.3)
      dumpPad.position.set(this.dumpPos.x, 0.04, this.dumpPos.z)
      this.scene.add(dumpPad)
      const dumpLabel = makeLabelSprite('DUMP', '#ffe08a')
      dumpLabel.position.set(this.dumpPos.x, 0.85, this.dumpPos.z)
      this.scene.add(dumpLabel)
      if (!silent) this.setHint('Tractor harvests the field → DUMP. Hire a helper!')
    }

    if (id === 'helper') {
      this.spawnHelper()
      this.stage = Math.max(this.stage, 4)
      this.maxStack = 22
      if (!silent) this.setHint('Worker hauls crops to the counter. Next: process into jars!')
    }

    if (id === 'processor') {
      const machine = makeProcessor()
      machine.position.copy(this.processorPos)
      machine.rotation.y = Math.PI
      this.scene.add(machine)
      const zone = makeZonePlane(1.8, 1.5, 0xa78bfa, 0.4)
      zone.position.set(this.processZone.x, 0.04, this.processZone.z)
      this.scene.add(zone)
      const label = makeLabelSprite('PROCESS', '#d8b4fe')
      label.position.set(this.processZone.x, 1.0, this.processZone.z)
      this.scene.add(label)
      this.stage = Math.max(this.stage, 5)
      if (!silent) this.setHint('Stand on PROCESS with crops → jars sell for more!')
    }

    if (id === 'cashier') {
      this.autoCashier = true
      this.stage = Math.max(this.stage, 6)
      const star = makeLabelSprite('AUTO SELL', '#86efac')
      star.position.set(this.moneyDropPos.x, 1.4, this.moneyDropPos.z)
      this.scene.add(star)
      if (!silent) this.setHint('Cashier sells automatically. Unlock the barn!')
    }

    if (id === 'barn') {
      const barn = makeBarn()
      barn.position.set(-8.5, 0, -5.8)
      this.scene.add(barn)
      this.boostField({ max: 45, regen: 0.35, fillRatio: 0.6 })
      this.rebuildFence(11, 11)
      this.mapMax = 11
      this.mapMaxWest = 11
      this.expandFieldToFenceDepth()
      this.stage = 7
      this.maxStack = 28
      if (!silent) this.setHint('Barn boosts the field! Next: chicken coop for eggs')
    }

    if (id === 'chickens') {
      this.spawnChickens()
      this.stage = Math.max(this.stage, 8)
      if (!silent) this.setHint('Chickens lay eggs near the coop — sell them for cash!')
    }

    if (id === 'boots') {
      this.playerSpeedMul = 1.45
      this.stage = Math.max(this.stage, 9)
      if (!silent) this.setHint('Speed boost! Hire a money collector next')
    }

    if (id === 'collector') {
      this.spawnCollector()
      this.autoMoney = true
      this.stage = Math.max(this.stage, 10)
      if (!silent) this.setHint('Collector picks up cash. Upgrade collectors or unlock truck!')
    }

    if (id === 'collectorUp') {
      this.collectorMoveMul *= 1.55
      this.collectorGrabMul *= 2.2
      this.stage = Math.max(this.stage, 11)
      if (!silent) this.setHint('Collectors move and scoop cash faster!')
    }

    if (id === 'truck') {
      this.spawnTruckBayA()
      this.stage = Math.max(this.stage, 11)
      if (!silent) this.setHint('Load jars on truck bay A for big bonus payouts!')
    }

    if (id === 'autoprocess') {
      this.spawnProcessorBot()
      this.autoProcess = true
      this.stage = Math.max(this.stage, 12)
      this.maxStack = 36
      if (!silent) this.setHint('Factory bot online. Expand the map for late-game!')
    }

    if (id === 'mapExpand') {
      this.rebuildFence(17, 11)
      this.mapMax = 18
      this.mapMaxWest = Math.max(this.mapMaxWest, 18)
      this.expandFieldToFenceDepth()
      this.stage = Math.max(this.stage, 13)
      if (!silent) this.setHint('Map expanded east! Hire an egg runner next')
    }

    if (id === 'eggRunner') {
      this.spawnEggRunner()
      this.stage = Math.max(this.stage, 14)
      if (!silent) this.setHint('Egg runner delivers to the shop. Unlock jar loader!')
    }

    if (id === 'jarLoader') {
      this.spawnJarLoader()
      this.stage = Math.max(this.stage, 15)
      if (!silent) this.setHint('Jar loader fills truck bay A. Speed up the couriers next!')
    }

    if (id === 'workerSpeed') {
      this.workerSpeedMul = 1.55
      this.stage = Math.max(this.stage, 16)
      if (!silent) this.setHint('Couriers move faster! Unlock a second truck bay!')
    }

    if (id === 'truckBay2') {
      this.activateTruckStation('B')
      this.stage = Math.max(this.stage, 17)
      if (!silent) this.setHint('Truck bay B online. Unlock the wheat field!')
    }

    if (id === 'field2') {
      this.spawnField2()
      this.stage = Math.max(this.stage, 18)
      if (!silent) this.setHint('Wheat field ready. Build a second shop!')
    }

    if (id === 'shop2') {
      this.spawnShop2()
      this.stage = Math.max(this.stage, 19)
      if (!silent) this.setHint('Shop 2 open! Hire a SELL-B courier for wheat')
    }

    if (id === 'shop2Helper') {
      this.spawnShop2Helper()
      this.stage = Math.max(this.stage, 20)
      if (!silent) this.setHint('Courier hauls wheat to SELL-B. Hire a money collector for shop 2!')
    }

    if (id === 'collector2') {
      this.spawnCollector2()
      this.autoMoney2 = true
      this.stage = Math.max(this.stage, 21)
      if (!silent) this.setHint('Shop 2 cash collector online. Unlock auto cashier!')
    }

    if (id === 'collectorUp2') {
      this.collectorMoveMul *= 1.45
      this.collectorGrabMul *= 2.0
      this.stage = Math.max(this.stage, 22)
      if (!silent) this.setHint('All collectors scoop even faster!')
    }

    if (id === 'cashier2') {
      this.autoCashier2 = true
      this.stage = Math.max(this.stage, 22)
      const star = makeLabelSprite('AUTO SELL-B', '#86efac')
      star.position.set(this.moneyDropPos2.x, 1.4, this.moneyDropPos2.z)
      this.scene.add(star)
      if (!silent) this.setHint('Shop 2 sells automatically. Unlock truck bay C!')
    }

    if (id === 'truckBay3') {
      this.activateTruckStation('C')
      this.stage = Math.max(this.stage, 23)
      this.maxStack = 42
      if (!silent) this.setHint('Three truck bays running. Expand west for the factory line!')
    }

    if (id === 'westExpand') {
      this.rebuildFence(this.fenceExtent, this.fenceNorth, 22)
      this.mapMaxWest = 23
      this.expandFieldToFenceDepth()
      this.stage = Math.max(this.stage, 24)
      if (!silent) this.setHint('West yard open! Build the goods factory')
    }

    if (id === 'factory') {
      this.spawnFactory()
      this.stage = Math.max(this.stage, 25)
      if (!silent) this.setHint('Factory producing goods. Unlock the conveyor belt!')
    }

    if (id === 'conveyor') {
      this.spawnConveyor()
      this.stage = Math.max(this.stage, 26)
      if (!silent) this.setHint('Belt running north. Buy a train to ship goods!')
    }

    if (id === 'train') {
      this.spawnTrain()
      this.rebuildFence(this.fenceExtent, this.fenceNorth)
      this.stage = Math.max(this.stage, 27)
      if (!silent) this.setHint('Train loads goods and pays out. Hire a depot cashier!')
    }

    if (id === 'trainCollector') {
      this.spawnCollectorTrain()
      this.autoMoneyTrain = true
      this.stage = Math.max(this.stage, 28)
      if (!silent) this.setHint('Depot collector picks up train cash automatically!')
    }

    if (id === 'collectorUp3') {
      this.collectorMoveMul *= 1.4
      this.collectorGrabMul *= 2.2
      this.stage = Math.max(this.stage, 29)
      if (!silent) this.setHint('Max collector speed — piles vanish!')
    }

    if (id === 'factoryUp') {
      this.factoryRate *= 1.5
      this.stage = Math.max(this.stage, 29)
      if (!silent) this.setHint('Factory runs 50% faster!')
    }

    if (id === 'conveyorUp') {
      this.conveyorSpeed *= 1.5
      this.stage = Math.max(this.stage, 30)
      if (!silent) this.setHint('Conveyor 50% faster!')
    }

    if (id === 'trainUp') {
      this.trainCapacity += 24
      this.trainPayoutMul *= 1.4
      this.stage = Math.max(this.stage, 31)
      if (!silent) this.setHint('Train holds more and pays better!')
    }

    if (id === 'portal1') {
      this.activatePortal(0)
      this.stage = Math.max(this.stage, 32)
      if (!silent) this.setHint('Portal 1 online — goods grow in value!')
    }

    if (id === 'portal2') {
      this.activatePortal(1)
      this.stage = Math.max(this.stage, 33)
      if (!silent) this.setHint('Portal 2 stacks with the first!')
    }

    if (id === 'portal3') {
      this.activatePortal(2)
      this.stage = Math.max(this.stage, 34)
      if (!silent) this.setHint('All three portals stacked — mega goods!')
    }

    this.stageEl.textContent = String(this.stage)
    if (!this.loadingSave) this.saveProgress()
  }

  private setHint(text: string) {
    this.hintEl.textContent = text
    this.hintEl.classList.remove('hidden')
    this.hintTimer = 10
  }

  private spawnTractor() {
    if (this.tractor) return
    const mesh = makeTractorMesh()
    mesh.position.set(this.dumpPos.x, 0, this.dumpPos.z)
    this.scene.add(mesh)
    this.tractor = {
      mesh,
      cargo: [],
      state: 'seek',
      targetPile: null,
      timer: 0,
    }
  }

  private updateTractor(dt: number) {
    const tr = this.tractor
    if (!tr) return

    const cargoRoot = tr.mesh.getObjectByName('cargo') as THREE.Group
    const field = this.getField()

    if (tr.state === 'seek') {
      if (field.count <= 0) return
      tr.targetPile = field
      // Drive to a point on the field near the crop mass
      const harvestSpot = field.pos.clone()
      harvestSpot.x += Math.sin(this.clock.elapsedTime * 0.4) * 1.5
      this.moveToward(tr.mesh, harvestSpot, 4.5 * dt)
      if (this.inField(tr.mesh.position, field, 0.2)) {
        tr.state = 'harvest'
        tr.timer = 0
      }
    } else if (tr.state === 'harvest') {
      tr.timer += dt
      if (field.count <= 0 || tr.cargo.length >= 14) {
        tr.state = 'dump'
        return
      }
      if (tr.timer >= 0.18) {
        tr.timer = 0
        field.count--
        this.rebuildCropVisual(field)
        tr.cargo.push('crop')
        const item = makeCropItem()
        item.position.y = (tr.cargo.length - 1) * 0.28
        cargoRoot.add(item)
      }
    } else if (tr.state === 'dump') {
      this.moveToward(tr.mesh, this.dumpPos, 4.8 * dt)
      if (tr.mesh.position.distanceTo(this.dumpPos) < 1.2) {
        const gs = this.getOrCreateGroundStack(this.dumpPos)
        while (tr.cargo.length && gs.kinds.length < 30) {
          gs.kinds.push(tr.cargo.pop()!)
        }
        while (cargoRoot.children.length) cargoRoot.remove(cargoRoot.children[0]!)
        this.rebuildGroundStack(gs)
        tr.state = 'seek'
        tr.targetPile = null
      }
    }
  }

  private spawnHelper() {
    if (this.helper) return
    const mesh = makeCharacter(0x16a34a)
    mesh.position.set(3.5, 0, 5.5)
    this.scene.add(mesh)
    const stackRoot = new THREE.Group()
    stackRoot.position.set(0, 1.35, 0)
    mesh.add(stackRoot)
    this.helper = {
      mesh,
      stack: [],
      stackRoot,
      state: 'seek',
      target: this.dumpPos.clone(),
      timer: 0,
    }
  }

  private updateHelper(dt: number) {
    const h = this.helper
    if (!h) return

    if (h.state === 'seek') {
      // Prefer tractor dump, else any crop pile
      const dump = this.groundStacks.find((g) => g.kinds.length > 0)
      if (dump) {
        h.target.copy(dump.pos)
        this.moveToward(h.mesh, h.target, this.workerStep(4.2, dt))
        if (h.mesh.position.distanceTo(dump.pos) < 1.3) {
          while (h.stack.length < 10 && dump.kinds.length > 0) {
            const kind = dump.kinds.pop()!
            const item = makeItem(kind)
            item.position.y = h.stack.length * 0.32
            h.stackRoot.add(item)
            h.stack.push(kind)
          }
          this.rebuildGroundStack(dump)
          if (h.stack.length > 0) h.state = 'carry'
        }
        return
      }

      const field = this.getField()
      if (field.count <= 0) return
      // Approach field edge near dump side
      const edge = new THREE.Vector3(field.pos.x - field.halfW + 0.5, 0, field.pos.z)
      h.target.copy(edge)
      this.moveToward(h.mesh, h.target, this.workerStep(4.2, dt))
      if (this.inField(h.mesh.position, field)) {
        while (h.stack.length < 10 && field.count > 0) {
          field.count--
          const item = makeItem('crop')
          item.position.y = h.stack.length * 0.32
          h.stackRoot.add(item)
          h.stack.push('crop')
        }
        this.rebuildCropVisual(field)
        if (h.stack.length > 0) h.state = 'carry'
      }
    } else if (h.state === 'carry') {
      h.target.copy(this.sellZoneCenter)
      this.moveToward(h.mesh, h.target, this.workerStep(4.4, dt))
      if (h.mesh.position.distanceTo(this.sellZoneCenter) < 1.3) {
        h.state = 'deposit'
        h.timer = 0
      }
    } else if (h.state === 'deposit') {
      h.timer += dt
      if (h.timer >= 0.12 && h.stack.length > 0 && this.counterStock.length < 48) {
        h.timer = 0
        const kind = h.stack.pop()!
        const child = h.stackRoot.children[h.stackRoot.children.length - 1]
        if (child) h.stackRoot.remove(child)
        this.counterStock.push(kind)
        this.rebuildCounterStock()
      }
      if (h.stack.length === 0) h.state = 'seek'
    }
  }

  private updateProcessing(dt: number) {
    if (!this.unlocked.has('processor')) return
    this.processCooldown -= dt
    if (this.processCooldown > 0) return
    if (this.player.position.distanceTo(this.processZone) > 1.4) return
    if (!this.stack.includes('crop')) return
    this.convertOneCropFromPlayer()
    this.processCooldown = 0.28
  }

  private convertOneCropFromPlayer() {
    const idx = this.stack.lastIndexOf('crop')
    if (idx < 0) return
    this.stack.splice(idx, 1)
    while (this.stackRoot.children.length) this.stackRoot.remove(this.stackRoot.children[0]!)
    const kinds = [...this.stack]
    this.stack.length = 0
    for (const k of kinds) this.pushStack(k)

    const out = this.getOrCreateGroundStack(this.processOutPos)
    if (out.kinds.length < 24) {
      out.kinds.push('jar')
      this.rebuildGroundStack(out)
    }
  }

  private spawnChickens() {
    if (this.chickens.length) return
    const coop = makeCoop()
    coop.position.set(7.5, 0, -8.5)
    coop.rotation.y = Math.PI / 2
    this.scene.add(coop)
    const chickenSpots = [
      [7.15, -8.15],
      [7.85, -8.15],
      [7.15, -8.85],
      [7.85, -8.85],
    ]
    for (const [x, z] of chickenSpots) {
      const ch = makeChicken()
      ch.position.set(x!, 0, z!)
      this.scene.add(ch)
      this.chickens.push(ch)
    }
    const pad = makeZonePlane(1.6, 1.6, 0xfde68a, 0.35)
    pad.position.set(this.eggPos.x, 0.04, this.eggPos.z)
    this.scene.add(pad)
    const label = makeLabelSprite('EGGS', '#fef3c7')
    label.position.set(this.eggPos.x, 0.9, this.eggPos.z)
    this.scene.add(label)
  }

  private updateChickens(dt: number) {
    if (!this.unlocked.has('chickens')) return
    for (const ch of this.chickens) {
      ch.position.y = Math.sin(this.clock.elapsedTime * 4 + ch.position.x) * 0.03
      ch.rotation.y += dt * 0.6
    }
    this.eggTimer += dt
    if (this.eggTimer >= 1.4) {
      this.eggTimer = 0
      const gs = this.getOrCreateGroundStack(this.eggPos)
      if (gs.kinds.length < 20) {
        gs.kinds.push('egg')
        this.rebuildGroundStack(gs)
      }
    }
  }

  private spawnCollector() {
    if (this.collector) return
    const mesh = makeCharacter(0xf59e0b)
    mesh.position.set(this.moneyDropPos.x, 0, this.moneyDropPos.z - 2.5)
    this.scene.add(mesh)
    const stackRoot = new THREE.Group()
    stackRoot.position.set(0, 1.35, 0)
    mesh.add(stackRoot)
    this.collector = {
      mesh,
      stack: [],
      stackRoot,
      state: 'seek',
      target: this.moneyDropPos.clone(),
      timer: 0,
    }
  }

  private spawnCollector2() {
    if (this.collector2) return
    const mesh = makeCharacter(0xea580c)
    mesh.position.set(this.moneyDropPos2.x, 0, this.moneyDropPos2.z - 2.5)
    this.scene.add(mesh)
    const stackRoot = new THREE.Group()
    stackRoot.position.set(0, 1.35, 0)
    mesh.add(stackRoot)
    this.collector2 = {
      mesh,
      stack: [],
      stackRoot,
      state: 'seek',
      target: this.moneyDropPos2.clone(),
      timer: 0,
    }
  }

  private updateCollector(dt: number) {
    if (!this.collector) return
    this.updateMoneyCollectorUnit(this.collector, this.moneyDropPos, dt)
  }

  private updateCollector2(dt: number) {
    if (!this.collector2) return
    this.updateMoneyCollectorUnit(this.collector2, this.moneyDropPos2, dt)
  }

  private spawnCollectorTrain() {
    if (this.collectorTrain) return
    const mesh = makeCharacter(0xd97706)
    mesh.position.set(this.trainMoneyPos.x, 0, this.trainMoneyPos.z - 2.2)
    this.scene.add(mesh)
    const stackRoot = new THREE.Group()
    stackRoot.position.set(0, 1.35, 0)
    mesh.add(stackRoot)
    this.collectorTrain = {
      mesh,
      stack: [],
      stackRoot,
      state: 'seek',
      target: this.trainMoneyPos.clone(),
      timer: 0,
    }
    const star = makeLabelSprite('AUTO DEPOT', '#86efac')
    star.position.set(this.trainMoneyPos.x, 1.4, this.trainMoneyPos.z)
    this.scene.add(star)
  }

  private updateCollectorTrain(dt: number) {
    if (!this.collectorTrain) return
    this.updateMoneyCollectorUnit(this.collectorTrain, this.trainMoneyPos, dt)
  }

  /** Collect cash only from piles near this shop's money pad. */
  private updateMoneyCollectorUnit(c: HelperAI, home: THREE.Vector3, dt: number) {
    const stack = this.moneyStacks
      .filter((s) => s.amount > 0 && s.pos.distanceTo(home) < 2.5)
      .sort(
        (a, b) =>
          a.pos.distanceTo(c.mesh.position) - b.pos.distanceTo(c.mesh.position),
      )[0]

    const moveHome = 3.4 * this.collectorMoveMul
    const moveGrab = 5.2 * this.collectorMoveMul
    if (!stack) {
      this.moveToward(c.mesh, home, this.workerStep(moveHome, dt))
      return
    }

    this.moveToward(c.mesh, stack.pos, this.workerStep(moveGrab, dt))
    if (c.mesh.position.distanceTo(stack.pos) < 1.25) {
      const rate = 140 * this.collectorGrabMul * this.workerSpeedMul
      const take = Math.min(stack.amount, rate * dt)
      if (take > 0) {
        stack.amount -= take
        this.money += take
        this.syncMoneyVisual(stack)
        this.pulseMoney()
      }
    }
  }

  private spawnTruckBayA() {
    this.ensureStation(
      'A',
      new THREE.Vector3(7.5, 0, 1.5),
      ['jar'],
      'LOAD-A',
      true,
    )
  }

  private activateTruckStation(id: 'B' | 'C') {
    if (id === 'B') {
      this.ensureStation(
        'B',
        new THREE.Vector3(7.5, 0, -0.8),
        ['jar'],
        'LOAD-B',
        true,
      )
    } else {
      this.ensureStation(
        'C',
        new THREE.Vector3(7.5, 0, -3.1),
        ['jar', 'wheat'],
        'LOAD-C',
        true,
      )
    }
  }

  private ensureStation(
    id: string,
    loadZone: THREE.Vector3,
    accepts: ItemKind[],
    labelText: string,
    spawnNow: boolean,
  ) {
    let st = this.truckStations.find((s) => s.id === id)
    if (!st) {
      // Truck parks beside the LOAD pad (same Z), not behind it
      const waitPos = loadZone.clone().add(new THREE.Vector3(2.8, 0, 0))
      const leavePos = new THREE.Vector3(this.truckLeaveX(), 0, waitPos.z)
      st = {
        id,
        loadZone: loadZone.clone(),
        waitPos,
        leavePos,
        accepts,
        truck: null,
        respawn: 0,
        active: true,
      }
      this.truckStations.push(st)
      const zone = makeZonePlane(2.2, 2.0, 0x38bdf8, 0.4)
      zone.position.set(loadZone.x, 0.04, loadZone.z)
      this.scene.add(zone)
      const label = makeLabelSprite(labelText, '#bae6fd')
      label.position.set(loadZone.x, 1.0, loadZone.z)
      this.scene.add(label)
      // Open east fence at this bay so the truck can enter/leave
      this.rebuildFence(this.fenceExtent, this.fenceNorth)
    } else {
      st.active = true
      st.accepts = accepts
      this.rebuildFence(this.fenceExtent, this.fenceNorth)
    }
    if (spawnNow && !st.truck) this.spawnTruckForStation(st)
  }

  private spawnTruckForStation(st: TruckStation) {
    const mesh = makeTruck()
    mesh.position.copy(st.leavePos)
    this.scene.add(mesh)
    const label = makeLabelSprite('0/8', '#ffffff')
    label.position.set(0, 2.2, 0)
    mesh.add(label)
    st.truck = {
      mesh,
      need: 8,
      filled: 0,
      state: 'arrive',
      waitPos: st.waitPos.clone(),
      leavePos: st.leavePos.clone(),
      label,
      cooldown: 0,
    }
  }

  private refreshTruckLabel(t: TruckOrder) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 96
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(16, 16, 224, 64)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 42px Segoe UI, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${t.filled}/${t.need}`, 128, 48)
    const mat = t.label.material
    mat.map?.dispose()
    mat.map = new THREE.CanvasTexture(canvas)
    mat.needsUpdate = true
  }

  private tryLoadItemOntoTruck(st: TruckStation, kind: ItemKind): boolean {
    const t = st.truck
    if (!t || t.state !== 'wait' || t.filled >= t.need) return false
    if (!st.accepts.includes(kind)) return false
    t.filled++
    const cargo = t.mesh.getObjectByName('cargo') as THREE.Group
    const item = makeItem(kind)
    item.position.set(
      ((t.filled - 1) % 3) * 0.35 - 0.35,
      Math.floor((t.filled - 1) / 3) * 0.32,
      0,
    )
    cargo.add(item)
    this.refreshTruckLabel(t)
    return true
  }

  private completeTruck(st: TruckStation) {
    const t = st.truck
    if (!t) return
    const bonus = 180 + this.stage * 15 + (st.id === 'C' ? 40 : st.id === 'B' ? 20 : 0)
    this.dropMoney(bonus, this.moneyDropPos)
    this.money += Math.floor(bonus * 0.25)
    if (this.goal.id === 'truck') {
      this.goal.current++
      if (this.goal.current >= this.goal.target) {
        const reward = this.goal.reward
        this.money += reward
        this.goalsDone++
        this.nextGoal()
        this.setHint(`Truck goal done! +$${reward}`)
      }
    }
    this.setHint(`Truck ${st.id} full! Bonus payout`)
    t.state = 'leave'
  }

  private updateTruckStations(dt: number) {
    for (const st of this.truckStations) {
      if (!st.active) continue
      if (st.respawn > 0) {
        st.respawn -= dt
        if (st.respawn <= 0 && !st.truck) this.spawnTruckForStation(st)
      }
      const t = st.truck
      if (!t) continue

      if (t.state === 'arrive') {
        this.moveToward(t.mesh, t.waitPos, 5.5 * dt)
        if (t.mesh.position.distanceTo(t.waitPos) < 0.3) t.state = 'wait'
        continue
      }

      if (t.state === 'wait') {
        // Player manual load: any accepted kind from stack
        if (this.player.position.distanceTo(st.loadZone) < 1.5 && t.filled < t.need) {
          t.cooldown -= dt
          if (t.cooldown <= 0) {
            const kind = [...this.stack].reverse().find((k) => st.accepts.includes(k))
            if (kind) {
              t.cooldown = 0.22
              const idx = this.stack.lastIndexOf(kind)
              if (idx >= 0) {
                this.stack.splice(idx, 1)
                while (this.stackRoot.children.length) {
                  this.stackRoot.remove(this.stackRoot.children[0]!)
                }
                const kinds = [...this.stack]
                this.stack.length = 0
                for (const k of kinds) this.pushStack(k)
                this.tryLoadItemOntoTruck(st, kind)
              }
            }
          }
        }
        if (t.filled >= t.need) this.completeTruck(st)
        continue
      }

      if (t.state === 'leave') {
        this.moveToward(t.mesh, t.leavePos, 6 * dt)
        if (t.mesh.position.distanceTo(t.leavePos) < 0.4) {
          this.scene.remove(t.mesh)
          st.truck = null
          st.respawn = 4
        }
      }
    }
  }

  private spawnFactory() {
    if (this.factoryMesh) return
    const mesh = makeFactory()
    mesh.position.set(BELT_X, 0, -8)
    this.scene.add(mesh)
    this.factoryMesh = mesh
    this.factoryReady = true
    this.factorySpawnTimer = 0.5
    const label = makeLabelSprite('FACTORY', '#fbbf24')
    label.position.set(BELT_X, 2.8, -8)
    this.scene.add(label)
  }

  private spawnConveyor() {
    if (this.conveyorGroup) return
    const group = new THREE.Group()
    const span = BELT_Z_END - BELT_Z_START
    const segLen = 2.2
    const count = Math.ceil(span / segLen)
    for (let i = 0; i < count; i++) {
      const seg = makeConveyorSegment(segLen)
      const z = BELT_Z_START + segLen * 0.5 + i * segLen
      seg.position.set(BELT_X, 0, Math.min(z, BELT_Z_END - segLen * 0.5))
      group.add(seg)
    }
    this.scene.add(group)
    this.conveyorGroup = group
    this.conveyorReady = true
    const label = makeLabelSprite('BELT', '#94a3b8')
    label.position.set(BELT_X - 1.6, 1.2, 1)
    this.scene.add(label)
  }

  private spawnTrain() {
    if (this.train) return
    const waitPos = TRAIN_WAIT.clone()
    const leavePos = new THREE.Vector3(waitPos.x, 0, this.trainLeaveZ())
    const mesh = makeTrain()
    mesh.position.copy(leavePos)
    // Cabin/front on local −X → world +Z (north). Cargo on +X faces south into the depot.
    mesh.rotation.y = Math.PI / 2
    this.scene.add(mesh)
    const label = makeLabelSprite(`0/${this.trainCapacity}`, '#ffffff')
    label.position.set(0, 2.4, 0)
    mesh.add(label)

    const depot = makeTrainDepot()
    depot.position.copy(DEPOT_POS)
    this.scene.add(depot)
    const depotLabel = makeLabelSprite('DEPOT', '#fde68a')
    depotLabel.position.set(DEPOT_POS.x, 3.2, DEPOT_POS.z)
    this.scene.add(depotLabel)

    const railLen = RAIL_Z_END - RAIL_Z_START
    const rails = makeTrainRails(railLen)
    rails.position.set(BELT_X, 0, (RAIL_Z_START + RAIL_Z_END) / 2)
    this.scene.add(rails)

    const moneyPad = makeZonePlane(1.4, 1.4, 0x94a3b8, 0.35)
    moneyPad.position.set(this.trainMoneyPos.x, 0.04, this.trainMoneyPos.z)
    this.scene.add(moneyPad)

    this.train = {
      mesh,
      state: 'arrive',
      cargoValue: 0,
      cargoCount: 0,
      waitPos,
      leavePos,
      label,
      loadCooldown: 0,
      respawn: 0,
    }
    this.refreshTrainLabel()
  }

  /** Slide train without turning — always nose north (back into station, drive out forward). */
  private moveTrain(mesh: THREE.Object3D, target: THREE.Vector3, step: number) {
    const dx = target.x - mesh.position.x
    const dz = target.z - mesh.position.z
    const dist = Math.hypot(dx, dz)
    if (dist < 0.05) return
    const s = Math.min(step, dist)
    mesh.position.x += (dx / dist) * s
    mesh.position.z += (dz / dist) * s
    mesh.rotation.y = Math.PI / 2
  }

  private refreshTrainLabel() {
    const t = this.train
    if (!t) return
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 96
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(16, 16, 224, 64)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 42px Segoe UI, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${t.cargoCount}/${this.trainCapacity}`, 128, 48)
    const mat = t.label.material
    mat.map?.dispose()
    mat.map = new THREE.CanvasTexture(canvas)
    mat.needsUpdate = true
  }

  private activatePortal(index: number) {
    if (index < 0 || index > 2) return
    if (this.portalsActive[index]) return
    this.portalsActive[index] = true
    const colors = [0xa855f7, 0x22d3ee, 0xf43f5e]
    const gate = makePortalGate(colors[index])
    gate.position.set(BELT_X, 0, PORTAL_ZS[index]!)
    this.scene.add(gate)
    this.portalMeshes[index] = gate
    const label = makeLabelSprite(`PORTAL ${index + 1}`, '#e9d5ff')
    label.position.set(BELT_X + 1.7, 1.5, PORTAL_ZS[index]!)
    this.scene.add(label)
  }

  private spawnGoodsOnBelt() {
    if (!this.factoryReady) return
    if (this.goodsOnBelt.length >= 64) return
    const mesh = makeGoods(0)
    const pos = new THREE.Vector3(BELT_X, 0.28, BELT_Z_START)
    mesh.position.copy(pos)
    this.scene.add(mesh)
    this.goodsOnBelt.push({
      mesh,
      pos,
      baseValue: GOODS_BASE_VALUE,
      unitValue: GOODS_BASE_VALUE,
      scale: 1,
      portalsPassed: 0,
    })
  }

  private applyPortalToGoods(g: GoodsItem, portalIndex: number) {
    if (g.portalsPassed > portalIndex) return
    g.portalsPassed = portalIndex + 1
    g.scale *= 1.35
    g.unitValue *= 1.5
    const tier = Math.min(3, g.portalsPassed) as 0 | 1 | 2 | 3
    const next = makeGoods(tier)
    next.position.copy(g.pos)
    next.scale.setScalar(g.scale)
    this.scene.remove(g.mesh)
    this.scene.add(next)
    g.mesh = next
  }

  private updateFactoryBeltTrain(dt: number) {
    if (this.factoryReady) {
      this.factorySpawnTimer -= dt
      if (this.factorySpawnTimer <= 0) {
        this.spawnGoodsOnBelt()
        this.factorySpawnTimer = 1 / Math.max(0.05, this.factoryRate)
      }
    }

    if (this.conveyorReady) {
      for (const g of this.goodsOnBelt) {
        // Stop at depot handoff — do not climb onto the train bay
        const capZ = this.train ? TRAIN_LOAD_POINT.z : BELT_Z_END
        if (g.pos.z < capZ) {
          g.pos.z = Math.min(capZ, g.pos.z + this.conveyorSpeed * dt)
        }
        g.mesh.position.copy(g.pos)
        for (let i = 0; i < 3; i++) {
          if (!this.portalsActive[i]) continue
          if (g.portalsPassed > i) continue
          if (g.pos.z >= PORTAL_ZS[i]!) this.applyPortalToGoods(g, i)
        }
      }
    }

    const t = this.train
    if (!t) return

    if (t.state === 'respawn') {
      t.respawn -= dt
      if (t.respawn <= 0) {
        t.mesh.position.copy(t.leavePos)
        t.cargoValue = 0
        t.cargoCount = 0
        const cargo = t.mesh.getObjectByName('cargo') as THREE.Group | undefined
        if (cargo) while (cargo.children.length) cargo.remove(cargo.children[0]!)
        this.refreshTrainLabel()
        this.scene.add(t.mesh)
        t.state = 'arrive'
      }
      return
    }

    if (t.state === 'arrive') {
      // Reverse south into the bay (nose stays north)
      this.moveTrain(t.mesh, t.waitPos, 5.5 * dt)
      if (t.mesh.position.distanceTo(t.waitPos) < 0.3) t.state = 'wait'
      return
    }

    if (t.state === 'wait') {
      t.loadCooldown -= dt
      if (t.loadCooldown <= 0 && t.cargoCount < this.trainCapacity) {
        let nearest: GoodsItem | null = null
        let best = 1.7
        for (const g of this.goodsOnBelt) {
          const d = g.pos.distanceTo(TRAIN_LOAD_POINT)
          if (d < best) {
            best = d
            nearest = g
          }
        }
        if (nearest) {
          t.loadCooldown = 0.06
          t.cargoCount++
          t.cargoValue += nearest.unitValue
          const cargo = t.mesh.getObjectByName('cargo') as THREE.Group
          // 3 rows across car width (local Z), several along length, then stacked up
          const ROWS = 3
          const ALONG = 4
          const maxVisual = ROWS * ALONG * 3
          if (cargo.children.length < maxVisual) {
            const idx = cargo.children.length
            const row = idx % ROWS
            const along = Math.floor(idx / ROWS) % ALONG
            const layer = Math.floor(idx / (ROWS * ALONG))
            const preview = makeGoods(Math.min(3, nearest.portalsPassed) as 0 | 1 | 2 | 3)
            preview.scale.setScalar(0.4)
            preview.position.set(
              along * 0.4 - 0.6,
              layer * 0.3,
              row * 0.4 - 0.4,
            )
            cargo.add(preview)
          }
          this.scene.remove(nearest.mesh)
          this.goodsOnBelt = this.goodsOnBelt.filter((x) => x !== nearest)
          this.refreshTrainLabel()
        }
      }
      if (t.cargoCount >= this.trainCapacity) this.completeTrain()
      return
    }

    if (t.state === 'leave') {
      // Drive forward north (same heading)
      this.moveTrain(t.mesh, t.leavePos, 6.5 * dt)
      if (t.mesh.position.distanceTo(t.leavePos) < 0.4) {
        this.scene.remove(t.mesh)
        t.state = 'respawn'
        t.respawn = 5
      }
    }
  }

  private completeTrain() {
    const t = this.train
    if (!t || t.cargoCount <= 0) return
    const payout = Math.floor(t.cargoValue * this.trainPayoutMul)
    this.dropMoney(payout, this.trainMoneyPos)
    this.money += Math.floor(payout * 0.2)
    this.setHint(`Train shipped! +$${payout}`)
    t.state = 'leave'
  }

  private spawnEggRunner() {
    if (this.eggRunner) return
    const mesh = makeCharacter(0xfef08a)
    mesh.position.copy(this.eggPos)
    this.scene.add(mesh)
    const stackRoot = new THREE.Group()
    stackRoot.position.set(0, 1.35, 0)
    mesh.add(stackRoot)
    this.eggRunner = {
      mesh,
      stack: [],
      stackRoot,
      state: 'seek',
      target: this.eggPos.clone(),
      timer: 0,
    }
  }

  private updateEggRunner(dt: number) {
    const w = this.eggRunner
    if (!w) return
    if (w.state === 'seek') {
      const eggs = this.groundStacks.find(
        (g) => g.pos.distanceTo(this.eggPos) < 0.6 && g.kinds.includes('egg'),
      )
      if (!eggs || eggs.kinds.length === 0) {
        this.moveToward(w.mesh, this.eggPos, this.workerStep(3, dt))
        return
      }
      this.moveToward(w.mesh, eggs.pos, this.workerStep(4.2, dt))
      if (w.mesh.position.distanceTo(eggs.pos) < 1.2) {
        while (w.stack.length < 8 && eggs.kinds.includes('egg')) {
          const i = eggs.kinds.lastIndexOf('egg')
          if (i < 0) break
          eggs.kinds.splice(i, 1)
          const item = makeItem('egg')
          item.position.y = w.stack.length * 0.32
          w.stackRoot.add(item)
          w.stack.push('egg')
        }
        this.rebuildGroundStack(eggs)
        if (w.stack.length > 0) w.state = 'carry'
      }
    } else if (w.state === 'carry') {
      this.moveToward(w.mesh, this.sellZoneCenter, this.workerStep(4.3, dt))
      if (w.mesh.position.distanceTo(this.sellZoneCenter) < 1.3) {
        w.state = 'deposit'
        w.timer = 0
      }
    } else if (w.state === 'deposit') {
      w.timer += dt
      if (w.timer >= 0.12 && w.stack.length > 0 && this.counterStock.length < 48) {
        w.timer = 0
        w.stack.pop()
        const child = w.stackRoot.children[w.stackRoot.children.length - 1]
        if (child) w.stackRoot.remove(child)
        this.counterStock.push('egg')
        this.rebuildCounterStock()
      }
      if (w.stack.length === 0) w.state = 'seek'
    }
  }

  private spawnJarLoader() {
    if (this.jarLoader) return
    const mesh = makeCharacter(0xfb923c)
    mesh.position.copy(this.processOutPos)
    this.scene.add(mesh)
    const stackRoot = new THREE.Group()
    stackRoot.position.set(0, 1.35, 0)
    mesh.add(stackRoot)
    this.jarLoader = {
      mesh,
      stack: [],
      stackRoot,
      state: 'seek',
      target: this.processOutPos.clone(),
      timer: 0,
    }
  }

  private updateJarLoader(dt: number) {
    const w = this.jarLoader
    if (!w) return
    if (w.state === 'seek') {
      const jars = this.groundStacks.find(
        (g) => g.pos.distanceTo(this.processOutPos) < 0.6 && g.kinds.includes('jar'),
      )
      if (!jars || !jars.kinds.includes('jar')) {
        this.moveToward(w.mesh, this.processOutPos, this.workerStep(3, dt))
        return
      }
      this.moveToward(w.mesh, jars.pos, this.workerStep(4.2, dt))
      if (w.mesh.position.distanceTo(jars.pos) < 1.2) {
        while (w.stack.length < 8 && jars.kinds.includes('jar')) {
          const i = jars.kinds.lastIndexOf('jar')
          if (i < 0) break
          jars.kinds.splice(i, 1)
          const item = makeItem('jar')
          item.position.y = w.stack.length * 0.32
          w.stackRoot.add(item)
          w.stack.push('jar')
        }
        this.rebuildGroundStack(jars)
        if (w.stack.length > 0) w.state = 'carry'
      }
    } else if (w.state === 'carry') {
      const st =
        this.truckStations.find(
          (s) =>
            s.active &&
            s.truck?.state === 'wait' &&
            s.truck.filled < s.truck.need &&
            s.accepts.includes('jar'),
        ) ?? this.truckStations.find((s) => s.active && s.accepts.includes('jar'))
      if (!st) {
        this.moveToward(w.mesh, this.processOutPos, this.workerStep(3, dt))
        return
      }
      this.moveToward(w.mesh, st.loadZone, this.workerStep(4.4, dt))
      if (w.mesh.position.distanceTo(st.loadZone) < 1.3) {
        w.state = 'deposit'
        w.timer = 0
        w.target.copy(st.loadZone)
      }
    } else if (w.state === 'deposit') {
      w.timer += dt
      const st = this.truckStations.find(
        (s) => s.active && s.loadZone.distanceTo(w.target) < 0.5,
      )
      if (!st || !st.truck || st.truck.state !== 'wait') {
        // Dump jars back to process out if truck left
        if (w.stack.length === 0) {
          w.state = 'seek'
          return
        }
        if (w.timer >= 0.15) {
          w.timer = 0
          w.stack.pop()
          const child = w.stackRoot.children[w.stackRoot.children.length - 1]
          if (child) w.stackRoot.remove(child)
          const out = this.getOrCreateGroundStack(this.processOutPos)
          out.kinds.push('jar')
          this.rebuildGroundStack(out)
        }
        if (w.stack.length === 0) w.state = 'seek'
        return
      }
      if (w.timer >= 0.18 && w.stack.length > 0) {
        w.timer = 0
        if (this.tryLoadItemOntoTruck(st, 'jar')) {
          w.stack.pop()
          const child = w.stackRoot.children[w.stackRoot.children.length - 1]
          if (child) w.stackRoot.remove(child)
          if (st.truck && st.truck.filled >= st.truck.need) this.completeTruck(st)
        } else {
          w.state = 'seek'
        }
      }
      if (w.stack.length === 0) w.state = 'seek'
    }
  }

  private spawnShop2Helper() {
    if (this.shop2Helper) return
    const mesh = makeCharacter(0x0284c7)
    mesh.position.set(this.sellZone2.x - 2, 0, this.sellZone2.z)
    this.scene.add(mesh)
    const stackRoot = new THREE.Group()
    stackRoot.position.set(0, 1.35, 0)
    mesh.add(stackRoot)
    this.shop2Helper = {
      mesh,
      stack: [],
      stackRoot,
      state: 'seek',
      target: this.fieldCenter2.clone(),
      timer: 0,
    }
  }

  private updateShop2Helper(dt: number) {
    const w = this.shop2Helper
    if (!w || !this.shop2Ready) return

    if (w.state === 'seek') {
      const wheatPile = this.groundStacks.find((g) => g.kinds.includes('wheat'))
      if (wheatPile && wheatPile.kinds.length > 0) {
        this.moveToward(w.mesh, wheatPile.pos, this.workerStep(4.2, dt))
        if (w.mesh.position.distanceTo(wheatPile.pos) < 1.3) {
          while (w.stack.length < 10 && wheatPile.kinds.includes('wheat')) {
            const i = wheatPile.kinds.lastIndexOf('wheat')
            if (i < 0) break
            wheatPile.kinds.splice(i, 1)
            const item = makeItem('wheat')
            item.position.y = w.stack.length * 0.32
            w.stackRoot.add(item)
            w.stack.push('wheat')
          }
          this.rebuildGroundStack(wheatPile)
          if (w.stack.length > 0) w.state = 'carry'
        }
        return
      }

      const field = this.getWheatField()
      if (!field || field.count <= 0) {
        this.moveToward(w.mesh, this.fieldCenter2, this.workerStep(3, dt))
        return
      }
      const edge = new THREE.Vector3(field.pos.x - field.halfW + 0.4, 0, field.pos.z)
      this.moveToward(w.mesh, edge, this.workerStep(4.2, dt))
      if (this.inField(w.mesh.position, field)) {
        while (w.stack.length < 10 && field.count > 0) {
          field.count--
          const item = makeItem('wheat')
          item.position.y = w.stack.length * 0.32
          w.stackRoot.add(item)
          w.stack.push('wheat')
        }
        this.rebuildCropVisual(field)
        if (w.stack.length > 0) w.state = 'carry'
      }
    } else if (w.state === 'carry') {
      this.moveToward(w.mesh, this.sellZone2, this.workerStep(4.4, dt))
      if (w.mesh.position.distanceTo(this.sellZone2) < 1.3) {
        w.state = 'deposit'
        w.timer = 0
      }
    } else if (w.state === 'deposit') {
      w.timer += dt
      if (w.timer >= 0.12 && w.stack.length > 0 && this.counterStock2.length < 48) {
        w.timer = 0
        w.stack.pop()
        const child = w.stackRoot.children[w.stackRoot.children.length - 1]
        if (child) w.stackRoot.remove(child)
        this.counterStock2.push('wheat')
        this.rebuildCounterStock2()
      }
      if (w.stack.length === 0) w.state = 'seek'
    }
  }

  private spawnField2() {
    if (this.crops.some((c) => c.kind === 'wheat')) {
      this.expandFieldToFenceDepth()
      return
    }
    const cx = this.fieldCenter2.x
    const halfW = 3.2
    const { halfD, cz } = this.fieldDepthToSouthFence()
    this.fieldCenter2.z = cz

    this.scene.add(this.wheatGroundGroup)

    const mesh = new THREE.Group()
    mesh.position.set(cx, 0.14, cz)
    this.scene.add(mesh)

    const pile: CropPile = {
      mesh,
      count: 8,
      max: 20,
      pos: new THREE.Vector3(cx, 0, cz),
      regen: 0.85,
      timer: 0,
      halfW,
      halfD,
      kind: 'wheat',
    }
    this.crops.push(pile)
    this.expandFieldToFenceDepth()
  }

  private rebuildWheatGround(field: CropPile) {
    while (this.wheatGroundGroup.children.length) {
      const child = this.wheatGroundGroup.children[0]!
      this.wheatGroundGroup.remove(child)
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh) {
          mesh.geometry?.dispose()
          const mat = mesh.material
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat?.dispose()
        }
      })
    }
    if (this.wheatLabel) {
      this.scene.remove(this.wheatLabel)
      this.wheatLabel.material.map?.dispose()
      this.wheatLabel.material.dispose()
      this.wheatLabel = null
    }

    const cx = field.pos.x
    const cz = field.pos.z
    const halfW = field.halfW
    const halfD = field.halfD

    const soil = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 2, 0.14, halfD * 2),
      new THREE.MeshLambertMaterial({ color: 0x785428 }),
    )
    soil.position.set(cx, 0.07, cz)
    this.wheatGroundGroup.add(soil)

    const furrowCount = Math.max(5, Math.round((halfD * 2) / 0.55))
    for (let i = 0; i < furrowCount; i++) {
      const t = furrowCount === 1 ? 0 : i / (furrowCount - 1)
      const zOff = (t - 0.5) * (halfD * 2 - 0.4)
      const furrow = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 2 - 0.3, 0.02, 0.12),
        new THREE.MeshLambertMaterial({ color: 0x5a3a1e }),
      )
      furrow.position.set(cx, 0.15, cz + zOff)
      this.wheatGroundGroup.add(furrow)
    }

    this.wheatLabel = makeLabelSprite('WHEAT', '#fde68a')
    this.wheatLabel.position.set(cx, 1.0, cz + halfD + 0.35)
    this.scene.add(this.wheatLabel)
  }

  private spawnShop2() {
    if (this.shop2Ready) return
    this.shop2Ready = true
    const counter = makeCounter()
    counter.position.set(12, 0, 8.7)
    this.scene.add(counter)
    const sell = makeZonePlane(2.2, 1.6, COLORS.sellZone, 0.4)
    sell.position.set(this.sellZone2.x, 0.04, this.sellZone2.z)
    this.scene.add(sell)
    const sellLabel = makeLabelSprite('SELL-B', '#7fffff')
    sellLabel.position.set(this.sellZone2.x, 0.9, this.sellZone2.z)
    this.scene.add(sellLabel)
    const moneyPad = makeZonePlane(1.4, 1.4, 0x94a3b8, 0.35)
    moneyPad.position.set(this.moneyDropPos2.x, 0.04, this.moneyDropPos2.z)
    this.scene.add(moneyPad)

    this.counterStockMesh2 = new THREE.Group()
    this.counterStockMesh2.position.set(12, 1.0, 8.85)
    this.scene.add(this.counterStockMesh2)

    this.queuePoints2 = []
    for (let i = 0; i < 5; i++) {
      this.queuePoints2.push(new THREE.Vector3(12, 0, 9.9 + i * 1.05))
    }
  }

  private updateShop2(dt: number) {
    if (!this.shop2Ready) return

    this.sellCooldown2 -= dt
    const playerSelling = this.player.position.distanceTo(this.sellZone2) < 1.5
    if (this.sellCooldown2 <= 0 && (this.autoCashier2 || playerSelling)) {
      const buyer = this.customers2.find((c) => c.state === 'queue' && c.slot === 0)
      if (
        buyer &&
        this.counterStock2.length > 0 &&
        buyer.mesh.position.distanceTo(this.servePos2) <= 0.75
      ) {
        buyer.state = 'buying'
        buyer.timer = 0
        this.sellCooldown2 = 0.05
      }
    }

    const maxCust = Math.min(5, 2 + Math.floor(this.stage / 3))
    this.spawnTimer2 -= dt
    if (this.spawnTimer2 <= 0 && this.customers2.length < maxCust) {
      this.spawnCustomer2()
      this.spawnTimer2 = 2.0
    }

    const queued = this.customers2.filter((c) => c.state === 'queue' || c.state === 'buying')
    queued.forEach((c, i) => {
      c.slot = i
      if (c.state === 'queue') {
        c.target.copy(this.queuePoints2[Math.min(i, this.queuePoints2.length - 1)]!)
      }
    })

    for (const c of this.customers2) {
      if (c.state === 'queue') {
        this.moveToward(c.mesh, c.target, 3.5 * dt)
      } else if (c.state === 'buying') {
        this.moveToward(c.mesh, this.servePos2, 4 * dt)
        if (c.mesh.position.distanceTo(this.servePos2) > 0.9) continue
        const canTrade =
          this.autoCashier2 || this.player.position.distanceTo(this.sellZone2) < 1.5
        if (!canTrade) continue
        c.timer += dt
        if (c.timer >= 0.26 && this.counterStock2.length > 0 && c.held < c.need) {
          c.timer = 0
          // Prefer wheat from shop2 stock
          let idx = this.counterStock2.findIndex((k) => k === 'wheat')
          if (idx < 0) idx = 0
          const kind = this.counterStock2.splice(idx, 1)[0]!
          this.rebuildCounterStock2()
          c.held++
          const item = makeItem(kind)
          item.position.set(0, 1.35 + (c.held - 1) * 0.32, 0)
          c.mesh.add(item)
          this.dropMoney(this.itemValue(kind), this.moneyDropPos2)
          this.progressGoal(1, kind)
        }
        if (
          c.held >= c.need ||
          (this.counterStock2.length === 0 && c.held > 0 && c.timer > 0.7)
        ) {
          c.state = 'leaving'
          c.target.copy(this.customerExit2)
        }
      } else if (c.state === 'leaving') {
        this.moveToward(c.mesh, c.target, 4.2 * dt)
        if (c.mesh.position.distanceTo(c.target) < 0.5) {
          this.scene.remove(c.mesh)
          c.dead = true
        }
      }
    }
    this.customers2 = this.customers2.filter((c) => !c.dead)
  }

  private spawnCustomer2() {
    const color = COLORS.npc[Math.floor(Math.random() * COLORS.npc.length)]!
    const mesh = makeCharacter(color)
    mesh.position.copy(this.customerSpawn2)
    this.scene.add(mesh)
    this.customers2.push({
      mesh,
      state: 'queue',
      need: CUSTOMER_NEED + Math.min(2, Math.floor(this.stage / 3)),
      held: 0,
      slot: this.customers2.length,
      timer: 0,
      target: this.queuePoints2[0]!.clone(),
    })
  }

  private spawnProcessorBot() {
    if (this.processorBot) return
    const mesh = makeCharacter(0x7c3aed)
    mesh.position.copy(this.processZone)
    this.scene.add(mesh)
    const stackRoot = new THREE.Group()
    stackRoot.position.set(0, 1.35, 0)
    mesh.add(stackRoot)
    this.processorBot = {
      mesh,
      stack: [],
      stackRoot,
      state: 'seek',
      target: this.dumpPos.clone(),
      timer: 0,
    }
  }

  private updateProcessorBot(dt: number) {
    const b = this.processorBot
    if (!b) return

    if (b.state === 'seek') {
      const src =
        this.groundStacks.find((g) => g.kinds.includes('crop') && g.kinds.length > 0) ||
        null
      if (src) {
        b.target.copy(src.pos)
        this.moveToward(b.mesh, b.target, this.workerStep(4, dt))
        if (b.mesh.position.distanceTo(src.pos) < 1.3) {
          while (b.stack.length < 8 && src.kinds.includes('crop')) {
            const i = src.kinds.lastIndexOf('crop')
            if (i < 0) break
            src.kinds.splice(i, 1)
            const item = makeItem('crop')
            item.position.y = b.stack.length * 0.32
            b.stackRoot.add(item)
            b.stack.push('crop')
          }
          this.rebuildGroundStack(src)
          if (b.stack.length > 0) b.state = 'carry'
        }
        return
      }
      const field = this.getField()
      if (field.count <= 2) return
      const edge = new THREE.Vector3(field.pos.x + field.halfW - 0.5, 0, field.pos.z)
      b.target.copy(edge)
      this.moveToward(b.mesh, b.target, this.workerStep(4, dt))
      if (this.inField(b.mesh.position, field)) {
        while (b.stack.length < 8 && field.count > 0) {
          field.count--
          const item = makeItem('crop')
          item.position.y = b.stack.length * 0.32
          b.stackRoot.add(item)
          b.stack.push('crop')
        }
        this.rebuildCropVisual(field)
        if (b.stack.length > 0) b.state = 'carry'
      }
    } else if (b.state === 'carry') {
      b.target.copy(this.processZone)
      this.moveToward(b.mesh, b.target, this.workerStep(4.2, dt))
      if (b.mesh.position.distanceTo(this.processZone) < 1.2) {
        b.state = 'deposit'
        b.timer = 0
      }
    } else if (b.state === 'deposit') {
      b.timer += dt
      if (b.timer >= 0.2 && b.stack.length > 0) {
        b.timer = 0
        b.stack.pop()
        const child = b.stackRoot.children[b.stackRoot.children.length - 1]
        if (child) b.stackRoot.remove(child)
        const out = this.getOrCreateGroundStack(this.processOutPos)
        if (out.kinds.length < 28) {
          out.kinds.push('jar')
          this.rebuildGroundStack(out)
        }
      }
      if (b.stack.length === 0) b.state = 'seek'
    }
  }

  private updateCamera(dt: number) {
    const target = new THREE.Vector3(
      this.player.position.x + 13,
      15,
      this.player.position.z + 13,
    )
    this.camera.position.lerp(target, 1 - Math.pow(0.001, dt))
    this.camera.lookAt(this.player.position.x, 0.5, this.player.position.z)
  }

  private updateHud(dt: number) {
    this.moneyEl.textContent = String(Math.floor(this.money))
    this.hintTimer -= dt
    if (this.hintTimer <= 0) this.hintEl.classList.add('hidden')
    if (this.goalEl && this.goalFill) {
      this.goalEl.textContent = `${this.goal.label}: ${this.goal.current}/${this.goal.target}`
      const pct = (this.goal.current / this.goal.target) * 100
      this.goalFill.style.width = `${pct}%`
    }
    this.saveTimer += dt
    if (this.saveTimer >= 2) {
      this.saveTimer = 0
      this.saveProgress()
    }
  }

  private saveProgress() {
    if (this.loadingSave) return
    const padPayments: Record<string, number> = {}
    for (const pad of this.unlockPads) {
      if (!pad.done && pad.paid > 0) padPayments[pad.id] = pad.paid
    }
    const data: SaveData = {
      v: 2,
      money: Math.floor(this.money),
      stage: this.stage,
      maxStack: this.maxStack,
      playerSpeedMul: this.playerSpeedMul,
      workerSpeedMul: this.workerSpeedMul,
      mapMax: this.mapMax,
      mapMaxWest: this.mapMaxWest,
      unlocked: [...this.unlocked],
      goalsDone: this.goalsDone,
      goal: { ...this.goal },
      fields: this.crops.map((c) => ({
        kind: c.kind,
        max: c.max,
        regen: c.regen,
        count: c.count,
      })),
      padPayments,
      factoryRate: this.factoryRate,
      conveyorSpeed: this.conveyorSpeed,
      trainCapacity: this.trainCapacity,
      trainPayoutMul: this.trainPayoutMul,
      portalsActive: [...this.portalsActive],
      collectorMoveMul: this.collectorMoveMul,
      collectorGrabMul: this.collectorGrabMul,
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch {
      // private mode / quota
    }
  }

  private loadProgress() {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(SAVE_KEY)
    } catch {
      return
    }
    if (!raw) return

    this.loadingSave = true
    try {
      const data = JSON.parse(raw) as SaveData
      if ((data.v !== 1 && data.v !== 2) || !Array.isArray(data.unlocked)) return

      for (const id of UNLOCK_ORDER) {
        if (!data.unlocked.includes(id)) continue
        const pad = this.unlockPads.find((p) => p.id === id)
        if (pad) {
          pad.done = true
          pad.active = false
          this.scene.remove(pad.mesh)
        }
        this.onUnlock(id, { silent: true })
      }

      for (const pad of this.unlockPads) {
        const paid = data.padPayments?.[pad.id]
        if (!pad.done && paid && paid > 0) {
          pad.paid = Math.min(pad.cost, paid)
          pad.lastShown = Math.ceil(pad.cost - pad.paid)
          this.refreshUnlockLabel(pad)
        }
      }

      this.money = Math.max(0, data.money ?? 0)
      this.stage = data.stage ?? this.stage
      this.maxStack = data.maxStack ?? this.maxStack
      this.playerSpeedMul = data.playerSpeedMul ?? this.playerSpeedMul
      this.workerSpeedMul = data.workerSpeedMul ?? this.workerSpeedMul
      this.mapMax = data.mapMax ?? this.mapMax
      this.mapMaxWest = data.mapMaxWest ?? this.mapMax
      if (this.unlocked.has('westExpand')) {
        this.mapMaxWest = Math.max(this.mapMaxWest, 23)
        this.rebuildFence(Math.max(this.fenceExtent, 17), 11, 22)
        this.expandFieldToFenceDepth()
      } else if (this.unlocked.has('mapExpand')) {
        this.mapMax = Math.max(this.mapMax, 18)
        this.mapMaxWest = Math.max(this.mapMaxWest, 18)
        this.rebuildFence(17, 11)
        this.expandFieldToFenceDepth()
      } else if (this.unlocked.has('barn')) {
        this.mapMax = Math.max(this.mapMax, 11)
        this.mapMaxWest = Math.max(this.mapMaxWest, 11)
        this.expandFieldToFenceDepth()
      } else if (this.unlocked.has('plots')) {
        this.expandFieldToFenceDepth()
      }

      // Saved rates override; otherwise onUnlock already applied upgrade multipliers once
      if (typeof data.factoryRate === 'number') this.factoryRate = data.factoryRate
      if (typeof data.conveyorSpeed === 'number') this.conveyorSpeed = data.conveyorSpeed
      if (typeof data.trainCapacity === 'number') {
        // Migrate old tiny capacities to the new baseline
        const minCap = this.unlocked.has('trainUp') ? 64 : 40
        this.trainCapacity = Math.max(data.trainCapacity, minCap)
      }
      if (typeof data.trainPayoutMul === 'number') this.trainPayoutMul = data.trainPayoutMul
      if (typeof data.collectorMoveMul === 'number') this.collectorMoveMul = data.collectorMoveMul
      if (typeof data.collectorGrabMul === 'number') this.collectorGrabMul = data.collectorGrabMul

      this.goalsDone = data.goalsDone ?? 0
      if (data.goal?.id && typeof data.goal.target === 'number') {
        this.goal = {
          id: data.goal.id,
          label: data.goal.label || 'Goal',
          current: Math.max(0, data.goal.current || 0),
          target: data.goal.target,
          reward: data.goal.reward || 50,
        }
      }

      for (const f of data.fields ?? []) {
        const pile = this.crops.find((c) => c.kind === f.kind)
        if (!pile) continue
        pile.max = f.max
        pile.regen = f.regen
        pile.count = Math.min(Math.max(0, f.count), pile.max)
        this.rebuildCropVisual(pile)
      }

      this.stageEl.textContent = String(this.stage)
      this.refreshPadVisibility()
      if (data.unlocked.length > 0 || this.money > 0) {
        this.setHint('Welcome back! Progress restored')
      }
    } catch {
      // corrupt save — start fresh
    } finally {
      this.loadingSave = false
    }
  }
}
