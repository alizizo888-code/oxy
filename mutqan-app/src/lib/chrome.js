// Make the browser/phone bars (status bar, address bar, bottom gesture area) take the app's own colour,
// so the page looks edge-to-edge like a native app without forcing fullscreen on customers.
const LIGHT = '#eff7f5'
const DARK = '#0b1220'
export function syncChrome() {
  try {
    const apply = () => {
      const c = document.documentElement.classList.contains('dark') ? DARK : LIGHT
      let m = document.querySelector('meta[name="theme-color"]')
      if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m) }
      m.setAttribute('content', c)
      document.documentElement.style.backgroundColor = c
    }
    apply()
    new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  } catch { /* ignore */ }
}
