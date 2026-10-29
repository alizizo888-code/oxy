import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingBag, Sparkles, Wrench } from 'lucide-react'
import { useLiveShared } from '../../lib/useLive'

export default function Store() {
  const navigate = useNavigate()
  const { data: products, loading } = useLiveShared('products', { order: '-createdAt', limit: 50 })

  return (
    <div className="h-full overflow-y-auto pb-32 md:pb-10" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#eaf3fc]/85 backdrop-blur-xl border-b border-sky-100/60 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-4xl mx-auto w-full px-4 py-4">
          <h1 className="font-display text-lg font-black text-slate-900">المتجر</h1>
          <p className="text-[11px] text-slate-500">أجهزة ومعدات أصلية مع التوريد والتركيب والضمان</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto w-full px-4 pt-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="h-56 rounded-2xl bg-white border border-black/5 animate-pulse" />
            <div className="h-56 rounded-2xl bg-white border border-black/5 animate-pulse" />
          </div>
        ) : (products || []).length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-3xl bg-white border border-black/5 shadow-sm flex items-center justify-center mx-auto mb-4">
              <ShoppingBag size={26} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-500">المتجر يُجهَّز الآن</p>
            <p className="text-[11px] text-slate-400 mt-1">سنضيف الأجهزة والمعدات قريبًا</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(products || []).map((p, i) => (
              <ProductCard key={p.id} product={p} onOrder={() => navigate(`/new?product=${p.key || p.id}`)} delay={i * 50} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProductCard({ product, onOrder, delay }) {
  const [imgState, setImgState] = useState('loading')
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden fade-up hover:shadow-md transition-shadow" style={{ animationDelay: `${delay}ms` }}>
      <div className="h-36 relative bg-slate-100">
        {imgState !== 'error' && (
          <img
            src={product.image}
            alt={product.name}
            onLoad={() => setImgState('ok')}
            onError={() => setImgState('error')}
            className={`w-full h-full object-cover transition-opacity ${imgState === 'ok' ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {imgState === 'loading' && <div className="absolute inset-0 animate-pulse bg-slate-200" />}
        {imgState === 'error' && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
            <Sparkles size={26} className="text-primary" />
          </div>
        )}
        {product.badge && (
          <span className="absolute top-2 right-2 text-[10px] font-bold text-white bg-primary rounded-full px-2 py-0.5">{product.badge}</span>
        )}
      </div>
      <div className="p-3.5 flex flex-col gap-1.5">
        <h3 className="font-display font-black text-slate-900 text-sm">{product.name}</h3>
        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{product.desc}</p>
        {product.photo && <p className="text-[9px] text-slate-400">صورة: {product.photo}</p>}
        <div className="flex items-center justify-between gap-2 mt-1.5">
          {product.price ? (
            <span className="font-display font-black text-primary text-lg">{product.price} <span className="text-[10px]">ر.س</span></span>
          ) : (
            <span className="text-xs font-bold text-slate-500">السعر بعد المعاينة</span>
          )}
          <button
            onClick={onOrder}
            className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-bold rounded-full px-3.5 py-2 active:scale-[0.96] transition-transform hover:bg-primary/20"
          >
            <Wrench size={13} />
            اطلب مع التركيب
          </button>
        </div>
      </div>
    </div>
  )
}
