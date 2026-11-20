import { useState } from 'react';
import { apiRsvp } from '../../api/client';
import {
  RSVP_OPTIONS,
  downloadEventIcs,
  formatEventDate,
  formatEventTimeRange,
  googleCalendarUrl,
  mapsEmbedUrl,
  mapsSearchUrl,
} from '../../utils/newsletterEvents';

// An event with date/time, map, add-to-calendar buttons and optional RSVPs.
// Pass `preview` to show it without letting the RSVP form submit (editor preview, archives).
const EventCard = ({ section, memberId, newsletterId, preview = false, accentColor = '#4f46e5', textColor = '#111827', backgroundColor = '#ffffff' }) => {
  const [name, setName] = useState('');
  const [guests, setGuests] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const [error, setError] = useState('');

  const dateText = formatEventDate(section.eventDate);
  const timeText = formatEventTimeRange(section);
  const location = (section.eventLocation || '').trim();
  const canAddToCalendar = Boolean(section.eventDate);

  const submitRsvp = async (option) => {
    if (preview || !memberId || !newsletterId) return;
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await apiRsvp({
        eventId: section.id,
        newsletterId,
        guestName: name.trim().slice(0, 100),
        guests: option === 'Not going' ? 0 : Math.min(Math.max(parseInt(guests, 10) || 1, 1), 20),
      });
      setConfirmed(option);
    } catch (submitError) {
      console.error('Error submitting RSVP:', submitError);
      setError('We could not save your RSVP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const buttonStyle = { borderColor: accentColor, color: accentColor };

  return (
    <div className="overflow-hidden rounded-xl border-2" style={{ borderColor: accentColor, backgroundColor }}>
      <div className="flex gap-4 p-5">
        {section.eventDate && (
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg text-white" style={{ backgroundColor: accentColor }} aria-hidden="true">
            <span className="text-xs font-semibold uppercase">{new Date(`${section.eventDate}T00:00`).toLocaleDateString(undefined, { month: 'short' })}</span>
            <span className="text-2xl font-bold leading-none">{new Date(`${section.eventDate}T00:00`).getDate()}</span>
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-xl font-bold" style={{ color: textColor }}>{section.eventName || 'Untitled event'}</h3>
          {(dateText || timeText) && (
            <p className="mt-1 text-sm font-medium" style={{ color: textColor }}>{[dateText, timeText].filter(Boolean).join(' · ')}</p>
          )}
          {location && (
            <a href={mapsSearchUrl(location)} target="_blank" rel="noreferrer" className="mt-1 block text-sm underline" style={{ color: accentColor }}>
              📍 {location}
            </a>
          )}
        </div>
      </div>

      {location && !section.eventHideMap && (
        <iframe
          title={`Map of ${location}`}
          src={mapsEmbedUrl(location)}
          loading="lazy"
          className="h-48 w-full border-0"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}

      {section.eventDetails && (
        <p className="whitespace-pre-line px-5 pt-4 text-sm" style={{ color: textColor }}>{section.eventDetails}</p>
      )}

      {canAddToCalendar && (
        <div className="flex flex-col gap-2 px-5 pt-4 sm:flex-row">
          <a href={googleCalendarUrl(section)} target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-2.5 text-center text-sm font-semibold" style={buttonStyle}>
            Add to Google Calendar
          </a>
          <button type="button" onClick={() => downloadEventIcs(section)} className="rounded-lg border px-4 py-2.5 text-sm font-semibold" style={buttonStyle}>
            Apple / Outlook (.ics)
          </button>
        </div>
      )}

      {section.eventCollectRsvps && (
        <div className="m-5 mt-4 rounded-lg bg-black/5 p-4">
          <p className="text-sm font-bold" style={{ color: textColor }}>RSVP</p>
          {confirmed ? (
            <div className="mt-2">
              <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                Thank you, {name.trim()}! We have you down as “{confirmed}.”
              </p>
              <button type="button" className="mt-2 text-sm underline" style={{ color: accentColor }} onClick={() => { setConfirmed(null); setName(''); setGuests(1); }}>
                RSVP for someone else
              </button>
            </div>
          ) : (
            <div className="mt-2 space-y-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                maxLength={100}
                aria-label="Your name"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
              />
              <label className="flex items-center gap-2 text-sm" style={{ color: textColor }}>
                How many people?
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={guests}
                  onChange={(event) => setGuests(event.target.value)}
                  className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                />
              </label>
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              <div className="flex flex-col gap-2 sm:flex-row">
                {RSVP_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={submitting}
                    onClick={() => submitRsvp(option)}
                    className="rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:flex-1 sm:py-2"
                    style={{ backgroundColor: accentColor }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {!section.eventCollectRsvps && <div className="h-5" />}
    </div>
  );
};

export default EventCard;
