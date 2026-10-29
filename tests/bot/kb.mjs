import { converse } from './sim.mjs'
import { KB } from '../../mutqan-app/src/kbData.js'
let pass = 0, fail = 0
for (const e of KB) {
  for (const k of e.k.filter((x) => x.trim().includes(' '))) { // single words are intentionally ambiguous
    const r = converse([k]).last
    const ok = r.reply === e.a || r.reply.startsWith(e.a) || (e.eg && (r.reply === e.eg || r.reply.startsWith(e.eg)))
    if (ok) pass++
    else { fail++; if (fail <= 25) console.log('KB MISS', e.id, '|', k, '=>', (r.reply || '').slice(0, 60)) }
  }
}
// rolling conversation: answer then keep booking flow
{
  const x = converse(['المكيف يقطر ماء', 'بكرة العصر', { loc: 1 }, 'تمام'])
  const ok = x.results.some((r) => r.action === 'ready_to_order') && x.draft.specialtyId === 'ac'
  ok ? pass++ : (fail++, console.log('KB flow fail', x.results.map((r) => r.action).join(',')))
}
console.log(`kb: ${pass}/${pass + fail}`)
if (fail) process.exit(1)
