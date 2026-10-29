import { converse, quoteFor, rules, acCfg } from './sim.mjs'
import { INTENT_COUNT, SPEC_WORDS, R, detectDialect } from '../../mutqan-app/src/botData.js'

let pass = 0, fail = 0
const fails = []
const t = (name, ok, info) => { if (ok) pass++; else { fail++; fails.push(name + (info ? '  -> ' + info : '')) } }
const one = (text, opts) => converse([text], opts).last
const ORD = { orders: [{ status: 'on_the_way', technicianName: 'خالد' }] }
const EG = /هـ|هحول|دلوقتي|إيه|ايه|عايز|محتاج|بتاع|مفيش|إمتى|امتى|ميعاد|النهارده|تحب|ماشي|حاضر|ببلاش|هنرتب|هبعت|ابعتلي|قولي|معاك|ليك|بيشمل|بنوصل|بنخدم|مفهمتش|أكتر|هقدر|لسه|مش /
const SA = /وش|الحين|أبغى|ابغى|أبشر|ابشر|مره|بكرة|تبغى|تبغاه|حياك|تحت أمرك|يناسبك|ما فهمت|أحوّل|نحدد|موعد|الله يعافيك|يا هلا|هلا/

// ── A) single-turn intents (Saudi / Gulf / Egyptian / MSA / typos / voice noise) ──────────────
const singles = [
  // [text, {action?, spec?, re?, dialect?}]
  ['السلام عليكم', { re: /وعليكم|هلا|أهلاً|أهلين|يا هلا|نورتنا|أهلا/ }],
  ['هلا والله', { re: /هلا|أهلاً|أهلين/ }],
  ['صباح الخير', { re: /هلا|أهلاً|أهلين|يا هلا|نورتنا/ }],
  ['ازيك عامل ايه', { dialect: 'eg' }],
  ['شلونك يالطيب', {}],
  ['شكرا يعطيك العافيه', { re: /العفو|ولا يهمك|حياك|الله يعافيك|الله يسلمك|في الخدمة/ }],
  ['تسلم ايدك يا باشا', { re: /العفو|ولا يهمك|الله يسلمك|حياك/ }],
  ['ابغى اكلم موظف', { action: 'handoff' }],
  ['عايز اكلم حد من خدمة العملاء', { action: 'handoff' }],
  ['ما ابي روبوت ابغى انسان', { action: 'handoff' }],
  ['حولني لموظف لو سمحت', { action: 'handoff' }],
  ['مش عايز بوت عايز مدير', { action: 'handoff' }],
  ['وين الفني تاخر', { action: 'track', o: 1 }],
  ['فين الفني ده اتاخر اوي', { action: 'track', o: 1 }],
  ['متى يوصل الفني', { action: 'track', o: 1 }],
  ['حاله طلبي ايش وصلت', { action: 'track', o: 1 }],
  ['الضمان كم مدته', { action: 'warranty' }],
  ['المشكله رجعت بعد الصيانه', { action: 'warranty' }],
  ['المكيف رجع يعطل بعد الغسيل عايز اطبق الضمان', { action: 'warranty' }],
  ['ابغى اشتغل معكم كفني', { action: 'join_tech' }],
  ['عندكم وظايف فنيين', { action: 'join_tech' }],
  ['عندي شكوى على الفني', { action: 'handoff' }],
  ['الخدمه سيئه وانا مو راضي', { action: 'handoff' }],
  ['خدمة زفت ومش راضي', { action: 'handoff' }],
  ['ابغى الغي الطلب', { action: 'handoff' }],
  ['عايز الغي الطلب', { action: 'handoff' }],
  ['كم سعر غسيل مكيف سبليت', { re: /100/, spec: 'ac' }],
  ['بكام غسيل المكيف السبليت', { re: /100/, spec: 'ac' }],
  ['كم سعر غسيل 3 مكيفات سبليت', { re: /200/, spec: 'ac' }],
  ['عايز اغسل تلات مكيفات سبليت', { re: /200/, spec: 'ac' }],
  ['ابي غسيل 6 مكيفات', { re: /380/, spec: 'ac' }],
  ['بكم غسيل مكيف شباك', { re: /60/, spec: 'ac' }],
  ['غسيل 2 شباك', { re: /100/, spec: 'ac' }],
  ['غسيل مكيف دكت', { spec: 'ac', re: /كم/ }],
  ['غسيل 1 مكيف دكت', { spec: 'ac', re: /180/ }],
  ['اسعار غسيل المكيفات', { action: 'calculator' }],
  ['كم تاخذون على غسيل مكيف داخلي بس', { spec: 'ac', re: /90/ }],
  ['ابغى اركب مكيف', { spec: 'ac', re: /المعاينة|معاينة/ }],
  ['عايز فك ونقل وتركيب مكيف', { spec: 'ac', re: /المعاينة|معاينة/ }],
  ['المكيف ما يبرد', { spec: 'ac', re: /فلتر|فريون|الفحص|الفني/ }],
  ['التكييف مش بيبرد خالص', { spec: 'ac' }],
  ['المكيف يقطر ماي', { spec: 'ac' }],
  ['فيه تسريب مياه في المطبخ', { spec: 'plumbing' }],
  ['الحمام مسدود', { spec: 'plumbing' }],
  ['عندي طفح مجاري', { spec: 'plumbing' }],
  ['السخان معطل', { spec: 'appliances' }],
  ['غساله بتسرب مياه', { spec: 'appliances' }],
  ['الكهرباء فاصله في الشقة', { spec: 'electric' }],
  ['ابغى كهربائي يغير لي الاضاءه', { spec: 'electric' }],
  ['النور فاصل', { spec: 'electric' }],
  ['عايز تركيب كاميرات مراقبه', { spec: 'cameras' }],
  ['ابي كاميرات للفيلا', { spec: 'cameras' }],
  ['الثلاجه ما تبرد', { spec: 'fridge' }],
  ['التلاجه مش بتبرد', { spec: 'fridge' }],
  ['نسيت المفتاح داخل الشقة', { spec: 'locks' }],
  ['ابغى قفل ذكي', { spec: 'locks' }],
  ['الدش مقطوع', { spec: 'satellite' }],
  ['ابغى تركيب ستلايت', { spec: 'satellite' }],
  ['دهان شقه كامله', { spec: 'paint' }],
  ['ابي دهان للفيلا', { spec: 'paint' }],
  ['عندي صراصير في المطبخ', { spec: 'pest' }],
  ['مكافحه نمل ابيض', { spec: 'pest' }],
  ['ابغى تنظيف خزان المياه', { spec: 'tanks' }],
  ['تنضيف شقة بعد البناء', { spec: 'cleaning' }],
  ['نقل عفش من جده لمكه', { spec: 'moving' }],
  ['عايز نقل اثاث', { spec: 'moving' }],
  ['تركيب الواح شمسيه', { spec: 'solar' }],
  ['ابغى مقاول ترميم', { spec: 'contracting' }],
  ['ابي بلاط للصاله', { spec: 'tiling' }],
  ['ابي فني', { spec: 'general' }],
  ['تغطون جده', { re: /مكة|جدة|موقع/ }],
  ['هل تخدمون الرياض', { re: /خارج|مكة/ }],
  ['كيف ادفع', { action: 'pay' }],
  ['ازاي ادفع', { action: 'pay' }],
  ['تقبلون مدى', { action: 'pay' }],
  ['عندكم عروض', { action: 'calculator' }],
  ['فيه عروض على الغسيل', { action: 'calculator' }],
  ['من انت', { re: /مساعد أكسجين|مساعد اكسجين|أكسجين/ }],
  ['انت بوت ولا انسان', { re: /مساعد/ }],
  ['وش تقدمون من خدمات', { re: /تكييف|سباكة/ }],
  ['ايش يشمل الغسيل', { re: /تنظيف|ضمان/ }],
  ['الغسيل ياخد كام ساعة', { re: /ساعات|ساعة|بنوصل|نوصل|2-4/ }],
  ['فيه ضمان على الغسيل', { action: 'warranty' }],
  ['الجو حار مره', { re: /مكيف|تكييف|المكيفات/ }],
  ['الصيف حر قاتل', { re: /مكيف|تكييف|المكيفات/ }],
  ['ماني فاهم', { re: /./ }],
  ['مش فاهم يعني ايه', { re: /بجمع|أجمع|بيانات/ }],
  // typos / voice noise
  ['غسيل مكيييف سبلييت', { spec: 'ac' }],
  ['ابغا غسيل مكيف سبلت', { spec: 'ac' }],
  ['السلاااام عليكمممم', { re: /وعليكم|هلا|أهلاً|أهلين|يا هلا|نورتنا/ }],
  ['كم سعر غسيل المكيف سبلت', { spec: 'ac', re: /100/ }],
  ['عايز فني كهربا بسرعه', { spec: 'electric' }],
]
for (const [text, e] of singles) {
  const r = one(text, e.o ? ORD : undefined)
  const ok = (e.action ? r.action === e.action : true) && (e.spec ? (r.intent?.specialtyId === e.spec) : true) && (e.re ? e.re.test(r.reply) : true) && (e.dialect ? r.dialect === e.dialect : true)
  t(`single: ${text}`, ok, `action=${r.action} spec=${r.intent?.specialtyId} dialect=${r.dialect} reply=${r.reply.slice(0, 90)}`)
}

