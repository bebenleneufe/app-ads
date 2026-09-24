import { PRODUCTS_BY_ID } from './catalog.js';
import { getBreakfastSlotCount, getMainSlotCount } from './meal-structure.js';
import { computeMealTargetKcal, fitsMealTarget, getRecipeKcal } from './nutrition.js';
import { CATEGORIES, isSimpleRecipe, MEAL_TYPES, RECIPES, RECIPES_BY_ID } from './recipes.js';
import { buildShoppingList, computeServingCost } from './shopping-list.js';

export const DIETS = Object.freeze({
  OMNIVORE: 'omnivore',
  PESCETARIAN: 'pescetarien',
  VEGETARIAN: 'vegetarien',
});

export const PLAN_KINDS = Object.freeze({
  MAIN: 'main',
  BREAKFAST: 'breakfast',
});

const PLAN_KEY_BY_KIND = Object.freeze({
  [PLAN_KINDS.MAIN]: 'mainRecipeIds',
  [PLAN_KINDS.BREAKFAST]: 'breakfastRecipeIds',
});

const MEAL_TYPE_BY_KIND = Object.freeze({
  [PLAN_KINDS.MAIN]: MEAL_TYPES.MAIN,
  [PLAN_KINDS.BREAKFAST]: MEAL_TYPES.BREAKFAST,
});

// Pondérations choisies empiriquement : le partage d'ingrédients réduit le gaspillage
// (paquets entamés), l'aléa garde des semaines variées d'une génération à l'autre.
const SHARED_INGREDIENT_WEIGHT = 0.6;
const RANDOMNESS_WEIGHT = 2.5;
const REPEATED_RECIPE_PENALTY = 10;
const CATEGORY_BALANCE_WEIGHT = 2;
const CHEAPNESS_WEIGHT = 1.5;
const CALORIE_GAP_WEIGHT = 4;

const SERVING_COST_BY_RECIPE_ID = new Map(RECIPES.map((recipe) => [recipe.id, computeServingCost(recipe)]));

export function getServingCost(recipeId) {
  return SERVING_COST_BY_RECIPE_ID.get(recipeId) ?? 0;
}

function getSlotCount(kind, settings) {
  return kind === PLAN_KINDS.BREAKFAST ? getBreakfastSlotCount(settings) : getMainSlotCount(settings);
}

export function isRecipeAllowed(recipe, settings) {
  if (settings.withoutPork && recipe.containsPork) {
    return false;
  }
  if (settings.simpleRecipesOnly && !isSimpleRecipe(recipe)) {
    return false;
  }
  if (settings.diet === DIETS.VEGETARIAN && recipe.category !== CATEGORIES.VEGETARIAN) {
    return false;
  }
  if (settings.diet === DIETS.PESCETARIAN && recipe.category === CATEGORIES.MEAT) {
    return false;
  }
  return fitsMealTarget(recipe.id, settings);
}

function listAllowedRecipes(kind, settings) {
  return RECIPES.filter((recipe) => recipe.mealType === MEAL_TYPE_BY_KIND[kind] && isRecipeAllowed(recipe, settings));
}

function listFreshProductIds(recipe) {
  return Object.keys(recipe.ingredients).filter((productId) => !PRODUCTS_BY_ID.get(productId)?.isPantryStaple);
}

// On vise la cible du repas plutôt que le plat le plus léger : manger trop peu
// fait fondre le muscle et rend le régime difficile à tenir.
function computeCalorieGapPenalty(candidate, settings) {
  const mealTargetKcal = computeMealTargetKcal(settings, candidate.mealType);
  if (mealTargetKcal === null) {
    return 0;
  }
  return (Math.abs(getRecipeKcal(candidate.id) - mealTargetKcal) / mealTargetKcal) * CALORIE_GAP_WEIGHT;
}

function scoreCandidate(candidate, chosenRecipes, random, settings, preferCheap) {
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
    - cheapnessPenalty
    - computeCalorieGapPenalty(candidate, settings);
}

