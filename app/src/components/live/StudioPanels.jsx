// Live Studio's right-hand panels and the small editors they open.
// The page (components/admin/LiveStudio.jsx) owns what is on screen; these panels show the
// saved library and tell the page what to turn on or off.
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { addAsset, addVideo, newId, removeAsset, removeVideo, saveDestination } from '../../utils/liveStudioLibrary';

export const darkInput = 'w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white placeholder-white/40 focus:ring-2 focus:ring-church-blue focus:border-transparent outline-none';
const sectionTitle = 'text-sm font-semibold text-white/90';
const addButton = 'flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium text-white transition disabled:opacity-40';
const itemCard = (active) => `w-full text-left rounded-lg px-3 py-2.5 transition ${active ? 'bg-church-blue/25 ring-2 ring-church-blue' : 'bg-white/5 hover:bg-white/10'}`;

export const Icon = ({ d, className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
  </svg>
);

export const ICONS = {
  camera: 'M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  mic: 'M19 11a7 7 0 01-14 0m7 7v3m0-3a7 7 0 007-7M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3z',
  screen: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  plus: 'M12 4v16m8-8H4',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.41-9.41a2 2 0 112.83 2.83L11.83 15H9v-2.83l8.59-8.58z',
  trash: 'M19 7l-.87 12.14A2 2 0 0116.14 21H7.86a2 2 0 01-2-1.86L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  close: 'M6 18L18 6M6 6l12 12',
  broadcast: 'M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z',
  graphics: 'M4 16l4.59-4.59a2 2 0 012.82 0L16 16m-2-2l1.59-1.59a2 2 0 012.82 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  captions: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
  qr: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z',
  music: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
  play: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  pause: 'M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z',
  back: 'M15 19l-7-7 7-7'
};

// ---------- Generic dark modal ----------

export const Modal = ({ title, onClose, onSubmit, children, submitLabel = 'Save', saving = false, error = '' }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/60" onClick={onClose} />
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="relative bg-[#26262b] text-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="flex-1 px-5 py-2.5 bg-church-blue hover:brightness-110 disabled:opacity-60 text-white font-semibold rounded-lg transition">
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white/10 hover:bg-white/15 rounded-lg font-medium transition">Cancel</button>
      </div>
    </form>
  </div>
);

export const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-sm font-medium text-white/80 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-xs text-white/50 mt-1">{hint}</span>}
  </label>
);

const RowActions = ({ onEdit, onRemove, name }) => (
  <span className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
    <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 hover:text-church-gold" aria-label={`Edit ${name}`}><Icon d={ICONS.edit} className="w-4 h-4" /></button>
    <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1.5 hover:text-red-300" aria-label={`Remove ${name}`}><Icon d={ICONS.trash} className="w-4 h-4" /></button>
  </span>
);

// ---------- Destinations ----------

export const PLATFORMS = {
  youtube: {
    label: 'YouTube',
    serverUrl: 'rtmp://a.rtmp.youtube.com/live2',
    help: 'In YouTube Studio: Create → Go live → Stream. Copy the "Stream key".'
  },
  facebook: {
    label: 'Facebook',
    serverUrl: 'rtmps://live-api-s.facebook.com:443/rtmp/',
    help: 'On the church Facebook Page: Live video → Streaming software. Turn on "Use a persistent stream key" and copy it.'
  },
  twitch: {
    label: 'Twitch',
    serverUrl: 'rtmp://live.twitch.tv/app',
    help: 'Twitch Creator Dashboard → Settings → Stream → Primary stream key.'
  },
  custom: {
    label: 'Other (RTMP)',
    serverUrl: '',
    help: 'Paste the RTMP server address and stream key the service gives you.'
  }
};

