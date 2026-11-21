// Sermons admin — staff. Create/publish a sermon, mark it curated (public) or members-only,
// trigger transcription (Workers AI Whisper), and view the transcript. The video itself is
// uploaded at clip time by the Local Studio (R2); this screen manages the listing/entry.
import { useEffect, useMemo, useState } from 'react';
import AdminNav from './AdminNav';
import { useMemberAuth } from '../../context/MemberAuthContext';
import { apiSermons, apiSermonCreate, apiSermonPublish, apiSermonTranscribe } from '../../api/client';

const inputClass = 'w-full px-3 py-2 rounded-lg border border-church-border bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-church-navy/30';

const SermonAdmin = () => {
  const { memberProfile } = useMemberAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ title: '', date: new Date().toISOString().slice(0, 10), mode: 'sunday', visibility: 'public', description: '', mediaKey: '' });

  const load = async (keepWorking = false) => {
    try { setList(await apiSermons()); }
    catch (e) { setError(e?.message || 'Could not load sermons.'); }
    finally { if (!keepWorking) setWorking(''); setLoading(false); }
  };
  useEffect(() => { load(true); }, []);

  const counts = useMemo(() => ({
    live: list.filter((s) => s.published).length,
    curated: list.filter((s) => s.published && s.visibility === 'public').length,
    transcribed: list.filter((s) => s.transcript_updated_at).length
  }), [list]);

  const act = async (id, fn, label, keepWorking) => {
    setWorking(`${id}:${label}`); setError('');
    try { await fn(); await load(keepWorking); }
    catch (e) { if (e?.status === 501) setError(`Transcripts aren't configured on the deployed backend yet (needs the R2 + AI bindings en route). Create/publish works — transcription comes online at deploy.`); else setError(e?.message || `Could not ${label}.`); }
    if (!keepWorking) setWorking('');
  };

  const create = async () => {
    if (!draft.title.trim()) { setError('Give the sermon a title.'); return; }
    setWorking('create'); setError('');
    try { const { id } = await apiSermonCreate({ ...draft, published: draft.title && false }); setDraft({ title: '', date: new Date().toISOString().slice(0, 10), mode: 'sunday', visibility: 'public', description: '', mediaKey: '' }); setShowForm(false); await load(); }
    catch (e) { setError(e?.message || 'Could not create sermon.'); setWorking(''); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Sermons</h1>
            <p className="text-gray-600">Publish sermons from the weekly captures. Mark a sermon <strong>Public</strong> to curate it for everyone (aim: 1–2 open); the rest play for any logged-in member.</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span><strong className="text-church-navy">{counts.live}</strong> published</span>
              <span><strong className="text-green-700">{counts.curated}</strong> public (curated)</span>
              <span><strong className="text-gray-600">{counts.transcribed}</strong> with transcript</span>
            </div>
          </div>
          <button onClick={() => setShowForm((v) => !v)} className="px-4 py-2 rounded-lg bg-church-navy text-white text-sm font-medium hover:bg-church-navy-deep">{showForm ? 'Cancel' : '+ New sermon'}</button>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

        {showForm && (
          <div className="mb-6 bg-white rounded-xl shadow-md p-5">
            <h3 className="font-bold text-gray-900 mb-3">Add a sermon</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Title</label><input className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Grace for the Weary" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" className={inputClass} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Service</label><select className={inputClass} value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value })}><option value="sunday">Sunday</option><option value="wednesday">Wednesday</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Audience</label><select className={inputClass} value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value })}><option value="public">Public (curated — everyone)</option><option value="members">Members only</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">R2 media key</label><input className={inputClass} value={draft.mediaKey} onChange={(e) => setDraft({ ...draft, mediaKey: e.target.value })} placeholder="inner path of the uploaded mp4 (from the studio upload)" /></div>
              <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea className={inputClass} rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            </div>
            <div className="mt-3"><button onClick={create} disabled={!!working} className="px-4 py-2 rounded-lg bg-church-navy text-white text-sm font-medium hover:bg-church-navy-deep disabled:opacity-50">Save</button></div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-10 text-center text-gray-500">No sermons yet. They come from the Sunday/Wednesday captures — add the first entry above once a clip is uploaded.</div>
        ) : (
          <div className="space-y-3">
            {list.map((s) => (
              <div key={s.id} className="bg-white rounded-xl shadow-md p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-lg font-semibold text-gray-900">{s.title || 'Untitled sermon'}</h3>
                    <p className="text-xs text-gray-500">{s.mode === 'sunday' ? 'Sunday' : 'Wednesday'} · {s.date}{s.description ? ' · ' + s.description : ''}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{s.published ? 'Published' : 'Draft'}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs border ${s.visibility === 'public' ? 'bg-church-cream text-church-navy border-church-border' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{s.visibility === 'public' ? 'Public' : 'Members'}{s.transcript_updated_at ? ' · 📝' : ''}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={!!working} onClick={() => act(s.id, () => apiSermonPublish(s.id, !s.published), 'toggle-publish')} className={`px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 ${s.published ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-church-navy text-white hover:bg-church-navy-deep'}`}>{s.published ? 'Unpublish' : 'Publish'}</button>
                  <button disabled={!!working} onClick={() => act(s.id, () => apiSermonTranscribe(s.id, s.description), 'transcribe', true)} className="px-3 py-1.5 rounded-lg bg-church-cream text-church-navy border border-church-border text-sm font-medium hover:bg-church-red hover:text-white disabled:opacity-50">{s.transcript_updated_at ? 'Re-transcribe' : 'Transcribe'}</button>
                  <button disabled={!!working} onClick={() => setExpanded((v) => (v === s.id ? null : s.id))} className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50">{expanded === s.id ? 'Hide details' : 'Details'}</button>
                </div>
                {expanded === s.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600 space-y-2">
                    <p><strong>R2 key:</strong> <code className="text-xs bg-gray-100 px-1 rounded">{s.media_key || '—'}</code></p>
                    <p><strong>Transcript:</strong> {s.transcript ? s.transcript.slice(0, 220) + (s.transcript.length > 220 ? '…' : '') : 'Not yet transcribed.'}</p>
                    {s.transcript_vtt && <p className="text-xs text-gray-400">VTT read-along ready ({s.transcript_vtt.length} chars)</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SermonAdmin;
