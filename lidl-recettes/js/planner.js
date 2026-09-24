import { getBreakfastSlotCount, getMainSlotCount, getServingsPerMainRecipe } from './meal-structure.js';
import { computeMealTargetKcal, fitsMealTarget, getPortionKcal } from './nutrition.js';
import { CATEGORIES, fitsTimeLimit, MEAL_TYPES, RECIPES, RECIPES_BY_ID } from './recipes.js';
import { buildShoppingList, computeServingCost, createPurchaseTracker } from './shopping-list.js';

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

export const PRIORITIES = Object.freeze({
  PRICE: 'prix',
  BALANCED: 'equilibre',
  VARIETY: 'variete',
});

// Pondérations mesurées sur 200 semaines générées (1 pers., 3 repas, 20 min) :
// prix ≈ 39 € médian, 16 plats différents vus ; équilibre ≈ 43 €, 23 plats ; variété ≈ 48 €, 25 plats.
// Le surcoût réel au ticket pousse à finir les paquets entamés, l'aléa apporte la variété.
const SCORING_WEIGHTS_BY_PRIORITY = Object.freeze({
  [PRIORITIES.PRICE]: { marginalCost: 1.6, randomness: 2.5 },
  [PRIORITIES.BALANCED]: { marginalCost: 1, randomness: 3.5 },
  [PRIORITIES.VARIETY]: { marginalCost: 0.5, randomness: 3.5 },
});
// Répéter un plat dans la semaine lasse vite ; répéter un petit-déjeuner est normal et évite
// d'ouvrir des paquets. La pénalité croît à chaque répétition pour alterner deux ou trois recettes.
const REPEATED_RECIPE_PENALTY_BY_MEAL_TYPE = Object.freeze({
  [MEAL_TYPES.MAIN]: 10,
  [MEAL_TYPES.BREAKFAST]: 1.2,
});
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
  if (!fitsTimeLimit(recipe, settings.maxPrepMinutes)) {
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

function getServingCount(kind, settings) {
  return kind === PLAN_KINDS.MAIN ? settings.personCount * getServingsPerMainRecipe(settings) : settings.personCount;
}

// On vise la cible du repas plutôt que le plat le plus léger : manger trop peu
// fait fondre le muscle et rend le régime difficile à tenir.
function computeCalorieGapPenalty(candidate, settings) {
  const mealTargetKcal = computeMealTargetKcal(settings, candidate.mealType);
  if (mealTargetKcal === null) {
    return 0;
  }
  return (Math.abs(getPortionKcal(candidate.id, settings) - mealTargetKcal) / mealTargetKcal) * CALORIE_GAP_WEIGHT;
}

function scoreCandidate({ candidate, chosenRecipes, random, settings, preferCheap, purchaseTracker, servingCount }) {
  const marginalCost = purchaseTracker.computeMarginalCost(candidate.id, servingCount);
  const weights = SCORING_WEIGHTS_BY_PRIORITY[settings.priority] ?? SCORING_WEIGHTS_BY_PRIORITY[PRIORITIES.PRICE];
  const repetitionCount = chosenRecipes.filter((recipe) => recipe.id === candidate.id).length;
  const sameCategoryShare = chosenRecipes.length === 0
    ? 0
    : chosenRecipes.filter((recipe) => recipe.category === candidate.category).length / chosenRecipes.length;
  const cheapnessPenalty = preferCheap ? getServingCost(candidate.id) * CHEAPNESS_WEIGHT : 0;

  return random() * weights.randomness
    - marginalCost * weights.marginalCost
    - repetitionCount * REPEATED_RECIPE_PENALTY_BY_MEAL_TYPE[candidate.mealType]
    - sameCategoryShare * CATEGORY_BALANCE_WEIGHT
    - cheapnessPenalty
    - computeCalorieGapPenalty(candidate, settings);
}

function pickBestRecipe({
  allowedRecipes,
  chosenRecipes,
  excludedRecipeIds,
  random,
  settings,
  preferCheap,
  purchaseTracker,
  servingCount,
}) {
  const freshCandidates = allowedRecipes.filter((recipe) => !excludedRecipeIds.has(recipe.id));
  const candidates = freshCandidates.length > 0 ? freshCandidates : allowedRecipes;
  let bestRecipe = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const candidateScore = scoreCandidate({ candidate, chosenRecipes, random, settings, preferCheap, purchaseTracker, servingCount });
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

function fillSlots({ kind, keptRecipeIds, settings, random, purchaseTracker }) {
  const allowedRecipes = listAllowedRecipes(kind, settings);
  if (allowedRecipes.length === 0) {
    return [];
  }
  const servingCount = getServingCount(kind, settings);
  const chosenRecipes = keptRecipeIds.filter(Boolean).map((recipeId) => RECIPES_BY_ID.get(recipeId));
  chosenRecipes.forEach((recipe) => purchaseTracker.addRecipe(recipe.id, servingCount));
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
      excludedRecipeIds: kind === PLAN_KINDS.MAIN ? new Set(chosenRecipes.map((recipe) => recipe.id)) : new Set(),
      random,
      settings,
      preferCheap: hasBudget(settings),
      purchaseTracker,
      servingCount,
    });
    purchaseTracker.addRecipe(pickedRecipe.id, servingCount);
    chosenRecipes.push(pickedRecipe);
    filledRecipeIds.push(pickedRecipe.id);
  }
  return filledRecipeIds;
}

