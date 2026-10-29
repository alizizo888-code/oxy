import { currentUser, getAnonId } from './_api'
export const getAppUserId = () => currentUser()?.id || null
export const getAnonymousId = getAnonId
