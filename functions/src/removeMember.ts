/**
 * Removes a member's access (owners only).
 *
 * The member's sign-in is disabled and their profile is marked accountStatus 'removed'.
 * Nothing they made is deleted: their published newsletters and share page stay online
 * until someone unpublishes them. restore: true gives access back.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { ALLOWED_ORIGINS } from './siteConfig';

export const removeMember = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Please sign in.');
  }

  const { memberId, restore } = (request.data || {}) as { memberId?: string; restore?: boolean };
  if (typeof memberId !== 'string' || !memberId) {
    throw new HttpsError('invalid-argument', 'memberId is required.');
  }
  if (memberId === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'You cannot remove your own account.');
  }

  const db = admin.firestore();
  const callerDoc = await db.collection('members').doc(request.auth.uid).get();
  const caller = callerDoc.data();
  if (!caller || caller.accountStatus === 'removed' || caller.role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only church owners can remove members.');
  }

  const memberRef = db.collection('members').doc(memberId);
  if (!(await memberRef.get()).exists) {
    throw new HttpsError('not-found', 'That member was not found.');
  }

  await admin.auth().updateUser(memberId, { disabled: !restore });
  if (!restore) {
    // Sign them out everywhere right away
    await admin.auth().revokeRefreshTokens(memberId);
  }
  await memberRef.update({
    accountStatus: restore ? 'active' : 'removed',
    updatedAt: new Date().toISOString(),
    [restore ? 'restoredBy' : 'removedBy']: request.auth.uid
  });

  return { success: true };
});
