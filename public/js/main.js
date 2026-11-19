// Lakeview Fellowship Church — self-hosted public site (Cloudflare Pages).
// Synthesized from the syndication-engine template. The public page no longer needs
// Firebase: admin events and the live flag fall back to the fixed list offline, and are
// re-wired to the Cloudflare Workers API in the backend phase. EDIT: set the two constants
// below (YOUTUBE_CHANNEL_ID starts with "UC"; FACEBOOK_URL is your church's page).
const FIREBASE_PROJECT_ID = '';
const FIREBASE_API_KEY = '';
const YOUTUBE_CHANNEL_ID = 'YOUTUBE_CHANNEL_ID_PLACEHOLDER';
const FACEBOOK_URL = 'https://www.facebook.com/YourChurchPage';
// NOTE: with FIREBASE_PROJECT_ID empty, the Firestore calls fail fast and the page shows
// only the fixed events in js/events.js and the offline live schedule. This keeps the
// public site fully static (no Firebase) until the Workers/D1 API replaces it.
const FIRESTORE_DOCS = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

const root = document.documentElement;
const lang = () => (root.dataset.lang === 'es' ? 'es' : 'en');

// ----- Language switch (EN / ES) -----
const langButtons = document.querySelectorAll('[data-set-lang]');

function setLang(next) {
  root.dataset.lang = next;
  root.lang = next;
  try { localStorage.setItem('lang', next); } catch (e) {}
  syncLangButtons();
  renderCalendar();
}

function syncLangButtons() {
  langButtons.forEach((b) => {
    const active = b.dataset.setLang === lang();
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
}

langButtons.forEach((b) => b.addEventListener('click', () => setLang(b.dataset.setLang)));
syncLangButtons();

// ----- Mobile navigation -----
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');

toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});
nav.querySelectorAll('a').forEach((a) =>
  a.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  })
);

// ----- Events calendar -----
const byDate = (a, b) => a.date.localeCompare(b.date);
const fileEvents = window.CHURCH_EVENTS || [];
let events = fileEvents.slice().sort(byDate);
const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth();

const calTitle = document.querySelector('.cal-title');
const weekdayRow = document.querySelector('.weekday-row');
const grid = document.querySelector('.calendar-grid');
const entries = document.querySelector('.event-entries');

const pad = (n) => String(n).padStart(2, '0');
const locale = () => (lang() === 'es' ? 'es-MX' : 'en-US');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function renderCalendar() {
  const first = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthName = cap(first.toLocaleDateString(locale(), { month: 'long' }));
  calTitle.textContent = `${monthName} ${viewYear}`;

  weekdayRow.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(2026, 1, 1 + i); // Feb 1, 2026 is a Sunday
    const s = document.createElement('span');
    s.textContent = cap(d.toLocaleDateString(locale(), { weekday: 'short' }).replace('.', ''));
    weekdayRow.appendChild(s);
  }

  grid.innerHTML = '';
  for (let i = 0; i < first.getDay(); i++) {
    const blank = document.createElement('div');
    blank.className = 'calendar-day empty';
    grid.appendChild(blank);
  }
  const prefix = `${viewYear}-${pad(viewMonth + 1)}-`;
  const monthEvents = events.filter((e) => e.date.startsWith(prefix));

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    if (viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate()) {
      cell.classList.add('today');
    }
    const num = document.createElement('span');
    num.className = 'date-number';
    num.textContent = d;
    cell.appendChild(num);

    monthEvents
      .filter((e) => e.date === prefix + pad(d))
      .forEach((e) => {
        const pill = document.createElement('span');
        pill.className = `event-pill ${e.type}`;
        pill.textContent = e[lang()] || e.en;
        cell.appendChild(pill);
      });
    grid.appendChild(cell);
  }

  entries.innerHTML = '';
  if (!monthEvents.length) {
    const p = document.createElement('p');
    p.className = 'no-events';
    p.textContent = lang() === 'es'
      ? 'No hay eventos especiales este mes. ¡Le esperamos el domingo y el miércoles!'
      : 'No special events this month. See you Sunday and Wednesday!';
    entries.appendChild(p);
  }
  monthEvents.forEach((e) => {
    const [y, m, day] = e.date.split('-').map(Number);
    const label = new Date(y, m - 1, day).toLocaleDateString(locale(), { month: 'long', day: 'numeric' });
    const row = document.createElement('div');
    row.className = `event-entry ${e.type}`;
    const small = document.createElement('small');
    small.textContent = cap(label) + (e.time ? ` · ${e.time}` : '');
    const strong = document.createElement('strong');
    strong.textContent = e[lang()] || e.en;
    const box = document.createElement('div');
    box.append(small, strong);
    if (e.place) {
      const place = document.createElement('span');
      place.textContent = e.place;
      box.appendChild(place);
    }
    row.appendChild(box);
    entries.appendChild(row);
  });
}

