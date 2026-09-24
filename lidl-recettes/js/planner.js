import {
  getBreakfastSlotCount,
  getMainSlotCount,
  getMainSlotsPerDay,
  getServingsPerBreakfast,
  getServingsPerMainSlot,
} from './meal-structure.js';
import { computeMealTargetKcal, fitsMealTarget, getPortionKcal } from './nutrition.js';
import { CATEGORIES, fitsTimeLimit, MEAL_TYPES, RECIPES, RECIPES_BY_ID } from './recipes.js';
import { buildShoppingList, computePortionCost, createPurchaseTracker } from './shopping-list.js';

export const DIETS = Object.freeze({
  OMNIVORE: 'omnivore',
  PESCETARIAN: 'pescetarien',
  VEGETARIAN: 'vegetarien',
});

export const PLAN_KINDS = Object.freeze({
  MAIN: 'main',
  BREAKFAST: 'breakfast',
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

// Pondérations mesurées sur 200 semaines générées (1 pers., 3 repas, 20 min, 108 plats) :
// prix ≈ 34 € médian, 37 plats différents vus ; équilibre ≈ 35 €, 46 plats ; variété ≈ 41 €, 59 plats.
// Le surcoût réel au ticket pousse à finir les paquets entamés, l'aléa apporte la variété.
const SCORING_WEIGHTS_BY_PRIORITY = Object.freeze({
  [PRIORITIES.PRICE]: { marginalCost: 1.0, randomness: 3.5 },
  [PRIORITIES.BALANCED]: { marginalCost: 0.6, randomness: 4 },
  [PRIORITIES.VARIETY]: { marginalCost: 0.3, randomness: 4.5 },
});
const REPEATED_RECIPE_PENALTY = 10;
const CATEGORY_BALANCE_WEIGHT = 2;
const CHEAPNESS_WEIGHT = 1.5;
const CALORIE_GAP_WEIGHT = 6;

function getSlotCount(kind, settings) {
  return kind === PLAN_KINDS.BREAKFAST ? getBreakfastSlotCount(settings) : getMainSlotCount(settings);
}

function getServingCount(kind, settings) {
  return kind === PLAN_KINDS.MAIN ? getServingsPerMainSlot(settings) : getServingsPerBreakfast(settings);
}

function hasBudget(settings) {
  return settings.weeklyBudget > 0;
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
  const cheapnessPenalty = preferCheap ? computePortionCost(candidate.id, settings) * CHEAPNESS_WEIGHT : 0;

  return random() * weights.randomness
    - marginalCost * weights.marginalCost
    - repetitionCount * REPEATED_RECIPE_PENALTY
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

function createPlan(mainRecipeIds, breakfastRecipeIds, settings) {
  return { mainRecipeIds, breakfastRecipeIds, mainSlotsPerDay: getMainSlotsPerDay(settings) };
}

function createTrackerForPlan(plan, settings, skippedMainSlotIndex = -1) {
  const purchaseTracker = createPurchaseTracker(settings);
  plan.mainRecipeIds.forEach((recipeId, index) => {
    if (recipeId && index !== skippedMainSlotIndex) {
      purchaseTracker.addRecipe(recipeId, getServingsPerMainSlot(settings));
    }
  });
  plan.breakfastRecipeIds.forEach((recipeId) => purchaseTracker.addRecipe(recipeId, getServingsPerBreakfast(settings)));
  return purchaseTracker;
}

function fillMainSlots({ keptRecipeIds, settings, random, purchaseTracker }) {
  const allowedRecipes = listAllowedRecipes(PLAN_KINDS.MAIN, settings);
  if (allowedRecipes.length === 0) {
    return [];
  }
  const servingCount = getServingCount(PLAN_KINDS.MAIN, settings);
  const chosenRecipes = keptRecipeIds.filter(Boolean).map((recipeId) => RECIPES_BY_ID.get(recipeId));
  chosenRecipes.forEach((recipe) => purchaseTracker.addRecipe(recipe.id, servingCount));
  const filledRecipeIds = [];
  for (let slotIndex = 0; slotIndex < getSlotCount(PLAN_KINDS.MAIN, settings); slotIndex += 1) {
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
      purchaseTracker,
      servingCount,
    });
    purchaseTracker.addRecipe(pickedRecipe.id, servingCount);
    chosenRecipes.push(pickedRecipe);
    filledRecipeIds.push(pickedRecipe.id);
  }
  return filledRecipeIds;
}

// Un seul petit-déjeuner pour toute la semaine : pas de décision à prendre le matin,
// et les mêmes paquets (flocons, lait, fruits) sont finis au lieu d'en ouvrir d'autres.
function fillWeeklyBreakfast({ keptRecipeId, settings, random, purchaseTracker, excludedRecipeIds = new Set() }) {
  const slotCount = getSlotCount(PLAN_KINDS.BREAKFAST, settings);
  if (slotCount === 0) {
    return [];
  }
  const servingCount = getServingCount(PLAN_KINDS.BREAKFAST, settings) * slotCount;
  const weeklyRecipe = keptRecipeId
    ? RECIPES_BY_ID.get(keptRecipeId)
    : pickBestRecipe({
      allowedRecipes: listAllowedRecipes(PLAN_KINDS.BREAKFAST, settings),
      chosenRecipes: [],
      excludedRecipeIds,
      random,
      settings,
      preferCheap: hasBudget(settings),
      purchaseTracker,
      servingCount,
    });
  if (!weeklyRecipe) {
    return [];
  }
  purchaseTracker.addRecipe(weeklyRecipe.id, servingCount);
  return Array.from({ length: slotCount }, () => weeklyRecipe.id);
}

// Seuls les plats sont remplacés : ce sont eux qui pèsent sur le ticket, le petit-déjeuner coûte peu.
// Le total d'un candidat se déduit du ticket sans ce créneau plus son surcoût réel (paquets en plus),
// ce qui évite de reconstruire toute la liste de courses pour chaque recette essayée.
export function fitPlanToBudget(plan, settings) {
  if (!hasBudget(settings)) {
    return plan;
  }
  const allowedRecipes = listAllowedRecipes(PLAN_KINDS.MAIN, settings);
  const servingCount = getServingCount(PLAN_KINDS.MAIN, settings);
  let adjustedPlan = plan;
  let currentTotal = buildShoppingList(adjustedPlan, settings).totalToPay;
  const slotsByCostDescending = plan.mainRecipeIds
    .map((recipeId, slotIndex) => ({ slotIndex, portionCost: computePortionCost(recipeId, settings) }))
    .sort((firstSlot, secondSlot) => secondSlot.portionCost - firstSlot.portionCost);

  for (const { slotIndex } of slotsByCostDescending) {
    if (currentTotal <= settings.weeklyBudget) {
      break;
    }
    const planWithoutSlot = {
      ...adjustedPlan,
      mainRecipeIds: adjustedPlan.mainRecipeIds.map((recipeId, index) => (index === slotIndex ? null : recipeId)),
    };
    const totalWithoutSlot = buildShoppingList(planWithoutSlot, settings).totalToPay;
    const purchaseTracker = createTrackerForPlan(adjustedPlan, settings, slotIndex);
    let bestRecipeId = null;
    let bestTotal = currentTotal;
    for (const candidate of allowedRecipes) {
      if (adjustedPlan.mainRecipeIds.includes(candidate.id)) {
        continue;
      }
      const candidateTotal = totalWithoutSlot + purchaseTracker.computeMarginalCost(candidate.id, servingCount);
      if (candidateTotal < bestTotal - 0.005) {
        bestRecipeId = candidate.id;
        bestTotal = candidateTotal;
      }
    }
    if (bestRecipeId) {
      adjustedPlan = {
        ...adjustedPlan,
        mainRecipeIds: adjustedPlan.mainRecipeIds.map((recipeId, index) => (index === slotIndex ? bestRecipeId : recipeId)),
      };
      currentTotal = buildShoppingList(adjustedPlan, settings).totalToPay;
    }
  }
  return adjustedPlan;
}

// Les plats sont choisis avant le petit-déjeuner : il peut alors finir le pain,
// les œufs ou le fromage blanc déjà achetés pour les plats.
function fillPlan(keptPlan, settings, random) {
  const purchaseTracker = createPurchaseTracker(settings);
  const mainRecipeIds = fillMainSlots({ keptRecipeIds: keptPlan.mainRecipeIds, settings, random, purchaseTracker });
  const breakfastRecipeIds = fillWeeklyBreakfast({
    keptRecipeId: keptPlan.breakfastRecipeIds.find(Boolean),
    settings,
    random,
    purchaseTracker,
  });
  return fitPlanToBudget(createPlan(mainRecipeIds, breakfastRecipeIds, settings), settings);
}

export function generatePlan(settings, random = Math.random) {
  return fillPlan({ mainRecipeIds: [], breakfastRecipeIds: [] }, settings, random);
}

// Les créneaux sont rangés jour par jour : quand le nombre de plats par jour change,
// chaque plat reste sur son jour au lieu de glisser vers le jour suivant.
function remapMainSlotsByDay(recipeIds, previousSlotsPerDay, settings) {
  const nextSlotsPerDay = getMainSlotsPerDay(settings);
  const remappedRecipeIds = [];
  for (let dayIndex = 0; dayIndex < settings.dayCount; dayIndex += 1) {
    const dayRecipeIds = recipeIds.slice(dayIndex * previousSlotsPerDay, (dayIndex + 1) * previousSlotsPerDay);
    for (let mealIndex = 0; mealIndex < nextSlotsPerDay; mealIndex += 1) {
      remappedRecipeIds.push(dayRecipeIds[mealIndex] ?? null);
    }
  }
  return remappedRecipeIds;
}

function keepAllowedMainRecipeIds(currentPlan, settings) {
  const recipeIds = Array.isArray(currentPlan?.mainRecipeIds) ? currentPlan.mainRecipeIds : [];
  const previousSlotsPerDay = Number.isInteger(currentPlan?.mainSlotsPerDay) && currentPlan.mainSlotsPerDay > 0
    ? currentPlan.mainSlotsPerDay
    : getMainSlotsPerDay(settings);
  return remapMainSlotsByDay(recipeIds, previousSlotsPerDay, settings).map((recipeId) => {
    const recipe = RECIPES_BY_ID.get(recipeId);
    return recipe && recipe.mealType === MEAL_TYPES.MAIN && isRecipeAllowed(recipe, settings) ? recipeId : null;
  });
}

function keepAllowedBreakfastId(currentPlan, settings) {
  const breakfastIds = Array.isArray(currentPlan?.breakfastRecipeIds) ? currentPlan.breakfastRecipeIds : [];
  const recipe = RECIPES_BY_ID.get(breakfastIds.find(Boolean));
  return recipe && recipe.mealType === MEAL_TYPES.BREAKFAST && isRecipeAllowed(recipe, settings) ? recipe.id : null;
}

export function reconcilePlan(currentPlan, settings, random = Math.random) {
  const keptPlan = {
    mainRecipeIds: keepAllowedMainRecipeIds(currentPlan, settings),
    breakfastRecipeIds: [keepAllowedBreakfastId(currentPlan, settings)],
  };
  return fillPlan(keptPlan, settings, random);
}

function swapWeeklyBreakfast(currentPlan, settings, random) {
  const purchaseTracker = createTrackerForPlan({ ...currentPlan, breakfastRecipeIds: [] }, settings);
  const breakfastRecipeIds = fillWeeklyBreakfast({
    keptRecipeId: null,
    settings,
    random,
    purchaseTracker,
    excludedRecipeIds: new Set(currentPlan.breakfastRecipeIds),
  });
  return breakfastRecipeIds.length > 0 ? { ...currentPlan, breakfastRecipeIds } : currentPlan;
}

// Avec un budget, on ne propose que des remplaçants qui tiennent dans le plafond quand il y en a :
// « Changer » ne doit pas faire exploser le ticket.
function listAffordableReplacements(candidates, currentPlan, slotIndex, settings, purchaseTracker) {
  if (!hasBudget(settings)) {
    return candidates;
  }
  const planWithoutSlot = {
    ...currentPlan,
    mainRecipeIds: currentPlan.mainRecipeIds.map((recipeId, index) => (index === slotIndex ? null : recipeId)),
  };
  const totalWithoutSlot = buildShoppingList(planWithoutSlot, settings).totalToPay;
  const servingCount = getServingCount(PLAN_KINDS.MAIN, settings);
  const affordableCandidates = candidates.filter(
    (candidate) => totalWithoutSlot + purchaseTracker.computeMarginalCost(candidate.id, servingCount) <= settings.weeklyBudget,
  );
  return affordableCandidates.length > 0 ? affordableCandidates : candidates;
}

export function swapMeal(currentPlan, kind, slotIndex, settings, random = Math.random) {
  if (kind === PLAN_KINDS.BREAKFAST) {
    return swapWeeklyBreakfast(currentPlan, settings, random);
  }
  const currentRecipeIds = currentPlan.mainRecipeIds;
  if (!Array.isArray(currentRecipeIds) || slotIndex < 0 || slotIndex >= currentRecipeIds.length) {
    return currentPlan;
  }
  const purchaseTracker = createTrackerForPlan(currentPlan, settings, slotIndex);
  const candidates = listAllowedRecipes(PLAN_KINDS.MAIN, settings).filter((recipe) => recipe.id !== currentRecipeIds[slotIndex]);
  const replacement = pickBestRecipe({
    allowedRecipes: listAffordableReplacements(candidates, currentPlan, slotIndex, settings, purchaseTracker),
    chosenRecipes: currentRecipeIds
      .filter((_recipeId, index) => index !== slotIndex)
      .map((recipeId) => RECIPES_BY_ID.get(recipeId))
      .filter(Boolean),
    excludedRecipeIds: new Set(currentRecipeIds),
    random,
    settings,
    preferCheap: hasBudget(settings),
    purchaseTracker,
    servingCount: getServingCount(PLAN_KINDS.MAIN, settings),
  });
  if (!replacement) {
    return currentPlan;
  }
  return {
    ...currentPlan,
    mainRecipeIds: currentRecipeIds.map((recipeId, index) => (index === slotIndex ? replacement.id : recipeId)),
  };
}
