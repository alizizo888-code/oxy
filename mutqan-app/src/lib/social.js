import { currentUser } from './_api'
import { team } from './team'

// Whacka "groups" collapse to one fixed team; roles come from the signed-in user's server-side role.
export const social = {
  getMyRole: async () => currentUser()?.role || null,
  claimGroupOwnership: async () => ({ ok: true }),
  setAdminRoles: async () => ({ ok: true }),
  inviteToGroup: async () => ({ ok: true }),
  setRole: async (_gid, userId, role) => team.setRole(userId, role),
  async getGroupMembers() {
    const out = []
    let cursor
    for (let i = 0; i < 10; i++) {
      const page = await team.listMembersPage(cursor ? { cursor } : {})
      out.push(...(page.members || []))
      if (!page.hasMore) break
      cursor = page.nextCursor
    }
    return out
  },
}