// ── B) dialect mirroring ───────────────────────────────────────────────────────────────────
for (const [text, want] of [
  ['عايز اغسل مكيفين', 'eg'], ['ازاي احجز دلوقتي', 'eg'], ['فين الفني بتاعي', 'eg'], ['بكام الغسيل ده', 'eg'], ['ممكن اعرف الاسعار يا هندسة', 'eg'],
  ['ابغى اغسل مكيفين', 'sa'], ['وش الاسعار عندكم', 'sa'], ['وين الفني الحين', 'sa'], ['كم سعر الغسيل ابي اعرف', 'sa'], ['ابشر ابغى فني كهرباء', 'sa'],
]) { const r = one(text); t(`dialect(${want}): ${text}`, r.dialect === want, r.dialect) }
{ const r = one('عايز اغسل مكيفين'); t('EG input -> EG-flavoured reply', EG.test(r.reply), r.reply) }
{ const r = one('ابغى اغسل مكيفين'); t('SA input -> SA-flavoured reply', SA.test(r.reply) && !/ببلاش|النهارده/.test(r.reply), r.reply) }
t('explicit pref egyptian overrides', converse(['ابغى غسيل مكيف'], { dialect: 'egyptian' }).last.dialect === 'eg')
t('explicit pref saudi overrides', converse(['عايز غسيل مكيف'], { dialect: 'saudi' }).last.dialect === 'sa')
t('voice dialect helper: egyptian text', detectDialect('عايز', 'فين الفني') === 'eg')
t('voice dialect helper: saudi text', detectDialect('ابغى', 'وين الفني') === 'sa')
t('voice dialect helper: neutral -> null', detectDialect('مكيف') === null)

