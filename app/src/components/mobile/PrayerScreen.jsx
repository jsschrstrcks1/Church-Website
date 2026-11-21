import { useEffect, useState } from 'react';
import { apiPrayerList, apiPrayerSubmit, isLoggedIn } from '../../api/client';

const VISIBLE = [
  { id: 'everyone', label: 'Shared with everyone', hint: 'Anyone on the app can read this' },
  { id: 'members', label: 'Church members only', hint: 'Private to members (recommended)' }
];

// Pray tab: submit a prayer request (public) + read the approved, shared ones.
const PRAYER_NUMBER = '8335095744';

// Open the device's own messaging app (Bob's SMS/iMessage) pre-filled with the request,
// addressed to the church prayer line. iOS wants `&body=`, Android `?body=`.
const openSmsCompose = (text) => {
  const body = encodeURIComponent(text.slice(0, 159));
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  window.location.href = isIOS
    ? `sms:${PRAYER_NUMBER}&body=${body}`
    : `sms:${PRAYER_NUMBER}?body=${body}`;
};

export default function PrayerScreen() {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState('members');
  const [viaSms, setViaSms] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [smsMsg, setSmsMsg] = useState('');
  const [error, setError] = useState('');
  const [requests, setRequests] = useState([]);
  const loggedIn = isLoggedIn();

  const load = () => apiPrayerList().then(setRequests).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError('');
    setSmsMsg('');
    try {
      await apiPrayerSubmit(text.trim(), visibility, name.trim(), { viaSms: loggedIn && viaSms });
      setDone(true);
      if (loggedIn && viaSms) {
        setSmsMsg('We saved it. Tap send in your messages to text the prayer line.');
        // Open Bob's own SMS/iMessage, pre-filled with his request to 833-509-5744.
        setTimeout(() => openSmsCompose(text.trim()), 150);
      }
      setText('');
      setName('');
      load();
      setTimeout(() => { setDone(false); setSmsMsg(''); }, 8000);
    } catch (err) {
      setError(err?.message || 'Could not send your request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <p className="mb-1 text-[11px] font-sans font-semibold tracking-[0.2em] text-church-muted uppercase">Pray</p>
      <h1 className="font-serif text-3xl leading-tight">How can we pray?</h1>
      <p className="mt-1 font-sans text-sm text-church-muted">A staff member reviews every request before it’s shared.</p>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <label className="block">
          <span className="font-serif text-sm text-church-ink">Your prayer request</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Write from the heart…"
            className="mt-1 w-full rounded-xl border border-church-border bg-church-paper px-3 py-2.5 font-sans text-[15px] leading-relaxed outline-none focus:border-church-navy"
          />
        </label>

        <label className="block">
          <span className="font-serif text-sm text-church-ink">Your name <span className="text-church-muted">(optional)</span></span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="First name"
            className="mt-1 w-full rounded-xl border border-church-border bg-church-paper px-3 py-2.5 font-sans text-[15px] outline-none focus:border-church-navy"
          />
        </label>

        <fieldset>
          <legend className="font-serif text-sm text-church-ink">Who can see it?</legend>
          <div className="mt-1 grid grid-cols-1 gap-2">
            {VISIBLE.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVisibility(v.id)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  visibility === v.id ? 'border-church-navy bg-church-navy text-white' : 'border-church-border bg-church-paper text-church-ink'
                }`}
              >
                <span className="block font-sans text-sm font-semibold">{v.label}</span>
                <span className={`block text-xs ${visibility === v.id ? 'text-white/70' : 'text-church-muted'}`}>{v.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {loggedIn && (
          <label className="flex items-start gap-2 rounded-xl border border-church-border bg-church-paper px-3 py-2.5">
            <input
              type="checkbox"
              checked={viaSms}
              onChange={(e) => setViaSms(e.target.checked)}
              className="mt-1 h-4 w-4 accent-church-navy"
            />
            <span>
              <span className="block font-sans text-sm font-semibold text-church-ink">Text it to the prayer line</span>
              <span className="block text-xs text-church-muted">
                Opens your own messages to 833-509-5744 so you can send it from your phone.
              </span>
            </span>
          </label>
        )}

        {error ? <p className="font-sans text-sm text-church-red">{error}</p> : null}
        {done ? (
          <p className="rounded-xl border border-church-gold/60 bg-church-cream px-3 py-2 font-serif text-sm italic text-church-ink">
            Your request is in. We’re praying with you.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="w-full rounded-xl bg-church-red py-3 font-sans text-base font-semibold text-white shadow-md transition-opacity disabled:opacity-40"
        >
          {sending ? 'Sending…' : 'Ask for prayer'}
        </button>
      </form>

      {requests.length > 0 && (
        <section className="mt-8">
          <h2 className="font-serif text-lg text-church-navy">Shared requests</h2>
          <div className="mt-2 space-y-2">
            {requests.map((r) => (
              <blockquote key={r.id} className="border-l-2 border-church-gold bg-church-paper px-3 py-2.5">
                <p className="font-serif text-[15px] leading-relaxed text-church-ink">{r.text}</p>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-center font-serif text-sm text-church-muted">
        Prefer to text? Send your request straight to the prayer line,{" "}
        <a href="tel:8335095744" className="font-semibold text-church-navy underline">833-509-5744</a>.
      </p>
    </div>
  );
}
