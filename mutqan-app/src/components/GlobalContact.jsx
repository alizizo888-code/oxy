import { useLocation } from 'react-router-dom'
import FloatingContact from './FloatingContact'

// Left floating contact (AI chat · WhatsApp · call · hotline) on customer pages that are outside the tab shell
// (the shell and the order page already render their own). Never on staff screens or full-screen chat.
const SHOW = [/^\/warranty/, /^\/contact/, /^\/install/, /^\/privacy/, /^\/order\//, /^\/theme/]

export default function GlobalContact() {
  const { pathname } = useLocation()
  if (!SHOW.some((r) => r.test(pathname))) return null
  return <FloatingContact bottomClass="bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]" />
}
