// Live Studio's saved library, shared by every admin:
//   liveStudio/library        scenes, lower thirds, ticker messages, QR codes
//   liveStudioAssets/{id}     uploaded logos, overlays, and backgrounds
//
// SELF-HOSTED: Firebase (Firestore/Storage/Functions) has been replaced. There is no
// server-side cloud store for the studio, so the library, uploaded pictures, control state
// and on-air monitor are kept as in-memory state (with localStorage persistence where the
// data is small enough), plus the Cloudflare Worker API for live status and destinations.
//
// Pictures are kept as data URLs. The stream canvas can only use same-origin pictures
// (see utils/liveMixer.js), and data: URLs always are. So they are resized before saving to
// stay small enough for localStorage.
import { useCallback, useEffect, useState } from 'react';
import { apiSaveDestinations, apiSetLive } from '../api/client';

export const newId = () => Math.random().toString(36).slice(2, 10);

const CHURCH_NAME = 'Lakeview Fellowship Church';
const CHURCH_NAME_ES = 'Iglesia Lakeview Fellowship';

export const DEFAULT_LIBRARY = {
  scenes: [
    { id: 'countdown', name: 'Countdown', kind: 'countdown', minutes: 5, text: 'Service starts soon\nEl servicio comienza pronto' },
    { id: 'welcome', name: 'Welcome', kind: 'card', text: `Welcome · Bienvenidos\n${CHURCH_NAME}` },
    { id: 'live', name: 'Live', kind: 'live' },
    { id: 'thanks', name: 'Thank you', kind: 'card', text: 'Thank you for joining us\nGracias por acompañarnos · See you next week' }
  ],
  lowerThirds: [],
  tickers: [
    { id: 'welcome', text: `Welcome to ${CHURCH_NAME} · Bienvenidos a ${CHURCH_NAME_ES}` }
  ],
  qrCodes: [],
  stream: { title: '', privacy: 'public', description: '' } // YouTube broadcast details (automatic setup)
};

const LIBRARY_KEYS = ['scenes', 'lowerThirds', 'tickers', 'qrCodes', 'stream'];
const validFor = (key, value) => (key === 'stream' ? !!value && typeof value === 'object' && !Array.isArray(value) : Array.isArray(value));
const MAX_DATA_URL = 950_000;

// ---------- What's on screen now (shared control state) ----------
// Shared by every open studio so a co-host can switch scenes, layouts, graphics and
// captions while the streaming computer sends the video. SELF-HOSTED: kept in local state
// (persisted to localStorage), so changes show across co-hosts on the same session.

export const DEFAULT_CONTROL = {
  sceneId: 'live',
  sceneEndsAt: 0,
  layout: 'camera',
  swap: false,
  clip: null, // { id, startedAt } while a video clip plays
  tickerSpeed: 110, // pixels per second
  chatShown: null, // { id, author, text, platform }: a chat message on screen
  cameraRadius: 12,
  screenRadius: 12,
  cameraShape: 'rect',
  placement: {}, // small box position and size per layout
  logo: '',
  overlay: '',
  background: '',
  lowerThird: null,
  ticker: null,
  qr: null
};

// ---------- Tiny observable store (in-memory + optional localStorage persistence) ----------
const localStorageAvailable = (() => { try { localStorage.setItem('ls.__probe', '1'); localStorage.removeItem('ls.__probe'); return true; } catch { return false; } })();
const copy = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

const createStore = (initial, persistKey) => {
  let value = copy(initial);
  if (persistKey && localStorageAvailable) {
    try {
      const raw = localStorage.getItem(persistKey);
      if (raw) { const parsed = JSON.parse(raw); if (parsed) value = parsed; }
    } catch { /* fall back to initial */ }
  }
  const listeners = new Set();
  return {
    get: () => value,
    set: (updater) => {
      value = typeof updater === 'function' ? updater(copy(value)) : copy(updater);
      if (persistKey && localStorageAvailable) {
        try { localStorage.setItem(persistKey, JSON.stringify(value)); } catch { /* keep in-memory */ }
      }
      listeners.forEach((fn) => { try { fn(copy(value)); } catch { /* ignore */ } });
    },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }
  };
};

