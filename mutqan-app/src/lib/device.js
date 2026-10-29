// Stable anonymous device id (for the one-time welcome offer). Survives reloads; only a hash of it is stored on the server.
const KEY = 'mutqan_device'
let mem = ''
export function getDeviceId() {
  try {
    let v = localStorage.getItem(KEY)
    if (!v || !/^[A-Za-z0-9-]{16,64}$/.test(v)) {
      const a = new Uint8Array(16); crypto.getRandomValues(a)
      v = 'd' + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
      localStorage.setItem(KEY, v)
    }
    return v
  } catch {
    if (!mem) mem = 'd' + (Date.now().toString(16) + Math.random().toString(16).slice(2)).padEnd(31, '0').slice(0, 31)
    return mem
  }
}
