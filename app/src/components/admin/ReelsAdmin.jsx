// Reels/shorts queue — staff. Queue clips the Local Studio makes, schedule them, upload
// the mp4, and the Worker posts each to YouTube as a Short through the week (Phase 4).
import { useEffect, useMemo, useRef, useState } from 'react';
import AdminNav from './AdminNav';
import { apiReels, apiReelCreate, apiReelUpload, apiReelRetry, apiReelDelete } from '../../api/client';

const STATUS = { pending: ['Pending', 'bg-church-cream text-church-navy border-church-border'], posted: ['Posted', 'bg-green-50 text-green-700 border-green-200'], error: ['Error', 'bg-red-50 text-red-600 border-red-200'] };

const ReelsAdmin = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ title: '', description: '', publishAt: '' });
  const fileRef = useRef(null);

  const load = async (keep = false) => { try { setList(await apiReels()); } catch (e) { setError(e?.message || 'Could not load the queue.'); } finally { if (!keep) setWorking(''); setLoading(false); } };
  useEffect(() => { load(true); }, []);

  const counts = useMemo(() => ({
    pending: list.filter((r) => r.status === 'pending').length,
    posted: list.filter((r) => r.status === 'posted').length,
    error: list.filter((r) => r.status === 'error').length
  }), [list]);

  const create = async () => {
    if (!draft.title.trim()) { setError('Give the reel a title.'); return; }
    setWorking('create'); setError('');
    try {
      const { id } = await apiReelCreate({ title: draft.title.trim(), description: draft.description, publish_at: draft.publishAt || null });
      setDraft({ title: '', description: '', publishAt: '' });
      await load(true);
      if (fileRef.current?.files?.[0]) { try { await apiReelUpload(id, fileRef.current.files[0]); } catch {} }
      setWorking('');
    } catch (e) { setError(e?.message || 'Could not add the reel.'); setWorking(''); }
  };

  const act = async (id, fn, label) => { setWorking(`${id}:${label}`); setError(''); try { await fn(); await load(true); } catch (e) { setError(e?.message || `Could not ${label}.`); setWorking(''); } };
  const upload = async (id) => { const f = fileRef.current?.files?.[0]; if (!f) return; setWorking(`${id}:upload`); setError(''); try { await apiReelUpload(id, f); await load(true); } catch (e) { setError(e?.message || 'Upload failed.'); setWorking(''); } };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Reels & shorts</h1>
            <p className="text-gray-600">Queue the clips the studio makes. Each gets posted to YouTube as a Short automatically through the week — set a date, or it posts on the next 15-minute tick. The video file should be vertical 9:16 and under ~60 seconds.</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span><strong className="text-church-navy">{counts.pending}</strong> queued</span>
              <span><strong className="text-green-700">{counts.posted}</strong> posted</span>
              <span><strong className="text-red-600">{counts.error}</strong> need attention</span>
            </div>
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

        <div className="mb-6 bg-white rounded-xl shadow-md p-5">
          <h3 className="font-bold text-gray-900 mb-3">Queue a clip</h3>
          <p className="text-xs text-gray-500 mb-3">Add it first, then attach the mp4 (or attach a saved clip file and it uploads here too).</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1"><input className="w-full px-3 py-2 rounded-lg border border-church-border text-sm" placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="sm:col-span-1"><input type="datetime-local" className="w-full px-3 py-2 rounded-lg border border-church-border text-sm" value={draft.publishAt} onChange={(e) => setDraft({ ...draft, publishAt: e.target.value })} /></div>
            <div className="sm:col-span-1"><input type="file" accept="video/mp4,video/quicktime" className="w-full text-sm" ref={fileRef} /></div>
            <div className="sm:col-span-3"><textarea className="w-full px-3 py-2 rounded-lg border border-church-border text-sm" rows={2} placeholder="Description (optional)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          </div>
          <button onClick={create} disabled={!!working} className="mt-3 px-4 py-2 rounded-lg bg-church-navy text-white text-sm font-medium hover:bg-church-navy-deep disabled:opacity-50">Queue + upload</button>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-10 text-center text-gray-500">Nothing in the queue yet. Add a clip above.</div>
        ) : (
          <div className="space-y-3">
            {list.map((r) => {
              const [sl, sc] = STATUS[r.status] || [r.status, 'bg-gray-100 text-gray-500'];
              return (
                <div key={r.id} className="bg-white rounded-xl shadow-md p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-serif text-lg font-semibold text-gray-900">{r.title || 'Untitled reel'}</h3>
                      <p className="text-xs text-gray-500">
                        {r.publish_at ? `scheduled ${new Date(r.publish_at).toLocaleString()}` : 'posts as soon as possible'}
                        {r.youtube_id ? ` · → youtube.com/shorts/${r.youtube_id}` : ''}
                        {r.error ? ` · ${r.error}` : ''}
                      </p>
                      {r.description && <p className="mt-1 text-sm text-gray-600">{r.description}</p>}
                    </div>
                    <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc}`}>{sl}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button disabled={!!working} onClick={() => upload(r.id)} className="px-3 py-1.5 rounded-lg bg-church-cream text-church-navy border border-church-border text-sm font-medium hover:bg-church-red hover:text-white disabled:opacity-50">Attach mp4</button>
                    {r.status !== 'posted' && <button disabled={!!working} onClick={() => act(r.id, () => apiReelRetry(r.id), 'retry')} className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50">Post now</button>}
                    <button disabled={!!working} onClick={() => act(r.id, () => apiReelDelete(r.id), 'remove')} className="px-3 py-1.5 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReelsAdmin;
