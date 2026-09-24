import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PRODUCTS, PRODUCTS_BY_ID, UNITS } from '../js/catalog.js';
import { formatProductQuantity } from '../js/format.js';
import {
  DIETS,
  fitPlanToBudget,
  generatePlan,
  getMealCount,
  reconcilePlan,
  swapMeal,
} from '../js/planner.js';
import { CATEGORIES, RECIPES, RECIPES_BY_ID } from '../js/recipes.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../js/settings.js';
import { buildShoppingList } from '../js/shopping-list.js';

function createSeededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const baseSettings = normalizeSettings({ ...DEFAULT_SETTINGS, personCount: 2, mealsPerDay: 1 });

describe('catalogue et recettes', () => {
  it('référence uniquement des produits existants du catalogue', () => {
    for (const recipe of RECIPES) {
      for (const productId of Object.keys(recipe.ingredients)) {
        assert.ok(PRODUCTS_BY_ID.has(productId), `${recipe.id} utilise un produit inconnu : ${productId}`);
      }
    }
  });

  it('a des identifiants uniques et des prix positifs', () => {
    assert.equal(PRODUCTS_BY_ID.size, PRODUCTS.length);
    assert.equal(RECIPES_BY_ID.size, RECIPES.length);
    for (const product of PRODUCTS) {
      assert.ok(product.price > 0 && product.packageSize > 0, product.id);
      if (product.unit === UNITS.PIECE) {
        assert.equal(product.pieceNames?.length, 2, `${product.id} doit avoir un nom singulier et pluriel`);
      }
    }
  });

  it('propose assez de recettes végétariennes pour une semaine midi et soir', () => {
    const vegetarianCount = RECIPES.filter((recipe) => recipe.category === CATEGORIES.VEGETARIAN).length;
    assert.ok(vegetarianCount >= 14);
  });
});

describe('génération du planning', () => {
  it('remplit chaque créneau sans doublon quand le choix le permet', () => {
    const settings = { ...baseSettings, mealsPerDay: 2 };
    const plan = generatePlan(settings, createSeededRandom(1));
    assert.equal(plan.length, getMealCount(settings));
    assert.equal(new Set(plan).size, plan.length);
  });

  it('respecte le régime végétarien et le sans porc', () => {
    const vegetarianPlan = generatePlan({ ...baseSettings, diet: DIETS.VEGETARIAN, mealsPerDay: 2 }, createSeededRandom(2));
    assert.ok(vegetarianPlan.every((recipeId) => RECIPES_BY_ID.get(recipeId).category === CATEGORIES.VEGETARIAN));

    const porkFreePlan = generatePlan({ ...baseSettings, withoutPork: true, mealsPerDay: 2 }, createSeededRandom(3));
    assert.ok(porkFreePlan.every((recipeId) => !RECIPES_BY_ID.get(recipeId).containsPork));
  });

  it('garde les repas compatibles quand les réglages changent', () => {
    const plan = generatePlan(baseSettings, createSeededRandom(4));
    const shorterPlan = reconcilePlan(plan, { ...baseSettings, dayCount: 3 }, createSeededRandom(5));
    assert.deepEqual(shorterPlan, plan.slice(0, 3));

    const vegetarianPlan = reconcilePlan(plan, { ...baseSettings, diet: DIETS.VEGETARIAN }, createSeededRandom(6));
    plan.forEach((recipeId, slotIndex) => {
      if (RECIPES_BY_ID.get(recipeId).category === CATEGORIES.VEGETARIAN) {
        assert.equal(vegetarianPlan[slotIndex], recipeId);
      }
    });
  });

  it('remplace un seul repas par une recette absente du planning', () => {
    const plan = generatePlan(baseSettings, createSeededRandom(7));
    const swappedPlan = swapMeal(plan, 2, baseSettings, createSeededRandom(8));
    assert.notEqual(swappedPlan[2], plan[2]);
    assert.ok(!plan.includes(swappedPlan[2]));
    assert.deepEqual(swappedPlan.filter((_recipeId, index) => index !== 2), plan.filter((_recipeId, index) => index !== 2));
  });

  it('fait baisser le ticket quand un budget serré est fixé', () => {
    const settings = { ...baseSettings, mealsPerDay: 2 };
    const plan = generatePlan(settings, createSeededRandom(9));
    const unconstrainedTotal = buildShoppingList(plan, settings).totalToPay;
    const budgetSettings = { ...settings, weeklyBudget: 20 };
    const fittedTotal = buildShoppingList(fitPlanToBudget(plan, budgetSettings), budgetSettings).totalToPay;
    assert.ok(fittedTotal <= unconstrainedTotal);
  });
});

describe('liste de courses', () => {
  it('arrondit au paquet entier et calcule le reste', () => {
    const settings = { ...baseSettings, personCount: 4 };
    const shoppingList = buildShoppingList(['spaghetti-bolognaise', 'spaghetti-thon-tomate'], settings);
    const spaghettiLine = shoppingList.aisleGroups.flatMap((group) => group.lines).find((line) => line.product.id === 'spaghetti');
    assert.equal(spaghettiLine.neededQuantity, 800);
    assert.equal(spaghettiLine.packageCount, 2);
    assert.equal(spaghettiLine.leftoverQuantity, 200);
    assert.equal(spaghettiLine.cost, 1.7);
  });

  it('exclut les basiques du placard du total quand on les possède déjà', () => {
    const plan = ['spaghetti-bolognaise'];
    const withPantry = buildShoppingList(plan, { ...baseSettings, pantryStaplesOwned: true });
    const withoutPantry = buildShoppingList(plan, { ...baseSettings, pantryStaplesOwned: false });
    assert.ok(withPantry.pantryLines.length > 0);
    assert.ok(withoutPantry.totalToPay > withPantry.totalToPay);
    assert.ok(withPantry.consumedValue <= withPantry.totalToPay);
  });
});

describe('réglages et formatage', () => {
  it('borne les valeurs saisies', () => {
    const settings = normalizeSettings({ personCount: '40', dayCount: '0', diet: 'inconnu', weeklyBudget: 'abc' });
    assert.equal(settings.personCount, 8);
    assert.equal(settings.dayCount, 1);
    assert.equal(settings.diet, DIETS.OMNIVORE);
    assert.equal(settings.weeklyBudget, 0);
  });

  it('accorde les pièces au pluriel', () => {
    const eggs = PRODUCTS_BY_ID.get('oeuf');
    assert.equal(formatProductQuantity(eggs, 1), '1 œuf');
    assert.equal(formatProductQuantity(eggs, 3), '3 œufs');
    assert.equal(formatProductQuantity(PRODUCTS_BY_ID.get('riz'), 1500), '1,5 kg riz basmati');
  });
});
