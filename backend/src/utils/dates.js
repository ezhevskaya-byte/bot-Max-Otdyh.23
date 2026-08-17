const DATE_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

export function parseRuDate(str) {
  const m = String(str).trim().match(DATE_RE);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (date.getDate() !== Number(d)) return null;
  return date;
}

export function formatRuDate(date) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

export function nightsBetween(checkIn, checkOut) {
  const a = parseRuDate(checkIn);
  const b = parseRuDate(checkOut);
  if (!a || !b || b <= a) return 0;
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
}

export function isValidDateRange(checkIn, checkOut) {
  const a = parseRuDate(checkIn);
  const b = parseRuDate(checkOut);
  return Boolean(a && b && b > a);
}
