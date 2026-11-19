/**
 * Automatic Facebook setup for Live Studio (Facebook Graph API, Live Video API).
 *
 * With a stream key, Facebook holds the video as a preview until someone clicks "Go live" in
 * Live Producer. With the church Page connected once, GO LIVE creates the Page's live video
 * itself (status LIVE_NOW, so it goes live as soon as video arrives; or UNPUBLISHED for tests),
 * and End stream ends it.
 *
 * Setup (once): a Meta developer app (developers.facebook.com) owned by an admin of the church
 * Page, with Facebook Login and the redirect URI https://example.org/facebook-callback
 * (your SITE_URL from siteConfig.ts + /facebook-callback).
 * In functions/.env (git-ignored):
 *   FACEBOOK_APP_ID=...
 *   FACEBOOK_APP_SECRET=...
 *   FACEBOOK_CONFIG_ID=...   (only for "Facebook Login for Business" apps, which use a
 *                             configuration instead of a list of permissions)
 * The app can stay in Development mode: its own admins (who manage the Page) can use it.
 *
 * Data (server only): privateFacebook/connection (Page token, Page id/name), privateFacebook/state_{code},
 * privateFacebook/pages (Pages to choose from, if the account manages several).
 * Shown to members: liveStream/facebook { connected, pageName, pageId } or { choosePages: [...] }
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { randomBytes } from 'node:crypto';
import { SITE_URL, STUDIO_URL } from './siteConfig';

const GRAPH = 'https://graph.facebook.com';
const REDIRECT_URI = `${SITE_URL}/facebook-callback`;
const SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'publish_video'];

const clientConfig = () => {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) return null;
  return { appId, appSecret, configId: process.env.FACEBOOK_CONFIG_ID || '' };
};

export const facebookConfigured = () => !!clientConfig();

const db = () => admin.firestore();
const privateRef = (id: string) => db().collection('privateFacebook').doc(id);
const publicRef = () => db().collection('liveStream').doc('facebook');

export class FacebookError extends Error {}

const graph = async (method: string, path: string, params: Record<string, string>) => {
  const query = new URLSearchParams(params);
  const res = method === 'GET'
    ? await fetch(`${GRAPH}${path}?${query}`)
    : await fetch(`${GRAPH}${path}`, { method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: query });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok || data.error) {
    const message = data?.error?.error_user_msg || data?.error?.message || `HTTP ${res.status}`;
    throw new FacebookError(`Facebook said: ${message}`);
  }
  return data;
};

// ---------- Sign-in ----------

export const facebookAuthUrl = async (uid: string) => {
  const config = clientConfig();
  if (!config) throw new FacebookError('Facebook automatic setup is not switched on yet (see functions/src/facebook.ts).');
  const state = randomBytes(24).toString('hex');
  await privateRef(`state_${state}`).set({ uid, expiresAt: Date.now() + 15 * 60 * 1000 });
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    state,
    ...(config.configId ? { config_id: config.configId } : { scope: SCOPES.join(',') })
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
};

const savePage = async (page: { id: string; name: string; access_token: string }, uid: string, memberName: string) => {
  const now = new Date().toISOString();
  await privateRef('connection').set({ pageId: page.id, pageName: page.name, pageToken: page.access_token, connectedBy: uid, connectedAt: now });
  await privateRef('pages').delete();
  await publicRef().set({ connected: true, pageId: page.id, pageName: page.name, connectedByName: memberName, connectedAt: now });
};

export const facebookOAuthCallback = onRequest(async (req, res) => {
  const back = (result: string, message = '') => {
    const params = new URLSearchParams({ facebook: result, ...(message ? { message: message.slice(0, 200) } : {}) });
    res.redirect(302, `${STUDIO_URL}?${params}`);
  };
  try {
    const config = clientConfig();
    const state = String(req.query.state || '');
    const code = String(req.query.code || '');
    if (req.query.error) { back('error', `Facebook sign-in was cancelled (${req.query.error_reason || req.query.error}).`); return; }
    if (!config || !/^[0-9a-f]{48}$/.test(state) || !code) { back('error', 'That sign-in link is not valid. Try Connect Facebook again.'); return; }

    const stateRef = privateRef(`state_${state}`);
    const pending = (await stateRef.get()).data();
    await stateRef.delete();
    if (!pending || pending.expiresAt < Date.now()) { back('error', 'That sign-in took too long. Try Connect Facebook again.'); return; }
    const member = (await db().collection('members').doc(pending.uid).get()).data();
    if (!member || member.accountStatus === 'removed') { back('error', 'Only church members can connect Facebook.'); return; }

    const short = await graph('GET', '/oauth/access_token', {
      client_id: config.appId, client_secret: config.appSecret, redirect_uri: REDIRECT_URI, code
    });
    // A long-lived user token gives Page tokens that don't expire
    const long = await graph('GET', '/oauth/access_token', {
      grant_type: 'fb_exchange_token', client_id: config.appId, client_secret: config.appSecret, fb_exchange_token: short.access_token
    });
    const accounts = await graph('GET', '/me/accounts', { fields: 'id,name,access_token', limit: '100', access_token: long.access_token });
    const pages = (accounts.data || []).filter((p: any) => p.id && p.access_token);
    if (pages.length === 0) { back('error', 'No Facebook Pages were shared. Sign in as an admin of the church Page and allow access to it.'); return; }

    if (pages.length === 1) {
      await savePage(pages[0], pending.uid, member.name || '');
      back('connected');
      return;
    }
    // Several Pages: the studio asks which one is the church's
    await privateRef('pages').set({ pages, uid: pending.uid, memberName: member.name || '', expiresAt: Date.now() + 30 * 60 * 1000 });
    await publicRef().set({ connected: false, choosePages: pages.map((p: any) => ({ id: p.id, name: p.name })) });
    back('choose');
  } catch (error) {
    console.error('Facebook connect failed:', error);
    back('error', error instanceof FacebookError ? error.message : 'Connecting Facebook failed. Try again.');
  }
});

export const facebookChoosePage = async (pageId: string) => {
  const pending = (await privateRef('pages').get()).data();
  const page = pending?.pages?.find((p: any) => p.id === pageId);
  if (!pending || pending.expiresAt < Date.now() || !page) throw new FacebookError('That choice expired. Click Connect Facebook again.');
  await savePage(page, pending.uid, pending.memberName || '');
};

export const facebookDisconnect = async () => {
  await privateRef('connection').delete();
  await privateRef('pages').delete();
  await publicRef().set({ connected: false });
};

export const facebookConnected = async () => !!clientConfig() && !!(await privateRef('connection').get()).data()?.pageToken;

// ---------- Live videos ----------

// Create the Page's live video. LIVE_NOW goes live as soon as video arrives; UNPUBLISHED is a
// private preview (for tests: only Page admins see it, in Live Producer).
export const startFacebookLive = async (title: string, description: string, publish: boolean) => {
  const conn = (await privateRef('connection').get()).data();
  if (!clientConfig() || !conn?.pageToken) return null;
  const live = await graph('POST', `/${encodeURIComponent(conn.pageId)}/live_videos`, {
    status: publish ? 'LIVE_NOW' : 'UNPUBLISHED',
    title: title.slice(0, 250),
    description: description.slice(0, 5000),
    fields: 'id,secure_stream_url,stream_url,permalink_url,video',
    access_token: conn.pageToken
  });
  const url = live.secure_stream_url || live.stream_url;
  if (!url) throw new FacebookError('Facebook did not return a stream address.');
  return {
    liveVideoId: String(live.id),
    videoId: live.video?.id ? String(live.video.id) : '', // comments are posted on the video, not the live broadcast
    ingestUrl: String(url),
    watchUrl: live.permalink_url ? `https://www.facebook.com${live.permalink_url}` : `https://www.facebook.com/${conn.pageId}/live`
  };
};

export const endFacebookLive = async (liveVideoId: string) => {
  try {
    const conn = (await privateRef('connection').get()).data();
    if (!conn?.pageToken) return;
    await graph('POST', `/${encodeURIComponent(liveVideoId)}`, { end_live_video: 'true', access_token: conn.pageToken });
  } catch (error) {
    console.log('Ending Facebook live video:', error instanceof Error ? error.message : error);
  }
};

// Call the Graph API as the church Page (used by live chat)
export const facebookCall = async (method: string, path: string, params: Record<string, string> = {}) => {
  const conn = (await privateRef('connection').get()).data();
  if (!conn?.pageToken) throw new FacebookError('Facebook is not connected.');
  return graph(method, path, { ...params, access_token: conn.pageToken });
};

// Which permissions the saved Page connection actually has (to show what's missing)
export const facebookScopes = async (): Promise<string[] | null> => {
  const config = clientConfig();
  const conn = (await privateRef('connection').get()).data();
  if (!config || !conn?.pageToken) return null;
  try {
    const res = await graph('GET', '/debug_token', { input_token: conn.pageToken, access_token: `${config.appId}|${config.appSecret}` });
    return Array.isArray(res.data?.scopes) ? res.data.scopes : [];
  } catch {
    return null;
  }
};
