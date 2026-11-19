// Picks readable text for a given background color, so text never disappears into a
// button when a member chooses a light (or very dark) accent color.

const DARK_TEXT = '#111827';
const LIGHT_TEXT = '#ffffff';

const parseHex = (hex) => {
  if (typeof hex !== 'string') return null;
  let clean = hex.trim().replace('#', '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [0, 2, 4].map((i) => parseInt(clean.substring(i, i + 2), 16));
};

// WCAG relative luminance (0 = black, 1 = white)
const luminance = ([r, g, b]) => {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

const contrastRatio = (a, b) => {
  const [lighter, darker] = luminance(a) >= luminance(b) ? [a, b] : [b, a];
  return (luminance(lighter) + 0.05) / (luminance(darker) + 0.05);
};

// Returns white or near-black, whichever has more contrast against `backgroundHex`.
export const getReadableTextColor = (backgroundHex) => {
  const background = parseHex(backgroundHex);
  if (!background) return LIGHT_TEXT;
  const white = parseHex(LIGHT_TEXT);
  const dark = parseHex(DARK_TEXT);
  return contrastRatio(background, white) >= contrastRatio(background, dark) ? LIGHT_TEXT : DARK_TEXT;
};
