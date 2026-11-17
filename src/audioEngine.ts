import { clamp, lerp, smooth, story, INTRO_SECONDS } from './story'
import { phases } from './layout'
import { hero } from './scene/cityLayout'

// Ambient soundscape, synthesised live with the Web Audio API: noise, oscillators and filters only, no recordings,
// so there is nothing to license. Layers:
//   city rumble + airy wind     (muffled from the bird's-eye view, opens up as the camera comes down)
//   passing cars                (tyre noise sweeping across the stereo field, with a soft EV whine)
//   birds by day / crickets by night   (follow the light and dark mode)
//   the hero car's own whine    (follows its speed)
//   charger servo, plug click, charger hum and the start / done chimes (follow the scroll story)

export type Engine = { attach: (ctx: AudioContext) => void; setMuted: (muted: boolean) => void }

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

function noise(ctx: AudioContext, kind: 'pink' | 'brown', seconds: number) {
  const n = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    } else {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    }
  }
  // blend the tail into the head so the loop has no seam
  const f = Math.floor(ctx.sampleRate * 0.05)
  for (let i = 0; i < f; i++) {
    const k = i / f
    d[n - f + i] = d[n - f + i] * (1 - k) + d[i] * k
  }
  return buf
}

export function createEngine(): Engine {
  let ctx: AudioContext
  let master: GainNode
  let muted = true
  let suspendTimer = 0
  let analyser: AnalyserNode | null = null

  // buses and parameters the update loop drives
  let pinkBuf: AudioBuffer
  let whiteBuf: AudioBuffer // flat-spectrum noise for the drums (pink has almost nothing up high)
  let cityLP: BiquadFilterNode
  let cityG: GainNode
  let windG: GainNode
  let windBP: BiquadFilterNode
  let cricketG: GainNode
  const cricketGates: GainNode[] = []
  let nextCricket = 0
  let chargeG: GainNode
  let humOsc: OscillatorNode
  let servoG: GainNode
  let servoOsc: OscillatorNode
  let carG: GainNode
  let carOsc: OscillatorNode
  let tyreG: GainNode
  let tyreBP: BiquadFilterNode
  let out: AudioNode // everything one-shot goes through here

  let nextPass = 0
  let nextBird = 0
  let prev = { b: 0, g: 0, rise: 0, a: 0, f: 0, hx: 0, hz: 0, t: 0 }
  let speed = 0

  const loop = (buf: AudioBuffer) => {
    const s = ctx.createBufferSource()
    s.buffer = buf
    s.loop = true
    s.start(0, Math.random() * buf.duration)
    return s
  }
  const gain = (v: number) => {
    const g = ctx.createGain()
    g.gain.value = v
    return g
  }
  const filter = (type: BiquadFilterType, f: number, q = 0.7) => {
    const b = ctx.createBiquadFilter()
    b.type = type
    b.frequency.value = f
    b.Q.value = q
    return b
  }
  const osc = (type: OscillatorType, f: number) => {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = f
    o.start()
    return o
  }
  const lfo = (f: number, depth: number, target: AudioParam) => {
    const o = osc('sine', f)
    const g = gain(depth)
    o.connect(g).connect(target)
  }
  // ---------- one-shots ----------

  function carPass(t: number, near: number, night: number) {
    const dir = Math.random() < 0.5 ? -1 : 1
    const dur = rnd(3.6, 6)
    const peak = rnd(0.05, 0.09) * (0.04 + 0.96 * near) * (1 - 0.3 * night)
    const src = loop(pinkBuf)
    const bp = filter('bandpass', 300, 0.9)
    const f0 = rnd(330, 520)
    bp.frequency.setValueAtTime(f0, t)
    bp.frequency.linearRampToValueAtTime(f0 * 1.6, t + dur * 0.48)
    bp.frequency.linearRampToValueAtTime(f0 * 0.8, t + dur)
    const g = gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + dur * 0.48)
    g.gain.linearRampToValueAtTime(0, t + dur)
    const pan = ctx.createStereoPanner()
    pan.pan.setValueAtTime(-0.85 * dir, t)
    pan.pan.linearRampToValueAtTime(0.85 * dir, t + dur)
    src.connect(bp).connect(g).connect(pan).connect(out)
    // electric whine
    const w = ctx.createOscillator()
    w.type = 'sine'
    const wf = rnd(380, 520)
    w.frequency.setValueAtTime(wf, t)
    w.frequency.linearRampToValueAtTime(wf * 1.35, t + dur * 0.48)
    w.frequency.linearRampToValueAtTime(wf * 0.85, t + dur)
    const wg = gain(0)
    wg.gain.setValueAtTime(0, t)
    wg.gain.linearRampToValueAtTime(peak * 0.1, t + dur * 0.48)
    wg.gain.linearRampToValueAtTime(0, t + dur)
    w.connect(wg).connect(pan)
    src.stop(t + dur + 0.1)
    w.start(t)
    w.stop(t + dur + 0.1)
    w.onended = () => [src, bp, g, pan, w, wg].forEach((n) => n.disconnect())
  }

  function chirp(t: number, f: number, dur: number, glide: number, level: number, pan: StereoPannerNode) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f, t)
    o.frequency.exponentialRampToValueAtTime(f * glide, t + dur)
    const o2 = ctx.createOscillator()
    o2.type = 'sine'
    o2.frequency.setValueAtTime(f * 2, t)
    o2.frequency.exponentialRampToValueAtTime(f * 2 * glide, t + dur)
    const g = gain(0.0001)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(level, t + dur * 0.18)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const g2 = gain(0.22)
    o.connect(g)
    o2.connect(g2).connect(g)
    g.connect(pan)
    o.start(t)
    o2.start(t)
    o.stop(t + dur + 0.02)
    o2.stop(t + dur + 0.02)
    o2.onended = () => [o, o2, g, g2].forEach((n) => n.disconnect())
  }

  function birdSong(t: number, level: number) {
    const pan = ctx.createStereoPanner()
    pan.pan.value = rnd(-0.75, 0.75)
    pan.connect(out)
    let at = t
    const base = rnd(2500, 4100)
    if (Math.random() < 0.6) {
      // "tweet tweet tweet"
      const n = 2 + Math.floor(Math.random() * 4)
      for (let i = 0; i < n; i++) {
        const d = rnd(0.07, 0.13)
        chirp(at, base * rnd(0.95, 1.08), d, i % 2 ? 0.72 : 1.38, level, pan)
        at += d + rnd(0.07, 0.16)
      }
    } else {
      // quick trill that warbles up and down
      const n = 9 + Math.floor(Math.random() * 8)
      for (let i = 0; i < n; i++) {
        const d = 0.036
        chirp(at, base * (1 + 0.18 * Math.sin(i * 0.9)), d, 1.12, level * 0.8, pan)
        at += d + 0.026
      }
    }
    setTimeout(() => pan.disconnect(), (at - t + 1) * 1000 + 600)
  }

  function click(t: number, strong: number) {
    // plug thunk: a short low knock plus a bright tick
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(170, t)
    o.frequency.exponentialRampToValueAtTime(58, t + 0.12)
    const g = gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.6 * strong, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
    o.connect(g).connect(out)
    const n = loop(pinkBuf)
    const hp = filter('highpass', 1800, 0.7)
    const ng = gain(0)
    ng.gain.setValueAtTime(0, t)
    ng.gain.linearRampToValueAtTime(0.34 * strong, t + 0.002)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.045)
    n.connect(hp).connect(ng).connect(out)
    o.start(t)
    o.stop(t + 0.2)
    n.stop(t + 0.1)
    o.onended = () => [o, g, n, hp, ng].forEach((x) => x.disconnect())
  }

  function chime(t: number, notes: number[], level: number) {
    notes.forEach((f, i) => {
      const at = t + i * 0.14
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = gain(0)
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(level, at + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0008, at + 0.9)
      o.connect(g).connect(out)
      o.start(at)
      o.stop(at + 1)
      o.onended = () => [o, g].forEach((x) => x.disconnect())
    })
  }

  // ---------- music ----------
  // An original, composed futuristic metal-hop beat at 145 BPM in half-time (nothing sampled, nothing borrowed). Key of A
  // minor with a few exotic notes over the E chord (F and G#). No synth melodies: a metal lead guitar and a heavy metal
  // rhythm guitar (strummed power chords, palm-muted chugs) built from plucked-string and amp models, an 808 bass that follows
  // the roots under a futuristic growl bass (detuned saws through a wobbling, sweeping resonant filter), and drums with
  // electronic metal hats and laser-zap accents. The rhythm guitar follows the melody: chugs on its rhythm, open power chords
  // that harmonise its long notes. Futuristic touches: ping-pong echoes, a flanger
  // sweeping across the guitars, zaps, sweeps and risers at the section changes.
  // Arrangement, so it builds up: four bars of just the kick, then hats join, then the snare and clap, and at bar 12 the
  // rest drops in (bass, rhythm guitar, lead). After that a 16-bar song loops: an 8-bar A section and an 8-bar B section.
  // Everything sits at MUSIC_VOLUME (5.5%) of full volume.
  const MUSIC_VOLUME = 0.055
  const BPM = 145
  const STEP = 60 / BPM / 4 // one 16th note
  const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
  // bass / guitar root of each of the 16 song bars (MIDI): A section Am G F E, Am G F E; B section Dm Am F G, Dm Am E E
  const PROG = [33, 31, 29, 28, 33, 31, 29, 28, 26, 33, 29, 31, 26, 33, 28, 28]
  // the melody: [16th step, MIDI note, length in 16ths] for each of the 16 bars.
  // A (bars 1-4): a question that climbs in leaps and hangs on the E chord's exotic G#; (5-8): the answer, up to a high A and
  // down a harmonic-minor run. B (9-16): the lift: higher, more rhythmic, a peak on D6, and a phrygian run down the E chord.
  const HOOK: [number, number, number][][] = [
    [[0, 69, 2], [3, 72, 1], [4, 76, 4], [10, 74, 2], [12, 76, 3], [15, 79, 1]],
    [[0, 79, 3], [3, 76, 1], [4, 74, 2], [6, 71, 2], [8, 74, 4], [13, 71, 1], [14, 69, 2]],
    [[0, 77, 3], [3, 76, 1], [4, 72, 4], [9, 69, 2], [11, 72, 2], [13, 77, 3]],
    [[0, 76, 2], [2, 77, 2], [4, 80, 4], [9, 77, 1], [10, 76, 2], [12, 74, 2], [14, 71, 2]],
    [[0, 69, 2], [2, 72, 2], [4, 76, 2], [6, 81, 5], [12, 79, 2], [14, 76, 2]],
    [[0, 79, 2], [2, 76, 1], [3, 74, 2], [5, 71, 3], [8, 74, 2], [10, 79, 4], [14, 76, 2]],
    [[0, 77, 3], [3, 76, 1], [4, 77, 2], [6, 81, 3], [9, 79, 1], [10, 77, 2], [12, 72, 4]],
    [[0, 76, 2], [2, 74, 1], [3, 72, 1], [4, 71, 2], [6, 68, 2], [8, 71, 2], [10, 76, 6]],
    [[0, 74, 2], [2, 77, 2], [4, 81, 4], [9, 77, 1], [10, 74, 2], [12, 77, 4]],
    [[0, 76, 2], [2, 81, 2], [4, 84, 4], [9, 81, 1], [10, 79, 2], [12, 76, 4]],
    [[0, 77, 2], [2, 81, 2], [4, 84, 3], [7, 81, 1], [8, 79, 2], [10, 77, 2], [12, 76, 2], [14, 72, 2]],
    [[0, 74, 2], [2, 79, 2], [4, 83, 4], [9, 79, 1], [10, 74, 2], [12, 79, 4]],
    [[0, 74, 2], [2, 77, 2], [4, 81, 2], [6, 84, 2], [8, 86, 4], [13, 84, 1], [14, 81, 2]],
    [[0, 81, 3], [3, 79, 1], [4, 76, 2], [6, 72, 2], [8, 76, 2], [10, 81, 6]],
    [[0, 80, 2], [2, 77, 2], [4, 76, 2], [6, 74, 2], [8, 72, 2], [10, 71, 2], [12, 68, 2], [14, 71, 2]],
    [[0, 76, 6], [8, 80, 2], [10, 81, 2], [12, 83, 4]],
  ]
  // growl bass patterns: [16th step, semitones above the bar's root, length in 16ths]; the B section adds extra movement
  const FB_A: [number, number, number][] = [[0, 0, 5], [7, 0, 2], [10, 7, 2], [12, 12, 2]]
  const FB_B: [number, number, number][] = [[0, 0, 4], [6, 0, 2], [9, 7, 2], [11, 12, 1], [14, 0, 2]]
  const FB_EXTRA: [number, number, number][] = [[3, 12, 1], [15, 7, 1]]
  // lowest note of a power chord on the same pitch as a melody note (between E2 and D#3), as the root the strum() expects
  const powerRoot = (midi: number) => 40 + ((((midi % 12) - (40 % 12)) % 12) + 12) % 12 - 12
  const KICK_A = [0, 7, 10]
  const KICK_B = [0, 7, 9, 14]
  let musicMix: GainNode
  let musicG: GainNode
  let keysBus: GainNode // chords and arps: ducked by the kick
  let drumBus: GainNode
  let bassIn: GainNode
  let fbBus: GainNode // the growl bass: ducked by the kick
  let leadBus: GainNode
  let flangeIn: GainNode
  let gtrIn: GainNode // the rhythm guitar amp: high gain into a scooped cabinet
  let soloIn: GainNode // the lead guitar amp: singing overdrive, more mids, more echo
  let vib: GainNode // shared vibrato (in cents) for the rhythm guitar
  let vibW: GainNode // wide vibrato for the lead guitar
  let lastLead = { midi: 0, end: 0 } // for sliding between connected notes
  let kickIn: GainNode
  let reverbIn: GainNode
  let delayIn: GainNode
  let stepAt = 0
  let stepN = 0

  // soft-clipper: adds harmonics so the low drums still come through small speakers
  function saturator(k: number) {
    const sh = ctx.createWaveShaper()
    const c = new Float32Array(1024)
    for (let i = 0; i < c.length; i++) c[i] = Math.tanh((i / 511.5 - 1) * k) / Math.tanh(k)
    sh.curve = c
    sh.oversample = '2x'
    return sh
  }

  function buildMusic() {
    musicG = gain(0)
    musicG.connect(master)
    musicMix = gain(0.6)
    musicMix.connect(musicG)
    if (import.meta.env.DEV) {
      const an = ctx.createAnalyser()
      musicMix.connect(an)
      Object.assign((window as unknown as { __sound: object }).__sound, { musicAnalyser: an, cricketGates, tap: (n: string) => ({ fb: fbBus, bass: bassIn, gtr: gtrIn, solo: soloIn })[n] })
    }
    keysBus = gain(1)
    keysBus.connect(musicMix)
    drumBus = gain(1)
    drumBus.connect(musicMix)
    kickIn = gain(1)
    kickIn.connect(saturator(2.2)).connect(drumBus)
    fbBus = gain(0.5)
    fbBus.connect(keysBus)
    bassIn = gain(1)
    bassIn.connect(saturator(3)).connect(musicMix)
    // reverb: a generated impulse response (decaying stereo noise)
    const len = Math.floor(ctx.sampleRate * 2.4)
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c)
      let lp = 0
      for (let i = 0; i < len; i++) {
        const x = i / len
        lp += ((Math.random() * 2 - 1) - lp) * (0.7 - 0.5 * x)
        d[i] = lp * Math.pow(1 - x, 2.8)
      }
    }
    const conv = ctx.createConvolver()
    conv.buffer = ir
    reverbIn = gain(1)
    reverbIn.connect(conv).connect(gain(0.7)).connect(musicMix)
    // ping-pong echo (dotted eighth): the repeats bounce left and right, a little darker each time
    const dT = (60 / BPM) * 0.75
    const dL = ctx.createDelay(1)
    const dR = ctx.createDelay(1)
    dL.delayTime.value = dT
    dR.delayTime.value = dT
    const pL = ctx.createStereoPanner()
    const pR = ctx.createStereoPanner()
    pL.pan.value = -0.8
    pR.pan.value = 0.8
    const lpL = filter('lowpass', 3800, 0.5)
    const lpR = filter('lowpass', 3800, 0.5)
    delayIn = gain(1)
    delayIn.connect(dL)
    dL.connect(lpL).connect(pL)
    lpL.connect(gain(0.42)).connect(dR)
    dR.connect(lpR).connect(pR)
    lpR.connect(gain(0.42)).connect(dL)
    for (const pn of [pL, pR]) {
      pn.connect(keysBus)
      pn.connect(reverbIn)
    }
    leadBus = gain(1)
    leadBus.connect(keysBus)
    // flanger for the guitars: a short delay swept slowly, fed back on itself, mixed back in
    flangeIn = gain(1)
    const fl = ctx.createDelay(0.05)
    fl.delayTime.value = 0.006
    lfo(0.16, 0.0045, fl.delayTime)
    flangeIn.connect(fl)
    fl.connect(gain(0.55)).connect(fl)
    fl.connect(gain(0.5)).connect(leadBus)
    vib = gain(7)
    const vo = osc('sine', 5.6)
    vo.connect(vib)
    vibW = gain(14)
    vo.connect(vibW)
    // metal guitar amp: high-gain distortion, then a cabinet with a scooped mid and a bright presence bump
    gtrIn = gain(2.8)
    const cabHP = filter('highpass', 85, 0.7)
    const scoop = filter('peaking', 650, 0.8)
    scoop.gain.value = -5
    const presence = filter('peaking', 2800, 0.9)
    presence.gain.value = 5
    const cabLP = filter('lowpass', 4300, 0.7)
    const amp = gain(0.2)
    const rTight = filter('highpass', 110, 0.7)
    gtrIn.connect(rTight).connect(saturator(9)).connect(cabHP).connect(scoop).connect(presence).connect(cabLP).connect(saturator(2)).connect(amp).connect(leadBus)
    const gs = gain(0.12)
    amp.connect(gs).connect(reverbIn)
    const gd = gain(0.1)
    amp.connect(gd).connect(delayIn)
    amp.connect(gain(0.4)).connect(flangeIn)
    // metal lead amp: a tight boost (cuts the flab before the distortion), two stages of high-gain distortion, then a cabinet
    // with the mids pushed so it sings, a touch of top and a lot of echo
    soloIn = gain(1)
    const tight = filter('highpass', 380, 0.7)
    const sHP = filter('highpass', 160, 0.7)
    const sMid = filter('peaking', 1200, 0.9)
    sMid.gain.value = 4
    const sTop = filter('peaking', 3000, 1)
    sTop.gain.value = 2
    const sLP = filter('lowpass', 3800, 0.8)
    const solo = gain(0.2)
    soloIn.connect(tight).connect(saturator(8)).connect(sHP).connect(sMid).connect(sTop).connect(sLP).connect(saturator(2)).connect(solo).connect(leadBus)
    solo.connect(gain(0.24)).connect(reverbIn)
    solo.connect(gain(0.38)).connect(delayIn)
    solo.connect(gain(0.45)).connect(flangeIn)
    // pre-render the plucked strings for the hook's notes so nothing has to be computed mid-song
    for (const r of new Set(PROG)) for (const m of [r + 12, r + 19, r + 24]) pluckBuffer(m)
    for (let r = 28; r <= 39; r++) for (const m of [r + 12, r + 19, r + 24]) pluckBuffer(m) // roots for the harmonised power chords
    stepAt = ctx.currentTime + 0.6
    stepN = 0
  }

  // chords duck briefly on every kick (a gentle sidechain pump)
  function duck(t: number) {
    const p = keysBus.gain
    p.cancelScheduledValues(t)
    p.setValueAtTime(0.6, t)
    p.linearRampToValueAtTime(1, t + 0.22)
    const q = leadBus.gain
    q.cancelScheduledValues(t)
    q.setValueAtTime(0.82, t)
    q.linearRampToValueAtTime(1, t + 0.16)
  }

  function noiseHit(t: number, type: BiquadFilterType, f: number, q: number, peak: number, len: number, to: AudioNode) {
    const src = loop(whiteBuf)
    const fl = filter(type, f, q)
    const g = gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.0015)
    g.gain.exponentialRampToValueAtTime(0.0008, t + len)
    src.connect(fl).connect(g).connect(to)
    src.stop(t + len + 0.03)
    src.onended = () => [src, fl, g].forEach((n) => n.disconnect())
  }

  // kick: a fast pitch drop for the body plus a short click so it is heard on any speaker
  function kick(t: number, vel: number) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(230, t)
    o.frequency.exponentialRampToValueAtTime(52, t + 0.07)
    const g = gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(1.0 * vel, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    o.connect(g).connect(kickIn)
    o.start(t)
    o.stop(t + 0.33)
    o.onended = () => [o, g].forEach((n) => n.disconnect())
    noiseHit(t, 'bandpass', 3000, 0.8, 0.3 * vel, 0.014, drumBus)
    const z = ctx.createOscillator() // a tiny digital zap on the attack
    z.type = 'triangle'
    z.frequency.setValueAtTime(3200, t)
    z.frequency.exponentialRampToValueAtTime(380, t + 0.014)
    const zg = gain(0)
    zg.gain.setValueAtTime(0, t)
    zg.gain.linearRampToValueAtTime(0.16 * vel, t + 0.001)
    zg.gain.exponentialRampToValueAtTime(0.001, t + 0.02)
    z.connect(zg).connect(drumBus)
    z.start(t)
    z.stop(t + 0.03)
    z.onended = () => [z, zg].forEach((n) => n.disconnect())
    duck(t)
  }

  // clap: a few quick noise bursts and a short tail, with a little snap on top
  function clap(t: number, vel: number) {
    const bp = filter('bandpass', 1900, 0.9)
    const g = gain(0)
    const src = loop(whiteBuf)
    for (const off of [0, 0.01, 0.021]) {
      g.gain.setValueAtTime(0.0001, t + off)
      g.gain.linearRampToValueAtTime(0.75 * vel, t + off + 0.002)
      g.gain.exponentialRampToValueAtTime(0.05, t + off + 0.009)
    }
    g.gain.linearRampToValueAtTime(0.6 * vel, t + 0.025)
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.2)
    src.connect(bp).connect(g)
    g.connect(drumBus)
    g.connect(reverbIn)
    noiseHit(t, 'highpass', 5500, 0.7, 0.25 * vel, 0.06, drumBus)
    src.stop(t + 0.23)
    src.onended = () => [src, bp, g].forEach((n) => n.disconnect())
  }

  function hat(t: number, vel: number, open = false) {
    const len = open ? 0.22 : 0.05
    const pan = ctx.createStereoPanner()
    pan.pan.value = rnd(-0.3, 0.3)
    pan.connect(drumBus)
    noiseHit(t, 'highpass', rnd(6200, 8400), 0.7, 0.3 * vel, len, pan)
    techHat(t, vel, len)
    setTimeout(() => pan.disconnect(), (len + 0.4 + Math.max(0, t - ctx.currentTime)) * 1000)
  }

  // snare: a tonal body that drops in pitch, a snappy noise burst and a short tail into the reverb
  function snare(t: number, vel: number) {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(230, t)
    o.frequency.exponentialRampToValueAtTime(165, t + 0.08)
    const g = gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.55 * vel, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.15)
    o.connect(g).connect(drumBus)
    o.start(t)
    o.stop(t + 0.18)
    o.onended = () => [o, g].forEach((n) => n.disconnect())
    const z = ctx.createOscillator() // electronic crack on top of the snare
    z.type = 'sine'
    z.frequency.setValueAtTime(1700, t)
    z.frequency.exponentialRampToValueAtTime(210, t + 0.07)
    const zg = gain(0)
    zg.gain.setValueAtTime(0, t)
    zg.gain.linearRampToValueAtTime(0.28 * vel, t + 0.002)
    zg.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    z.connect(zg).connect(drumBus)
    z.start(t)
    z.stop(t + 0.12)
    z.onended = () => [z, zg].forEach((n) => n.disconnect())
    noiseHit(t, 'bandpass', 2600, 0.7, 0.75 * vel, 0.19, drumBus)
    noiseHit(t, 'highpass', 6000, 0.7, 0.25 * vel, 0.1, drumBus)
    noiseHit(t, 'bandpass', 2600, 0.7, 0.2 * vel, 0.3, reverbIn)
  }

  // 808-style bass: a short pitch glide into a sine that is saturated for body
  function bass(t: number, midi: number, dur: number, vel = 1, from = 0) {
    const f = mtof(midi + 12)
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(from ? mtof(from + 12) : f * 1.6, t)
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05)
    const g = gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.55 * vel, t + 0.006)
    g.gain.setValueAtTime(0.55 * vel, t + dur * 0.5)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g).connect(bassIn)
    o.start(t)
    o.stop(t + dur + 0.05)
    o.onended = () => [o, g].forEach((n) => n.disconnect())
  }

  // Karplus-Strong plucked string, rendered once per note into a buffer: a burst of noise (with a pick-position comb)
  // circulating in a delay line that is low-passed a little on every pass, so it rings and mellows like a real string.
  const strings = new Map<number, { buf: AudioBuffer; n: number }>()
  function pluckBuffer(midi: number) {
    const hit = strings.get(midi)
    if (hit) return hit
    const sr = ctx.sampleRate
    const n = Math.max(4, Math.round(sr / mtof(midi)))
    const len = Math.floor(sr * 2.4)
    const buf = ctx.createBuffer(1, len, sr)
    const d = buf.getChannelData(0)
    const line = new Float32Array(n)
    let y = 0
    for (let i = 0; i < n; i++) {
      y += (Math.random() * 2 - 1 - y) * 0.7 // a slightly soft pick
      line[i] = y
    }
    const pick = Math.max(1, Math.floor(n * 0.17))
    const ex = line.map((v, i) => v - 0.7 * line[(i + pick) % n])
    line.set(ex)
    let idx = 0
    let peak = 0
    for (let i = 0; i < len; i++) {
      const a = line[idx]
      line[idx] = 0.9992 * 0.5 * (a + line[(idx + 1) % n])
      d[i] = a
      idx = (idx + 1) % n
      peak = Math.max(peak, Math.abs(a))
    }
    for (let i = 0; i < len; i++) d[i] /= peak || 1
    const r = { buf, n }
    strings.set(midi, r)
    return r
  }

  // one guitar string through the amp. `mute` = palm-muted chug: cut short, no pitch scoop, no vibrato
  function guitar(t: number, midi: number, dur: number, vel: number, mute = false, to: AudioNode = gtrIn) {
    const { buf, n } = pluckBuffer(midi)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = (mtof(midi) * (n + 0.5)) / ctx.sampleRate // exact pitch: the whole-number delay line plus the half sample the averaging adds
    if (!mute) {
      src.detune.setValueAtTime(-35, t)
      src.detune.linearRampToValueAtTime(0, t + 0.03)
    }
    const vibrato = !mute && dur > 0.3
    if (vibrato) vib.connect(src.detune)
    const g = gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vel, t + 0.002)
    g.gain.setValueAtTime(vel, t + dur)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + (mute ? 0.025 : 0.1))
    if (mute) {
      const dark = filter('lowpass', 1800, 0.7) // palm-muted: the highs are damped
      src.connect(dark).connect(g)
      src.onended = () => dark.disconnect()
    } else src.connect(g)
    g.connect(to)
    src.start(t)
    src.stop(t + dur + 0.15)
    const done = src.onended
    src.onended = (e) => {
      if (vibrato) vib.disconnect(src.detune)
      ;[src, g].forEach((x) => x.disconnect())
      if (done) done.call(src, e)
    }
  }

  // power chord (root, fifth, octave) strummed in a few milliseconds, down or up
  function strum(t: number, root: number, dur: number, vel: number, mute = false, down = true) {
    const notes = [root + 12, root + 19, root + 24]
    if (!down) notes.reverse()
    notes.forEach((m, i) => guitar(t + i * 0.009, m, dur, vel * (mute ? 0.9 : 1), mute))
  }

  // The metal lead: one saw tone with a triangle an octave below for weight, into the lead amp. Each note bends up a little
  // into pitch on the pick, connected notes slide into each other, and held notes get a vibrato that starts late and widens.
  function metalLead(t: number, midi: number, dur: number, vel: number, main = true) {
    const f = mtof(midi)
    const legato = main && lastLead.midi !== 0 && lastLead.midi !== midi && t - lastLead.end < 0.09
    const from = legato ? (lastLead.midi - midi) * 100 : -35
    const g = gain(0)
    const peak = 0.5 * vel
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.006)
    g.gain.setValueAtTime(peak, t + dur)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.1)
    const vg = gain(0) // vibrato depth for this note: none at first, then it widens
    vg.gain.setValueAtTime(0, t + 0.16)
    vg.gain.linearRampToValueAtTime(1, t + 0.42)
    vibW.connect(vg)
    const os = (
      [
        ['sawtooth', f, 1],
        ['triangle', f / 2, 0.45],
      ] as const
    ).map(([type, fr, v]) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = fr
      o.detune.setValueAtTime(from, t)
      o.detune.linearRampToValueAtTime(0, t + (legato ? 0.045 : 0.06))
      vg.connect(o.detune)
      const og = gain(v)
      o.connect(og).connect(g)
      o.start(t)
      o.stop(t + dur + 0.15)
      o.onended = () => og.disconnect()
      return o
    })
    g.connect(soloIn)
    noiseHit(t, 'bandpass', 3200, 1, 0.1 * vel, 0.012, soloIn) // the pick
    if (main) lastLead = { midi, end: t + dur }
    os[0].onended = () => {
      vibW.disconnect(vg)
      ;[...os, vg, g].forEach((n) => n.disconnect())
    }
  }

  // sci-fi laser zap: a sine sweeping fast from high to low, through the echo and reverb
  function zap(t: number, vel: number) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(4200, t)
    o.frequency.exponentialRampToValueAtTime(160, t + 0.2)
    const g = gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.3 * vel, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
    const pan = ctx.createStereoPanner()
    pan.pan.value = rnd(-0.6, 0.6)
    o.connect(g).connect(pan)
    pan.connect(drumBus)
    const rv = gain(0.5)
    const dl = gain(0.6)
    pan.connect(rv).connect(reverbIn)
    pan.connect(dl).connect(delayIn)
    o.start(t)
    o.stop(t + 0.26)
    o.onended = () => [o, g, pan, rv, dl].forEach((n) => n.disconnect())
  }

  // downlifter: noise sweeping down from the top, for the changes between sections
  function sweepDown(t: number, dur: number) {
    const src = loop(whiteBuf)
    const bp = filter('bandpass', 9000, 2)
    bp.frequency.setValueAtTime(9000, t)
    bp.frequency.exponentialRampToValueAtTime(250, t + dur)
    const g = gain(0)
    g.gain.setValueAtTime(0.22, t)
    g.gain.linearRampToValueAtTime(0, t + dur)
    src.connect(bp).connect(g)
    g.connect(drumBus)
    g.connect(reverbIn)
    src.stop(t + dur + 0.05)
    src.onended = () => [src, bp, g].forEach((n) => n.disconnect())
  }

  // futuristic growl bass: two detuned saws and a square an octave down through a resonant low-pass that sweeps open on
  // every note and wobbles in time (an eighth note), then distortion. It slides in from the previous note when asked.
  function futureBass(t: number, midi: number, dur: number, vel: number, from = 0) {
    const f = mtof(midi)
    const lp = filter('lowpass', 300, 6)
    lp.frequency.setValueAtTime(260, t)
    lp.frequency.exponentialRampToValueAtTime(2300, t + 0.07)
    lp.frequency.exponentialRampToValueAtTime(520, t + Math.max(0.12, dur))
    const wob = ctx.createOscillator() // tempo-synced wobble on the filter
    wob.type = 'sine'
    wob.frequency.value = (BPM / 60) * 2
    const wg = gain(700)
    wob.connect(wg).connect(lp.frequency)
    const g = gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.5 * vel, t + 0.004)
    g.gain.setValueAtTime(0.5 * vel, t + dur)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.06)
    const os = (
      [
        ['sawtooth', 1, -13, 1],
        ['sawtooth', 1, 13, 1],
        ['square', 0.5, 0, 0.6],
      ] as const
    ).map(([type, mul, det, v]) => {
      const o = ctx.createOscillator()
      o.type = type
      o.detune.value = det
      if (from) {
        o.frequency.setValueAtTime(mtof(from) * mul, t)
        o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.05)
      } else o.frequency.value = f * mul
      const og = gain(v)
      o.connect(og).connect(lp)
      o.start(t)
      o.stop(t + dur + 0.1)
      o.onended = () => og.disconnect()
      return o
    })
    wob.start(t)
    wob.stop(t + dur + 0.1)
    lp.connect(saturator(3)).connect(g).connect(fbBus)
    os[0].onended = () => {
      ;[...os, wob, wg, lp, g].forEach((n) => n.disconnect())
    }
  }

  // electronic hat: a cluster of six square waves through a high-pass, the classic metallic drum-machine tick
  function techHat(t: number, vel: number, len: number) {
    const hp = filter('highpass', 7200, 0.7)
    const bp = filter('bandpass', 10500, 0.8)
    const g = gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.045 * vel, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0008, t + len)
    const pan = ctx.createStereoPanner()
    pan.pan.value = rnd(-0.3, 0.3)
    hp.connect(bp).connect(g).connect(pan).connect(drumBus)
    const os = [205.3, 304.4, 369.6, 522.7, 540, 800].map((fr) => {
      const o = ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = fr
      o.connect(hp)
      o.start(t)
      o.stop(t + len + 0.03)
      return o
    })
    os[0].onended = () => [...os, hp, bp, g, pan].forEach((n) => n.disconnect())
  }

  function crash(t: number, vel: number) {
    noiseHit(t, 'highpass', 4800, 0.6, 0.32 * vel, 1.1, drumBus)
    noiseHit(t, 'bandpass', 9000, 0.7, 0.18 * vel, 0.7, reverbIn)
  }

  // riser into the drop: filtered noise sweeping up
  function riser(t: number, dur: number) {
    const src = loop(whiteBuf)
    const bp = filter('bandpass', 400, 1.5)
    bp.frequency.setValueAtTime(400, t)
    bp.frequency.exponentialRampToValueAtTime(7000, t + dur)
    const g = gain(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.2, t + dur)
    g.gain.linearRampToValueAtTime(0, t + dur + 0.04)
    src.connect(bp).connect(g)
    g.connect(drumBus)
    g.connect(reverbIn)
    src.stop(t + dur + 0.1)
    src.onended = () => [src, bp, g].forEach((n) => n.disconnect())
  }

  function playStep(at: number, n: number) {
    const bar = Math.floor(n / 16)
    const s = n % 16
    const when = (x: number) => Math.max(x, ctx.currentTime + 0.005)
    const odd = bar % 2 === 1
    // it builds: kick only (bars 0-3), hats (4-7: first plain 8ths, then busy), snare and clap (8-11), then the rest drops in
    const HATS = 4
    const HATS_BUSY = 6
    const SNARE = 8
    const DROP = 12
    const hatsOn = bar >= HATS
    const snareOn = bar >= SNARE
    const full = bar >= DROP
    const sb = bar - DROP
    const b16 = full ? sb % 16 : 0
    const loopN = full ? Math.floor(sb / 16) : 0
    const root = PROG[b16]

    // transitions: a zap as each new layer comes in, a riser and a snare roll into the drop
    if (s === 0 && (bar === HATS || bar === SNARE)) zap(when(at), 0.6)
    if (s === 0 && bar === DROP - 1) riser(when(at), STEP * 16)
    if (full && s === 0 && b16 === 0) {
      crash(when(at), loopN === 0 ? 1 : 0.6)
      if (loopN === 0) sweepDown(when(at), STEP * 12)
    }
    if (full && s === 0 && b16 === 7) riser(when(at), STEP * 16)
    if (full && s === 0 && b16 === 8) {
      crash(when(at), 0.55)
      zap(when(at), 0.7)
    }
    if (full && s === 0 && b16 === 15) riser(when(at), STEP * 16)

    // kick: from the very first bar
    const kicks = odd ? KICK_B : KICK_A
    if (kicks.includes(s)) {
      const fifth = full && ((odd && s === 9) || (!odd && s === 10))
      kick(when(at), s === 14 ? 0.7 : s === 0 ? 1 : 0.85)
      if (full) bass(when(at), root + (fifth ? 7 : 0), s === 7 ? 0.28 : s === 14 ? 0.2 : 0.42, s === 0 ? 1 : 0.85, fifth ? root : 0)
    }

    // hats
    if (hatsOn) {
      const busy = bar >= HATS_BUSY
      if (s % 2 === 0) hat(when(at), s % 4 === 0 ? 0.95 : 0.7)
      else if (busy && Math.random() < 0.7) hat(when(at), 0.4)
      if (busy) {
        if (!odd && s === 6) hat(when(at), 0.6, true)
        if (!odd && s === 11) hat(when(at + STEP / 2), 0.45)
        if (!odd && s === 13) hat(when(at + STEP / 2), 0.4)
        if (odd && s === 10) hat(when(at), 0.55, true)
        if (odd && s === 14) hat(when(at + STEP / 2), 0.55)
        if (odd && s === 15) {
          hat(when(at + STEP / 3), 0.55)
          hat(when(at + (2 * STEP) / 3), 0.65)
        }
      }
    }

    // snare and clap together on the third beat, ghost snares around it, a snare roll into the drop and into every loop
    if (snareOn) {
      if (s === 8) {
        snare(when(at), 1)
        clap(when(at), 0.75)
      }
      const roll = (bar === DROP - 1 || (full && b16 === 15)) && s >= 12
      if (roll) {
        snare(when(at), 0.35 + 0.2 * (s - 12))
        if (s === 15) clap(when(at), 0.9)
      } else {
        if (odd && s === 15) snare(when(at), 0.3)
        if (!odd && s === 11) snare(when(at), 0.2)
      }
    }

    if (!full) return

    // metal rhythm guitar, following the melody: an open power chord on the root at the top of the bar, palm-muted chugs on the
    // melody's rhythm, open power chords on the same pitch as the melody's long notes, and in the B section driving eighths
    const CHUG = 0.1 // seconds a palm-muted chug rings
    const line = HOOK[b16]
    const held: [number, number][] = [[0, 5]] // steps already covered by an open chord
    if (s === 0) strum(when(at), root, STEP * 5.2, 1)
    for (const [st, midi, len] of line) {
      if (len >= 4 && st > 0) held.push([st, st + len * 0.9])
      if (st !== s || s === 0) continue
      if (len >= 4) strum(when(at), powerRoot(midi), len * STEP * 0.9, 0.95)
      else strum(when(at), root, CHUG, st % 2 ? 0.8 : 0.9, true, st % 2 === 0)
    }
    if (b16 >= 8 && s > 0 && s % 2 === 0 && !line.some((x) => x[0] === s) && !held.some(([a, b]) => s >= a && s < b)) {
      strum(when(at), root, CHUG, 0.7, true, s % 4 === 0)
    }
    if (b16 === 15 && s >= 12) strum(when(at), root, CHUG, 0.7 + 0.1 * (s - 12), true, s % 2 === 0)

    // futuristic growl bass, an octave and a half above the 808
    const fb = [...(odd ? FB_B : FB_A), ...(b16 >= 8 ? FB_EXTRA : [])]
    const prevFb = fb.filter(([st]) => st < s).pop()
    for (const [st, semi, len] of fb) {
      if (st !== s) continue
      const slideIn = prevFb && prevFb[1] !== semi && s - prevFb[0] <= prevFb[2] + 1 ? root + 24 + prevFb[1] : 0
      futureBass(when(at), root + 24 + semi, len * STEP * 0.92, st === 0 ? 1 : 0.85, slideIn)
    }

    // the melody on the metal lead (doubled an octave up, softly, from the second time round)
    for (const [st, midi, len] of line) {
      if (st !== s) continue
      metalLead(when(at), midi, len * STEP * 0.97, st === 0 ? 1 : 0.92)
      if (loopN % 2 === 1) metalLead(when(at), midi + 12, len * STEP * 0.8, 0.25, false)
    }
  }

  function music(t: number) {
    if (stepAt < t - 1) {
      stepAt = t + 0.1 // fell far behind (tab was throttled): restart the bar
      stepN = Math.floor(stepN / 16) * 16
    }
    while (stepAt < t + 0.25) {
      playStep(stepAt, stepN)
      stepAt += STEP
      stepN++
    }
    musicG.gain.setTargetAtTime(MUSIC_VOLUME * (story.loaderDone ? 1 : 0), t, 2)
  }

  // ---------- the continuous layers ----------

  function build() {
    master = gain(0)
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.ratio.value = 4
    master.connect(comp).connect(ctx.destination)
    if (import.meta.env.DEV) {
      analyser = ctx.createAnalyser()
      comp.connect(analyser)
      ;(window as unknown as { __sound: unknown }).__sound = { ctx, analyser }
    }
    out = master

    const brown = noise(ctx, 'brown', 6)
    pinkBuf = noise(ctx, 'pink', 5)
    whiteBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const wd = whiteBuf.getChannelData(0)
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1

    // city: distant traffic rumble, plus a faint mid-range "air" that breathes
    cityLP = filter('lowpass', 400, 0.6)
    cityG = gain(0)
    loop(brown).connect(cityLP).connect(cityG).connect(master)
    const air = filter('bandpass', 1100, 0.5)
    const airG = gain(0.04)
    loop(pinkBuf).connect(air).connect(airG).connect(cityG)
    lfo(0.11, 0.025, airG.gain)

    // wind
    windBP = filter('bandpass', 520, 0.8)
    windG = gain(0)
    loop(pinkBuf).connect(windBP).connect(windG).connect(master)
    lfo(0.06, 220, windBP.frequency)
    lfo(0.13, 0.05, windG.gain)

    // crickets (night): two insects, each a fast pulse train gated by a slower chirp rhythm.
    // Each has a gate that stays shut; update() opens it now and then for a short phrase.
    cricketG = gain(0)
    cricketG.connect(master)
    for (const [f, fast, slow] of [
      [4150, 23, 2.7],
      [4700, 27, 3.3],
    ] as const) {
      const gate = gain(0)
      cricketGates.push(gate)
      gate.connect(cricketG)
      const car = osc('sine', f)
      const a1 = gain(0.5)
      const a2 = gain(0.5)
      for (const [rate, target, order] of [
        [fast, a1.gain, 1],
        [slow, a2.gain, 2],
      ] as const) {
        const m = osc('square', rate)
        const sm = filter('lowpass', order === 1 ? 90 : 14, 0.5)
        const mg = gain(0.5)
        m.connect(sm).connect(mg).connect(target)
      }
      car.connect(a1).connect(a2).connect(gate)
    }

    // charger hum + fan
    chargeG = gain(0)
    chargeG.connect(master)
    humOsc = osc('sawtooth', 100)
    humOsc.connect(filter('lowpass', 420, 0.7)).connect(gain(0.07)).connect(chargeG)
    osc('sine', 200).connect(gain(0.022)).connect(chargeG)
    osc('sine', 50).connect(gain(0.03)).connect(chargeG)
    loop(pinkBuf).connect(filter('bandpass', 1700, 0.6)).connect(gain(0.035)).connect(chargeG)

    // servo whirr while the charger rises / its arm moves
    servoG = gain(0)
    servoG.connect(master)
    servoOsc = osc('sawtooth', 170)
    servoOsc.connect(filter('lowpass', 700, 1.2)).connect(servoG)

    // the hero car: electric whine and tyre noise follow its speed
    carG = gain(0)
    carG.connect(master)
    carOsc = osc('triangle', 150)
    carOsc.connect(filter('lowpass', 1400, 0.7)).connect(carG)
    tyreG = gain(0)
    tyreBP = filter('bandpass', 650, 0.8)
    loop(pinkBuf).connect(tyreBP).connect(tyreG).connect(master)

    buildMusic()
  }

  function update() {
    if (ctx.state !== 'running') return
    const t = ctx.currentTime
    const dt = Math.max(0.01, t - prev.t)
    const night = story.night
    const introP = story.introDone ? 1 : clamp(story.introT / INTRO_SECONDS)
    const close = smooth(0, 0.85, introP) // 0 from the bird's-eye view, 1 at street level
    // how near the camera is to the action: everything but the city bed is nearly silent from the bird's-eye view
    // and grows as the camera comes down to the car
    const near = Math.pow(smooth(0.12, 0.95, introP), 1.3)
    const ph = phases(story.smooth)
    const rise = smooth(0.03, 0.13, story.smooth)
    const k = 0.35

    master.gain.setTargetAtTime(muted ? 0 : 0.33 * (story.loaderDone ? 1 : 0) * (story.visible ? 1 : 0.4), t, muted ? 0.08 : 0.9)

    cityLP.frequency.setTargetAtTime(lerp(380, 1500, close), t, k)
    cityG.gain.setTargetAtTime((0.1 + 0.04 * close) * (1 - 0.35 * night), t, k)
    windG.gain.setTargetAtTime((0.1 + 0.09 * (1 - close) + 0.05 * night) * 0.2, t, k)
    cricketG.gain.setTargetAtTime(0.06 * smooth(0.3, 0.9, night) * (0.04 + 0.96 * near), t, 1)

    // hero car speed from how far it moved since the last tick
    const inst = Math.hypot(hero.x - prev.hx, hero.z - prev.hz) / dt
    if (inst < 30) speed += (inst - speed) * 0.35
    prev.hx = hero.x
    prev.hz = hero.z
    const sp = clamp(speed / 9)
    carOsc.frequency.setTargetAtTime(110 + speed * 22, t, 0.12)
    const heroNear = 0.03 + 0.97 * near
    carG.gain.setTargetAtTime(0.06 * sp * heroNear, t, 0.15)
    tyreBP.frequency.setTargetAtTime(420 + speed * 45, t, 0.15)
    tyreG.gain.setTargetAtTime(0.16 * sp * sp * heroNear, t, 0.15)

    // charging hum, servo
    chargeG.gain.setTargetAtTime(ph.g * 0.9, t, 0.5)
    humOsc.frequency.setTargetAtTime(96 + 10 * smooth(0.38, 0.58, story.smooth), t, 0.5)
    const motion = (Math.abs(rise - prev.rise) + Math.abs(ph.a - prev.a) + Math.abs(ph.f - prev.f)) / dt
    servoG.gain.setTargetAtTime(0.15 * clamp(motion / 1.4), t, 0.08)
    servoOsc.frequency.setTargetAtTime(150 + 70 * clamp(motion / 1.4), t, 0.1)

    // one-shots on the story beats
    if (!muted) {
      if ((prev.b < 0.5) !== (ph.b < 0.5)) click(t + 0.01, ph.b >= 0.5 ? 1 : 0.7)
      if (prev.g < 0.5 && ph.g >= 0.5) chime(t + 0.05, [784, 1175], 0.1)
      if (prev.g >= 0.5 && ph.g < 0.5) chime(t + 0.05, [784, 988, 1319], 0.1)
    }
    prev.b = ph.b
    prev.g = ph.g
    prev.a = ph.a
    prev.f = ph.f
    prev.rise = rise
    prev.t = t

    if (muted) return

    // passing cars
    if (nextPass < t) {
      if (story.visible) carPass(t + 0.05, near, night)
      nextPass = t + rnd(2.2, 5.5) * (1 + 0.8 * night) / (0.65 + 0.7 * close)
    }
    // birds in the daytime
    if (nextBird < t) {
      const day = 1 - smooth(0.2, 0.75, night)
      if (day > 0.05 && story.visible && Math.random() < day) birdSong(t + 0.05, 0.055 * day * (0.04 + 0.96 * near))
      nextBird = t + rnd(1.6, 6)
    }
    // crickets: one short phrase, then a pause of 5 to 10 seconds
    if (nextCricket < t) {
      const dur = rnd(1.6, 3.2)
      if (smooth(0.3, 0.9, night) > 0.3 && story.visible && cricketGates.length) {
        const first = Math.floor(Math.random() * cricketGates.length)
        const open = (p: AudioParam, at: number, len: number) => {
          p.cancelScheduledValues(at)
          p.setTargetAtTime(1, at, 0.25)
          p.setTargetAtTime(0, at + len, 0.35)
        }
        open(cricketGates[first].gain, t, dur)
        if (Math.random() < 0.3) open(cricketGates[1 - first].gain, t + 0.7, dur - 0.4)
      }
      nextCricket = t + dur + rnd(5, 10)
    }
    music(t)
  }

  return {
    attach(c) {
      ctx = c
      build()
      nextPass = ctx.currentTime + 1.5
      nextBird = ctx.currentTime + 1
      prev.t = ctx.currentTime
      window.setInterval(update, 60)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) void ctx.suspend()
        else if (!muted) void ctx.resume()
      })
    },
    setMuted(m) {
      muted = m
      if (!ctx) return
      clearTimeout(suspendTimer)
      if (m) {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
        // nothing to hear, so stop the audio clock after the fade-out
        suspendTimer = window.setTimeout(() => {
          if (muted) void ctx.suspend()
        }, 700)
      } else if (!document.hidden) {
        void ctx.resume()
      }
    },
  }
}
