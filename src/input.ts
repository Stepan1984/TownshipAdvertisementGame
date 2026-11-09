export type Vec2 = { x: number; y: number }

export class Input {
  keys = new Set<string>()
  joy: Vec2 = { x: 0, y: 0 }
  private activeId: number | null = null
  /** Keys pressed since last consumed (no auto-repeat) — for one-shot actions. */
  private pressed = new Set<string>()
  private actionQueued = false

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code)
      if (!e.repeat) this.pressed.add(e.code)
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))

    const base = document.getElementById('joystick-base')!
    const knob = document.getElementById('joystick-knob')!
    const max = 36

    const setFromEvent = (clientX: number, clientY: number) => {
      const rect = base.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      let dx = clientX - cx
      let dy = clientY - cy
      const len = Math.hypot(dx, dy) || 1
      if (len > max) {
        dx = (dx / len) * max
        dy = (dy / len) * max
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
      this.joy.x = dx / max
      this.joy.y = dy / max
    }

    const clear = () => {
      this.activeId = null
      this.joy.x = 0
      this.joy.y = 0
      knob.style.transform = 'translate(-50%, -50%)'
    }

    base.addEventListener('pointerdown', (e) => {
      this.activeId = e.pointerId
      base.setPointerCapture(e.pointerId)
      setFromEvent(e.clientX, e.clientY)
    })
    base.addEventListener('pointermove', (e) => {
      if (this.activeId !== e.pointerId) return
      setFromEvent(e.clientX, e.clientY)
    })
    base.addEventListener('pointerup', clear)
    base.addEventListener('pointercancel', clear)

    // Alt-Tab / tab switch never delivers keyup: drop everything so the player doesn't walk on its own
    const releaseAll = () => {
      this.keys.clear()
      this.pressed.clear()
      clear()
    }
    window.addEventListener('blur', releaseAll)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) releaseAll()
    })

    // Touch DRIVE / EXIT button (cars can't be entered without a keyboard otherwise)
    const drive = document.getElementById('drive-btn')
    drive?.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.actionQueued = true
    })
  }

  /** True once per physical key press. */
  consumePress(code: string): boolean {
    const had = this.pressed.has(code)
    this.pressed.delete(code)
    return had
  }

  /** True once per DRIVE button tap. */
  consumeAction(): boolean {
    const had = this.actionQueued
    this.actionQueued = false
    return had
  }

  get move(): Vec2 {
    let x = this.joy.x
    let y = this.joy.y
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1
    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    return { x, y }
  }
}
