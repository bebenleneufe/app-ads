import { PRODUCTS, PRODUCTS_BY_ID } from './catalog.js';
import { CookMode } from './cook-mode.js';
import { buildEatenPlan, isMealCooked, listCookedSlotIndexes, normalizeCookedMeals, setMealCooked } from './cooked-meals.js';
import { createElement, debounce, replaceChildrenWithFragment } from './dom.js';
import { addExtraItem, keepUnboughtExtraItems, normalizeExtraItems, removeExtraItem } from './extra-items.js';
import { setUpInstallButton } from './install-prompt.js';
import { buildShoppingListText } from './list-text.js';
import { generatePlan, PLAN_KINDS, reconcilePlan, restorePlan, swapMeal } from './planner.js';
import { createEmptyPlan, getServingsPerBreakfast, getServingsPerMainSlot, getServingsPerSnack } from './meal-structure.js';
import { hasWeightLossGoal } from './nutrition.js';
import {
  clearDisliked,
  EMPTY_PREFERENCES,
  markDisliked,
  normalizePreferences,
  rememberWeek,
  toggleLiked,
} from './preferences.js';
import { RECIPES_BY_ID } from './recipes.js';
import {
  isLineDone,
  renderGoalHint,
  renderPlan,
  renderPreferencesSummary,
  renderReceipt,
  renderStockSummary,
  renderStoreSummary,
  renderSummary,
  updateMissingLine,
  updateReceiptProgress,
} from './render.js';
import { normalizeSettings, readSettingsFromForm, writeSettingsToForm } from './settings.js';
import { buildShoppingList } from './shopping-list.js';
import { renderWeightTracker } from './render-weight.js';
import { computeNextStock, describeStock, hasShoppingEvidence, normalizeStock } from './stock.js';
import { loadSavedState, saveState } from './storage.js';
import {
  clearMissingProducts,
  moveAisle,
  normalizeStoreSetup,
  resetAisleOrder,
  toggleMissingProduct,
} from './store-setup.js';
import { createScreenWakeLock } from './wake-lock.js';
import { addWeightEntry, analyzeWeightTrend, isValidWeight, normalizeWeightLog } from './weight-log.js';
import { getUpcomingMonday, resolveWeekStart, toIsoDate } from './week.js';

const SETTINGS_DEBOUNCE_MILLISECONDS = 300;
const COPY_STATUS_DURATION_MILLISECONDS = 4000;
const UNDO_DURATION_MILLISECONDS = 6000;
// Le budget n'est appliqué qu'à la validation du champ : les valeurs intermédiaires
// tapées (« 4 » avant « 45 ») remplaceraient des plats pour rien.
const FIELDS_APPLIED_ON_COMMIT_ONLY = new Set(['weeklyBudget']);

// Assez long pour faire le tour des plats compatibles avant de revoir une recette déjà proposée.
const SWAP_HISTORY_LENGTH = 40;

const SERVINGS_BY_PLAN_KIND = Object.freeze({
  [PLAN_KINDS.MAIN]: getServingsPerMainSlot,
  [PLAN_KINDS.BREAKFAST]: getServingsPerBreakfast,
  [PLAN_KINDS.SNACK]: getServingsPerSnack,
});

class WeeklyPlannerApp {
  #elements;
  #settings;
  #plan = createEmptyPlan();
  #preferences = EMPTY_PREFERENCES;
  #weightLog = [];
  #pantryStock = {};
  // Recettes déjà proposées par « Changer », pour chaque repas de la semaine en cours.
  #swapHistoryBySlot = new Map();
  #cookMode;
  #storeWakeLock = createScreenWakeLock();
  #removeInstallButton = () => {};
  #checkedProductIds = new Set();
  #storeSetup = normalizeStoreSetup(null);
  #extraItems = [];
  // Recette cuisinée pour chaque créneau de plat de la semaine en cours.
  #cookedMeals = {};
  // Le mode magasin est retenu : si le téléphone ferme l'appli au milieu des rayons, on y revient.
  #isStoreMode = false;
  #hidesCheckedItems = false;
  #shoppingList = null;
  #weekStartDate = getUpcomingMonday();
  #listenersController = new AbortController();
  #debouncedSettingsUpdate = debounce(() => this.#applySettingsFromForm(), SETTINGS_DEBOUNCE_MILLISECONDS);
  #copyStatusTimeoutId = null;
  #undoTimeoutId = null;
  #undoAction = null;

