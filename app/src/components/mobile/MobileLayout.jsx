import { NavLink, Outlet } from 'react-router-dom';

// The installable phone app's shell: navy header, cream/paper canvas, and a bottom tab bar
// (Watch / Calendar / Pray). Safe-area aware for standalone home-screen mode.
export default function MobileLayout() {
  const tab = (to, label, icon) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-2 text-[13px] font-sans transition-colors ${
          isActive ? 'text-church-navy' : 'text-church-muted'
        }`
      }
    >
      {icon}
      <span className="leading-none">{label}</span>
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-church-cream font-sans text-church-ink antialiased">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-church-navy text-white shadow-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div>
            <p className="font-serif text-lg leading-tight">Lakeview Fellowship</p>
            <p className="text-[11px] tracking-[0.18em] text-white/70 uppercase">Hudson, Florida</p>
          </div>
        </div>
      </header>

      {/* Page body */}
      <main className="mx-auto max-w-md px-4 pt-5 pb-24">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-church-border bg-church-paper/95 backdrop-blur">
        <div className="flex items-stretch">
          {tab(
            '/watch',
            'Watch',
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M10 9.2v5.6l4.6-2.8z" fill="currentColor" stroke="none"/></svg>
          )}
          {tab(
            '/calendar',
            'Calendar',
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" strokeLinecap="round"/></svg>
          )}
          {tab(
            '/pray',
            'Pray',
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 20s-7.5-4.4-7.5-9.4C4.5 8 6.3 6 8.6 6c1.5 0 2.6.8 3.4 2 .8-1.2 1.9-2 3.4-2 2.3 0 4.1 2 4.1 4.6 0 5-7.5 9.4-7.5 9.4z"/></svg>
          )}
        </div>
      </nav>
    </div>
  );
}
