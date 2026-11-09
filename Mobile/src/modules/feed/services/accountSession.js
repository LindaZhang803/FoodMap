import { isRecord, isStableId } from '../contracts';

/** Consume the Accounts owner's state without creating or storing a session. */
export function toFeedSession(auth) {
  if (!isRecord(auth) || auth.phase !== 'signedIn' || !isRecord(auth.user)
      || !isStableId(auth.user.id) || !isStableId(auth.token)) return null;
  return { userId: auth.user.id, token: auth.token };
}
