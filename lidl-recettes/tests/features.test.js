import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { PRODUCTS } from '../js/catalog.js';
import { findStepMinutes } from '../js/cook-mode.js';
import { computeDailyProteinTarget, getPortionProtein, GOALS } from '../js/nutrition.js';
import { PROTEIN_BY_PRODUCT_ID } from '../js/nutrition-facts.js';
import { generatePlan, PLAN_KINDS, swapMeal } from '../js/planner.js';
import {
  clearDisliked,
  EMPTY_PREFERENCES,
  markDisliked,
  normalizePreferences,
  rememberWeek,
  toggleLiked,
} from '../js/preferences.js';
import { RECIPES_BY_ID } from '../js/recipes.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../js/settings.js';
import { buildShoppingList } from '../js/shopping-list.js';
import { computeNextStock, describeStock, normalizeStock } from '../js/stock.js';
import { addWeightEntry, analyzeWeightTrend, normalizeWeightLog, TREND_STATUSES } from '../js/weight-log.js';

function createSeededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const defaultSettings = normalizeSettings(DEFAULT_SETTINGS);

function countAppearances(recipeId, settings, weekCount = 60) {
  let appearances = 0;
  for (let seed = 0; seed < weekCount; seed += 1) {
    if (generatePlan(settings, createSeededRandom(seed + 300)).mainRecipeIds.includes(recipeId)) {
      appearances += 1;
    }
  }
  return appearances;
}

describe('préférences de plats', () => {
  it('ne propose plus jamais un plat écarté, ni à la génération ni avec « Changer »', () => {
    const plan = generatePlan(defaultSettings, createSeededRandom(1));
    const dislikedId = plan.mainRecipeIds[0];
    const settings = { ...defaultSettings, preferences: markDisliked(EMPTY_PREFERENCES, dislikedId) };
    for (let seed = 0; seed < 30; seed += 1) {
      assert.ok(!generatePlan(settings, createSeededRandom(seed)).mainRecipeIds.includes(dislikedId));
    }
    const swappedPlan = swapMeal(plan, PLAN_KINDS.MAIN, 0, settings, createSeededRandom(2));
    assert.notEqual(swappedPlan.mainRecipeIds[0], dislikedId);
  });

  it('sert plus souvent un plat aimé', () => {
    const recipeId = 'curry-lentilles-express';
    const liked = { ...defaultSettings, preferences: toggleLiked(EMPTY_PREFERENCES, recipeId) };
    assert.ok(countAppearances(recipeId, liked) > countAppearances(recipeId, defaultSettings));
  });

  it('évite les plats des semaines précédentes', () => {
    const lastWeek = generatePlan(defaultSettings, createSeededRandom(3));
    const settings = { ...defaultSettings, preferences: rememberWeek(EMPTY_PREFERENCES, lastWeek.mainRecipeIds) };
    let repeatedWithHistory = 0;
    let repeatedWithoutHistory = 0;
    for (let seed = 0; seed < 30; seed += 1) {
      repeatedWithHistory += generatePlan(settings, createSeededRandom(seed + 400)).mainRecipeIds
        .filter((recipeId) => lastWeek.mainRecipeIds.includes(recipeId)).length;
      repeatedWithoutHistory += generatePlan(defaultSettings, createSeededRandom(seed + 400)).mainRecipeIds
        .filter((recipeId) => lastWeek.mainRecipeIds.includes(recipeId)).length;
    }
    assert.ok(repeatedWithHistory < repeatedWithoutHistory, `${repeatedWithHistory} >= ${repeatedWithoutHistory}`);
  });

  it('bascule entre aimé et écarté, et réautorise les plats écartés', () => {
    const liked = toggleLiked(EMPTY_PREFERENCES, 'carbonara');
    assert.deepEqual(liked.liked, ['carbonara']);
    const disliked = markDisliked(liked, 'carbonara');
    assert.deepEqual(disliked.liked, []);
    assert.deepEqual(disliked.disliked, ['carbonara']);
    assert.deepEqual(clearDisliked(disliked).disliked, []);
    assert.deepEqual(toggleLiked(liked, 'carbonara').liked, []);
  });

  it('nettoie des préférences enregistrées abîmées ou obsolètes', () => {
    const preferences = normalizePreferences({ liked: ['carbonara', 'recette-supprimee', 'carbonara'], disliked: 'x' }, RECIPES_BY_ID);
    assert.deepEqual(preferences, { liked: ['carbonara'], disliked: [], recent: [] });
    assert.deepEqual(normalizePreferences(null, RECIPES_BY_ID), { liked: [], disliked: [], recent: [] });
  });

  it('ne garde que les deux dernières semaines dans l’historique', () => {
    let preferences = EMPTY_PREFERENCES;
    for (let seed = 0; seed < 4; seed += 1) {
      preferences = rememberWeek(preferences, generatePlan(defaultSettings, createSeededRandom(seed + 500)).mainRecipeIds);
    }
    assert.ok(preferences.recent.length <= 14);
  });
});

