import { post } from './_api'

// Writes tell every live hook to refetch right away (before the next poll).
const writeListeners = new Set()
export const onLocalWrite = (fn) => { writeListeners.add(fn); return () => writeListeners.delete(fn) }
const wrote = (coll) => writeListeners.forEach((fn) => { try { fn(coll) } catch { /* ignore */ } })

const call = (op, body) => post('/db', { op, ...body })
// Outbox: a patch/upsert-by-id that fails only because the network is down is kept on the device and re-sent (technician in a lift, customer in a basement…).
// Inserts without an id are never retried (would risk duplicates); server-side rejections are never retried.
const OUT_KEY = 'mq_outbox'
const RETRYABLE = new Set(['updateShared', 'update', 'upsertShared', 'upsert'])
const readOut = () => { try { return JSON.parse(localStorage.getItem(OUT_KEY) || '[]') } catch { return [] } }
const saveOut = (a) => { try { a.length ? localStorage.setItem(OUT_KEY, JSON.stringify(a.slice(-200))) : localStorage.removeItem(OUT_KEY) } catch { /* ignore */ } }
let flushing = false
async function flushOutbox() {
  if (flushing) return
  flushing = true
  try {
    let q = readOut()
    while (q.length) {
      const it = q[0]
      try { await call(it.op, { coll: it.coll, ...it.body }); wrote(it.coll) }
      catch (e) { if (e && e.code === 'NETWORK') break }   // still offline: keep the rest, try later
      q = q.slice(1); saveOut(q)
    }
  } finally { flushing = false }
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', flushOutbox); window.addEventListener('focus', flushOutbox)
  setInterval(flushOutbox, 15000); setTimeout(flushOutbox, 3000)
}
const writeCall = async (op, coll, body) => {
  try { const r = await call(op, { coll, ...body }); wrote(coll); return r }
  catch (e) {
    const ok = e && e.code === 'NETWORK' && RETRYABLE.has(op) && (op.startsWith('update') || body.id)
    if (!ok) throw e
    saveOut([...readOut(), { op, coll, body, at: Date.now() }])
    wrote(coll)
    return { queued: true }
  }
}

export const db = {
  // shared collections (readable per server policy)
  selectShared: (coll, filters = {}, opts = {}) => call('selectShared', { coll, filters, opts }),
  countShared: (coll, filters = {}) => call('countShared', { coll, filters }),
  groupByShared: (coll, field, opts = {}) => call('groupByShared', { coll, field, filters: opts.filters || {}, opts: { limit: opts.limit } }),
  sumShared: (coll, field, filters = {}) => call('sumShared', { coll, field, filters }),
  insertShared: (coll, data, id, opts = {}) => writeCall('insertShared', coll, { data, id: id || null, opts }),
  updateShared: (coll, id, data) => writeCall('updateShared', coll, { id, data }),
  upsertShared: (coll, data, id, opts = {}) => writeCall('upsertShared', coll, { data, id: id || null, opts }),
  deleteShared: (coll, id) => writeCall('deleteShared', coll, { id }),
  // private (per-user) collections
  select: (coll, filters = {}, opts = {}) => call('select', { coll, filters, opts }),
  count: (coll, filters = {}) => call('count', { coll, filters }),
  groupBy: (coll, field, opts = {}) => call('groupByShared', { coll, field, filters: opts.filters || {}, opts: { limit: opts.limit } }),
  insert: (coll, data, id, opts = {}) => writeCall('insert', coll, { data, id: id || null, opts }),
  update: (coll, id, data) => writeCall('update', coll, { id, data }),
  delete: (coll, id) => writeCall('delete', coll, { id }),
  stamps: (topics) => call('stamps', { topics }),
}
