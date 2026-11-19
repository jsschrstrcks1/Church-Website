/**
 * Site settings used by the Cloud Functions.
 *
 * EDIT these for your church before deploying:
 *   SITE_URL         the public address of your website (no trailing slash). The YouTube and
 *                    Facebook sign-in redirect URIs are built from it:
 *                      ${SITE_URL}/youtube-callback and ${SITE_URL}/facebook-callback
 *                    and must match what you register in Google Cloud and the Meta app.
 *   FIREBASE_PROJECT_ID  your Firebase project id (same as the "default" in .firebaserc)
 *   CHURCH_NAME      shown as the "From" name on emails and in default live stream titles
 *   TIME_ZONE        your church's time zone (IANA name, e.g. America/New_York), used for the
 *                    date in default live stream titles
 */

// EDIT: your website's address
export const SITE_URL = 'https://example.org';

// EDIT: your Firebase project id
export const FIREBASE_PROJECT_ID = 'your-firebase-project-id';

// EDIT: your church's name
export const CHURCH_NAME = 'Your Church Name';

// EDIT: your church's time zone
export const TIME_ZONE = 'America/Denver';

// Live Studio page (where YouTube/Facebook sign-ins send people back to)
export const STUDIO_URL = `${SITE_URL}/admin/live`;

// Callable functions accept requests only from the church's own sites (and local development).
// EDIT: add or remove addresses if your site uses other domains (e.g. drop "www." if you don't use it).
export const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  `https://${FIREBASE_PROJECT_ID}.web.app`,
  `https://${FIREBASE_PROJECT_ID}.firebaseapp.com`,
  SITE_URL,
  SITE_URL.replace('https://', 'https://www.')
];
