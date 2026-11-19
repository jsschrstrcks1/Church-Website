// Download rows as a CSV file (used by Form Responses and Polls & RSVPs).
// columns: [{ key, header }]; filename without the .csv extension.
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const exportToCSV = (data, columns, filename) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const header = columns.map((col) => csvCell(col.header)).join(',');
  const rows = data.map((item) => columns.map((col) => csvCell(item[col.key])).join(','));
  const csv = [header, ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
