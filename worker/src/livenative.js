// Native Live Studio auto-broadcast for Lakeview Fellowship — Cloudflare Worker port.
//
// Ported from the syndication-engine's Firebase functions (youtube.ts, facebook.ts,
// liveStream.ts). Removes OBS from the picture: with YouTube and Facebook "connected"
// once by an admin, a single GO LIVE creates the real broadcast on each platform
// (YouTube Live + Facebook Live), returns the RTMP ingest addresses, and records the
// site as live. End stream finishes both broadcasts.
//
// Data lives in D1 instead of Firestore:
//   yt_connection / fb_connection   one row each: refresh token / page token etc.
//   yt_oauth_state / fb_oauth_state pending sign-ins (expire 15m)
//   fb_pages_pending                 Pages awaiting an admin's choice
//
// Secrets (Worker env, via `wrangler secret put`):
//   YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET
//   FACEBOOK_APP_ID,   FACEBOOK_APP_SECRET   (FACEBOOK_CONFIG_ID optional for FB login-for-business)
//   STUDIO_URL        where OAuth callbacks redirect back into the app (defaults to origin /study)
//
// Providers' callbacks are hit WITHOUT our bearer token, so those routes are public
// in index.js; the connect/info/go/stop routes require a member session.

const SCOPES_FB = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'publish_video'];
const SCOPE_YT = 'https://www.googleapis.com/auth/youtube';
const STATE_TTL = 15 * 60 * 1000;

export class LiveError extends Error { constructor(msg){ super(msg); this.name='LiveError'; } }

// ---- helpers ---------------------------------------------------------------

function studioUrl(env) { return env.STUDIO_URL || env.SITE_URL || (new URL('/study', 'https://lakeview-fellowship-church.pages.dev')).toString(); }
function siteUrl(env) { return env.SITE_URL || 'https://lakeview-fellowship-church.pages.dev'; }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function graph(method, path, params) {
  const q = new URLSearchParams(params || {});
  const res = method === 'GET'
    ? await fetch(`https://graph.facebook.com${path}?${q}`)
    : await fetch(`https://graph.facebook.com${path}`, { method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: q });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new LiveError(`Facebook said: ${data?.error?.error_user_msg || data?.error?.message || `HTTP ${res.status}`}`);
  }
  return data;
}

async function googleToken(body) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new LiveError(`Google sign-in failed: ${data?.error_description || data?.error || res.status}`);
  return data;
}

async function ytApi(env, db, accessToken, method, path, body) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || '';
    const message = data?.error?.message || `HTTP ${res.status}`;
    if (reason === 'liveStreamingNotEnabled') {
      throw new LiveError('Live streaming is not enabled on this YouTube channel. Turn it on in YouTube Studio (up to 24h the first time).');
    }
    throw new LiveError(`YouTube said: ${message}`);
  }
  return data;
}

// ---- config ----------------------------------------------------------------

const ytConfig = (env) => (env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET)
  ? { clientId: env.YOUTUBE_CLIENT_ID, clientSecret: env.YOUTUBE_CLIENT_SECRET } : null;
export const ytConfigured = (env) => !!ytConfig(env);

const fbConfig = (env) => (env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET)
  ? { appId: env.FACEBOOK_APP_ID, appSecret: env.FACEBOOK_APP_SECRET, configId: env.FACEBOOK_CONFIG_ID || '' } : null;
export const fbConfigured = (env) => !!fbConfig(env);

// ---- YouTube: access token + connection ------------------------------------

async function ytConnection(env, db) {
  const row = await db.prepare('SELECT * FROM yt_connection WHERE id = 1').first();
  if (!row) return null;
  const config = ytConfig(env);
  if (!config) return null;
  let token = row.access_token;
  if (!token || Date.parse(row.token_expires) - Date.now() < 60 * 1000) {
    const t = await googleToken({
      refresh_token: row.refresh_token, client_id: config.clientId,
      client_secret: config.clientSecret, grant_type: 'refresh_token'
    });
    token = t.access_token;
    await db.prepare('UPDATE yt_connection SET access_token=?, token_expires=? WHERE id=1')
      .bind(token, new Date(Date.now() + (Number(t.expires_in) || 3000) * 1000).toISOString()).run();
  }
  return { ...row, accessToken: token };
}