document.querySelector('.cal-prev').addEventListener('click', () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
});
document.querySelector('.cal-next').addEventListener('click', () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
});

renderCalendar();

// Events from the members area: from a year ago onward, so past months still show when browsing back.
// NOTE (self-hosted): FIREBASE_PROJECT_ID is empty, so this fetch targets a non-existent project and
// fails fast (falls through to the catch). The Cloudflare Workers API phase will replace this call.
async function loadAdminEvents() {
  const since = new Date(today.getFullYear() - 1, today.getMonth(), 1);
  const sinceKey = `${since.getFullYear()}-${pad(since.getMonth() + 1)}-01`;
  const url = `${FIRESTORE_DOCS}:runQuery?key=${FIREBASE_API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'events' }],
      where: { fieldFilter: { field: { fieldPath: 'date' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: sinceKey } } },
      orderBy: [{ field: { fieldPath: 'date' } }],
      limit: 500
    }
  };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) return;
    const rows = await res.json();
    const str = (fields, name) => (fields[name] && fields[name].stringValue) || '';
    const adminEvents = rows
      .filter((row) => row.document && row.document.fields)
      .map((row) => {
        const f = row.document.fields;
        return {
          date: str(f, 'date'),
          type: str(f, 'type') === 'holiday' ? 'holiday' : 'church',
          en: str(f, 'en'),
          es: str(f, 'es'),
          time: str(f, 'time'),
          place: str(f, 'place')
        };
      })
      .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.en);
    events = fileEvents.concat(adminEvents).sort(byDate);
    renderCalendar();
  } catch (e) {
    // Offline or blocked: the fixed events above are still shown
  }
}
loadAdminEvents();

// ----- Watch live -----
const liveSection = document.getElementById('live');
const liveBar = document.getElementById('live-bar');
const livePlayer = document.getElementById('live-player');
let isLive = false;

function setLive(live, onYouTube, videoId) {
  const key = `${onYouTube}:${videoId || ''}`;
  if (live === isLive && (!live || livePlayer.dataset.youtube === key)) return;
  isLive = live;
  document.documentElement.dataset.live = String(live);
  liveSection.dataset.live = String(live);
  liveSection.querySelector('.live-offline').hidden = live;
  liveSection.querySelector('.live-on').hidden = !live;
  liveBar.hidden = !live;
  livePlayer.dataset.youtube = key;
  livePlayer.textContent = '';
  if (!live) return;
  if (onYouTube) {
    const frame = document.createElement('iframe');
    frame.src = videoId
      ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=1`
      : `https://www.youtube.com/embed/live_stream?channel=${YOUTUBE_CHANNEL_ID}&autoplay=1&mute=1`;
    frame.title = 'Live stream';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    livePlayer.appendChild(frame);
  } else {
    livePlayer.innerHTML = `<div class="live-fb"><a class="button outline" href="${FACEBOOK_URL}" target="_blank" rel="noopener">`
      + '<span class="en">Watch on Facebook</span><span class="es">Véalo en Facebook</span></a></div>';
  }
}

async function checkLive() {
  const url = `${FIRESTORE_DOCS}/publicLive/status?key=${FIREBASE_API_KEY}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) { setLive(false, false); return; }
    const f = (await res.json()).fields || {};
    const beat = Date.parse((f.heartbeatAt && f.heartbeatAt.stringValue) || '');
    const live = !!(f.live && f.live.booleanValue) && Date.now() - beat < 3 * 60 * 1000;
    setLive(live, !f.youtube || f.youtube.booleanValue !== false, (f.youtubeVideoId && f.youtubeVideoId.stringValue) || '');
  } catch (e) {
    // Offline: leave the section as it is
  }
}
checkLive();
setInterval(checkLive, 45000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkLive(); });

// ----- Footer year -----
document.getElementById('year').textContent = today.getFullYear();
