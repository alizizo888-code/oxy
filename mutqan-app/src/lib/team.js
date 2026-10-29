import { post, setSession, currentUser } from './_api'

const op = (name, body) => post('/team', { op: name, ...(body || {}) })
const unwrap = (k) => (r) => (r && k in r ? r[k] : r)

async function enter(r) {
  setSession(r.token, r.user)
  return { user: r.user, role: r.user?.role || null }
}

export const team = {
  groupId: () => op('groupId').then((r) => r.value),
  config: () => op('config'),
  canManage: () => op('canManage').then((r) => !!r.value).catch(() => false),
  currentMember: () => op('currentMember').then((r) => r.member),
  login: async ({ handle, password }) => enter(await op('login', { handle, password })),
  loginRoster: () => op('loginRoster'),
  inviteInfo: (code) => op('inviteInfo', { code }),
  acceptInvite: async (args) => enter(await op('acceptInvite', args)),
  requestAccess: (args) => op('requestAccess', args),

  listMembersPage: (a = {}) => op('listMembersPage', a),
  listPending: () => op('listPending').then(unwrap('list')),
  createMember: (a) => op('createMember', a),
  bulkCreateMembers: (rows) => op('bulkCreateMembers', { rows }).then(unwrap('results')),
  createInvite: (a) => op('createInvite', a),
  revokeInvite: (code) => op('revokeInvite', { code }),
  listInvitesPage: (a = {}) => op('listInvitesPage', a),
  approveMember: (userId, role) => op('approveMember', { userId, role }),
  rejectMember: (userId) => op('rejectMember', { userId }),
  rejectAllPending: () => op('rejectAllPending'),
  setRole: (userId, role) => op('setRole', { userId, role }),
  disableMember: (userId) => op('disableMember', { userId }),
  enableMember: (userId) => op('enableMember', { userId }),
  deleteMember: (userId) => op('deleteMember', { userId }),
  resetPassword: (userId) => op('resetPassword', { userId }),
  getRolePowers: () => op('getRolePowers'),
  setRolePowers: (role, powers) => op('setRolePowers', { role, powers }),
  setSelfSignup: (value) => op('setSelfSignup', { value }),
  setLoginConfig: (cfg) => op('setLoginConfig', cfg),
  syncRoles: async () => ({ changed: false }),

  // Modal entry points (loaded lazily so this module has no React dependency)
  async signIn(options) { const m = await import('../components/TeamLogin'); return m.openTeamLogin ? m.openTeamLogin(options) : null },
  async openAdmin(options) { const m = await import('../components/TeamAdmin'); return m.openTeamAdmin ? m.openTeamAdmin(options) : null },
  me: () => currentUser(),
}
