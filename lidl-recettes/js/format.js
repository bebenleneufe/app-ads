import { UNITS } from './catalog.js';

const EURO_FORMATTER = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const DECIMAL_FORMATTER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const FULL_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function formatEuros(amount) {
  return EURO_FORMATTER.format(amount);
}

export function formatDecimal(amount) {
  return DECIMAL_FORMATTER.format(amount);
}

export function formatDayMonth(date) {
  return DAY_MONTH_FORMATTER.format(date);
}

export function formatFullDate(date) {
  return FULL_DATE_FORMATTER.format(date);
}

// Au-delà de 50 g, un arrondi à 5 g près suffit en cuisine et se lit mieux (« 80 g » plutôt que « 81 g »).
const ROUNDING_STEP_THRESHOLD = 50;
const KITCHEN_ROUNDING_STEP = 5;

function roundForKitchen(quantity) {
  if (quantity < ROUNDING_STEP_THRESHOLD) {
    return Math.max(1, Math.round(quantity));
  }
  return Math.round(quantity / KITCHEN_ROUNDING_STEP) * KITCHEN_ROUNDING_STEP;
}

// « ½ », « 1 ½ » plutôt que « 0,5 » : c'est ainsi qu'on parle d'un poivron ou d'une laitue.
function formatPieceCount(quantity) {
  const wholeCount = Math.floor(quantity + 0.01);
  const remainder = quantity - wholeCount;
  if (Math.abs(remainder - 0.5) < 0.01) {
    return wholeCount === 0 ? '½' : `${wholeCount} ½`;
  }
  return Math.abs(remainder) < 0.01 ? String(wholeCount) : formatDecimal(quantity);
}

export function formatQuantity(quantity, unit) {
  if (unit === UNITS.GRAM) {
    return quantity >= 1000 ? `${formatDecimal(quantity / 1000)} kg` : `${roundForKitchen(quantity)} g`;
  }
  if (unit === UNITS.MILLILITER) {
    return quantity >= 1000 ? `${formatDecimal(quantity / 1000)} L` : `${roundForKitchen(quantity)} ml`;
  }
  return `${formatPieceCount(quantity)} pc`;
}

// Personne ne pèse 2 g de cumin : les épices se mesurent à la cuillère, comme dans un livre de cuisine.
const TEASPOONS_PER_TABLESPOON = 3;
const PINCH_TEASPOON_LIMIT = 0.2;
const SPOON_FRACTIONS = Object.freeze({ 0.25: '¼', 0.5: '½', 0.75: '¾' });

function formatSpoonCount(spoonCount, fractionStep) {
  const roundedCount = Math.max(fractionStep, Math.round(spoonCount / fractionStep) * fractionStep);
  const wholeCount = Math.floor(roundedCount);
  const fractionLabel = SPOON_FRACTIONS[roundedCount - wholeCount];
  if (fractionLabel === undefined) {
    return String(wholeCount);
  }
  return wholeCount === 0 ? fractionLabel : `${wholeCount} ${fractionLabel}`;
}

function formatSpoonQuantity(grams, gramsPerTeaspoon) {
  const teaspoonCount = grams / gramsPerTeaspoon;
  if (teaspoonCount < PINCH_TEASPOON_LIMIT) {
    return '1 pincée';
  }
  if (teaspoonCount >= TEASPOONS_PER_TABLESPOON) {
    return `${formatSpoonCount(teaspoonCount / TEASPOONS_PER_TABLESPOON, 0.5)} c. à soupe`;
  }
  return `${formatSpoonCount(teaspoonCount, 0.25)} c. à café`;
}

export function formatProductQuantity(product, quantity) {
  if (product.gramsPerTeaspoon !== null) {
    return `${formatSpoonQuantity(quantity, product.gramsPerTeaspoon)} ${product.shortName}`;
  }
  if (product.unit === UNITS.PIECE) {
    const [singularName, pluralName] = product.pieceNames;
    return `${formatPieceCount(quantity)} ${quantity > 1 ? pluralName : singularName}`;
  }
  return `${formatQuantity(quantity, product.unit)} ${product.shortName}`;
}
