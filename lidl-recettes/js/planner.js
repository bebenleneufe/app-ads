import { PRODUCTS_BY_ID } from './catalog.js';
import { CATEGORIES, RECIPES, RECIPES_BY_ID } from './recipes.js';
import { buildShoppingList, computeServingCost } from './shopping-list.js';

export const DIETS = Object.freeze({
  OMNIVORE: 'omnivore',
  PESCETARIAN: 'pescetarien',
  VEGETARIAN: 'vegetarien',
});

// Pondérations choisies empiriquement : le partage d'ingrédients réduit le gaspillage
// (paquets entamés), l'aléa garde des semaines variées d'une génération à l'autre.
const SHARED_INGREDIENT_WEIGHT = 0.6;
const RANDOMNESS_WEIGHT = 2.5;
const REPEATED_RECIPE_PENALTY = 10;
const CATEGORY_BALANCE_WEIGHT = 2;
const CHEAPNESS_WEIGHT = 1.5;

const SERVING_COST_BY_RECIPE_ID = new Map(RECIPES.map((recipe) => [recipe.id, computeServingCost(recipe)]));

export function getServingCost(recipeId) {
  return SERVING_COST_BY_RECIPE_ID.get(recipeId) ?? 0;
}

export function getMealCount(settings) {
  return settings.dayCount * settings.mealsPerDay;
}

export function isRecipeAllowed(recipe, settings) {
  if (settings.withoutPork && recipe.containsPork) {
    return false;
  }
  if (settings.diet === DIETS.VEGETARIAN) {
    return recipe.category === CATEGORIES.VEGETARIAN;
  }
  if (settings.diet === DIETS.PESCETARIAN) {
    return recipe.category !== CATEGORIES.MEAT;
  }
  return true;
}

function listAllowedRecipes(settings) {
  return RECIPES.filter((recipe) => isRecipeAllowed(recipe, settings));
}

function listFreshProductIds(recipe) {
  return Object.keys(recipe.ingredients).filter((productId) => !PRODUCTS_BY_ID.get(productId)?.isPantryStaple);
}

function scoreCandidate(candidate, chosenRecipes, random, preferCheap) {
  const productsAlreadyBought = new Set(chosenRecipes.flatMap(listFreshProductIds));
  const sharedIngredientCount = listFreshProductIds(candidate).filter((productId) => productsAlreadyBought.has(productId)).length;
  const isRepeated = chosenRecipes.some((recipe) => recipe.id === candidate.id);
  const sameCategoryShare = chosenRecipes.length === 0
    ? 0
    : chosenRecipes.filter((recipe) => recipe.category === candidate.category).length / chosenRecipes.length;
  const cheapnessPenalty = preferCheap ? getServingCost(candidate.id) * CHEAPNESS_WEIGHT : 0;

  return sharedIngredientCount * SHARED_INGREDIENT_WEIGHT
    + random() * RANDOMNESS_WEIGHT
    - (isRepeated ? REPEATED_RECIPE_PENALTY : 0)
    - sameCategoryShare * CATEGORY_BALANCE_WEIGHT
    - cheapnessPenalty;
}

function pickBestRecipe({ allowedRecipes, chosenRecipes, excludedRecipeIds, random, preferCheap }) {
  const freshCandidates = allowedRecipes.filter((recipe) => !excludedRecipeIds.has(recipe.id));
  const candidates = freshCandidates.length > 0 ? freshCandidates : allowedRecipes;
  let bestRecipe = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const candidateScore = scoreCandidate(candidate, chosenRecipes, random, preferCheap);
    if (candidateScore > bestScore) {
      bestScore = candidateScore;
      bestRecipe = candidate;
    }
  }
  return bestRecipe;
}

function hasBudget(settings) {
  return settings.weeklyBudget > 0;
}

function fillPlan(keptRecipeIds, settings, random) {
  const allowedRecipes = listAllowedRecipes(settings);
  if (allowedRecipes.length === 0) {
    return [];
  }
  const chosenRecipes = keptRecipeIds.filter(Boolean).map((recipeId) => RECIPES_BY_ID.get(recipeId));
  const filledRecipeIds = [];
  for (let slotIndex = 0; slotIndex < getMealCount(settings); slotIndex += 1) {
    const keptRecipeId = keptRecipeIds[slotIndex];
    if (keptRecipeId) {
      filledRecipeIds.push(keptRecipeId);
      continue;
    }
    const pickedRecipe = pickBestRecipe({
      allowedRecipes,
      chosenRecipes,
      excludedRecipeIds: new Set(chosenRecipes.map((recipe) => recipe.id)),
      random,
      preferCheap: hasBudget(settings),
    });
    chosenRecipes.push(pickedRecipe);
    filledRecipeIds.push(pickedRecipe.id);
  }
  return filledRecipeIds;
}

export function fitPlanToBudget(planRecipeIds, settings) {
  if (!hasBudget(settings)) {
    return planRecipeIds;
  }
  const allowedRecipes = listAllowedRecipes(settings);
  const adjustedRecipeIds = [...planRecipeIds];
  const slotsByCostDescending = adjustedRecipeIds
    .map((recipeId, slotIndex) => ({ slotIndex, servingCost: getServingCost(recipeId) }))
    .sort((firstSlot, secondSlot) => secondSlot.servingCost - firstSlot.servingCost);

  for (const { slotIndex, servingCost } of slotsByCostDescending) {
    if (buildShoppingList(adjustedRecipeIds, settings).totalToPay <= settings.weeklyBudget) {
      break;
    }
    const cheaperRecipe = allowedRecipes
      .filter((recipe) => !adjustedRecipeIds.includes(recipe.id) && getServingCost(recipe.id) < servingCost)
      .sort((firstRecipe, secondRecipe) => getServingCost(firstRecipe.id) - getServingCost(secondRecipe.id))[0];
    if (cheaperRecipe) {
      adjustedRecipeIds[slotIndex] = cheaperRecipe.id;
    }
  }
  return adjustedRecipeIds;
}

export function generatePlan(settings, random = Math.random) {
  return fitPlanToBudget(fillPlan([], settings, random), settings);
}

export function reconcilePlan(currentRecipeIds, settings, random = Math.random) {
  const keptRecipeIds = currentRecipeIds
    .slice(0, getMealCount(settings))
    .map((recipeId) => {
      const recipe = RECIPES_BY_ID.get(recipeId);
      return recipe && isRecipeAllowed(recipe, settings) ? recipeId : null;
    });
  return fillPlan(keptRecipeIds, settings, random);
}

export function swapMeal(currentRecipeIds, slotIndex, settings, random = Math.random) {
  const allowedRecipes = listAllowedRecipes(settings);
  const otherRecipes = currentRecipeIds
    .filter((_recipeId, index) => index !== slotIndex)
    .map((recipeId) => RECIPES_BY_ID.get(recipeId))
    .filter(Boolean);
  const replacement = pickBestRecipe({
    allowedRecipes: allowedRecipes.filter((recipe) => recipe.id !== currentRecipeIds[slotIndex]),
    chosenRecipes: otherRecipes,
    excludedRecipeIds: new Set(currentRecipeIds),
    random,
    preferCheap: false,
  });
  if (!replacement) {
    return currentRecipeIds;
  }
  return currentRecipeIds.map((recipeId, index) => (index === slotIndex ? replacement.id : recipeId));
}
