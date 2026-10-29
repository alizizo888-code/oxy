import { INTENTS, norm } from '../../mutqan-app/src/botData.js'
const text = process.argv[2]; const t = norm(text); const toks = t.split(' ')
const padded = ` ${t} `
for (const [k, arr] of Object.entries(INTENTS)) for (const p0 of arr) { const p = norm(p0); const pt = p.split(' ')
  if (padded.includes(` ${p} `)) console.log(k, 'EXACT', p)
  else if (pt.length >= 2 && pt.every((w) => toks.some((x) => x === w))) console.log(k, 'ALLTOK', p) }