function pickBestRecipe({ allowedRecipes, chosenRecipes, excludedRecipeIds, random, settings, preferCheap }) {
  const freshCandidates = allowedRecipes.filter((recipe) => !excludedRecipeIds.has(recipe.id));
  const candidates = freshCandidates.length > 0 ? freshCandidates : allowedRecipes;
  let bestRecipe = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const candidateScore = scoreCandidate(candidate, chosenRecipes, random, settings, preferCheap);
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

function fillSlots(kind, keptRecipeIds, settings, random) {
  const allowedRecipes = listAllowedRecipes(kind, settings);
  if (allowedRecipes.length === 0) {
    return [];
  }
  const chosenRecipes = keptRecipeIds.filter(Boolean).map((recipeId) => RECIPES_BY_ID.get(recipeId));
  const filledRecipeIds = [];
  for (let slotIndex = 0; slotIndex < getSlotCount(kind, settings); slotIndex += 1) {
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
      settings,
      preferCheap: hasBudget(settings),
    });
    chosenRecipes.push(pickedRecipe);
    filledRecipeIds.push(pickedRecipe.id);
  }
  return filledRecipeIds;
}

// Seuls les plats sont remplacés : ce sont eux qui pèsent sur le ticket, les petits-déjeuners coûtent peu.
export function fitPlanToBudget(plan, settings) {
  if (!hasBudget(settings)) {
    return plan;
  }
  const allowedRecipes = listAllowedRecipes(PLAN_KINDS.MAIN, settings);
  const adjustedMainRecipeIds = [...plan.mainRecipeIds];
  const slotsByCostDescending = adjustedMainRecipeIds
    .map((recipeId, slotIndex) => ({ slotIndex, servingCost: getServingCost(recipeId) }))
    .sort((firstSlot, secondSlot) => secondSlot.servingCost - firstSlot.servingCost);

  for (const { slotIndex, servingCost } of slotsByCostDescending) {
    const candidatePlan = { ...plan, mainRecipeIds: adjustedMainRecipeIds };
    if (buildShoppingList(candidatePlan, settings).totalToPay <= settings.weeklyBudget) {
      break;
    }
    const cheaperRecipe = allowedRecipes
      .filter((recipe) => !adjustedMainRecipeIds.includes(recipe.id) && getServingCost(recipe.id) < servingCost)
      .sort((firstRecipe, secondRecipe) => getServingCost(firstRecipe.id) - getServingCost(secondRecipe.id))[0];
    if (cheaperRecipe) {
      adjustedMainRecipeIds[slotIndex] = cheaperRecipe.id;
    }
  }
  return { ...plan, mainRecipeIds: adjustedMainRecipeIds };
}

export function generatePlan(settings, random = Math.random) {
  const plan = {
    mainRecipeIds: fillSlots(PLAN_KINDS.MAIN, [], settings, random),
    breakfastRecipeIds: fillSlots(PLAN_KINDS.BREAKFAST, [], settings, random),
  };
  return fitPlanToBudget(plan, settings);
}

function keepAllowedRecipeIds(kind, recipeIds, settings) {
  return (Array.isArray(recipeIds) ? recipeIds : [])
    .slice(0, getSlotCount(kind, settings))
    .map((recipeId) => {
      const recipe = RECIPES_BY_ID.get(recipeId);
      return recipe && recipe.mealType === MEAL_TYPE_BY_KIND[kind] && isRecipeAllowed(recipe, settings) ? recipeId : null;
    });
}

export function reconcilePlan(currentPlan, settings, random = Math.random) {
  return {
    mainRecipeIds: fillSlots(PLAN_KINDS.MAIN, keepAllowedRecipeIds(PLAN_KINDS.MAIN, currentPlan?.mainRecipeIds, settings), settings, random),
    breakfastRecipeIds: fillSlots(
      PLAN_KINDS.BREAKFAST,
      keepAllowedRecipeIds(PLAN_KINDS.BREAKFAST, currentPlan?.breakfastRecipeIds, settings),
      settings,
      random,
    ),
  };
}

export function swapMeal(currentPlan, kind, slotIndex, settings, random = Math.random) {
  const planKey = PLAN_KEY_BY_KIND[kind];
  const currentRecipeIds = currentPlan[planKey];
  if (!planKey || !currentRecipeIds) {
    return currentPlan;
  }
  const otherRecipes = currentRecipeIds
    .filter((_recipeId, index) => index !== slotIndex)
    .map((recipeId) => RECIPES_BY_ID.get(recipeId))
    .filter(Boolean);
  const replacement = pickBestRecipe({
    allowedRecipes: listAllowedRecipes(kind, settings).filter((recipe) => recipe.id !== currentRecipeIds[slotIndex]),
    chosenRecipes: otherRecipes,
    excludedRecipeIds: new Set(currentRecipeIds),
    random,
    settings,
    preferCheap: false,
  });
  if (!replacement) {
    return currentPlan;
  }
  return {
    ...currentPlan,
    [planKey]: currentRecipeIds.map((recipeId, index) => (index === slotIndex ? replacement.id : recipeId)),
  };
}
