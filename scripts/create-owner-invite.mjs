#!/usr/bin/env node
// Creates an invite link that makes someone an OWNER of the members area.
//
// Use it for the very first owner (when nobody can sign in yet to send invites), or if every
// owner has lost access. After that, owners invite people from the Members page.
//
//   node scripts/create-owner-invite.mjs "Full Name" person@example.com
//
// The Firebase project id is read from .firebaserc ("default"), and the site address from
// functions/src/siteConfig.ts (SITE_URL). Override either with environment variables:
//   FIREBASE_PROJECT_ID=your-firebase-project-id SITE_URL=https://example.org node scripts/create-owner-invite.mjs ...
//
// It signs in as whoever is logged in to the Firebase CLI (`firebase login`). That account
// must have access to the Firebase project; it writes the invite with project-level access,
// which the database rules don't apply to.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readOr = (file, fallback) => { try { return readFileSync(path.join(repoRoot, file), 'utf8'); } catch { return fallback; } };

let firebaserc = {};
try { firebaserc = JSON.parse(readOr('.firebaserc', '{}')); } catch { /* fall through */ }
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || firebaserc.projects?.default;
const SITE_URL = (process.env.SITE_URL
  || readOr('functions/src/siteConfig.ts', '').match(/export const SITE_URL = '([^']+)'/)?.[1]
  || '').replace(/\/+$/, '');

if (!PROJECT_ID || PROJECT_ID === 'your-firebase-project-id') {
  console.error('Set your Firebase project id in .firebaserc ("default") or FIREBASE_PROJECT_ID first.');
  process.exit(1);
}
if (!SITE_URL) {
  console.error('Set SITE_URL in functions/src/siteConfig.ts (or the SITE_URL environment variable) first.');
  process.exit(1);
}
const INVITE_DAYS = 14;

const [name, email] = process.argv.slice(2);
if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error('Usage: node scripts/create-owner-invite.mjs "Full Name" person@example.com');
  process.exit(1);
}

// Borrow the Firebase CLI's login
const globalModules = execSync('npm root -g').toString().trim();
const require = createRequire(path.join(globalModules, 'firebase-tools', 'package.json'));
const cliAuth = require('./lib/auth.js');
const account = cliAuth.getGlobalDefaultAccount();
if (!account?.tokens?.refresh_token) {
  console.error('Not logged in to the Firebase CLI. Run `firebase login` first.');
  process.exit(1);
}
const { access_token: accessToken } = await cliAuth.getAccessToken(account.tokens.refresh_token, [
  'https://www.googleapis.com/auth/cloud-platform'
]);

const token = randomBytes(16).toString('hex');
const now = new Date();
const fields = {
  name: { stringValue: name.trim() },
  email: { stringValue: email.trim().toLowerCase() },
  role: { stringValue: 'owner' },
  invitedBy: { stringValue: 'setup-script' },
  invitedByName: { stringValue: 'Website setup' },
  createdAt: { stringValue: now.toISOString() },
  expiresAt: { stringValue: new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString() }
};

const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/invites?documentId=${token}`;
const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields })
});

if (!res.ok) {
  console.error(`Could not create the invite (HTTP ${res.status}):`);
  console.error(await res.text());
  process.exit(1);
}

console.log(`Owner invite created for ${name} <${email}> (signed in to the CLI as ${account.user?.email}).`);
console.log(`Open this link to set a password (expires in ${INVITE_DAYS} days, works once):`);
console.log(`${SITE_URL}/invite/${token}`);
