import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { AISLE_ORDER, AISLES, PRODUCTS, PRODUCTS_BY_ID, UNITS } from '../js/catalog.js';
import { formatProductQuantity } from '../js/format.js';
import { getMainSlotCount, MAIN_MEAL_MODES } from '../js/meal-structure.js';
import { GOALS } from '../js/nutrition.js';
import {
  DIETS,
  fitPlanToBudget,
  generatePlan,
  isRecipeAllowed,
  PLAN_KINDS,
  PRIORITIES,
  reconcilePlan,
  swapMeal,
} from '../js/planner.js';
import {
  CATEGORIES,
  countFreshIngredients,
  MEAL_TYPES,
  RECIPES,
  MAX_FRESH_INGREDIENTS_WHEN_TIME_LIMITED,
  RECIPES_BY_ID,
} from '../js/recipes.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../js/settings.js';
import { buildShoppingList } from '../js/shopping-list.js';

function createSeededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function findLine(shoppingList, productId) {
  return shoppingList.aisleGroups.flatMap((group) => group.lines).find((line) => line.product.id === productId);
}

const baseSettings = normalizeSettings({
  ...DEFAULT_SETTINGS,
  personCount: 2,
  goal: GOALS.NONE,
  mainMealMode: MAIN_MEAL_MODES.DINNER_ONLY,
  includeBreakfast: false,
});

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

  it('propose assez de plats végétariens pour une semaine midi et soir', () => {
    const vegetarianMainCount = RECIPES
      .filter((recipe) => recipe.mealType === MEAL_TYPES.MAIN && recipe.category === CATEGORIES.VEGETARIAN)
      .length;
    assert.ok(vegetarianMainCount >= 14);
  });
});

