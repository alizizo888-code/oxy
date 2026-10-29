// Pure auto-assignment logic for Metqan's operations room.
// Shared by the operations supervisor (distribution) and the technician radar.

const isToday = (iso) => {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

// How many jobs this technician is carrying today (still-active or assigned today).
export function assignedToday(techUserId, orders) {
  return orders.filter((o) => o.technicianId === techUserId && isToday(o.assignedAt || o.createdAt)).length
}

// Daily capacity remaining = dailyCapacity − today's assigned jobs.
export function remainingCapacity(tech, orders) {
  const cap = Number(tech.dailyCapacity)
  if (!cap || cap <= 0) return 0
  return Math.max(0, cap - assignedToday(tech.userId, orders))
}

// A technician can take a job only if they are active AND have capacity left today.
export function isTechAvailable(tech, orders) {
  if (tech.active === false) return false
  return remainingCapacity(tech, orders) > 0
}

function techDistance(tech, orderLat, orderLng, distanceFn) {
  if (tech.homeLat != null && tech.homeLng != null && distanceFn) {
    try {
      return distanceFn(tech.homeLat, tech.homeLng, orderLat, orderLng)
    } catch {
      return Infinity
    }
  }
  return Infinity
}

export const TECH_LEVELS = [
  { id: 'junior', label: 'مبتدئ', w: 0.4 },
  { id: 'senior', label: 'محترف', w: 0.7 },
  { id: 'expert', label: 'خبير', w: 1 },
]
export const techLevelLabel = (id) => TECH_LEVELS.find((l) => l.id === id)?.label || 'محترف'

function techRating(tech, orders) {
  const rated = orders.filter((o) => o.technicianId === tech.userId && o.rating)
  if (!rated.length) return null
  return rated.reduce((s, o) => s + Number(o.rating), 0) / rated.length
}

// Smart matching: scores every technician on location/distance, specialty,
// availability, workload, service type, priority and qualification. It only
// RANKS — the final link still follows MUTQAN rules (capacity, acceptance, roles).
export function scoreTechnicians(order, techs, orders, { distanceFn } = {}) {
  const urgent = order?.priority === 'urgent'
  return techs
    .map((t) => {
      const reasons = []
      const available = isTechAvailable(t, orders)
      const rem = remainingCapacity(t, orders)
      const cap = Number(t.dailyCapacity) || 0
      const distM = order?.lat != null ? techDistance(t, order.lat, order.lng, distanceFn) : Infinity
      const km = Number.isFinite(distM) ? Math.round(distM / 100) / 10 : null

      const distScore = km == null ? 0.3 : Math.max(0, 1 - km / 40)
      if (km != null) reasons.push(`${km} كم`)
      else reasons.push('بدون موقع')

      const specs = Array.isArray(t.specialties) ? t.specialties : []
      const specScore = !specs.length ? 0.5 : specs.includes(order?.specialtyId) ? 1 : 0
      if (specs.length) reasons.push(specScore ? 'تخصص مطابق' : 'خارج تخصصه')

      const workScore = cap ? rem / cap : 0
      reasons.push(`سعة ${rem}/${cap}`)

      const scopeScore = t.scope === 'wash_maintenance_install' ? 1 : t.scope === 'wash_maintenance' ? 0.75 : 0.5
      const level = TECH_LEVELS.find((l) => l.id === t.level) || TECH_LEVELS[1]
      const rating = techRating(t, orders)
      const qualScore = level.w * 0.6 + (rating ? rating / 5 : 0.7) * 0.4
      reasons.push(level.label + (rating ? ` · ⭐${rating.toFixed(1)}` : ''))

      // Urgent orders weigh distance more; normal ones balance workload.
      const w = urgent
        ? { dist: 0.4, spec: 0.25, work: 0.1, scope: 0.1, qual: 0.15 }
        : { dist: 0.25, spec: 0.25, work: 0.2, scope: 0.1, qual: 0.2 }
      let score = distScore * w.dist + specScore * w.spec + workScore * w.work + scopeScore * w.scope + qualScore * w.qual
      if (!available) score = 0
      return { tech: t, available, score: Math.round(score * 100), km, rem, reasons }
    })
    .sort((a, b) => b.score - a.score)
}

// Choose the best technician for an order, or null when nobody qualifies (→ إجباري).
export function pickTechnician(order, techs, orders, { strategy = 'nearest', distanceFn } = {}) {
  const available = techs.filter((t) => isTechAvailable(t, orders))
  if (available.length === 0) return null
  if (strategy === 'smart') {
    const top = scoreTechnicians(order, available, orders, { distanceFn }).find((r) => r.available && r.score > 0)
    return top?.tech || null
  }
  if (strategy === 'capacity') {
    return [...available].sort((a, b) => remainingCapacity(b, orders) - remainingCapacity(a, orders))[0]
  }
  // nearest — technicians with no location fall to the end of the line.
  return [...available].sort(
    (a, b) => techDistance(a, order.lat, order.lng, distanceFn) - techDistance(b, order.lat, order.lng, distanceFn),
  )[0]
}
