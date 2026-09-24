import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { debounce } from '../js/dom.js';
import { MAIN_MEAL_MODES } from '../js/meal-structure.js';
import { GOALS } from '../js/nutrition.js';
import { generatePlan, PLAN_KINDS, reconcilePlan, swapMeal } from '../js/planner.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../js/settings.js';
import { buildShoppingList, computePortionCost } from '../js/shopping-list.js';
import { resolveWeekStart, toIsoDate } from '../js/week.js';

function createSeededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const defaultSettings = normalizeSettings(DEFAULT_SETTINGS);

describe('budget appliqué partout', () => {
  it('réajuste la semaine au budget quand le nombre de personnes augmente', () => {
    const plan = generatePlan({ ...defaultSettings, weeklyBudget: 35 }, createSeededRandom(1));
    const threePeople = { ...defaultSettings, personCount: 3 };
    const withoutBudget = buildShoppingList(reconcilePlan(plan, { ...threePeople, weeklyBudget: 0 }, createSeededRandom(2)), threePeople);
    const withBudgetSettings = { ...threePeople, weeklyBudget: 35 };
    const withBudget = buildShoppingList(reconcilePlan(plan, withBudgetSettings, createSeededRandom(2)), withBudgetSettings);
    assert.ok(withBudget.totalToPay < withoutBudget.totalToPay, `${withBudget.totalToPay} >= ${withoutBudget.totalToPay}`);
  });

  it('ne fait pas dépasser le budget avec « Changer » quand un remplaçant abordable existe', () => {
    const settings = { ...defaultSettings, weeklyBudget: 40 };
    for (let seed = 0; seed < 10; seed += 1) {
      const plan = generatePlan(settings, createSeededRandom(seed + 10));
      if (buildShoppingList(plan, settings).totalToPay > settings.weeklyBudget) {
        continue;
      }
      const swappedPlan = swapMeal(plan, PLAN_KINDS.MAIN, 3, settings, createSeededRandom(seed + 50));
      assert.ok(buildShoppingList(swappedPlan, settings).totalToPay <= settings.weeklyBudget, `graine ${seed}`);
    }
  });

  it('reste rapide même avec un budget impossible à tenir', () => {
    const settings = { ...defaultSettings, weeklyBudget: 5, mainMealMode: MAIN_MEAL_MODES.DIFFERENT_LUNCH_AND_DINNER };
    const startTime = performance.now();
    generatePlan(settings, createSeededRandom(3));
    assert.ok(performance.now() - startTime < 1000);
  });
});

describe('les plats restent sur leur jour', () => {
  it('garde le déjeuner de chaque jour en passant de deux plats à un seul', () => {
    const twoDishes = { ...defaultSettings, goal: GOALS.NONE, mainMealMode: MAIN_MEAL_MODES.DIFFERENT_LUNCH_AND_DINNER };
    const plan = generatePlan(twoDishes, createSeededRandom(4));
    const oneDish = { ...twoDishes, mainMealMode: MAIN_MEAL_MODES.SAME_LUNCH_AND_DINNER };
    const reconciledPlan = reconcilePlan(plan, oneDish, createSeededRandom(5));
    reconciledPlan.mainRecipeIds.forEach((recipeId, dayIndex) => {
      assert.equal(recipeId, plan.mainRecipeIds[dayIndex * 2], `jour ${dayIndex + 1}`);
    });
  });

  it('garde le plat de chaque jour en passant à deux plats différents', () => {
    const oneDish = { ...defaultSettings, goal: GOALS.NONE };
    const plan = generatePlan(oneDish, createSeededRandom(6));
    const twoDishes = { ...oneDish, mainMealMode: MAIN_MEAL_MODES.DIFFERENT_LUNCH_AND_DINNER };
    const reconciledPlan = reconcilePlan(plan, twoDishes, createSeededRandom(7));
    plan.mainRecipeIds.forEach((recipeId, dayIndex) => {
      assert.equal(reconciledPlan.mainRecipeIds[dayIndex * 2], recipeId, `jour ${dayIndex + 1}`);
    });
  });
});

describe('prix des cartes aligné sur le ticket', () => {
  it('ne compte pas l’huile et les épices quand on les a déjà', () => {
    const owned = computePortionCost('spaghetti-bolognaise', { ...defaultSettings, pantryStaplesOwned: true });
    const notOwned = computePortionCost('spaghetti-bolognaise', { ...defaultSettings, pantryStaplesOwned: false });
    assert.ok(owned < notOwned);
  });
});

describe('données enregistrées abîmées', () => {
  it('repart des réglages par défaut au lieu de planter', () => {
    for (const brokenSettings of [null, undefined, 'texte', 42, []]) {
      assert.equal(normalizeSettings(brokenSettings).personCount, DEFAULT_SETTINGS.personCount);
    }
  });

  it('reconstruit une semaine à partir d’un plan incomplet', () => {
    const plan = reconcilePlan({ mainRecipeIds: 'abîmé', breakfastRecipeIds: null }, defaultSettings, createSeededRandom(8));
    assert.equal(plan.mainRecipeIds.length, defaultSettings.dayCount);
    assert.equal(plan.breakfastRecipeIds.length, defaultSettings.dayCount);
  });
});

describe('date de la semaine', () => {
  it('garde la date enregistrée pendant la semaine en cours', () => {
    const wednesday = new Date(2026, 8, 30);
    assert.equal(toIsoDate(resolveWeekStart('2026-09-28', wednesday)), '2026-09-28');
  });

  it('passe à la semaine suivante une fois la semaine enregistrée terminée', () => {
    const nextTuesday = new Date(2026, 9, 6);
    assert.equal(toIsoDate(resolveWeekStart('2026-09-28', nextTuesday)), '2026-10-12');
  });

  it('ignore une date invalide', () => {
    const sunday = new Date(2026, 8, 27);
    assert.equal(toIsoDate(resolveWeekStart('2026-02-31', sunday)), '2026-09-28');
    assert.equal(toIsoDate(resolveWeekStart(null, sunday)), '2026-09-28');
  });
});

describe('saisie en attente', () => {
  it('applique immédiatement une saisie en attente, une seule fois', () => {
    const receivedValues = [];
    const debouncedCallback = debounce((value) => receivedValues.push(value), 10_000);
    debouncedCallback.run(3);
    debouncedCallback.flush();
    debouncedCallback.flush();
    assert.deepEqual(receivedValues, [3]);
  });
});
