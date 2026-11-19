// Newsletter footer - shows the newsletter's Branding settings (brand name, tagline, footer
// message, contact email). Used by both the public newsletter and the editor preview so
// what the author sees while editing matches what readers see.
import { CHURCH_NAME } from '../../firebase/config';

const hexToRgba = (hex, alpha) => {
  if (!hex) return `rgba(255, 255, 255, ${alpha})`;
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const NewsletterFooter = ({ newsletter }) => {
  // Newsletters saved before Branding existed show the church name.
  const brandName = newsletter.brandName === undefined
    ? CHURCH_NAME
    : (newsletter.brandName || '').trim();
  const tagline = (newsletter.brandTagline || '').trim();
  const footerText = (newsletter.footerText || '').trim();
  const email = (newsletter.contactEmail || '').trim();
  const showEmail = Boolean(email);

  if (!brandName && !tagline && !footerText && !showEmail) return null;

  const textColor = newsletter.textColor || '#374151';
  const accentColor = newsletter.accentColor || '#e6252e';

  return (
    <div
      className="newsletter-footer p-8 border-t text-center"
      style={{
        borderColor: accentColor,
        backgroundColor: hexToRgba(newsletter.contentBackgroundColor || '#ffffff', newsletter.contentOpacity || 1),
        color: textColor,
        fontFamily: newsletter.contentFont,
      }}
    >
      {brandName && <p className="text-base font-bold" style={{ color: accentColor }}>{brandName}</p>}
      {tagline && <p className="text-sm italic" style={{ opacity: 0.75 }}>{tagline}</p>}
      {footerText && <p className="text-sm whitespace-pre-line mt-3">{footerText}</p>}
      {showEmail && (
        <p className="text-sm mt-3">
          Questions?{' '}
          <a href={`mailto:${email}`} className="underline font-medium" style={{ color: accentColor }}>{email}</a>
        </p>
      )}
    </div>
  );
};

export default NewsletterFooter;
