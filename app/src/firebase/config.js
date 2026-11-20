// Worker-backed config, replacing the Firebase app config.
// Firebase is gone (see GAPS.md): auth + data come from api/client.js.
// Site identity constants stay here (page titles, invites, share links).
import { getToken, setToken } from '../api/client';

export const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://lakeviewfellowshipchurch.com';
export const CHURCH_NAME = 'Lakeview Fellowship Church';
export const CHURCH_SHORT_NAME = 'Lakeview';
export const CHURCH_NAME_ES = 'Iglesia Lakeview Fellowship';
export const CHURCH_LOCATION = 'Hudson, FL';

export const FIREBASE_PROJECT_ID = ''; // kept empty so leftover Firestore calls fail fast
export const FUNCTIONS_BASE_URL = '';

// Backwards-compat shims so legacy imports of auth/db/storage/functions don't crash at build.
// Re-wired components use api/client.js instead. db = null makes any leftover live read fail loudly.
export const auth = { currentUser: null, authStateReady: async () => {} };
export const db = null;
export const storage = null;
export const functions = null;

export default { SITE_URL, CHURCH_NAME };
export { getToken, setToken };
