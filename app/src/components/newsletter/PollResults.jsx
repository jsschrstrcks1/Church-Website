import { useEffect, useState } from 'react';
import { apiPollTallies } from '../../api/client';

// Poll results, fetched from the tally the worker's /polls/:id/votes endpoint maintains.
const PollResults = ({ memberId, newsletterId, sectionId, options, accentColor, textColor }) => {
  const [tally, setTally] = useState(null);

  useEffect(() => {
    if (!memberId || !newsletterId || !sectionId) return undefined;
    let cancelled = false;
    const load = async () => {
      const rows = await apiPollTallies(sectionId).catch(() => []);
      if (cancelled) return;
      setTally({ counts: rows.map((row) => ({ option: row.option_text, count: Number(row.votes) || 0 })), total: 0 });
    };
    load();
    return () => { cancelled = true; };
  }, [memberId, newsletterId, sectionId]);

  if (!tally) return null;

  const countFor = (option) => (tally.counts || []).find((entry) => entry.option === option)?.count || 0;
  const total = (options || []).reduce((sum, option) => sum + countFor(option), 0);

  return (
    <div className="mt-4 space-y-2">
      {(options || []).map((option) => {
        const count = countFor(option);
        const percent = total ? Math.round((count / total) * 100) : 0;
        return (
          <div key={option}>
            <div className="mb-1 flex justify-between gap-3 text-sm" style={{ color: textColor || '#374151' }}>
              <span className="font-medium">{option}</span>
              <span className="shrink-0 tabular-nums">{count} · {percent}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: accentColor }} />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-gray-500">{total} {total === 1 ? 'vote' : 'votes'}</p>
    </div>
  );
};

export default PollResults;
