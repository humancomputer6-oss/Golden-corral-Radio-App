function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  // Prevent CSV formula injection in spreadsheet tools
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  const escaped = formulaSafe.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function maskEmailForPrivacy(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '[REDACTED]';
  const [local, domain] = parts;
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function extractIsoDate(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  return '';
}

export function isWithinDateRange(dateStr: string, startDate: string, endDate: string): boolean {
  if (!dateStr) return true;
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

export function generateCsvContent(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
