// Makkah geography for the bots (coverage check). The owner can add districts from the bot settings.
export const MAKKAH_DISTRICTS = [
  'العزيزية', 'الشوقية', 'الشرائع', 'النسيم', 'العوالي', 'الزاهر', 'الرصيفة', 'الكعكية', 'جرول', 'العتيبية', 'المسفلة', 'الحجون',
  'الهنداوية', 'الشهداء', 'النزهة', 'الخالدية', 'المعابدة', 'الششة', 'الزايدي', 'أم الجود', 'النوارية', 'الكدي', 'الجميزة',
  'التنعيم', 'الهجرة', 'بطحاء قريش', 'الرضوان', 'الفيحاء', 'العدل', 'الطندباوي', 'الراشدية', 'ريع ذاخر', 'ريع بخش', 'الزهراء',
  'الحسينية', 'الغزة', 'المنصور', 'الإسكان', 'الواسط', 'السبهاني', 'بوابة مكة', 'الوشحاء', 'الشراشف', 'الخنساء', 'الفلق', 'الروضة',
  'الورود', 'الملك فهد', 'الجودرية', 'شعب عامر', 'شعب علي', 'الخضراء', 'ولي العهد', 'الأندلس', 'التيسير', 'الخمرة',
  'الرابية', 'الشامية', 'العسيلة', 'الأجاويد', 'النورية', 'البحيرات', 'المعلاة', 'السيل', 'الحرم', 'أجياد', 'القرارة', 'الصفا',
  'المروة', 'الجعرانة', 'المشاعر', 'منى', 'عرفات', 'مزدلفة', 'الهدا', 
  'النكاسة', 
  'أم القرى', 
  
]
// Cities/regions outside Makkah (outside our direct coverage)
export const OUTSIDE_CITIES = [
  'جدة', 'الطائف', 'المدينة', 'المدينة المنورة', 'الرياض', 'الدمام', 'الخبر', 'الظهران', 'الاحساء', 'الأحساء', 'ينبع', 'رابغ',
  'القنفذة', 'الليث', 'تبوك', 'أبها', 'خميس مشيط', 'جازان', 'نجران', 'بريدة', 'القصيم', 'حائل', 'الباحة', 'الجبيل', 'عسفان',
  'بحرة', 'الجموم', 'القنفذه', 'الخرج', 'عنيزة', 'سكاكا', 'عرعر', 'القطيف', 'الكويت', 'القاهرة', 'دبي',
]
const N = (s) => String(s || '').toLowerCase().replace(/[ً-ٟـ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ئ/g, 'ي').replace(/ؤ/g, 'و').replace(/\s+/g, ' ').trim()
const strip = (s) => N(s).replace(/^ال/, '')
const has = (t, w) => new RegExp(`(?:^|\\s|ب|في|حي)${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`).test(t)

// → { inside:true, district? } | { inside:false, city } | null (unknown)
export function checkMakkahArea(text, extraDistricts = []) {
  const t = ` ${N(text)} `.trim()
  if (!t) return null
  const toMakkah = /(?:الي|الى|ل|لـ)\s*مكه/.test(t) && !/(?:الي|الى|ل)\s*(?:جده|الطائف|المدينه)/.test(t)
  for (const c of OUTSIDE_CITIES) {
    if (toMakkah) break
    const cn = N(c)
    if (has(t, cn) || has(t, strip(cn))) {
      // "الطائف" etc. — but "من مكة الى جدة" style: a stated Makkah service address wins only if "في مكة" is explicit
      if (/(?:في|ب|حي)\s*مكه/.test(t) && !has(t, 'الي ' + cn)) return { inside: true, district: null }
      return { inside: false, city: c }
    }
  }
  const all = [...MAKKAH_DISTRICTS, ...extraDistricts]
  let best = null
  for (const d of all) {
    const dn = N(d)
    if (has(t, dn) || has(t, strip(dn))) { if (!best || dn.length > N(best).length) best = d }
  }
  if (best) return { inside: true, district: best }
  if (/مكه|المكرمه/.test(t)) return { inside: true, district: null }
  return null
}
