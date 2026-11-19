// Member-made link buttons for the Master Share Page (/share/:memberId).
//
// Used by both ShareYourApp.jsx (where the member builds the buttons) and SharePage.jsx
// (where visitors see them), so a button always looks the same in the editor preview as it does live.
// Buttons are stored as `customButtons` on members/{id}/settings/sharePageCustomization.

export const MAX_CUSTOM_BUTTONS = 10;
export const MAX_BUTTON_LABEL_LENGTH = 40;

// ---------- Color math ----------

export const isValidHex = (value) => /^#[0-9a-f]{6}$/i.test(value || '');

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = (r, g, b) =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

// Hue 0-360, saturation/value 0-1
export const hexToHsv = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? delta / max : 0, v: max };
};

export const hsvToHex = ({ h, s, v }) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
};

// WCAG relative luminance / contrast ratio
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const mixHex = (a, b) => {
  const [ra, ga, ba] = hexToRgb(a);
  const [rb, gb, bb] = hexToRgb(b);
  return rgbToHex((ra + rb) / 2, (ga + gb) / 2, (ba + bb) / 2);
};

// The button's background colors - one for a solid button, both ends plus the midpoint for a gradient
const backgroundStops = (button) => {
  const start = isValidHex(button.color) ? button.color : '#10295e';
  if (!button.gradientEnabled || !isValidHex(button.gradientColor)) return [start];
  return [start, mixHex(start, button.gradientColor), button.gradientColor];
};

// Picks white or near-black text - whichever stays most readable across every part of the
// background - so a member can never end up with red text on a red button
export const getButtonTextColor = (button) => {
  const stops = backgroundStops(button);
  const worst = (text) => Math.min(...stops.map((stop) => contrastRatio(text, stop)));
  return worst('#ffffff') >= worst('#111827') ? '#ffffff' : '#111827';
};

export const getButtonBackground = (button) => {
  const stops = backgroundStops(button);
  return stops.length === 1 ? stops[0] : `linear-gradient(135deg, ${stops[0]}, ${stops[2]})`;
};

// ---------- Links ----------

const EMAIL_RE = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
const PHONE_RE = /^\+?[\d\s().-]+$/;

const cleanPhone = (value) => {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return `${trimmed.startsWith('+') ? '+' : ''}${digits}`;
};

// Turns whatever the member typed into a safe link, or null if it isn't one.
// Accepts web addresses (https:// added if missing), email addresses and phone numbers.
export const normalizeButtonLink = (raw) => {
  const input = (raw || '').trim();
  if (!input) return null;

  if (/^mailto:/i.test(input)) {
    const address = input.slice(7);
    return EMAIL_RE.test(address.split('?')[0]) ? `mailto:${address}` : null;
  }
  if (/^tel:/i.test(input)) {
    const phone = cleanPhone(input.slice(4));
    return phone ? `tel:${phone}` : null;
  }
  if (EMAIL_RE.test(input)) return `mailto:${input}`;
  if (PHONE_RE.test(input)) {
    const phone = cleanPhone(input);
    return phone ? `tel:${phone}` : null;
  }

  // Any other scheme (javascript:, data:, ...) is refused; "example.com:8080" is not a scheme
  const hasScheme = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(input);
  if (hasScheme && !/^https?:\/\//i.test(input)) return null;
  try {
    const url = new URL(hasScheme ? input : `https://${input}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
};

// Last line of defense on the public page, in case a stored link was ever edited by hand
export const isSafeButtonLink = (url) => /^(https?:\/\/|mailto:|tel:)/i.test(url || '');

export const describeButtonLink = (url) => {
  if (/^mailto:/i.test(url)) return `Emails ${url.slice(7).split('?')[0]}`;
  if (/^tel:/i.test(url)) return `Calls ${url.slice(4)}`;
  return url;
};