const DestinationForm = ({ destination, uid, ytAuto, fbAuto, onClose }) => {
  const isNew = !destination.id;
  const startPlatform = destination.platform || 'youtube';
  const [draft, setDraft] = useState({
    platform: startPlatform,
    name: destination.name || '',
    serverUrl: destination.serverUrl ?? PLATFORMS[startPlatform].serverUrl,
    key: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const changePlatform = (platform) => setDraft((d) => ({
    ...d,
    platform,
    // Swap in the new platform's server unless the person typed their own
    serverUrl: !d.serverUrl || Object.values(PLATFORMS).some((p) => p.serverUrl === d.serverUrl) ? PLATFORMS[platform].serverUrl : d.serverUrl
  }));

  const save = async () => {
    setError('');
    const name = draft.name.trim() || PLATFORMS[draft.platform].label;
    const serverUrl = draft.serverUrl.trim();
    const key = draft.key.trim();
    if (!/^rtmps?:\/\/.{3,}/i.test(serverUrl)) { setError('The server address should start with rtmp:// or rtmps://'); return; }
    const automatic = (ytAuto && draft.platform === 'youtube') || (fbAuto && draft.platform === 'facebook');
    if (isNew && !key && !automatic) { setError('Paste the stream key.'); return; }
    setSaving(true);
    try {
      await saveDestination({
        id: destination.id || '',
        name,
        platform: draft.platform,
        serverUrl,
        key,
        uid,
        keyHint: destination.keyHint || ''
      });
      onClose();
    } catch (err) {
      console.error('Error saving destination:', err);
      setError('Could not save. Check the details and try again.');
      setSaving(false);
    }
  };

  return (
    <Modal title={isNew ? 'Add a channel' : 'Edit channel'} onClose={onClose} onSubmit={save} saving={saving} error={error}>
      <Field label="Platform" hint={PLATFORMS[draft.platform].help}>
        <select value={draft.platform} onChange={(e) => changePlatform(e.target.value)} className={darkInput}>
          {Object.entries(PLATFORMS).map(([id, p]) => <option key={id} value={id} className="text-black">{p.label}</option>)}
        </select>
      </Field>
      <Field label="Name">
        <input type="text" maxLength={60} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder={`e.g. Church ${PLATFORMS[draft.platform].label}`} className={darkInput} />
      </Field>
      <Field label="Server address">
        <input type="text" value={draft.serverUrl} onChange={(e) => setDraft({ ...draft, serverUrl: e.target.value })}
          placeholder="rtmp://..." className={`${darkInput} font-mono text-sm`} spellCheck={false} />
      </Field>
      {(ytAuto && draft.platform === 'youtube') || (fbAuto && draft.platform === 'facebook') ? (
        <p className="text-sm text-white/70">{PLATFORMS[draft.platform].label} is connected, so no stream key is needed: GO LIVE sets it up automatically.</p>
      ) : (
        <Field label="Stream key" hint="Keep this secret: anyone with it can stream to the account. Once saved it can't be viewed again, only replaced.">
          <input type="password" autoComplete="off" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })}
            placeholder={isNew ? 'Paste the stream key' : `Saved (ends in ${destination.keyHint || '••••'}). Leave blank to keep it.`}
            className={`${darkInput} font-mono text-sm`} spellCheck={false} />
        </Field>
      )}
    </Modal>
  );
};

// Automatic setup: connect the church's YouTube channel and Facebook Page once; GO LIVE then
// creates each broadcast on both (title, description, privacy below), and End stream ends them.
const ConnectRow = ({ label, connected, name, configured, busy, idle, onConnect, onDisconnect, children }) => {
  if (!configured) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {connected
          ? <span className="text-xs text-green-400 font-semibold">Connected</span>
          : <span className="text-xs text-white/50">Not connected</span>}
      </div>
      {connected ? (
        <p className="text-xs text-white/60">
          {name || label} · set up automatically at each GO LIVE.{' '}
          {idle && <button onClick={onDisconnect} className="underline hover:text-white">Disconnect</button>}
        </p>
      ) : children || (
        <button onClick={onConnect} disabled={busy} className="w-full px-3 py-2 rounded-lg bg-church-red hover:bg-church-red-dark text-sm font-semibold disabled:opacity-50">
          {busy ? 'Opening…' : `Connect ${label}`}
        </button>
      )}
    </div>
  );
};