describe('protéines', () => {
  it('connaît les protéines de chaque produit', () => {
    for (const product of PRODUCTS) {
      assert.ok(PROTEIN_BY_PRODUCT_ID[product.id] !== undefined, `protéines manquantes : ${product.id}`);
    }
  });

  it('calcule l’objectif sur le poids de référence au-delà d’un IMC de 25', () => {
    assert.equal(computeDailyProteinTarget({ ...defaultSettings, weightKg: 85, heightCm: 178 }), 127);
    assert.equal(computeDailyProteinTarget({ ...defaultSettings, weightKg: 70, heightCm: 178 }), 112);
    assert.equal(computeDailyProteinTarget({ ...defaultSettings, goal: GOALS.NONE }), null);
  });

  it('compte les protéines d’une portion', () => {
    assert.ok(getPortionProtein('poulet-haricots-verts-riz', defaultSettings) > getPortionProtein('soupe-legumes-express', defaultSettings));
  });
});

describe('suivi du poids', () => {
  it('garde une pesée par jour, triée, et écarte les valeurs invalides', () => {
    const weightLog = normalizeWeightLog([
      { date: '2026-10-05', kg: 84.26 }, { date: '2026-09-28', kg: 85 }, { date: '2026-10-05', kg: 84.1 },
      { date: 'hier', kg: 80 }, { date: '2026-10-01', kg: 12 }, null,
    ]);
    assert.deepEqual(weightLog, [{ date: '2026-09-28', kg: 85 }, { date: '2026-10-05', kg: 84.1 }]);
    assert.deepEqual(addWeightEntry(weightLog, '2026-10-05', 83.9).at(-1), { date: '2026-10-05', kg: 83.9 });
    assert.deepEqual(normalizeWeightLog('abîmé'), []);
  });

  it('demande plus de pesées tant qu’il n’y a pas une semaine de recul', () => {
    const analysis = analyzeWeightTrend([{ date: '2026-09-28', kg: 85 }, { date: '2026-09-30', kg: 84.8 }], '2026-09-30');
    assert.equal(analysis.status, TREND_STATUSES.NOT_ENOUGH_DATA);
  });

  it('reconnaît un bon rythme, une perte trop rapide, une stagnation et une prise', () => {
    const weeks = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'];
    const trend = (weights) => analyzeWeightTrend(weeks.map((date, index) => ({ date, kg: weights[index] })), '2026-09-28');
    assert.equal(trend([86, 85.5, 85, 84.5]).status, TREND_STATUSES.ON_TRACK);
    assert.equal(trend([88, 86.5, 85, 83.5]).status, TREND_STATUSES.TOO_FAST);
    assert.equal(trend([85, 85, 84.9, 85]).status, TREND_STATUSES.STALLED);
    assert.equal(trend([84, 84.5, 85, 85.5]).status, TREND_STATUSES.GAINING);
    assert.equal(trend([86, 85.5, 85, 84.5]).weeklyChangeKg, -0.5);
  });

  it('accepte un poids avec une décimale dans le profil', () => {
    assert.equal(normalizeSettings({ ...DEFAULT_SETTINGS, weightKg: '84,64' }).weightKg, 84.6);
  });
});

