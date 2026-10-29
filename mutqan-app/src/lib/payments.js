// No online payment provider is wired yet; the app falls back to cash / transfer flows.
const unavailable = () => Promise.reject(Object.assign(new Error('الدفع الإلكتروني غير مفعّل.'), { code: 'PAYMENTS_UNAVAILABLE' }))
export const payments = {
  status: async () => ({ available: false, connections: [] }),
  checkout: unavailable,
  hasPurchased: async () => false,
  checkoutResult: () => null,
  onPayment: () => () => {},
}
export const _internal = {}
