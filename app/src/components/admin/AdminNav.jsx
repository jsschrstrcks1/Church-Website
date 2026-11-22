// Top bar for every /admin page: full links on desktop, a slide-out menu on phones.
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMemberAuth } from '../../context/MemberAuthContext';
import { logoutUser } from '../../firebase/auth';
import { CHURCH_NAME, CHURCH_SHORT_NAME } from '../../firebase/config';

const AdminNav = () => {
  const { memberProfile, isOwner } = useMemberAuth();
  const { pathname } = useLocation();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const links = [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/events', label: 'Calendar' },
    { to: '/admin/newsletter', label: 'Newsletters' },
    { to: '/admin/form-responses', label: 'Responses' },
    { to: '/admin/prayer', label: 'Prayer' },
    { to: '/admin/sermons', label: 'Sermons' },
    { to: '/admin/reels', label: 'Reels' },
    { to: '/admin/live', label: 'Live' },
    ...(isOwner ? [{ to: '/admin/members', label: 'Members' }] : [])
  ];

  const isCurrent = (to) => pathname === to || pathname.startsWith(`${to}/`);
  const desktopClass = (to) =>
    `${isCurrent(to) ? 'text-church-red-dark font-semibold' : 'text-gray-700 hover:text-church-red-dark font-medium'} transition text-sm xl:text-base`;
  const mobileClass = (to) =>
    `block px-4 py-3 rounded-lg font-medium transition ${isCurrent(to) ? 'bg-church-cream text-church-red-dark' : 'text-gray-700 hover:bg-church-cream hover:text-church-red-dark'}`;

  const handleLogout = async () => {
    await logoutUser();
    window.location.href = '/login';
  };

  return (
    <nav className="bg-white/95 backdrop-blur border-b border-church-border sticky top-0 z-40 font-sans">
      <div className="container mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link to="/admin/dashboard" className="flex items-center gap-3 min-w-0">
            <img src="/images/logo.png" alt="" className="w-10 h-10 object-contain flex-shrink-0" />
            <span className="font-serif text-church-navy text-lg leading-tight truncate">
              <span className="hidden sm:inline">{CHURCH_NAME}</span>
              <span className="sm:hidden">{CHURCH_SHORT_NAME}</span>
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-5 xl:gap-6">
            {links.map((link) => (
              <Link key={link.to} to={link.to} className={desktopClass(link.to)}>{link.label}</Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <a href="/" className="text-gray-700 hover:text-church-red-dark font-medium transition text-sm xl:text-base">View site</a>
            <Link to="/admin/profile" className={desktopClass('/admin/profile')}>
              {memberProfile?.name?.split(' ')[0] || 'Profile'}
            </Link>
            <button onClick={handleLogout} className="text-gray-600 hover:text-church-red transition text-sm xl:text-base">Log out</button>
          </div>

          <button
            onClick={() => setShowMobileMenu(true)}
            className="lg:hidden p-2 text-gray-700 hover:text-church-red-dark"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {showMobileMenu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowMobileMenu(false)} />
          <div className="fixed right-0 top-0 h-full w-72 max-w-[85vw] bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-church-border">
              <span className="font-semibold text-church-navy truncate">{memberProfile?.name || 'Menu'}</span>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 text-gray-600 hover:text-church-red" aria-label="Close menu">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {links.map((link) => (
                <Link key={link.to} to={link.to} className={mobileClass(link.to)} onClick={() => setShowMobileMenu(false)}>{link.label}</Link>
              ))}
              <Link to="/admin/profile" className={mobileClass('/admin/profile')} onClick={() => setShowMobileMenu(false)}>Profile</Link>
              <a href="/" className={mobileClass('/__site')}>View site</a>
            </div>
            <div className="p-4 border-t border-church-border">
              <button onClick={handleLogout} className="w-full px-4 py-3 text-church-red-dark hover:bg-red-50 rounded-lg font-medium transition">Log out</button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default AdminNav;
