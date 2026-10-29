import { converse, quoteFor } from './sim.mjs'
let pass = 0, fail = 0
const t = (name, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', name, '->', info ?? '') } }
const num = (r) => Number((r.reply.match(/(\d{2,4}) ر\.س/g) || []).pop()?.replace(/\D/g, ''))

// multi-item orders
for (const [txt, total] of [['ابغى اغسل 3 سبليت و 2 شباك', 300], ['عندي 2 سبليت و 1 شباك', 200], ['عايز غسيل 3 سبليت و 3 شباك', 350], ['ابي غسيل 1 سبليت و 2 داكت', 460]]) {
  const x = converse([txt]); t(`multi: ${txt}`, new RegExp(`${total} ر\\.س`).test(x.last.reply) && !!x.last.intent.acq?.items, x.last.reply)
  t(`multi quote engine agrees: ${txt}`, quoteFor(x.draft)?.total === total, quoteFor(x.draft)?.total)
}
// follow-ups on the same draft
{ const x = converse(['كم غسيل 3 مكيفات سبليت', 'وللشباك؟']); t('follow-up: "and for window?" re-quotes window x3', /150/.test(x.last.reply), x.last.reply) }
{ const x = converse(['كم غسيل مكيفين سبليت', 'طيب 3؟']); t('follow-up: "what about 3?"', /200/.test(x.last.reply), x.last.reply) }
{ const x = converse(['كم غسيل 3 مكيفات سبليت', 'لو داخلي بس']); t('follow-up: inner only cheaper', num(x.last) < 200, x.last.reply) }
{ const x = converse(['كم غسيل 3 مكيفات سبليت', 'ومع ضمان شهرين كم']); t('follow-up: +warranty 2 months = 260', /260/.test(x.last.reply), x.last.reply) }
{ const x = converse(['كم غسيل 3 مكيفات سبليت', 'مع ضمان 3 شهور']); t('follow-up: +warranty 3 months = 290', /290/.test(x.last.reply), x.last.reply) }
{ const x = converse(['كم غسيل 3 مكيفات سبليت', 'شامل الضريبه كم']); t('follow-up: VAT = 230', /230/.test(x.last.reply), x.last.reply) }
{ const x = converse(['كم غسيل 3 مكيفات سبليت', 'خليها 4']); t('edit qty: 4 splits', /4/.test(x.last.reply) && num(x.last) > 200, x.last.reply) }
{ const x = converse(['كم غسيل 3 مكيفات سبليت', 'بدل 3 خليها 2']); t('edit qty down: 2 splits = 140', /140/.test(x.last.reply), x.last.reply) }
// upsell
{ const x = converse(['كم غسيل مكيفين سبليت']); t('upsell hints the 3rd unit', /💡|كمان|واحد/.test(x.last.reply) && /200/.test(x.last.reply), x.last.reply) }
{ const x = converse(['كم غسيل 3 مكيفات سبليت']); t('no upsell on best offer', !/💡/.test(x.last.reply)) }
// edits
{ const x = converse(['ابغى غسيل مكيف', 'بكرة العصر', 'غير الموعد لبعد بكره الصبح']); t('edit time stored', /بعد بكر/.test(x.draft.preferredTime) && /غيّرت/.test(x.last.reply), x.last.reply + '|' + x.draft.preferredTime) }
// contact + area
{ const x = converse(['ابغى غسيل مكيف', 'اسمي محمد وجوالي 0551234567']); t('captures name+phone', x.draft.contact?.phone === '0551234567' && x.draft.contact?.name === 'محمد', JSON.stringify(x.draft.contact)) }
{ const x = converse(['ابغى غسيل مكيف', 'رقمي 01012345678']); t('captures Egyptian mobile', x.draft.contact?.phone === '01012345678', JSON.stringify(x.draft.contact)) }
{ const x = converse(['ابغى غسيل مكيف', 'انا في حي النسيم']); t('captures neighbourhood', /النسيم/.test(x.draft.locationText || ''), JSON.stringify(x.draft)) }
{ const x = converse(['ابغى غسيل مكيف', 'جوالي +966501234567']); t('captures +966 mobile', x.draft.contact?.phone === '0501234567', JSON.stringify(x.draft.contact)) }
// off-topic, frustration, sentiment
for (const m of ['من فاز بالمباراه امس', 'ايش سعر الذهب اليوم', 'اكتب لي قصيده', 'وش رايك في الانتخابات']) { const r = converse([m]).last; t(`offtopic polite redirect: ${m}`, /تخصص|الصيانة|الخدمات/.test(r.reply) && !r.intent.specialtyId, r.reply) }
for (const m of ['زهقت منكم كل مره كذا', 'طفشت ولا احد يرد', 'مليت من التاخير', 'ارحموني تعبت']) { const r = converse([m]).last; t(`frustration -> human: ${m}`, r.action === 'handoff', r.action) }
// Levant/Gulf phrasing understood
for (const m of ['قديش بتغسلوا المكيف', 'شنو سعر غسيل المكيف', 'بدي اعرف سعر غسيل السبليت']) { const r = converse([m]).last; t(`levant/gulf price: ${m}`, /100|ر\.س/.test(r.reply), r.reply) }
// suggestions
{ const r = converse(['ابغى غسيل 3 سبليت']).last; t('suggestions after quote', Array.isArray(r.suggestions) && r.suggestions.length >= 2, JSON.stringify(r.suggestions)) }
{ const r = converse(['السلام عليكم']).last; t('suggestions at start', r.suggestions.length >= 3, JSON.stringify(r.suggestions)) }
{ const a = converse(['عايز غسيل مكيف']).last.suggestions.join(); const b = converse(['ابغى غسيل مكيف']).last.suggestions.join(); t('suggestions follow dialect', a !== b, a + ' | ' + b) }
// negotiation on a mixed order + warranty add-on still respects floor
{ const x = converse(['ابغى اغسل 3 سبليت و 2 شباك', 'اليوم عصر', { loc: 1 }, 'غالي', 'نزل', 'اخر سعر', 'اخر سعر لو سمحت']); const fl = quoteFor(x.draft).floor
  const prices = x.results.filter((r) => r.action === 'negotiate').flatMap((r) => [...r.reply.matchAll(/(\d{2,4}) ر\.س/g)].map((m) => Number(m[1])))
  t('mixed order negotiation never below floor', prices.every((p) => p >= fl - 1), `${prices} floor=${fl}`) }
{ const x = converse(['كم غسيل 3 مكيفات سبليت مع ضمان شهرين', 'اليوم عصر', { loc: 1 }, 'غالي', 'اخر سعر', 'خصم', 'اخر كلمه']); const q = quoteFor(x.draft)
  const prices = x.results.filter((r) => r.action === 'negotiate').flatMap((r) => [...r.reply.matchAll(/(\d{2,4}) ر\.س/g)].map((m) => Number(m[1])))
  t('warranty-priced order negotiates from 260 base', q.total === 260 && prices.every((p) => p >= q.floor - 1), `${q.total} ${q.floor} ${prices}`) }
// long voice-style run-on
{ const r = converse(['السلام عليكم يا شباب كيف الحال انا عندي ثلاث مكيفات سبليت في البيت وابغى اغسلهم بكره العصر ان شاء الله وانا ساكن في حي الصفا']).last
  t('long voice-style message understood (qty/type/time/area)', r.intent.qty === 3 && /200/.test(r.reply) && /عصر/.test(r.intent.preferredTime || '') && /الصفا/.test(r.intent.locationText || ''), JSON.stringify(r.intent)) }
{ const r = converse(['يا باشا عايز اغسل مكيفين شباك بكره الصبح ضروري']).last; t('Egyptian run-on', /100/.test(r.reply) && r.dialect === 'eg', r.reply) }

console.log(`v2: ${pass}/${pass + fail}`)
process.exit(fail ? 1 : 0)
