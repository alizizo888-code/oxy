import { converse } from './sim.mjs'
const ORD = { orders: [{ status: 'on_the_way', technicianName: 'خالد' }] }
const cases = [
  // [text, expected spec|action|regex-name]
  ['السلام عليكم ورحمه الله وبركاته كيف حالكم', 'greet'],
  ['مساء الخير يا شباب', 'greet'],
  ['يا باشا عندي مكيف شباك عايز اغسله', 'spec:ac'],
  ['ممكن تبعتولي فني يشوف المكيف عندي لانه بيعمل صوت عالي', 'spec:ac'],
  ['مكيفي فيه ثلج وبيسرب مي', 'spec:ac'],
  ['عندي ٣ مكيفات سبليت وابغى اغسلهم', 'price:200'],
  ['عندي ٢ سبليت ابي غسيل', 'price:140'],
  ['ابغى غسيل مكيف واحد سبليت', 'price:100'],
  ['كم يعني تغسلون لي ٦ مكيفات', 'price:380'],
  ['اريد تركيب مكيف جديد', 'spec:ac'],
  ['وش يطلع حق تركيب سبليت', 'spec:ac'],
  ['الفني اللي جاني غلط وكسر لي المكيف', 'action:handoff'],
  ['ابغى استرجاع فلوسي', 'action:handoff'],
  ['هل الفني بيجي لحد باب البيت', 'any'],
  ['عندي حفله بكره وكل المكيفات خربانه ضروري', 'spec:ac'],
  ['السباك بكام الكشفيه', 'spec:plumbing'],
  ['مطبخي فيه ريحة مجاري', 'spec:plumbing'],
  ['حنفية الحمام بتنقط', 'spec:plumbing'],
  ['فيش الكهربا بيطلع شرار', 'spec:electric'],
  ['تمديدات كهرباء لشقه جديده', 'spec:electric'],
  ['لمبه الصاله احترقت', 'spec:electric'],
  ['ابغى اركب كاميرتين عند الباب', 'spec:cameras'],
  ['قفل بابي معلق', 'spec:locks'],
  ['ثلاجة السوبرماركت واقفه', 'spec:fridge'],
  ['عندنا نمل في الحديقه', 'spec:pest'],
  ['خزان البيت محتاج غسيل', 'spec:tanks'],
  ['نقل اثاث من الطايف', 'spec:moving'],
  ['ابي اضيف ملحق في السطح', 'spec:contracting'],
  ['محتاج دهان غرفتين', 'spec:paint'],
  ['تركيب سخان شمسي', 'spec:solar'],
  ['عندكم عقد صيانه للشركات', 'any'],
  ['لو سمحت ابغى رقم المدير', 'action:handoff'],
  ['الفني متاخر ساعتين', 'action:track:o'],
  ['وصل الفني ولا لسه', 'action:track:o'],
  ['المكيف رجع يعطل بعد اسبوع من الغسيل', 'action:warranty'],
  ['ايش مدة الضمان عندكم', 'action:warranty'],
  ['كاش ولا تحويل', 'action:pay'],
  ['تقبلون ابل باي', 'action:pay'],
  ['ابغى فاتوره ضريبيه', 'action:pay'],
  ['تشتغلون الجمعه', 'regex:جمعة|الجمعة|مواعيد|موعد|نوصل|بنوصل'],
  ['وين مقركم', 'regex:مكة|جدة|موقع'],
  ['اشكرك جدا', 'regex:العفو|ولا يهمك|حياك|الله يسلمك'],
  ['الله يعطيك العافيه', 'any'],
  ['ماشي يلا سلام', 'any'],
  ['اوكي شكرا', 'any'],
  ['اطلب فني الحين', 'spec:general'],
  ['لا مو الحين', 'any'],
  ['ايش اللي يشمله الغسيل', 'regex:تنظيف|ضمان'],
  ['عندكم قطع غيار اصليه', 'regex:أصلية|اصلية|القطع'],
  ['ممكن تعيد الكلام', 'any'],
  ['مرحبا انا محمد من جدة وعندي مكيف يحتاج غسيل', 'act:handoff'],
  ['مرحبا انا محمد من العزيزية وعندي مكيف يحتاج غسيل', 'spec:ac'],
]
let pass = 0, fail = 0
for (const [text, exp] of cases) {
  const x = converse([text], exp.endsWith(':o') ? ORD : {})
  const r = x.last
  const [kind, val] = exp.replace(/:o$/, '').split(/:(.+)/)
  let ok = true
  if (kind === 'spec') ok = r.intent?.specialtyId === val
  else if (kind === 'price') ok = new RegExp(val).test(r.reply)
  else if (kind === 'action') ok = r.action === val
  else if (kind === 'regex') ok = new RegExp(val).test(r.reply)
  else if (kind === 'greet') ok = /هلا|أهلاً|أهلين|يا هلا|نورتنا|وعليكم/.test(r.reply)
  if (ok) pass++; else { fail++; console.log('MISS', text, '=>', r.action, r.intent?.specialtyId, '|', r.reply.slice(0, 80)) }
}
console.log(`blind: ${pass}/${pass + fail}`); process.exit(fail ? 1 : 0)