export async function ytConnected(env, db) {
  if (!ytConfigured(env)) return false;
  const row = await db.prepare('SELECT refresh_token FROM yt_connection WHERE id=1').first();
  return !!(row && row.refresh_token);
}

// ---- OAuth connect: YouTube --------------------------------------------------

export async function ytConnectUrl(env, db, uid) {
  const config = ytConfig(env);
  if (!config) throw new LiveError('YouTube automatic setup is not switched on yet — set YOUTUBE_CLIENT_ID/SECRET on the Worker.');
  const state = randHex(24);
  await db.prepare('INSERT OR REPLACE INTO yt_oauth_state (code, uid, expires_at) VALUES (?,?,?)')
    .bind(state, uid, new Date(Date.now() + STATE_TTL).toISOString()).run();
  const p = { client_id: config.clientId, redirect_uri: `${siteUrl(env)}/youtube-callback`,
    response_type: 'code', scope: SCOPE_YT, access_type: 'offline', prompt: 'consent',
    include_granted_scopes: 'true', state };
  return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(p)}`;
}

export async function ytHandleCallback(env, db, url) {
  const config = ytConfig(env);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const err = url.searchParams.get('error') || '';
  const q = new URLSearchParams({ youtube: 'error' });
  const bounce = (result, msg) => { q.set('youtube', result); if (msg) q.set('message', String(msg).slice(0, 200)); return `${studioUrl(env)}?${q}`; };
  if (err) return bounce('cancelled');
  if (!config || !/^[0-9a-f]{48}$/.test(state) || !code) return bounce('invalid');
  const row = await db.prepare('SELECT * FROM yt_oauth_state WHERE code=?').bind(state).first();
  await db.prepare('DELETE FROM yt_oauth_state WHERE code=?').bind(state).run();
  if (!row || Date.parse(row.expires_at) < Date.now()) return bounce('expired');
  const member = await db.prepare('SELECT * FROM members WHERE id=? AND account_status!=\'removed\'').bind(row.uid).first();
  if (!member) return bounce('denied');
  try {
    const tokens = await googleToken({ code, client_id: config.clientId, client_secret: config.clientSecret,
      redirect_uri: `${siteUrl(env)}/youtube-callback`, grant_type: 'authorization_code' });
    if (!tokens.refresh_token) return bounce('no-refresh');
    const channels = await ytApi(env, db, tokens.access_token, 'GET', '/channels?part=snippet&mine=true');
    const channel = channels.items?.[0];
    if (!channel) return bounce('no-channel');
    const { streamId, ingestUrl } = await ytCreateIngest(env, db, tokens.access_token);
    await db.prepare(`INSERT INTO yt_connection (id, refresh_token, access_token, token_expires, channel_id, channel_title, stream_id, ingest_url, connected_by, connected_at)
      VALUES (1,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET refresh_token=excluded.refresh_token, access_token=excluded.access_token,
      token_expires=excluded.token_expires, channel_id=excluded.channel_id, channel_title=excluded.channel_title,
      stream_id=excluded.stream_id, ingest_url=excluded.ingest_url, connected_by=excluded.connected_by, connected_at=excluded.connected_at`)
      .bind(tokens.refresh_token, tokens.access_token, new Date(Date.now()+3600*1000).toISOString(),
        channel.id, channel.snippet?.title || '', streamId, ingestUrl, row.uid, new Date().toISOString()).run();
    return bounce('connected');
  } catch (e) {
    return bounce('error', e instanceof LiveError ? e.message : 'Connecting YouTube failed.');
  }
}

async function ytCreateIngest(env, db, token) {
  const stream = await ytApi(env, db, token, 'POST', '/liveStreams?part=snippet,cdn,contentDetails', {
    snippet: { title: 'Lakeview Fellowship Live Studio' },
    cdn: { ingestionType: 'rtmp', resolution: 'variable', frameRate: 'variable' },
    contentDetails: { isReusable: true }
  });
  const info = stream.cdn?.ingestionInfo || {};
  return { streamId: stream.id, ingestUrl: `${String(info.ingestionAddress).replace(/\/+$/, '')}/${info.streamName}` };
}

export async function ytDisconnect(env, db) {
  const row = await db.prepare('SELECT refresh_token FROM yt_connection WHERE id=1').first();
  if (row?.refresh_token) { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refresh_token)}`, { method: 'POST' }).catch(() => {}); }
  await db.prepare('DELETE FROM yt_connection WHERE id=1').run();
  return { connected: false };
}

