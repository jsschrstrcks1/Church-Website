// NewsletterBackground - the fixed full-screen page background for a newsletter.
// Phones are tall and narrow, computers wide, so one image is trimmed differently on each.
// The author picks a focal point (kept in view when trimming) and may add a separate
// phone image; <picture> swaps to it on narrow screens. An <img> is used instead of a CSS
// background because it renders more consistently on iOS.
import { focusPosition } from '../../utils/newsletterBackground';

const NewsletterBackground = ({ newsletter, alt = '' }) => {
  if (!newsletter?.backgroundImage) return null;

  return (
    <picture>
      {newsletter.backgroundImageMobile && (
        <source media="(max-width: 767px)" srcSet={newsletter.backgroundImageMobile} />
      )}
      <img
        src={newsletter.backgroundImage}
        alt={alt}
        className="no-print"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: focusPosition(newsletter),
          zIndex: 0,
        }}
      />
    </picture>
  );
};

export default NewsletterBackground;
