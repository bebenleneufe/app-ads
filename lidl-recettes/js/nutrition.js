import { PRODUCTS_BY_ID, UNITS } from './catalog.js';
import { KCAL_BY_PRODUCT_ID } from './nutrition-facts.js';
import { MEAL_TYPES, RECIPES, RECIPES_BY_ID } from './recipes.js';

export const GOALS = Object.freeze({
  NONE: 'aucun',
  WEIGHT_LOSS: 'perte-de-poids',
});

export const SEXES = Object.freeze({ MALE: 'homme', FEMALE: 'femme' });

export const ACTIVITY_FACTORS = Object.freeze({
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
});

// Un déficit d'environ 500 kcal par jour vise une perte d'environ 0,5 kg par semaine,
// un rythme généralement conseillé. Les planchers évitent de proposer un régime trop strict.
const DAILY_DEFICIT_KCAL = 500;
const MINIMUM_DAILY_KCAL = Object.freeze({ [SEXES.MALE]: 1500, [SEXES.FEMALE]: 1200 });

// Répartition usuelle : 25 % au petit-déjeuner, 35 % au déjeuner et 35 % au dîner.
// Les 5 % restants laissent de la place pour un café au lait ou un fruit.
const SHARE_OF_DAY_BY_MEAL_TYPE = Object.freeze({
  [MEAL_TYPES.BREAKFAST]: 0.25,
  [MEAL_TYPES.MAIN]: 0.35,
});

// Marge acceptée au-dessus de la cible d'un repas : sous-estimer ou surestimer de 10 % reste dans la précision des tables.
export const MEAL_KCAL_TOLERANCE = 1.1;

function computeIngredientKcal(productId, quantity) {
  const product = PRODUCTS_BY_ID.get(productId);
  const kcalReference = KCAL_BY_PRODUCT_ID[productId];
  if (!product || kcalReference === undefined) {
    return 0;
  }
  return product.unit === UNITS.PIECE ? quantity * kcalReference : (quantity * kcalReference) / 100;
}

function computeRecipeKcal(recipe) {
  const totalKcal = Object.entries(recipe.ingredients)
    .reduce((kcalSum, [productId, quantity]) => kcalSum + computeIngredientKcal(productId, quantity), 0);
  return Math.round(totalKcal);
}

const KCAL_BY_RECIPE_ID = new Map(RECIPES.map((recipe) => [recipe.id, computeRecipeKcal(recipe)]));

export function getRecipeKcal(recipeId) {
  return KCAL_BY_RECIPE_ID.get(recipeId) ?? 0;
}

export function hasWeightLossGoal(settings) {
  return settings.goal === GOALS.WEIGHT_LOSS;
}

// Formule de Mifflin-St Jeor, la plus fiable pour les adultes selon les études comparatives.
export function computeMaintenanceKcal({ sex, age, weightKg, heightCm, activityLevel }) {
  const sexAdjustment = sex === SEXES.FEMALE ? -161 : 5;
  const basalMetabolicRate = 10 * weightKg + 6.25 * heightCm - 5 * age + sexAdjustment;
  return Math.round(basalMetabolicRate * (ACTIVITY_FACTORS[activityLevel] ?? ACTIVITY_FACTORS.sedentaire));
}

export function computeDailyTargetKcal(settings) {
  if (!hasWeightLossGoal(settings)) {
    return null;
  }
  const minimumKcal = MINIMUM_DAILY_KCAL[settings.sex] ?? MINIMUM_DAILY_KCAL[SEXES.MALE];
  return Math.max(minimumKcal, computeMaintenanceKcal(settings) - DAILY_DEFICIT_KCAL);
}

export function computeMealTargetKcal(settings, mealType = MEAL_TYPES.MAIN) {
  const dailyTargetKcal = computeDailyTargetKcal(settings);
  return dailyTargetKcal === null ? null : Math.round(dailyTargetKcal * SHARE_OF_DAY_BY_MEAL_TYPE[mealType]);
}

// Bornes d'ajustement des portions : au-delà, le plat ne ressemble plus à la recette
// (assiette démesurée ou quasi vide) et mieux vaut en choisir un autre.
const PORTION_FACTOR_BOUNDS = Object.freeze({ min: 0.9, max: 1.4 });
const PORTION_FACTOR_STEP = 0.05;

function isScalableProduct(productId) {
  const product = PRODUCTS_BY_ID.get(productId);
  return product !== undefined && product.unit !== UNITS.PIECE && !product.isPantryStaple;
}

function splitRecipeKcal(recipe) {
  return Object.entries(recipe.ingredients).reduce((split, [productId, quantity]) => {
    const ingredientKcal = computeIngredientKcal(productId, quantity);
    return isScalableProduct(productId)
      ? { ...split, scalableKcal: split.scalableKcal + ingredientKcal }
      : { ...split, fixedKcal: split.fixedKcal + ingredientKcal };
  }, { scalableKcal: 0, fixedKcal: 0 });
}

// Les produits à la pièce (œufs, tortillas…) ne sont pas ajustés : « 3,3 œufs » n'a pas de sens en cuisine.
export function getPortionFactor(recipeId, settings) {
  const recipe = RECIPES_BY_ID.get(recipeId);
  const mealTargetKcal = recipe ? computeMealTargetKcal(settings, recipe.mealType) : null;
  if (mealTargetKcal === null) {
    return 1;
  }
  const { scalableKcal, fixedKcal } = splitRecipeKcal(recipe);
  if (scalableKcal <= 0) {
    return 1;
  }
  const idealFactor = (mealTargetKcal - fixedKcal) / scalableKcal;
  const boundedFactor = Math.min(PORTION_FACTOR_BOUNDS.max, Math.max(PORTION_FACTOR_BOUNDS.min, idealFactor));
  return Math.round(boundedFactor / PORTION_FACTOR_STEP) * PORTION_FACTOR_STEP;
}

export function getPortionQuantities(recipeId, settings) {
  const recipe = RECIPES_BY_ID.get(recipeId);
  if (!recipe) {
    return [];
  }
  const portionFactor = getPortionFactor(recipeId, settings);
  return Object.entries(recipe.ingredients).map(([productId, quantity]) => [
    productId,
    isScalableProduct(productId) ? quantity * portionFactor : quantity,
  ]);
}

export function getPortionKcal(recipeId, settings) {
  const portionKcal = getPortionQuantities(recipeId, settings)
    .reduce((kcalSum, [productId, quantity]) => kcalSum + computeIngredientKcal(productId, quantity), 0);
  return Math.round(portionKcal);
}

export function fitsMealTarget(recipeId, settings) {
  const recipe = RECIPES_BY_ID.get(recipeId);
  const mealTargetKcal = recipe ? computeMealTargetKcal(settings, recipe.mealType) : null;
  return mealTargetKcal === null || getRecipeKcal(recipeId) <= mealTargetKcal * MEAL_KCAL_TOLERANCE;
}
