import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PRODUCTS } from '../js/catalog.js';
import {
  computeDailyTargetKcal,
  computeMaintenanceKcal,
  computeMealTargetKcal,
  getRecipeKcal,
  GOALS,
  MEAL_KCAL_TOLERANCE,
  SEXES,
} from '../js/nutrition.js';
import { KCAL_BY_PRODUCT_ID } from '../js/nutrition-facts.js';
import { DIETS, generatePlan } from '../js/planner.js';
import { RECIPES } from '../js/recipes.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../js/settings.js';

const weightLossSettings = normalizeSettings({ ...DEFAULT_SETTINGS, goal: GOALS.WEIGHT_LOSS });

describe('calories', () => {
  it('connaît la valeur énergétique de chaque produit', () => {
    for (const product of PRODUCTS) {
      assert.ok(KCAL_BY_PRODUCT_ID[product.id] > 0, `kcal manquantes pour ${product.id}`);
    }
    for (const recipe of RECIPES) {
      assert.ok(getRecipeKcal(recipe.id) > 200, `${recipe.id} semble trop peu calorique`);
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

  it('ne propose que des repas sous la cible, y compris en végétarien midi et soir', () => {
    for (const diet of Object.values(DIETS)) {
      const settings = { ...weightLossSettings, diet, mealsPerDay: 2 };
      const mealLimitKcal = computeMealTargetKcal(settings) * MEAL_KCAL_TOLERANCE;
      const plan = generatePlan(settings);
      assert.equal(plan.length, 14);
      assert.ok(plan.every((recipeId) => getRecipeKcal(recipeId) <= mealLimitKcal), diet);
    }
  });
});
