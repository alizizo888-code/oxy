import fs from 'node:fs'
const BASE = 'http://127.0.0.1:8099/wp-json/mutqan/v1'
import os from 'node:os'
const DATA = os.tmpdir() + '/mutqan-test-data'
let pass = 0, fail = 0
const t = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  -> ' + JSON.stringify(extra))) }
async function call(path, body, { token, anon = 'anon-test-0001' } = {}, method = 'POST') {
  const h = { 'Content-Type': 'application/json', 'X-Mutqan-Anon': anon }
  if (token) h['X-Mutqan-Token'] = token
  const r = await fetch(BASE + path, { method, headers: h, body: method === 'POST' ? JSON.stringify(body || {}) : undefined })
  const j = await r.json().catch(() => null)
  return { status: r.status, data: j?.data, error: j?.error }
}
const db = (op, body, auth) => call('/db', { op, ...body }, auth)
const rnd = Math.random().toString(36).slice(2, 8)

// ---- owner
let r = await call('/team', { op: 'login', handle: 'ali', password: 'wrong-password' })
t('wrong password rejected', r.status === 401 && r.error?.code === 'bad_credentials', r)
r = await call('/team', { op: 'login', handle: 'ALI', password: 'Test-Only-Pw-1234' })
t('owner login (case-insensitive handle)', r.status === 200 && r.data.user.role === 'owner', r)
const owner = { token: r.data.token }
r = await call('/auth', { op: 'me' }, owner)
t('me returns owner', r.data?.user?.handle === 'ali')
r = await call('/team', { op: 'canManage' }, owner)
t('owner canManage', r.data?.value === true, r)

// ---- payment links: https only, owner-managed
r = await db('upsertShared', { coll: 'payment_methods', id: 'pm-link-ok', data: { type: 'pay_link', name: 'PayPal', enabled: true, payUrl: 'https://www.paypal.me/x/{amount}SAR' }, opts: { writableBy: 'admins' } }, owner)
t('owner saves https pay link', r.status === 200 && r.data?.payUrl?.startsWith('https://'), r)
r = await db('upsertShared', { coll: 'payment_methods', id: 'pm-link-bad', data: { type: 'pay_link', name: 'Bad', enabled: true, payUrl: 'javascript:alert(1)' }, opts: { writableBy: 'admins' } }, owner)
t('non-https pay link dropped', r.status === 200 && r.data?.payUrl === '', r)
r = await db('upsertShared', { coll: 'payment_methods', id: 'pm-link-http', data: { type: 'pay_link', name: 'Http', enabled: true, payUrl: 'http://evil.example/pay' }, opts: { writableBy: 'admins' } }, owner)
t('http pay link dropped', r.status === 200 && r.data?.payUrl === '', r)

// ---- welcome offer: 30% once per device, at most 2 devices per IP
const dev1 = 'd' + 'a1b2c3d4e5f60718'.repeat(1) + rnd.padEnd(6, '0'), dev2 = 'd' + '9f8e7d6c5b4a3921' + rnd.padEnd(6, '0'), dev3 = 'd' + '1122334455667788' + rnd.padEnd(6, '0')
r = await call('/promo', { op: 'status', deviceId: dev1 })
t('promo available for new device', r.data?.state === 'available' && r.data.pct === 30, r)
r = await call('/promo', { op: 'claim', deviceId: dev1 })
t('promo claim', r.data?.state === 'claimed', r)
r = await call('/promo', { op: 'claim', deviceId: dev1 })
t('promo claim idempotent', r.data?.state === 'claimed', r)
r = await call('/promo', { op: 'status', deviceId: 'bad' })
t('promo rejects malformed device id', r.data?.state === 'blocked', r)
r = await call('/promo', { op: 'status', deviceId: dev1 })
t('promo still claimed before an order', r.data?.state === 'claimed', r)
r = await call('/promo', { op: 'claim', deviceId: dev2 })
t('second device on same IP can claim', r.data?.state === 'claimed', r)
r = await call('/promo', { op: 'claim', deviceId: dev3 })
t('third device on same IP blocked', r.data?.state === 'blocked', r)

