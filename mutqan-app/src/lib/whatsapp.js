import { get } from './_api'
export const whatsapp = {
  isConnected: () => get('/config').then((c) => !!(c && c.whatsapp && c.whatsapp.connected)).catch(() => false),
}
