import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db, CHURCH_NAME } from '../../firebase/config';
import { usePageMeta } from '../../hooks/usePageMeta';

const NewsletterArchive = () => {
  const { memberId, newsletterId } = useParams();
  const resolvedNewsletterId = newsletterId || 'primary';
  const buildNewsletterPath = (suffix = '') => (
    newsletterId ? `/newsletter/${memberId}/${newsletterId}${suffix}` : `/newsletter/${memberId}${suffix}`
  );
  const [newsletters, setNewsletters] = useState([]);
  const [authorName, setAuthorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  usePageMeta({
    title: authorName ? `${authorName}'s Newsletter Archive` : 'Newsletter Archive',
    description: `Browse past newsletters from ${CHURCH_NAME}.`,
    type: 'website',
  });

  useEffect(() => {
    const loadArchive = async () => {
      try {
        const [authorSnapshot, currentSnapshot, archiveSnapshot] = await Promise.all([
          getDoc(doc(db, 'publicMembers', memberId)),
          getDoc(doc(db, 'spaces', memberId, 'newsletters', resolvedNewsletterId)),
          getDocs(query(collection(db, 'spaces', memberId, 'newsletters', resolvedNewsletterId, 'archive'), orderBy('archivedAt', 'desc'))),
        ]);

        if (authorSnapshot.exists()) {
          setAuthorName(authorSnapshot.data().name || '');
        }

        const items = archiveSnapshot.docs.map((snapshot) => ({ id: snapshot.id, archived: true, ...snapshot.data() }));
        if (currentSnapshot.exists() && currentSnapshot.data().published) {
          items.unshift({ id: 'current', current: true, ...currentSnapshot.data() });
        }
        setNewsletters(items);
      } catch (loadError) {
        console.error('Error loading newsletter archive:', loadError);
        setError('We could not load this newsletter archive. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadArchive();
  }, [memberId, newsletterId]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-600">Loading newsletter archive...</div>;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-church-cream to-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-2xl bg-church-navy px-6 py-10 text-white shadow-lg sm:px-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-church-gold">{CHURCH_NAME}</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{authorName ? `${authorName}'s Newsletter Archive` : 'Newsletter Archive'}</h1>
          <p className="mt-3 text-white/80">Catch up on church news, events, and announcements.</p>
        </header>

        {error ? (
          <p className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</p>
        ) : newsletters.length === 0 ? (
          <p className="mt-8 rounded-xl bg-white p-8 text-center text-slate-600 shadow-sm">No newsletters have been archived yet.</p>
        ) : (
          <section className="mt-8 space-y-4">
            {newsletters.map((newsletter) => {
              const date = newsletter.current ? newsletter.publishedDate : newsletter.archivedAt || newsletter.publishedDate;
              const url = newsletter.current
                ? buildNewsletterPath()
                : buildNewsletterPath(`/archive/${newsletter.id}`);
              return (
                <Link key={newsletter.id} to={url} className="block rounded-xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">{newsletter.title || 'Untitled Newsletter'}</h2>
                    {newsletter.current && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Latest</span>}
                  </div>
                  {newsletter.subtitle && <p className="mt-2 text-slate-600">{newsletter.subtitle}</p>}
                  {date && <p className="mt-4 text-sm font-medium text-church-red-dark">{newsletter.current ? 'Published' : 'Archived'} {new Date(date).toLocaleDateString()}</p>}
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
};

export default NewsletterArchive;