// Seuls les plats sont remplacés : ce sont eux qui pèsent sur le ticket, les petits-déjeuners coûtent peu.
// Un échange n'est gardé que s'il fait vraiment baisser le ticket : une recette moins chère à la portion
// peut ouvrir de nouveaux paquets et coûter plus au total.
export function fitPlanToBudget(plan, settings) {
  if (!hasBudget(settings)) {
    return plan;
  }
  const allowedRecipes = listAllowedRecipes(PLAN_KINDS.MAIN, settings);
  let adjustedPlan = plan;
  let currentTotal = buildShoppingList(adjustedPlan, settings).totalToPay;
  const slotsByCostDescending = plan.mainRecipeIds
    .map((recipeId, slotIndex) => ({ slotIndex, servingCost: getServingCost(recipeId) }))
    .sort((firstSlot, secondSlot) => secondSlot.servingCost - firstSlot.servingCost);

  for (const { slotIndex } of slotsByCostDescending) {
    if (currentTotal <= settings.weeklyBudget) {
      break;
    }
    let bestPlan = null;
    let bestTotal = currentTotal;
    for (const candidate of allowedRecipes) {
      if (adjustedPlan.mainRecipeIds.includes(candidate.id)) {
        continue;
      }
      const candidatePlan = {
        ...adjustedPlan,
        mainRecipeIds: adjustedPlan.mainRecipeIds.map((recipeId, index) => (index === slotIndex ? candidate.id : recipeId)),
      };
      const candidateTotal = buildShoppingList(candidatePlan, settings).totalToPay;
      if (candidateTotal < bestTotal) {
        bestPlan = candidatePlan;
        bestTotal = candidateTotal;
      }
    }
    if (bestPlan) {
      adjustedPlan = bestPlan;
      currentTotal = bestTotal;
    }
  }
  return adjustedPlan;
}

// Les plats sont choisis avant les petits-déjeuners : ces derniers, moins chers et plus
// souples, peuvent alors finir le pain, les œufs ou le fromage blanc déjà achetés.
function fillPlan(keptPlan, settings, random) {
  const purchaseTracker = createPurchaseTracker(settings);
  const mainRecipeIds = fillSlots({
    kind: PLAN_KINDS.MAIN,
    keptRecipeIds: keptPlan.mainRecipeIds,
    settings,
    random,
    purchaseTracker,
  });
  const breakfastRecipeIds = fillSlots({
    kind: PLAN_KINDS.BREAKFAST,
    keptRecipeIds: keptPlan.breakfastRecipeIds,
    settings,
    random,
    purchaseTracker,
  });
  return { mainRecipeIds, breakfastRecipeIds };
}

export function generatePlan(settings, random = Math.random) {
  return fitPlanToBudget(fillPlan({ mainRecipeIds: [], breakfastRecipeIds: [] }, settings, random), settings);
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
  const keptPlan = {
    mainRecipeIds: keepAllowedRecipeIds(PLAN_KINDS.MAIN, currentPlan?.mainRecipeIds, settings),
    breakfastRecipeIds: keepAllowedRecipeIds(PLAN_KINDS.BREAKFAST, currentPlan?.breakfastRecipeIds, settings),
  };
  return fillPlan(keptPlan, settings, random);
}

function createTrackerWithoutSlot(currentPlan, kind, slotIndex, settings) {
  const purchaseTracker = createPurchaseTracker(settings);
  for (const [planKind, planKey] of Object.entries(PLAN_KEY_BY_KIND)) {
    currentPlan[planKey].forEach((recipeId, index) => {
      if (planKind !== kind || index !== slotIndex) {
        purchaseTracker.addRecipe(recipeId, getServingCount(planKind, settings));
      }
    });
  }
  return purchaseTracker;
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
    purchaseTracker: createTrackerWithoutSlot(currentPlan, kind, slotIndex, settings),
    servingCount: getServingCount(kind, settings),
  });
  if (!replacement) {
    return currentPlan;
  }
  return {
    ...currentPlan,
    [planKey]: currentRecipeIds.map((recipeId, index) => (index === slotIndex ? replacement.id : recipeId)),
  };
}
