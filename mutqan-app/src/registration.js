import { db } from './lib/db'
import { team } from './lib/team'
import { auth } from './lib/auth'

// Customer registration (no email step in the app): the person signs in with one tap
// (Google / Apple / or the platform's own sign-in), then gives name + mobile, and the
// location is requested automatically. The customer record is keyed by the account id.

export const isValidPhone = (v) => /^[+\d][\d\s-]{7,}$/.test(String(v || '').trim())

// A session counts as a registered customer only for the SAME signed-in account and with a phone.
export function isRegistered(session, user = auth.getCurrentUser()) {
  if (!user || !session || session.type !== 'verified' || !session.phone) return false
  return !session.userId || session.userId === user.id
}

export async function saveCustomer(user, { name, phone, location, source = 'app' }) {
  const at = new Date().toISOString()
  const session = {
    type: 'verified',
    userId: user.id,
    name: name.trim(),
    phone: phone.trim(),
    location: location || null,
    consentAt: at,
    at,
  }
  try {
    const gid = await team.groupId()
    await db.upsertShared(
      'customers',
      {
        userId: user.id,
        name: session.name,
        phone: session.phone,
        location: session.location,
        verifiedAt: at,
        consentAt: at,
        source,
        conversationLinked: true,
      },
      `cust-${user.id}`,
      { groupId: gid, visibleTo: 'creator-and-admin' }
    )
  } catch {}
  return session
}
