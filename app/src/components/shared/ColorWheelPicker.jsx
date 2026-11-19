// Color wheel picker - drag around the wheel for hue (angle) and saturation (distance from the
// center), use the slider for brightness, or type a hex code directly.
import { useState, useEffect, useRef } from 'react';
import { hexToHsv, hsvToHex, isValidHex } from '../../utils/customShareButtons';

const WHEEL_SIZE = 160;
// Church brand colors first (navy, red, gold, blue), then a general palette
const PRESETS = ['#10295e', '#e6252e', '#e7bd49', '#0861ef', '#f97316', '#22c55e', '#14b8a6', '#a855f7', '#ec4899', '#111827', '#ffffff'];

const ColorWheelPicker = ({ value, onChange, label }) => {
  // Kept as HSV so hue isn't lost when the color is dragged to white or black
  const [hsv, setHsv] = useState(() => hexToHsv(isValidHex(value) ? value : '#10295e'));
  const [hexInput, setHexInput] = useState(value || '');
  const wheelRef = useRef(null);

  // Follow outside changes (a preset, a different button being edited) without clobbering our hue
  useEffect(() => {
    if (isValidHex(value) && value.toLowerCase() !== hsvToHex(hsv)) {
      setHsv(hexToHsv(value));
    }
    setHexInput(value || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (next) => {
    setHsv(next);
    onChange(hsvToHex(next));
  };

  const pickFromPointer = (event) => {
    const rect = wheelRef.current.getBoundingClientRect();
    const radius = rect.width / 2;
    const dx = event.clientX - rect.left - radius;
    const dy = event.clientY - rect.top - radius;
    // 0deg is straight up, going clockwise - matches the conic-gradient below
    const h = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    const s = Math.min(Math.hypot(dx, dy) / radius, 1);
    commit({ h, s, v: hsv.v || 1 });
  };

  const markerAngle = hsv.h * Math.PI / 180;
  const markerX = WHEEL_SIZE / 2 + hsv.s * (WHEEL_SIZE / 2) * Math.sin(markerAngle);
  const markerY = WHEEL_SIZE / 2 - hsv.s * (WHEEL_SIZE / 2) * Math.cos(markerAngle);
  const fullBrightness = hsvToHex({ ...hsv, v: 1 });

  return (
    <div className="space-y-3">
      {label && <p className="text-sm font-medium text-gray-700">{label}</p>}
      <div className="flex flex-wrap items-center gap-5">
        <div
          ref={wheelRef}
          role="slider"
          aria-label={`${label || 'Color'} wheel`}
          aria-valuetext={hsvToHex(hsv)}
          className="relative rounded-full shadow-inner cursor-crosshair flex-shrink-0 select-none"
          style={{
            width: WHEEL_SIZE,
            height: WHEEL_SIZE,
            touchAction: 'none',
            background: 'radial-gradient(circle closest-side, #ffffff, rgba(255,255,255,0)), conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            pickFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) pickFromPointer(event);
          }}
        >
          {/* Darkens the whole wheel to match the brightness slider */}
          <div className="absolute inset-0 rounded-full bg-black pointer-events-none" style={{ opacity: 1 - hsv.v }} />
          <div
            className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
            style={{ left: markerX - 8, top: markerY - 8, backgroundColor: hsvToHex(hsv), boxShadow: '0 0 0 1px rgba(0,0,0,0.4)' }}
          />
        </div>

        <div className="flex-1 min-w-[160px] space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Brightness</label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(hsv.v * 100)}
              onChange={(e) => commit({ ...hsv, v: Number(e.target.value) / 100 })}
              className="w-full h-3 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #000000, ${fullBrightness})` }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg border border-gray-300 flex-shrink-0" style={{ backgroundColor: hsvToHex(hsv) }} />
            <input
              type="text"
              value={hexInput}
              onChange={(e) => {
                const next = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                setHexInput(next);
                if (isValidHex(next)) commit(hexToHsv(next.toLowerCase()));
              }}
              maxLength={7}
              className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg font-mono text-sm uppercase focus:ring-2 focus:ring-[#c41d25] focus:border-transparent"
              aria-label={`${label || 'Color'} hex code`}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => commit(hexToHsv(preset))}
                className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition"
                style={{ backgroundColor: preset }}
                title={preset}
                aria-label={`Use ${preset}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorWheelPicker;
