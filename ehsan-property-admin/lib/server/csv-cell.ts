// Spreadsheet applications interpret formula prefixes even inside quoted CSV fields.
export function csvCell(value: string): string {
  const text = /^[\s\uFEFF]*[=+@\-＝＋＠－]/u.test(value) || /^[\t\r\n]/.test(value)
    ? "'" + value
    : value;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
