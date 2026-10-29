// Voice with the browser's own engines (free, no server): Web Speech API for speech-to-text and speechSynthesis for replies.
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

function pickVoice(lang) {
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || []
  return vs.find((v) => v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase())) || vs.find((v) => /^ar/i.test(v.lang)) || null
}

export const audio = {
  isSupported: !!SR,
  // returns a recorder: stop({save}) -> Promise<{text,url}>, cancel()
  async record({ lang = 'ar-SA' } = {}) {
    if (!SR) throw Object.assign(new Error('التعرّف على الصوت غير مدعوم في هذا المتصفح'), { code: 'UNSUPPORTED' })
    // Ask for the mic first so a denied permission fails here (the UI shows the permission help).
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()) }
    catch (e) { throw Object.assign(new Error('الميكروفون غير متاح'), { code: 'PERMISSION_DENIED' }) }
    const rec = new SR()
    rec.lang = lang; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1
    let finalText = '', interim = '', ended = false, err = null
    let resolveEnd
    const endP = new Promise((r) => { resolveEnd = r })
    rec.onresult = (ev) => {
      interim = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        if (r.isFinal) finalText += r[0].transcript + ' '; else interim += r[0].transcript
      }
    }
    rec.onerror = (ev) => { err = ev.error; if (ev.error === 'not-allowed') err = 'PERMISSION_DENIED' }
    rec.onend = () => { ended = true; resolveEnd() }
    rec.start()
    return {
      async stop() {
        try { rec.stop() } catch { /* already stopped */ }
        await Promise.race([endP, new Promise((r) => setTimeout(r, 2500))])
        if (err && !finalText && !interim) throw Object.assign(new Error('تعذر التعرّف على الصوت'), { code: String(err) })
        return { text: (finalText + interim).trim(), url: null }
      },
      cancel() { try { rec.abort() } catch { /* ignore */ } },
      get ended() { return ended },
    }
  },
  // Speaks through speechSynthesis. The utterance is returned so callers can follow its progress.
  speak(text, { voice, lang = 'ar-SA', rate = 1 } = {}) {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) { reject(new Error('النطق غير مدعوم')); return }
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(String(text || '').replace(/[*_#`]/g, ''))
      u.lang = lang; u.rate = rate
      const v = (voice && (speechSynthesis.getVoices().find((x) => x.name === voice))) || pickVoice(lang) || pickVoice('ar')
      if (v) u.voice = v
      resolve({ url: null, utterance: u, stop: () => speechSynthesis.cancel() })
      speechSynthesis.speak(u)
    })
  },
}