  constructor(rootDocument) {
    this.#elements = {
      settingsForm: rootDocument.getElementById('settings-form'),
      summary: rootDocument.getElementById('summary'),
      planList: rootDocument.getElementById('plan-list'),
      receipt: rootDocument.getElementById('receipt'),
      regenerateButton: rootDocument.getElementById('regenerate-button'),
      copyButton: rootDocument.getElementById('copy-button'),
      uncheckButton: rootDocument.getElementById('uncheck-button'),
      copyStatus: rootDocument.getElementById('copy-status'),
      copyFallback: rootDocument.getElementById('copy-fallback'),
      profileFields: rootDocument.getElementById('profile-fields'),
      goalHint: rootDocument.getElementById('kcal-hint'),
      preferencesSummary: rootDocument.getElementById('preferences-summary'),
      resetDislikesButton: rootDocument.getElementById('reset-dislikes-button'),
      weightEntryInput: rootDocument.getElementById('weight-entry'),
      addWeightButton: rootDocument.getElementById('add-weight-button'),
      weightChartContainer: rootDocument.getElementById('weight-chart-container'),
      weightAdvice: rootDocument.getElementById('weight-advice'),
      stockSummary: rootDocument.getElementById('stock-summary'),
      clearStockButton: rootDocument.getElementById('clear-stock-button'),
      storeModeButton: rootDocument.getElementById('store-mode-button'),
      installButton: rootDocument.getElementById('install-button'),
      installHelp: rootDocument.getElementById('install-help'),
      hideCheckedButton: rootDocument.getElementById('hide-checked-button'),
      storeSummary: rootDocument.getElementById('store-summary'),
      clearMissingButton: rootDocument.getElementById('clear-missing-button'),
      resetAislesButton: rootDocument.getElementById('reset-aisles-button'),
      addItemForm: rootDocument.getElementById('add-item-form'),
      addItemInput: rootDocument.getElementById('add-item-input'),
      catalogProductList: rootDocument.getElementById('catalog-products'),
      undoToast: rootDocument.getElementById('undo-toast'),
      undoMessage: rootDocument.getElementById('undo-message'),
      undoButton: rootDocument.getElementById('undo-button'),
      apkLink: rootDocument.getElementById('apk-link'),
      body: rootDocument.body,
    };
    this.#cookMode = new CookMode(rootDocument.getElementById('cook-dialog'));
  }

  start() {
    this.#restoreSavedState();
    this.#removeInstallButton = setUpInstallButton({
      installButton: this.#elements.installButton,
      installHelp: this.#elements.installHelp,
      apkLink: this.#elements.apkLink,
    });
    writeSettingsToForm(this.#elements.settingsForm, this.#settings);
    this.#fillCatalogSuggestions();
    this.#attachListeners();
    this.#renderAll();
    this.#applyHideChecked();
    if (this.#isStoreMode) {
      this.#applyStoreMode();
    }
  }

  // Chaque donnée enregistrée est relue séparément et réparée si besoin : un souci sur la
  // semaine de menus ne doit jamais effacer le suivi du poids, les goûts ou le magasin.
  #restoreSavedState() {
    const savedState = loadSavedState();
    this.#settings = normalizeSettings(savedState?.settings);
    this.#preferences = normalizePreferences(savedState?.preferences, RECIPES_BY_ID);
    this.#weightLog = normalizeWeightLog(savedState?.weightLog);
    this.#pantryStock = normalizeStock(savedState?.pantryStock);
    this.#storeSetup = normalizeStoreSetup(savedState?.storeSetup);
    this.#extraItems = normalizeExtraItems(savedState?.extraItems);
    this.#cookedMeals = normalizeCookedMeals(savedState?.cookedMeals);
    this.#isStoreMode = savedState?.interface?.isStoreMode === true;
    this.#hidesCheckedItems = savedState?.interface?.hidesCheckedItems === true;
    this.#checkedProductIds = new Set(Array.isArray(savedState?.checkedProductIds) ? savedState.checkedProductIds : []);
    this.#weekStartDate = resolveWeekStart(savedState?.weekStart);
    try {
      this.#plan = savedState?.plan && typeof savedState.plan === 'object'
        ? restorePlan(savedState.plan, this.#planningSettings())
        : generatePlan(this.#planningSettings());
      // La semaine enregistrée est terminée : on passe à la suivante comme avec « Nouvelle semaine ».
      if (typeof savedState?.weekStart === 'string' && savedState.weekStart !== toIsoDate(this.#weekStartDate)) {
        this.#startNextWeek();
      }
    } catch (restoreError) {
      console.warn('Semaine enregistrée illisible, nouvelle semaine générée.', restoreError);
      this.#checkedProductIds = new Set();
      this.#weekStartDate = getUpcomingMonday();
      this.#plan = generatePlan(this.#planningSettings());
    }
  }

  // Les préférences voyagent avec les réglages jusqu'au générateur, sans être des champs du formulaire.
  #planningSettings() {
    return { ...this.#settings, preferences: this.#preferences, pantryStock: this.#pantryStock, storeSetup: this.#storeSetup };
  }

  // Une saisie encore en attente est appliquée (et donc enregistrée) avant de quitter la page.
  destroy() {
    this.#debouncedSettingsUpdate.flush();
    this.#listenersController.abort();
    clearTimeout(this.#copyStatusTimeoutId);
    clearTimeout(this.#undoTimeoutId);
    this.#cookMode.destroy();
    this.#storeWakeLock.disable();
    this.#removeInstallButton();
  }

  #attachListeners() {
    const { signal } = this.#listenersController;
    const { settingsForm, planList, receipt, regenerateButton, copyButton, uncheckButton } = this.#elements;

    // Une appli mise en arrière-plan peut être tuée sans « pagehide » : la saisie en attente est enregistrée dès maintenant.
    this.#elements.body.ownerDocument.addEventListener('visibilitychange', () => {
      if (this.#elements.body.ownerDocument.visibilityState === 'hidden') {
        this.#debouncedSettingsUpdate.flush();
      }
    }, { signal });
    settingsForm.addEventListener('submit', (submitEvent) => submitEvent.preventDefault(), { signal });
    settingsForm.addEventListener('input', (inputEvent) => this.#handleSettingsInput(inputEvent), { signal });
    settingsForm.addEventListener('change', (changeEvent) => this.#handleSettingsCommit(changeEvent), { signal });
    regenerateButton.addEventListener('click', () => this.#regenerateWeek(), { signal });
    planList.addEventListener('click', (clickEvent) => this.#handlePlanClick(clickEvent), { signal });
    // L'événement « error » d'une image ne remonte pas : on l'écoute en phase de capture.
    planList.addEventListener('error', (errorEvent) => this.#hideMissingPhoto(errorEvent), { signal, capture: true });
    receipt.addEventListener('change', (changeEvent) => this.#handleReceiptCheck(changeEvent), { signal });
    receipt.addEventListener('click', (clickEvent) => this.#handleReceiptClick(clickEvent), { signal });
    this.#elements.hideCheckedButton.addEventListener('click', () => this.#toggleHideChecked(), { signal });
    this.#elements.undoButton.addEventListener('click', () => this.#undoLastAction(), { signal });
    this.#elements.addItemForm.addEventListener('submit', (submitEvent) => this.#handleAddItem(submitEvent), { signal });
    this.#elements.clearMissingButton.addEventListener('click', () => this.#updateStoreSetup(clearMissingProducts(this.#storeSetup)), { signal });
    this.#elements.resetAislesButton.addEventListener('click', () => this.#updateStoreSetup(resetAisleOrder(this.#storeSetup)), { signal });
    copyButton.addEventListener('click', () => this.#copyShoppingList(), { signal });
    uncheckButton.addEventListener('click', () => this.#uncheckAll(), { signal });
    this.#elements.resetDislikesButton.addEventListener('click', () => this.#resetDislikes(), { signal });
    this.#elements.clearStockButton.addEventListener('click', () => this.#clearStock(), { signal });
    this.#elements.storeModeButton.addEventListener('click', () => this.#toggleStoreMode(), { signal });
    this.#elements.addWeightButton.addEventListener('click', () => this.#recordWeight(), { signal });
    this.#elements.weightEntryInput.addEventListener('keydown', (keyEvent) => {
      if (keyEvent.key === 'Enter') {
        keyEvent.preventDefault();
        this.#recordWeight();
      }
    }, { signal });
  }

  #handleSettingsInput(inputEvent) {
    // Les champs sans nom (poids du jour) ne sont pas des réglages : ils ont leur propre bouton.
    if (!inputEvent.target.name || FIELDS_APPLIED_ON_COMMIT_ONLY.has(inputEvent.target.name)) {
      return;
    }
    if (inputEvent.target.type === 'number') {
      // Pendant la frappe, « 9 » avant « 95 » est hors limites : seules les valeurs valides
      // sont appliquées, sinon un poids ou un âge provisoire remplacerait des plats.
      if (inputEvent.target.checkValidity()) {
        this.#debouncedSettingsUpdate.run();
      } else {
        this.#debouncedSettingsUpdate.cancel();
      }
      return;
    }
    this.#applySettingsFromForm();
  }

  // Les champs numériques ne sont réécrits qu'à la sortie du champ, pour ne pas
  // corriger la saisie pendant que la personne tape encore.
  #handleSettingsCommit(changeEvent) {
    if (changeEvent.target.type !== 'number' || !changeEvent.target.name) {
      return;
    }
    this.#debouncedSettingsUpdate.cancel();
    // Un champ vidé ou hors limites reprend sa valeur précédente au lieu d'imposer la valeur par défaut.
    if (changeEvent.target.checkValidity()) {
      this.#applySettingsFromForm();
    }
    writeSettingsToForm(this.#elements.settingsForm, this.#settings);
  }

  // Changer la priorité change la façon de choisir les plats : elle ne peut s'appliquer
  // qu'en refaisant la semaine. Les autres réglages gardent les plats encore compatibles.
  // Un champ numérique en cours de frappe (« 9 » avant « 95 ») garde sa valeur précédente,
  // même quand c'est un autre réglage qui déclenche la mise à jour.
  #readValidSettings(previousSettings) {
    const formSettings = readSettingsFromForm(this.#elements.settingsForm);
    const invalidFieldNames = [...this.#elements.settingsForm.querySelectorAll('input[type="number"][name]')]
      .filter((numberInput) => !numberInput.checkValidity())
      .map((numberInput) => numberInput.name);
    const keptValues = Object.fromEntries(invalidFieldNames.map((fieldName) => [fieldName, previousSettings[fieldName]]));
    return normalizeSettings({ ...formSettings, ...keptValues });
  }

  #applySettingsFromForm() {
    const previousSettings = this.#settings;
    this.#settings = this.#readValidSettings(previousSettings);
    if (this.#settings.priority !== previousSettings.priority) {
      this.#rerollMenus();
      return;
    }
    this.#plan = reconcilePlan(this.#plan, this.#planningSettings(), Math.random, {
      previousTotalToPay: this.#shoppingList?.totalToPay ?? Number.POSITIVE_INFINITY,
      budgetChanged: this.#settings.weeklyBudget !== previousSettings.weeklyBudget,
    });
    this.#renderAll();
  }

  // Refaire les menus de la même semaine : rien n'a été mangé ni acheté entre-temps,
  // donc ni stock de restes, ni historique, ni cases décochées.
  #rerollMenus() {
    this.#swapHistoryBySlot.clear();
    this.#plan = generatePlan(this.#planningSettings());
    this.#renderAll();
  }

  #regenerateWeek() {
    const hasCheckedItems = this.#checkedProductIds.size > 0;
    // Une liste cochée veut dire des courses faites : la remplacer est une décision à confirmer.
    if (hasCheckedItems && !window.confirm('Passer à la semaine suivante ? Les articles cochés seront comptés comme achetés et la liste sera remise à zéro.')) {
      return;
    }
    this.#startNextWeek();
    this.#renderAll();
  }

  // Passer à une nouvelle semaine : on retient ses plats (pour ne pas les resservir tout de suite)
  // et, si des courses ont été cochées, ce qu'il reste en stock pour la semaine suivante.
  #startNextWeek() {
    if (hasShoppingEvidence(this.#checkedProductIds)) {
      const planningSettings = this.#planningSettings();
      const shoppingList = buildShoppingList(this.#plan, planningSettings);
      const eatenShoppingList = buildShoppingList(buildEatenPlan(this.#plan, this.#cookedMeals), planningSettings);
      this.#pantryStock = computeNextStock({
        stock: this.#pantryStock,
        shoppingList,
        checkedProductIds: this.#checkedProductIds,
        eatenShoppingList,
      });
    }
    this.#cookedMeals = {};
    this.#preferences = rememberWeek(this.#preferences, this.#plan.mainRecipeIds);
    this.#swapHistoryBySlot.clear();
    this.#extraItems = keepUnboughtExtraItems(this.#extraItems, this.#checkedProductIds);
    this.#checkedProductIds.clear();
    // Toujours la semaine qui commence au prochain lundi (ou aujourd'hui si on est lundi) :
    // préparée le samedi, elle ne doit pas garder la date de la semaine en cours,
    // sinon elle serait jugée terminée et remplacée dès le lundi.
    this.#weekStartDate = getUpcomingMonday();
    this.#plan = generatePlan(this.#planningSettings());
  }

  #toggleStoreMode() {
    this.#isStoreMode = !this.#isStoreMode;
    this.#applyStoreMode();
    this.#persist();
  }

  #applyStoreMode() {
    const { body, storeModeButton, receipt } = this.#elements;
    body.classList.toggle('is-store-mode', this.#isStoreMode);
    storeModeButton.setAttribute('aria-pressed', String(this.#isStoreMode));
    storeModeButton.textContent = this.#isStoreMode ? 'Quitter le mode magasin' : 'Mode magasin';
    if (this.#isStoreMode) {
      this.#storeWakeLock.enable();
      receipt.scrollIntoView({ block: 'start' });
    } else {
      this.#storeWakeLock.disable();
    }
  }

  #toggleHideChecked() {
    this.#hidesCheckedItems = !this.#hidesCheckedItems;
    this.#applyHideChecked();
    this.#persist();
  }

  #applyHideChecked() {
    const { body, hideCheckedButton } = this.#elements;
    body.classList.toggle('hides-checked', this.#hidesCheckedItems);
    hideCheckedButton.setAttribute('aria-pressed', String(this.#hidesCheckedItems));
    hideCheckedButton.textContent = this.#hidesCheckedItems ? 'Afficher les cochés' : 'Masquer les cochés';
  }

  #handleReceiptClick(clickEvent) {
    const aisleButton = clickEvent.target.closest('.aisle-move');
    if (aisleButton) {
      const listedAisles = this.#shoppingList.aisleGroups.map((group) => group.aisle);
      const direction = Number(aisleButton.dataset.direction);
      this.#updateStoreSetup(moveAisle(this.#storeSetup, aisleButton.dataset.aisle, direction, listedAisles));
      this.#focusAisleButton(aisleButton.dataset.aisle, direction);
      return;
    }
    const removeButton = clickEvent.target.closest('.remove-extra-button');
    if (removeButton) {
      this.#extraItems = removeExtraItem(this.#extraItems, removeButton.dataset.extraId);
      this.#checkedProductIds.delete(removeButton.dataset.extraId);
      this.#renderAll();
      return;
    }
    const missingButton = clickEvent.target.closest('.missing-button');
    if (missingButton) {
      this.#toggleMissing(missingButton.closest('.receipt-line'), missingButton.dataset.missingProductId);
    }
  }

  // Les suggestions du champ d'ajout : les produits du catalogue, rangés et chiffrés automatiquement.
  #fillCatalogSuggestions() {
    const productNames = [...new Set(PRODUCTS.map((product) => product.name))].sort((first, second) => first.localeCompare(second, 'fr'));
    replaceChildrenWithFragment(this.#elements.catalogProductList, productNames.map((productName) => createElement('option', { attributes: { value: productName } })));
  }

  #handleAddItem(submitEvent) {
    submitEvent.preventDefault();
    const { addItemInput } = this.#elements;
    const nextExtraItems = addExtraItem(this.#extraItems, addItemInput.value);
    addItemInput.value = '';
    addItemInput.focus();
    if (nextExtraItems === this.#extraItems) {
      return;
    }
    this.#extraItems = nextExtraItems;
    this.#renderAll();
  }

  // Seule la ligne touchée change dans le ticket : le reconstruire ferait sauter la liste
  // et réapparaître les articles masqués. Les menus, eux, affichent l'alerte sur les plats concernés.
  #toggleMissing(lineElement, productId) {
    const product = PRODUCTS_BY_ID.get(productId);
    if (!lineElement || !product) {
      return;
    }
    this.#storeSetup = toggleMissingProduct(this.#storeSetup, productId);
    updateMissingLine(lineElement, product, this.#storeSetup.missingProductIds.includes(productId));
    lineElement.querySelector('.missing-button')?.focus();
    this.#updateGroupCompletion(lineElement.closest('.receipt-group'));
    this.#updateProgress();
    this.#renderPlanning();
    this.#persist();
  }

  // Le ticket est reconstruit après un déplacement : on rend le focus à la même flèche
  // pour pouvoir enchaîner les appuis sans chercher le rayon.
  #focusAisleButton(aisle, direction) {
    const sameButton = [...this.#elements.receipt.querySelectorAll('.aisle-move')]
      .find((button) => button.dataset.aisle === aisle && Number(button.dataset.direction) === direction);
    sameButton?.focus();
  }

  // Le magasin ne change pas la semaine en cours : les plats déjà prévus restent,
  // seuls les prochains tirages (« Changer », « Nouvelle semaine ») en tiennent compte.
  #updateStoreSetup(nextStoreSetup) {
    if (nextStoreSetup === this.#storeSetup) {
      return;
    }
    this.#storeSetup = nextStoreSetup;
    this.#renderAll();
  }

  #clearStock() {
    this.#pantryStock = {};
    this.#plan = reconcilePlan(this.#plan, this.#planningSettings());
    this.#renderAll();
  }

  #handlePlanClick(clickEvent) {
    const actionButton = clickEvent.target.closest('[data-action]');
    if (!actionButton) {
      return;
    }
    const { action, planKind, slotIndex, recipeId } = actionButton.dataset;
    const slotNumber = Number.parseInt(slotIndex, 10);
    if (action === 'cook') {
      const recipe = RECIPES_BY_ID.get(recipeId);
      const getServings = SERVINGS_BY_PLAN_KIND[planKind];
      if (recipe && getServings) {
        const onFinish = planKind === PLAN_KINDS.MAIN ? () => this.#markCookedAfterCooking(slotNumber, recipeId) : null;
        this.#cookMode.open(recipe, getServings(this.#settings), this.#planningSettings(), { onFinish });
      }
      return;
    }
    if (action === 'cooked') {
      const isCooked = isMealCooked(this.#cookedMeals, this.#plan, slotNumber);
      this.#cookedMeals = setMealCooked(this.#cookedMeals, this.#plan, slotNumber, !isCooked);
      this.#renderPlanning();
      this.#persist();
      this.#elements.planList.querySelector(`[data-action="cooked"][data-slot-index="${slotIndex}"]`)?.focus();
      return;
    }
    if (action === 'like') {
      this.#preferences = toggleLiked(this.#preferences, recipeId);
    } else if (action === 'dislike') {
      this.#dislikeRecipe(recipeId);
      return;
    } else if (action === 'swap') {
      this.#swapSlot(planKind, slotNumber, recipeId);
    } else {
      return;
    }
    this.#renderAll();
    this.#elements.planList.querySelector(`[data-action="${action}"][data-plan-kind="${planKind}"][data-slot-index="${slotIndex}"]`)?.focus();
  }

  // Une nouvelle pesée met aussi à jour le poids du profil : l'objectif calorique suit la perte.
  #recordWeight() {
    const { weightEntryInput } = this.#elements;
    const weightKg = Number.parseFloat(weightEntryInput.value.replace(',', '.'));
    if (!isValidWeight(weightKg)) {
      this.#elements.weightAdvice.textContent = 'Indique un poids entre 40 et 250 kg, par exemple 84,6.';
      weightEntryInput.focus();
      return;
    }
    this.#weightLog = addWeightEntry(this.#weightLog, toIsoDate(new Date()), weightKg);
    this.#settings = normalizeSettings({ ...this.#settings, weightKg });
    writeSettingsToForm(this.#elements.settingsForm, this.#settings);
    weightEntryInput.value = '';
    this.#plan = reconcilePlan(this.#plan, this.#planningSettings());
    this.#renderAll();
  }

  #swapSlot(planKind, slotNumber, currentRecipeId) {
    const slotKey = `${planKind}:${slotNumber}`;
    const avoidedRecipeIds = [currentRecipeId, ...(this.#swapHistoryBySlot.get(slotKey) ?? [])].slice(0, SWAP_HISTORY_LENGTH);
    this.#swapHistoryBySlot.set(slotKey, avoidedRecipeIds);
    this.#plan = swapMeal(this.#plan, planKind, slotNumber, this.#planningSettings(), Math.random, { avoidedRecipeIds });
  }

  // Le créneau a pu changer de plat pendant la cuisine : on ne coche que s'il s'agit du même.
  #markCookedAfterCooking(slotNumber, recipeId) {
    if (this.#plan.mainRecipeIds[slotNumber] !== recipeId) {
      return;
    }
    this.#cookedMeals = setMealCooked(this.#cookedMeals, this.#plan, slotNumber, true);
    this.#renderPlanning();
    this.#persist();
  }

  // Le plat est retiré de tous les jours où il apparaît. Un appui raté se rattrape avec « Annuler ».
  #dislikeRecipe(recipeId) {
    const recipe = RECIPES_BY_ID.get(recipeId);
    if (!recipe) {
      return;
    }
    const previousState = { plan: this.#plan, preferences: this.#preferences };
    this.#preferences = markDisliked(this.#preferences, recipeId);
    this.#plan = reconcilePlan(this.#plan, this.#planningSettings());
    this.#renderAll();
    this.#offerUndo(`« ${recipe.name} » écarté.`, () => {
      this.#plan = previousState.plan;
      this.#preferences = previousState.preferences;
      this.#renderAll();
    });
  }

  #offerUndo(message, undoAction) {
    clearTimeout(this.#undoTimeoutId);
    this.#undoAction = undoAction;
    this.#elements.undoMessage.textContent = message;
    this.#elements.undoToast.hidden = false;
    this.#undoTimeoutId = setTimeout(() => this.#closeUndo(), UNDO_DURATION_MILLISECONDS);
  }

  #undoLastAction() {
    const undoAction = this.#undoAction;
    this.#closeUndo();
    undoAction?.();
  }

  #closeUndo() {
    clearTimeout(this.#undoTimeoutId);
    this.#undoTimeoutId = null;
    this.#undoAction = null;
    this.#elements.undoToast.hidden = true;
  }

  #resetDislikes() {
    this.#preferences = clearDisliked(this.#preferences);
    this.#renderAll();
  }

  #hideMissingPhoto(errorEvent) {
    if (errorEvent.target instanceof HTMLImageElement && errorEvent.target.classList.contains('meal-photo')) {
      errorEvent.target.hidden = true;
    }
  }

  #handleReceiptCheck(changeEvent) {
    const { productId } = changeEvent.target.dataset;
    if (!productId) {
      return;
    }
    if (changeEvent.target.checked) {
      this.#checkedProductIds.add(productId);
    } else {
      this.#checkedProductIds.delete(productId);
    }
    changeEvent.target.closest('.receipt-line')?.classList.toggle('is-checked', changeEvent.target.checked);
    this.#updateGroupCompletion(changeEvent.target.closest('.receipt-group'));
    this.#updateProgress();
    this.#persist();
  }

  #updateGroupCompletion(groupElement) {
    if (!groupElement) {
      return;
    }
    const lineProductIds = [...groupElement.querySelectorAll('.receipt-line')].map((lineElement) => lineElement.dataset.productId);
    const isComplete = lineProductIds.every((productId) => isLineDone(productId, this.#checkedProductIds, this.#storeSetup));
    groupElement.classList.toggle('is-complete', isComplete);
  }

  #uncheckAll() {
    this.#checkedProductIds.clear();
    this.#renderReceipt();
    this.#persist();
  }

  async #copyShoppingList() {
    const shoppingListText = buildShoppingListText(this.#shoppingList, this.#settings, this.#weekStartDate);
    const { copyFallback } = this.#elements;
    try {
      await navigator.clipboard.writeText(shoppingListText);
      copyFallback.hidden = true;
      this.#showCopyStatus('Liste copiée dans le presse-papiers.');
    } catch (clipboardError) {
      console.warn('Copie automatique refusée, affichage du texte à copier.', clipboardError);
      copyFallback.value = shoppingListText;
      copyFallback.hidden = false;
      copyFallback.focus();
      copyFallback.select();
      this.#showCopyStatus('Copie automatique indisponible : le texte est sélectionné, copiez-le avec Ctrl+C ou un appui long.');
    }
  }

  #showCopyStatus(message) {
    clearTimeout(this.#copyStatusTimeoutId);
    this.#elements.copyStatus.textContent = message;
    this.#copyStatusTimeoutId = setTimeout(() => {
      this.#elements.copyStatus.textContent = '';
    }, COPY_STATUS_DURATION_MILLISECONDS);
  }

  #renderAll() {
    // Les ajouts à la main vont sur la liste mais restent hors du choix des menus et du budget.
    this.#shoppingList = buildShoppingList(this.#plan, { ...this.#planningSettings(), extraItems: this.#extraItems });
    this.#renderPlanning();
    this.#renderReceipt();
    this.#persist();
  }

  // Tout sauf le ticket : réglages, résumé, menus et suivi du poids.
  #renderPlanning() {
    const planningSettings = this.#planningSettings();
    this.#elements.profileFields.hidden = !hasWeightLossGoal(this.#settings);
    renderGoalHint(this.#elements.goalHint, this.#settings);
    const cookedSlotIndexes = new Set(listCookedSlotIndexes(this.#cookedMeals, this.#plan));
    renderSummary(this.#elements.summary, this.#shoppingList, this.#settings, cookedSlotIndexes.size);
    renderPlan(this.#elements.planList, this.#plan, planningSettings, this.#weekStartDate, cookedSlotIndexes);
    renderPreferencesSummary(this.#elements.preferencesSummary, this.#elements.resetDislikesButton, this.#preferences);
    renderStockSummary(this.#elements.stockSummary, this.#elements.clearStockButton, describeStock(this.#pantryStock));
    renderStoreSummary({
      summaryElement: this.#elements.storeSummary,
      clearMissingButton: this.#elements.clearMissingButton,
      resetAislesButton: this.#elements.resetAislesButton,
    }, this.#storeSetup);
    renderWeightTracker({
      chartContainer: this.#elements.weightChartContainer,
      adviceElement: this.#elements.weightAdvice,
      weightLog: this.#weightLog,
      pantryStock: this.#pantryStock,
      analysis: analyzeWeightTrend(this.#weightLog, toIsoDate(new Date())),
    });
  }

  #renderReceipt() {
    renderReceipt(this.#elements.receipt, this.#shoppingList, this.#planningSettings(), this.#checkedProductIds, this.#weekStartDate);
    this.#updateProgress();
  }

  #updateProgress() {
    const listedProductIds = this.#shoppingList.aisleGroups.flatMap((group) => [
      ...group.lines.map((line) => line.product.id),
      ...group.extraLines.map((line) => line.extra.id),
    ]);
    const checkedCount = listedProductIds.filter((productId) => isLineDone(productId, this.#checkedProductIds, this.#storeSetup)).length;
    updateReceiptProgress(this.#elements.receipt, checkedCount, listedProductIds.length);
  }

  #persist() {
    saveState({
      settings: this.#settings,
      plan: this.#plan,
      weekStart: toIsoDate(this.#weekStartDate),
      preferences: this.#preferences,
      weightLog: this.#weightLog,
      pantryStock: this.#pantryStock,
      checkedProductIds: [...this.#checkedProductIds],
      storeSetup: this.#storeSetup,
      extraItems: this.#extraItems,
      cookedMeals: this.#cookedMeals,
      interface: { isStoreMode: this.#isStoreMode, hidesCheckedItems: this.#hidesCheckedItems },
    });
  }
}

// Le mode hors ligne n'a de sens que sur un vrai site (https ou localhost) ;
// ailleurs (aperçu intégré, fichier local) l'appli fonctionne simplement sans.
async function registerOfflineSupport() {
  const isSecureSite = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
  if (!('serviceWorker' in navigator) || !isSecureSite) {
    return;
  }
  try {
    await navigator.serviceWorker.register('sw.js');
  } catch (registrationError) {
    console.info('Mode hors ligne indisponible ici.', registrationError);
  }
}

const weeklyPlannerApp = new WeeklyPlannerApp(document);
weeklyPlannerApp.start();
registerOfflineSupport();
// Une page mise en cache (bfcache, persisted) peut être restaurée : on ne détruit que les sorties définitives.
function destroyOnFinalPageExit(pagehideEvent) {
  if (pagehideEvent.persisted) {
    return;
  }
  weeklyPlannerApp.destroy();
  window.removeEventListener('pagehide', destroyOnFinalPageExit);
}
window.addEventListener('pagehide', destroyOnFinalPageExit);