// ---- OAuth connect: Facebook -------------------------------------------------

export async function fbConnectUrl(env, db, uid) {
  const config = fbConfig(env);
  if (!config) throw new LiveError('Facebook automatic setup is not switched on yet — set FACEBOOK_APP_ID/SECRET on the Worker.');
  const state = randHex(24);
  await db.prepare('INSERT OR REPLACE INTO fb_oauth_state (code, uid, expires_at) VALUES (?,?,?)')
    .bind(state, uid, new Date(Date.now() + STATE_TTL).toISOString()).run();
  const p = { client_id: config.appId, redirect_uri: `${siteUrl(env)}/facebook-callback`,
    response_type: 'code', state,
    ...(config.configId ? { config_id: config.configId } : { scope: SCOPES_FB.join(',') }) };
  return `https://www.facebook.com/dialog/oauth?${new URLSearchParams(p)}`;
}

async function fbSavePage(env, db, page, uid, memberName) {
  await db.prepare(`INSERT INTO fb_connection (id, page_id, page_name, page_token, connected_by, connected_at)
    VALUES (1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET page_id=excluded.page_id, page_name=excluded.page_name,
    page_token=excluded.page_token, connected_by=excluded.connected_by, connected_at=excluded.connected_at`)
    .bind(page.id, page.name, page.access_token, uid, new Date().toISOString()).run();
  await db.prepare('DELETE FROM fb_pages_pending WHERE id=1').run();
  return { connected: true, pageId: page.id, pageName: page.name };
}

export async function fbHandleCallback(env, db, url) {
  const config = fbConfig(env);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const q = new URLSearchParams({ facebook: 'error' });
  const bounce = (result, msg) => { q.set('facebook', result); if (msg) q.set('message', String(msg).slice(0, 200)); return `${studioUrl(env)}?${q}`; };
  if (url.searchParams.get('error')) return bounce('cancelled');
  if (!config || !/^[0-9a-f]{48}$/.test(state) || !code) return bounce('invalid');
  const row = await db.prepare('SELECT * FROM fb_oauth_state WHERE code=?').bind(state).first();
  await db.prepare('DELETE FROM fb_oauth_state WHERE code=?').bind(state).run();
  if (!row || Date.parse(row.expires_at) < Date.now()) return bounce('expired');
  const member = await db.prepare('SELECT * FROM members WHERE id=? AND account_status!=\'removed\'').bind(row.uid).first();
  if (!member) return bounce('denied');
  try {
    const short = await graph('GET', '/oauth/access_token', { client_id: config.appId, client_secret: config.appSecret,
      redirect_uri: `${siteUrl(env)}/facebook-callback`, code });
    const long = await graph('GET', '/oauth/access_token', { grant_type: 'fb_exchange_token', client_id: config.appId,
      client_secret: config.appSecret, fb_exchange_token: short.access_token });
    const accounts = await graph('GET', '/me/accounts', { fields: 'id,name,access_token', limit: '100', access_token: long.access_token });
    const pages = (accounts.data || []).filter((p) => p.id && p.access_token);
    if (pages.length === 0) return bounce('no-pages');
    if (pages.length === 1) { await fbSavePage(env, db, pages[0], row.uid, member.name || ''); return bounce('connected'); }
    await db.prepare(`INSERT INTO fb_pages_pending (id, pages_json, uid, member_name, expires_at) VALUES (1,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET pages_json=excluded.pages_json, uid=excluded.uid, member_name=excluded.member_name, expires_at=excluded.expires_at`)
      .bind(JSON.stringify(pages), row.uid, member.name || '', new Date(Date.now() + 30 * 60 * 1000).toISOString()).run();
    return bounce('choose');
  } catch (e) {
    return bounce('error', e instanceof LiveError ? e.message : 'Connecting Facebook failed.');
  }
}

export async function fbChoosePage(env, db, pageId) {
  const pending = await db.prepare('SELECT * FROM fb_pages_pending WHERE id=1').first();
  if (!pending || Date.parse(pending.expires_at) < Date.now()) throw new LiveError('That choice expired. Click Connect Facebook again.');
  const pages = JSON.parse(pending.pages_json || '[]');
  const page = pages.find((p) => String(p.id) === String(pageId));
  if (!page) throw new LiveError('Choose a page.');
  return fbSavePage(env, db, page, pending.uid, pending.member_name || '');
}

