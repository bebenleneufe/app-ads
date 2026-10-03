import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PRODUCTS_BY_ID } from '../js/catalog.js';
import { buildEatenPlan, isMealCooked, listCookedSlotIndexes, normalizeCookedMeals, setMealCooked } from '../js/cooked-meals.js';
import { formatProductQuantity, formatQuantity } from '../js/format.js';
import { computeCookedQuantity } from '../js/nutrition.js';
import { generatePlan } from '../js/planner.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../js/settings.js';
import { buildShoppingList } from '../js/shopping-list.js';
import { computeNextStock } from '../js/stock.js';

function createSeededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const defaultSettings = normalizeSettings(DEFAULT_SETTINGS);

describe('quantités à la pièce', () => {
  it('arrondit au demi supérieur par plat cuisiné, sans toucher aux grammes', () => {
    assert.equal(computeCookedQuantity('poivron', 0.33, 2), 1);
    assert.equal(computeCookedQuantity('salade', 0.15, 2), 0.5);
    assert.equal(computeCookedQuantity('brocoli', 0.4, 2), 1);
    assert.equal(computeCookedQuantity('oeuf', 2, 2), 4);
    assert.equal(computeCookedQuantity('pate-brisee', 0.25, 2), 0.5);
    assert.equal(computeCookedQuantity('riz', 75, 2), 150);
  });

  it('écrit « ½ » et « 1 ½ » plutôt que des décimales', () => {
    const pepper = PRODUCTS_BY_ID.get('poivron');
    assert.equal(formatProductQuantity(pepper, 0.5), '½ poivron');
    assert.equal(formatProductQuantity(pepper, 1.5), '1 ½ poivrons');
    assert.equal(formatProductQuantity(pepper, 2), '2 poivrons');
    assert.equal(formatQuantity(2.5, 'pièce'), '2 ½ pc');
  });

  it('ne laisse aucune fraction de pièce dans la liste de courses', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const shoppingList = buildShoppingList(generatePlan(defaultSettings, createSeededRandom(seed + 900)), defaultSettings);
      for (const line of shoppingList.aisleGroups.flatMap((group) => group.lines)) {
        if (line.product.unit === 'pièce') {
          assert.equal(Number.isInteger(line.neededQuantity * 2), true, `${line.product.id} : ${line.neededQuantity}`);
        }
      }
    }
  });
});

describe('plats cuisinés', () => {
  const plan = { mainRecipeIds: ['dahl-lentilles', 'chili-con-carne', 'wok-tofu'], breakfastRecipeIds: [], snackRecipeIds: [] };

  it('coche et décoche un plat, et oublie la marque si le plat du créneau change', () => {
    const cooked = setMealCooked({}, plan, 1, true);
    assert.equal(isMealCooked(cooked, plan, 1), true);
    assert.deepEqual(listCookedSlotIndexes(cooked, plan), [1]);
    const swappedPlan = { ...plan, mainRecipeIds: ['dahl-lentilles', 'wok-tofu', 'wok-tofu'] };
    assert.equal(isMealCooked(cooked, swappedPlan, 1), false);
    assert.deepEqual(setMealCooked(cooked, plan, 1, false), {});
  });

  it('répare des marques enregistrées abîmées', () => {
    assert.deepEqual(normalizeCookedMeals({ 2: 'wok-tofu', x: 'dahl-lentilles', 3: 7 }), { 2: 'wok-tofu' });
    assert.deepEqual(normalizeCookedMeals([1, 2]), {});
  });

  it('sans plat coché, suppose toute la semaine mangée ; sinon seulement les plats cuisinés', () => {
    assert.equal(buildEatenPlan(plan, {}), plan);
    const eatenPlan = buildEatenPlan(plan, setMealCooked({}, plan, 0, true));
    assert.deepEqual(eatenPlan.mainRecipeIds, ['dahl-lentilles', null, null]);
  });

  it('garde en stock les ingrédients des plats jamais cuisinés', () => {
    const weekPlan = generatePlan(defaultSettings, createSeededRandom(950));
    const shoppingList = buildShoppingList(weekPlan, defaultSettings);
    const checkedProductIds = new Set(shoppingList.aisleGroups.flatMap((group) => group.lines.map((line) => line.product.id)));
    const allEatenStock = computeNextStock({ stock: {}, shoppingList, checkedProductIds });
    const oneDishCooked = setMealCooked({}, weekPlan, 0, true);
    const eatenShoppingList = buildShoppingList(buildEatenPlan(weekPlan, oneDishCooked), defaultSettings);
    const partlyEatenStock = computeNextStock({ stock: {}, shoppingList, checkedProductIds, eatenShoppingList });
    const totalStock = (stock) => Object.values(stock).reduce((total, quantity) => total + quantity, 0);
    assert.ok(totalStock(partlyEatenStock) > totalStock(allEatenStock));
  });
});
