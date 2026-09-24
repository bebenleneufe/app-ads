import { PRODUCTS_BY_ID } from './catalog.js';
import { createElement, replaceChildrenWithFragment } from './dom.js';
import {
  formatDayMonth,
  formatEuros,
  formatFullDate,
  formatProductQuantity,
  formatQuantity,
} from './format.js';
import {
  getMainSlotCount,
  getMainSlotLabels,
  getMainSlotsPerDay,
  getMealsEatenPerDay,
  getServingsPerBreakfast,
  getServingsPerMainRecipe,
  getServingsPerMainSlot,
} from './meal-structure.js';
import {
  computeDailyTargetKcal,
  computeMaintenanceKcal,
  computeMealTargetKcal,
  getPortionKcal,
  getPortionQuantities,
  hasWeightLossGoal,
} from './nutrition.js';
import { PLAN_KINDS } from './planner.js';
import { computePortionCost } from './shopping-list.js';
import { CATEGORY_LABELS, countFreshIngredients, MEAL_TYPES, RECIPES_BY_ID } from './recipes.js';

const DAY_NAMES = Object.freeze(['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']);
const BREAKFAST_LABEL = 'Petit-déjeuner';
const RECIPE_PHOTO_DIRECTORY = 'images/recettes';
const KCAL_FORMATTER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function formatKcal(kcal) {
  return `${KCAL_FORMATTER.format(kcal)} kcal`;
}

function addDays(date, dayOffset) {
  const shiftedDate = new Date(date);
  shiftedDate.setDate(shiftedDate.getDate() + dayOffset);
  return shiftedDate;
}

export function describeWeek(settings) {
  return `${settings.dayCount} j · ${getMealsEatenPerDay(settings)} repas/jour · ${settings.personCount} pers.`;
}

function buildRecipeDetails(recipe, servingCount, settings) {
  const ingredientItems = getPortionQuantities(recipe.id, settings).map(([productId, quantityPerServing]) => {
    const product = PRODUCTS_BY_ID.get(productId);
    return createElement('li', { text: formatProductQuantity(product, quantityPerServing * servingCount) });
  });
  const stepItems = recipe.steps.map((step) => createElement('li', { text: step }));
  const portionWord = servingCount > 1 ? 'portions' : 'portion';
  return createElement('details', { className: 'meal-details' }, [
    createElement('summary', { text: `Ingrédients pour ${servingCount} ${portionWord} et étapes` }),
    createElement('ul', { className: 'ingredient-list' }, ingredientItems),
    createElement('ol', { className: 'step-list' }, stepItems),
  ]);
}

function buildMealFacts(recipe, settings) {
  const facts = [
    `${recipe.prepMinutes} min`,
    `${countFreshIngredients(recipe)} ingr.`,
    formatKcal(getPortionKcal(recipe.id, settings)),
    formatEuros(computePortionCost(recipe.id, settings)),
  ];
  return createElement('ul', { className: 'meal-facts', attributes: { 'aria-label': 'Par portion' } },
    facts.map((fact) => createElement('li', { text: fact })));
}

// Le nom du plat est déjà le titre de la carte : la photo est décorative (alt vide).
function buildMealPhoto(recipe) {
  return createElement('img', {
    className: 'meal-photo',
    attributes: {
      src: `${RECIPE_PHOTO_DIRECTORY}/${recipe.id}.webp`,
      alt: '',
      width: '480',
      height: '320',
      loading: 'lazy',
      decoding: 'async',
    },
  });
}

function buildMealCard({ recipe, kind, slotIndex, slotLabel, servingCount, settings }) {
  const isBreakfast = kind === PLAN_KINDS.BREAKFAST;
  return createElement('article', {
    className: isBreakfast ? 'meal is-breakfast' : 'meal',
    attributes: { 'data-category': recipe.category },
  }, [
    buildMealPhoto(recipe),
    createElement('div', { className: 'meal-head' }, [
      createElement('p', { className: 'meal-slot', text: slotLabel }),
      createElement('button', {
        className: 'swap-button',
        text: 'Changer',
        attributes: {
          type: 'button',
          'data-action': 'swap',
          'data-plan-kind': kind,
          'data-slot-index': String(slotIndex),
          'aria-label': `Changer : ${recipe.name}`,
        },
      }),
    ]),
    createElement('h4', { className: 'meal-name', text: recipe.name }),
    createElement('p', { className: 'meal-tag', text: CATEGORY_LABELS[recipe.category] }),
    buildMealFacts(recipe, settings),
    buildRecipeDetails(recipe, servingCount, settings),
  ]);
}

