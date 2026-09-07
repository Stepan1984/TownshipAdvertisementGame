export type Vec2 = { x: number; y: number }

export class Input {
  keys = new Set<string>()
  joy: Vec2 = { x: 0, y: 0 }
  private activeId: number | null = null

  constructor() {
    window.addEventListener('keydown', (e) => this.keys.add(e.code))
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