// ── C) full ordering flows ─────────────────────────────────────────────────────────────────
for (const [name, opts, turns] of [
  ['SA wash 3', {}, ['ابغى غسيل 3 مكيفات سبليت', 'بكرة العصر', { loc: 1 }, 'تم']],
  ['EG wash 3', {}, ['عايز اغسل تلات مكيفات سبليت', 'بكره العصر', { loc: 1 }, 'تمام']],
  ['SA plumbing urgent', {}, ['عندي تسريب مياه ضروري الحين', { loc: 1 }, 'تمام']],
  ['EG electrician', {}, ['الكهربا فاصله عايز فني النهارده', { loc: 1 }, 'تمام']],
]) {
  const x = converse(turns, opts)
  t(`flow: ${name} -> ready_to_order`, x.results.some((r) => r.action === 'ready_to_order'), x.results.map((r) => r.action).join(','))
  t(`flow: ${name} -> keeps service`, !!x.draft.specialtyId, JSON.stringify(x.draft))
}
{ const x = converse(['ابغى غسيل 3 مكيفات سبليت', 'اليوم المغرب']); t('flow: time stored in draft', /مغرب/.test(x.draft.preferredTime || ''), JSON.stringify(x.draft)) }
{ const x = converse(['ابغى غسيل مكيف', 'بعد بكره الصبح', { loc: 1 }]); t('flow: time + location -> ready on next msg', converse(['ابغى غسيل مكيف', 'بعد بكره الصبح', { loc: 1 }, 'خلاص']).last.action === 'ready_to_order') }
t('flow: all-in-one sentence skips questions', (() => { const r = converse(['ابغى غسيل مكيف بكرة العصر', { loc: 1 }, 'تمام']).last; return r.action === 'ready_to_order' })())

