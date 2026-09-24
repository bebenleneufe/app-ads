import { PRODUCTS_BY_ID, UNITS } from './catalog.js';
import { KCAL_BY_PRODUCT_ID } from './nutrition-facts.js';
import { RECIPES } from './recipes.js';

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

// Déjeuner et dîner couvrent environ 70 % de la journée ; le petit-déjeuner et une collation couvrent le reste.
const MAIN_MEAL_SHARE_OF_DAY = 0.35;

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

export function computeMealTargetKcal(settings) {
  const dailyTargetKcal = computeDailyTargetKcal(settings);
  return dailyTargetKcal === null ? null : Math.round(dailyTargetKcal * MAIN_MEAL_SHARE_OF_DAY);
}

export function fitsMealTarget(recipeId, settings) {
  const mealTargetKcal = computeMealTargetKcal(settings);
  return mealTargetKcal === null || getRecipeKcal(recipeId) <= mealTargetKcal * MEAL_KCAL_TOLERANCE;
}