const AutoSetupBox = ({ auto, stream, onStream, onConnect, onDisconnect, onChoosePage, idle, busy }) => {
  const [title, setTitle] = useState(stream?.title || '');
  const [description, setDescription] = useState(stream?.description || '');
  useEffect(() => { setTitle(stream?.title || ''); setDescription(stream?.description || ''); }, [stream?.title, stream?.description]);
  if (!auto?.configured && !auto?.facebookConfigured) return null; // not switched on yet (see functions/src/youtube.ts, facebook.ts)
  const anyConnected = auto.connected || auto.facebookConnected;
  return (
    <div className="rounded-lg bg-white/5 p-3 space-y-4">
      <div>
        <p className="text-sm font-semibold">Automatic setup</p>
        <p className="text-xs text-white/60 mt-1">Connect once. Then GO LIVE starts the broadcast on each connected site by itself: no stream keys, no YouTube Studio or Facebook Live Producer.</p>
      </div>
      <ConnectRow label="YouTube" configured={auto.configured} connected={auto.connected} name={auto.channelTitle}
        busy={busy === 'youtube'} idle={idle} onConnect={() => onConnect('youtube')} onDisconnect={() => onDisconnect('youtube')} />
      <ConnectRow label="Facebook" configured={auto.facebookConfigured} connected={auto.facebookConnected} name={auto.pageName}
        busy={busy === 'facebook'} idle={idle} onConnect={() => onConnect('facebook')} onDisconnect={() => onDisconnect('facebook')}>
        {auto.choosePages?.length ? (
          <div className="space-y-2">
            <p className="text-xs text-white/70">Which Page is the church's?</p>
            {auto.choosePages.map((p) => (
              <button key={p.id} onClick={() => onChoosePage(p.id)} className="w-full text-left px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm">{p.name}</button>
            ))}
          </div>
        ) : null}
      </ConnectRow>
      {anyConnected && (
        <>
          <Field label="Title">
            <input type="text" maxLength={100} value={title} disabled={!idle} onChange={(e) => setTitle(e.target.value)}
              onBlur={() => onStream({ ...stream, title: title.trim() })} placeholder={auto.defaultTitle || 'Sunday Worship'} className={darkInput} />
          </Field>
          <Field label="Description (optional)">
            <textarea rows={2} maxLength={4900} value={description} disabled={!idle} onChange={(e) => setDescription(e.target.value)}
              onBlur={() => onStream({ ...stream, description })} className={darkInput} />
          </Field>
          <Field label="Who can watch" hint="Unlisted (tests): YouTube only by link, Facebook as a private preview, and not on the website.">
            <select value={stream?.privacy || 'public'} disabled={!idle} onChange={(e) => onStream({ ...stream, title: title.trim(), description, privacy: e.target.value })} className={darkInput}>
              <option value="public" className="text-black">Public</option>
              <option value="unlisted" className="text-black">Unlisted (tests)</option>
            </select>
          </Field>
        </>
      )}
    </div>
  );
};

