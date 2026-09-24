import { AISLE_ORDER, LONG_LASTING_AISLES, PRODUCTS_BY_ID } from './catalog.js';
import { getServingsPerBreakfast, getServingsPerMainSlot } from './meal-structure.js';
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

function isAlreadyOwned(product, settings) {
  return settings.pantryStaplesOwned && product.isPantryStaple;
}

// Même règle que le ticket : les basiques du placard déjà possédés ne sont pas comptés.
export function computePortionCost(recipeId, settings) {
  const countedQuantities = getPortionQuantities(recipeId, settings).filter(([productId]) => {
    const product = PRODUCTS_BY_ID.get(productId);
    return product !== undefined && !isAlreadyOwned(product, settings);
  });
  return computeQuantitiesCost(countedQuantities);
}

function computePackagesCost(product, neededQuantity) {
  if (neededQuantity <= 0) {
    return 0;
  }
  return Math.ceil(neededQuantity / product.packageSize - PACKAGE_ROUNDING_TOLERANCE) * product.price;
}

// Suit les quantités déjà prévues pour estimer ce qu'une recette ajoute vraiment au ticket :
// un plat qui finit un paquet déjà ouvert coûte presque rien, un plat qui en ouvre trois coûte cher.
export function createPurchaseTracker(settings) {
  const neededByProductId = new Map();
  const isCounted = (product) => product !== undefined && !isAlreadyOwned(product, settings);

  return {
    addRecipe(recipeId, servingCount) {
      for (const [productId, quantityPerServing] of getPortionQuantities(recipeId, settings)) {
        const previousQuantity = neededByProductId.get(productId) ?? 0;
        neededByProductId.set(productId, previousQuantity + quantityPerServing * servingCount);
      }
    },
    computeMarginalCost(recipeId, servingCount) {
      return getPortionQuantities(recipeId, settings).reduce((extraCost, [productId, quantityPerServing]) => {
        const product = PRODUCTS_BY_ID.get(productId);
        if (!isCounted(product)) {
          return extraCost;
        }
        const quantityBefore = neededByProductId.get(productId) ?? 0;
        const quantityAfter = quantityBefore + quantityPerServing * servingCount;
        return extraCost + computePackagesCost(product, quantityAfter) - computePackagesCost(product, quantityBefore);
      }, 0);
    },
  };
}

function listCookedServings(plan, settings) {
  return [
    ...plan.mainRecipeIds.map((recipeId) => ({ recipeId, servingCount: getServingsPerMainSlot(settings) })),
    ...plan.breakfastRecipeIds.map((recipeId) => ({ recipeId, servingCount: getServingsPerBreakfast(settings) })),
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
  return AISLE_ORDER.map((aisle) => {
    const aisleLines = lines
      .filter((line) => line.product.aisle === aisle)
      .sort((firstLine, secondLine) => firstLine.product.name.localeCompare(secondLine.product.name, 'fr'));
    return {
      aisle,
      lines: aisleLines,
      subtotal: roundToCents(aisleLines.reduce((total, line) => total + line.cost, 0)),
    };
  }).filter((group) => group.lines.length > 0);
}

export function buildShoppingList(plan, settings) {
  const cookedServings = listCookedServings(plan, settings);
  const neededByProductId = sumNeededQuantities(cookedServings, settings);
  const allLines = [...neededByProductId]
    .map(([productId, neededQuantity]) => ({ product: PRODUCTS_BY_ID.get(productId), neededQuantity }))
    .filter(({ product }) => product !== undefined)
    .map(({ product, neededQuantity }) => buildLine(product, neededQuantity));

  const purchasedLines = allLines.filter((line) => !isAlreadyOwned(line.product, settings));
  const pantryLines = allLines.filter((line) => isAlreadyOwned(line.product, settings));

  const totalToPay = roundToCents(purchasedLines.reduce((total, line) => total + line.cost, 0));
  const consumedValue = roundToCents(purchasedLines.reduce((total, line) => total + line.consumedValue, 0));
  const longLastingLeftoverValue = roundToCents(purchasedLines
    .filter((line) => LONG_LASTING_AISLES.includes(line.product.aisle))
    .reduce((total, line) => total + line.cost - line.consumedValue, 0));
  const portionCount = cookedServings.reduce((total, { servingCount }) => total + servingCount, 0);

  return {
    aisleGroups: groupLinesByAisle(purchasedLines),
    pantryLines,
    articleCount: purchasedLines.reduce((total, line) => total + line.packageCount, 0),
    totalToPay,
    consumedValue,
    longLastingLeftoverValue,
    portionCount,
    costPerPortion: portionCount > 0 ? roundToCents(totalToPay / portionCount) : 0,
  };
}
