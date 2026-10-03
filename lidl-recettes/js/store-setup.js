import { AISLE_ORDER, PRODUCTS_BY_ID } from './catalog.js';

// Réglages propres au magasin où l'on fait ses courses : l'ordre réel de ses rayons
// et les produits qu'on n'y trouve pas.
export const DEFAULT_STORE_SETUP = Object.freeze({
  aisleOrder: AISLE_ORDER,
  missingProductIds: Object.freeze([]),
});

export const AISLE_MOVES = Object.freeze({ UP: -1, DOWN: 1 });

// Un rayon ajouté plus tard au catalogue prend sa place par défaut, sans casser l'ordre choisi.
function normalizeAisleOrder(savedAisleOrder) {
  const keptAisles = Array.isArray(savedAisleOrder)
    ? [...new Set(savedAisleOrder.filter((aisle) => AISLE_ORDER.includes(aisle)))]
    : [];
  const addedAisles = AISLE_ORDER.filter((aisle) => !keptAisles.includes(aisle));
  return [...keptAisles, ...addedAisles];
}

function normalizeMissingProductIds(savedProductIds) {
  return Array.isArray(savedProductIds)
    ? [...new Set(savedProductIds.filter((productId) => PRODUCTS_BY_ID.has(productId)))]
    : [];
}

export function normalizeStoreSetup(savedStoreSetup) {
  return {
    aisleOrder: normalizeAisleOrder(savedStoreSetup?.aisleOrder),
    missingProductIds: normalizeMissingProductIds(savedStoreSetup?.missingProductIds),
  };
}

export function getStoreSetup(settings) {
  return settings?.storeSetup ?? DEFAULT_STORE_SETUP;
}

export function hasCustomAisleOrder(storeSetup) {
  return storeSetup.aisleOrder.some((aisle, index) => aisle !== AISLE_ORDER[index]);
}

// On échange le rayon avec son voisin dans la liste affichée : les rayons vides cette
// semaine sont sautés, sinon un appui sur la flèche semblerait ne rien faire.
export function moveAisle(storeSetup, aisle, direction, listedAisles) {
  const listedIndex = listedAisles.indexOf(aisle);
  const neighbourAisle = listedAisles[listedIndex + direction];
  if (listedIndex === -1 || neighbourAisle === undefined) {
    return storeSetup;
  }
  const aisleOrder = [...storeSetup.aisleOrder];
  const aisleIndex = aisleOrder.indexOf(aisle);
  const neighbourIndex = aisleOrder.indexOf(neighbourAisle);
  aisleOrder[aisleIndex] = neighbourAisle;
  aisleOrder[neighbourIndex] = aisle;
  return { ...storeSetup, aisleOrder };
}

export function resetAisleOrder(storeSetup) {
  return { ...storeSetup, aisleOrder: [...AISLE_ORDER] };
}

export function toggleMissingProduct(storeSetup, productId) {
  const missingProductIds = storeSetup.missingProductIds.includes(productId)
    ? storeSetup.missingProductIds.filter((missingId) => missingId !== productId)
    : [...storeSetup.missingProductIds, productId];
  return { ...storeSetup, missingProductIds };
}

export function clearMissingProducts(storeSetup) {
  return { ...storeSetup, missingProductIds: [] };
}

export function listMissingIngredients(recipe, storeSetup) {
  return Object.keys(recipe.ingredients).filter((productId) => storeSetup.missingProductIds.includes(productId));
}