function computeEatenKcal(breakfastRecipe, mainRecipes, settings) {
  const breakfastKcal = breakfastRecipe ? getPortionKcal(breakfastRecipe.id, settings) : 0;
  const mainKcal = mainRecipes
    .filter(Boolean)
    .reduce((kcalSum, recipe) => kcalSum + getPortionKcal(recipe.id, settings) * getServingsPerMainRecipe(settings), 0);
  return breakfastKcal + mainKcal;
}

function buildDayKcal(breakfastRecipe, mainRecipes, settings) {
  if (!hasWeightLossGoal(settings)) {
    return null;
  }
  const eatenKcal = computeEatenKcal(breakfastRecipe, mainRecipes, settings);
  const dailyTargetKcal = computeDailyTargetKcal(settings);
  const fillElement = createElement('span', { className: 'kcal-fill' });
  fillElement.style.inlineSize = `${Math.min(100, Math.round((eatenKcal / dailyTargetKcal) * 100))}%`;
  return createElement('div', {
    className: eatenKcal > dailyTargetKcal ? 'day-kcal is-over' : 'day-kcal',
  }, [
    createElement('span', {
      className: 'kcal-bar',
      attributes: { role: 'img', 'aria-label': `${formatKcal(eatenKcal)} sur un objectif de ${formatKcal(dailyTargetKcal)}` },
    }, [fillElement]),
    createElement('span', { className: 'kcal-text', text: `${KCAL_FORMATTER.format(eatenKcal)} / ${formatKcal(dailyTargetKcal)}` }),
  ]);
}

function buildDayItem(dayIndex, plan, settings, weekStartDate) {
  const mainSlotsPerDay = getMainSlotsPerDay(settings);
  const servingCount = getServingsPerMainSlot(settings);
  const breakfastRecipe = RECIPES_BY_ID.get(plan.breakfastRecipeIds[dayIndex]);
  const mainRecipes = getMainSlotLabels(settings)
    .map((_slotLabel, mealIndex) => RECIPES_BY_ID.get(plan.mainRecipeIds[dayIndex * mainSlotsPerDay + mealIndex]));

  const mainCards = getMainSlotLabels(settings).map((slotLabel, mealIndex) => {
    const recipe = mainRecipes[mealIndex];
    return recipe
      ? buildMealCard({
        recipe,
        kind: PLAN_KINDS.MAIN,
        slotIndex: dayIndex * mainSlotsPerDay + mealIndex,
        slotLabel,
        servingCount,
        settings,
      })
      : null;
  });

  return createElement('li', { className: 'day' }, [
    createElement('div', { className: 'day-head' }, [
      createElement('h3', { className: 'day-name' }, [
        createElement('span', { text: DAY_NAMES[dayIndex] }),
        createElement('span', { className: 'day-date', text: formatDayMonth(addDays(weekStartDate, dayIndex)) }),
      ]),
      buildDayKcal(breakfastRecipe, mainRecipes, settings),
    ]),
    createElement('div', { className: 'day-meals' }, mainCards),
  ]);
}

function buildWeeklyBreakfastItem(plan, settings) {
  const breakfastRecipe = RECIPES_BY_ID.get(plan.breakfastRecipeIds[0]);
  if (!breakfastRecipe) {
    return null;
  }
  return createElement('li', { className: 'day week-breakfast' }, [
    createElement('div', { className: 'day-head' }, [
      createElement('h3', { className: 'day-name' }, [
        createElement('span', { text: BREAKFAST_LABEL }),
        createElement('span', { className: 'day-date', text: `les ${plan.breakfastRecipeIds.length} matins` }),
      ]),
    ]),
    createElement('div', { className: 'day-meals' }, [
      buildMealCard({
        recipe: breakfastRecipe,
        kind: PLAN_KINDS.BREAKFAST,
        slotIndex: 0,
        slotLabel: 'Toute la semaine',
        servingCount: getServingsPerBreakfast(settings),
        settings,
      }),
    ]),
  ]);
}

