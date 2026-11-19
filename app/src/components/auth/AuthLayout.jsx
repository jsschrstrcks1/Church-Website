// Shared frame for the sign-in and invite pages: church logo on top, form card on the left,
// church photo on the right (hidden on phones).
import { CHURCH_NAME } from '../../firebase/config';

const AuthLayout = ({ title, subtitle, children }) => (
  <div className="min-h-screen bg-church-paper px-4 sm:px-6 py-8 md:py-10 font-sans text-church-ink">
    <div className="max-w-6xl mx-auto">
      {/* A plain link: the home page is the separate HTML site, not part of this app */}
      <a href="/" className="inline-flex items-center gap-3 mb-8 md:mb-10">
        <img src="/images/logo.png" alt="" className="w-12 h-12 object-contain" />
        <span className="font-serif text-lg sm:text-xl text-church-navy leading-tight">
          {CHURCH_NAME}
        </span>
      </a>

      <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="bg-white rounded-xl shadow-lg shadow-church-navy/5 border border-church-border p-6 sm:p-8 md:p-10 w-full max-w-md mx-auto md:mx-0">
          <h1 className="font-serif text-3xl text-church-navy mb-2">{title}</h1>
          {subtitle && <p className="text-church-muted mb-8">{subtitle}</p>}
          {children}
        </div>

        <div className="hidden md:block">
          <div className="rounded-xl overflow-hidden shadow-lg bg-church-navy-deep">
            {/* Shown whole: the photo has the church name lettered across it, so cropping would cut the words */}
            <img src="/images/hero-church.jpg" alt="" className="w-full aspect-[1672/941] object-cover" />
            <div className="p-8 text-white">
              <p className="text-xs font-bold tracking-[0.18em] uppercase text-church-gold mb-3">Members area</p>
              <p className="font-serif text-2xl leading-snug">
                Share the calendar, publish newsletters, and keep the church family connected.
              </p>
              <p className="font-serif text-lg italic text-white/80 mt-2">
                Comparte el calendario y los boletines con la familia de la iglesia.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const inputClass =
  'w-full px-4 py-3 border border-church-border rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent outline-none transition bg-white';

export const primaryButtonClass =
  'w-full bg-church-red hover:bg-church-red-dark disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition';

export default AuthLayout;