export async function fbDisconnect(env, db) {
  await db.prepare('DELETE FROM fb_connection WHERE id=1').run();
  await db.prepare('DELETE FROM fb_pages_pending WHERE id=1').run();
  return { connected: false };
}

export async function fbConnected(env, db) {
  if (!fbConfigured(env)) return false;
  const row = await db.prepare('SELECT page_token FROM fb_connection WHERE id=1').first();
  return !!(row && row.page_token);
}

export async function fbPagesPending(env, db) {
  const p = await db.prepare('SELECT pages_json FROM fb_pages_pending WHERE id=1').first();
  return p ? JSON.parse(p.pages_json || '[]') : [];
}

// ---- Automagic endpoints: YouTube / Facebook info -----------------------------

export async function liveInfo(env, db) {
  return {
    configured: ytConfigured(env),
    connected: await ytConnected(env, db),
    facebookConfigured: fbConfigured(env),
    facebookConnected: await fbConnected(env, db),
    facebookChoosePages: await fbPagesPending(env, db),
    defaultTitle: defaultTitle()
  };
}

export function defaultTitle() {
  const d = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return `Lakeview Fellowship Church · ${d}`;
}

// ---- GO LIVE / END ----------------------------------------------------------

function rtmpUrl(serverUrl, key) { return `${serverUrl.replace(/\/+$/, '')}/${key.trim()}`; }

export async function startBroadcasts(env, db, caller, body) {
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : defaultTitle();
  const description = typeof body.description === 'string' ? body.description : '';
  const privacy = typeof body.privacy === 'string' ? body.privacy : 'public';

  const autoYt = await ytConnected(env, db);
  const autoFb = await fbConnected(env, db);
  let youtube = null, facebook = null;
  const undo = async () => { if (youtube?.broadcastId) await endYtBroadcast(env, db, youtube.broadcastId); if (facebook?.liveVideoId) await endFbLive(env, db, facebook.liveVideoId); };

  try {
    if (autoYt) {
      youtube = await startYtBroadcast(env, db, title, privacy, description);
    }
    if (autoFb) {
      facebook = await startFbLive(env, db, title, description, privacy === 'public');
    }
  } catch (e) { await undo(); throw e; }

  if (!youtube && !facebook) {
    // No platform was "connected": there's no ingest to hand back. Fall back to manual RTMP.
    throw new LiveError('No YouTube or Facebook connection is set up. Connect at least one platform in Live Studio → Channels, or add a manual stream destination.');
  }

  const now = new Date().toISOString();
  await db.prepare(`UPDATE live_state SET status='live', destinations=?, started_by=?, started_by_name=?, started_at=?, heartbeat_at=?,
    youtube_broadcast_id=COALESCE(?, youtube_broadcast_id), youtube_watch_url=COALESCE(?, youtube_watch_url), youtube_chat_id=COALESCE(?, youtube_chat_id),
    facebook_live_video_id=COALESCE(?, facebook_live_video_id), facebook_video_id=COALESCE(?, facebook_video_id), facebook_watch_url=COALESCE(?, facebook_watch_url)
    WHERE id=1`)
    .bind(JSON.stringify([
      ...(youtube ? [{ name: 'YouTube', platform: 'youtube' }] : []),
      ...(facebook ? [{ name: 'Facebook', platform: 'facebook' }] : [])
    ]), caller.id, caller.name || '', now, now,
    youtube?.broadcastId || null, youtube?.watchUrl || null, youtube?.liveChatId || null,
    facebook?.liveVideoId || null, facebook?.videoId || null, facebook?.watchUrl || null).run();
  await db.prepare('UPDATE public_live SET live=1, youtube=?, facebook=?, youtube_video_id=?, started_at=?, heartbeat_at=? WHERE id=1')
    .bind(youtube ? 1 : 0, facebook ? 1 : 0, youtube?.broadcastId || null, now, now).run();

  return {
    live: true,
    youtube: !!youtube,
    facebook: !!facebook,
    youtubeVideoId: youtube?.broadcastId || '',
    destinations: [
      ...(youtube ? [{ platform: 'youtube', ingestUrl: youtube.ingestUrl, watchUrl: youtube.watchUrl }] : []),
      ...(facebook ? [{ platform: 'facebook', ingestUrl: facebook.ingestUrl, watchUrl: facebook.watchUrl }] : [])
    ]
  };
}

