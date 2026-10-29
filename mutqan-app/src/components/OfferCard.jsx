import { useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'

// Light-theme offer card with real image states + visible photographer credit.
export default function OfferCard({ offer, onOrder }) {
  const [imgState, setImgState] = useState('loading')

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-3 flex gap-3 fade-up">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          {offer.tag && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">{offer.tag}</span>
          )}
          {offer.badge && (
            <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">{offer.badge}</span>
          )}
        </div>
        <h3 className="font-display font-black text-slate-900 text-sm leading-snug mb-0.5">{offer.title}</h3>
        <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">{offer.sub}</p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-black text-primary text-lg">{offer.price} <span className="text-[10px]">ر.س</span></span>
            {offer.oldPrice && <span className="text-[11px] text-slate-400 line-through">{offer.oldPrice}</span>}
          </div>
          <button
            onClick={onOrder}
            className="flex items-center gap-1 bg-primary text-white text-xs font-bold rounded-full px-3.5 py-2 active:scale-[0.96] transition-transform hover:bg-primary/90"
          >
            <Plus size={14} strokeWidth={3} />
            طلب
          </button>
        </div>
      </div>

      <div className="w-28 shrink-0 flex flex-col gap-1">
        <div className="w-28 h-24 rounded-xl overflow-hidden relative bg-slate-100">
          {imgState !== 'error' && (
            <img
              src={offer.image}
              alt={offer.title}
              onLoad={() => setImgState('ok')}
              onError={() => setImgState('error')}
              className={`w-full h-full object-cover transition-opacity ${imgState === 'ok' ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
          {imgState === 'loading' && <div className="absolute inset-0 animate-pulse bg-slate-200" />}
          {imgState === 'error' && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles size={22} className="text-primary" />
            </div>
          )}
        </div>
        {offer.photo && <p className="text-[9px] text-slate-400 leading-tight line-clamp-1">صورة: {offer.photo}</p>}
      </div>
    </div>
  )
}
