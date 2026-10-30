// What the browser can honestly tell us about THIS device (Chrome/Android: battery + network type). Missing values stay undefined.
export async function deviceInfo() {
  const o = {}
  try { const b = await navigator.getBattery?.(); if (b) { o.battery = Math.round(b.level * 100); o.charging = !!b.charging } } catch { /* unsupported */ }
  try { const c = navigator.connection; if (c) { o.net = c.effectiveType || c.type || ''; o.rtt = c.rtt } } catch { /* unsupported */ }
  return o
}
