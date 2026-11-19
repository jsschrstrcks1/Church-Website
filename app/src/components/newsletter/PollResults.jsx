import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

// Live poll results, read from the tally document the onNewsletterPollVote function maintains.
const PollResults = ({ memberId, newsletterId, sectionId, options, accentColor, textColor }) => {
  const [tally, setTally] = useState(null);

  useEffect(() => {
    if (!memberId || !newsletterId || !sectionId) return undefined;
    return onSnapshot(
      doc(db, 'spaces', memberId, 'newsletters', newsletterId, 'pollTallies', sectionId),
      (snap) => setTally(snap.exists() ? snap.data() : { counts: [], total: 0 }),
      () => setTally({ counts: [], total: 0 })
    );
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
