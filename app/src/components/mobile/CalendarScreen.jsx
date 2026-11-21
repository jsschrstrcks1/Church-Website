import { useEffect, useMemo, useState } from 'react';
import { apiEvents } from '../../api/client';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function EventCard({ event }) {
  const d = new Date(`${event.date}T12:00:00`);
  return (
    <div className="flex gap-3 rounded-xl border border-church-border bg-church-paper p-3 shadow-sm">
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-church-navy text-white">
        <span className="text-lg leading-none font-serif font-bold">{d.getDate()}</span>
        <span className="text-[10px] leading-none text-white/80 uppercase">{MONTHS[d.getMonth()].slice(0, 3)}</span>
      </div>
      <div className="min-w-0">
        <p className="font-serif text-base leading-snug text-church-ink">{event.en}</p>
        {event.es ? <p className="text-sm text-church-muted">{event.es}</p> : null}
        {(event.time || event.place) && (
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-church-muted">
            {event.time ? <span className="inline-flex items-center gap-1">🕘 {event.time}</span> : null}
            {event.place ? <span className="inline-flex items-center gap-1">📍 {event.place}</span> : null}
          </p>
        )}
      </div>
    </div>
  );
}

// Calendar tab: upcoming church events from the public /events feed, grouped by month.
export default function CalendarScreen() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiEvents(new Date().toISOString().slice(0, 10))
      .then((rows) => { if (active) setEvents(rows.slice(0, 60)); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const groups = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const key = (ev.date || '').slice(0, 7);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return [...map.entries()].map(([key, list]) => ({
      month: `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`,
      list
    }));
  }, [events]);

  return (
    <div>
      <p className="mb-1 text-[11px] font-sans font-semibold tracking-[0.2em] text-church-muted uppercase">Calendar</p>
      <h1 className="font-serif text-3xl leading-tight">What’s on</h1>

      {loading ? (
        <div className="mt-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-church-navy" /></div>
      ) : groups.length === 0 ? (
        <p className="mt-8 text-center font-serif text-sm italic text-church-muted">No upcoming events posted yet.</p>
      ) : (
        groups.map((g) => (
          <section key={g.month} className="mt-6">
            <h2 className="mb-2 font-serif text-lg text-church-navy">{g.month}</h2>
            <div className="space-y-2">
              {g.list.map((ev) => <EventCard key={`${ev.date}-${ev.id}-${ev.en}`} event={ev} />)}
            </div>
          </section>
        ))
      )}

      <p className="mt-6 text-center font-serif text-sm italic text-church-muted">Everyone is welcome — no appointment needed.</p>
    </div>
  );
}
