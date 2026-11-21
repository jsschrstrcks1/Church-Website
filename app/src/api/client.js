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

// ---- prayer (public PWA intake/list) ----
export const apiPrayerSubmit = async (text, visibility, submittedBy, opts = {}) =>
  (await request('POST', '/prayer', { text, visibility, submittedBy, viaSms: opts.viaSms === true }, false)).data;
export const apiPrayerList = async () => (await request('GET', '/prayer', undefined, false)).data || [];
export const isLoggedIn = () => !!getToken();

// ---- prayer (staff moderation: approve/deny/answered/delete) ----
export const apiPrayerAdminList = async () => (await request('GET', '/prayer')).data || [];
export const apiPrayerReview = async (id, status) => (await request('POST', `/prayer/${id}/review`, { status })).data;
export const apiPrayerAnswered = async (id, answered) => (await request('POST', `/prayer/${id}/answered`, { answered })).data;
export const apiPrayerDelete = async (id) => (await request('DELETE', `/prayer/${id}`)).data;

// ---- sermons (archive + transcripts + watch) ----
export const apiSermons = async () => (await request('GET', '/sermons', undefined, true)).data || [];
export const apiSermonGet = async (id) => (await request('GET', `/sermons/${id}`, undefined, true)).data;
export const apiSermonCreate = async (s) => (await request('POST', '/sermons', s)).data;
export const apiSermonPublish = async (id, published) => (await request('POST', `/sermons/${id}/publish`, { published })).data;
export const apiSermonTranscribe = async (id, description) => (await request('POST', `/sermons/${id}/transcribe`, { description })).data;
export const sermonMediaUrl = (id) => `${API_BASE}/sermons/${id}/media`;

// ---- newsletters ----
export const apiNewsletters = async (all = false) => (await request('GET', `/newsletters${all ? '?all=1' : ''}`)).data || [];
export const apiNewsletterGet = async (id) => (await request('GET', `/newsletters/${id}`)).data;
export const apiNewsletterCreate = async (body) => (await request('POST', '/newsletters', body)).data;
export const apiNewsletterUpdate = async (id, body) => (await request('PUT', `/newsletters/${id}`, body)).data;
export const apiNewsletterAction = async (id, action, body) => (await request('POST', `/newsletters/${id}/${action}`, body)).data;
export const apiNewsletterDelete = async (id) => (await request('DELETE', `/newsletters/${id}`)).data;

// ---- forms ----
export const apiFormCreate = async (body) => (await request('POST', '/forms', body)).data;
export const apiFormResponse = async (formId, payload, respondent) => (await request('POST', `/forms/${formId}/responses`, { payload, respondent }, false)).data;
export const apiFormResponses = async (formId) => (await request('GET', `/forms/${formId}/responses`)).data || [];
export const apiFormResponseToggleReviewed = async (formId, rid) => (await request('POST', `/forms/${formId}/responses/${rid}/review`)).data;
export const apiFormResponseDelete = async (formId, rid) => (await request('DELETE', `/forms/${formId}/responses/${rid}`)).data;
export const apiFormDelete = async (formId) => (await request('DELETE', `/forms/${formId}`)).data;

// ---- rsvp + polls ----
export const apiRsvp = async (body) => (await request('POST', '/rsvps', body, false)).data;
export const apiRsvps = async (filter) => {
  const q = new URLSearchParams(filter || {}).toString();
  return (await request('GET', `/rsvps${q ? `?${q}` : ''}`)).data || [];
};
export const apiPollVote = async (pollId, optionText, voter) => (await request('POST', '/polls/vote', { pollId, optionText, voter }, false)).data;
export const apiPollTallies = async (pollId) => (await request('GET', `/polls/${pollId}/votes`)).data || [];

// ---- share ----
export const apiShareSettings = async () => (await request('GET', '/share/settings', undefined, false)).data || {};
export const apiSaveShareSettings = async (settings) => (await request('PUT', '/share/settings', settings)).data;

// ---- files ----
export const apiFileUpload = async (name, mime, data) => (await request('POST', '/files', { name, mime, data })).data;
export const apiFileUrl = (id) => `${API_BASE}/files/${id}`;
export const apiFileDelete = async (id) => (await request('DELETE', `/files/${id}`)).data;
