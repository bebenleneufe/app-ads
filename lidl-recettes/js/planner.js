import {
  getBreakfastSlotCount,
  getMainSlotCount,
  getMainSlotsPerDay,
  getServingsPerBreakfast,
  getServingsPerMainSlot,
  getServingsPerSnack,
  getSnackSlotCount,
} from './meal-structure.js';
import {
  computeMealProteinTarget,
  computeMealTargetKcal,
  fitsMealTarget,
  getPortionKcal,
  getPortionProtein,
} from './nutrition.js';
import { CATEGORIES, fitsTimeLimit, MEAL_TYPES, RECIPES, RECIPES_BY_ID } from './recipes.js';
import { EMPTY_PREFERENCES } from './preferences.js';
import { buildShoppingList, computePortionCost, createPurchaseTracker } from './shopping-list.js';

export const DIETS = Object.freeze({
  OMNIVORE: 'omnivore',
  PESCETARIAN: 'pescetarien',
  VEGETARIAN: 'vegetarien',
});

export const PLAN_KINDS = Object.freeze({
  MAIN: 'main',
  BREAKFAST: 'breakfast',
  SNACK: 'snack',
});

const MEAL_TYPE_BY_KIND = Object.freeze({
  [PLAN_KINDS.MAIN]: MEAL_TYPES.MAIN,
  [PLAN_KINDS.BREAKFAST]: MEAL_TYPES.BREAKFAST,
  [PLAN_KINDS.SNACK]: MEAL_TYPES.SNACK,
});

const PLAN_KEY_BY_KIND = Object.freeze({
  [PLAN_KINDS.MAIN]: 'mainRecipeIds',
  [PLAN_KINDS.BREAKFAST]: 'breakfastRecipeIds',
  [PLAN_KINDS.SNACK]: 'snackRecipeIds',
});

// Le petit-déjeuner et la collation sont les mêmes toute la semaine.
const WEEKLY_KINDS = Object.freeze([PLAN_KINDS.BREAKFAST, PLAN_KINDS.SNACK]);

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
// Un plat aimé doit revenir plus souvent sans écraser le prix ni les calories ;
// un plat des deux dernières semaines est évité mais reste possible si le choix manque.
const LIKED_RECIPE_BONUS = 2.5;
const PROTEIN_WEIGHT = 6;
// Au-delà de 1,5 fois la cible d'un repas, plus de protéines n'apporte rien de plus.
const PROTEIN_SCORE_CAP = 1.5;
const RECENT_RECIPE_PENALTY = 3;

function getPreferences(settings) {
  return settings.preferences ?? EMPTY_PREFERENCES;
}

const SLOT_COUNT_BY_KIND = Object.freeze({
  [PLAN_KINDS.MAIN]: getMainSlotCount,
  [PLAN_KINDS.BREAKFAST]: getBreakfastSlotCount,
  [PLAN_KINDS.SNACK]: getSnackSlotCount,
});

const SERVING_COUNT_BY_KIND = Object.freeze({
  [PLAN_KINDS.MAIN]: getServingsPerMainSlot,
  [PLAN_KINDS.BREAKFAST]: getServingsPerBreakfast,
  [PLAN_KINDS.SNACK]: getServingsPerSnack,
});

function getSlotCount(kind, settings) {
  return SLOT_COUNT_BY_KIND[kind](settings);
}

function getServingCount(kind, settings) {
  return SERVING_COUNT_BY_KIND[kind](settings);
}

function listRecipeIds(plan, kind) {
  const recipeIds = plan?.[PLAN_KEY_BY_KIND[kind]];
  return Array.isArray(recipeIds) ? recipeIds : [];
}

function hasBudget(settings) {
  return settings.weeklyBudget > 0;
}

