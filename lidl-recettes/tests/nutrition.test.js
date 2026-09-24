import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PRODUCTS } from '../js/catalog.js';
import {
  computeDailyTargetKcal,
  computeMaintenanceKcal,
  computeMealTargetKcal,
  getPortionFactor,
  getPortionKcal,
  getRecipeKcal,
  GOALS,
  MEAL_KCAL_TOLERANCE,
  SEXES,
} from '../js/nutrition.js';
import { KCAL_BY_PRODUCT_ID } from '../js/nutrition-facts.js';
import { DIETS, generatePlan } from '../js/planner.js';
import { MAIN_MEAL_MODES } from '../js/meal-structure.js';
import { MEAL_TYPES, RECIPES } from '../js/recipes.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../js/settings.js';

const weightLossSettings = normalizeSettings({ ...DEFAULT_SETTINGS, goal: GOALS.WEIGHT_LOSS });

describe('calories', () => {
  it('connaît la valeur énergétique de chaque produit', () => {
    for (const product of PRODUCTS) {
      assert.ok(KCAL_BY_PRODUCT_ID[product.id] > 0, `kcal manquantes pour ${product.id}`);
    }
    for (const recipe of RECIPES) {
      const minimumKcal = recipe.mealType === MEAL_TYPES.SNACK ? 50 : 200;
      assert.ok(getRecipeKcal(recipe.id) > minimumKcal, `${recipe.id} semble trop peu calorique`);
    }
  });

  it('applique Mifflin-St Jeor pour un homme sédentaire de 35 ans', () => {
    const profile = { sex: SEXES.MALE, age: 35, weightKg: 85, heightCm: 178, activityLevel: 'sedentaire' };
    assert.equal(computeMaintenanceKcal(profile), 2151);
    assert.equal(computeDailyTargetKcal({ ...profile, goal: GOALS.WEIGHT_LOSS }), 1651);
  });

  it('ne descend jamais sous le plancher journalier', () => {
    const lightProfile = { sex: SEXES.MALE, age: 60, weightKg: 50, heightCm: 150, activityLevel: 'sedentaire', goal: GOALS.WEIGHT_LOSS };
    assert.equal(computeDailyTargetKcal(lightProfile), 1500);
  });

  it('ne fixe pas de cible sans objectif de perte de poids', () => {
    assert.equal(computeMealTargetKcal({ ...weightLossSettings, goal: GOALS.NONE }), null);
  });

  it('ne propose que des repas sous la cible, y compris en végétarien avec deux plats par jour', () => {
    for (const diet of Object.values(DIETS)) {
      const settings = { ...weightLossSettings, diet, mainMealMode: MAIN_MEAL_MODES.DIFFERENT_LUNCH_AND_DINNER, includeBreakfast: true };
      const mainLimitKcal = computeMealTargetKcal(settings, MEAL_TYPES.MAIN) * MEAL_KCAL_TOLERANCE;
      const breakfastLimitKcal = computeMealTargetKcal(settings, MEAL_TYPES.BREAKFAST) * MEAL_KCAL_TOLERANCE;
      const plan = generatePlan(settings);
      assert.equal(plan.mainRecipeIds.length, 14);
      assert.equal(plan.breakfastRecipeIds.length, 7);
      assert.ok(plan.mainRecipeIds.every((recipeId) => getRecipeKcal(recipeId) <= mainLimitKcal), diet);
      assert.ok(plan.breakfastRecipeIds.every((recipeId) => getRecipeKcal(recipeId) <= breakfastLimitKcal), diet);
    }
  });

  it('garde une journée type sous l’objectif avec le même plat midi et soir', () => {
    const plan = generatePlan(weightLossSettings);
    const dailyTargetKcal = computeDailyTargetKcal(weightLossSettings);
    plan.mainRecipeIds.forEach((mainRecipeId, dayIndex) => {
      const dayKcal = getPortionKcal(plan.breakfastRecipeIds[dayIndex], weightLossSettings)
        + 2 * getPortionKcal(mainRecipeId, weightLossSettings);
      assert.ok(dayKcal <= dailyTargetKcal * MEAL_KCAL_TOLERANCE, `jour ${dayIndex + 1} : ${dayKcal} kcal`);
    });
  });

  it('vise l’objectif sans manger trop peu sur la semaine', () => {
    const plan = generatePlan(weightLossSettings);
    const weekKcal = plan.mainRecipeIds.reduce(
      (kcalSum, mainRecipeId, dayIndex) => kcalSum
        + getPortionKcal(plan.breakfastRecipeIds[dayIndex], weightLossSettings)
        + 2 * getPortionKcal(mainRecipeId, weightLossSettings),
      0,
    );
    const averageDayKcal = weekKcal / plan.mainRecipeIds.length;
    assert.ok(averageDayKcal >= computeDailyTargetKcal(weightLossSettings) * 0.8, `moyenne ${Math.round(averageDayKcal)} kcal`);
  });

  it('ajuste les portions vers la cible sans toucher aux produits à la pièce', () => {
    const mealTargetKcal = computeMealTargetKcal(weightLossSettings, MEAL_TYPES.MAIN);
    assert.ok(getRecipeKcal('soupe-lentilles-corail-coco') < mealTargetKcal);
    assert.ok(getPortionFactor('soupe-lentilles-corail-coco', weightLossSettings) > 1);
    assert.ok(getPortionKcal('soupe-lentilles-corail-coco', weightLossSettings) > getRecipeKcal('soupe-lentilles-corail-coco'));
    assert.equal(getPortionFactor('soupe-lentilles-corail-coco', { ...weightLossSettings, goal: GOALS.NONE }), 1);
  });
});
