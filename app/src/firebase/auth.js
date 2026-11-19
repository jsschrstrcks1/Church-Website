// Sign-in helpers for church member accounts.
// Accounts are invitation only: there is no public sign-up. An account is created by the
// acceptInvite Cloud Function when someone opens their invite link and picks a password.
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './config';

export const loginMember = async (email, password) => {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const memberRef = doc(db, 'members', user.uid);
    const memberDoc = await getDoc(memberRef);

    if (!memberDoc.exists() || memberDoc.data().accountStatus === 'removed') {
      await signOut(auth);
      return { success: false, error: 'This account does not have access. Ask a church admin for an invite.' };
    }

    await updateDoc(memberRef, { lastLoginAt: new Date().toISOString() });
    return { success: true, user };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message, code: error.code };
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
};

export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: false, error: error.message };
  }
};

export const getMemberProfile = async (memberId) => {
  try {
    const docSnap = await getDoc(doc(db, 'members', memberId));
    if (docSnap.exists()) {
      return { success: true, profile: { id: docSnap.id, ...docSnap.data() } };
    }
    return { success: false, notFound: true, error: 'Member profile not found' };
  } catch (error) {
    console.error('Error fetching member profile:', error);
    return { success: false, notFound: false, error: error.message };
  }
};
