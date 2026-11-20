// Lakeview Fellowship — backend API client (replaces the Firebase layer).
// Talks to the Cloudflare Worker (worker/src/index.js) over plain fetch.
// Storage of the bearer token: localStorage under 'lakeview_token'.
// Production: VITE_API_BASE is set at build (see app/.env.production or the deploy
// workflow). Fallback resolves to the same origin (works when Pages routes /api/* to the Worker).
const API_BASE = import.meta.env.VITE_API_BASE || `${location.origin}/api`;

const TOKEN_KEY = 'lakeview_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(method, path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (auth !== false && token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && auth) setToken(null); // expired/invalid session
  return { status: res.status, ok: res.ok ? true : false, data };
}

// ---- auth ----
export const apiBootstrap = async (key, email, password, name) =>
  (await request('POST', '/auth/bootstrap', { key, email, password, name }, false)).data;
export const apiLogin = async (email, password) => {
  const { data } = await request('POST', '/auth/login', { email, password }, false);
  if (data?.token) setToken(data.token);
  return data;
};
export const apiLogout = async () => { await request('POST', '/auth/logout'); setToken(null); };
export const apiAcceptInvite = async (code, email, password) => {
  const { data } = await request('POST', '/auth/accept-invite', { code, email, password }, false);
  if (data?.token) setToken(data.token);
  return data;
};
export const apiMe = async () => {
  const { data, status } = await request('GET', '/auth/me');
  return status === 200 ? data?.member : null;
};
export const apiUpdateProfile = async (name) => {
  const { data } = await request('POST', '/auth/profile', { name });
  return data?.member || null;
};
export const apiChangePassword = async (current, next) =>
  (await request('POST', '/auth/password', { current, next })).data;

// ---- members (owner) ----
export const apiInviteLookup = async (code) => (await request('GET', `/invites/${code}`, undefined, false)).data;

export const apiMembers = async () => (await request('GET', '/members')).data || [];
export const apiInvite = async (email, role, name) => (await request('POST', '/members/invite', { email, role, name })).data;
export const apiInvites = async () => (await request('GET', '/members/invites')).data || [];
export const apiCancelInvite = async (code) => (await request('DELETE', '/members/invites', { code })).data;
export const apiChangeRole = async (id, role) => (await request('POST', '/members/role', { id, role })).data;
export const apiRemoveMember = async (id, restore) => (await request('POST', '/members/remove', { id, restore })).data;

// ---- events ----
export const apiEvents = async (since = '1900-01-01') => (await request('GET', `/events?since=${since}`, undefined, false)).data || [];
export const apiCreateEvent = async (ev) => (await request('POST', '/events', ev)).data;
export const apiUpdateEvent = async (id, ev) => (await request('PUT', `/events/${id}`, ev)).data;
export const apiDeleteEvent = async (id) => (await request('DELETE', `/events/${id}`)).data;

// ---- live ----
export const apiLiveStatus = async () => (await request('GET', '/live/status', undefined, false)).data;
export const apiSetLive = async (live) => (await request('POST', '/live/state', { live })).data;
export const apiSaveDestinations = async (destinations) => (await request('POST', '/live/destinations', { destinations })).data;
