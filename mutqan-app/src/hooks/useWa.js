import { useCallback, useEffect, useRef, useState } from 'react'
import { post } from '../lib/_api'
import { db } from '../lib/db'

export const waApi = (op, body = {}) => post('/wa', { op, ...body })

// Linked accounts straight from the gateway (polled only while a screen needs them).
export function useWaSessions(intervalMs = 5000) {
  const [state, setState] = useState({ sessions: [], loading: true, error: '' })
  const alive = useRef(true)
  const load = useCallback(async () => {
    try {
      const r = await waApi('sessions')
      if (alive.current) setState({ sessions: r.sessions || [], loading: false, error: '' })
    } catch (e) {
      if (alive.current) setState((s) => ({ ...s, loading: false, error: e?.message || 'تعذر الاتصال بالوسيط' }))
    }
  }, [])
  useEffect(() => {
    alive.current = true
    load()
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') load() }, intervalMs)
    return () => { alive.current = false; clearInterval(t) }
  }, [load, intervalMs])
  return { ...state, reload: load }
}

export const DEFAULT_BOT = {
  enabled: true,
  negStep: 10,
  extraDistricts: [],
  brand: 'متقن',
  welcome: 'أهلًا بك في {brand} 👋\nأنا المساعد الآلي، كيف أقدر أخدمك؟',
  menu: 'اكتب رقم الخيار:\n1️⃣ الخدمات والأسعار\n2️⃣ فيديوهات (شرح وغسيل المكيفات)\n3️⃣ مواعيد العمل\n4️⃣ طلب خدمة وتسجيل بياناتي\n5️⃣ التحدث مع موظف',
  services: 'خدماتنا: صيانة وتكييف، سباكة، كهرباء، نظافة وتعقيم، أجهزة منزلية، دهانات، غرف تبريد، خزانات، أقفال ذكية، كاميرات، ساتلايت، طاقة شمسية.\nللأسعار والعروض اطلب الخدمة (اكتب 4) وسنرسل لك التفاصيل.',
  videos: [],
  faq: [],
  hours: { start: '08:00', end: '22:00', days: [0, 1, 2, 3, 4, 5, 6], tz: 'Asia/Riyadh' },
  quick: [
    { title: 'تأكيد الاستلام', text: 'أهلًا {name}، استلمنا طلبك وجاري مراجعته الآن 🙏' },
    { title: 'طلب الموقع', text: 'تفضل بإرسال موقعك عبر واتساب (مشاركة الموقع) لنحدد أقرب فني.' },
    { title: 'السعر', text: 'سعر الخدمة يبدأ من … ويشمل الضمان. هل نحجز لك موعدًا؟' },
    { title: 'شكرًا', text: 'شكرًا لتواصلك مع متقن، نحن في خدمتك دائمًا 🌟' },
  ],
  forceAway: false,
  awayText: 'لا يتوفر موظف حاليًا، لكن نسجّل بياناتك ويتواصل معك فريقنا أول ما نبدأ الدوام.',
  handoffText: 'تم تحويل محادثتك لأحد الموظفين، وسيرد عليك قريبًا 🙏',
  doneText: 'تم تسجيل بياناتك ✅ سيتواصل معك فريقنا قريبًا.',
}

export async function saveBot(cfg) {
  await db.upsertShared('wa_bot', cfg, 'cfg', { writableBy: 'admins' })
}
