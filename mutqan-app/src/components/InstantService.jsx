import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Zap, MessageCircle, Phone, X } from 'lucide-react'
import { share } from '../lib/share'
import { team } from '../lib/team'
import { useSession } from '../hooks/useSession'
import { useWaNumbers, pickNumber, deptMeta } from '../hooks/useWaNumbers'
import { useContact } from '../hooks/useContact'

// "طلب خدمة فورية": a prominent button on every customer / order page. It opens a pop-up with two direct routes —
// WhatsApp (number picked from the owner's WhatsApp center) or a phone call — so an urgent customer never has to hunt.
export default function InstantService({ bottomClass = 'bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6' }) {
  const { session } = useSession()
  const { numbers } = useWaNumbers()
  const [open, setOpen] = useState(false)
  const gidRef = useRef(null)
  useEffect(() => { team.groupId().then((g) => { gidRef.current = g }).catch(() => {}) }, [])
  const enabled = numbers.filter((n) => n.enabled && n.phone)
  const contactNo = useContact()
  const waNum = contactNo.wa ? { phone: contactNo.wa, department: 'orders' } : (pickNumber(numbers, 'orders') || pickNumber(numbers, 'support') || enabled[0])
  const callers = enabled.filter((n) => n.acceptsCalls)
  const callPhone = contactNo.phone || callers[0]?.phone || waNum?.phone

  const whatsapp = () => {
    if (!waNum) return
    const who = session?.name ? ` معك ${session.name}.` : ''
    share.whatsappOrder({
      phone: waNum.phone,
      text: '🚨 أحتاج خدمة فورية الآن.' + who,
      collection: 'wa_leads',
      groupId: gidRef.current || undefined,
      record: { numberId: waNum.id, numberLabel: waNum.label || '', phone: waNum.phone, department: waNum.department, customerName: session?.name || '', customerPhone: session?.phone || '', via: 'instant', at: new Date().toISOString() },
    })
    setOpen(false)
  }
  const call = () => { if (callPhone) window.location.href = `tel:+${String(callPhone).replace(/\D/g, '')}` }

  const node = (
    <>
      <button onClick={() => setOpen(true)} aria-label="طلب خدمة فورية"
        className={`fixed right-3 md:right-6 ${bottomClass} z-[60] flex items-center gap-2 bg-gradient-to-l from-red-600 to-orange-500 text-white font-display font-black text-sm rounded-full pl-4 pr-3 py-3 shadow-xl shadow-red-400/50 ring-2 ring-white active:scale-95 transition-transform`} dir="rtl">
        <span className="relative flex w-7 h-7 items-center justify-center rounded-full bg-white/25"><span className="absolute inset-0 rounded-full bg-white/40 animate-ping" style={{ animationDuration: '1.8s' }} /><Zap size={16} className="relative" /></span>
        طلب خدمة فورية
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-5" onClick={() => setOpen(false)} dir="rtl">
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border-4 border-red-500" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-l from-red-600 to-orange-500 text-white px-5 py-4 relative">
              <button onClick={() => setOpen(false)} className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/25 flex items-center justify-center" aria-label="إغلاق"><X size={16} /></button>
              <p className="flex items-center gap-2 font-display font-black text-lg"><Zap size={20} />خدمة فورية</p>
              <p className="text-xs font-bold opacity-95 mt-1">اختر الأسرع لك — يرد عليك فريقنا مباشرة</p>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <button onClick={whatsapp} disabled={!waNum} className="flex items-center gap-3 bg-green-600 text-white rounded-2xl px-4 py-4 font-black shadow-lg disabled:opacity-50 active:scale-[0.98]">
                <span className="w-11 h-11 rounded-full bg-white/25 flex items-center justify-center"><MessageCircle size={22} /></span>
                <span className="text-right flex-1"><span className="block text-base">واتساب</span><span className="block text-[11px] font-bold opacity-90">أرسل طلبك وموقعك بضغطة</span></span>
              </button>
              <button onClick={call} disabled={!callPhone} className="flex items-center gap-3 bg-slate-900 text-white rounded-2xl px-4 py-4 font-black shadow-lg disabled:opacity-50 active:scale-[0.98]">
                <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center"><Phone size={22} /></span>
                <span className="text-right flex-1"><span className="block text-base">اتصال مباشر</span><span className="block text-[11px] font-bold opacity-90">تكلّم مع موظف الآن</span></span>
              </button>
              {!waNum && !callPhone && <p className="text-xs font-black text-rose-700 text-center">أرقام التواصل لم تُضف بعد.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
  // Portal to <body>: never clipped / re-positioned by a page's own scroll container, transform or stacking context (the home page).
  return typeof document !== 'undefined' ? createPortal(node, document.body) : node
}
