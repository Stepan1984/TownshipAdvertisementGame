/**
 * Tiny synthesized sound effects (WebAudio, no asset files).
 * The AudioContext is created on the first user gesture, as browsers require.
 */
const MUTE_KEY = 'townshipAdGame_mute'

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private lastCoin = 0
  muted = false

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1'
    } catch {
      // storage blocked — default to sound on
    }
    // Touch pointerdown is not a user activation (pointerup / touchend are), and iOS can suspend
    // the context later — so keep trying on every gesture while it isn't running.
    const unlock = () => {
      if (!this.ctx || this.ctx.state !== 'running') this.ensure()
    }
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) {
      window.addEventListener(ev, unlock, { passive: true })
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.ctx && this.ctx.state !== 'running') void this.ctx.resume()
    })
  }

  private ensure(): AudioContext | null {
    if (this.ctx) {
      // 'suspended', or iOS 'interrupted' after a call / backgrounding
      if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') void this.ctx.resume()
      return this.ctx
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    this.ctx = new Ctor()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.18
    this.master.connect(this.ctx.destination)
    return this.ctx
  }

  setMuted(m: boolean) {
    this.muted = m
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0')
    } catch {
      // ignore
    }
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 1) {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    const t = ctx.currentTime + start
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private ready(): boolean {
    return !this.muted && !!this.ctx && this.ctx.state === 'running'
  }

  /** Cash picked up — throttled so a stream of bills is one pleasant tick. */
  coin() {
    if (!this.ready()) return
    const now = this.ctx!.currentTime
    if (now - this.lastCoin < 0.09) return
    this.lastCoin = now
    this.tone(1320, 0, 0.08, 'square', 0.35)
    this.tone(1760, 0.04, 0.1, 'square', 0.3)
  }

  /** Unlock pad bought. */
  unlock() {
    if (!this.ready()) return
    ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.07, 0.22, 'triangle', 0.6))
  }

  /** Goal completed. */
  goal() {
    if (!this.ready()) return
    ;[784, 988, 1175, 1568].forEach((f, i) => this.tone(f, i * 0.09, 0.3, 'sine', 0.7))
  }
}
