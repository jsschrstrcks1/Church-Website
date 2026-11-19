// Updates the page title and link-preview tags (and optionally the home-screen icon) while a page is open.
// Everything is put back the way it was when the page closes.

import { useEffect } from 'react';
import { CHURCH_NAME, CHURCH_LOCATION } from '../firebase/config';

const DEFAULT_SITE_NAME = CHURCH_NAME;
const DEFAULT_DESCRIPTION = `${CHURCH_NAME} in ${CHURCH_LOCATION}`;
export const DEFAULT_ICON = '/images/logo.png';

/**
 * @param {Object} options
 * @param {string} options.title - Page title
 * @param {string} options.description - Page description
 * @param {string} options.image - Image URL for link previews
 * @param {string} options.type - Content type (website, article, etc.)
 * @param {string} options.url - Canonical URL
 * @param {string} options.icon - Optional home-screen icon (shown when someone adds the page to their
 *   phone's home screen). Sets apple-touch-icon and a small web manifest.
 * @param {string} options.iconType - MIME type of `icon` (for Android's manifest), e.g. 'image/png'
 * @param {string} options.appName - Name under the home-screen icon (defaults to the title)
 */
export const usePageMeta = ({
  title,
  description,
  image,
  type = 'website',
  url,
  icon,
  iconType,
  appName
} = {}) => {
  useEffect(() => {
    const originalTitle = document.title;
    const originalMetas = {};
    const addedLinks = [];
    const originalLinks = [];

    const updateMetaTag = (selector, attribute, value) => {
      let tag = document.querySelector(selector);
      const wasCreated = !tag;

      if (!tag) {
        tag = document.createElement('meta');
        if (selector.includes('property=')) {
          const property = selector.match(/property="([^"]+)"/)?.[1];
          if (property) tag.setAttribute('property', property);
        } else if (selector.includes('name=')) {
          const name = selector.match(/name="([^"]+)"/)?.[1];
          if (name) tag.setAttribute('name', name);
        }
        document.head.appendChild(tag);
      }

      originalMetas[selector] = wasCreated ? null : tag.getAttribute(attribute);
      tag.setAttribute(attribute, value);
    };

    // Replaces any existing <link rel="..."> with a new one; the old ones come back on close
    const setLink = (rel, href, extra = {}) => {
      document.querySelectorAll(`link[rel="${rel}"]`).forEach((existing) => {
        originalLinks.push(existing);
        existing.remove();
      });
      const link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      Object.entries(extra).forEach(([k, v]) => link.setAttribute(k, v));
      document.head.appendChild(link);
      addedLinks.push(link);
    };

    document.title = title ? `${title} | ${DEFAULT_SITE_NAME}` : DEFAULT_SITE_NAME;

    const pageDescription = description || DEFAULT_DESCRIPTION;
    const pageUrl = url || window.location.href;

    updateMetaTag('meta[name="description"]', 'content', pageDescription);

    updateMetaTag('meta[property="og:title"]', 'content', title || DEFAULT_SITE_NAME);
    updateMetaTag('meta[property="og:description"]', 'content', pageDescription);
    updateMetaTag('meta[property="og:site_name"]', 'content', DEFAULT_SITE_NAME);
    updateMetaTag('meta[property="og:type"]', 'content', type);
    updateMetaTag('meta[property="og:url"]', 'content', pageUrl);
    if (image) updateMetaTag('meta[property="og:image"]', 'content', image);

    updateMetaTag('meta[name="twitter:card"]', 'content', image ? 'summary_large_image' : 'summary');
    updateMetaTag('meta[name="twitter:title"]', 'content', title || DEFAULT_SITE_NAME);
    updateMetaTag('meta[name="twitter:description"]', 'content', pageDescription);
    if (image) updateMetaTag('meta[name="twitter:image"]', 'content', image);

    // Home-screen icon: iPhone reads apple-touch-icon; Android reads the manifest
    if (icon) {
      const name = (appName || title || DEFAULT_SITE_NAME).slice(0, 45);
      const absoluteIcon = new URL(icon, window.location.origin).href;
      setLink('apple-touch-icon', absoluteIcon);
      updateMetaTag('meta[name="apple-mobile-web-app-title"]', 'content', name);
      const manifest = {
        name,
        short_name: name.slice(0, 12),
        start_url: window.location.href,
        scope: window.location.origin + '/',
        display: 'browser',
        background_color: '#fffdf8',
        theme_color: '#10295e',
        icons: [
          { src: absoluteIcon, sizes: '192x192', type: iconType || 'image/png' },
          { src: absoluteIcon, sizes: '512x512', type: iconType || 'image/png' }
        ]
      };
      setLink('manifest', `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`);
    }

    return () => {
      document.title = originalTitle;

      Object.entries(originalMetas).forEach(([selector, originalValue]) => {
        const tag = document.querySelector(selector);
        if (!tag) return;
        if (originalValue === null) tag.remove();
        else tag.setAttribute('content', originalValue);
      });

      addedLinks.forEach((link) => link.remove());
      originalLinks.forEach((link) => document.head.appendChild(link));
    };
  }, [title, description, image, type, url, icon, iconType, appName]);
};

export default usePageMeta;
