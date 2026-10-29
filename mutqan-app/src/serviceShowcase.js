// Rotating banner + inner specialty gallery content: per specialty, a title,
// the service lines shown under the fixed brand, and its photos (with credit).
const U = (id, by) => ({ url: `https://images.unsplash.com/photo-${id}?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080`, by })
const G = (url) => ({ url, by: null })

const COLD_ROOM = 'https://api.whacka.app/storage/v1/object/public/app-images/projects/6091a294-0698-4912-aed8-5d8bf79f5db9/gen-84d5e90e-1790738541529.png'
const TANK = 'https://api.whacka.app/storage/v1/object/public/app-images/projects/6091a294-0698-4912-aed8-5d8bf79f5db9/gen-443d14cb-1790738541899.png'

export const SHOWCASE = {
  plumbing: {
    title: 'السباكة', icon: '🚿',
    lines: ['صيانة وتركيب', 'توريد وتركيب قطع الغيار', 'كشف ومعالجة التسربات'],
    images: [U('1613839397604-65fffe7fc3d4', 'Memento Media'), U('1542855368-ca6ea825bca2', 'Sasikan Ulevik'), U('1737874132953-b39a4812875d', 'Rodrigo Kambara')],
  },
  electric: {
    title: 'الكهرباء', icon: '⚡',
    lines: ['تأسيس وتركيب', 'تركيب وإصلاح اللمبات', 'إصلاح أعطال الكهرباء', 'تأسيس اللوحات'],
    images: [U('1621905251189-08b45d6a269e', 'Emmanuel Ikwuegbu'), U('1635335874521-7987db781153', 'mostafa mahmoudi'), U('1718221621618-e477ce33485a', 'Bernd Dittrich'), U('1660330589827-da8ab7dd3c02', 'Raze Solar')],
  },
  fridge: {
    title: 'غرف التبريد والتجميد', icon: '🧊',
    lines: ['صيانة وتركيب غرف التبريد والتجميد', 'إصلاح الآيس ميكر', 'إصلاح أعطال الثلاجات والفريزرات'],
    images: [G(COLD_ROOM), U('1721613877687-c9099b698faa', 'Lisa Anna')],
  },
  ac: {
    title: 'التكييف', icon: '❄️',
    lines: ['صيانة المركزي والسبليت والشباك والدكت', 'غسيل وتعبئة فريون', 'فك وتركيب المكيفات'],
    images: [U('1718203862467-c33159fdc504', 'Everett Pachmann'), U('1776860150250-757406c52438', 'alpha innotec'), U('1642749776312-aa42ce20c9f5', 'Singapore Stock Photos')],
  },
  locks: {
    title: 'الأقفال الذكية', icon: '🔐',
    lines: ['توريد وتركيب الأقفال الذكية', 'برمجة وصيانة الأقفال'],
    images: [U('1558002038-1055907df827', 'Sebastian Scholz (Nuki)'), U('1634224143538-ce0221abf732', 'rc.xyz NFT gallery')],
  },
  appliances: {
    title: 'الأجهزة المنزلية', icon: '🧺',
    lines: ['صيانة الغسالات والأفران والسخانات', 'إصلاح الثلاجات المنزلية'],
    images: [U('1610557892470-55d9e80c0bce', 'engin akyurt'), U('1721613877687-c9099b698faa', 'Lisa Anna')],
  },
  satellite: {
    title: 'الساتلايت والدش', icon: '📡',
    lines: ['تركيب الأطباق والرسيفرات', 'ضبط وتوجيه القنوات'],
    images: [U('1654590150782-433e403a2e32', 'Tobias Arweiler'), U('1554977642-e557d4ca82d4', 'Gilles Rolland-Monnet')],
  },
  paint: {
    title: 'الدهانات والديكور', icon: '🎨',
    lines: ['دهانات داخلية وخارجية', 'ورق جدران وديكورات'],
    images: [U('1562259949-e8e7689d7828', 'Theme Photos'), U('1770988962875-1a9f50e56eb6', 'Clay Banks')],
  },
  tiling: {
    title: 'التبليط والترميم', icon: '🧱',
    lines: ['تبليط السيراميك والبورسلان', 'ترميم وعزل'],
    images: [U('1731185752376-a4cf3e8556fa', 'Ernys'), U('1647102256335-7a7370d99924', 'Richard Bell')],
  },
  cameras: {
    title: 'كاميرات المراقبة', icon: '📹',
    lines: ['توريد وتركيب الكاميرات', 'أنظمة الأمن والمراقبة'],
    images: [U('1589935447067-5531094415d1', 'Michał Jakubowski'), U('1528312635006-8ea0bc49ec63', 'Pawel Czerwinski')],
  },
  cleaning: {
    title: 'التنظيف والتعقيم', icon: '🧽',
    lines: ['تنظيف عميق وتعقيم', 'تنظيف السجاد والكنب بالبخار'],
    images: [U('1740657254989-42fe9c3b8cce', 'PuroClean of Fort Worth'), U('1686178827149-6d55c72d81df', 'Giorgio Trovato')],
  },
  pest: {
    title: 'مكافحة الحشرات', icon: '🐜',
    lines: ['رش ومكافحة الحشرات', 'تعقيم بضمان'],
    images: [U('1581578017093-cd30fce4eeb7', 'CDC')],
  },
  tanks: {
    title: 'خزانات المياه', icon: '🚰',
    lines: ['تنظيف وتعقيم الخزانات', 'عزل ومعالجة التسربات'],
    images: [G(TANK), U('1638294834907-d11608bc11d2', 'VD Photography')],
  },
  moving: {
    title: 'نقل الأثاث', icon: '📦',
    lines: ['فك ونقل وتركيب', 'تغليف وتخزين'],
    images: [U('1714647211902-bb711d643a17', 'Vitaly Gariev'), U('1700165644892-3dd6b67b25bc', 'Luke Heibert')],
  },
  solar: {
    title: 'الطاقة الشمسية', icon: '☀️',
    lines: ['تركيب الأنظمة الشمسية', 'صيانة الألواح والبطاريات'],
    images: [U('1613665813446-82a78c468a1d', 'Nuno Marques'), U('1668097613572-40b7c11c8727', 'Markus Spiske')],
  },
  corporate: {
    title: 'خدمات الشركات', icon: '🏢',
    lines: ['عقود صيانة المنشآت', 'فنادق ومطاعم ومصانع'],
    images: [U('1748027869634-fc2e545cfb0c', 'Citadel Life Safety'), U('1581094488379-6a10d04c0f04', 'ThisisEngineering')],
  },
  general: {
    title: 'الصيانة العامة', icon: '🛠️',
    lines: ['نجارة وسباكة وكهرباء', 'أعمال صيانة متنوعة'],
    images: [U('1562259929-b4e1fd3aef09', 'Theme Photos'), U('1589939705384-5185137a7f0f', 'Jeriden Villegas')],
  },
  contracting: {
    title: 'المقاولات العامة', icon: '🏗️',
    lines: ['إشراف هندسي', 'عمالة وتنفيذ المشاريع'],
    images: [U('1541888946425-d81bb19240f5', 'Scott Blake'), U('1664662568348-24b1482b6354', 'Thatselby')],
  },
}

// Banner order: plumbing → electricity → cold rooms → then every other specialty
export const BANNER_ORDER = ['plumbing', 'electric', 'fridge', 'ac', 'locks', 'appliances', 'cameras', 'paint', 'tiling', 'satellite', 'cleaning', 'pest', 'tanks', 'moving', 'solar', 'corporate', 'general', 'contracting']

export const showcaseFor = (id) => SHOWCASE[id] || null
