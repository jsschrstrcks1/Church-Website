/**
 * Optional email sending (newsletter form and RSVP notifications).
 *
 * Email is off until a Gmail account and an app password are put in functions/.env:
 *   GMAIL_USER=your.church.account@gmail.com
 *   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
 * and the functions are redeployed. (functions/.env is git-ignored, so the password never
 * reaches GitHub.) Until then getEmailTransporter() returns null and callers skip sending;
 * responses are still saved and visible in the admin dashboard.
 */

import * as nodemailer from 'nodemailer';
import { CHURCH_NAME, SITE_URL, ALLOWED_ORIGINS } from './siteConfig';

// SITE_URL and ALLOWED_ORIGINS live in siteConfig.ts (edit them there); re-exported here for the other functions
export { SITE_URL, ALLOWED_ORIGINS };

export const EMAIL_FROM_NAME = CHURCH_NAME;

export const getEmailTransporter = (): nodemailer.Transporter | null => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
};

// "From" address: the configured Gmail account, under the church's name
export const EMAIL_FROM = `"${EMAIL_FROM_NAME}" <${process.env.GMAIL_USER || ''}>`;

// Who is told about new form answers and RSVPs on the church's shared newsletters: the owners
export const ownerEmails = async (): Promise<string[]> => {
  const { getFirestore } = await import('firebase-admin/firestore');
  const snap = await getFirestore().collection('members').where('role', '==', 'owner').get();
  return snap.docs
    .map((d) => d.data())
    .filter((m) => m.accountStatus !== 'removed' && typeof m.email === 'string' && m.email)
    .map((m) => m.email as string);
};