export function renderPlan(planListElement, plan, settings, weekStartDate) {
  const dayItems = [buildWeeklyBreakfastItem(plan, settings)].filter(Boolean);
  for (let dayIndex = 0; dayIndex < settings.dayCount; dayIndex += 1) {
    dayItems.push(buildDayItem(dayIndex, plan, settings, weekStartDate));
  }
  if (plan.mainRecipeIds.length === 0) {
    dayItems.unshift(createElement('li', { className: 'empty-plan', text: 'Aucun plat ne correspond à ces critères.' }));
  }
  replaceChildrenWithFragment(planListElement, dayItems);
}

function buildSummaryTile(label, value, modifier = '') {
  return createElement('div', { className: `summary-tile ${modifier}`.trim() }, [
    createElement('dt', { text: label }),
    createElement('dd', { text: value }),
  ]);
}

function describeBudget(shoppingList, settings) {
  if (settings.weeklyBudget <= 0) {
    return { label: 'Budget', value: 'Aucun plafond', modifier: '' };
  }
  const difference = settings.weeklyBudget - shoppingList.totalToPay;
  if (difference >= 0) {
    return { label: `Budget ${formatEuros(settings.weeklyBudget)}`, value: `${formatEuros(difference)} de marge`, modifier: 'is-good' };
  }
  return { label: `Budget ${formatEuros(settings.weeklyBudget)}`, value: `Dépassé de ${formatEuros(-difference)}`, modifier: 'is-over' };
}

export function renderSummary(summaryElement, shoppingList, settings) {
  const budget = describeBudget(shoppingList, settings);
  const dishCount = getMainSlotCount(settings);
  replaceChildrenWithFragment(summaryElement, [
    buildSummaryTile('Ticket estimé', formatEuros(shoppingList.totalToPay), 'is-total'),
    buildSummaryTile('Par repas', formatEuros(shoppingList.costPerPortion)),
    buildSummaryTile(budget.label, budget.value, budget.modifier),
    buildSummaryTile('À cuisiner', `${dishCount} plat${dishCount > 1 ? 's' : ''}`),
    hasWeightLossGoal(settings)
      ? buildSummaryTile('Objectif', `${formatKcal(computeDailyTargetKcal(settings))} / jour`)
      : null,
  ].filter(Boolean));
}

function buildReceiptLine(line, isChecked) {
  const { product } = line;
  const checkboxId = `article-${product.id}`;
  const detailParts = [
    product.packageLabel,
    `besoin ${formatQuantity(line.neededQuantity, product.unit)}`,
  ];
  if (line.leftoverQuantity > 0) {
    detailParts.push(`reste ${formatQuantity(line.leftoverQuantity, product.unit)}`);
  }
  const brandSuffix = product.brand ? ` ${product.brand}` : '';
  return createElement('li', { className: isChecked ? 'receipt-line is-checked' : 'receipt-line' }, [
    createElement('input', {
      attributes: { type: 'checkbox', id: checkboxId, 'data-product-id': product.id, ...(isChecked ? { checked: '' } : {}) },
    }),
    createElement('label', { className: 'line-label', attributes: { for: checkboxId } }, [
      createElement('span', { className: 'line-name', text: `${line.packageCount} × ${product.name}${brandSuffix}` }),
      createElement('span', { className: 'line-price', text: formatEuros(line.cost) }),
      createElement('span', { className: 'line-detail', text: detailParts.join(' · ') }),
    ]),
  ]);
}

function buildTotalRow(label, value, className) {
  return createElement('div', { className }, [
    createElement('span', { text: label }),
    createElement('span', { text: value }),
  ]);
}