export const DestinationsPanel = ({ destinations, selected, onToggle, phase, broadcast, uid, onRemove, auto, stream, onStream, onConnect, onDisconnect, onChoosePage, connectBusy }) => {
  const [editing, setEditing] = useState(null);
  const idle = phase === 'idle';

  const resultFor = (id) => {
    const index = broadcast?.destinations?.findIndex((d) => d.id === id) ?? -1;
    return index >= 0 ? broadcast?.results?.[index] : undefined;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={sectionTitle}>Stream to</h3>
        <button onClick={() => setEditing({})} disabled={!idle} className={addButton}><Icon d={ICONS.plus} className="w-4 h-4" /> Add channel</button>
      </div>
      <AutoSetupBox auto={auto} stream={stream} onStream={onStream} onConnect={onConnect} onDisconnect={onDisconnect}
        onChoosePage={onChoosePage} idle={idle} busy={connectBusy} />
      {phase === 'live' && (broadcast?.youtubeWatchUrl || broadcast?.facebookWatchUrl) && (
        <p className="text-sm space-x-3">
          {broadcast.youtubeWatchUrl && <a href={broadcast.youtubeWatchUrl} target="_blank" rel="noopener noreferrer" className="text-church-gold underline">Open on YouTube</a>}
          {broadcast.facebookWatchUrl && <a href={broadcast.facebookWatchUrl} target="_blank" rel="noopener noreferrer" className="text-church-gold underline">Open on Facebook</a>}
        </p>
      )}
      {destinations === null ? (
        <p className="text-sm text-white/50">Loading…</p>
      ) : destinations.length === 0 ? (
        <p className="text-sm text-white/60">Add the church's YouTube channel, Facebook Page, or any RTMP service. Tick the ones to stream to: you can go live on all of them at once.</p>
      ) : (
        <ul className="space-y-2">
          {destinations.map((d) => {
            const onAir = phase === 'live' && broadcast?.destinations?.some((b) => b.id === d.id);
            const result = resultFor(d.id);
            return (
              <li key={d.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5">
                <input type="checkbox" checked={phase === 'live' ? !!onAir : selected.has(d.id)} disabled={!idle}
                  onChange={() => onToggle(d.id)} className="w-4 h-4 accent-church-blue" aria-label={`Stream to ${d.name}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{d.name}</p>
                  <p className="text-xs text-white/50 truncate">
                    {PLATFORMS[d.platform]?.label || 'RTMP'}{(auto?.connected && d.platform === 'youtube') || (auto?.facebookConnected && d.platform === 'facebook') ? ' · automatic' : ''}
                    {onAir && (result?.status === 'failed'
                      ? <span className="text-red-300 font-semibold"> · Failed{result.error ? `: ${result.error}` : ''}</span>
                      : result?.status === 'active' ? <span className="text-green-400 font-semibold"> · Live</span>
                        : result?.status === 'reconnecting' || result?.status === 'behind'
                          ? <span className="text-church-gold font-semibold"> · Reconnecting{result.error ? `: ${result.error}` : ''}</span>
                          : <span> · Connecting…</span>)}
                  </p>
                </div>
                {idle && <RowActions name={d.name} onEdit={() => setEditing(d)} onRemove={() => onRemove(d)} />}
              </li>
            );
          })}
        </ul>
      )}
      <div className="pt-3 border-t border-white/10 text-xs text-white/50 space-y-2">
        <p>Keep this tab open while you're live. Closing it ends the stream.</p>
        <p>Set the stream's title and description on YouTube and Facebook before going live.</p>
      </div>
      {editing && <DestinationForm destination={editing} uid={uid} ytAuto={!!auto?.connected} fbAuto={!!auto?.facebookConnected} onClose={() => setEditing(null)} />}
    </div>
  );
};

// ---------- Graphics ----------

const GRAPHIC_KINDS = [
  { kind: 'logo', title: 'Logo', hint: 'Shown in the top-left corner during live scenes, and on title cards.' },
  { kind: 'overlay', title: 'Overlay', hint: 'A full-screen picture on top of everything. Use a 1280×720 PNG with a see-through middle.' },
  { kind: 'background', title: 'Background', hint: 'Behind the video, title cards, and countdown.' }
];

const formatDuration = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.round(s || 0) % 60).padStart(2, '0')}`;

// Video clips: click to play full screen on the stream (with sound); click again to stop
const VideoClips = ({ assets, clip, onClip }) => {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const clips = (assets || []).filter((a) => a.kind === 'video');

  const upload = async (file) => {
    if (!file) return;
    setError('');
    setProgress(0);
    try {
      await addVideo(file, setProgress);
    } catch (err) {
      console.error('Video upload failed:', err);
      setError(err.message || 'Upload failed.');
    }
    setProgress(null);
  };

  const remove = async (asset) => {
    if (!window.confirm(`Remove the "${asset.name}" clip?`)) return;
    if (clip?.id === asset.id) onClip(asset);
    await removeVideo(asset).catch((err) => console.error(err));
  };

  return (
    <section>
      <h3 className={`${sectionTitle} mb-1`}>Video clips</h3>
      <p className="text-xs text-white/50 mb-3">Intros, outros, announcements. Click one to play it full screen on the stream, with its sound; it returns to the scene when it ends. MP4 works best (up to 300 MB).</p>
      {error && <p className="text-sm text-red-300 mb-2">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        {clips.map((a) => {
          const playing = clip?.id === a.id;
          return (
            <div key={a.id} className="relative group">
              <button onClick={() => onClip(a)} title={playing ? 'Stop' : `Play "${a.name}"`}
                className={`relative block w-full aspect-video rounded-lg overflow-hidden bg-black ${playing ? 'ring-2 ring-church-red' : 'ring-1 ring-white/10 hover:ring-white/30'}`}>
                {a.dataUrl && <img src={a.dataUrl} alt="" className="w-full h-full object-cover" />}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center">
                    <Icon d={playing ? 'M6 6h12v12H6z' : 'M8 5v14l11-7z'} className="w-5 h-5" />
                  </span>
                </span>
                <span className="absolute right-1 bottom-1 px-1 rounded bg-black/70 text-[10px] font-mono">{formatDuration(a.duration)}</span>
                {playing && <span className="absolute left-1 top-1 px-1.5 rounded bg-church-red text-[10px] font-bold">{clip.status === 'loading' ? 'LOADING' : 'PLAYING'}</span>}
              </button>
              <p className="mt-1 text-xs text-white/70 truncate">{a.name}</p>
              <button onClick={() => remove(a)} className="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-6 h-6 items-center justify-center rounded-full bg-black/80 text-white" aria-label={`Remove ${a.name}`}>
                <Icon d={ICONS.close} className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
        <button onClick={() => inputRef.current?.click()} disabled={progress !== null}
          className="aspect-video rounded-lg bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center text-white/80 gap-1" aria-label="Upload a video clip">
          {progress !== null ? (
            <>
              <span className="text-xs">Uploading {Math.round(progress * 100)}%</span>
              <span className="w-3/4 h-1 rounded bg-white/10 overflow-hidden"><span className="block h-full bg-church-blue" style={{ width: `${progress * 100}%` }} /></span>
            </>
          ) : <Icon d={ICONS.plus} className="w-6 h-6" />}
        </button>
        <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm" className="hidden"
          onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
    </section>
  );
};

export const GraphicsPanel = ({ assets, active, onToggle, clip, onClip }) => {
  const inputs = useRef({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const upload = async (kind, file) => {
    if (!file) return;
    setBusy(kind);
    setError('');
    try {
      await addAsset(kind, file);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.message || 'Upload failed.');
    }
    setBusy('');
  };

  const remove = async (asset) => {
    if (!window.confirm(`Remove "${asset.name}" from the studio?`)) return;
    if (active[asset.kind] === asset.id) onToggle(asset.kind, asset.id);
    await removeAsset(asset.id).catch((err) => console.error(err));
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-300">{error}</p>}
      {GRAPHIC_KINDS.map(({ kind, title, hint }) => (
        <section key={kind}>
          <h3 className={`${sectionTitle} mb-1`}>{title}</h3>
          <p className="text-xs text-white/50 mb-3">{hint}</p>
          <div className="grid grid-cols-3 gap-2">
            {(assets || []).filter((a) => a.kind === kind).map((a) => (
              <div key={a.id} className="relative group">
                <button onClick={() => onToggle(kind, a.id)} title={a.name}
                  className={`block w-full aspect-video rounded-lg overflow-hidden bg-[repeating-conic-gradient(#3a3a40_0%_25%,#2c2c31_0%_50%)] bg-[length:16px_16px] ${active[kind] === a.id ? 'ring-2 ring-church-blue' : 'ring-1 ring-white/10 hover:ring-white/30'}`}>
                  <img src={a.dataUrl} alt={a.name} className={`w-full h-full ${kind === 'background' ? 'object-cover' : 'object-contain'}`} />
                </button>
                <button onClick={() => remove(a)} className="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-6 h-6 items-center justify-center rounded-full bg-black/80 text-white" aria-label={`Remove ${a.name}`}>
                  <Icon d={ICONS.close} className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button onClick={() => inputs.current[kind]?.click()} disabled={busy === kind}
              className="aspect-video rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80" aria-label={`Upload a ${title.toLowerCase()}`}>
              {busy === kind ? <span className="text-xs">Uploading…</span> : <Icon d={ICONS.plus} className="w-6 h-6" />}
            </button>
            <input ref={(el) => { inputs.current[kind] = el; }} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { upload(kind, e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        </section>
      ))}
      <VideoClips assets={assets} clip={clip} onClip={onClip} />
    </div>
  );
};

// ---------- Captions: lower thirds and ticker ----------

const LowerThirdForm = ({ item, onSave, onClose }) => {
  const [title, setTitle] = useState(item.title || '');
  const [subtitle, setSubtitle] = useState(item.subtitle || '');
  const [error, setError] = useState('');
  return (
    <Modal title={item.id ? 'Edit lower third' : 'Add a lower third'} onClose={onClose} error={error}
      onSubmit={() => { if (!title.trim()) { setError('Add a name or title.'); return; } onSave({ id: item.id || newId(), title: title.trim(), subtitle: subtitle.trim() }); }}>
      <Field label="Name or title"><input autoFocus type="text" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pastor Name" className={darkInput} /></Field>
      <Field label="Second line (optional)"><input type="text" maxLength={100} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. Find Your Place / Encuentra tu Lugar" className={darkInput} /></Field>
    </Modal>
  );
};

const TickerForm = ({ item, onSave, onClose }) => {
  const [text, setText] = useState(item.text || '');
  const [error, setError] = useState('');
  return (
    <Modal title={item.id ? 'Edit ticker message' : 'Add a ticker message'} onClose={onClose} error={error}
      onSubmit={() => { if (!text.trim()) { setError('Type a message.'); return; } onSave({ id: item.id || newId(), text: text.trim() }); }}>
      <Field label="Message" hint="Scrolls along the bottom of the stream.">
        <textarea autoFocus rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} className={darkInput} />
      </Field>
    </Modal>
  );
};

// Shared add / edit / remove for a saved list
const useListEditor = (list, key, saveList) => {
  const [editing, setEditing] = useState(null);
  const save = (item) => {
    const exists = list.some((i) => i.id === item.id);
    saveList(key, exists ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item]).catch((e) => console.error(e));
    setEditing(null);
  };
  const remove = (item) => {
    if (window.confirm('Remove this from the studio?')) saveList(key, list.filter((i) => i.id !== item.id)).catch((e) => console.error(e));
  };
  return { editing, setEditing, save, remove };
};

const TICKER_SPEEDS = [{ value: 60, label: 'Slow' }, { value: 110, label: 'Normal' }, { value: 180, label: 'Fast' }];

export const CaptionsPanel = ({ library, saveList, activeLowerThird, activeTicker, onLowerThird, onTicker, tickerSpeed = 110, onTickerSpeed }) => {
  const lowerThirds = useListEditor(library.lowerThirds, 'lowerThirds', saveList);
  const tickers = useListEditor(library.tickers, 'tickers', saveList);
  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className={sectionTitle}>Lower third</h3>
          <button onClick={() => lowerThirds.setEditing({})} className={addButton}><Icon d={ICONS.plus} className="w-4 h-4" /> Add</button>
        </div>
        <p className="text-xs text-white/50 mb-3">Click one to show it on the stream; click again to hide it.</p>
        <div className="space-y-2">
          {library.lowerThirds.map((item) => (
            <div key={item.id} className={`group flex items-start gap-2 ${itemCard(activeLowerThird === item.id)}`}>
              <button onClick={() => onLowerThird(item)} className="flex-1 min-w-0 text-left">
                <p className="font-semibold truncate">{item.title}</p>
                {item.subtitle && <p className="text-sm text-white/70 truncate">{item.subtitle}</p>}
              </button>
              <RowActions name={item.title} onEdit={() => lowerThirds.setEditing(item)} onRemove={() => lowerThirds.remove(item)} />
            </div>
          ))}
          {library.lowerThirds.length === 0 && <p className="text-sm text-white/40">Add the names of speakers, songs, or sermon titles.</p>}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className={sectionTitle}>Ticker</h3>
          <button onClick={() => tickers.setEditing({})} className={addButton}><Icon d={ICONS.plus} className="w-4 h-4" /> Add</button>
        </div>
        <p className="text-xs text-white/50 mb-3">A message that scrolls along the bottom.</p>
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-white/80">Speed</span>
            <span className="flex gap-1">
              {TICKER_SPEEDS.map((sp) => (
                <button key={sp.value} onClick={() => onTickerSpeed(sp.value)}
                  className={`px-2 py-0.5 rounded text-xs ${Math.abs(tickerSpeed - sp.value) < 10 ? 'bg-church-blue text-white' : 'bg-white/10 hover:bg-white/15'}`}>{sp.label}</button>
              ))}
            </span>
          </div>
          <input type="range" min="30" max="300" step="10" value={tickerSpeed} onChange={(e) => onTickerSpeed(Number(e.target.value))}
            className="w-full accent-church-blue" aria-label="Ticker speed" />
        </div>
        <div className="space-y-2">
          {library.tickers.map((item) => (
            <div key={item.id} className={`group flex items-start gap-2 ${itemCard(activeTicker === item.id)}`}>
              <button onClick={() => onTicker(item)} className="flex-1 min-w-0 text-left font-medium line-clamp-2">{item.text}</button>
              <RowActions name="ticker message" onEdit={() => tickers.setEditing(item)} onRemove={() => tickers.remove(item)} />
            </div>
          ))}
        </div>
      </section>

      {lowerThirds.editing && <LowerThirdForm item={lowerThirds.editing} onSave={lowerThirds.save} onClose={() => lowerThirds.setEditing(null)} />}
      {tickers.editing && <TickerForm item={tickers.editing} onSave={tickers.save} onClose={() => tickers.setEditing(null)} />}
    </div>
  );
};

// ---------- QR codes ----------

export const qrDataUrl = (url) => QRCode.toDataURL(url, { margin: 1, width: 340, errorCorrectionLevel: 'M', color: { dark: '#10295e', light: '#ffffff' } });

const QrThumb = ({ url }) => {
  const [src, setSrc] = useState('');
  useEffect(() => { qrDataUrl(url).then(setSrc).catch(() => setSrc('')); }, [url]);
  return src ? <img src={src} alt="" className="w-12 h-12 rounded bg-white flex-shrink-0" /> : <span className="w-12 h-12 rounded bg-white/10 flex-shrink-0" />;
};

const QrForm = ({ item, onSave, onClose }) => {
  const [label, setLabel] = useState(item.label || '');
  const [url, setUrl] = useState(item.url || '');
  const [error, setError] = useState('');
  return (
    <Modal title={item.id ? 'Edit QR code' : 'Add a QR code'} onClose={onClose} error={error}
      onSubmit={() => {
        if (!/^https?:\/\/\S+\.\S+/i.test(url.trim())) { setError('Enter a full web address starting with https://'); return; }
        onSave({ id: item.id || newId(), label: label.trim(), url: url.trim() });
      }}>
      <Field label="Label" hint="Shown under the code, e.g. Donate · Ofrendar"><input autoFocus type="text" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} className={darkInput} /></Field>
      <Field label="Web address"><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={darkInput} /></Field>
    </Modal>
  );
};

export const QrPanel = ({ library, saveList, activeQr, onQr }) => {
  const qrs = useListEditor(library.qrCodes, 'qrCodes', saveList);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={sectionTitle}>QR codes</h3>
        <button onClick={() => qrs.setEditing({})} className={addButton}><Icon d={ICONS.plus} className="w-4 h-4" /> Add</button>
      </div>
      <p className="text-xs text-white/50">Viewers scan it with their phone camera. Shown in the top-right corner.</p>
      {library.qrCodes.map((item) => (
        <div key={item.id} className={`group flex items-center gap-3 ${itemCard(activeQr === item.id)}`}>
          <button onClick={() => onQr(item)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
            <QrThumb url={item.url} />
            <span className="min-w-0">
              <span className="block font-semibold truncate">{item.label || 'QR code'}</span>
              <span className="block text-xs text-white/60 truncate">{item.url}</span>
            </span>
          </button>
          <RowActions name={item.label || 'QR code'} onEdit={() => qrs.setEditing(item)} onRemove={() => qrs.remove(item)} />
        </div>
      ))}
      {library.qrCodes.length === 0 && <p className="text-sm text-white/40">Add the online giving page, the church website, or a sign-up form.</p>}
      {qrs.editing && <QrForm item={qrs.editing} onSave={qrs.save} onClose={() => qrs.setEditing(null)} />}
    </div>
  );
};

// ---------- Music ----------
// Files are picked from this computer each time (not uploaded): only use music the church
// has the right to stream, or YouTube and Facebook may mute or take down the video.

export const MusicPanel = ({ mixer }) => {
  const [tracks, setTracks] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [volume, setVolume] = useState(0.5);
  const inputRef = useRef(null);

  // Free the files' memory when the panel goes away (not on every change: they're still in use)
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  useEffect(() => () => tracksRef.current.forEach((t) => URL.revokeObjectURL(t.url)), []);
  useEffect(() => { mixer?.setMusicVolume(volume); }, [mixer, volume]);

  const add = (files) => {
    const added = [...files].filter((f) => f.type.startsWith('audio/')).map((f) => ({ id: newId(), name: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f) }));
    setTracks((t) => [...t, ...added]);
  };

  const toggle = (track) => {
    if (!mixer) return;
    if (playing === track.id) {
      mixer.pauseMusic();
      setPlaying(null);
    } else {
      mixer.playMusic(track.url).then(() => setPlaying(track.id)).catch((e) => console.error('Music error:', e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={sectionTitle}>Music</h3>
        <button onClick={() => inputRef.current?.click()} className={addButton}><Icon d={ICONS.plus} className="w-4 h-4" /> Add files</button>
        <input ref={inputRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => { add(e.target.files || []); e.target.value = ''; }} />
      </div>
      <p className="text-xs text-white/50">
        Plays into the stream (not out loud here), on repeat. Good for before and after the service. Only use music the church has permission to stream.
        Files stay on this computer: add them again next time.
      </p>
      <label className="flex items-center gap-3 text-sm">
        <span className="text-white/70 w-16">Volume</span>
        <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="flex-1 accent-church-blue" />
      </label>
      <div className="space-y-2">
        {tracks.map((t) => (
          <button key={t.id} onClick={() => toggle(t)} className={`flex items-center gap-3 ${itemCard(playing === t.id)}`}>
            <Icon d={playing === t.id ? ICONS.pause : ICONS.play} className="w-6 h-6 flex-shrink-0" />
            <span className="truncate font-medium">{t.name}</span>
          </button>
        ))}
        {tracks.length === 0 && <p className="text-sm text-white/40">No music added yet.</p>}
      </div>
    </div>
  );
};

// ---------- Live chat (YouTube + Facebook) ----------
// Messages arrive from the liveChat collection (the streaming computer fetches them while live).
// Click a message to show it on the stream; click again to hide it.

const PLATFORM_BADGE = {
  youtube: { label: 'YouTube', className: 'bg-red-600' },
  facebook: { label: 'Facebook', className: 'bg-[#1877f2]' }
};

const CHAT_FB_SCOPES = ['pages_read_user_content', 'pages_manage_engagement'];

export const ChatPanel = ({ messages, live, available, errors, shownId, onShow, onSend, facebookScopes }) => {
  // Permissions the Facebook connection is missing for comments (null = unknown)
  const missingFb = available.facebook && Array.isArray(facebookScopes) ? CHAT_FB_SCOPES.filter((p) => !facebookScopes.includes(p)) : [];
  const listRef = useRef(null);
  const [text, setText] = useState('');
  const [to, setTo] = useState({ youtube: true, facebook: true });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Keep the newest message in view, unless someone has scrolled up to read
  useEffect(() => {
    const el = listRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  const platforms = Object.keys(to).filter((p) => to[p] && available[p]);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || platforms.length === 0) return;
    setSending(true);
    setSendError('');
    try {
      const result = await onSend(text, platforms);
      const failed = Object.entries(result?.errors || {});
      if (failed.length) setSendError(failed.map(([p, m]) => `${PLATFORM_BADGE[p]?.label || p}: ${m}`).join(' · '));
      else setText('');
    } catch (err) {
      setSendError(err.message || 'Could not send.');
    }
    setSending(false);
  };

  if (!available.youtube && !available.facebook) {
    return <p className="text-sm text-white/60">Chat works with the automatic setup: connect YouTube and/or Facebook under Channels → Automatic setup.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-white/50">
        {live ? 'New messages show here within a few seconds. Click one to show it on the stream.' : 'Chat appears here while you\'re live.'}
      </p>
      {missingFb.length > 0 && (
        <div className="text-xs text-church-gold bg-church-gold/10 rounded-lg p-2 space-y-1">
          <p><strong>Facebook comments need:</strong> {missingFb.join(', ')}.</p>
          <p>In developers.facebook.com: your app → Facebook Login for Business → Configurations → Live Studio → edit permissions and add {missingFb.length > 1 ? 'them' : 'it'}. Then here: Channels → Facebook → Disconnect, and Connect Facebook again (allow everything it asks).</p>
        </div>
      )}
      {Object.entries(errors || {}).filter(([p]) => !(p === 'facebook' && missingFb.length)).map(([p, m]) => (
        <p key={p} className="text-xs text-church-gold">
          {PLATFORM_BADGE[p]?.label}: {/permission|#10|#200|pages_read_user_content/i.test(m)
            ? 'Facebook comments need two more permissions (pages_read_user_content, pages_manage_engagement) in the Meta configuration; then Connect Facebook again.'
            : m}
        </p>
      ))}
      <div ref={listRef} className="h-[50vh] lg:h-[calc(100vh-380px)] min-h-[200px] overflow-y-auto space-y-2 pr-1">
        {(messages || []).length === 0 && <p className="text-sm text-white/40">No messages yet.</p>}
        {(messages || []).map((m) => {
          const badge = PLATFORM_BADGE[m.platform];
          const shown = shownId === m.id;
          return (
            <button key={m.id} onClick={() => onShow(m)} title={shown ? 'Hide from the stream' : 'Show on the stream'}
              className={`w-full text-left rounded-lg px-3 py-2 transition ${shown ? 'bg-church-blue/25 ring-2 ring-church-blue' : m.mine ? 'bg-white/10 hover:bg-white/15' : 'bg-white/5 hover:bg-white/10'}`}>
              <span className="flex items-center gap-2 text-xs mb-0.5">
                {badge && <span className={`px-1.5 rounded text-[10px] font-bold ${badge.className}`}>{badge.label}</span>}
                <span className="font-semibold truncate">{m.author}</span>
                <span className="ml-auto text-white/40 flex-shrink-0">{new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              </span>
              <span className="block text-sm break-words">{m.text}</span>
              {shown && <span className="block text-[10px] font-bold text-church-gold mt-1">ON THE STREAM</span>}
            </button>
          );
        })}
      </div>
      <form onSubmit={send} className="space-y-2">
        <div className="flex gap-3 text-xs">
          {['youtube', 'facebook'].filter((p) => available[p]).map((p) => (
            <label key={p} className="flex items-center gap-1.5">
              <input type="checkbox" checked={to[p]} onChange={(e) => setTo({ ...to, [p]: e.target.checked })} className="accent-church-blue" />
              Reply on {PLATFORM_BADGE[p].label}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" maxLength={200} value={text} onChange={(e) => setText(e.target.value)} disabled={!live || sending}
            placeholder={live ? 'Type a message as the church…' : 'Go live to chat'} className={`${darkInput} flex-1 min-w-0`} />
          <button type="submit" disabled={!live || sending || !text.trim() || platforms.length === 0}
            className="px-3 rounded-lg bg-church-blue disabled:opacity-40 text-sm font-semibold">{sending ? '…' : 'Send'}</button>
        </div>
        {sendError && <p className="text-xs text-red-300">{sendError}</p>}
      </form>
    </div>
  );
};
