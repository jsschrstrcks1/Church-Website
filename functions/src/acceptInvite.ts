/**
 * Accepts an invitation and creates the member's account.
 *
 * Accounts are invitation only. An owner creates invites/{token} in the Members page; the
 * invitee opens /invite/{token}, picks a password, and the app calls this function, which:
 *   1. checks the invite exists and hasn't expired
 *   2. creates the Firebase Auth account (email from the invite, password from the invitee)
 *   3. creates members/{uid} (private profile) and publicMembers/{uid} (name for public pages)
 *   4. deletes the used invite
 *
 * It runs with admin rights, so the new person never needs write access to their own role.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { ALLOWED_ORIGINS } from './siteConfig';

interface AcceptInviteData {
  inviteToken: string;
  password: string;
}

export const acceptInvite = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  const { inviteToken, password } = (request.data || {}) as AcceptInviteData;

  if (typeof inviteToken !== 'string' || !inviteToken || typeof password !== 'string' || !password) {
    throw new HttpsError('invalid-argument', 'The invite link and a password are required.');
  }
  if (password.length < 8) {
    throw new HttpsError('invalid-argument', 'Password must be at least 8 characters.');
  }

  const db = admin.firestore();
  const inviteRef = db.collection('invites').doc(inviteToken);
  const inviteDoc = await inviteRef.get();

  if (!inviteDoc.exists) {
    throw new HttpsError('not-found', 'This invite link is invalid or has already been used.');
  }

  const invite = inviteDoc.data()!;
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    throw new HttpsError('failed-precondition', 'This invite link has expired. Ask a church admin for a new one.');
  }
  if (!invite.email || !invite.name) {
    throw new HttpsError('failed-precondition', 'This invite is missing information. Ask a church admin for a new one.');
  }

  const role = invite.role === 'owner' ? 'owner' : 'admin';

  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await admin.auth().createUser({
      email: invite.email,
      password,
      displayName: invite.name
    });
  } catch (error: any) {
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'An account with this email already exists. Try signing in, or use "Forgot password".');
    }
    if (error.code === 'auth/invalid-email') {
      throw new HttpsError('invalid-argument', 'The email address on this invite is not valid. Ask a church admin for a new invite.');
    }
    if (error.code === 'auth/invalid-password') {
      throw new HttpsError('invalid-argument', 'That password is too weak. Try a longer one.');
    }
    console.error('Error creating account from invite:', error);
    throw new HttpsError('internal', 'Could not create the account. Please try again.');
  }

  const uid = userRecord.uid;
  const now = new Date().toISOString();

  try {
    const batch = db.batch();
    batch.set(db.collection('members').doc(uid), {
      uid,
      name: invite.name,
      email: invite.email,
      role,
      accountStatus: 'active',
      invitedBy: invite.invitedBy || '',
      invitedByName: invite.invitedByName || '',
      invitedAt: invite.createdAt || '',
      createdAt: now,
      updatedAt: now
    });
    batch.set(db.collection('publicMembers').doc(uid), { name: invite.name, updatedAt: now });
    batch.delete(inviteRef);
    await batch.commit();
  } catch (error) {
    // Don't leave a login with no profile behind
    await admin.auth().deleteUser(uid).catch(() => undefined);
    console.error('Error saving member profile:', error);
    throw new HttpsError('internal', 'Could not finish setting up the account. Please try again.');
  }

  return { success: true, email: invite.email };
});
