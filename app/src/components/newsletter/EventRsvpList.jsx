import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { RSVP_OPTIONS } from '../../utils/newsletterEvents';

// Author-only live list of RSVPs for one event section.
const EventRsvpList = ({ memberId, newsletterId, sectionId }) => {
  const [rsvps, setRsvps] = useState(null);

  useEffect(() => {
    if (!memberId || !newsletterId || !sectionId) return undefined;
    const rsvpQuery = query(
      collection(db, 'spaces', memberId, 'newsletters', newsletterId, 'responses'),
      where('sectionId', '==', sectionId)
    );
    return onSnapshot(
      rsvpQuery,
      (snap) => setRsvps(snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }))),
      () => setRsvps([])
    );
  }, [memberId, newsletterId, sectionId]);

  if (!rsvps) return null;
  if (!rsvps.length) return <p className="mt-2 text-sm text-gray-500">No RSVPs yet.</p>;

  const peopleFor = (option) => rsvps
    .filter((rsvp) => rsvp.option === option)
    .reduce((sum, rsvp) => sum + (Number(rsvp.guests) || 0), 0);

  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        {RSVP_OPTIONS.map((option) => (
          <span key={option} className="rounded-full bg-white px-3 py-1 font-medium text-gray-700 shadow-sm">
            {option}: {rsvps.filter((rsvp) => rsvp.option === option).length}
            {option !== 'Not going' && ` (${peopleFor(option)} people)`}
          </span>
        ))}
      </div>
      <ul className="max-h-48 divide-y divide-gray-200 overflow-y-auto rounded-lg bg-white text-sm">
        {[...rsvps]
          .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0))
          .map((rsvp) => (
            <li key={rsvp.id} className="flex justify-between gap-3 px-3 py-2">
              <span className="font-medium text-gray-800">{rsvp.name || 'Guest'}</span>
              <span className="shrink-0 text-gray-600">{rsvp.option}{rsvp.option !== 'Not going' && ` · ${rsvp.guests || 1}`}</span>
            </li>
          ))}
      </ul>
    </div>
  );
};

export default EventRsvpList;
