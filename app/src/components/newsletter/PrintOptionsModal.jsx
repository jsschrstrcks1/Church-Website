import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PRINT_LAYOUTS, loadPrintOptions, printNewsletter } from '../../utils/newsletterPrint';

const PrintOptionsModal = ({ open, onClose, onBeforePrint }) => {
  const [options, setOptions] = useState(loadPrintOptions);

  useEffect(() => {
    if (open) setOptions(loadPrintOptions());
  }, [open]);

  if (!open) return null;

  const set = (patch) => setOptions((current) => ({ ...current, ...patch }));

  const handlePrint = () => {
    onClose();
    printNewsletter(options, { onBeforePrint });
  };

  return createPortal(
    <div
      className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Print options"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Print / PDF options</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none" aria-label="Close">×</button>
        </div>

        <p className="text-sm font-semibold text-gray-700 mb-2">Page layout</p>
        <div className="space-y-2 mb-5">
          {Object.entries(PRINT_LAYOUTS).map(([id, layout]) => (
            <label
              key={id}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${options.layout === id ? 'border-church-navy bg-church-cream' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <input
                type="radio"
                name="print-layout"
                checked={options.layout === id}
                onChange={() => set({ layout: id })}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">{layout.label}</span>
                <span className="block text-xs text-gray-600">{layout.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <p className="text-sm font-semibold text-gray-700 mb-2">Ink and color</p>
        <label className="flex items-start gap-3 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.removeBackground}
            onChange={(e) => set({ removeBackground: e.target.checked })}
            className="mt-1"
          />
          <span className="text-sm text-gray-800">Remove page background image</span>
        </label>
        <label className="flex items-start gap-3 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={options.inkSaver}
            onChange={(e) => set({ inkSaver: e.target.checked })}
            className="mt-1"
          />
          <span className="text-sm text-gray-800">Ink saver: plain white header and sections</span>
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium">
            Cancel
          </button>
          <button onClick={handlePrint} className="flex-1 px-4 py-2 rounded-lg bg-church-navy hover:bg-church-navy-deep text-white font-medium">
            Print / Save PDF
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PrintOptionsModal;
