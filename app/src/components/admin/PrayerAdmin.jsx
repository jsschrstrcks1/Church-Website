// Prayer requests — staff moderation. Anyone can submit; a request only "goes out"
// (shows in the app) once approved. Staff can approve/deny, mark answered, or delete.
import { useEffect, useMemo, useState } from 'react';
import AdminNav from './AdminNav';
import { useMemberAuth } from '../../context/MemberAuthContext';
import { apiPrayerAdminList, apiPrayerReview, apiPrayerAnswered, apiPrayerDelete } from '../../api/client';

const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', denied: 'Denied' };
const STATUS_BADGE = {
  pending: 'bg-church-cream text-church-navy border-church-border',
  approved: 'bg-green-50 text-green-700 border-green-200',
  denied: 'bg-gray-100 text-gray-500 border-gray-200'
};
const SOURCE_LABEL = { app: 'App', sms: 'SMS', email: 'Email' };

const PrayerAdmin = () => {
  const { memberProfile } = useMemberAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');

  const load = async (keepWorking = false) => {
    try {
      setRequests(await apiPrayerAdminList());
    } catch (e) {
      setError(e?.message || 'Could not load prayer requests.');
    } finally {
      if (!keepWorking) setWorking('');
      setLoading(false);
    }
  };
  useEffect(() => { load(true); }, []);

  const counts = useMemo(() => ({
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved' && !r.answered).length,
    answered: requests.filter((r) => r.answered).length
  }), [requests]);

  const order = { pending: 0, approved: 1, denied: 2 };
  const sorted = useMemo(() => [...requests].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || (b.created_at || '').localeCompare(a.created_at || '')), [requests]);

  const act = async (id, fn, label) => {
    setWorking(`${id}:${label}`); setError('');
    try { await fn(); await load(true); }
    catch (e) { setError(e?.message || `Could not ${label}.`); setWorking(''); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Prayer requests</h1>
          <p className="text-gray-600">
            Anyone can submit; a request only appears in the app once you approve it.{" "}
            {counts.pending > 0 ? <strong className="text-church-red-dark">{counts.pending} waiting for review.</strong> : 'Nothing pending — you\'re all caught up.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span><strong className="text-church-navy">{counts.pending}</strong> pending</span>
            <span><strong className="text-green-700">{counts.approved}</strong> on the app</span>
            <span><strong className="text-gray-600">{counts.answered}</strong> answered</span>
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-10 text-center text-gray-500">No prayer requests yet.</div>
        ) : (
          <div className="space-y-3">
            {sorted.map((r) => (
              <div key={r.id} className="bg-white rounded-xl shadow-md p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-lg text-gray-900 leading-snug">“{r.text}”</p>
                    <p className="mt-2 text-xs text-gray-500">
                      {SOURCE_LABEL[r.source] || r.source || 'App'}
                      {r.via_sms ? ' · via text' : ''}
                      {' · '}{r.submitted_by || 'Anonymous'}
                      {r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[r.status] || r.status}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs border ${r.visibility === 'everyone' ? 'bg-church-cream text-church-navy border-church-border' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      {r.visibility === 'everyone' ? 'Everyone' : 'Members only'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status === 'pending' && (
                    <>
                      <button
                        disabled={!!working}
                        onClick={() => act(r.id, () => apiPrayerReview(r.id, 'approved'), 'approve')}
                        className="px-3 py-1.5 rounded-lg bg-church-navy text-white text-sm font-medium hover:bg-church-navy-deep disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={!!working}
                        onClick={() => act(r.id, () => apiPrayerReview(r.id, 'denied'), 'deny')}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </>
                  )}
                  {r.status === 'approved' && (
                    <button
                      disabled={!!working}
                      onClick={() => act(r.id, () => apiPrayerAnswered(r.id, !r.answered), 'toggle answered')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 ${r.answered ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-church-cream text-church-navy border border-church-border'}`}
                    >
                      {r.answered ? 'Answered ✓' : 'Mark answered'}
                    </button>
                  )}
                  {r.status === 'denied' && (
                    <button
                      disabled={!!working}
                      onClick={() => act(r.id, () => apiPrayerReview(r.id, 'approved'), 're-approve')}
                      className="px-3 py-1.5 rounded-lg bg-church-cream text-church-navy text-sm font-medium border border-church-border hover:bg-church-red hover:text-white disabled:opacity-50"
                    >
                      Restore
                    </button>
                  )}
                  <button
                    disabled={!!working}
                    onClick={() => act(r.id, () => apiPrayerDelete(r.id), 'delete')}
                    className="px-3 py-1.5 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrayerAdmin;