const libraryStore = createStore(DEFAULT_LIBRARY, 'lakeview.ls.library');
const assetsStore = createStore([], null); // may be large (data URLs): memory only
const controlStore = createStore(DEFAULT_CONTROL, 'lakeview.ls.control');
const monitorStore = createStore(null, null);
const destinationsStore = createStore([], 'lakeview.ls.destinations');
const clipUrls = new Map(); // assetId -> object URL (session-only for videos)

export const useStudioLibrary = () => {
  const [library, setLibrary] = useState(() => libraryStore.get());
  const [assets, setAssets] = useState(() => assetsStore.get());

  useEffect(() => libraryStore.subscribe(setLibrary), []);
  useEffect(() => assetsStore.subscribe(setAssets), []);

  // Replace one list (e.g. lowerThirds), or the stream details, in the shared library
  const saveList = useCallback(async (key, list) => {
    libraryStore.set((prev) => ({ ...prev, [key]: list, updatedAt: new Date().toISOString() }));
  }, []);

  return { library, assets, saveList };
};

// Shrink a picture until it fits in a small document. Backgrounds become JPEG; logos and
// overlays stay PNG so their transparent parts stay transparent.
export const imageFileToDataUrl = (file, kind) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const maxW = kind === 'logo' ? 600 : 1280;
    const maxH = kind === 'logo' ? 600 : 720;
    let scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
    const type = kind === 'background' ? 'image/jpeg' : 'image/png';
    for (let attempt = 0; attempt < 8; attempt++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL(type, 0.85);
      if (dataUrl.length <= MAX_DATA_URL) { resolve(dataUrl); return; }
      scale *= 0.8;
    }
    reject(new Error('That picture is too large. Try a smaller one.'));
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('That file is not a picture the browser can read.'));
  };
  img.src = url;
});

export const addAsset = async (kind, file) => {
  const dataUrl = await imageFileToDataUrl(file, kind);
  const asset = {
    id: newId(),
    kind,
    name: (file.name || 'Picture').slice(0, 80),
    dataUrl,
    createdAt: new Date().toISOString()
  };
  assetsStore.set((prev) => [...prev, asset].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
};

export const removeAsset = async (id) => {
  assetsStore.set((prev) => prev.filter((a) => a.id !== id));
};

export const useStudioControl = (uid) => {
  const [control, setControl] = useState(() => controlStore.get());

  useEffect(() => controlStore.subscribe(setControl), []);

  // Change what's on screen: shows here at once, and on every other open studio a moment later
  const updateControl = useCallback((changes) => {
    controlStore.set((prev) => ({ ...prev, ...changes, updatedAt: new Date().toISOString(), updatedBy: uid || '' }));
  }, [uid]);

  return { control, updateControl };
};

// ---------- On-air preview for co-hosts ----------

export const postMonitor = (data) => {
  monitorStore.set({ ...data, updatedAt: new Date().toISOString() });
  return Promise.resolve();
};

export const useStudioMonitor = (enabled) => {
  const [monitor, setMonitor] = useState(() => (enabled ? monitorStore.get() : null));
  useEffect(() => {
    if (!enabled) { setMonitor(null); return undefined; }
    return monitorStore.subscribe(setMonitor);
  }, [enabled]);
  return monitor;
};

// ---------- Destinations (channels) ----------
// SELF-HOSTED: destinations are kept in local state and synced to the Cloudflare Worker via
// apiSaveDestinations. There is no real-time snapshot listener; channels are added/removed
// here and pushed to the API, and the UI reads the in-memory list.

const destinationsPayload = (list) => (list || []).map((d) => ({
  id: d.id,
  name: d.name,
  platform: d.platform,
  serverUrl: d.serverUrl,
  key: d._key || ''
}));

const syncDestinations = async () => {
  try { await apiSaveDestinations(destinationsPayload(destinationsStore.get())); }
  catch (e) { console.warn('Could not sync destinations to the server:', e); }
};

export const saveDestination = async ({ id, name, platform, serverUrl, key, uid, keyHint }) => {
  const now = new Date().toISOString();
  const recId = id || newId();
  destinationsStore.set((prev) => {
    const current = prev.find((d) => d.id === recId);
    const rec = {
      id: recId,
      name: name.slice(0, 60),
      platform,
      serverUrl,
      keyHint: key ? key.slice(-4) : (keyHint || ''),
      createdAt: current?.createdAt || now,
      updatedAt: now,
      updatedBy: uid || '',
      _key: key || current?._key || ''
    };
    const list = prev.some((d) => d.id === recId) ? prev.map((d) => (d.id === recId ? rec : d)) : [...prev, rec];
    return list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  });
  await syncDestinations();
  return destinationsStore.get().find((d) => d.id === recId);
};

export const removeSavedDestination = async (id) => {
  destinationsStore.set((prev) => prev.filter((d) => d.id !== id));
  await syncDestinations();
};

export const useDestinations = () => {
  const [destinations, setDestinations] = useState(() => destinationsStore.get());
  useEffect(() => destinationsStore.subscribe(setDestinations), []);
  const remove = useCallback(async (id) => { await removeSavedDestination(id); }, []);
  return { destinations, removeDestination: remove, saveDestination };
};

// ---------- Video clips (intros, outros) ----------
// SELF-HOSTED: there is no cloud file storage. A clip is kept as an object URL in this browser
// only for the session (not uploaded or shared to other computers), plus a thumbnail for the
// graphic tile. Re-upload a clip on each computer that needs to play it.

const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

// A thumbnail and the length, read from the file before adding
const describeVideo = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  const done = (result, error) => { URL.revokeObjectURL(url); if (error) reject(error); else resolve(result); };
  video.onloadedmetadata = () => { video.currentTime = Math.min(1, (video.duration || 2) / 2); };
  video.onseeked = () => {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 320 / (video.videoWidth || 320));
    canvas.width = Math.max(1, Math.round((video.videoWidth || 320) * scale));
    canvas.height = Math.max(1, Math.round((video.videoHeight || 180) * scale));
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    done({ thumbnail: canvas.toDataURL('image/jpeg', 0.7), duration: Math.round(video.duration || 0) });
  };
  video.onerror = () => done(null, new Error('This browser can\'t play that video. Use an MP4 (H.264) file.'));
  video.src = url;
});

