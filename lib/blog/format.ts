const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-01" → "1 Nov 2026". Parses the string directly: no Date, no timezone drift. Empty input → "". */
export function formatDate(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!MONTHS[m - 1] || !d || !y) return isoDate;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
