// Firebase setup for the church app, plus the church's name and website address.
//
// EDIT: this is the one file to change when you set up your own copy.
//   1. Replace the firebaseConfig values below with your project's web app settings, from
//      Firebase console -> Project settings -> General -> Your apps (add a Web app if there is none).
//      These web settings are public by design: every visitor's browser receives them.
//      What protects the data is firestore.rules and storage.rules, not this file.
//   2. Set CHURCH_NAME / CHURCH_SHORT_NAME / CHURCH_NAME_ES / CHURCH_LOCATION and SITE_URL further down.
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// EDIT: your Firebase project's web app settings (Firebase console -> Project settings -> Your apps)
const firebaseConfig = {
  apiKey: 'YOUR_FIREBASE_WEB_API_KEY',
  authDomain: 'your-firebase-project-id.firebaseapp.com',
  projectId: 'your-firebase-project-id',
  storageBucket: 'your-firebase-project-id.firebasestorage.app',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_FIREBASE_APP_ID'
};

// Cloud Functions are called at this address (derived from projectId above; region us-central1)
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FUNCTIONS_BASE_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net`;

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Stay signed in until the person logs out
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Error setting auth persistence:', error);
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

// `VITE_USE_FIREBASE_EMULATOR=true npm run dev` talks to the local emulators instead of the live project
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  console.log('Connected to Firebase emulators');
}

// EDIT: the church's public site address (no trailing slash), used when building share and invite links
export const SITE_URL = 'https://example.org';

// EDIT: the church's name, shown in page titles, headers, footers, emails and stream defaults
export const CHURCH_NAME = 'Your Church Name';
export const CHURCH_SHORT_NAME = 'Your Church'; // used where space is tight (phone headers)
export const CHURCH_NAME_ES = 'Su Iglesia'; // Spanish name, used in bilingual text
export const CHURCH_LOCATION = 'Your City, ST'; // shown under the name in newsletters and footers

export default app;
