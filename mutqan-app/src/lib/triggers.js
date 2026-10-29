// Server-side automation triggers are not used; status notifications are sent by the app itself (notify.js).
const triggers = {
  list: async () => [],
  create: async () => ({ id: 'local' }),
  remove: async () => ({ ok: true }),
}
export { triggers }
export default triggers
