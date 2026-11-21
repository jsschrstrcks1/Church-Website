import { useEffect, useState } from 'react';
import { apiPrayerList, apiPrayerSubmit, isLoggedIn } from '../../api/client';

const VISIBLE = [
  { id: 'everyone', label: 'Shared with everyone', hint: 'Anyone on the app can read this' },
  { id: 'members', label: 'Church members only', hint: 'Private to members (recommended)' }
];

// Pray tab: submit a prayer request (public) + read the approved, shared ones.
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
      const res = await apiPrayerSubmit(text.trim(), visibility, name.trim(), { viaSms: loggedIn && viaSms });
      setDone(true);
      if (res?.smsDispatch === 'sent') setSmsMsg('Also texted to the church prayer line.');
      else if (res?.smsDispatch === 'queued') setSmsMsg('We’ve saved it; SMS dispatch will be wired with the prayer line.');
      else if (res?.smsDispatch === 'failed') setSmsMsg('Saved, but the text to the prayer line didn’t go through.');
      setText('');
      setName('');
      load();
      setTimeout(() => { setDone(false); setSmsMsg(''); }, 6000);
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