describe('génération du planning', () => {
  it('remplit chaque créneau sans doublon quand le choix le permet', () => {
    const settings = { ...baseSettings, mainMealMode: MAIN_MEAL_MODES.DIFFERENT_LUNCH_AND_DINNER };
    const plan = generatePlan(settings, createSeededRandom(1));
    assert.equal(plan.mainRecipeIds.length, getMainSlotCount(settings));
    assert.equal(new Set(plan.mainRecipeIds).size, plan.mainRecipeIds.length);
    assert.deepEqual(plan.breakfastRecipeIds, []);
  });

  it('prévoit un plat par jour et un petit-déjeuner quand midi et soir sont identiques', () => {
    const settings = { ...baseSettings, mainMealMode: MAIN_MEAL_MODES.SAME_LUNCH_AND_DINNER, includeBreakfast: true };
    const plan = generatePlan(settings, createSeededRandom(2));
    assert.equal(plan.mainRecipeIds.length, 7);
    assert.equal(plan.breakfastRecipeIds.length, 7);
    assert.ok(plan.breakfastRecipeIds.every((recipeId) => RECIPES_BY_ID.get(recipeId).mealType === MEAL_TYPES.BREAKFAST));
    assert.ok(plan.mainRecipeIds.every((recipeId) => RECIPES_BY_ID.get(recipeId).mealType === MEAL_TYPES.MAIN));
  });

  it('respecte le régime végétarien et le sans porc', () => {
    const vegetarianSettings = { ...baseSettings, diet: DIETS.VEGETARIAN, includeBreakfast: true };
    const vegetarianPlan = generatePlan(vegetarianSettings, createSeededRandom(3));
    const allVegetarianIds = [...vegetarianPlan.mainRecipeIds, ...vegetarianPlan.breakfastRecipeIds];
    assert.ok(allVegetarianIds.every((recipeId) => RECIPES_BY_ID.get(recipeId).category === CATEGORIES.VEGETARIAN));

    const porkFreeSettings = { ...baseSettings, withoutPork: true, includeBreakfast: true };
    const porkFreePlan = generatePlan(porkFreeSettings, createSeededRandom(4));
    const allPorkFreeIds = [...porkFreePlan.mainRecipeIds, ...porkFreePlan.breakfastRecipeIds];
    assert.ok(allPorkFreeIds.every((recipeId) => !RECIPES_BY_ID.get(recipeId).containsPork));
  });

  it('respecte la limite de temps et reste varié même à 15 minutes', () => {
    for (const maxPrepMinutes of [15, 20]) {
      const settings = { ...baseSettings, maxPrepMinutes, includeBreakfast: true };
      const plan = generatePlan(settings, createSeededRandom(13));
      assert.equal(plan.mainRecipeIds.length, 7);
      assert.equal(new Set(plan.mainRecipeIds).size, 7, `doublons à ${maxPrepMinutes} min`);
      for (const recipeId of [...plan.mainRecipeIds, ...plan.breakfastRecipeIds]) {
        const recipe = RECIPES_BY_ID.get(recipeId);
        assert.ok(recipe.prepMinutes <= maxPrepMinutes, recipe.id);
        assert.ok(countFreshIngredients(recipe) <= MAX_FRESH_INGREDIENTS_WHEN_TIME_LIMITED, recipe.id);
      }
    }
  });

  it('a au moins 25 plats de 20 minutes ou moins compatibles avec l’objectif par défaut', () => {
    const defaultSettings = normalizeSettings(DEFAULT_SETTINGS);
    const quickMainCount = RECIPES
      .filter((recipe) => recipe.mealType === MEAL_TYPES.MAIN && isRecipeAllowed(recipe, defaultSettings))
      .length;
    assert.ok(quickMainCount >= 25, `${quickMainCount} plats`);
  });

  it('garde les repas compatibles quand les réglages changent', () => {
    const plan = generatePlan(baseSettings, createSeededRandom(5));
    const shorterPlan = reconcilePlan(plan, { ...baseSettings, dayCount: 3 }, createSeededRandom(6));
    assert.deepEqual(shorterPlan.mainRecipeIds, plan.mainRecipeIds.slice(0, 3));

    const vegetarianPlan = reconcilePlan(plan, { ...baseSettings, diet: DIETS.VEGETARIAN }, createSeededRandom(7));
    plan.mainRecipeIds.forEach((recipeId, slotIndex) => {
      if (RECIPES_BY_ID.get(recipeId).category === CATEGORIES.VEGETARIAN) {
        assert.equal(vegetarianPlan.mainRecipeIds[slotIndex], recipeId);
      }
    });
  });

  it('remplace un seul plat par une recette absente du planning', () => {
    const plan = generatePlan(baseSettings, createSeededRandom(8));
    const swappedPlan = swapMeal(plan, PLAN_KINDS.MAIN, 2, baseSettings, createSeededRandom(9));
    assert.notEqual(swappedPlan.mainRecipeIds[2], plan.mainRecipeIds[2]);
    assert.ok(!plan.mainRecipeIds.includes(swappedPlan.mainRecipeIds[2]));
    const withoutSwappedSlot = (recipeIds) => recipeIds.filter((_recipeId, index) => index !== 2);
    assert.deepEqual(withoutSwappedSlot(swappedPlan.mainRecipeIds), withoutSwappedSlot(plan.mainRecipeIds));
  });

  it('sert le même petit-déjeuner toute la semaine', () => {
    const settings = normalizeSettings(DEFAULT_SETTINGS);
    for (let seed = 0; seed < 10; seed += 1) {
      const plan = generatePlan(settings, createSeededRandom(seed + 200));
      assert.equal(plan.breakfastRecipeIds.length, settings.dayCount);
      assert.equal(new Set(plan.breakfastRecipeIds).size, 1, `graine ${seed}`);
    }
  });

  it('change le petit-déjeuner de toute la semaine d’un coup', () => {
    const settings = { ...baseSettings, includeBreakfast: true };
    const plan = generatePlan(settings, createSeededRandom(10));
    const swappedPlan = swapMeal(plan, PLAN_KINDS.BREAKFAST, 0, settings, createSeededRandom(11));
    assert.notEqual(swappedPlan.breakfastRecipeIds[0], plan.breakfastRecipeIds[0]);
    assert.equal(RECIPES_BY_ID.get(swappedPlan.breakfastRecipeIds[0]).mealType, MEAL_TYPES.BREAKFAST);
    assert.equal(new Set(swappedPlan.breakfastRecipeIds).size, 1);
    assert.equal(swappedPlan.breakfastRecipeIds.length, plan.breakfastRecipeIds.length);
    assert.deepEqual(swappedPlan.mainRecipeIds, plan.mainRecipeIds);
  });

  it('coûte moins cher en priorité petit prix qu’en priorité variété', () => {
    const defaultSettings = normalizeSettings(DEFAULT_SETTINGS);
    const medianTotal = (priority) => {
      const settings = { ...defaultSettings, priority };
      const totals = Array.from({ length: 40 }, (_unused, seed) => buildShoppingList(generatePlan(settings, createSeededRandom(seed + 100)), settings).totalToPay)
        .sort((first, second) => first - second);
      return totals[20];
    };
    assert.ok(medianTotal(PRIORITIES.PRICE) < medianTotal(PRIORITIES.VARIETY));
  });

  it('fait baisser le ticket quand un budget serré est fixé', () => {
    const settings = { ...baseSettings, mainMealMode: MAIN_MEAL_MODES.DIFFERENT_LUNCH_AND_DINNER };
    const plan = generatePlan(settings, createSeededRandom(12));
    const unconstrainedTotal = buildShoppingList(plan, settings).totalToPay;
    const budgetSettings = { ...settings, weeklyBudget: 20 };
    const fittedTotal = buildShoppingList(fitPlanToBudget(plan, budgetSettings), budgetSettings).totalToPay;
    assert.ok(fittedTotal <= unconstrainedTotal);
  });
});

