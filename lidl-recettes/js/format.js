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

export function formatQuantity(quantity, unit) {
  if (unit === UNITS.GRAM) {
    return quantity >= 1000 ? `${formatDecimal(quantity / 1000)} kg` : `${Math.max(1, Math.round(quantity))} g`;
  }
  if (unit === UNITS.MILLILITER) {
    return quantity >= 1000 ? `${formatDecimal(quantity / 1000)} L` : `${Math.max(1, Math.round(quantity))} ml`;
  }
  return `${formatDecimal(quantity)} pc`;
}

export function formatProductQuantity(product, quantity) {
  if (product.unit === UNITS.PIECE) {
    const [singularName, pluralName] = product.pieceNames;
    return `${formatDecimal(quantity)} ${quantity > 1 ? pluralName : singularName}`;
  }
  return `${formatQuantity(quantity, product.unit)} ${product.shortName}`;
}
