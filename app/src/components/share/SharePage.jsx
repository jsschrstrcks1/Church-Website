// Public share page (/share): the church's one link with the calendar, the newsletters, and any
// custom buttons the admins added. Anyone can open it; nothing private is read.
//   - Look:  spaces/church/settings/sharePageCustomization (publicly readable)
//   - Cards: spaces/church/newsletters (published ones listed on the share page)
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CHURCH_NAME, CHURCH_LOCATION } from '../../firebase/config';
import { apiNewsletters, apiShareSettings } from '../../api/client';
import { buildShareResources, orderShareResources, publicNewsletterFilter } from '../../utils/shareResources';
import { usePageMeta, DEFAULT_ICON } from '../../hooks/usePageMeta';
import CustomLinkButton from '../shared/CustomLinkButton';

const SharePage = () => {
  // A single shared church page (no per-account spaces on the self-hosted backend).
  const [newsletters, setNewsletters] = useState([]);
  const [customization, setCustomization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [avatarIsSquare, setAvatarIsSquare] = useState(false);

  const pageTitle = customization?.classroomTitle || CHURCH_NAME;

  usePageMeta({
    title: pageTitle === CHURCH_NAME ? undefined : pageTitle,
    description: customization?.welcomeMessage || 'Church calendar, newsletters, and links in one place.',
    image: customization?.avatarUrl || undefined,
    icon: customization?.homeScreenIconUrl || DEFAULT_ICON,
    iconType: customization?.homeScreenIconUrl ? customization?.homeScreenIconType || undefined : 'image/png',
    appName: pageTitle
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      window.prompt('Copy this link:', window.location.href);
    });
  };

  useEffect(() => {
    const load = async () => {
      try {
        // Independent reads, so run them together
        const [allNl, settings] = await Promise.all([
          apiNewsletters(false),
          apiShareSettings()
        ]);

        setNewsletters(allNl.filter(publicNewsletterFilter).sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)));
        if (settings && Object.keys(settings).length) setCustomization(settings);
      } catch (err) {
        console.error('Error loading share page:', err);
        setError('Something went wrong loading this page. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-church-paper flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-church-navy mx-auto"></div>
          <p className="mt-4 text-church-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-church-paper flex items-center justify-center px-4">
        <div className="bg-white border border-church-border rounded-xl shadow-sm p-8 max-w-md w-full text-center">
          <h1 className="font-serif text-2xl text-church-navy mb-3">Page not found</h1>
          <p className="text-church-muted mb-6">{error}</p>
          <a href="/" className="inline-block px-6 py-3 bg-church-red hover:bg-church-red-dark text-white rounded font-semibold transition">
            Go to the church website
          </a>
        </div>
      </div>
    );
  }

  const resources = orderShareResources(
    buildShareResources({ newsletters }),
    customization?.resourceOrder
  );
  const hasBackground = !!customization?.backgroundImageUrl;

  return (
    <div className="min-h-screen relative bg-church-cream font-sans text-church-ink">
      {/* Custom background, fixed so the content scrolls over it. An <img> rather than
          background-attachment: fixed, which iOS Safari doesn't support. */}
      {hasBackground && (
        <img
          src={customization.backgroundImageUrl}
          alt=""
          aria-hidden="true"
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
        />
      )}

      <div className="relative" style={{ zIndex: 1 }}>
        {/* Header matching the church site */}
        <header className="bg-church-paper/95 border-b border-church-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
            <a href="/" className="flex items-center gap-3 w-fit mx-auto">
              <img src="/images/logo.png" alt="" className="h-10 w-10 object-contain" />
              <span className="font-serif text-church-navy text-base sm:text-lg leading-tight">{CHURCH_NAME}</span>
            </a>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          {/* Header card; on a photo background it gets a light panel so the text stays readable */}
          <div className={`text-center mb-10 ${hasBackground ? 'bg-church-paper/90 backdrop-blur-sm rounded-2xl shadow-lg px-5 py-8 md:px-10' : ''}`}>
            {customization?.avatarUrl ? (
              // Round white frame with the picture fitted inside. (The frame is rounded, not the image:
              // Chrome clips a rounded, padded image to a smaller circle and cuts off logos.)
              // Square pictures (badges, headshots) fill the circle;
              // wide or tall ones (logos with text) are fitted inside so nothing is cut off.
              <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg border-4 border-white ring-1 ring-church-border overflow-hidden">
                <img
                  src={customization.avatarUrl}
                  alt={CHURCH_NAME}
                  onLoad={(e) => {
                    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                    setAvatarIsSquare(Math.abs(w - h) / Math.max(w, h) < 0.08);
                  }}
                  className={avatarIsSquare ? 'w-full h-full object-cover' : 'w-[70%] h-[70%] object-contain'}
                />
              </div>
            ) : (
              // No picture uploaded: the church logo on a white circle (the logo has a white background)
              <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg border-4 border-white ring-1 ring-church-border overflow-hidden">
                <img src="/images/logo.png" alt={CHURCH_NAME} className="w-[70%] h-[70%] object-contain" />
              </div>
            )}

            <h1 className="font-serif text-3xl sm:text-4xl text-church-navy mb-3 break-words">{pageTitle}</h1>
            <p className="text-church-muted text-lg mb-5">
              {customization?.welcomeMessage || 'Welcome! Everything you need is below.'}
            </p>

            <button
              onClick={handleCopyLink}
              className={`inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded shadow-md transition ${copied ? 'bg-green-600' : 'bg-church-red hover:bg-church-red-dark'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {copied ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                )}
              </svg>
              {copied ? 'Link Copied!' : 'Copy Share Link'}
            </button>
            <p className="text-church-muted text-sm mt-2">
              {customization?.shareInstructionText || 'Then paste it into Notes or text it to yourself'}
            </p>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            {resources.map((resource) => {
              const body = (
                <>
                  <div className={`h-1.5 ${resource.pinned ? 'bg-church-red' : 'bg-church-navy'}`}></div>
                  <div className="p-5 sm:p-6 flex items-start gap-4">
                    <div className="w-14 h-14 bg-church-cream rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <span className="text-3xl" aria-hidden="true">{resource.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-serif text-xl text-church-navy group-hover:text-church-red-dark transition-colors break-words">
                        {resource.name}
                      </h2>
                      <p className="text-church-muted text-sm mt-1">{resource.description}</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-church-red-dark group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </>
              );
              const className = 'group block bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden';
              // The calendar and home page are the plain-HTML site, not app routes
              return resource.external ? (
                <a key={resource.id} href={resource.url} className={className}>{body}</a>
              ) : (
                <Link key={resource.id} to={resource.url} className={className}>{body}</Link>
              );
            })}
          </div>

          {customization?.customButtons?.length > 0 && (
            <div className="mt-8 max-w-md mx-auto space-y-3">
              {customization.customButtons.map((button) => (
                <CustomLinkButton key={button.id} button={button} />
              ))}
            </div>
          )}

          <div className="mt-12 text-center">
            <a
              href="/"
              className={`inline-block text-sm text-church-muted hover:text-church-navy ${hasBackground ? 'bg-church-paper/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-md' : ''}`}
            >
              © {new Date().getFullYear()} {CHURCH_NAME} · {CHURCH_LOCATION}
            </a>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SharePage;