describe('collation', () => {
  it('sert la même collation toute la semaine, et aucune si elle est désactivée', () => {
    const plan = generatePlan(defaultSettings, createSeededRandom(900));
    assert.equal(plan.snackRecipeIds.length, defaultSettings.dayCount);
    assert.equal(new Set(plan.snackRecipeIds).size, 1);
    assert.equal(RECIPES_BY_ID.get(plan.snackRecipeIds[0]).mealType, 'collation');
    assert.deepEqual(generatePlan({ ...defaultSettings, includeSnack: false }, createSeededRandom(901)).snackRecipeIds, []);
  });

  it('change la collation de toute la semaine d’un coup', () => {
    const plan = generatePlan(defaultSettings, createSeededRandom(902));
    const swappedPlan = swapMeal(plan, PLAN_KINDS.SNACK, 0, defaultSettings, createSeededRandom(903));
    assert.notEqual(swappedPlan.snackRecipeIds[0], plan.snackRecipeIds[0]);
    assert.equal(new Set(swappedPlan.snackRecipeIds).size, 1);
    assert.deepEqual(swappedPlan.mainRecipeIds, plan.mainRecipeIds);
  });

  it('ajoute la collation à la liste de courses', () => {
    const plan = { mainRecipeIds: [], breakfastRecipeIds: [], snackRecipeIds: Array(7).fill('collation-fromage-blanc') };
    const line = buildShoppingList(plan, defaultSettings).aisleGroups.flatMap((group) => group.lines)
      .find((shoppingLine) => shoppingLine.product.id === 'fromage-blanc');
    assert.equal(line.neededQuantity, 980);
    assert.equal(line.packageCount, 1);
  });
});

describe('restes reportés', () => {
  const pastaPlan = { mainRecipeIds: ['spaghetti-thon-tomate'], breakfastRecipeIds: [], snackRecipeIds: [] };
  const noGoal = { ...defaultSettings, goal: GOALS.NONE, mainMealMode: 'diner', includeBreakfast: false, includeSnack: false };

  it('déduit le stock des courses et le signale comme reste à utiliser', () => {
    const withoutStock = buildShoppingList(pastaPlan, noGoal);
    const withStock = buildShoppingList(pastaPlan, { ...noGoal, pantryStock: { spaghetti: 400 } });
    const spaghettiBought = withStock.aisleGroups.flatMap((group) => group.lines).some((line) => line.product.id === 'spaghetti');
    assert.equal(spaghettiBought, false);
    assert.ok(withStock.stockLines.some((line) => line.product.id === 'spaghetti'));
    assert.ok(withStock.totalToPay < withoutStock.totalToPay);
  });

  it('reporte les restes des seuls produits cochés, et seulement ceux qui se gardent', () => {
    const shoppingList = buildShoppingList(pastaPlan, noGoal);
    const nextStock = computeNextStock({ stock: {}, shoppingList, checkedProductIds: new Set(['spaghetti', 'oignon']) });
    assert.equal(nextStock.spaghetti, 400);
    assert.equal(nextStock.oignon, undefined);
    assert.deepEqual(computeNextStock({ stock: {}, shoppingList, checkedProductIds: new Set() }), {});
  });

  it('consomme le stock utilisé la semaine suivante', () => {
    const settings = { ...noGoal, pantryStock: { spaghetti: 400 } };
    const shoppingList = buildShoppingList(pastaPlan, settings);
    const nextStock = computeNextStock({ stock: settings.pantryStock, shoppingList, checkedProductIds: new Set(['thon']) });
    assert.equal(nextStock.spaghetti, 300);
  });

  it('écarte un stock enregistré abîmé ou des produits qui ne se gardent pas', () => {
    assert.deepEqual(normalizeStock({ spaghetti: 250, tomate: 500, riz: 'beaucoup', inconnu: 3 }), { spaghetti: 250 });
    assert.deepEqual(normalizeStock([1, 2]), {});
    assert.deepEqual(describeStock({ spaghetti: 250 }), { productCount: 1, value: 0.43 });
  });

  it('fait choisir des plats qui finissent le stock', () => {
    const stockSettings = { ...defaultSettings, pantryStock: { 'lentilles-corail': 500, semoule: 1000 } };
    let stockDishes = 0;
    let plainDishes = 0;
    const usesStock = (recipeId) => ['lentilles-corail', 'semoule'].some((productId) => productId in RECIPES_BY_ID.get(recipeId).ingredients);
    for (let seed = 0; seed < 30; seed += 1) {
      stockDishes += generatePlan(stockSettings, createSeededRandom(seed + 700)).mainRecipeIds.filter(usesStock).length;
      plainDishes += generatePlan(defaultSettings, createSeededRandom(seed + 700)).mainRecipeIds.filter(usesStock).length;
    }
    assert.ok(stockDishes > plainDishes, `${stockDishes} <= ${plainDishes}`);
  });
});

