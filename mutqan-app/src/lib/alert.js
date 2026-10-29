// Sounds without audio files: synthesized tones the owner can pick from, with volume/repeat/vibration controls.
let ctx = null
const unlock = () => {
  try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume() } catch { /* no audio */ }
}
if (typeof window !== 'undefined') ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }))

// [freq, startSec, durSec, wave]
export const TONES = {
  chime: { label: 'جرس هادئ', notes: [[784, 0, 0.12], [988, 0.12, 0.18]] },
  bell: { label: 'جرس مزدوج', notes: [[880, 0, 0.14], [1175, 0.14, 0.18]] },
  pop: { label: 'نقرة خفيفة', notes: [[1320, 0, 0.07], [1760, 0.07, 0.09]] },
  ding: { label: 'دِنغ', notes: [[1046, 0, 0.35]] },
  alarm: { label: 'إنذار', notes: [[740, 0, 0.12, 'square'], [988, 0.14, 0.12, 'square'], [740, 0.28, 0.12, 'square'], [988, 0.42, 0.12, 'square']] },
  siren: { label: 'صفارة', notes: [[600, 0, 0.2, 'sawtooth'], [900, 0.2, 0.2, 'sawtooth'], [600, 0.4, 0.2, 'sawtooth'], [900, 0.6, 0.2, 'sawtooth']] },
  marimba: { label: 'ماريمبا', notes: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1046, 0.3, 0.2]] },
}
const span = (t) => t.notes.reduce((m, n) => Math.max(m, n[1] + n[2]), 0)

function tone(freq, start, dur, vol, wave = 'sine') {
  if (!ctx) return
  const o = ctx.createOscillator(); const g = ctx.createGain()
  o.type = wave; o.frequency.value = freq
  const t0 = ctx.currentTime + start
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g); g.connect(ctx.destination)
  o.start(t0); o.stop(t0 + dur + 0.05)
}

export function playTone(name, { volume = 0.7, repeat = 1 } = {}) {
  const t = TONES[name] || TONES.chime
  const vol = 0.28 * Math.min(1, Math.max(0, volume))   // keep headroom: synth waves are loud
  const gap = span(t) + 0.18
  for (let r = 0; r < Math.max(1, Math.min(6, repeat)); r++) t.notes.forEach(([f, s, d, w]) => tone(f, r * gap + s, d, vol, w))
}

// cfg = notify settings .sound ; priority 'high' | 'normal'
export function chime(priority = 'normal', cfg = {}) {
  try {
    unlock()
    const hi = priority === 'high'
    if (cfg.enabled !== false) playTone(hi ? cfg.highTone || 'bell' : cfg.normalTone || 'chime', { volume: cfg.volume ?? 0.7, repeat: hi ? cfg.highRepeat || 3 : 1 })
    if (cfg.vibrate !== false) navigator.vibrate?.(hi ? [220, 90, 220, 90, 320] : 120)
  } catch { /* ignore */ }
}
