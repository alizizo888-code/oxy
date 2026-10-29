import { Component } from 'react'
import { logError, hardRefresh, autoRepairOnce, CHUNK_RE } from '../lib/recover'

export default class ErrorBoundary extends Component {
  state = { err: null, tries: 0 }
  timer = null
  onHash = () => { if (this.state.err || this.state.tries) this.setState({ err: null, tries: 0 }) }
  componentDidMount() { window.addEventListener('hashchange', this.onHash) }
  componentWillUnmount() { window.removeEventListener('hashchange', this.onHash); clearTimeout(this.timer) }
  static getDerivedStateFromError(err) { return { err } }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null, tries: 0 }) }
  componentDidCatch(err) {
    logError(err, 'render')
    // Silent self-heal: retry the render up to twice; if it keeps failing go to the home screen, never show the error first
    if (this.state.tries < 2) {
      clearTimeout(this.timer)
      this.timer = setTimeout(() => this.setState((s) => ({ err: null, tries: s.tries + 1 })), 250)
    } else if (!sessionStorage.getItem('mq_soft_home')) {
      try { sessionStorage.setItem('mq_soft_home', '1'); location.hash = '#/'; this.timer = setTimeout(() => this.setState({ err: null, tries: 0 }), 300) } catch { /* ignore */ }
    }
    if (CHUNK_RE.test(String(err?.message))) { this.repairing = autoRepairOnce('chunk-load'); if (this.repairing) return }
  }
  render() {
    if (!this.state.err) return this.props.children
    if (this.repairing || this.state.tries < 2) return null // silent while self-healing / refreshing to the new build
    return (
      <div dir="rtl" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#071a33', color: '#fff', fontFamily: 'Tajawal, Tahoma, sans-serif', textAlign: 'center' }}>
        <div style={{ maxWidth: 340 }}>
          <div style={{ fontSize: 44 }}>🛠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: '8px 0' }}>حصل خلل بسيط في الشاشة</h1>
          <p style={{ fontSize: 13, opacity: .8, lineHeight: 1.7 }}>بياناتك محفوظة. جرّب إعادة المحاولة، وإن استمر الخلل اضغط «إصلاح وإعادة التشغيل».</p>
          <button onClick={() => this.setState({ err: null })} style={{ marginTop: 14, width: '100%', padding: 13, borderRadius: 14, border: 0, background: '#38bdf8', color: '#04121f', fontWeight: 900, fontSize: 14 }}>إعادة المحاولة</button>
          <button onClick={hardRefresh} style={{ marginTop: 10, width: '100%', padding: 13, borderRadius: 14, border: '1px solid rgba(255,255,255,.3)', background: 'transparent', color: '#fff', fontWeight: 800, fontSize: 14 }}>إصلاح وإعادة التشغيل</button>
          <p style={{ marginTop: 14, fontSize: 10, opacity: .5, direction: 'ltr', wordBreak: 'break-all' }}>{String(this.state.err?.message || this.state.err).slice(0, 160)}</p>
        </div>
      </div>
    )
  }
}