export async function stopBroadcasts(env, db, caller) {
  const st = await db.prepare('SELECT * FROM live_state WHERE id=1').first();
  const now = new Date().toISOString();
  if (st?.youtube_broadcast_id) await endYtBroadcast(env, db, st.youtube_broadcast_id);
  if (st?.facebook_live_video_id) await endFbLive(env, db, st.facebook_live_video_id);
  await db.prepare("UPDATE live_state SET status='idle', ended_at=?, ended_by=?, ended_by_name=? WHERE id=1").bind(now, caller.id, caller.name || '').run();
  await db.prepare('UPDATE public_live SET live=0, ended_at=? WHERE id=1').bind(now).run();
  return { live: false };
}

async function startYtBroadcast(env, db, title, privacy, description) {
  const auth = await ytConnection(env, db);
  if (!auth) return null;
  let { streamId, ingestUrl } = auth;
  const existing = await ytApi(env, db, auth.accessToken, 'GET', `/liveStreams?part=id,cdn&id=${encodeURIComponent(streamId)}`);
  if (!existing.items?.length) {
    ({ streamId, ingestUrl } = await ytCreateIngest(env, db, auth.accessToken));
    await db.prepare('UPDATE yt_connection SET stream_id=?, ingest_url=? WHERE id=1').bind(streamId, ingestUrl).run();
  }
  const broadcast = await ytApi(env, db, auth.accessToken, 'POST', '/liveBroadcasts?part=snippet,status,contentDetails', {
    snippet: { title: String(title).slice(0, 100), description: String(description).slice(0, 4900), scheduledStartTime: new Date().toISOString() },
    status: { privacyStatus: ['public', 'unlisted', 'private'].includes(privacy) ? privacy : 'public', selfDeclaredMadeForKids: false },
    contentDetails: { enableAutoStart: true, enableAutoStop: true, enableDvr: true, latencyPreference: 'low',
      monitorStream: { enableMonitorStream: false } }
  });
  await ytApi(env, db, auth.accessToken, 'POST', `/liveBroadcasts/bind?id=${encodeURIComponent(broadcast.id)}&part=id,contentDetails&streamId=${encodeURIComponent(streamId)}`);
  return {
    broadcastId: broadcast.id,
    liveChatId: broadcast.snippet?.liveChatId || '',
    ingestUrl,
    watchUrl: `https://www.youtube.com/watch?v=${broadcast.id}`
  };
}

async function endYtBroadcast(env, db, broadcastId) {
  try { const auth = await ytConnection(env, db); if (auth) await ytApi(env, db, auth.accessToken, 'POST', `/liveBroadcasts/transition?broadcastStatus=complete&id=${encodeURIComponent(broadcastId)}&part=status`); }
  catch (e) { /* usually already complete via auto-stop */ }
}

async function startFbLive(env, db, title, description, publish) {
  const conn = await db.prepare('SELECT * FROM fb_connection WHERE id=1').first();
  if (!fbConfigured(env) || !conn?.page_token) return null;
  const live = await graph('POST', `/${encodeURIComponent(conn.page_id)}/live_videos`, {
    status: publish ? 'LIVE_NOW' : 'UNPUBLISHED',
    title: String(title).slice(0, 250),
    description: String(description).slice(0, 5000),
    fields: 'id,secure_stream_url,stream_url,permalink_url,video',
    access_token: conn.page_token
  });
  const url = live.secure_stream_url || live.stream_url;
  if (!url) throw new LiveError('Facebook did not return a stream address.');
  return { liveVideoId: String(live.id), videoId: live.video?.id ? String(live.video.id) : '', ingestUrl: String(url),
    watchUrl: live.permalink_url ? `https://www.facebook.com${live.permalink_url}` : `https://www.facebook.com/${conn.page_id}/live` };
}

async function endFbLive(env, db, liveVideoId) {
  try { const conn = await db.prepare('SELECT page_token FROM fb_connection WHERE id=1').first(); if (conn?.page_token) await graph('POST', `/${encodeURIComponent(liveVideoId)}`, { end_live_video: 'true', access_token: conn.page_token }); }
  catch (e) { /* likely already ended */ }
}

// ---- util ---------------------------------------------------------------------

function randHex(bytes) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
}
