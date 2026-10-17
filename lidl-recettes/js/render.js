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
  getServingsPerSnack,
} from './meal-structure.js';
import {
  computeCookedQuantity,
  computeDailyProteinTarget,
  computeDailyTargetKcal,
  computeMaintenanceKcal,
  computeMealTargetKcal,
  getPortionKcal,
  getPortionProtein,
  getPortionQuantities,
  hasWeightLossGoal,
} from './nutrition.js';
import { PLAN_KINDS } from './planner.js';
import { computePortionCost } from './shopping-list.js';
import { EMPTY_PREFERENCES } from './preferences.js';
import { CATEGORY_LABELS, countFreshIngredients, MEAL_TYPES, RECIPES_BY_ID } from './recipes.js';
import { AISLE_MOVES, getStoreSetup, hasCustomAisleOrder, listMissingIngredients } from './store-setup.js';

const DAY_NAMES = Object.freeze(['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']);
const SHORT_DAY_NAMES = Object.freeze(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']);
const WEEKLY_MEALS = Object.freeze([
  { kind: PLAN_KINDS.BREAKFAST, planKey: 'breakfastRecipeIds', label: 'Petit-déjeuner', getServings: getServingsPerBreakfast },
  { kind: PLAN_KINDS.SNACK, planKey: 'snackRecipeIds', label: 'Collation', getServings: getServingsPerSnack },
]);
const RECIPE_PHOTO_DIRECTORY = 'images/recettes';
const KCAL_FORMATTER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
// Quelques calories de plus ne méritent pas une alerte rouge : les valeurs sont des moyennes.
const DAILY_KCAL_ALERT_TOLERANCE = 1.05;

function formatKcal(kcal) {
  return `${KCAL_FORMATTER.format(kcal)} kcal`;
}

function addDays(date, dayOffset) {
  const shiftedDate = new Date(date);
  shiftedDate.setDate(shiftedDate.getDate() + dayOffset);
  return shiftedDate;
}

export function describeWeek(settings) {
  const snackSuffix = settings.includeSnack ? ' + collation' : '';
  return `${settings.dayCount} j · ${getMealsEatenPerDay(settings)} repas/jour${snackSuffix} · ${settings.personCount} pers.`;
}

function buildRecipeDetails(recipe, servingCount, settings, extraContent = null) {
  const ingredientItems = getPortionQuantities(recipe.id, settings).map(([productId, quantityPerServing]) => {
    const product = PRODUCTS_BY_ID.get(productId);
    return createElement('li', { text: formatProductQuantity(product, computeCookedQuantity(productId, quantityPerServing, servingCount)) });
  });
  const stepItems = recipe.steps.map((step) => createElement('li', { text: step }));
  const portionWord = servingCount > 1 ? 'portions' : 'portion';
  return createElement('details', { className: 'meal-details' }, [
    createElement('summary', { text: `Ingrédients pour ${servingCount} ${portionWord} et étapes` }),
    createElement('ul', { className: 'ingredient-list' }, ingredientItems),
    createElement('ol', { className: 'step-list' }, stepItems),
    extraContent,
  ]);
}

// Carte compacte (semaine) : une seule ligne de texte au lieu des pastilles.
function buildMealFactsLine(recipe, settings) {
  const facts = [
    `${recipe.prepMinutes} min`,
    formatKcal(getPortionKcal(recipe.id, settings)),
    `${getPortionProtein(recipe.id, settings)} g prot.`,
    formatEuros(computePortionCost(recipe.id, settings)),
  ];
  return createElement('p', { className: 'meal-facts-line', text: facts.join(' · '), attributes: { 'aria-label': `Par portion : ${facts.join(', ')}` } });
}

function buildMealFacts(recipe, settings) {
  const facts = [
    `${recipe.prepMinutes} min`,
    `${countFreshIngredients(recipe)} ingr.`,
    formatKcal(getPortionKcal(recipe.id, settings)),
    `${getPortionProtein(recipe.id, settings)} g prot.`,
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

function buildActionButton({ action, text, kind, slotIndex, recipe, className, pressed = null }) {
  const attributes = {
    type: 'button',
    'data-action': action,
    'data-plan-kind': kind,
    'data-slot-index': String(slotIndex),
    'data-recipe-id': recipe.id,
  };
  if (pressed !== null) {
    attributes['aria-pressed'] = String(pressed);
  }
  return createElement('button', { className, text, attributes });
}

function describeCookedButton(isCooked) {
  return isCooked ? 'Cuisiné ✓' : 'Cuisiné ?';
}

function buildSwapButton(recipe, kind, slotIndex) {
  return createElement('button', {
    className: 'swap-button',
    text: 'Changer',
    attributes: {
      type: 'button',
      'data-action': 'swap',
      'data-plan-kind': kind,
      'data-slot-index': String(slotIndex),
      'data-recipe-id': recipe.id,
      'aria-label': `Changer : ${recipe.name}`,
    },
  });
}

function buildPreferenceButtons(recipe, kind, slotIndex, settings) {
  const isLiked = (settings.preferences ?? EMPTY_PREFERENCES).liked.includes(recipe.id);
  return [
    buildActionButton({
      action: 'like', text: isLiked ? 'Aimé' : 'J’aime', kind, slotIndex, recipe, className: 'chip-button like-button', pressed: isLiked,
    }),
    buildActionButton({
      action: 'dislike', text: 'Pas pour moi', kind, slotIndex, recipe, className: 'chip-button dislike-button',
    }),
  ];
}

// Les actions de tous les jours sur une rangée fixe ; les goûts sur la suivante (dépliant d'une carte compacte).
function buildMealActions({ recipe, kind, slotIndex, isCooked }) {
  // Le petit-déjeuner et la collation reviennent chaque jour : seuls les plats se cochent.
  const cookedButton = kind === PLAN_KINDS.MAIN
    ? buildActionButton({
      action: 'cooked', text: describeCookedButton(isCooked), kind, slotIndex, recipe, className: 'chip-button cooked-button', pressed: isCooked,
    })
    : null;
  return createElement('div', { className: 'meal-actions' }, [
    buildActionButton({
      action: 'cook', text: 'Cuisiner', kind, slotIndex, recipe, className: 'chip-button cook-button',
    }),
    cookedButton,
    buildSwapButton(recipe, kind, slotIndex),
  ]);
}

function buildMissingWarning(recipe, settings) {
  const missingProductIds = listMissingIngredients(recipe, getStoreSetup(settings));
  if (missingProductIds.length === 0) {
    return null;
  }
  const missingNames = missingProductIds.map((productId) => PRODUCTS_BY_ID.get(productId).shortName).join(', ');
  return createElement('p', { className: 'meal-warning', text: `Introuvable dans ton Lidl : ${missingNames}` });
}

function buildMealCard({ recipe, kind, slotIndex, slotLabel, servingCount, settings, isCooked = false, isCompact = false }) {
  const isBreakfast = kind === PLAN_KINDS.BREAKFAST;
  // « is-settled » : déjà cuisiné à l'affichage, donc masqué sans animation quand les plats cuisinés sont cachés.
  const cardClasses = ['meal', isBreakfast ? 'is-breakfast' : '', isCompact ? 'is-compact' : '', isCooked ? 'is-cooked is-settled' : '']
    .filter(Boolean).join(' ');
  const preferenceRow = createElement('div', { className: 'meal-preferences' }, buildPreferenceButtons(recipe, kind, slotIndex, settings));
  return createElement('article', {
    className: cardClasses,
    attributes: { 'data-category': recipe.category },
  }, [
    buildMealPhoto(recipe),
    slotLabel ? createElement('p', { className: 'meal-slot', text: slotLabel }) : null,
    createElement('h4', { className: 'meal-name', text: recipe.name }),
    createElement('p', { className: 'meal-tag', text: CATEGORY_LABELS[recipe.category] }),
    buildMissingWarning(recipe, settings),
    isCompact ? buildMealFactsLine(recipe, settings) : buildMealFacts(recipe, settings),
    buildMealActions({ recipe, kind, slotIndex, isCooked }),
    isCompact ? null : preferenceRow,
    buildRecipeDetails(recipe, servingCount, settings, isCompact ? preferenceRow : null),
  ]);
}

// Ce qu'une personne mange dans la journée : les recettes de la semaine (petit-déjeuner, collation)
// une fois, et chaque plat autant de fois qu'il est servi (deux fois s'il fait midi et soir).
function computeDayTotal({ weeklyRecipes, mainRecipes, settings, getPortionValue }) {
  const weeklyTotal = weeklyRecipes.filter(Boolean)
    .reduce((total, recipe) => total + getPortionValue(recipe.id, settings), 0);
  const mainTotal = mainRecipes.filter(Boolean)
    .reduce((total, recipe) => total + getPortionValue(recipe.id, settings) * getServingsPerMainRecipe(settings), 0);
  return weeklyTotal + mainTotal;
}

function buildDayKcal(weeklyRecipes, mainRecipes, settings) {
  if (!hasWeightLossGoal(settings)) {
    return null;
  }
  const eatenKcal = computeDayTotal({ weeklyRecipes, mainRecipes, settings, getPortionValue: getPortionKcal });
  const eatenProtein = computeDayTotal({ weeklyRecipes, mainRecipes, settings, getPortionValue: getPortionProtein });
  const dailyTargetKcal = computeDailyTargetKcal(settings);
  const dailyProteinTarget = computeDailyProteinTarget(settings);
  const fillElement = createElement('span', { className: 'kcal-fill' });
  fillElement.style.inlineSize = `${Math.min(100, Math.round((eatenKcal / dailyTargetKcal) * 100))}%`;
  return createElement('div', {
    className: eatenKcal > dailyTargetKcal * DAILY_KCAL_ALERT_TOLERANCE ? 'day-kcal is-over' : 'day-kcal',
  }, [
    createElement('span', {
      className: 'kcal-bar',
      attributes: {
        role: 'img',
        'aria-label': `${formatKcal(eatenKcal)} sur ${formatKcal(dailyTargetKcal)}, ${eatenProtein} g de protéines sur ${dailyProteinTarget} g`,
      },
    }, [fillElement]),
    createElement('span', {
      className: 'kcal-text',
      text: `${formatKcal(eatenKcal)} · ${eatenProtein} g prot.`,
    }),
  ]);
}

function listDaySlotIndexes(dayIndex, plan, settings) {
  const mainSlotsPerDay = getMainSlotsPerDay(settings);
  return getMainSlotLabels(settings)
    .map((_slotLabel, mealIndex) => dayIndex * mainSlotsPerDay + mealIndex)
    .filter((slotIndex) => RECIPES_BY_ID.has(plan.mainRecipeIds[slotIndex]));
}

function isDayCooked(dayIndex, plan, settings, cookedSlotIndexes) {
  const daySlotIndexes = listDaySlotIndexes(dayIndex, plan, settings);
  return daySlotIndexes.length > 0 && daySlotIndexes.every((slotIndex) => cookedSlotIndexes.has(slotIndex));
}

function buildDayView(dayIndex, plan, settings, weekStartDate, cookedSlotIndexes) {
  const mainSlotsPerDay = getMainSlotsPerDay(settings);
  const weeklyRecipes = WEEKLY_MEALS.map(({ planKey }) => RECIPES_BY_ID.get((plan[planKey] ?? [])[dayIndex]));
  const mainRecipes = getMainSlotLabels(settings)
    .map((_slotLabel, mealIndex) => RECIPES_BY_ID.get(plan.mainRecipeIds[dayIndex * mainSlotsPerDay + mealIndex]));
  // Avec un seul plat par jour, « Déjeuner et dîner » répété sur chaque carte n'apprend rien.
  const showsSlotLabel = mainSlotsPerDay > 1;
  const mainCards = getMainSlotLabels(settings).map((slotLabel, mealIndex) => {
    const recipe = mainRecipes[mealIndex];
    const slotIndex = dayIndex * mainSlotsPerDay + mealIndex;
    return recipe
      ? buildMealCard({
        recipe,
        kind: PLAN_KINDS.MAIN,
        slotIndex,
        slotLabel: showsSlotLabel ? slotLabel : '',
        servingCount: getServingsPerMainSlot(settings),
        settings,
        isCooked: cookedSlotIndexes.has(slotIndex),
      })
      : null;
  });
  return createElement('article', { className: 'day' }, [
    createElement('div', { className: 'day-head' }, [
      createElement('h2', { className: 'day-name' }, [
        createElement('span', { text: DAY_NAMES[dayIndex] }),
        createElement('span', { className: 'day-date', text: formatDayMonth(addDays(weekStartDate, dayIndex)) }),
      ]),
      buildDayKcal(weeklyRecipes, mainRecipes, settings),
    ]),
    createElement('div', { className: 'day-meals' }, mainCards),
  ]);
}

function isSameDay(firstDate, secondDate) {
  return firstDate.toDateString() === secondDate.toDateString();
}

// Les pastilles des jours : un point plein quand tous les plats du jour sont cuisinés.
export function renderDayStrip(stripElement, { plan, settings, weekStartDate, cookedSlotIndexes, selectedDayIndex }) {
  const today = new Date();
  const dayChips = Array.from({ length: settings.dayCount }, (_unused, dayIndex) => {
    const dayDate = addDays(weekStartDate, dayIndex);
    const isSelected = dayIndex === selectedDayIndex;
    const chipClasses = [
      'day-chip',
      isSelected ? 'is-active' : '',
      isDayCooked(dayIndex, plan, settings, cookedSlotIndexes) ? 'is-done' : '',
      isSameDay(dayDate, today) ? 'is-today' : '',
    ].filter(Boolean).join(' ');
    return createElement('button', {
      className: chipClasses,
      attributes: {
        type: 'button',
        role: 'tab',
        'data-day-index': String(dayIndex),
        'aria-selected': String(isSelected),
        'aria-label': `${DAY_NAMES[dayIndex]} ${formatDayMonth(dayDate)}`,
      },
    }, [
      createElement('span', { className: 'day-chip-name', text: SHORT_DAY_NAMES[dayIndex] }),
      createElement('span', { className: 'day-chip-date', text: String(dayDate.getDate()) }),
      createElement('span', { className: 'day-chip-dot' }),
    ]);
  });
  replaceChildrenWithFragment(stripElement, dayChips);
}

// Le jour d'ouverture de l'onglet : celui du prochain plat à cuisiner, sinon le premier.
export function findNextDayIndex(plan, settings, cookedSlotIndexes) {
  const nextSlotIndex = plan.mainRecipeIds.findIndex((recipeId, slotIndex) => RECIPES_BY_ID.has(recipeId) && !cookedSlotIndexes.has(slotIndex));
  return nextSlotIndex === -1 ? 0 : Math.floor(nextSlotIndex / getMainSlotsPerDay(settings));
}

export function renderPlan(planListElement, { plan, settings, weekStartDate, cookedSlotIndexes, selectedDayIndex }) {
  if (plan.mainRecipeIds.length === 0) {
    replaceChildrenWithFragment(planListElement, [createElement('p', { className: 'empty-plan', text: 'Aucun plat ne correspond à ces critères.' })]);
    return;
  }
  const dayIndex = Math.min(selectedDayIndex, settings.dayCount - 1);
  replaceChildrenWithFragment(planListElement, [buildDayView(dayIndex, plan, settings, weekStartDate, cookedSlotIndexes)]);
}

// Le petit-déjeuner et la collation, les mêmes chaque jour de la semaine.
export function renderWeeklyMeals(containerElement, plan, settings) {
  const weeklyCards = WEEKLY_MEALS.map(({ kind, planKey, label, getServings }) => {
    const recipe = RECIPES_BY_ID.get((plan[planKey] ?? [])[0]);
    return recipe
      ? buildMealCard({ recipe, kind, slotIndex: 0, slotLabel: label, servingCount: getServings(settings), settings, isCompact: true })
      : null;
  }).filter(Boolean);
  replaceChildrenWithFragment(containerElement, weeklyCards);
}

// Grande carte : photo plein cadre avec le nom par-dessus, et une barre « Cuisiner » toujours sous le pouce.
function buildHeroCard({ recipe, slotIndex, slotLabel, servingCount, settings }) {
  const kind = PLAN_KINDS.MAIN;
  const photo = buildMealPhoto(recipe);
  photo.setAttribute('loading', 'eager');
  return createElement('article', { className: 'meal is-hero', attributes: { 'data-category': recipe.category } }, [
    createElement('div', { className: 'hero-media' }, [
      photo,
      createElement('div', { className: 'hero-text' }, [
        createElement('p', { className: 'meal-slot', text: slotLabel }),
        createElement('h2', { className: 'meal-name', text: recipe.name }),
        createElement('p', { className: 'meal-tag', text: CATEGORY_LABELS[recipe.category] }),
        buildMealFacts(recipe, settings),
      ]),
    ]),
    buildMissingWarning(recipe, settings),
    createElement('div', { className: 'meal-preferences' }, [
      buildActionButton({
        action: 'cooked', text: describeCookedButton(false), kind, slotIndex, recipe, className: 'chip-button cooked-button', pressed: false,
      }),
      ...buildPreferenceButtons(recipe, kind, slotIndex, settings),
    ]),
    buildRecipeDetails(recipe, servingCount, settings),
    createElement('div', { className: 'cook-bar' }, [
      buildActionButton({ action: 'cook', text: 'Cuisiner', kind, slotIndex, recipe, className: 'primary-button cook-button' }),
      buildSwapButton(recipe, kind, slotIndex),
    ]),
  ]);
}

// Le premier plat pas encore cuisiné, quel que soit son jour : on ne cuisine pas forcément à la date prévue.
export function renderNextRecipe({ cardContainer, progressElement }, plan, settings, cookedSlotIndexes) {
  const plannedSlotIndexes = plan.mainRecipeIds
    .map((recipeId, slotIndex) => (RECIPES_BY_ID.has(recipeId) ? slotIndex : null))
    .filter((slotIndex) => slotIndex !== null);
  const nextSlotIndex = plannedSlotIndexes.find((slotIndex) => !cookedSlotIndexes.has(slotIndex));
  progressElement.textContent = plannedSlotIndexes.length > 0 ? `${cookedSlotIndexes.size} sur ${plannedSlotIndexes.length} cuisinés` : '';
  if (nextSlotIndex === undefined) {
    const message = plannedSlotIndexes.length > 0 ? 'Tous les plats de la semaine sont cuisinés.' : 'Aucun plat prévu.';
    replaceChildrenWithFragment(cardContainer, [createElement('p', { className: 'next-recipe-done', text: message })]);
    return;
  }
  const slotLabels = getMainSlotLabels(settings);
  const dayName = DAY_NAMES[Math.floor(nextSlotIndex / getMainSlotsPerDay(settings))] ?? '';
  replaceChildrenWithFragment(cardContainer, [buildHeroCard({
    recipe: RECIPES_BY_ID.get(plan.mainRecipeIds[nextSlotIndex]),
    slotIndex: nextSlotIndex,
    slotLabel: [dayName, slotLabels[nextSlotIndex % slotLabels.length]].filter(Boolean).join(' · '),
    servingCount: getServingsPerMainSlot(settings),
    settings,
  })]);
}

// Cocher « Cuisiné » met à jour la carte sur place : la reconstruire ferait disparaître
// le plat d'un coup, sans laisser voir la coche.
export function updateCookedCard(cardElement, isCooked) {
  cardElement.classList.toggle('is-cooked', isCooked);
  cardElement.classList.remove('is-settled');
  const cookedButton = cardElement.querySelector('[data-action="cooked"]');
  if (cookedButton) {
    cookedButton.textContent = describeCookedButton(isCooked);
    cookedButton.setAttribute('aria-pressed', String(isCooked));
  }
}

function buildSummaryTile(label, value, modifier = '', detail = '') {
  return createElement('div', { className: `summary-tile ${modifier}`.trim() }, [
    createElement('dt', { text: label }),
    createElement('dd', { text: value }),
    detail ? createElement('dd', { className: 'summary-detail', text: detail }) : null,
  ]);
}

function describeBudget(shoppingList, settings) {
  if (settings.weeklyBudget <= 0) {
    return null;
  }
  const difference = settings.weeklyBudget - shoppingList.totalToPay;
  if (difference >= 0) {
    return { label: `Budget ${formatEuros(settings.weeklyBudget)}`, value: `${formatEuros(difference)} de marge`, modifier: 'is-good' };
  }
  return { label: `Budget ${formatEuros(settings.weeklyBudget)}`, value: `Dépassé de ${formatEuros(-difference)}`, modifier: 'is-over' };
}

function describeDishProgress(dishCount, cookedCount) {
  if (cookedCount === 0) {
    return { label: 'À cuisiner', value: `${dishCount} plat${dishCount > 1 ? 's' : ''}` };
  }
  return { label: 'Plats cuisinés', value: `${cookedCount} sur ${dishCount}` };
}

// Le ticket en grand, puis trois repères courts ; le budget seulement s'il y en a un.
export function renderSummary(summaryElement, shoppingList, settings, cookedCount = 0) {
  const budget = describeBudget(shoppingList, settings);
  const dishCount = getMainSlotCount(settings);
  const dishProgress = describeDishProgress(dishCount, cookedCount);
  replaceChildrenWithFragment(summaryElement, [
    buildSummaryTile('Ticket estimé', formatEuros(shoppingList.totalToPay), 'is-total'),
    budget ? buildSummaryTile(budget.label, budget.value, `is-budget ${budget.modifier}`) : null,
    buildSummaryTile('Par repas', formatEuros(shoppingList.costPerPortion)),
    buildSummaryTile(dishProgress.label, dishProgress.value),
    hasWeightLossGoal(settings)
      ? buildSummaryTile('Par jour', formatKcal(computeDailyTargetKcal(settings)), '', `${computeDailyProteinTarget(settings)} g prot.`)
      : null,
  ].filter(Boolean));
}

function buildMissingButton(product, isMissing) {
  return createElement('button', {
    className: 'missing-button',
    text: isMissing ? 'Trouvé finalement' : 'Introuvable',
    attributes: {
      type: 'button',
      'data-missing-product-id': product.id,
      'aria-pressed': String(isMissing),
      'aria-label': isMissing ? `${product.name} : trouvé finalement` : `${product.name} : introuvable dans mon Lidl`,
    },
  });
}

function buildReceiptLine(line, { isChecked, isMissing }) {
  const { product } = line;
  const checkboxId = `article-${product.id}`;
  const detailParts = [
    product.packageLabel,
    `besoin ${formatQuantity(line.neededQuantity, product.unit)}`,
  ];
  if (line.stockUsedQuantity > 0) {
    detailParts.push(`dont ${formatQuantity(line.stockUsedQuantity, product.unit)} en stock`);
  }
  if (line.leftoverQuantity > 0) {
    detailParts.push(`reste ${formatQuantity(line.leftoverQuantity, product.unit)}`);
  }
  // « is-settled » : déjà réglé à l'affichage, donc masqué sans animation en mode « Masquer les cochés ».
  const stateClasses = [
    isChecked ? 'is-checked' : '',
    isMissing ? 'is-missing' : '',
    isChecked || isMissing ? 'is-settled' : '',
  ].filter(Boolean).join(' ');
  return createElement('li', { className: `receipt-line ${stateClasses}`.trim(), attributes: { 'data-product-id': product.id } }, [
    createElement('input', {
      attributes: { type: 'checkbox', id: checkboxId, 'data-product-id': product.id, ...(isChecked ? { checked: '' } : {}) },
    }),
    createElement('label', { className: 'line-label', attributes: { for: checkboxId } }, [
      // La marque est à part : en magasin, le nom seul suffit et laisse la ligne courte.
      createElement('span', { className: 'line-name' }, [
        `${line.packageCount} × ${product.name}`,
        product.brand ? createElement('span', { className: 'line-brand', text: ` ${product.brand}` }) : null,
      ]),
      createElement('span', { className: 'line-price', text: formatEuros(line.cost) }),
      createElement('span', { className: 'line-detail', text: detailParts.join(' · ') }),
    ]),
    buildMissingButton(product, isMissing),
  ]);
}

function buildExtraLine(line, isChecked) {
  const { extra, product } = line;
  const checkboxId = `article-${extra.id}`;
  const detailText = product ? `${product.packageLabel} · ajouté` : 'ajouté';
  return createElement('li', {
    className: isChecked ? 'receipt-line is-extra is-checked is-settled' : 'receipt-line is-extra',
    attributes: { 'data-product-id': extra.id },
  }, [
    createElement('input', {
      attributes: { type: 'checkbox', id: checkboxId, 'data-product-id': extra.id, ...(isChecked ? { checked: '' } : {}) },
    }),
    createElement('label', { className: 'line-label', attributes: { for: checkboxId } }, [
      createElement('span', { className: 'line-name', text: `${line.packageCount} × ${extra.label}` }),
      createElement('span', { className: 'line-price', text: product ? formatEuros(line.cost) : '—' }),
      createElement('span', { className: 'line-detail', text: detailText }),
    ]),
    createElement('button', {
      className: 'remove-extra-button',
      text: 'Retirer',
      attributes: { type: 'button', 'data-extra-id': extra.id, 'aria-label': `Retirer ${extra.label} de la liste` },
    }),
  ]);
}

function buildTotalRow(label, value, className) {
  return createElement('div', { className }, [
    createElement('span', { text: label }),
    createElement('span', { text: value }),
  ]);
}

function buildPantrySection(lines, title) {
  if (lines.length === 0) {
    return null;
  }
  const pantryItems = lines.map((line) => createElement('li', {
    text: formatProductQuantity(line.product, line.neededQuantity),
  }));
  return createElement('section', { className: 'receipt-pantry' }, [
    createElement('h3', { text: title }),
    createElement('ul', {}, pantryItems),
  ]);
}

export function updateMissingLine(lineElement, product, isMissing) {
  lineElement.classList.toggle('is-missing', isMissing);
  lineElement.querySelector('.missing-button')?.replaceWith(buildMissingButton(product, isMissing));
}

export function updateReceiptProgress(progressContainer, checkedCount, lineCount) {
  const progressText = progressContainer.querySelector('.progress-text');
  const progressFill = progressContainer.querySelector('.progress-fill');
  if (!progressText || !progressFill) {
    return;
  }
  progressText.textContent = checkedCount === lineCount && lineCount > 0
    ? 'Panier complet'
    : `${checkedCount} / ${lineCount} produits dans le panier`;
  progressFill.style.inlineSize = lineCount > 0 ? `${Math.round((checkedCount / lineCount) * 100)}%` : '0%';
}

function buildAisleMoveButton(aisle, direction, isDisabled) {
  const isUp = direction === AISLE_MOVES.UP;
  const attributes = {
    type: 'button',
    'data-aisle': aisle,
    'data-direction': String(direction),
    'aria-label': `${isUp ? 'Monter' : 'Descendre'} le rayon ${aisle}`,
  };
  if (isDisabled) {
    attributes.disabled = '';
  }
  return createElement('button', { className: 'aisle-move', text: isUp ? '↑' : '↓', attributes });
}

// Un produit introuvable compte comme réglé : il n'y a plus rien à aller chercher.
export function isLineDone(productId, checkedProductIds, storeSetup) {
  return checkedProductIds.has(productId) || storeSetup.missingProductIds.includes(productId);
}

function describeAisleCount(doneCount, lineCount) {
  return doneCount === lineCount ? '✓ fini' : `${doneCount}/${lineCount}`;
}

export function updateAisleCount(groupElement, doneCount, lineCount) {
  const countElement = groupElement.querySelector('.aisle-count');
  if (countElement) {
    countElement.textContent = describeAisleCount(doneCount, lineCount);
  }
}

// Un rayon fini se replie tout seul : il ne reste sous les yeux que ce qu'il faut encore prendre.
function buildAisleSection(group, groupIndex, { checkedProductIds, storeSetup }) {
  const lineKeys = [...group.lines.map((line) => line.product.id), ...group.extraLines.map((line) => line.extra.id)];
  const doneCount = lineKeys.filter((lineKey) => isLineDone(lineKey, checkedProductIds, storeSetup)).length;
  const isComplete = doneCount === lineKeys.length;
  const attributes = isComplete ? {} : { open: '' };
  return createElement('details', { className: isComplete ? 'receipt-group is-complete is-settled' : 'receipt-group', attributes }, [
    createElement('summary', { className: 'aisle-head' }, [
      createElement('span', { className: 'aisle-step', text: String(groupIndex + 1).padStart(2, '0') }),
      createElement('span', { className: 'aisle-name', text: group.aisle }),
      createElement('span', { className: 'aisle-count', text: describeAisleCount(doneCount, lineKeys.length) }),
    ]),
    createElement('ul', {}, [
      ...group.lines.map((line) => buildReceiptLine(line, {
        isChecked: checkedProductIds.has(line.product.id),
        isMissing: storeSetup.missingProductIds.includes(line.product.id),
      })),
      ...group.extraLines.map((line) => buildExtraLine(line, checkedProductIds.has(line.extra.id))),
    ]),
  ]);
}

export function renderShoppingList(listElement, shoppingList, settings, checkedProductIds) {
  const lineStates = { checkedProductIds, storeSetup: getStoreSetup(settings) };
  const aisleSections = shoppingList.aisleGroups.map((group, groupIndex) => buildAisleSection(group, groupIndex, lineStates));
  replaceChildrenWithFragment(listElement, aisleSections.length > 0
    ? aisleSections
    : [createElement('p', { className: 'empty-plan', text: 'Rien à acheter cette semaine.' })]);
}

// En tête des courses : le total, la progression du panier et l'accès au ticket détaillé.
export function renderShopHead(headElement, shoppingList) {
  replaceChildrenWithFragment(headElement, [
    createElement('div', { className: 'shop-total' }, [
      createElement('span', { className: 'shop-total-label', text: 'Ticket estimé' }),
      createElement('span', { className: 'shop-total-amount', text: formatEuros(shoppingList.totalToPay) }),
    ]),
    createElement('span', { className: 'progress-bar' }, [createElement('span', { className: 'progress-fill' })]),
    createElement('div', { className: 'shop-head-foot' }, [
      createElement('span', { className: 'progress-text', attributes: { 'aria-live': 'polite' } }),
      createElement('button', { className: 'text-button ticket-button', text: 'Voir le ticket', attributes: { type: 'button', 'data-open-ticket': '' } }),
    ]),
  ]);
}

function buildTicketLine(line) {
  return createElement('div', { className: 'total-row' }, [
    createElement('span', { text: `${line.packageCount} × ${line.product.name}` }),
    createElement('span', { text: formatEuros(line.cost) }),
  ]);
}

export function renderTicket(ticketElement, shoppingList, settings, weekStartDate) {
  const ticketLines = shoppingList.aisleGroups.flatMap((group) => group.lines.map(buildTicketLine));
  replaceChildrenWithFragment(ticketElement, [
    createElement('header', { className: 'receipt-head' }, [
      createElement('p', { className: 'receipt-title', text: 'Liste de courses Lidl' }),
      createElement('p', { text: `Semaine du ${formatFullDate(weekStartDate)}` }),
      createElement('p', { text: describeWeek(settings) }),
    ]),
    createElement('div', { className: 'ticket-lines' }, ticketLines),
    createElement('div', { className: 'receipt-totals' }, [
      buildTotalRow('Articles', String(shoppingList.articleCount), 'total-row'),
      buildTotalRow('Total estimé', formatEuros(shoppingList.totalToPay), 'total-row is-grand-total'),
      buildTotalRow('Consommé cette semaine', formatEuros(shoppingList.consumedValue), 'total-row is-secondary'),
      buildTotalRow('Restes qui se gardent', formatEuros(shoppingList.longLastingLeftoverValue), 'total-row is-secondary'),
      buildTotalRow('Soit par repas', formatEuros(shoppingList.costPerPortion), 'total-row is-secondary'),
    ]),
    buildPantrySection(shoppingList.stockLines, 'Restes de la semaine dernière, à utiliser'),
    buildPantrySection(shoppingList.pantryLines, 'Déjà au placard, non compté'),
  ].filter(Boolean));
}

// L'ordre des rayons de mon magasin, réglé une fois pour toutes dans les réglages.
export function renderAisleOrder(listElement, storeSetup) {
  const lastIndex = storeSetup.aisleOrder.length - 1;
  replaceChildrenWithFragment(listElement, storeSetup.aisleOrder.map((aisle, aisleIndex) => createElement('li', { className: 'aisle-order-row' }, [
    createElement('span', { className: 'aisle-step', text: String(aisleIndex + 1).padStart(2, '0') }),
    createElement('span', { className: 'aisle-name', text: aisle }),
    createElement('span', { className: 'aisle-moves' }, [
      buildAisleMoveButton(aisle, AISLE_MOVES.UP, aisleIndex === 0),
      buildAisleMoveButton(aisle, AISLE_MOVES.DOWN, aisleIndex === lastIndex),
    ]),
  ])));
}

export function renderGoalHint(hintElement, settings) {
  if (!hasWeightLossGoal(settings)) {
    hintElement.textContent = '';
    return;
  }
  hintElement.textContent = `Besoin ${formatKcal(computeMaintenanceKcal(settings))} → objectif ${formatKcal(computeDailyTargetKcal(settings))} et `
    + `${computeDailyProteinTarget(settings)} g de protéines par jour (${formatKcal(computeMealTargetKcal(settings, MEAL_TYPES.MAIN))} par plat).`;
}

export function renderPreferencesSummary(summaryElement, resetButton, preferences) {
  const dislikedCount = preferences.disliked.length;
  const likedCount = preferences.liked.length;
  const parts = [];
  if (likedCount > 0) {
    parts.push(`${likedCount} plat${likedCount > 1 ? 's' : ''} aimé${likedCount > 1 ? 's' : ''}`);
  }
  if (dislikedCount > 0) {
    parts.push(`${dislikedCount} écarté${dislikedCount > 1 ? 's' : ''}`);
  }
  summaryElement.textContent = parts.join(' · ');
  summaryElement.hidden = parts.length === 0;
  resetButton.hidden = dislikedCount === 0;
}

export function renderStoreSummary({ summaryElement, clearMissingButton, resetAislesButton }, storeSetup) {
  const missingNames = storeSetup.missingProductIds.map((productId) => PRODUCTS_BY_ID.get(productId).shortName);
  summaryElement.textContent = missingNames.length > 0 ? `Introuvable dans mon Lidl : ${missingNames.join(', ')}.` : '';
  summaryElement.hidden = missingNames.length === 0;
  clearMissingButton.hidden = missingNames.length === 0;
  resetAislesButton.hidden = !hasCustomAisleOrder(storeSetup);
}

export function renderStockSummary(summaryElement, clearButton, stockDescription) {
  const { productCount, value } = stockDescription;
  summaryElement.textContent = productCount === 0
    ? ''
    : `${productCount} reste${productCount > 1 ? 's' : ''} en stock (≈ ${formatEuros(value)}), déduit${productCount > 1 ? 's' : ''} des courses.`;
  summaryElement.hidden = productCount === 0;
  clearButton.hidden = productCount === 0;
}
