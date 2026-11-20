// Newsletter Manager - picker/list screen for a member's newsletters
import AdminNav from './AdminNav';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SITE_URL } from '../../firebase/config';
import {
  apiNewsletters, apiNewsletterCreate, apiNewsletterUpdate, apiNewsletterAction, apiNewsletterDelete
} from '../../api/client';

const generateNewsletterId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

const NewsletterManager = () => {
  const navigate = useNavigate();

  const [newsletters, setNewsletters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNewsletterName, setNewNewsletterName] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const loadNewsletters = async () => {
      setLoading(true);
      try {
        const list = await apiNewsletters(false);
        list.sort((a, b) => {
          if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
          return new Date(b.lastModified || b.createdAt || 0) - new Date(a.lastModified || a.createdAt || 0);
        });
        setNewsletters(list);
      } catch (error) {
        console.error('Error loading newsletters:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNewsletters();
  }, []);

  const activeNewsletters = newsletters.filter((n) => (n.status || 'active') === 'active');
  const archivedNewsletters = newsletters.filter((n) => n.status === 'archived');

  const createNewsletter = async () => {
    if (!newNewsletterName.trim()) return;

    setCreating(true);
    try {
      // Reserved picker id stays with the UI; the backend assigns the real uuid.
      const newId = generateNewsletterId();
      const result = await apiNewsletterCreate({ name: newNewsletterName.trim(), title: '' });
      const id = result?.id || newId;
      setShowCreateModal(false);
      setNewNewsletterName('');
      navigate(`/admin/newsletter/${id}`);
    } catch (error) {
      console.error('Error creating newsletter:', error);
      alert('Failed to create newsletter. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const duplicateNewsletter = async (newsletter) => {
    setBusyId(newsletter.id);
    try {
      const result = await apiNewsletterCreate({ name: `${newsletter.name || 'Newsletter'} (Copy)`, content: newsletter.content, theme: newsletter.theme });
      const id = result?.id;
      setNewsletters((prev) => {
        const copy = { ...newsletter, id, name: `${newsletter.name || 'Newsletter'} (Copy)`, isPrimary: false, status: 'active', published: false, viewCount: 0, isPubliclyListed: true, lastModified: new Date().toISOString(), createdAt: new Date().toISOString() };
        return [copy, ...prev];
      });
    } catch (error) {
      console.error('Error duplicating newsletter:', error);
      alert('Failed to duplicate newsletter. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const retireNewsletter = async (newsletter) => {
    if (!window.confirm(`Retire "${newsletter.name || 'this newsletter'}"? Its published link will go offline until you reactivate and republish it.`)) {
      return;
    }
    setBusyId(newsletter.id);
    try {
      await apiNewsletterAction(newsletter.id, 'archive');
      setNewsletters((prev) => prev.map((n) => (n.id === newsletter.id ? { ...n, status: 'archived', published: false } : n)));
    } catch (error) {
      console.error('Error retiring newsletter:', error);
      alert('Failed to retire newsletter. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const reactivateNewsletter = async (newsletter) => {
    setBusyId(newsletter.id);
    try {
      await apiNewsletterAction(newsletter.id, 'reactivate');
      setNewsletters((prev) => prev.map((n) => (n.id === newsletter.id ? { ...n, status: 'active' } : n)));
    } catch (error) {
      console.error('Error reactivating newsletter:', error);
      alert('Failed to reactivate newsletter. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteNewsletterEntirely = async (newsletter) => {
    if (newsletter.isPrimary) return;
    if (!window.confirm(`Permanently delete "${newsletter.name || 'this newsletter'}"? This cannot be undone — its content, archive, and history will all be removed.`)) {
      return;
    }
    setBusyId(newsletter.id);
    try {
      await apiNewsletterDelete(newsletter.id);
      setNewsletters((prev) => prev.filter((n) => n.id !== newsletter.id));
    } catch (error) {
      console.error('Error deleting newsletter:', error);
      alert('Failed to delete newsletter. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleSharePageListing = async (newsletter) => {
    const nextValue = !newsletter.isPubliclyListed;
    setNewsletters((prev) => prev.map((n) => (n.id === newsletter.id ? { ...n, isPubliclyListed: nextValue } : n)));
    try {
      await apiNewsletterAction(newsletter.id, 'toggle-list');
    } catch (error) {
      console.error('Error updating share page listing:', error);
      setNewsletters((prev) => prev.map((n) => (n.id === newsletter.id ? { ...n, isPubliclyListed: !nextValue } : n)));
      alert('Failed to update this setting. Please try again.');
    }
  };

  const copyLink = (newsletter) => {
    const url = `${SITE_URL}/newsletter${newsletter.isPrimary ? '' : `/${newsletter.id}`}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(newsletter.id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      alert('Failed to copy link. Please copy manually: ' + url);
    });
  };

  const renderCard = (newsletter) => (
    <div key={newsletter.id} className="bg-white rounded-xl shadow-md p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-gray-900">{newsletter.name || 'Untitled Newsletter'}</h3>
            {newsletter.isPrimary && (
              <span className="text-xs font-semibold bg-church-cream text-church-navy-deep px-2 py-0.5 rounded-full">Primary</span>
            )}
            {newsletter.published ? (
              <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Published</span>
            ) : (
              <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Draft</span>
            )}
          </div>
          {newsletter.title && <p className="text-sm text-gray-500 mt-1">{newsletter.title}</p>}
        </div>
      </div>

      <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
        {newsletter.lastModified && <span>Last edited {new Date(newsletter.lastModified).toLocaleDateString()}</span>}
        {typeof newsletter.viewCount === 'number' && <span>{newsletter.viewCount.toLocaleString()} views</span>}
      </div>

      {!newsletter.isPrimary && newsletter.status !== 'archived' && (
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={!!newsletter.isPubliclyListed}
            onChange={() => toggleSharePageListing(newsletter)}
          />
          Show on the church share page (once published)
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
        <Link
          to={`/admin/newsletter/${newsletter.id}`}
          className="px-3 py-1.5 text-sm font-medium bg-church-navy hover:bg-church-navy-deep text-white rounded-lg transition"
        >
          Edit
        </Link>
        {newsletter.published && (
          <button
            onClick={() => copyLink(newsletter)}
            className="px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
          >
            {copiedId === newsletter.id ? 'Copied!' : 'Copy Link'}
          </button>
        )}
        <button
          onClick={() => duplicateNewsletter(newsletter)}
          disabled={busyId === newsletter.id}
          className="px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition disabled:opacity-50"
        >
          Duplicate
        </button>
        {newsletter.status === 'archived' ? (
          <button
            onClick={() => reactivateNewsletter(newsletter)}
            disabled={busyId === newsletter.id}
            className="px-3 py-1.5 text-sm font-medium bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition disabled:opacity-50"
          >
            Reactivate
          </button>
        ) : (
          <button
            onClick={() => retireNewsletter(newsletter)}
            disabled={busyId === newsletter.id}
            className="px-3 py-1.5 text-sm font-medium bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition disabled:opacity-50"
          >
            Retire
          </button>
        )}
        {!newsletter.isPrimary && (
          <button
            onClick={() => deleteNewsletterEntirely(newsletter)}
            disabled={busyId === newsletter.id}
            className="px-3 py-1.5 text-sm font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Newsletters</h1>
            <p className="text-gray-600">The church's newsletters. Every admin can edit all of them. Run separate ones for the whole church, youth, ladies' class, and more, each with its own link.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-church-navy hover:bg-church-navy-deep text-white rounded-lg font-medium transition whitespace-nowrap"
            >
              + Create New
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-16">Loading newsletters...</div>
        ) : newsletters.length === 0 ? (
          <div className="text-center bg-white rounded-xl shadow-md p-10">
            <p className="text-gray-600 mb-4">You haven't created a newsletter yet.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-church-navy hover:bg-church-navy-deep text-white rounded-lg font-medium transition"
            >
              + Create Your First Newsletter
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              {activeNewsletters.map(renderCard)}
            </div>

            {archivedNewsletters.length > 0 && (
              <div className="mt-8">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="text-sm font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  {showArchived ? '▾' : '▸'} Retired Newsletters ({archivedNewsletters.length})
                </button>
                {showArchived && (
                  <div className="grid gap-4 mt-4">
                    {archivedNewsletters.map(renderCard)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Create New Newsletter</h3>
            <p className="text-gray-600 mb-4 text-sm">
              Give it a name to tell it apart from the other newsletters (e.g. "Church Family", "Youth", "Ladies Class"). This name is only shown to admins, not to readers.
            </p>
            <input
              type="text"
              value={newNewsletterName}
              onChange={(e) => setNewNewsletterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createNewsletter();
              }}
              placeholder="Newsletter name"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-church-navy mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setNewNewsletterName(''); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={createNewsletter}
                disabled={!newNewsletterName.trim() || creating}
                className="px-4 py-2 bg-church-navy hover:bg-church-navy-deep text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create & Edit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsletterManager;