function buildPantrySection(pantryLines) {
  if (pantryLines.length === 0) {
    return null;
  }
  const pantryItems = pantryLines.map((line) => createElement('li', {
    text: formatProductQuantity(line.product, line.neededQuantity),
  }));
  return createElement('section', { className: 'receipt-pantry' }, [
    createElement('h3', { text: 'Déjà au placard, non compté' }),
    createElement('ul', {}, pantryItems),
  ]);
}

function buildReceiptProgress() {
  return createElement('div', { className: 'receipt-progress' }, [
    createElement('span', { className: 'progress-text', attributes: { 'aria-live': 'polite' } }),
    createElement('span', { className: 'progress-bar' }, [createElement('span', { className: 'progress-fill' })]),
  ]);
}

export function updateReceiptProgress(receiptElement, checkedCount, lineCount) {
  const progressText = receiptElement.querySelector('.progress-text');
  const progressFill = receiptElement.querySelector('.progress-fill');
  if (!progressText || !progressFill) {
    return;
  }
  progressText.textContent = checkedCount === lineCount && lineCount > 0
    ? 'Panier complet'
    : `${checkedCount} / ${lineCount} produits dans le panier`;
  progressFill.style.inlineSize = lineCount > 0 ? `${Math.round((checkedCount / lineCount) * 100)}%` : '0%';
}

export function renderReceipt(receiptElement, shoppingList, settings, checkedProductIds, weekStartDate) {
  const aisleSections = shoppingList.aisleGroups.map((group, groupIndex) => createElement('section', { className: 'receipt-group' }, [
    createElement('h3', { className: 'aisle-head' }, [
      createElement('span', { className: 'aisle-step', text: String(groupIndex + 1).padStart(2, '0') }),
      createElement('span', { className: 'aisle-name', text: group.aisle }),
      createElement('span', { className: 'aisle-subtotal', text: formatEuros(group.subtotal) }),
    ]),
    createElement('ul', {}, group.lines.map((line) => buildReceiptLine(line, checkedProductIds.has(line.product.id)))),
  ]));

  replaceChildrenWithFragment(receiptElement, [
    createElement('header', { className: 'receipt-head' }, [
      createElement('p', { className: 'receipt-title', text: 'Liste de courses Lidl' }),
      createElement('p', { text: `Semaine du ${formatFullDate(weekStartDate)}` }),
      createElement('p', { text: describeWeek(settings) }),
    ]),
    buildReceiptProgress(),
    ...aisleSections,
    createElement('div', { className: 'receipt-totals' }, [
      buildTotalRow('Articles', String(shoppingList.articleCount), 'total-row'),
      buildTotalRow('Total estimé', formatEuros(shoppingList.totalToPay), 'total-row is-grand-total'),
      buildTotalRow('Consommé cette semaine', formatEuros(shoppingList.consumedValue), 'total-row is-secondary'),
      buildTotalRow('Restes qui se gardent', formatEuros(shoppingList.longLastingLeftoverValue), 'total-row is-secondary'),
      buildTotalRow('Soit par repas', formatEuros(shoppingList.costPerPortion), 'total-row is-secondary'),
    ]),
    buildPantrySection(shoppingList.pantryLines),
    createElement('p', {
      className: 'receipt-foot',
      text: 'Prix indicatifs de l’assortiment permanent, hors promotions. Ils varient selon le magasin.',
    }),
  ].filter(Boolean));
}

export function renderGoalHint(hintElement, settings) {
  if (!hasWeightLossGoal(settings)) {
    hintElement.textContent = '';
    return;
  }
  hintElement.textContent = `Besoin estimé : ${formatKcal(computeMaintenanceKcal(settings))} par jour. `
    + `Objectif : ${formatKcal(computeDailyTargetKcal(settings))} par jour, soit au plus `
    + `${formatKcal(computeMealTargetKcal(settings, MEAL_TYPES.BREAKFAST))} au petit-déjeuner `
    + `et ${formatKcal(computeMealTargetKcal(settings, MEAL_TYPES.MAIN))} au déjeuner comme au dîner.`;
}