export function isRecipeAllowed(recipe, settings) {
  if (getPreferences(settings).disliked.includes(recipe.id)) {
    return false;
  }
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

function computeProteinBonus(candidate, settings) {
  const mealProteinTarget = computeMealProteinTarget(settings, candidate.mealType);
  if (!mealProteinTarget) {
    return 0;
  }
  return Math.min(PROTEIN_SCORE_CAP, getPortionProtein(candidate.id, settings) / mealProteinTarget) * PROTEIN_WEIGHT;
}

function scoreCandidate({ candidate, chosenRecipes, random, settings, preferCheap, purchaseTracker, servingCount }) {
  const marginalCost = purchaseTracker.computeMarginalCost(candidate.id, servingCount);
  const weights = SCORING_WEIGHTS_BY_PRIORITY[settings.priority] ?? SCORING_WEIGHTS_BY_PRIORITY[PRIORITIES.PRICE];
  const repetitionCount = chosenRecipes.filter((recipe) => recipe.id === candidate.id).length;
  const sameCategoryShare = chosenRecipes.length === 0
    ? 0
    : chosenRecipes.filter((recipe) => recipe.category === candidate.category).length / chosenRecipes.length;
  const cheapnessPenalty = preferCheap ? computePortionCost(candidate.id, settings) * CHEAPNESS_WEIGHT : 0;
  const preferences = getPreferences(settings);
  const preferenceScore = (preferences.liked.includes(candidate.id) ? LIKED_RECIPE_BONUS : 0)
    - (preferences.recent.includes(candidate.id) ? RECENT_RECIPE_PENALTY : 0);

  return random() * weights.randomness
    + preferenceScore
    + computeProteinBonus(candidate, settings)
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

function createTrackerForPlan(plan, settings, { skippedKind = null, skippedMainSlotIndex = -1 } = {}) {
  const purchaseTracker = createPurchaseTracker(settings);
  for (const kind of Object.values(PLAN_KINDS)) {
    if (kind === skippedKind && kind !== PLAN_KINDS.MAIN) {
      continue;
    }
    listRecipeIds(plan, kind).forEach((recipeId, index) => {
      const isSkippedSlot = kind === PLAN_KINDS.MAIN && index === skippedMainSlotIndex;
      if (recipeId && !isSkippedSlot) {
        purchaseTracker.addRecipe(recipeId, getServingCount(kind, settings));
      }
    });
  }
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

// Un seul petit-déjeuner et une seule collation pour la semaine : pas de décision à prendre,
// et les mêmes paquets (flocons, lait, fruits) sont finis au lieu d'en ouvrir d'autres.
function fillWeeklyRecipe({ kind, keptRecipeId, settings, random, purchaseTracker, excludedRecipeIds = new Set() }) {
  const slotCount = getSlotCount(kind, settings);
  if (slotCount === 0) {
    return [];
  }
  const servingCount = getServingCount(kind, settings) * slotCount;
  const weeklyRecipe = keptRecipeId
    ? RECIPES_BY_ID.get(keptRecipeId)
    : pickBestRecipe({
      allowedRecipes: listAllowedRecipes(kind, settings),
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
    const purchaseTracker = createTrackerForPlan(adjustedPlan, settings, { skippedMainSlotIndex: slotIndex });
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

// Les plats sont choisis avant le petit-déjeuner et la collation : ceux-ci peuvent alors
// finir le pain, les œufs ou le fromage blanc déjà achetés pour les plats.
function fillPlan(keptPlan, settings, random) {
  const purchaseTracker = createPurchaseTracker(settings);
  const filledPlan = {
    mainRecipeIds: fillMainSlots({ keptRecipeIds: keptPlan.mainRecipeIds, settings, random, purchaseTracker }),
    mainSlotsPerDay: getMainSlotsPerDay(settings),
  };
  for (const kind of WEEKLY_KINDS) {
    filledPlan[PLAN_KEY_BY_KIND[kind]] = fillWeeklyRecipe({
      kind,
      keptRecipeId: keptPlan[PLAN_KEY_BY_KIND[kind]]?.find(Boolean) ?? null,
      settings,
      random,
      purchaseTracker,
    });
  }
  return fitPlanToBudget(filledPlan, settings);
}

export function generatePlan(settings, random = Math.random) {
  return fillPlan({ mainRecipeIds: [] }, settings, random);
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

function keepAllowedWeeklyId(currentPlan, kind, settings) {
  const recipe = RECIPES_BY_ID.get(listRecipeIds(currentPlan, kind).find(Boolean));
  return recipe && recipe.mealType === MEAL_TYPE_BY_KIND[kind] && isRecipeAllowed(recipe, settings) ? recipe.id : null;
}

export function reconcilePlan(currentPlan, settings, random = Math.random) {
  const keptPlan = { mainRecipeIds: keepAllowedMainRecipeIds(currentPlan, settings) };
  for (const kind of WEEKLY_KINDS) {
    keptPlan[PLAN_KEY_BY_KIND[kind]] = [keepAllowedWeeklyId(currentPlan, kind, settings)];
  }
  return fillPlan(keptPlan, settings, random);
}

function swapWeeklyRecipe(currentPlan, kind, settings, random) {
  const planKey = PLAN_KEY_BY_KIND[kind];
  const weeklyRecipeIds = fillWeeklyRecipe({
    kind,
    keptRecipeId: null,
    settings,
    random,
    purchaseTracker: createTrackerForPlan(currentPlan, settings, { skippedKind: kind }),
    excludedRecipeIds: new Set(listRecipeIds(currentPlan, kind)),
  });
  return weeklyRecipeIds.length > 0 ? { ...currentPlan, [planKey]: weeklyRecipeIds } : currentPlan;
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
  if (WEEKLY_KINDS.includes(kind)) {
    return swapWeeklyRecipe(currentPlan, kind, settings, random);
  }
  const currentRecipeIds = currentPlan.mainRecipeIds;
  if (!Array.isArray(currentRecipeIds) || slotIndex < 0 || slotIndex >= currentRecipeIds.length) {
    return currentPlan;
  }
  const purchaseTracker = createTrackerForPlan(currentPlan, settings, { skippedMainSlotIndex: slotIndex });
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
