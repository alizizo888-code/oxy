import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { SPECIALTIES } from '../constants'

// Browser-tab title that always carries the specialty the visitor is browsing: «page · specialty — brand».
// The specialty comes from /s/:id, ?specialty=, or the last one visited in this tab; the home page clears it.
const BRAND = 'متقن MUTQAN'
const KEY = 'mq_spec'
const PAGES = {
  '/': 'الرئيسية', '/services': 'الخدمات', '/offers': 'العروض', '/store': 'المتجر', '/orders': 'طلباتي', '/account': 'حسابي',
  '/calculator': 'الحاسبة', '/more': 'المزيد', '/articles': 'المقالات', '/new': 'طلب خدمة', '/ai': 'المساعد الذكي', '/contact': 'تواصل معنا',
  '/warranty': 'ضماناتي', '/install': 'تثبيت التطبيق', '/privacy': 'الخصوصية', '/notifications': 'الإشعارات', '/theme': 'المظهر', '/join-tech': 'انضم كفني',
}
const get = () => { try { return sessionStorage.getItem(KEY) || '' } catch { return '' } }
const set = (v) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY) } catch { /* ignore */ } }

export const rememberSpecialty = (id) => { if (id && SPECIALTIES.some((x) => x.id === id)) { set(id); try { window.dispatchEvent(new Event('mq-spec')) } catch { /* ignore */ } } }

export default function TitleBoot() {
  const loc = useLocation()
  const [tick, setTick] = useState(0)
  useEffect(() => { const f = () => setTick((n) => n + 1); window.addEventListener('mq-spec', f); return () => window.removeEventListener('mq-spec', f) }, [])
  useEffect(() => {
    const path = loc.pathname.replace(/\/+$/, '') || '/'
    const q = new URLSearchParams(loc.search)
    const m = path.match(/^\/s\/([^/]+)/)
    const id = (m && m[1]) || q.get('specialty') || ''
    if (id && SPECIALTIES.some((s) => s.id === id)) set(id)
    else if (path === '/') set('')
    const sp = SPECIALTIES.find((s) => s.id === get())
    const staff = path.startsWith('/staff')
    const page = PAGES[path] || (path.startsWith('/order/') ? 'تفاصيل الطلب' : staff ? 'لوحة العمل' : '')
    const parts = [page, !staff && sp ? sp.label : ''].filter(Boolean)
    document.title = parts.length ? `${parts.join(' · ')} — ${BRAND}` : `${BRAND} — صيانة ومقاولات`
  }, [loc.pathname, loc.search, tick])
  return null
}
