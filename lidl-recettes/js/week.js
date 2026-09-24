const DAYS_PER_WEEK = 7;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getUpcomingMonday(today = new Date()) {
  const monday = startOfDay(today);
  const daysUntilMonday = (8 - monday.getDay()) % DAYS_PER_WEEK;
  monday.setDate(monday.getDate() + daysUntilMonday);
  return monday;
}

// Format local (et non toISOString, en UTC) : sinon la date recule d'un jour la nuit en France.
export function toIsoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseIsoDate(isoDate) {
  const match = typeof isoDate === 'string' ? ISO_DATE_PATTERN.exec(isoDate) : null;
  if (!match) {
    return null;
  }
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 ? date : null;
}

// Une semaine enregistrée garde sa date tant qu'elle n'est pas terminée ;
// une fois passée, les menus sont conservés mais datés de la semaine qui vient.
export function resolveWeekStart(savedIsoDate, today = new Date()) {
  const savedWeekStart = parseIsoDate(savedIsoDate);
  if (!savedWeekStart) {
    return getUpcomingMonday(today);
  }
  const savedWeekEnd = new Date(savedWeekStart);
  savedWeekEnd.setDate(savedWeekEnd.getDate() + DAYS_PER_WEEK - 1);
  return startOfDay(today) > savedWeekEnd ? getUpcomingMonday(today) : savedWeekStart;
}
