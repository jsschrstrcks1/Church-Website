// Helpers for the newsletter page background's focal point (the part kept in view when trimmed)
export const DEFAULT_FOCUS = 50;

export const clampFocus = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : DEFAULT_FOCUS;
};

export const focusPosition = (newsletter) =>
  `${clampFocus(newsletter?.backgroundFocusX ?? DEFAULT_FOCUS)}% ${clampFocus(newsletter?.backgroundFocusY ?? DEFAULT_FOCUS)}%`;
