import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search, Newspaper, RefreshCw, ExternalLink, Loader2 } from 'lucide-react'
import { API_BASE } from '../../lib/_api'

// Published articles of this site (real WordPress posts): newest, recently updated, oldest.
const WP = API_BASE.replace(/\/mutqan\/v1$/, '')
const fmt = (d) => { try { return new Date(d).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return '' } }
const clean = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&#8211;|&ndash;/g, '–').replace(/&#038;|&amp;/g, '&').replace(/&#8217;/g, '’').replace(/&quot;/g, '"')

export default function Articles() {
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [err, setErr] = useState(false)
  const [tab, setTab] = useState('new')
  const [q, setQ] = useState('')
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const all = []
        for (let page = 1; page <= 10; page++) {
          const r = await fetch(`${WP}/wp/v2/posts?per_page=100&page=${page}&_fields=id,link,title,date,modified`)
          if (!r.ok) break
          const rows = await r.json()
          all.push(...rows)
          if (rows.length < 100) break
        }
        if (live) setItems(all.map((p) => ({ id: p.id, link: p.link, title: clean(p.title?.rendered), date: p.date, modified: p.modified })))
      } catch { if (live) { setErr(true); setItems([]) } }
    })()
    return () => { live = false }
  }, [])
  const list = useMemo(() => {
    const t = q.trim()
    let a = (items || []).filter((x) => !t || x.title.includes(t))
    if (tab === 'new') a = [...a].sort((x, y) => (y.date > x.date ? 1 : -1))
    else if (tab === 'upd') a = [...a].filter((x) => x.modified.slice(0, 10) !== x.date.slice(0, 10)).sort((x, y) => (y.modified > x.modified ? 1 : -1))
    else a = [...a].sort((x, y) => (x.date > y.date ? 1 : -1))
    return a
  }, [items, tab, q])
  const tabs = [['new', 'الأحدث'], ['upd', 'المحدَّثة'], ['old', 'الأقدم']]
  return (
    <div className="h-full overflow-y-auto pb-32 md:pb-10" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#e8f5f2]/90 backdrop-blur-xl pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="رجوع" className="w-9 h-9 rounded-full bg-white border border-sky-100 shadow-sm flex items-center justify-center"><ChevronRight size={18} /></button>
          <div className="flex-1"><h1 className="font-display font-black text-base text-slate-900 flex items-center gap-2"><Newspaper size={18} className="text-sky-600" />المقالات</h1><p className="text-[11px] text-slate-500">{items ? `${items.length} مقال منشور` : 'جارِ التحميل…'}</p></div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 flex flex-col gap-2">
          <div className="relative"><Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في المقالات" className="w-full bg-white border-2 border-sky-100 rounded-full pr-9 pl-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-400" /></div>
          <div className="grid grid-cols-3 gap-2">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-full py-2 text-xs font-black border-2 ${tab === k ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-sky-200 text-sky-700'}`}>{l}</button>)}</div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 flex flex-col gap-2.5">
        {!items && <div className="py-10 flex justify-center text-sky-600"><Loader2 className="animate-spin" /></div>}
        {items && !list.length && <p className="py-10 text-center text-sm font-bold text-slate-500">{err ? 'تعذر تحميل المقالات الآن.' : tab === 'upd' ? 'لا توجد مقالات محدَّثة بعد.' : 'لا توجد مقالات مطابقة.'}</p>}
        {list.map((a) => (
          <a key={a.id} href={a.link} className="bg-white border-2 border-sky-100 rounded-2xl p-3.5 shadow-sm active:scale-[0.99] transition-transform flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0"><Newspaper size={17} /></span>
            <span className="flex-1 min-w-0">
              <span className="block font-display font-black text-sm text-slate-900 leading-snug">{a.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] font-bold text-slate-500"><span>نُشرت {fmt(a.date)}</span>{a.modified.slice(0, 10) !== a.date.slice(0, 10) && <span className="flex items-center gap-1 text-emerald-700"><RefreshCw size={10} />حُدّثت {fmt(a.modified)}</span>}</span>
            </span>
            <ExternalLink size={14} className="text-slate-400 mt-1 shrink-0" />
          </a>
        ))}
      </div>
    </div>
  )
}