describe('liste de courses', () => {
  it('range chaque produit dans un rayon connu, surgelés en dernier', () => {
    for (const product of PRODUCTS) {
      assert.ok(AISLE_ORDER.includes(product.aisle), `${product.id} : rayon inconnu ${product.aisle}`);
    }
    assert.equal(AISLE_ORDER.at(-1), AISLES.FROZEN);
    assert.equal(AISLE_ORDER[0], AISLES.PRODUCE);
    assert.equal(PRODUCTS_BY_ID.get('thon').aisle, AISLES.CANS);
  });

  it('présente les rayons dans l’ordre du magasin, articles triés et sous-totaux justes', () => {
    const settings = normalizeSettings(DEFAULT_SETTINGS);
    const shoppingList = buildShoppingList(generatePlan(settings, createSeededRandom(21)), settings);
    const aisleIndexes = shoppingList.aisleGroups.map((group) => AISLE_ORDER.indexOf(group.aisle));
    assert.deepEqual(aisleIndexes, [...aisleIndexes].sort((first, second) => first - second));
    for (const group of shoppingList.aisleGroups) {
      assert.ok(group.lines.every((line) => line.product.aisle === group.aisle));
      const names = group.lines.map((line) => line.product.name);
      assert.deepEqual(names, [...names].sort((first, second) => first.localeCompare(second, 'fr')));
      const expectedSubtotal = Math.round(group.lines.reduce((total, line) => total + line.cost, 0) * 100) / 100;
      assert.equal(group.subtotal, expectedSubtotal);
    }
  });

  it('arrondit au paquet entier et calcule le reste', () => {
    const settings = { ...baseSettings, personCount: 4 };
    const plan = { mainRecipeIds: ['spaghetti-bolognaise', 'spaghetti-thon-tomate'], breakfastRecipeIds: [] };
    const spaghettiLine = findLine(buildShoppingList(plan, settings), 'spaghetti');
    assert.equal(spaghettiLine.neededQuantity, 800);
    assert.equal(spaghettiLine.packageCount, 2);
    assert.equal(spaghettiLine.leftoverQuantity, 200);
    assert.equal(spaghettiLine.cost, 1.7);
  });

  it('compte deux portions par plat quand il sert au déjeuner et au dîner', () => {
    const plan = { mainRecipeIds: ['spaghetti-bolognaise'], breakfastRecipeIds: ['porridge-banane'] };
    const settings = { ...baseSettings, personCount: 1, mainMealMode: MAIN_MEAL_MODES.SAME_LUNCH_AND_DINNER };
    const shoppingList = buildShoppingList(plan, settings);
    assert.equal(findLine(shoppingList, 'spaghetti').neededQuantity, 200);
    assert.equal(findLine(shoppingList, 'flocons-avoine').neededQuantity, 50);
    assert.equal(shoppingList.portionCount, 3);
  });

  it('exclut les basiques du placard du total quand on les possède déjà', () => {
    const plan = { mainRecipeIds: ['spaghetti-bolognaise'], breakfastRecipeIds: [] };
    const withPantry = buildShoppingList(plan, { ...baseSettings, pantryStaplesOwned: true });
    const withoutPantry = buildShoppingList(plan, { ...baseSettings, pantryStaplesOwned: false });
    assert.ok(withPantry.pantryLines.length > 0);
    assert.ok(withoutPantry.totalToPay > withPantry.totalToPay);
    assert.ok(withPantry.consumedValue <= withPantry.totalToPay);
  });
});

describe('réglages et formatage', () => {
  it('borne les valeurs saisies', () => {
    const settings = normalizeSettings({ personCount: '40', dayCount: '0', diet: 'inconnu', weeklyBudget: 'abc', mainMealMode: 'x' });
    assert.equal(settings.personCount, 8);
    assert.equal(settings.dayCount, 1);
    assert.equal(settings.diet, DIETS.OMNIVORE);
    assert.equal(settings.weeklyBudget, 0);
    assert.equal(settings.mainMealMode, MAIN_MEAL_MODES.SAME_LUNCH_AND_DINNER);
  });

  it('accorde les pièces au pluriel', () => {
    const eggs = PRODUCTS_BY_ID.get('oeuf');
    assert.equal(formatProductQuantity(eggs, 1), '1 œuf');
    assert.equal(formatProductQuantity(eggs, 3), '3 œufs');
    assert.equal(formatProductQuantity(PRODUCTS_BY_ID.get('riz'), 1500), '1,5 kg riz basmati');
  });
});

describe('photos', () => {
  it('a une photo pour chaque recette', () => {
    for (const recipe of RECIPES) {
      const photoPath = fileURLToPath(new URL(`../images/recettes/${recipe.id}.webp`, import.meta.url));
      assert.ok(existsSync(photoPath), `photo manquante : ${recipe.id}`);
    }
  });
});
