// Calendar events: members add, edit, and delete the events shown on the home page calendar.
// Events live in Firestore (events/{id}). The home page also still shows the fixed list in
// public/js/events.js (holidays and older entries); those appear here read-only.
import { useEffect, useMemo, useState } from 'react';
import { apiEvents, apiCreateEvent, apiUpdateEvent, apiDeleteEvent } from '../../api/client';
import { useMemberAuth } from '../../context/MemberAuthContext';
import AdminNav from './AdminNav';

const emptyDraft = () => ({ id: null, date: '', type: 'church', en: '', es: '', time: '', place: '' });

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDate = (key) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

// The fixed events in public/js/events.js, loaded the same way the home page loads them
const loadFileEvents = () => new Promise((resolve) => {
  if (Array.isArray(window.CHURCH_EVENTS)) {
    resolve(window.CHURCH_EVENTS);
    return;
  }
  const script = document.createElement('script');
  script.src = '/js/events.js';
  script.onload = () => resolve(Array.isArray(window.CHURCH_EVENTS) ? window.CHURCH_EVENTS : []);
  script.onerror = () => resolve([]);
  document.head.appendChild(script);
});

const inputClass = 'w-full px-3 py-2 border border-church-border rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent outline-none bg-white';

const EventsManager = () => {
  const { memberProfile } = useMemberAuth();
  const [events, setEvents] = useState(null);
  const [fileEvents, setFileEvents] = useState([]);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await apiEvents().catch((err) => { console.error('Error loading events:', err); return []; });
      if (!cancelled) setEvents(rows);
    })();
    loadFileEvents().then(setFileEvents);
    return () => { cancelled = true; };
  }, []);

  const today = todayKey();
  const allEvents = useMemo(() => {
    const fromFile = fileEvents.map((e, i) => ({ ...e, id: `file-${i}`, fromFile: true }));
    return [...(events || []), ...fromFile].sort((a, b) => a.date.localeCompare(b.date));
  }, [events, fileEvents]);
  const upcoming = allEvents.filter((e) => e.date >= today);
  const past = allEvents.filter((e) => e.date < today).reverse();

  const update = (fields) => setDraft({ ...draft, ...fields });

  const handleSave = async (e) => {
    e.preventDefault();
    const data = {
      date: draft.date,
      type: draft.type,
      en: draft.en.trim(),
      es: draft.es.trim(),
      time: draft.time.trim(),
      place: draft.place.trim()
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      setError('Please pick a date.');
      return;
    }
    if (!data.en) {
      setError('Please give the event a name in English.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (draft.id) {
        await apiUpdateEvent(draft.id, { ...data });
      } else {
        const created = await apiCreateEvent({ ...data });
        const row = { ...data, id: created.id };
        setEvents((prev) => [...(prev || []), row].sort((a, b) => String(a.date).localeCompare(String(b.date))));
      }
      setDraft(null);
    } catch (err) {
      console.error('Error saving event:', err);
      setError('Could not save the event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event) => {
    if (!window.confirm(`Delete "${event.en}" on ${formatDate(event.date)}? It will disappear from the website calendar.`)) return;
    try {
      await apiDeleteEvent(event.id);
      setEvents((prev) => (prev || []).filter((e) => e.id !== event.id));
      if (draft?.id === event.id) setDraft(null);
    } catch (err) {
      console.error('Error deleting event:', err);
      alert('Could not delete the event. Please try again.');
    }
  };

  const startEditing = (event) => {
    setError('');
    setDraft(event ? { ...emptyDraft(), ...event } : emptyDraft());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderEvent = (event) => (
    <li key={event.id} className="py-4 flex items-start gap-4">
      <span
        className={`mt-1.5 w-3 h-3 rounded-full flex-shrink-0 ${event.type === 'holiday' ? 'bg-church-blue' : 'bg-church-red'}`}
        title={event.type === 'holiday' ? 'Holiday' : 'Church event'}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-church-navy">{formatDate(event.date)}</p>
        <p className="text-gray-900">{event.en}</p>
        {event.es && <p className="text-sm text-church-muted italic">{event.es}</p>}
        {(event.time || event.place) && (
          <p className="text-xs text-church-muted mt-1">{[event.time, event.place].filter(Boolean).join(' · ')}</p>
        )}
        {event.fromFile && (
          <p className="text-xs text-church-muted mt-1">Built into the website file (public/js/events.js), so it can't be changed here.</p>
        )}
      </div>
      {!event.fromFile && (
        <div className="flex gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => startEditing(event)}
            className="px-3 py-1.5 text-sm text-church-navy hover:bg-church-cream rounded-lg font-medium"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => handleDelete(event)}
            className="px-3 py-1.5 text-sm text-church-red-dark hover:bg-red-50 rounded-lg font-medium"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );

  return (
    <div className="min-h-screen bg-church-paper font-sans text-church-ink">
      <AdminNav />

      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-church-navy">Calendar</h1>
            <p className="text-church-muted mt-1">Events you add here show up on the website calendar right away.</p>
          </div>
          {!draft && (
            <button
              type="button"
              onClick={() => startEditing(null)}
              className="px-5 py-2.5 bg-church-red hover:bg-church-red-dark text-white font-semibold rounded-lg transition"
            >
              + Add event
            </button>
          )}
        </div>

        {draft && (
          <form onSubmit={handleSave} className="bg-white rounded-xl border-2 border-church-border p-5 sm:p-6 mb-8 space-y-5">
            <h2 className="font-semibold text-church-navy text-lg">{draft.id ? 'Edit event' : 'New event'}</h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input id="eventDate" type="date" value={draft.date} onChange={(e) => update({ date: e.target.value })} className={inputClass} />
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1">Type</span>
                <div className="flex gap-2">
                  {[
                    { value: 'church', label: 'Church event', dot: 'bg-church-red' },
                    { value: 'holiday', label: 'Holiday', dot: 'bg-church-blue' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => update({ type: option.value })}
                      aria-pressed={draft.type === option.value}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                        draft.type === option.value ? 'border-church-navy bg-church-cream text-church-navy' : 'border-church-border text-gray-600 hover:bg-church-cream/50'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${option.dot}`} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="eventEn" className="block text-sm font-medium text-gray-700 mb-1">Name (English)</label>
                <input id="eventEn" type="text" maxLength={120} value={draft.en} onChange={(e) => update({ en: e.target.value })} placeholder="e.g. Christmas Fellowship" className={inputClass} />
              </div>
              <div>
                <label htmlFor="eventEs" className="block text-sm font-medium text-gray-700 mb-1">Nombre (Español)</label>
                <input id="eventEs" type="text" maxLength={120} value={draft.es} onChange={(e) => update({ es: e.target.value })} placeholder="e.g. Convivio navideño" className={inputClass} />
                <p className="text-xs text-church-muted mt-1">Shown when visitors switch the site to Spanish. Left blank, the English name is shown.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="eventTime" className="block text-sm font-medium text-gray-700 mb-1">Time <span className="text-church-muted font-normal">(optional)</span></label>
                <input id="eventTime" type="text" maxLength={80} value={draft.time} onChange={(e) => update({ time: e.target.value })} placeholder="e.g. 6:00 PM, or After worship" className={inputClass} />
              </div>
              <div>
                <label htmlFor="eventPlace" className="block text-sm font-medium text-gray-700 mb-1">Place <span className="text-church-muted font-normal">(optional)</span></label>
                <input id="eventPlace" type="text" maxLength={120} value={draft.place} onChange={(e) => update({ place: e.target.value })} placeholder="e.g. Fellowship hall" className={inputClass} />
              </div>
            </div>

            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-2 border-t border-church-border">
              <button type="submit" disabled={saving} className="flex-1 sm:flex-none px-6 py-2.5 bg-church-navy hover:bg-church-navy-deep disabled:opacity-60 text-white font-semibold rounded-lg transition">
                {saving ? 'Saving...' : draft.id ? 'Save changes' : 'Add to calendar'}
              </button>
              <button type="button" onClick={() => setDraft(null)} disabled={saving} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-church-border p-5 sm:p-6">
          <h2 className="font-semibold text-church-navy text-lg">Upcoming</h2>
          {events === null ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-church-navy"></div>
            </div>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-church-muted py-6">No upcoming events. Use “Add event” to put one on the calendar.</p>
          ) : (
            <ul className="divide-y divide-church-border">{upcoming.map(renderEvent)}</ul>
          )}

          {past.length > 0 && (
            <div className="mt-4 pt-4 border-t border-church-border">
              <button type="button" onClick={() => setShowPast(!showPast)} className="text-sm font-semibold text-church-navy hover:underline">
                {showPast ? 'Hide past events' : `Show past events (${past.length})`}
              </button>
              {showPast && <ul className="divide-y divide-church-border opacity-80">{past.map(renderEvent)}</ul>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventsManager;
