import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AISLE_ORDER, AISLES } from '../js/catalog.js';
import { DIETS, generatePlan, PLAN_KINDS, reconcilePlan, restorePlan, swapMeal } from '../js/planner.js';
import { EMPTY_PREFERENCES, markDisliked } from '../js/preferences.js';
import { addExtraItem, keepUnboughtExtraItems, normalizeExtraItems, removeExtraItem } from '../js/extra-items.js';
import { buildShoppingListText } from '../js/list-text.js';
import { RECIPES_BY_ID } from '../js/recipes.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../js/settings.js';
import { buildShoppingList } from '../js/shopping-list.js';
import {
  AISLE_MOVES,
  DEFAULT_STORE_SETUP,
  hasCustomAisleOrder,
  moveAisle,
  normalizeStoreSetup,
  resetAisleOrder,
  toggleMissingProduct,
} from '../js/store-setup.js';

function createSeededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const defaultSettings = normalizeSettings(DEFAULT_SETTINGS);

describe('reprise de la semaine enregistrée', () => {
  it('garde tous les plats, même si une mise à jour les rendrait refusés ou trop chers', () => {
    const savedPlan = generatePlan(defaultSettings, createSeededRandom(7));
    // Plat de 35 min alors que la limite est de 20 min, et budget impossible à tenir.
    savedPlan.mainRecipeIds[0] = 'spaghetti-bolognaise';
    const restoredPlan = restorePlan(savedPlan, { ...defaultSettings, weeklyBudget: 5 }, createSeededRandom(8));
    assert.deepEqual(restoredPlan.mainRecipeIds, savedPlan.mainRecipeIds);
    assert.deepEqual(restoredPlan.breakfastRecipeIds, savedPlan.breakfastRecipeIds);
    assert.deepEqual(restoredPlan.snackRecipeIds, savedPlan.snackRecipeIds);
  });

  it('remplace seulement un plat qui n’existe plus', () => {
    const savedPlan = generatePlan(defaultSettings, createSeededRandom(9));
    savedPlan.mainRecipeIds[2] = 'recette-supprimee';
    const restoredPlan = restorePlan(savedPlan, defaultSettings, createSeededRandom(10));
    assert.equal(restoredPlan.mainRecipeIds.length, savedPlan.mainRecipeIds.length);
    assert.notEqual(restoredPlan.mainRecipeIds[2], 'recette-supprimee');
    restoredPlan.mainRecipeIds.forEach((recipeId, slotIndex) => {
      if (slotIndex !== 2) {
        assert.equal(recipeId, savedPlan.mainRecipeIds[slotIndex]);
      }
    });
  });
});

describe('mon magasin', () => {
  it('répare un réglage enregistré abîmé ou incomplet', () => {
    const repaired = normalizeStoreSetup({ aisleOrder: [AISLES.FROZEN, 'Rayon inconnu', AISLES.FROZEN], missingProductIds: ['tofu', 'inconnu', 'tofu'] });
    assert.equal(repaired.aisleOrder[0], AISLES.FROZEN);
    assert.equal(repaired.aisleOrder.length, AISLE_ORDER.length);
    assert.deepEqual([...repaired.aisleOrder].sort(), [...AISLE_ORDER].sort());
    assert.deepEqual(repaired.missingProductIds, ['tofu']);
    assert.deepEqual(normalizeStoreSetup(null), { aisleOrder: [...AISLE_ORDER], missingProductIds: [] });
  });

  it('déplace un rayon en sautant les rayons vides de la semaine', () => {
    const listedAisles = [AISLES.PRODUCE, AISLES.DAIRY, AISLES.FROZEN];
    const moved = moveAisle(DEFAULT_STORE_SETUP, AISLES.FROZEN, AISLE_MOVES.UP, listedAisles);
    assert.ok(moved.aisleOrder.indexOf(AISLES.FROZEN) < moved.aisleOrder.indexOf(AISLES.DAIRY));
    assert.ok(hasCustomAisleOrder(moved));
    assert.equal(moveAisle(DEFAULT_STORE_SETUP, AISLES.PRODUCE, AISLE_MOVES.UP, listedAisles), DEFAULT_STORE_SETUP);
    assert.equal(hasCustomAisleOrder(resetAisleOrder(moved)), false);
  });

  it('range la liste de courses dans l’ordre des rayons de mon magasin', () => {
    const plan = generatePlan(defaultSettings, createSeededRandom(11));
    const defaultAisles = buildShoppingList(plan, defaultSettings).aisleGroups.map((group) => group.aisle);
    const lastAisle = defaultAisles.at(-1);
    const storeSetup = moveAisle(DEFAULT_STORE_SETUP, lastAisle, AISLE_MOVES.UP, defaultAisles);
    const customAisles = buildShoppingList(plan, { ...defaultSettings, storeSetup }).aisleGroups.map((group) => group.aisle);
    assert.equal(customAisles.at(-2), lastAisle);
  });

  it('ne propose plus de plat avec un produit introuvable, ni à la génération ni avec « Changer »', () => {
    const storeSetup = toggleMissingProduct(DEFAULT_STORE_SETUP, 'oignon');
    const settings = { ...defaultSettings, storeSetup };
    const usesOnion = (recipeId) => 'oignon' in RECIPES_BY_ID.get(recipeId).ingredients;
    for (let seed = 0; seed < 20; seed += 1) {
      const plan = generatePlan(settings, createSeededRandom(seed + 40));
      assert.equal(plan.mainRecipeIds.some(usesOnion), false);
      const swappedPlan = swapMeal(plan, PLAN_KINDS.MAIN, 0, settings, createSeededRandom(seed + 90));
      assert.equal(usesOnion(swappedPlan.mainRecipeIds[0]), false);
    }
    assert.deepEqual(toggleMissingProduct(storeSetup, 'oignon').missingProductIds, []);
  });

  it('garde les plats de la semaine en cours quand un produit devient introuvable', () => {
    const plan = generatePlan(defaultSettings, createSeededRandom(12));
    const missingProductId = Object.keys(RECIPES_BY_ID.get(plan.mainRecipeIds[0]).ingredients)[0];
    const settings = { ...defaultSettings, storeSetup: toggleMissingProduct(DEFAULT_STORE_SETUP, missingProductId) };
    assert.deepEqual(restorePlan(plan, settings, createSeededRandom(13)).mainRecipeIds, plan.mainRecipeIds);
    assert.deepEqual(reconcilePlan(plan, settings, createSeededRandom(14)).mainRecipeIds, plan.mainRecipeIds);
  });
});

