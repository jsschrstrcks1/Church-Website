// NewsletterBackgroundPicker - lets the author choose which part of the background image
// stays in view, and shows how it will be trimmed on a phone and on a computer.
import { DEFAULT_FOCUS, clampFocus, focusPosition } from '../../utils/newsletterBackground';

const Frame = ({ label, src, position, aspect, width }) => (
  <div className="text-center">
    <div
      className="overflow-hidden rounded-lg border-2 border-gray-300 bg-gray-100 mx-auto"
      style={{ aspectRatio: aspect, width }}
    >
      <img src={src} alt="" className="w-full h-full object-cover" style={{ objectPosition: position }} />
    </div>
    <p className="mt-1 text-xs font-semibold text-gray-600">{label}</p>
  </div>
);

const NewsletterBackgroundPicker = ({ newsletter, onChange }) => {
  const x = clampFocus(newsletter.backgroundFocusX ?? DEFAULT_FOCUS);
  const y = clampFocus(newsletter.backgroundFocusY ?? DEFAULT_FOCUS);
  const position = focusPosition(newsletter);
  const phoneSrc = newsletter.backgroundImageMobile || newsletter.backgroundImage;

  const handlePick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onChange({
      backgroundFocusX: Math.round(clampFocus(((event.clientX - rect.left) / rect.width) * 100)),
      backgroundFocusY: Math.round(clampFocus(((event.clientY - rect.top) / rect.height) * 100)),
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600">
        Tap the picture to choose what must stay visible. The edges are trimmed to fit each screen.
      </p>
      <div className="flex justify-center rounded-lg border border-gray-200 bg-gray-100 p-1">
        <div className="relative inline-block cursor-crosshair select-none leading-none" onClick={handlePick} role="presentation">
          <img src={newsletter.backgroundImage} alt="Background" className="block max-w-full max-h-64 w-auto h-auto rounded" draggable={false} />
          <span
            className="pointer-events-none absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white bg-[#10295e]/80 shadow"
            style={{ left: `${x}%`, top: `${y}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="flex items-end justify-center gap-6">
        <Frame label="Phone" src={phoneSrc} position={position} aspect="9 / 19.5" width="64px" />
        <Frame label="Computer" src={newsletter.backgroundImage} position={position} aspect="16 / 9" width="140px" />
      </div>
      {(x !== DEFAULT_FOCUS || y !== DEFAULT_FOCUS) && (
        <button
          type="button"
          onClick={() => onChange({ backgroundFocusX: DEFAULT_FOCUS, backgroundFocusY: DEFAULT_FOCUS })}
          className="text-xs text-[#10295e] underline"
        >
          Reset to center
        </button>
      )}
    </div>
  );
};

export default NewsletterBackgroundPicker;