describe('mode cuisine', () => {
  it('trouve la durée d’une étape pour le minuteur', () => {
    assert.equal(findStepMinutes('Cuire le riz 12 min.'), 12);
    assert.equal(findStepMinutes('Dorer 3 min par face.'), 3);
    assert.equal(findStepMinutes('Servir chaud.'), null);
  });
});

describe('mode hors ligne', () => {
  it('met en cache tous les scripts et fichiers de l’appli', () => {
    const appDirectory = fileURLToPath(new URL('..', import.meta.url));
    const serviceWorkerSource = readFileSync(`${appDirectory}/sw.js`, 'utf8');
    const scriptFiles = readdirSync(`${appDirectory}/js`).map((fileName) => `js/${fileName}`);
    for (const requiredFile of ['index.html', 'styles.css', 'manifest.webmanifest', ...scriptFiles]) {
      assert.ok(serviceWorkerSource.includes(`'${requiredFile}'`), `absent du cache hors ligne : ${requiredFile}`);
    }
  });
});

describe('« Changer » varie vraiment', () => {
  it('propose des recettes différentes à chaque clic en retenant les précédentes', () => {
    let plan = generatePlan(defaultSettings, createSeededRandom(1000));
    const random = createSeededRandom(1001);
    const proposedIds = [];
    const avoidedRecipeIds = [];
    for (let click = 0; click < 10; click += 1) {
      avoidedRecipeIds.unshift(plan.mainRecipeIds[2]);
      plan = swapMeal(plan, PLAN_KINDS.MAIN, 2, defaultSettings, random, { avoidedRecipeIds });
      proposedIds.push(plan.mainRecipeIds[2]);
    }
    assert.equal(new Set(proposedIds).size, 10);
  });

  it('ne tourne pas sur deux recettes même sans historique', () => {
    let distinctTotal = 0;
    for (let trial = 0; trial < 20; trial += 1) {
      let plan = generatePlan(defaultSettings, createSeededRandom(trial + 1100));
      const random = createSeededRandom(trial + 1200);
      const proposedIds = new Set();
      for (let click = 0; click < 10; click += 1) {
        plan = swapMeal(plan, PLAN_KINDS.MAIN, 2, defaultSettings, random);
        proposedIds.add(plan.mainRecipeIds[2]);
      }
      distinctTotal += proposedIds.size;
    }
    assert.ok(distinctTotal / 20 >= 5, `${distinctTotal / 20} recettes différentes en moyenne`);
  });

  it('fait aussi tourner le petit-déjeuner et la collation', () => {
    let plan = generatePlan(defaultSettings, createSeededRandom(1300));
    const random = createSeededRandom(1301);
    const proposedIds = [];
    const avoidedRecipeIds = [];
    for (let click = 0; click < 5; click += 1) {
      avoidedRecipeIds.unshift(plan.snackRecipeIds[0]);
      plan = swapMeal(plan, PLAN_KINDS.SNACK, 0, defaultSettings, random, { avoidedRecipeIds });
      proposedIds.push(plan.snackRecipeIds[0]);
    }
    assert.equal(new Set(proposedIds).size, 5);
  });
});
