/**
 * Automatic YouTube setup for Live Studio (YouTube Data API v3).
 *
 * YouTube only shows a stream if there is a "broadcast" for it. Without the API, someone has to
 * prepare one in YouTube Studio before every service. With the church's YouTube account
 * connected once, GO LIVE creates the broadcast itself (title, privacy, starts automatically
 * when video arrives, stops when it ends), and End stream finishes it.
 *
 * Setup (once), in Google Cloud for your Firebase project:
 *   1. APIs & Services → Library → enable "YouTube Data API v3".
 *   2. OAuth consent screen: External; app name e.g. "Your Church Live Studio"; add the scope
 *      .../auth/youtube; then "Publish app" (In production) so the sign-in doesn't expire weekly.
 *   3. Credentials → Create OAuth client ID → Web application. Authorized redirect URI:
 *        https://example.org/youtube-callback   (your SITE_URL from siteConfig.ts + /youtube-callback)
 *   4. Put the client ID and secret in functions/.env (git-ignored) and redeploy:
 *        YOUTUBE_CLIENT_ID=...apps.googleusercontent.com
 *        YOUTUBE_CLIENT_SECRET=...
 * Then in Live Studio → Channels → "Connect YouTube", sign in with the account that owns the channel.
 *
 * Data (server only, no browser access):
 *   privateYoutube/connection    refresh token, channel, and the reusable YouTube "stream" (ingest)
 *   privateYoutube/state_{code}  a pending sign-in (expires after 15 minutes)
 * Shown to members: liveStream/youtube { connected, channelTitle, channelId }
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { randomBytes } from 'node:crypto';
import { CHURCH_NAME, SITE_URL, STUDIO_URL } from './siteConfig';

const SCOPE = 'https://www.googleapis.com/auth/youtube';
const REDIRECT_URI = `${SITE_URL}/youtube-callback`;
const API = 'https://www.googleapis.com/youtube/v3';

const clientConfig = () => {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
};

export const youtubeConfigured = () => !!clientConfig();

const db = () => admin.firestore();
const connectionRef = () => db().collection('privateYoutube').doc('connection');
const publicRef = () => db().collection('liveStream').doc('youtube');

export class YoutubeError extends Error {}

// ---------- Sign-in ----------

export const youtubeAuthUrl = async (uid: string) => {
  const config = clientConfig();
  if (!config) throw new YoutubeError('YouTube automatic setup is not switched on yet (see functions/src/youtube.ts).');
  const state = randomBytes(24).toString('hex');
  await db().collection('privateYoutube').doc(`state_${state}`).set({ uid, expiresAt: Date.now() + 15 * 60 * 1000 });
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // always return a refresh token
    include_granted_scopes: 'true',
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};

const tokenRequest = async (body: Record<string, string>) => {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body)
  });
  const data = await res.json() as Record<string, string>;
  if (!res.ok) throw new YoutubeError(`Google sign-in failed: ${data.error_description || data.error || res.status}`);
  return data;
};

const api = async (accessToken: string, method: string, path: string, body?: unknown) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || '';
    const message = data?.error?.message || `HTTP ${res.status}`;
    if (reason === 'liveStreamingNotEnabled') {
      throw new YoutubeError('Live streaming is not enabled on this YouTube channel. Turn it on in YouTube Studio (it can take up to 24 hours the first time).');
    }
    throw new YoutubeError(`YouTube said: ${message}`);
  }
  return data;
};

// The reusable ingest "stream" the studio always sends to (its key never changes)
const createIngestStream = async (accessToken: string) => {
  const stream = await api(accessToken, 'POST', '/liveStreams?part=snippet,cdn,contentDetails', {
    snippet: { title: `${CHURCH_NAME} Live Studio` },
    cdn: { ingestionType: 'rtmp', resolution: 'variable', frameRate: 'variable' },
    contentDetails: { isReusable: true }
  });
  const info = stream.cdn?.ingestionInfo || {};
  return { streamId: stream.id as string, ingestUrl: `${String(info.ingestionAddress).replace(/\/+$/, '')}/${info.streamName}` };
};

// HTTPS endpoint Google sends people back to after they sign in
export const youtubeOAuthCallback = onRequest(async (req, res) => {
  const back = (result: string, message = '') => {
    const params = new URLSearchParams({ youtube: result, ...(message ? { message: message.slice(0, 200) } : {}) });
    res.redirect(302, `${STUDIO_URL}?${params}`);
  };
  try {
    const config = clientConfig();
    const state = String(req.query.state || '');
    const code = String(req.query.code || '');
    if (req.query.error) { back('error', `Google sign-in was cancelled (${req.query.error}).`); return; }
    if (!config || !/^[0-9a-f]{48}$/.test(state) || !code) { back('error', 'That sign-in link is not valid. Try Connect YouTube again.'); return; }

    const stateRef = db().collection('privateYoutube').doc(`state_${state}`);
    const pending = (await stateRef.get()).data();
    await stateRef.delete();
    if (!pending || pending.expiresAt < Date.now()) { back('error', 'That sign-in took too long. Try Connect YouTube again.'); return; }
    const member = (await db().collection('members').doc(pending.uid).get()).data();
    if (!member || member.accountStatus === 'removed') { back('error', 'Only church members can connect YouTube.'); return; }

    const tokens = await tokenRequest({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    });
    if (!tokens.refresh_token) { back('error', 'Google did not grant lasting access. Try again.'); return; }

    const channels = await api(tokens.access_token, 'GET', '/channels?part=snippet&mine=true');
    const channel = channels.items?.[0];
    if (!channel) { back('error', 'That Google account has no YouTube channel. Sign in with the account that owns the church channel.'); return; }

    const { streamId, ingestUrl } = await createIngestStream(tokens.access_token);
    const now = new Date().toISOString();
    await connectionRef().set({
      refreshToken: tokens.refresh_token,
      channelId: channel.id,
      channelTitle: channel.snippet?.title || '',
      streamId,
      ingestUrl,
      connectedBy: pending.uid,
      connectedAt: now
    });
    await publicRef().set({ connected: true, channelId: channel.id, channelTitle: channel.snippet?.title || '', connectedByName: member.name || '', connectedAt: now });
    back('connected');
  } catch (error) {
    console.error('YouTube connect failed:', error);
    back('error', error instanceof YoutubeError ? error.message : 'Connecting YouTube failed. Try again.');
  }
});

export const youtubeDisconnect = async () => {
  const conn = (await connectionRef().get()).data();
  if (conn?.refreshToken) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.refreshToken)}`, { method: 'POST' }).catch(() => {});
  }
  await connectionRef().delete();
  await publicRef().set({ connected: false });
};

// ---------- Broadcasts ----------

let cachedToken: { token: string; expiresAt: number } | null = null;

const accessToken = async () => {
  const config = clientConfig();
  const conn = (await connectionRef().get()).data();
  if (!config || !conn?.refreshToken) return null;
  // Reuse a fresh access token (chat checks every few seconds)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return { token: cachedToken.token, conn };
  try {
    const tokens = await tokenRequest({
      refresh_token: conn.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token'
    });
    cachedToken = { token: tokens.access_token, expiresAt: Date.now() + (Number(tokens.expires_in) || 3000) * 1000 };
    return { token: tokens.access_token, conn };
  } catch (error) {
    throw new YoutubeError('The YouTube connection has expired. In Channels, click Connect YouTube again.');
  }
};

export const youtubeConnected = async () => !!clientConfig() && !!(await connectionRef().get()).data()?.refreshToken;

// Create today's broadcast, attach it to the ingest stream, and return where to send video
export const startYoutubeBroadcast = async (title: string, privacy: string, description: string) => {
  const auth = await accessToken();
  if (!auth) return null;
  let { streamId, ingestUrl } = auth.conn;

  // Make sure the ingest stream still exists (someone may have deleted it in YouTube Studio)
  const existing = await api(auth.token, 'GET', `/liveStreams?part=id,cdn&id=${encodeURIComponent(streamId)}`);
  if (!existing.items?.length) {
    ({ streamId, ingestUrl } = await createIngestStream(auth.token));
    await connectionRef().update({ streamId, ingestUrl });
  }

  const broadcast = await api(auth.token, 'POST', '/liveBroadcasts?part=snippet,status,contentDetails', {
    snippet: { title: title.slice(0, 100), description: description.slice(0, 4900), scheduledStartTime: new Date().toISOString() },
    status: { privacyStatus: ['public', 'unlisted', 'private'].includes(privacy) ? privacy : 'public', selfDeclaredMadeForKids: false },
    contentDetails: {
      enableAutoStart: true, // goes live as soon as video arrives
      enableAutoStop: true, // ends when the video stops
      enableDvr: true,
      latencyPreference: 'low',
      monitorStream: { enableMonitorStream: false }
    }
  });
  await api(auth.token, 'POST', `/liveBroadcasts/bind?id=${encodeURIComponent(broadcast.id)}&part=id,contentDetails&streamId=${encodeURIComponent(streamId)}`);
  return {
    broadcastId: broadcast.id as string,
    liveChatId: (broadcast.snippet?.liveChatId as string) || '',
    ingestUrl: ingestUrl as string,
    watchUrl: `https://www.youtube.com/watch?v=${broadcast.id}`
  };
};

// Call the YouTube API as the connected channel (used by live chat)
export const youtubeCall = async (method: string, path: string, body?: unknown) => {
  const auth = await accessToken();
  if (!auth) throw new YoutubeError('YouTube is not connected.');
  return api(auth.token, method, path, body);
};

export const endYoutubeBroadcast = async (broadcastId: string) => {
  try {
    const auth = await accessToken();
    if (!auth) return;
    await api(auth.token, 'POST', `/liveBroadcasts/transition?broadcastStatus=complete&id=${encodeURIComponent(broadcastId)}&part=status`);
  } catch (error) {
    // Usually already complete (auto-stop got there first)
    console.log('Ending YouTube broadcast:', error instanceof Error ? error.message : error);
  }
};
