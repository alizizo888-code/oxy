import { post } from './_api'
// Server-side free-tier gateway (Groq / Gemini / Cloudflare / OpenRouter with automatic failover).
export const ai = {
  run: (prompt, opts = {}) => post('/ai', { prompt, opts }),
}
