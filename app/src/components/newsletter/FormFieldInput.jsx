const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2';

const splitAnswer = (value) => String(value || '').split(', ').filter(Boolean);

// Answers are stored as plain strings so the Form Responses table can show them as-is.
const FormFieldInput = ({ field, value = '', onChange, disabled = false }) => {
  const options = field.options || [];
  const common = { disabled, className: `${inputClass} ${disabled ? 'bg-gray-50' : ''}` };

  switch (field.type) {
    case 'longText':
      return <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} {...common} />;
    case 'dropdown':
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} {...common}>
          <option value="">Select...</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    case 'multipleChoice':
      return (
        <div className="space-y-2">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="radio"
                name={field.id}
                disabled={disabled}
                checked={value === option}
                onChange={() => onChange(option)}
                className="h-4 w-4"
              />
              {option}
            </label>
          ))}
        </div>
      );
    case 'checkboxes': {
      const selected = splitAnswer(value);
      return (
        <div className="space-y-2">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(option)}
                onChange={(e) => {
                  const next = e.target.checked ? [...selected, option] : selected.filter((item) => item !== option);
                  onChange(options.filter((item) => next.includes(item)).join(', '));
                }}
                className="h-4 w-4"
              />
              {option}
            </label>
          ))}
        </div>
      );
    }
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            disabled={disabled}
            checked={value === 'Yes'}
            onChange={(e) => onChange(e.target.checked ? 'Yes' : '')}
            className="h-4 w-4"
          />
          Yes
        </label>
      );
    case 'email':
      return <input type="email" inputMode="email" autoComplete="email" value={value} onChange={(e) => onChange(e.target.value)} {...common} />;
    case 'phone':
      return <input type="tel" inputMode="tel" autoComplete="tel" value={value} onChange={(e) => onChange(e.target.value)} {...common} />;
    case 'date':
      return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} {...common} />;
    case 'number':
      return <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} {...common} />;
    default:
      return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} {...common} />;
  }
};

export default FormFieldInput;