describe('peu de recettes compatibles', () => {
  const fewRecipesSettings = normalizeSettings({
    ...DEFAULT_SETTINGS,
    diet: DIETS.VEGETARIAN,
    maxPrepMinutes: 15,
    sex: 'femme',
    weightKg: 60,
    heightCm: 160,
    mainMealMode: 'midi-soir-differents',
  });

  it('« Changer » change quand même le plat, quitte à reprendre un plat d’un autre jour', () => {
    for (let seed = 0; seed < 10; seed += 1) {
      const plan = generatePlan(fewRecipesSettings, createSeededRandom(seed + 500));
      const swappedPlan = swapMeal(plan, PLAN_KINDS.MAIN, 0, fewRecipesSettings, createSeededRandom(seed + 600));
      assert.notEqual(swappedPlan.mainRecipeIds[0], plan.mainRecipeIds[0]);
    }
  });

  it('« Pas pour moi » retire le plat de tous les jours où il apparaît', () => {
    const plan = generatePlan(fewRecipesSettings, createSeededRandom(700));
    const dislikedId = plan.mainRecipeIds[0];
    const settings = { ...fewRecipesSettings, preferences: markDisliked(EMPTY_PREFERENCES, dislikedId) };
    const reconciledPlan = reconcilePlan(plan, settings, createSeededRandom(701));
    assert.equal(reconciledPlan.mainRecipeIds.includes(dislikedId), false);
    assert.equal(reconciledPlan.mainRecipeIds.filter(Boolean).length, plan.mainRecipeIds.length);
  });
});

describe('articles ajoutés à la main', () => {
  it('range un produit du catalogue dans son rayon avec son prix, un texte libre dans « Autres articles »', () => {
    const extraItems = addExtraItem(addExtraItem([], '  oignons jaunes '), 'Lessive');
    const plan = generatePlan(defaultSettings, createSeededRandom(800));
    const withoutExtras = buildShoppingList(plan, defaultSettings);
    const withExtras = buildShoppingList(plan, { ...defaultSettings, extraItems });
    const extraLines = withExtras.aisleGroups.flatMap((group) => group.extraLines.map((line) => ({ aisle: group.aisle, line })));
    const onionLine = extraLines.find(({ line }) => line.product?.id === 'oignon');
    const detergentLine = extraLines.find(({ line }) => line.extra.label === 'Lessive');
    assert.equal(onionLine.aisle, AISLES.PRODUCE);
    assert.equal(onionLine.line.extra.label, 'Oignons jaunes');
    assert.equal(detergentLine.aisle, AISLES.OTHER);
    assert.equal(detergentLine.line.cost, 0);
    assert.equal(withExtras.totalToPay, Math.round((withoutExtras.totalToPay + onionLine.line.cost) * 100) / 100);
    assert.equal(withExtras.costPerPortion, withoutExtras.costPerPortion);
    assert.equal(withExtras.aisleGroups.at(-1).aisle === AISLES.OTHER, !withExtras.aisleGroups.some((group) => group.aisle === AISLES.FROZEN));
    const listText = buildShoppingListText(withExtras, defaultSettings, new Date(2026, 9, 5));
    assert.ok(listText.includes('Lessive') && listText.includes('Oignons jaunes'));
  });

  it('augmente la quantité au lieu de doubler la ligne, et ignore un texte vide', () => {
    const twice = addExtraItem(addExtraItem([], 'Lessive'), 'lessive');
    assert.equal(twice.length, 1);
    assert.equal(twice[0].packageCount, 2);
    assert.equal(addExtraItem(twice, '   '), twice);
    assert.deepEqual(removeExtraItem(twice, twice[0].id), []);
  });

  it('garde pour la semaine suivante les articles ajoutés pas encore achetés', () => {
    const extraItems = addExtraItem(addExtraItem([], 'Lessive'), 'Éponges');
    const kept = keepUnboughtExtraItems(extraItems, new Set([extraItems[0].id]));
    assert.deepEqual(kept.map((item) => item.label), ['Éponges']);
  });

  it('répare des ajouts enregistrés abîmés', () => {
    const repaired = normalizeExtraItems([{ id: 'extra-a', label: ' Lessive ', packageCount: 99 }, { id: 'x', label: 'Pirate' }, null, { id: 'extra-b', label: '' }]);
    assert.deepEqual(repaired, [{ id: 'extra-a', label: 'Lessive', productId: null, packageCount: 20 }]);
    assert.deepEqual(normalizeExtraItems('abîmé'), []);
  });
});
