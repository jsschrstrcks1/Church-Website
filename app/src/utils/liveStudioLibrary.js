// Live Studio's saved library, shared by every admin:
//   liveStudio/library        scenes, lower thirds, ticker messages, QR codes
//   liveStudioAssets/{id}     uploaded logos, overlays, and backgrounds
//
// Pictures are kept as data: URLs in Firestore instead of in Storage. The stream canvas can
// only use same-origin pictures (see utils/liveMixer.js), and data: URLs always are. So they
// are resized before saving to stay under Firestore's 1 MB document limit.
import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { deleteObject, ref as storageRef, uploadBytesResumable } from 'firebase/storage';
import { auth, db, storage, CHURCH_NAME, CHURCH_NAME_ES, FUNCTIONS_BASE_URL } from '../firebase/config';

export const newId = () => Math.random().toString(36).slice(2, 10);

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

const libraryRef = () => doc(db, 'liveStudio', 'library');

export const useStudioLibrary = () => {
  const [library, setLibrary] = useState(null);
  const [assets, setAssets] = useState(null);

  useEffect(() => onSnapshot(libraryRef(), (snap) => {
    const data = snap.data() || {};
    setLibrary(Object.fromEntries(LIBRARY_KEYS.map((k) => [k, validFor(k, data[k]) ? data[k] : DEFAULT_LIBRARY[k]])));
  }, (error) => {
    console.error('Error loading the studio library:', error);
    setLibrary(DEFAULT_LIBRARY);
  }), []);

  useEffect(() => onSnapshot(collection(db, 'liveStudioAssets'), (snap) => {
    setAssets(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
  }, (error) => {
    console.error('Error loading studio graphics:', error);
    setAssets([]);
  }), []);

  // Replace one list (e.g. lowerThirds), or the stream details, in the shared library
  const saveList = useCallback(async (key, list) => {
    setLibrary((prev) => ({ ...prev, [key]: list }));
    await setDoc(libraryRef(), { [key]: list, updatedAt: new Date().toISOString() }, { merge: true });
  }, []);

  return { library, assets, saveList };
};

// Shrink a picture until it fits in a Firestore document. Backgrounds become JPEG; logos and
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
  await setDoc(doc(db, 'liveStudioAssets', newId()), {
    kind,
    name: (file.name || 'Picture').slice(0, 80),
    dataUrl,
    createdAt: new Date().toISOString()
  });
};

export const removeAsset = (id) => deleteDoc(doc(db, 'liveStudioAssets', id));

// ---------- What's on screen now (liveStudio/control) ----------
// Shared by every open studio, so a co-host on another computer can switch scenes, layouts,
// graphics and captions while the streaming computer sends the video.

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

const controlRef = () => doc(db, 'liveStudio', 'control');

export const useStudioControl = (uid) => {
  const [control, setControl] = useState(DEFAULT_CONTROL);

  useEffect(() => onSnapshot(controlRef(), (snap) => {
    const data = snap.data() || {};
    setControl(Object.fromEntries(Object.keys(DEFAULT_CONTROL).map((k) => [k, data[k] ?? DEFAULT_CONTROL[k]])));
  }, (error) => console.error('Error loading studio controls:', error)), []);

  // Change what's on screen: shows here at once, and on every other open studio a moment later
  const updateControl = useCallback((changes) => {
    setControl((prev) => ({ ...prev, ...changes }));
    setDoc(controlRef(), { ...changes, updatedAt: new Date().toISOString(), updatedBy: uid || '' }, { merge: true })
      .catch((error) => console.error('Error saving studio controls:', error));
  }, [uid]);

  return { control, updateControl };
};

// ---------- On-air preview for co-hosts (liveStudio/monitor) ----------

const monitorRef = () => doc(db, 'liveStudio', 'monitor');

export const postMonitor = (data) =>
  setDoc(monitorRef(), { ...data, updatedAt: new Date().toISOString() }).catch((error) => console.error('Error posting preview:', error));

export const useStudioMonitor = (enabled) => {
  const [monitor, setMonitor] = useState(null);
  useEffect(() => {
    if (!enabled) { setMonitor(null); return undefined; }
    return onSnapshot(monitorRef(), (snap) => setMonitor(snap.data() || null), (error) => console.error('Error loading preview:', error));
  }, [enabled]);
  return monitor;
};

// ---------- Video clips (intros, outros) ----------
// The file goes to Storage (liveStudioVideos/<id>.<ext>); liveStudioAssets/<id> holds its name,
// length and a thumbnail. To play one, the streaming computer downloads it through the
// liveStudioVideo function (see functions/src/liveStudioVideo.ts) into memory.

const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
const CLIP_URL = `${FUNCTIONS_BASE_URL}/liveStudioVideo`;

// A thumbnail and the length, read from the file before uploading
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
  const storagePath = `liveStudioVideos/${id}.${ext}`;
  const contentType = file.type || (ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4');
  await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef(storage, storagePath), file, { contentType });
    task.on('state_changed', (snap) => onProgress?.(snap.bytesTransferred / snap.totalBytes), reject, resolve);
  });
  await setDoc(doc(db, 'liveStudioAssets', id), {
    kind: 'video',
    name: (file.name || 'Video').replace(/\.[^.]+$/, '').slice(0, 80),
    dataUrl: thumbnail,
    storagePath,
    size: file.size,
    duration,
    createdAt: new Date().toISOString()
  });
};

export const removeVideo = async (asset) => {
  if (asset.storagePath) await deleteObject(storageRef(storage, asset.storagePath)).catch(() => {});
  await deleteDoc(doc(db, 'liveStudioAssets', asset.id));
};

// Download a clip into memory once; returns a blob: URL the stream canvas can draw
const clipCache = new Map();
export const loadClip = (assetId) => {
  if (!clipCache.has(assetId)) {
    const pending = (async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch(`${CLIP_URL}?id=${encodeURIComponent(assetId)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.text().catch(() => '')) || 'The clip could not be loaded.');
      return URL.createObjectURL(await res.blob());
    })();
    pending.catch(() => clipCache.delete(assetId));
    clipCache.set(assetId, pending);
  }
  return clipCache.get(assetId);
};
