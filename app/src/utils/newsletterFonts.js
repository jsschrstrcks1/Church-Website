// Web fonts (loaded in index.html and index.css) look the same on every device; system fonts vary by phone.
export const FONT_GROUPS = [
  {
    label: 'Church',
    fonts: [
      { name: 'Libre Caslon Text', value: "'Libre Caslon Text', Georgia, serif" },
      { name: 'Inter', value: "'Inter', system-ui, sans-serif" },
    ],
  },
  {
    label: 'Clean',
    fonts: [
      { name: 'Nunito', value: "'Nunito', sans-serif" },
      { name: 'Poppins', value: "'Poppins', sans-serif" },
      { name: 'Montserrat', value: "'Montserrat', sans-serif" },
      { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    ],
  },
  {
    label: 'Classic',
    fonts: [
      { name: 'Georgia', value: 'Georgia, serif' },
      { name: 'Playfair Display', value: "'Playfair Display', serif" },
      { name: 'Times New Roman', value: "'Times New Roman', Times, serif" },
    ],
  },
  {
    label: 'Friendly & rounded',
    fonts: [
      { name: 'Fredoka', value: "'Fredoka', sans-serif" },
      { name: 'Varela Round', value: "'Varela Round', sans-serif" },
      { name: 'Comfortaa', value: "'Comfortaa', sans-serif" },
      { name: 'Trebuchet MS', value: "'Trebuchet MS', Helvetica, sans-serif" },
    ],
  },
  {
    label: 'Handwritten & fun',
    fonts: [
      { name: 'Caveat', value: "'Caveat', cursive" },
      { name: 'Indie Flower', value: "'Indie Flower', cursive" },
      { name: 'Pacifico', value: "'Pacifico', cursive" },
      { name: 'Permanent Marker', value: "'Permanent Marker', cursive" },
      { name: 'Comic Sans', value: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', cursive, sans-serif" },
    ],
  },
  {
    label: 'More',
    fonts: [
      { name: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
      { name: 'Palatino', value: "'Palatino Linotype', Palatino, serif" },
      { name: 'Garamond', value: "Garamond, 'Hoefler Text', serif" },
      { name: 'Courier New', value: "'Courier New', Courier, monospace" },
      { name: 'Impact', value: 'Impact, Haettenschweiler, sans-serif' },
      { name: 'System Default', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    ],
  },
];

const firstFamily = (value = '') => value.split(',')[0].trim().replace(/['"]/g, '').toLowerCase();

const ALL_FONTS = FONT_GROUPS.flatMap((group) => group.fonts);

// Older newsletters stored slightly different font strings; match them by first family name.
export const normalizeFont = (value) => {
  if (!value) return ALL_FONTS[3].value;
  const match = ALL_FONTS.find((font) => firstFamily(font.value) === firstFamily(value));
  return match ? match.value : value;
};
