// Exports the JS sales scenarios + Makkah geography to JSON for the PHP WhatsApp bot (single source of truth = mutqan-app/src).
import { writeFileSync } from 'node:fs'
import { SALES } from '../mutqan-app/src/salesScenarios.js'
import { MAKKAH_DISTRICTS, OUTSIDE_CITIES } from '../mutqan-app/src/data/makkah.js'
const dir = new URL('../oxygen-ac-automation/includes/mutqan/data/', import.meta.url)
writeFileSync(new URL('makkah.json', dir), JSON.stringify({ districts: MAKKAH_DISTRICTS, outside: OUTSIDE_CITIES }, null, 0))
writeFileSync(new URL('sales.json', dir), JSON.stringify(SALES, null, 0))
console.log('ok')
