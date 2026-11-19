// Member dashboard: tiles for each tool, upcoming calendar events, and Share Your App.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useMemberAuth } from '../../context/MemberAuthContext';
import AdminNav from './AdminNav';
import ShareYourApp from './ShareYourApp';

const TILES = [
  {
    id: 'events',
    to: '/admin/events',
    title: 'Calendar',
    description: 'Add events to the public calendar',
    svgPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
  },
  {
    id: 'newsletter',
    to: '/admin/newsletter',
    title: 'Newsletters',
    description: 'Create and publish newsletters',
    svgPath: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z'
  },
  {
    id: 'form-responses',
    to: '/admin/form-responses',
    title: 'Responses',
    description: 'Form answers, polls, and RSVPs',
    svgPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
  },
  {
    id: 'live',
    to: '/admin/live',
    title: 'Live Studio',
    description: 'Go live on YouTube, Facebook, and more at once',
    svgPath: 'M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
  },
  {
    id: 'members',
    ownerOnly: true,
    to: '/admin/members',
    title: 'Members',
    description: 'Invite and manage admins',
    svgPath: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-4.13a4 4 0 11-8 0 4 4 0 018 0zm6 2a3 3 0 11-6 0 3 3 0 016 0z'
  }
];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDate = (key) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const Dashboard = ({ memberProfile }) => {
  const { isOwner } = useMemberAuth();
  const [upcoming, setUpcoming] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'events'),
          where('date', '>=', todayKey()),
          orderBy('date'),
          limit(5)
        ));
        setUpcoming(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('Error loading upcoming events:', error);
        setUpcoming([]);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-church-paper font-sans text-church-ink">
      <AdminNav />

      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="font-serif text-3xl md:text-4xl text-church-navy">
              Welcome back, {memberProfile?.name?.split(' ')[0] || 'friend'}
            </h1>
            {isOwner && (
              <span className="px-3 py-1 bg-church-navy/10 text-church-navy text-xs font-semibold uppercase tracking-wide rounded-full">
                Owner
              </span>
            )}
          </div>
          <p className="text-church-muted md:text-lg">Keep the calendar current, publish newsletters, and share them with the church family.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 mb-8">
          {TILES.filter((tile) => !tile.ownerOnly || isOwner).map((tile) => (
            <Link
              key={tile.id}
              to={tile.to}
              className="bg-white rounded-xl shadow-sm border border-church-border hover:shadow-md hover:-translate-y-0.5 transition p-6 block"
            >
              <div className="w-12 h-12 bg-church-cream rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-church-red-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={tile.svgPath} />
                </svg>
              </div>
              <h3 className="font-semibold text-church-navy">{tile.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{tile.description}</p>
            </Link>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-church-border p-6 mb-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="font-semibold text-church-navy text-lg">Coming up on the calendar</h2>
            <Link to="/admin/events" className="text-sm font-semibold text-church-red-dark hover:underline whitespace-nowrap">Manage events</Link>
          </div>
          {upcoming === null ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-church-navy"></div>
            </div>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-church-muted">
              No upcoming events yet. <Link to="/admin/events" className="text-church-red-dark font-medium hover:underline">Add the first one</Link>.
            </p>
          ) : (
            <ul className="divide-y divide-church-border">
              {upcoming.map((event) => (
                <li key={event.id} className="py-3 flex items-baseline gap-4">
                  <span className="text-sm font-semibold text-church-navy w-28 flex-shrink-0">{formatDate(event.date)}</span>
                  <span className="min-w-0">
                    <span className="block text-gray-900 truncate">{event.en}</span>
                    {(event.time || event.place) && (
                      <span className="block text-xs text-church-muted truncate">{[event.time, event.place].filter(Boolean).join(' · ')}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-8">
          <ShareYourApp memberProfile={memberProfile} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
