/**
 * Procedural ambient sound (Web Audio, no audio files):
 * - wind: filtered noise with slow gusts
 * - rope: low rumble and hum that follow how fast the cabins move
 * - birds by day, crickets at night
 * - station bell when a cabin arrives, a softer two-note tone when it leaves
 */
export interface AmbientParams {
  rope: number // 0..1.5, how fast the cabins are moving
  night: number // 0..1
  height: number // 0..1, camera altitude, for wind
  rain: number // 0..1
  snow: number // 0..1
  riding: boolean
}

class Ambient {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private windGain!: GainNode
  private windFilter!: BiquadFilterNode
  private rumbleGain!: GainNode
  private humGain!: GainNode
  private rainGain!: GainNode
  private noiseBuf!: AudioBuffer
  private hums: OscillatorNode[] = []
  private enabled = false

  get active() {
    return this.enabled
  }

  start(volume: number) {
    if (!this.ctx) this.build()
    this.enabled = true
    void this.ctx!.resume()
    this.master.gain.setTargetAtTime(volume, this.ctx!.currentTime, 0.2)
  }

  stop() {
    if (!this.ctx) return
    this.enabled = false
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1)
    window.setTimeout(() => {
      if (!this.enabled) void this.ctx?.suspend()
    }, 400)
  }

  setVolume(v: number) {
    if (this.ctx && this.enabled) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1)
  }

  private build() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const c = new AC()
    this.ctx = c
    this.master = c.createGain()
    this.master.gain.value = 0
    this.master.connect(c.destination)

    // two seconds of brownish noise, looped
    const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      data[i] = last * 3.5
    }
    this.noiseBuf = buffer
    const noise = () => {
      const src = c.createBufferSource()
      src.buffer = buffer
      src.loop = true
      src.start()
      return src
    }

    // wind with a slow gust LFO on the filter
    this.windFilter = c.createBiquadFilter()
    this.windFilter.type = 'lowpass'
    this.windFilter.frequency.value = 500
    this.windGain = c.createGain()
    this.windGain.gain.value = 0
    noise().connect(this.windFilter).connect(this.windGain).connect(this.master)
    const gust = c.createOscillator()
    gust.frequency.value = 0.11
    const gustDepth = c.createGain()
    gustDepth.gain.value = 260
    gust.connect(gustDepth).connect(this.windFilter.frequency)
    gust.start()

    // rain: hissy band of noise
    const rainHigh = c.createBiquadFilter()
    rainHigh.type = 'highpass'
    rainHigh.frequency.value = 900
    const rainLow = c.createBiquadFilter()
    rainLow.type = 'lowpass'
    rainLow.frequency.value = 7000
    this.rainGain = c.createGain()
    this.rainGain.gain.value = 0
    noise().connect(rainHigh).connect(rainLow).connect(this.rainGain).connect(this.master)

    // rope rumble
    const rumble = c.createBiquadFilter()
    rumble.type = 'lowpass'
    rumble.frequency.value = 140
    this.rumbleGain = c.createGain()
    this.rumbleGain.gain.value = 0
    noise().connect(rumble).connect(this.rumbleGain).connect(this.master)

    // rope hum
    const humFilter = c.createBiquadFilter()
    humFilter.type = 'lowpass'
    humFilter.frequency.value = 240
    this.humGain = c.createGain()
    this.humGain.gain.value = 0
    humFilter.connect(this.humGain).connect(this.master)
    for (const f of [52, 79]) {
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      o.connect(humFilter)
      o.start()
      this.hums.push(o)
    }
  }

  update(dt: number, p: AmbientParams) {
    const c = this.ctx
    if (!c || !this.enabled) return
    const t = c.currentTime
    const inCabin = p.riding ? 1 : 0

    const storm = Math.max(p.rain, p.snow * 0.6)
    this.windGain.gain.setTargetAtTime(0.1 + 0.1 * p.height - 0.05 * inCabin + 0.1 * storm, t, 0.4)
    this.rainGain.gain.setTargetAtTime(0.16 * p.rain * (inCabin ? 0.7 : 1), t, 0.5)
    this.windFilter.frequency.setTargetAtTime(p.riding ? 380 : 520 + 200 * p.height, t, 0.4)
    this.rumbleGain.gain.setTargetAtTime(0.35 * p.rope * (inCabin ? 1.4 : 0.6), t, 0.3)
    this.humGain.gain.setTargetAtTime(0.05 * p.rope * (inCabin ? 1.5 : 0.7), t, 0.3)
    this.hums[0].frequency.setTargetAtTime(48 + 22 * p.rope, t, 0.3)
    this.hums[1].frequency.setTargetAtTime(72 + 33 * p.rope, t, 0.3)

    if (storm > 0.2) return // wildlife keeps quiet in bad weather
    if (p.night > 0.6) {
      if (Math.random() < 3 * dt) this.cricket()
    } else if (p.night < 0.3) {
      if (Math.random() < 0.35 * dt) this.bird()
    }
  }

  private blip(freq: number, dur: number, vol: number, delay = 0, sweep = 1, type: OscillatorType = 'sine') {
    const c = this.ctx
    if (!c) return
    const t0 = c.currentTime + delay
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (sweep !== 1) osc.frequency.exponentialRampToValueAtTime(freq * sweep, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g).connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  private cricket() {
    const f = 4100 + Math.random() * 500
    for (let i = 0; i < 3; i++) this.blip(f, 0.045, 0.012, i * 0.07)
  }

  private bird() {
    const f = 2200 + Math.random() * 1200
    const n = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < n; i++) this.blip(f * (1 + i * 0.12), 0.13, 0.03, i * 0.17, 1.35)
  }

  /** Distant thunder: a low rumble that swells and fades. */
  thunder(delay: number) {
    const c = this.ctx
    if (!c || !this.enabled) return
    const t0 = c.currentTime + delay
    const src = c.createBufferSource()
    src.buffer = this.noiseBuf
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(220, t0)
    lp.frequency.exponentialRampToValueAtTime(70, t0 + 3)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(0.9, t0 + 0.25)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2)
    src.connect(lp).connect(g).connect(this.master)
    src.start(t0)
    src.stop(t0 + 3.3)
  }

  /** A firework bang: a low thump with a short crackle, a moment after the flash. */
  pop(delay: number) {
    const c = this.ctx
    if (!c || !this.enabled) return
    this.blip(95, 0.28, 0.16, delay, 0.45)
    const t0 = c.currentTime + delay
    const src = c.createBufferSource()
    src.buffer = this.noiseBuf
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1800
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(0.18, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7)
    src.connect(hp).connect(g).connect(this.master)
    src.start(t0)
    src.stop(t0 + 0.75)
  }

  chime(kind: 'arrive' | 'depart') {
    if (!this.enabled) return
    if (kind === 'arrive') {
      this.blip(880, 1.6, 0.12)
      this.blip(1318.5, 1.3, 0.08, 0.09)
    } else {
      this.blip(660, 0.6, 0.07)
      this.blip(520, 0.7, 0.06, 0.22)
    }
  }
}

export const audio = new Ambient()
