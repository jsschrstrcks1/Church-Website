// Print options for newsletters: background removal and bi-fold / tri-fold page layouts.
// Styles are injected only while the print dialog is open, then removed again.

export const PRINT_LAYOUTS = {
  standard: { label: 'Standard page', hint: 'Portrait letter, one column.', columns: 1 },
  bifold: { label: 'Bi-fold', hint: 'Landscape letter, 2 panels per side. Print double-sided, flip on short edge.', columns: 2 },
  trifold: { label: 'Tri-fold', hint: 'Landscape letter, 3 panels per side. Print double-sided, flip on short edge.', columns: 3 },
};

export const PRINT_DEFAULTS = { layout: 'standard', removeBackground: true, inkSaver: false };

const STORAGE_KEY = 'newsletterPrintOptions';
const STYLE_ID = 'newsletter-print-options';

export const loadPrintOptions = () => {
  try {
    return { ...PRINT_DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...PRINT_DEFAULTS };
  }
};

const CONTENT = '.newsletter-content, .newsletter-print-sections';
const SECTION = '.newsletter-section, .newsletter-print-section';
const INNER = '.newsletter-inner, .newsletter-preview-shell';
const HEADER = '.newsletter-header';

const buildCss = ({ layout, removeBackground, inkSaver }) => {
  const columns = PRINT_LAYOUTS[layout]?.columns || 1;
  let css = '@media print {\n';

  if (removeBackground) {
    css += `.page-background { display: none !important; }
body { background: #fff !important; }\n`;
  }

  if (inkSaver) {
    css += `${INNER}, ${CONTENT}, ${HEADER} { background: #fff !important; background-image: none !important; }
${HEADER} { border-bottom: 2px solid #111; }
${HEADER} * { color: #111 !important; }\n`;
  }

  if (columns > 1) {
    const gap = columns === 2 ? '0.5in' : '0.35in';
    css += `@page { size: letter landscape; margin: 0.4in; }
.container, .print-container { max-width: none !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }
.newsletter-preview-panel { padding: 0 !important; }
${INNER} { max-width: none !important; width: 100% !important; border-radius: 0 !important; box-shadow: none !important; }
${HEADER} { padding: 0.25in !important; aspect-ratio: auto !important; min-height: 0 !important; }
${HEADER} h1 { font-size: 28pt !important; }
${CONTENT} {
  column-count: ${columns};
  column-gap: ${gap};
  column-rule: 1px dashed #bbb;
  padding: 0.25in 0.1in !important;
}
${CONTENT} > * { margin: 0 0 0.18in 0 !important; }
${SECTION} { break-inside: avoid; page-break-inside: avoid; }
${SECTION}:has(h2) { break-after: avoid; }
${SECTION} h2 { font-size: ${columns === 2 ? '20pt' : '16pt'} !important; }
${SECTION} h3 { font-size: ${columns === 2 ? '15pt' : '13pt'} !important; }
${SECTION} p, ${SECTION} li { font-size: ${columns === 2 ? '11pt' : '10pt'} !important; }\n`;
  }

  return `${css}}`;
};

export const printNewsletter = (options, { onBeforePrint } = {}) => {
  const opts = { ...PRINT_DEFAULTS, ...options };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
  } catch {
    // Saving the choice is a convenience only.
  }

  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildCss(opts);
  document.head.appendChild(style);

  const cleanup = () => {
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  if (onBeforePrint) onBeforePrint();
  // Give React a moment to apply any print-mode state before the dialog opens.
  setTimeout(() => window.print(), 200);
};