// ---- pricing set by owner; customers cannot
r = await db('upsertShared', { coll: 'pricing', id: 'ac', data: { serviceId: 'ac', base: 100, min: 80, discountPct: 20, visitFee: 0, emergencyPct: 25, extraUnitPct: 80 }, opts: { writableBy: 'admins' } }, owner)
t('owner upserts pricing', r.status === 200, r)
r = await call('/auth', { op: 'signup', name: 'عميل تجريبي', phone: '٠٥٠' + Math.floor(1e6 + Math.random() * 8e6), password: 'secret1' })
t('customer signup with Arabic digits normalised', r.status === 200 && /^050\d{7}$/.test(r.data.user.handle), r)
const cust = { token: r.data.token }
r = await db('upsertShared', { coll: 'pricing', id: 'ac', data: { base: 1, min: 1 } }, cust)
t('customer cannot write pricing', r.status === 403, r)
r = await db('selectShared', { coll: 'pricing_internal' }, cust)
t('customer cannot read pricing_internal', r.status === 200 && r.data.length === 0, r)

// ---- orders + price floor
const order = (extra) => ({ specialtyId: 'ac', description: 'تكييف لا يبرد', clientName: 'عميل', clientPhone: '0501234567', address: 'جدة', lat: 21.5, lng: 39.2, ...extra })
r = await db('insertShared', { coll: 'orders', data: order({ agreedPrice: 50 }), opts: {} }, cust)
t('order below floor rejected (422)', r.status === 422 && r.error?.code === 'price_below_floor', r)
r = await db('insertShared', { coll: 'orders', data: order({ agreedPrice: 90 }), opts: {} }, cust)
t('order at/above floor accepted', r.status === 200 && r.data.id, r)
const oid = r.data?.id
t('server forces status=new and clientId', r.data?.status === 'new' && r.data?.clientId, r.data)
r = await db('insertShared', { coll: 'orders', data: order({ agreedPrice: 90, status: 'completed', technicianId: 'x', price: 1 }) }, cust)
t('client cannot inject status/technician/price', r.data?.status === 'new' && !r.data?.technicianId && r.data?.price === undefined, r.data)
r = await db('updateShared', { coll: 'orders', id: oid, data: { agreedPrice: 1, price: 1, notes: 'مهم' } }, cust)
t('customer update drops price fields but keeps notes', r.status === 200 && r.data.agreedPrice === 90 && r.data.price === undefined && r.data.notes === 'مهم', r)
r = await db('insertShared', { coll: 'orders', data: order({ priority: 'urgent', priceQuote: { total: 70 } }) }, { anon: 'someone-else-9999' })
t('anonymous visitor can place order only if above floor (quote 70 < floor)', r.status === 422, r)
r = await db('selectShared', { coll: 'orders' }, { anon: 'someone-else-9999' })
t('anonymous visitor sees no orders', r.status === 200 && r.data.length === 0, r)
r = await db('selectShared', { coll: 'orders' }, cust)
t('customer sees only own orders', r.data.length === 2 && r.data.every((o) => o.clientId), r.data?.length)

// ---- AC calculator guard (defaults: 3 splits wash = 200, floor 180)
const ac = (q, extra) => order({ qty: q.qty, acQuote: q, ...extra })
let acN = 0
const anonAcNext = () => ({ anon: 'ac-anon-visitor-' + rnd + '-' + (++acN) + '-xxxx' })
r = await db('insertShared', { coll: 'orders', data: ac({ mode: 'wash', type: 'سبليت', qty: 3, full: true, warranty: 'بدون', vat: false, total: 100 }) }, anonAcNext())
t('AC: forged low quote total rejected', r.status === 422 && r.error?.code === 'price_below_floor', r)
r = await db('insertShared', { coll: 'orders', data: ac({ mode: 'wash', type: 'سبليت', qty: 3, full: true, warranty: 'بدون', vat: false, total: 200 }) }, anonAcNext())
t('AC: honest quote accepted', r.status === 200, r)
r = await db('selectShared', { coll: 'ac_media' }, { anon: 'ac-reader-' + rnd + '-xxxxxxxx' })
t('AC: media library is publicly readable', r.status === 200, r)
r = await db('insertShared', { coll: 'ac_media', data: { url: 'x' } }, cust)
t('AC: customer cannot write media', r.status === 403, r)


