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
  computeDailyTargetKcal,
  computeMaintenanceKcal,
  computeMealTargetKcal,
  getRecipeKcal,
  hasWeightLossGoal,
} from './nutrition.js';
import { getServingCost } from './planner.js';
import { CATEGORY_LABELS, RECIPES_BY_ID } from './recipes.js';

const DAY_NAMES = Object.freeze(['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']);
const MEAL_SLOT_LABELS = Object.freeze({ 1: ['Dîner'], 2: ['Déjeuner', 'Dîner'] });
const KCAL_FORMATTER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function formatKcal(kcal) {
  return `${KCAL_FORMATTER.format(kcal)} kcal`;
}

function addDays(date, dayOffset) {
  const shiftedDate = new Date(date);
  shiftedDate.setDate(shiftedDate.getDate() + dayOffset);
  return shiftedDate;
}

export function describeMealCount(settings) {
  const mealCount = settings.dayCount * settings.mealsPerDay;
  const mealWord = settings.mealsPerDay === 1 ? 'dîner' : 'repas';
  return `${mealCount} ${mealWord}${mealCount > 1 && mealWord === 'dîner' ? 's' : ''}`;
}

function buildRecipeDetails(recipe, personCount) {
  const ingredientItems = Object.entries(recipe.ingredients).map(([productId, quantityPerServing]) => {
    const product = PRODUCTS_BY_ID.get(productId);
    return createElement('li', { text: formatProductQuantity(product, quantityPerServing * personCount) });
  });
  const stepItems = recipe.steps.map((step) => createElement('li', { text: step }));
  return createElement('details', { className: 'meal-details' }, [
    createElement('summary', { text: `Ingrédients pour ${personCount} et étapes` }),
    createElement('ul', { className: 'ingredient-list' }, ingredientItems),
    createElement('ol', { className: 'step-list' }, stepItems),
  ]);
}

function buildMealCard(recipe, slotIndex, slotLabel, personCount) {
  const metaItems = [
    createElement('span', { className: 'chip', text: CATEGORY_LABELS[recipe.category] }),
    createElement('span', { text: `${recipe.prepMinutes} min` }),
    createElement('span', { className: 'meal-kcal', text: formatKcal(getRecipeKcal(recipe.id)) }),
    createElement('span', { className: 'meal-cost', text: `≈ ${formatEuros(getServingCost(recipe.id))} / pers.` }),
  ];
  return createElement('article', { className: 'meal', attributes: { 'data-category': recipe.category } }, [
    createElement('div', { className: 'meal-head' }, [
      createElement('p', { className: 'meal-slot', text: slotLabel }),
      createElement('button', {
        className: 'swap-button',
        text: 'Changer',
        attributes: {
          type: 'button',
          'data-action': 'swap',
          'data-slot-index': String(slotIndex),
          'aria-label': `Changer le ${slotLabel.toLowerCase()} : ${recipe.name}`,
        },
      }),
    ]),
    createElement('h4', { className: 'meal-name', text: recipe.name }),
    createElement('p', { className: 'meal-meta' }, metaItems),
    buildRecipeDetails(recipe, personCount),
  ]);
}

function buildDayKcal(dayRecipes, settings) {
  if (!hasWeightLossGoal(settings)) {
    return null;
  }
  const dayKcal = dayRecipes.filter(Boolean).reduce((kcalSum, recipe) => kcalSum + getRecipeKcal(recipe.id), 0);
  const mealWord = settings.mealsPerDay === 1 ? 'dîner' : 'déjeuner + dîner';
  return createElement('span', { className: 'day-kcal', text: `${formatKcal(dayKcal)} (${mealWord})` });
}

export function renderPlan(planListElement, planRecipeIds, settings, weekStartDate) {
  const slotLabels = MEAL_SLOT_LABELS[settings.mealsPerDay];
  const dayItems = [];
  for (let dayIndex = 0; dayIndex < settings.dayCount; dayIndex += 1) {
    const dayRecipes = slotLabels
      .map((_slotLabel, mealIndex) => RECIPES_BY_ID.get(planRecipeIds[dayIndex * settings.mealsPerDay + mealIndex]));
    const mealCards = slotLabels.map((slotLabel, mealIndex) => {
      const recipe = dayRecipes[mealIndex];
      return recipe ? buildMealCard(recipe, dayIndex * settings.mealsPerDay + mealIndex, slotLabel, settings.personCount) : null;
    });
    dayItems.push(createElement('li', { className: 'day' }, [
      createElement('h3', { className: 'day-name' }, [
        createElement('span', { text: DAY_NAMES[dayIndex] }),
        createElement('span', { className: 'day-date', text: formatDayMonth(addDays(weekStartDate, dayIndex)) }),
        buildDayKcal(dayRecipes, settings),
      ]),
      createElement('div', { className: 'day-meals' }, mealCards),
    ]));
  }
  if (planRecipeIds.length === 0) {
    dayItems.push(createElement('li', { className: 'empty-plan', text: 'Aucune recette ne correspond à ces critères.' }));
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
  replaceChildrenWithFragment(summaryElement, [
    buildSummaryTile('Ticket estimé', formatEuros(shoppingList.totalToPay), 'is-total'),
    buildSummaryTile('Par portion', formatEuros(shoppingList.costPerPortion)),
    buildSummaryTile(budget.label, budget.value, budget.modifier),
    buildSummaryTile('Au menu', `${describeMealCount(settings)} · ${settings.personCount} pers.`),
    hasWeightLossGoal(settings)
      ? buildSummaryTile('Par repas', `≤ ${formatKcal(computeMealTargetKcal(settings))}`)
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

export function renderReceipt(receiptElement, shoppingList, settings, checkedProductIds, weekStartDate) {
  const aisleSections = shoppingList.aisleGroups.map((group) => createElement('section', { className: 'receipt-group' }, [
    createElement('h3', { text: group.aisle }),
    createElement('ul', {}, group.lines.map((line) => buildReceiptLine(line, checkedProductIds.has(line.product.id)))),
  ]));

  replaceChildrenWithFragment(receiptElement, [
    createElement('header', { className: 'receipt-head' }, [
      createElement('p', { className: 'receipt-title', text: 'Liste de courses Lidl' }),
      createElement('p', { text: `Semaine du ${formatFullDate(weekStartDate)}` }),
      createElement('p', { text: `${describeMealCount(settings)} · ${settings.personCount} pers.` }),
    ]),
    ...aisleSections,
    createElement('div', { className: 'receipt-totals' }, [
      buildTotalRow('Articles', String(shoppingList.articleCount), 'total-row'),
      buildTotalRow('Total estimé', formatEuros(shoppingList.totalToPay), 'total-row is-grand-total'),
      buildTotalRow('Consommé cette semaine', formatEuros(shoppingList.consumedValue), 'total-row is-secondary'),
      buildTotalRow('Soit par portion', formatEuros(shoppingList.costPerPortion), 'total-row is-secondary'),
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
  const maintenanceKcal = computeMaintenanceKcal(settings);
  const dailyTargetKcal = computeDailyTargetKcal(settings);
  const mealTargetKcal = computeMealTargetKcal(settings);
  hintElement.textContent = `Besoin estimé : ${formatKcal(maintenanceKcal)} par jour. Objectif : ${formatKcal(dailyTargetKcal)} par jour, `
    + `soit au plus ${formatKcal(mealTargetKcal)} par repas principal. Le reste est pour le petit-déjeuner et une collation.`;
}
