import { useEffect, useState } from 'react';
import { apiLiveStatus } from '../../api/client';

// Watch tab: the live stream when the site is live, otherwise a warm "join us" card.
export default function WatchScreen() {
  const [status, setStatus] = useState({ loading: true, live: false, youtubeVideoId: '' });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const s = await apiLiveStatus();
        if (active) setStatus({ loading: false, live: !!s?.live, youtubeVideoId: s?.youtubeVideoId || '' });
      } catch {
        if (active) setStatus((p) => ({ ...p, loading: false }));
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { active = false; clearInterval(id); };
  }, []);

  return (
    <div>
      <p className="mb-1 text-[11px] font-sans font-semibold tracking-[0.2em] text-church-muted uppercase">Watch</p>
      <h1 className="font-serif text-3xl leading-tight">Worship with us</h1>

      {status.loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-church-navy" />
        </div>
      ) : status.live ? (
        <section className="mt-6 overflow-hidden rounded-2xl bg-church-navy text-white shadow-lg">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="inline-flex items-center gap-2 font-sans text-sm font-semibold">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-church-red" />
              Live now
            </span>
            <span className="text-[11px] text-white/70">YouTube · Facebook</span>
          </div>
          {status.youtubeVideoId ? (
            <div className="aspect-video w-full bg-black">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${status.youtubeVideoId}`}
                title="Lakeview live"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="aspect-video w-full bg-church-navy-deep flex items-center justify-center text-white/70">
              <span className="font-serif italic">We’re live — refresh to watch</span>
            </div>
          )}
        </section>
      ) : (
        <section className="mt-6 rounded-2xl border border-church-border bg-church-paper p-6 shadow-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-church-cream px-3 py-1 text-xs font-semibold text-church-muted">
            <span className="h-2 w-2 rounded-full bg-church-border" /> Not live right now
          </span>
          <h2 className="mt-4 font-serif text-2xl leading-snug">Join us in person</h2>
          <p className="mt-2 font-sans text-sm leading-relaxed text-church-muted">
            Sunday worship at <strong className="text-church-ink">11:00 AM</strong>, Wednesdays at{" "}
            <strong className="text-church-ink">6:00 PM</strong>. Come hungry.
          </p>
          <p className="mt-4 border-l-2 border-church-gold pl-3 font-serif text-sm italic text-church-ink">
            “Taking strangers, making family.”
          </p>
        </section>
      )}

      <p className="mt-6 text-center font-serif text-sm italic text-church-muted">
        Past sermons are on their way. For now, join us live.
      </p>
    </div>
  );
}