export const addVideo = async (file, onProgress) => {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!['mp4', 'mov', 'm4v', 'webm'].includes(ext)) throw new Error('Use an MP4, MOV or WebM video.');
  if (file.size > MAX_VIDEO_BYTES) throw new Error('That video is over 300 MB. Shorten or compress it first.');
  const { thumbnail, duration } = await describeVideo(file);
  const id = newId();
  const objectUrl = URL.createObjectURL(file);
  clipUrls.set(id, objectUrl);
  onProgress?.(1);
  console.warn('self-hosted: video clips are stored in this browser only (no cloud upload) — re-upload on any other computer.');
  assetsStore.set((prev) => [...prev, {
    id,
    kind: 'video',
    name: (file.name || 'Video').replace(/\.[^.]+$/, '').slice(0, 80),
    dataUrl: thumbnail,
    size: file.size,
    duration,
    createdAt: new Date().toISOString()
  }].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
};

export const removeVideo = async (asset) => {
  const url = clipUrls.get(asset.id);
  if (url) { try { URL.revokeObjectURL(url); } catch { /* ignore */ } clipUrls.delete(asset.id); }
  assetsStore.set((prev) => prev.filter((a) => a.id !== asset.id));
};

const clipCache = new Map();
export const loadClip = (assetId) => {
  if (!clipCache.has(assetId)) {
    const url = clipUrls.get(assetId);
    if (!url) return Promise.reject(new Error('This clip is only available on the computer where it was added.'));
    clipCache.set(assetId, url);
  }
  return Promise.resolve(clipCache.get(assetId));
};

// ---------- Live status ----------
export const goLiveStatus = async () => {
  try {
    await apiSetLive(true);
    console.warn('self-hosted: GO LIVE ran — stream publish requires a manual RTMP key; point your encoder at the channel stream key.');
  } catch (e) { console.error('Go live status failed:', e); }
};

export const endLiveStatus = async () => {
  try {
    await apiSetLive(false);
    console.warn('self-hosted: end live status set — stop your encoder the same way you started it.');
  } catch (e) { console.error('End live status failed:', e); }
};
