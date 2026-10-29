import { auth } from './auth'

const T = {
  login: 'تسجيل الدخول', signup: 'إنشاء حساب', name: 'الاسم', phone: 'رقم الجوال', password: 'كلمة المرور',
  go: 'متابعة', toSignup: 'ليس لديك حساب؟ أنشئ حسابًا', toLogin: 'لديك حساب؟ سجّل الدخول', close: 'إغلاق',
  hint: 'كلمة المرور 6 أحرف على الأقل', busy: 'لحظة…',
}
const fold = (s) => String(s || '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))

// Vanilla-DOM modal so any code path (hooks, helpers) can ask the visitor to sign in. Resolves the user or null.
export function showAuthModal(opts = {}) {
  return new Promise((resolve) => {
    let mode = opts.mode === 'signup' ? 'signup' : 'login'
    const wrap = document.createElement('div')
    wrap.dir = 'rtl'
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center;font-family:inherit'
    const card = document.createElement('form')
    card.style.cssText = 'background:#fff;width:100%;max-width:420px;border-radius:22px 22px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.2)'
    wrap.appendChild(card)
    const done = (u) => { wrap.remove(); resolve(u || null) }
    wrap.addEventListener('click', (e) => { if (e.target === wrap) done(null) })

    const field = (label, type, name, extra = {}) => {
      const l = document.createElement('label'); l.style.cssText = 'display:block;margin:10px 0 0;font-size:13px;color:#57534e;font-weight:600'
      l.textContent = label
      const i = document.createElement('input'); i.type = type; i.name = name; i.required = true
      i.style.cssText = 'display:block;width:100%;margin-top:5px;height:48px;border:1.5px solid #e7e4dd;border-radius:14px;padding:0 14px;font-size:16px;box-sizing:border-box;background:#fafaf9'
      Object.assign(i, extra); l.appendChild(i); return l
    }
    const render = () => {
      card.innerHTML = ''
      const h = document.createElement('div'); h.style.cssText = 'font-size:20px;font-weight:800;color:#1c1917'; h.textContent = mode === 'login' ? T.login : T.signup
      card.appendChild(h)
      if (mode === 'signup') card.appendChild(field(T.name, 'text', 'name', { autocomplete: 'name' }))
      card.appendChild(field(T.phone, 'tel', 'phone', { autocomplete: 'tel', inputMode: 'tel', dir: 'ltr' }))
      card.appendChild(field(T.password, 'password', 'password', { autocomplete: mode === 'login' ? 'current-password' : 'new-password', minLength: mode === 'signup' ? 6 : 1, dir: 'ltr' }))
      const err = document.createElement('div'); err.style.cssText = 'color:#dc2626;font-size:13px;min-height:18px;margin-top:8px'; err.setAttribute('role', 'alert'); card.appendChild(err)
      const go = document.createElement('button'); go.type = 'submit'; go.textContent = T.go
      go.style.cssText = 'width:100%;height:50px;border:0;border-radius:999px;background:var(--mq-primary,#0b7a75);color:#fff;font-size:16px;font-weight:700;margin-top:6px'
      card.appendChild(go)
      const sw = document.createElement('button'); sw.type = 'button'; sw.textContent = mode === 'login' ? T.toSignup : T.toLogin
      sw.style.cssText = 'display:block;width:100%;margin-top:10px;background:none;border:0;color:#57534e;font-size:14px;padding:8px'
      sw.onclick = () => { mode = mode === 'login' ? 'signup' : 'login'; render() }
      card.appendChild(sw)
      card.onsubmit = async (e) => {
        e.preventDefault(); err.textContent = ''
        const f = new FormData(card)
        go.disabled = true; go.textContent = T.busy
        try {
          const phone = fold(f.get('phone')), password = String(f.get('password') || '')
          const u = mode === 'login' ? await auth.login({ phone, password }) : await auth.signUp({ name: String(f.get('name') || '').trim(), phone, password })
          done(u)
        } catch (ex) { err.textContent = ex.message || 'تعذر إتمام العملية'; go.disabled = false; go.textContent = T.go }
      }
    }
    render(); document.body.appendChild(wrap)
    const first = card.querySelector('input'); if (first) setTimeout(() => first.focus(), 50)
  })
}
