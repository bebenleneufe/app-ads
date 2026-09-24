import { AISLE_ORDER, PRODUCTS_BY_ID } from './catalog.js';
import { getServingsPerMainRecipe } from './meal-structure.js';
import { getPortionQuantities } from './nutrition.js';

// Évite qu'une imprécision flottante (ex. 3 × 0.1) fasse acheter un paquet de trop.
const PACKAGE_ROUNDING_TOLERANCE = 1e-6;

function roundToCents(amount) {
  return Math.round(amount * 100) / 100;
}

function computeQuantitiesCost(quantityEntries) {
  return quantityEntries.reduce((total, [productId, quantity]) => {
    const product = PRODUCTS_BY_ID.get(productId);
    return product ? total + (quantity * product.price) / product.packageSize : total;
  }, 0);
}

export function computeServingCost(recipe) {
  return computeQuantitiesCost(Object.entries(recipe.ingredients));
}

export function computePortionCost(recipeId, settings) {
  return computeQuantitiesCost(getPortionQuantities(recipeId, settings));
}

function listCookedServings(plan, settings) {
  const mainServingCount = settings.personCount * getServingsPerMainRecipe(settings);
  return [
    ...plan.mainRecipeIds.map((recipeId) => ({ recipeId, servingCount: mainServingCount })),
    ...plan.breakfastRecipeIds.map((recipeId) => ({ recipeId, servingCount: settings.personCount })),
  ];
}

function sumNeededQuantities(cookedServings, settings) {
  const neededByProductId = new Map();
  for (const { recipeId, servingCount } of cookedServings) {
    for (const [productId, quantityPerServing] of getPortionQuantities(recipeId, settings)) {
      const previousQuantity = neededByProductId.get(productId) ?? 0;
      neededByProductId.set(productId, previousQuantity + quantityPerServing * servingCount);
    }
  }
  return neededByProductId;
}

function buildLine(product, neededQuantity) {
  const packageCount = Math.max(1, Math.ceil(neededQuantity / product.packageSize - PACKAGE_ROUNDING_TOLERANCE));
  return {
    product,
    neededQuantity,
    packageCount,
    leftoverQuantity: Math.max(0, packageCount * product.packageSize - neededQuantity),
    cost: roundToCents(packageCount * product.price),
    consumedValue: (neededQuantity * product.price) / product.packageSize,
  };
}

function groupLinesByAisle(lines) {
  return AISLE_ORDER.map((aisle) => ({
    aisle,
    lines: lines
      .filter((line) => line.product.aisle === aisle)
      .sort((firstLine, secondLine) => firstLine.product.name.localeCompare(secondLine.product.name, 'fr')),
  })).filter((group) => group.lines.length > 0);
}

export function buildShoppingList(plan, settings) {
  const cookedServings = listCookedServings(plan, settings);
  const neededByProductId = sumNeededQuantities(cookedServings, settings);
  const allLines = [...neededByProductId]
    .map(([productId, neededQuantity]) => ({ product: PRODUCTS_BY_ID.get(productId), neededQuantity }))
    .filter(({ product }) => product !== undefined)
    .map(({ product, neededQuantity }) => buildLine(product, neededQuantity));

  const isAlreadyOwned = (line) => settings.pantryStaplesOwned && line.product.isPantryStaple;
  const purchasedLines = allLines.filter((line) => !isAlreadyOwned(line));
  const pantryLines = allLines.filter(isAlreadyOwned);

  const totalToPay = roundToCents(purchasedLines.reduce((total, line) => total + line.cost, 0));
  const consumedValue = roundToCents(purchasedLines.reduce((total, line) => total + line.consumedValue, 0));
  const portionCount = cookedServings.reduce((total, { servingCount }) => total + servingCount, 0);

  return {
    aisleGroups: groupLinesByAisle(purchasedLines),
    pantryLines,
    articleCount: purchasedLines.reduce((total, line) => total + line.packageCount, 0),
    totalToPay,
    consumedValue,
    portionCount,
    costPerPortion: portionCount > 0 ? roundToCents(totalToPay / portionCount) : 0,
  };
}
