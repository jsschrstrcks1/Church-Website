// Helpers for the newsletter Event section. Dates are 'YYYY-MM-DD', times are 'HH:mm' (local time).
import { CHURCH_NAME, SITE_URL } from '../firebase/config';

export const RSVP_OPTIONS = ['Going', 'Maybe', 'Not going'];

const parseDate = (date, time) => {
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  const [hours, minutes] = time ? time.split(':').map(Number) : [0, 0];
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
};

export const formatEventDate = (date) => {
  const parsed = parseDate(date);
  return parsed ? parsed.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
};

export const formatEventTime = (time) => {
  const parsed = time ? parseDate('2000-01-01', time) : null;
  return parsed ? parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
};

export const formatEventTimeRange = (section) => {
  const start = formatEventTime(section.eventTime);
  const end = formatEventTime(section.eventEndTime);
  return start && end ? `${start} – ${end}` : start;
};

const pad = (value) => String(value).padStart(2, '0');
const stamp = (date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
const stampWithTime = (date) => `${stamp(date)}T${pad(date.getHours())}${pad(date.getMinutes())}00`;

// Start/end for calendar exports. Without a time the event is all-day; without an end time it lasts one hour.
const getEventRange = (section) => {
  const start = parseDate(section.eventDate, section.eventTime);
  if (!start) return null;
  if (!section.eventTime) {
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end, allDay: true };
  }
  let end = section.eventEndTime ? parseDate(section.eventDate, section.eventEndTime) : null;
  if (!end || end <= start) end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end, allDay: false };
};

export const mapsSearchUrl = (location) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;

export const mapsEmbedUrl = (location) => `https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`;

export const googleCalendarUrl = (section) => {
  const range = getEventRange(section);
  if (!range) return '';
  const format = range.allDay ? stamp : stampWithTime;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: section.eventName || 'Event',
    dates: `${format(range.start)}/${format(range.end)}`,
  });
  if (section.eventLocation) params.set('location', section.eventLocation);
  if (section.eventDetails) params.set('details', section.eventDetails);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const escapeIcs = (value) => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

export const downloadEventIcs = (section) => {
  const range = getEventRange(section);
  if (!range) return;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${CHURCH_NAME}//Newsletter//EN`,
    'BEGIN:VEVENT',
    `UID:${section.id}-${stamp(range.start)}@${new URL(SITE_URL).hostname}`,
    `DTSTAMP:${stampWithTime(new Date())}`,
    range.allDay ? `DTSTART;VALUE=DATE:${stamp(range.start)}` : `DTSTART:${stampWithTime(range.start)}`,
    range.allDay ? `DTEND;VALUE=DATE:${stamp(range.end)}` : `DTEND:${stampWithTime(range.end)}`,
    `SUMMARY:${escapeIcs(section.eventName || 'Event')}`,
  ];
  if (section.eventLocation) lines.push(`LOCATION:${escapeIcs(section.eventLocation)}`);
  if (section.eventDetails) lines.push(`DESCRIPTION:${escapeIcs(section.eventDetails)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(section.eventName || 'event').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