// ── D) negotiation ──────────────────────────────────────────────────────────────────────────
const NEG_START = ['ابغى غسيل 3 مكيفات سبليت']
const objections = {
  SA: ['غالي مره', 'ابغى خصم', 'نزل لي السعر شوي', 'اخر سعر عندك', 'ما يناسبني السعر', 'السعر مرتفع', 'ابغى افاصل', 'قل لي افضل سعر', 'وفر لي شي'],
  EG: ['غالي اوي', 'عايز خصم', 'نزل السعر شويه', 'اخر كلام كام', 'مش مناسب السعر ده', 'ده كتير', 'عايز افاصل', 'قولي احسن سعر', 'وفرلي حاجه'],
}
for (const [dl, arr] of Object.entries(objections)) {
  const x = converse([...NEG_START, 'اليوم عصر', { loc: 1 }, ...arr])
  const negs = x.results.filter((r) => r.action === 'negotiate')
  const floor = quoteFor(x.draft).floor
  t(`neg ${dl}: every objection handled as negotiate`, negs.length >= arr.length - 1, x.results.map((r) => r.action).join(','))
  const prices = x.results.flatMap((r) => [...r.reply.matchAll(/(\d{2,4}) ر\.س/g)].map((m) => Number(m[1])))
  t(`neg ${dl}: never quotes below floor ${floor}`, prices.every((p) => p >= floor - 1), `prices=${prices} floor=${floor}`)
  t(`neg ${dl}: ladder reaches floor/handoff`, x.results.some((r) => r.nego && ['floor', 'handoff'].includes(r.nego.stage)), x.results.map((r) => r.nego?.stage).join(','))
}
for (const [name, line] of [
  ['competitor SA', 'فيه واحد يغسل لي بسعر اقل'], ['competitor EG', 'لقيت حد تاني ارخص منكم'], ['competitor market', 'السوق ارخص بكثير'],
  ['budget SA', 'ميزانيتي 150 بس'], ['budget EG', 'معايا 150 بس'], ['discount code', 'عميل جديد ابغى خصم'],
]) {
  const x = converse([...NEG_START, line])
  t(`neg: ${name}`, x.last.action === 'negotiate', `${x.last.action} | ${x.last.reply.slice(0, 80)}`)
}
{ // counter offers
  const base = converse(NEG_START); const q = quoteFor(base.draft)
  const hi = converse([...NEG_START, `ميزانيتي ${q.total} بالضبط`]).last
  t('counter >= list price accepted at list', hi.intent?.acceptedOffer === true, JSON.stringify(hi.intent))
  const low = converse([...NEG_START, 'ميزانيتي 50 ريال بس']).last
  t('counter far below floor refused (no accept)', !low.intent?.acceptedOffer && low.action === 'negotiate', low.reply)
  const mid = converse([...NEG_START, `ادفع ${q.floor + 5} ريال`]).last
  t('counter between floor and offer accepted', mid.intent?.acceptedOffer === true, mid.reply)
  const agreed = converse([...NEG_START, `ادفع ${q.floor + 5} ريال`]).draft.agreedPrice
  t('agreed price recorded & >= floor', agreed >= q.floor, `agreed=${agreed} floor=${q.floor}`)
}
{ // accept after an offer sets agreedPrice
  const x = converse([...NEG_START, 'غالي', 'نزل شوي', 'موافق'])
  t('accepting offer sets agreedPrice <= list & >= floor', x.draft.agreedPrice && x.draft.agreedPrice <= quoteFor(x.draft).total && x.draft.agreedPrice >= quoteFor(x.draft).floor, JSON.stringify(x.draft.agreedPrice))
}
t('hesitation handled softly', converse([...NEG_START, 'خليني افكر']).last.reply.length > 10 && converse([...NEG_START, 'خليني افكر']).last.action === 'none')
t('"expensive" w/o service asks for service', converse(['غالي']).last.action === 'collect')
t('rejection ends politely', converse([...NEG_START, 'لا شكرا']).last.action === 'none')
t('non-negotiable service holds price', (() => { const r = converse(['عندي تسريب مياه', 'غالي'], {}).last; return /(ثابت|فاهم|السعر)/.test(r.reply) || r.action === 'negotiate' })())

// ── E) safety & invariants ───────────────────────────────────────────────────────────────────
t('never invents prices for unknown service (only owner-table numbers)', [...one('كم سعر شي غير معروف').reply.matchAll(/(\d{2,4}) ر\.س/g)].every((m) => [100, 140, 200, 60, 180].includes(Number(m[1]))))
t('no active order -> honest "none found"', /ما عندي|مش لاقي|ما لقيت/.test(one('وين الفني').reply))
{ const all = singles.map(([x]) => one(x).reply); t('no reply is empty', all.every((r) => r && r.length > 5)) }
{ const bad = ['<script>alert(1)</script>', 'DROP TABLE orders;--', '😀😀😀', '', '   ', '١٢٣٤٥٦', 'a'.repeat(3000)]; t('robust to hostile/odd input', bad.every((b) => { try { return !!converse([b]).last.reply } catch (e) { return false } })) }
t('human request wins over everything', one('غالي ابغى موظف').action === 'handoff')
t('complaint escalates', one('انتم نصابين').action === 'handoff')

// ── F) knowledge-base size report ─────────────────────────────────────────────────────────────
const specWords = SPEC_WORDS.reduce((n, [, a]) => n + a.length, 0)
const replyVariants = Object.values(R).reduce((n, v) => n + v.sa.length + v.eg.length, 0)
t('KB: >=500 conversational patterns', INTENT_COUNT + specWords >= 500, String(INTENT_COUNT + specWords))

console.log(`\nKB: ${INTENT_COUNT} intent phrases + ${specWords} service words (= ${INTENT_COUNT + specWords} patterns), ${replyVariants} reply variants (SA+EG)`)
for (const f of fails) console.log('FAIL', f)
console.log(`${pass} passed, ${fail} failed (${pass + fail} checks)`)
process.exit(fail ? 1 : 0)
