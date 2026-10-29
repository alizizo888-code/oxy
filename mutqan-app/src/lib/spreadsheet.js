// CSV / TSV reader for bulk team import (Excel: save as CSV first).
function parse(text, delim) {
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c }
    else if (c === '"') q = true
    else if (c === delim) { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = [] }
    else cur += c
  }
  row.push(cur); if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}
export async function readSpreadsheet(file) {
  if (/\.xlsx?$/i.test(file.name || '')) throw new Error('احفظ الملف بصيغة CSV من إكسل ثم ارفعه.')
  const text = (await file.text()).replace(/^﻿/, '')
  const first = text.split(/\r?\n/, 1)[0] || ''
  const delim = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ','
  const table = parse(text, delim)
  if (!table.length) return { columns: [], rows: [] }
  const columns = table[0].map((c, i) => (c.trim() || `col${i + 1}`))
  const rows = table.slice(1).map((r) => Object.fromEntries(columns.map((c, i) => [c, (r[i] || '').trim()])))
  return { columns, rows }
}
export const spreadsheet = { read: readSpreadsheet }
