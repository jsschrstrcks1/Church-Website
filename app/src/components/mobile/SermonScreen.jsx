// Sermons for members (and guests): the weekly captures. Guests see the 1–2 curated
// (public) sermons; any logged-in member sees all published ones. Detail view has the
// video player (the Worker serves R2 by range) plus the transcript and a read-along that
// highlights each line in sync with playback.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiSermons, apiSermonGet, sermonMediaUrl, getToken } from '../../api/client';

// Parse a WebVTT string into { start, end, text } cues (seconds).
const parseVtt = (vtt) => {
  if (!vtt) return [];
  const cues = [];
  for (const m of String(vtt).matchAll(/(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})[^\n]*\n([\s\S]*?)(?=\n(?:\d|[0-9:]{2}:[0-9:]{2})|$)/g)) {
    const toSec = (a, b, c) => Number(a) * 3600 + Number(b) * 60 + Number(c);
    cues.push({ start: toSec(m[1], m[2], m[3]), end: toSec(m[5], m[6], m[7]), text: (m[8] || '').trim().replace(/<[^>]*>/g, '') });
  }
  return cues;
};

const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); } catch { return d; } };

export default function SermonScreen() {
  const { id } = useParams();
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [sermon, setSermon] = useState(null);
  const [loadingSermon, setLoadingSermon] = useState(false);
  const [cue, setCue] = useState(-1);
  const [src, setSrc] = useState('');
  const videoRef = useRef(null);
  const lineEndRef = useRef(null);

  useEffect(() => { (async () => { try { setList(await apiSermons()); } catch {} finally { setLoadingList(false); } })(); }, []);
  useEffect(() => { if (!id) return; (async () => { setLoadingSermon(true); try { const s = await apiSermonGet(id); setSermon(s); setCue(-1); const tok = getToken(); setSrc(sermonMediaUrl(id) + (tok ? `?t=${encodeURIComponent(tok)}` : '')); } catch {} finally { setLoadingSermon(false); } })(); }, [id]);

  const cues = useMemo(() => (sermon ? parseVtt(sermon.vtt) : []), [sermon]);

  const onTime = () => {
    if (!videoRef.current || !cues.length) return;
    const t = videoRef.current.currentTime;
    let i = -1;
    for (let k = 0; k < cues.length; k++) { if (t >= cues[k].start && t <= cues[k].end) { i = k; break; } }
    setCue((prev) => { if (prev !== i) { lineEndRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); } return i; });
  };

  // ---- List view ----
  if (!id) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-semibold text-church-navy">Sermons</h1>
        <p className="mt-1 text-sm text-church-muted">Sunday and Wednesday messages from Lakeview Fellowship.</p>
        {loadingList ? (
          <p className="mt-6 text-sm text-church-muted">Loading…</p>
        ) : list.length === 0 ? (
          <p className="mt-6 text-sm text-church-muted">No sermons posted yet — check back after the next service.</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {list.map((s) => (
              <li key={s.id}>
                <Link to={`/sermons/${s.id}`} className="block rounded-2xl bg-church-paper border border-church-border p-4 shadow-sm active:scale-[0.99] transition">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-medium uppercase tracking-wide ${s.mode === 'sunday' ? 'text-church-red-dark' : 'text-church-navy'}`}>{s.mode === 'sunday' ? 'Sunday' : 'Wednesday'}</span>
                    {s.visibility === 'public' && <span className="text-[11px] font-medium text-church-muted">Open to all ✓</span>}
                  </div>
                  <h2 className="mt-1 font-serif text-lg font-semibold text-church-ink">{s.title}</h2>
                  {s.description && <p className="mt-0.5 text-sm text-church-muted line-clamp-2">{s.description}</p>}
                  <p className="mt-2 text-xs text-church-muted">{fmtDate(s.date)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ---- Detail view ----
  if (loadingSermon) return <p className="text-sm text-church-muted">Loading…</p>;
  if (!sermon) return <p className="text-sm text-church-muted">Sermon not found.</p>;

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-black aspect-video">
        <video ref={videoRef} onTimeUpdate={onTime} controls preload="metadata" className="h-full w-full" src={src} />
      </div>
      <h1 className="mt-4 font-serif text-2xl font-semibold text-church-navy">{sermon.title}</h1>
      <p className="mt-1 text-sm text-church-muted">{sermon.mode === 'sunday' ? 'Sunday' : 'Wednesday'} · {fmtDate(sermon.date)}{sermon.visibility === 'public' ? ' · Open to all' : ''}</p>
      {sermon.description && <p className="mt-2 text-sm text-church-ink">{sermon.description}</p>}

      {cues.length > 0 ? (
        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-lg font-semibold text-church-navy">Read along</h2>
            <span className="text-xs text-church-muted">follows the video</span>
          </div>
          <div className="mt-3 max-h-80 overflow-y-auto rounded-2xl bg-church-paper border border-church-border p-4 text-[15px] leading-relaxed text-church-ink">
            {cues.map((c, i) => (
              <p key={i} className={`py-0.5 ${i === cue ? 'bg-church-cream rounded px-1 font-medium text-church-navy' : ''}`}>{c.text}</p>
            ))}
            <div ref={lineEndRef} />
          </div>
        </div>
      ) : (
        sermon.transcript && (
          <div className="mt-6">
            <h2 className="font-serif text-lg font-semibold text-church-navy">Transcript</h2>
            <p className="mt-3 whitespace-pre-line rounded-2xl bg-church-paper border border-church-border p-4 text-[15px] leading-relaxed text-church-ink">{sermon.transcript}</p>
          </div>
        )
      )}
      {!sermon.transcript && !cues.length && (
        <p className="mt-6 rounded-2xl bg-church-cream border border-church-border p-4 text-sm text-church-navy">This sermon isn't transcribed yet — it'll be added after the next service.</p>
      )}
    </div>
  );
}
