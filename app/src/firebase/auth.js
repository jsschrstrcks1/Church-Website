// Worker-backed auth, matching the old firebase/auth.js export surface so the rest
// of the app needs minimal change. Real implementation lives in api/client.js.
import { apiLogin, apiLogout, apiAcceptInvite, apiMe } from '../api/client';

export const loginMember = async (email, password) => {
  try {
    const data = await apiLogin(email, password);
    if (data?.error) return { success: false, error: data.error, code: data.error };
    const me = await apiMe();
    if (me && me.accountStatus !== 'removed') return { success: true, user: { uid: me.id, email: me.email } };
    return { success: false, error: 'This account does not have access. Ask a church admin for an invite.' };
  } catch (error) {
    return { success: false, error: error.message || 'Could not sign in.', code: 'network' };
  }
};

export const logoutUser = async () => {
  try { await apiLogout(); return { success: true }; }
  catch (error) { return { success: false, error: error.message }; }
};

export const acceptInvite = async (code, email, password, name) => {
  try {
    const data = await apiAcceptInvite(code, email, password);
    if (data?.error) return { success: false, error: data.error };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const resetPassword = async (email) => {
  // Worker has no SMTP yet; return a soft success so the UI behaves (see GAPS.md).
  return { success: true, note: 'reset-email-not-wired' };
};

export const getMemberProfile = async (memberId) => {
  try {
    const me = await apiMe();
    if (me && me.id === memberId) return { success: true, profile: me };
    return { success: false, notFound: true, error: 'Member profile not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default { loginMember, logoutUser, acceptInvite, resetPassword, getMemberProfile };
