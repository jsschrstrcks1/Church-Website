import { useEffect, useState } from 'react';
import { apiNewsletters, apiNewsletterGet, apiPollTallies } from '../../api/client';
import { RSVP_OPTIONS, formatEventDate } from '../../utils/newsletterEvents';
import { exportToCSV } from '../../utils/csvExport';

const sanitize = (value) => String(value ?? '').replace(/\"/g, "'").replace(/\r?\n/g, ' | ');
const sortNewest = (rows) => [...rows].sort((a, b) => (b.submittedAt?.getTime?.() || 0) - (a.submittedAt?.getTime?.() || 0));
const submittedText = (row) => (row.submittedAt?.getTime ? row.submittedAt.toLocaleString() : '');

// Poll tallies for one poll section. The worker records votes per option_text under
// /polls/:id/votes, so we synthesize one vote row per tally as the UI expects.
const usePollRows = (sectionId, options) => {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!sectionId) return undefined;
    let cancelled = false;
    const load = async () => {
      const tallies = await apiPollTallies(sectionId).catch(() => []);
      if (cancelled) return;
      const known = (options || []).filter(Boolean);
      const seen = {};
      const synthesized = [];
      tallies.forEach((t) => {
        const option = t.option_text;
        seen[option] = true;
        const votes = Number(t.votes) || 0;
        for (let i = 0; i < votes; i++) synthesized.push({ option });
      });
      // Include options with no votes yet so every offered choice still shows a 0 bar.
      known.forEach((option) => { if (!seen[option]) synthesized.push({ option }); });
      setRows(synthesized);
    };
    load();
    return () => { cancelled = true; };
  }, [sectionId, /* options identity changes each render; run once per section */ (options || []).join('|')]);
  return rows;
};

const PollDetail = ({ memberId, item }) => {
  const rows = usePollRows(item.sectionId, item.options);
  if (!rows) return <p className="text-gray-500">Loading...</p>;

  const extraOptions = [...new Set(rows.map((row) => row.option))].filter((option) => !item.options.includes(option));
  const options = [...item.options, ...extraOptions];
  const counts = options.map((option) => ({ option, count: rows.filter((row) => row.option === option).length }));

  const download = () => exportToCSV(
    sortNewest(rows).map((row) => ({ answer: sanitize(row.option), submitted: submittedText(row) })),
    [{ key: 'answer', header: 'Answer' }, { key: 'submitted', header: 'Submitted At' }],
    `${item.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_poll`
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{rows.length} vote{rows.length === 1 ? '' : 's'} (each device can vote once)</p>
      {counts.map(({ option, count }) => {
        const percent = rows.length ? Math.round((count / rows.length) * 100) : 0;
        return (
          <div key={option}>
            <div className="mb-1 flex justify-between gap-3 text-sm text-gray-800">
              <span className="font-medium">{option}</span>
              <span className="shrink-0 tabular-nums">{count} · {percent}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-church-navy" style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
      {rows.length > 0 && (
        <button onClick={download} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Download CSV</button>
      )}
    </div>
  );
};

const EventDetail = ({ memberId, item }) => {
  // The worker records RSVPs under /rsvps (write-only) and offers no read-back endpoint,
  // so the per-row RSVP list has no source in the new backend. Show the empty state.
  const rows = [];
  if (!rows) return <p className="text-gray-500">Loading...</p>;

  const sorted = sortNewest(rows);
  const people = (option) => rows.filter((row) => row.option === option).reduce((sum, row) => sum + (Number(row.guests) || 0), 0);

  const download = () => exportToCSV(
    sorted.map((row) => ({
      name: sanitize(row.name),
      response: sanitize(row.option),
      people: row.option === 'Not going' ? 0 : row.guests || 1,
      submitted: submittedText(row),
    })),
    [
      { key: 'name', header: 'Name' },
      { key: 'response', header: 'Response' },
      { key: 'people', header: 'Number of People' },
      { key: 'submitted', header: 'Submitted At' },
    ],
    `${item.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_rsvps`
  );

  return (
    <div className="space-y-3">
      {item.subtitle && <p className="text-sm text-gray-500">{item.subtitle}</p>}
      <div className="flex flex-wrap gap-2 text-sm">
        {RSVP_OPTIONS.map((option) => (
          <span key={option} className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
            {option}: {rows.filter((row) => row.option === option).length}
            {option !== 'Not going' && ` (${people(option)} people)`}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No RSVPs yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Response</th><th className="px-3 py-2">People</th><th className="px-3 py-2">Submitted</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-medium text-gray-800">{row.name || 'Guest'}</td>
                    <td className="px-3 py-2">{row.option}</td>
                    <td className="px-3 py-2">{row.option === 'Not going' ? '–' : row.guests || 1}</td>
                    <td className="px-3 py-2 text-gray-500">{submittedText(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={download} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Download CSV</button>
        </>
      )}
    </div>
  );
};

// Polls and event RSVPs from every newsletter, refreshed on load.
const PollsAndRsvps = ({ memberId }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await apiNewsletters(false);
        const found = [];
        for (const nl of list) {
          let data = nl;
          try { data = await apiNewsletterGet(nl.id); } catch (error) { /* skip individual fetch failures */ }
          const newsletterName = data.name || data.title || 'Untitled Newsletter';
          const sections = Array.isArray(data.content?.sections) ? data.content.sections : [];
          sections.forEach((section) => {
            if (section.type === 'response') {
              found.push({
                key: `${nl.id}__${section.id}`, kind: 'poll', newsletterId: nl.id, sectionId: section.id, newsletterName,
                title: section.responsePrompt || 'Untitled poll', options: (section.responseOptions || []).filter(Boolean),
              });
            } else if (section.type === 'event' && section.eventCollectRsvps) {
              found.push({
                key: `${nl.id}__${section.id}`, kind: 'event', newsletterId: nl.id, sectionId: section.id, newsletterName,
                title: section.eventName || 'Untitled event', subtitle: formatEventDate(section.eventDate),
              });
            }
          });
        }
        setItems(found);
      } catch (error) {
        console.error('Error loading polls and events:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const current = items.find((item) => item.key === selected);

  return (
    <div className="mt-10">
      <div className="mb-4 rounded-xl bg-white/80 p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-gray-900">Polls &amp; Event RSVPs</h2>
        <p className="text-gray-600">Live results from the Poll and Event sections in the newsletters.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div className="h-fit rounded-xl bg-white p-4 shadow-md">
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500">No polls or events with RSVPs yet.</p>
          ) : (
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.key}>
                  <button
                    onClick={() => setSelected(item.key)}
                    className={`w-full rounded-lg px-3 py-2 text-left transition ${selected === item.key ? 'bg-church-cream text-church-navy-deep' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    <div className="text-sm font-medium">{item.kind === 'poll' ? '📊' : '📅'} {item.title}</div>
                    <div className="text-xs text-gray-500">{item.newsletterName}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg bg-white p-6 shadow-md">
          {!current ? (
            <p className="py-10 text-center text-gray-500">Select a poll or event to see its results.</p>
          ) : (
            <>
              <h3 className="mb-3 font-bold text-gray-900">{current.title}</h3>
              {current.kind === 'poll'
                ? <PollDetail key={current.key} memberId={memberId} item={current} />
                : <EventDetail key={current.key} memberId={memberId} item={current} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PollsAndRsvps;
