import { post } from './_api'

// Writes tell every live hook to refetch right away (before the next poll).
const writeListeners = new Set()
export const onLocalWrite = (fn) => { writeListeners.add(fn); return () => writeListeners.delete(fn) }
const wrote = (coll) => writeListeners.forEach((fn) => { try { fn(coll) } catch { /* ignore */ } })

const call = (op, body) => post('/db', { op, ...body })
const writeCall = async (op, coll, body) => { const r = await call(op, { coll, ...body }); wrote(coll); return r }

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
