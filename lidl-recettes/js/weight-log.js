const WEIGHT_BOUNDS = Object.freeze({ min: 40, max: 250 });
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;

// Seuils des conseils : au-delà d'1 kg par semaine la perte se fait souvent au détriment du muscle ;
// moins de 200 g perdus en trois semaines signifie que le déficit ne fonctionne plus.
const FAST_LOSS_KG_PER_WEEK = 1;
const STALL_WINDOW_DAYS = 21;
const STALL_MAX_LOSS_KG = 0.2;
const TREND_WINDOW_DAYS = 28;
const MIN_TREND_SPAN_DAYS = 7;

export const TREND_STATUSES = Object.freeze({
  NOT_ENOUGH_DATA: 'pas-assez',
  ON_TRACK: 'en-bonne-voie',
  TOO_FAST: 'trop-rapide',
  STALLED: 'stagnation',
  GAINING: 'prise',
});

function toDayNumber(isoDate) {
  return Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10))) / MILLISECONDS_PER_DAY;
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function isValidEntry(entry) {
  return entry !== null
    && typeof entry === 'object'
    && typeof entry.date === 'string'
    && ISO_DATE_PATTERN.test(entry.date)
    && Number.isFinite(entry.kg)
    && entry.kg >= WEIGHT_BOUNDS.min
    && entry.kg <= WEIGHT_BOUNDS.max;
}

export function normalizeWeightLog(savedLog) {
  if (!Array.isArray(savedLog)) {
    return [];
  }
  const entriesByDate = new Map(savedLog.filter(isValidEntry).map((entry) => [entry.date, roundToTenth(entry.kg)]));
  return [...entriesByDate]
    .map(([date, kg]) => ({ date, kg }))
    .sort((firstEntry, secondEntry) => firstEntry.date.localeCompare(secondEntry.date));
}

export function isValidWeight(kg) {
  return Number.isFinite(kg) && kg >= WEIGHT_BOUNDS.min && kg <= WEIGHT_BOUNDS.max;
}

export function addWeightEntry(weightLog, date, kg) {
  return normalizeWeightLog([...weightLog.filter((entry) => entry.date !== date), { date, kg }]);
}

// Pente d'une régression linéaire : moins sensible qu'un simple écart premier/dernier
// aux variations d'un jour à l'autre (eau, repas de la veille).
function computeSlopeKgPerDay(entries) {
  const points = entries.map((entry) => ({ day: toDayNumber(entry.date), kg: entry.kg }));
  const meanDay = points.reduce((sum, point) => sum + point.day, 0) / points.length;
  const meanKg = points.reduce((sum, point) => sum + point.kg, 0) / points.length;
  const covariance = points.reduce((sum, point) => sum + (point.day - meanDay) * (point.kg - meanKg), 0);
  const variance = points.reduce((sum, point) => sum + (point.day - meanDay) ** 2, 0);
  return variance === 0 ? 0 : covariance / variance;
}

function selectEntriesSince(weightLog, firstDayNumber) {
  return weightLog.filter((entry) => toDayNumber(entry.date) >= firstDayNumber);
}

export function analyzeWeightTrend(weightLog, todayIsoDate) {
  const latestEntry = weightLog.at(-1) ?? null;
  const today = toDayNumber(todayIsoDate);
  const recentEntries = selectEntriesSince(weightLog, today - TREND_WINDOW_DAYS);
  const recentSpanDays = recentEntries.length >= 2
    ? toDayNumber(recentEntries.at(-1).date) - toDayNumber(recentEntries[0].date)
    : 0;
  if (recentEntries.length < 2 || recentSpanDays < MIN_TREND_SPAN_DAYS) {
    return { status: TREND_STATUSES.NOT_ENOUGH_DATA, latestEntry, weeklyChangeKg: null, totalChangeKg: null };
  }

  const weeklyChangeKg = roundToTenth(computeSlopeKgPerDay(recentEntries) * DAYS_PER_WEEK);
  const totalChangeKg = roundToTenth(latestEntry.kg - weightLog[0].kg);
  const stallEntries = selectEntriesSince(weightLog, today - STALL_WINDOW_DAYS);
  const stallSpanDays = stallEntries.length >= 2
    ? toDayNumber(stallEntries.at(-1).date) - toDayNumber(stallEntries[0].date)
    : 0;
  const stallLossKg = stallEntries.length >= 2 ? stallEntries[0].kg - stallEntries.at(-1).kg : 0;

  let status = TREND_STATUSES.ON_TRACK;
  if (weeklyChangeKg > 0.1) {
    status = TREND_STATUSES.GAINING;
  } else if (-weeklyChangeKg > FAST_LOSS_KG_PER_WEEK) {
    status = TREND_STATUSES.TOO_FAST;
  } else if (stallSpanDays >= STALL_WINDOW_DAYS - DAYS_PER_WEEK && stallLossKg < STALL_MAX_LOSS_KG) {
    status = TREND_STATUSES.STALLED;
  }
  return { status, latestEntry, weeklyChangeKg, totalChangeKg };
}
