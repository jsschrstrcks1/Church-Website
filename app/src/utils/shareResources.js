// Builds the list of cards shown on the church's public share page (/share),
// and applies the member's chosen display order to them.
//
// Used by both SharePage.jsx (the public page everyone sees) and ShareYourApp.jsx (the
// dashboard card where the member drags cards into order), so the two can never drift apart:
// whatever order the member sets is exactly what a visitor sees.

// The church calendar lives on the home page (public/index.html, section id="events").
// Its card is pinned first on every share page.
export const CALENDAR_URL = '/#events';

// Pass already-filtered newsletters: published, active, and either the member's primary one
// or one they chose to "Show on my share page" (see publicNewsletterFilter below).
export const buildShareResources = ({ memberId, newsletters = [] }) => [
  {
    id: 'calendar',
    name: 'Church Calendar',
    description: 'Upcoming services, events, and holidays',
    url: CALENDAR_URL,
    external: true, // the home page is not part of the app, so it needs a full page load
    icon: '📅',
    pinned: true
  },
  ...newsletters.map((newsletter) => ({
    id: `newsletter-${newsletter.id}`,
    name: newsletter.title || newsletter.name || 'Newsletter',
    description: 'The latest news and announcements',
    url: newsletter.isPrimary ? `/newsletter/${memberId}` : `/newsletter/${memberId}/${newsletter.id}`,
    icon: '📰',
    pinned: false
  })),
  {
    id: 'home',
    name: 'Church Website',
    description: 'Service times, directions, and ministries',
    url: '/',
    external: true,
    icon: '⛪',
    pinned: false
  }
];

// The newsletters that may appear on the public share page
export const publicNewsletterFilter = (n) =>
  n.published && (n.status || 'active') === 'active' && (n.isPrimary || n.isPubliclyListed);

// Applies a saved order (an array of resource ids) to the resource list. Pinned resources (the
// calendar) always come first, no matter what savedOrder says. Anything in savedOrder that no
// longer exists is ignored, and anything new that isn't in savedOrder yet (a newsletter the member
// just published) is appended at the end, so nothing goes missing until the member reorders it.
export const orderShareResources = (resources, savedOrder) => {
  const pinned = resources.filter((r) => r.pinned);
  const rest = resources.filter((r) => !r.pinned);

  if (!Array.isArray(savedOrder) || savedOrder.length === 0) {
    return [...pinned, ...rest];
  }

  const remaining = new Map(rest.map((r) => [r.id, r]));
  const ordered = [];
  for (const id of savedOrder) {
    const item = remaining.get(id);
    if (item) {
      ordered.push(item);
      remaining.delete(id);
    }
  }
  for (const r of rest) {
    if (remaining.has(r.id)) ordered.push(r);
  }

  return [...pinned, ...ordered];
};
