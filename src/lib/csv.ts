/**
 * Safe CSV export generator.
 * - Adds UTF-8 Byte Order Mark (BOM) for correct Excel Unicode rendering.
 * - Prevents CSV formula injection (DDE attacks) for characters =, +, -, @, tab, CR.
 * - Correctly escapes quotes, commas, and newlines.
 */

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str = String(value);

  // Formula injection prevention:
  // If the string starts with =, +, -, @, \t, or \r, prepend a single quote (')
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If the cell contains commas, quotes, or newlines, wrap in quotes and escape internal quotes
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function generateCsv(headers: string[], rows: unknown[][]): string {
  const utf8Bom = "\uFEFF";
  const headerLine = headers.map(sanitizeCsvCell).join(",");
  const bodyLines = rows.map((row) => row.map(sanitizeCsvCell).join(","));
  return utf8Bom + [headerLine, ...bodyLines].join("\r\n");
}
