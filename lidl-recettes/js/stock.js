import { LONG_LASTING_AISLES, PRODUCTS_BY_ID } from './catalog.js';

const LEFTOVER_TOLERANCE = 0.5;

// Seuls les produits qui se gardent plusieurs semaines peuvent passer d'une semaine à l'autre ;
// l'huile et les épices sont déjà traitées comme « au placard ».
function canBeStocked(product) {
  return product !== undefined && LONG_LASTING_AISLES.includes(product.aisle) && !product.isPantryStaple;
}

export function normalizeStock(savedStock) {
  if (savedStock === null || typeof savedStock !== 'object' || Array.isArray(savedStock)) {
    return {};
  }
  return Object.fromEntries(Object.entries(savedStock).filter(
    ([productId, quantity]) => canBeStocked(PRODUCTS_BY_ID.get(productId)) && Number.isFinite(quantity) && quantity > LEFTOVER_TOLERANCE,
  ));
}

// Les restes ne sont reportés que pour les produits cochés : sans case cochée, rien ne prouve
// que les courses ont été faites, et générer plusieurs semaines ne doit pas inventer de stock.
export function computeNextStock({ stock, shoppingList, checkedProductIds }) {
  const nextStock = { ...stock };
  const lines = [...shoppingList.aisleGroups.flatMap((group) => group.lines), ...shoppingList.stockLines];
  for (const line of lines) {
    if (!canBeStocked(line.product)) {
      continue;
    }
    const boughtQuantity = checkedProductIds.has(line.product.id) ? line.packageCount * line.product.packageSize : 0;
    const remainingQuantity = (stock[line.product.id] ?? 0) + boughtQuantity - line.neededQuantity;
    if (remainingQuantity > LEFTOVER_TOLERANCE) {
      nextStock[line.product.id] = Math.round(remainingQuantity * 10) / 10;
    } else {
      delete nextStock[line.product.id];
    }
  }
  return nextStock;
}

export function hasShoppingEvidence(checkedProductIds) {
  return checkedProductIds.size > 0;
}

export function describeStock(stock) {
  const entries = Object.entries(stock);
  const value = entries.reduce((total, [productId, quantity]) => {
    const product = PRODUCTS_BY_ID.get(productId);
    return product ? total + (quantity * product.price) / product.packageSize : total;
  }, 0);
  return { productCount: entries.length, value: Math.round(value * 100) / 100 };
}