// ---- staff creation + roles
r = await call('/team', { op: 'createMember', handle: 'ops' + rnd, role: 'operations', displayName: 'غرفة العمليات', password: 'opspass1' }, owner)
t('owner creates operations member', r.status === 200, r)
const opsHandle = 'ops' + rnd
r = await call('/team', { op: 'login', handle: opsHandle, password: 'opspass1' })
t('operations login', r.status === 200 && r.data.user.role === 'operations', r)
const ops = { token: r.data.token }
r = await db('selectShared', { coll: 'orders' }, ops)
t('operations sees all orders', r.data.length >= 2, r.data?.length)
r = await db('updateShared', { coll: 'orders', id: oid, data: { technicianId: 'tech-x', status: 'assigned' } }, ops)
t('operations assigns technician', r.status === 200 && r.data.technicianId === 'tech-x', r)
r = await call('/team', { op: 'createMember', handle: 'hack' + rnd, role: 'technician' }, cust)
t('customer cannot create members', r.status === 403, r)
r = await call('/team', { op: 'setRolePowers', role: 'technician', powers: ['read'] }, ops)
t('operations cannot change role powers (owner only)', r.status === 403, r)

// ---- owner password / ai settings protections
r = await db('upsertShared', { coll: 'ai_settings', id: 'default', data: { dialect: 'saudi', globalPolicy: { maxDiscountPct: 20 } }, opts: {} }, owner)
t('owner writes ai_settings', r.status === 200, r)
r = await db('updateShared', { coll: 'ai_settings', id: 'default', data: { globalPolicy: { maxDiscountPct: 90 }, dialect: 'egyptian' } }, ops)
t('operations cannot change owner-only ai keys', r.status === 200 && r.data.globalPolicy.maxDiscountPct === 20 && r.data.dialect === 'egyptian', r)

// ---- stamps
r = await db('stamps', { topics: ['orders', 'offers'] }, cust)
const s1 = r.data?.orders
await db('insertShared', { coll: 'offers', id: 'o1', data: { title: 'خصم' } }, owner)
await db('updateShared', { coll: 'orders', id: oid, data: { notes: 'تغيّر' } }, ops)
await new Promise((x) => setTimeout(x, 1100))
r = await db('stamps', { topics: ['orders', 'offers'] }, cust)
t('stamps change after writes', r.data?.orders !== s1 && r.data?.offers, { s1, now: r.data })

// ---- push
r = await call('/push', { op: 'send', target: { admins: true }, message: { title: 'طلب جديد', body: 'x' } }, cust)
t('customer push to admins accepted', r.status === 200, r)
r = await call('/push', { op: 'inbox', since: Date.now() - 60000 }, ops)
t('operations inbox receives admin push', r.data?.items?.some((m) => m.title === 'طلب جديد'), r)
r = await call('/push', { op: 'inbox', since: Date.now() - 60000 }, cust)
t('customer inbox does not receive admin push', r.data?.items?.length === 0, r)
r = await db('select', { coll: '_push' }, ops)
t('_push not readable via db', r.status !== 200 || r.data.length === 0, r)

// ---- AI gateway: groq 429 -> gemini
fs.writeFileSync(DATA + '/ai_mode_groq', '429')
r = await call('/ai', { prompt: 'مرحبا رقمي 0501234567', opts: { json: true } }, cust)
t('AI falls back to gemini when groq is rate-limited', r.status === 200 && r.data.provider === 'gemini', r)
const log = fs.readFileSync(DATA + '/http.log', 'utf8')
t('phone number masked before leaving server', !log.includes('0501234567'), 'leak')
fs.writeFileSync(DATA + '/ai_mode_groq', 'ok')
r = await call('/ai', { prompt: 'مرحبا', opts: { json: true } }, cust)
t('groq in cooldown -> still answered (gemini)', r.status === 200 && r.data.provider === 'gemini', r)
r = await call('/ai', { prompt: 'x' }, { anon: 'zzzzzzzz-anon' })
t('anonymous visitor may use AI (anon id)', r.status === 200, r)
const g = await fetch(BASE + '/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"prompt":"hi"}' })
t('guest without any id rejected', g.status === 401, g.status)

// ---- misc
r = await call('/geocode?lat=21.5&lng=39.2', null, cust, 'GET')
t('geocode', r.data?.address?.includes('التحلية'), r)
r = await db('selectShared', { coll: 'orders', filters: { 'bad;drop': 1 } }, ops)
t('bad field name rejected', r.status === 400, r)
r = await db('selectShared', { coll: 'orders', filters: { status: { in: ['new', 'assigned'] }, createdAt: { gte: '2020-01-01T00:00:00Z' } }, opts: { order: '-createdAt', limit: 5 } }, ops)
t('filters in/gte + order work', r.status === 200 && r.data.length >= 1, r)
r = await db('groupByShared', { coll: 'orders', field: 'status' }, ops)
t('groupBy', Array.isArray(r.data) && r.data.some((x) => x.key === 'new'), r)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
