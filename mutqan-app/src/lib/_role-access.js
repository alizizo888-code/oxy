export const BUILT_IN_ROLES = ['operations', 'supervisor', 'technician']
export const POWERS = ['read', 'write', 'manage']
export const normalizePowers = (p) => POWERS.filter((x) => Array.isArray(p) && p.includes(x))
// Powers an app-declared role manifest forces on (locked in the switches).
export function declaredPowers(roleOptions, name) {
  const r = (roleOptions || []).find((o) => (o && (o.name || o.id || o.value)) === name)
  return normalizePowers(r && r.powers)
}
export function manifestPowers(roleOptions) {
  const out = {}
  for (const o of roleOptions || []) { const n = o && (o.name || o.id || o.value); if (n) out[n] = declaredPowers(roleOptions, n) }
  return out
}
export const rolesToGrant = () => []
