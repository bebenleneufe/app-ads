import { PRODUCTS, PRODUCTS_BY_ID } from './catalog.js';
import { CookMode } from './cook-mode.js';
import {
  buildEatenPlan,
  isMealCooked,
  listCookedSlotIndexes,
  normalizeCookedMeals,
  remapCookedMeals,
  setMealCooked,
} from './cooked-meals.js';
import { createElement, debounce, replaceChildrenWithFragment } from './dom.js';
import { addExtraItem, keepUnboughtExtraItems, normalizeExtraItems, removeExtraItem } from './extra-items.js';
import { setUpInstallButton } from './install-prompt.js';
import { buildShoppingListText } from './list-text.js';
import { createMainSlotMapper, generatePlan, PLAN_KINDS, reconcilePlan, restorePlan, swapMeal } from './planner.js';
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
  renderNextRecipe,
  renderPlan,
  renderPreferencesSummary,
  renderReceipt,
  renderSettingsRecap,
  renderStockSummary,
  renderStoreSummary,
  renderSummary,
  updateCookedCard,
  updateMissingLine,
  updateReceiptProgress,
} from './render.js';
import { normalizeSettings, readSettingsFromForm, writeSettingsToForm } from './settings.js';
import { buildShoppingList } from './shopping-list.js';
import { renderWeightTracker } from './render-weight.js';
import { computeNextStock, describeStock, hasShoppingEvidence, normalizeStock } from './stock.js';
import { isSavedStateChange, loadSavedState, saveState } from './storage.js';
import {
  clearMissingProducts,
  moveAisle,
  normalizeStoreSetup,
  resetAisleOrder,
  toggleMissingProduct,
} from './store-setup.js';
import { UndoToast } from './undo-toast.js';
import { createScreenWakeLock } from './wake-lock.js';
import { addWeightEntry, analyzeWeightTrend, isValidWeight, normalizeWeightLog } from './weight-log.js';
import { formatFullDate } from './format.js';
import { createWeekSnapshot, normalizeWeekSnapshot, recoverSnapshotFromHistory } from './week-history.js';
import { getUpcomingMonday, isWeekOver, resolveWeekStart, shiftWeek, toIsoDate } from './week.js';

const SETTINGS_DEBOUNCE_MILLISECONDS = 300;
const COPY_STATUS_DURATION_MILLISECONDS = 4000;
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
  // Copie de la semaine remplacée par « Nouvelle semaine », pour pouvoir y revenir.
  #previousWeek = null;
  #isHistoryRecoveryDone = false;
  // Le mode magasin est retenu : si le téléphone ferme l'appli au milieu des rayons, on y revient.
  #isStoreMode = false;
  #hidesCheckedItems = false;
  #showsCookedMeals = false;
  #shoppingList = null;
  #weekStartDate = getUpcomingMonday();
  #listenersController = new AbortController();
  #debouncedSettingsUpdate = debounce(() => this.#applySettingsFromForm(), SETTINGS_DEBOUNCE_MILLISECONDS);
  #copyStatusTimeoutId = null;
  #undoToast;
  // Jour où le mode magasin a été ouvert : rouvrir l'appli un autre jour revient à la vue normale.
  #storeModeDate = null;
  #planActionHandlers = Object.freeze({
    cook: (planAction) => this.#openCookMode(planAction),
    cooked: (planAction) => this.#toggleCooked(planAction.slotNumber),
    like: (planAction) => this.#toggleLike(planAction.recipeId),
    dislike: (planAction) => this.#dislikeRecipe(planAction.recipeId),
    swap: (planAction) => this.#swapSlot(planAction),
  });

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
      storeModeEnterButton: rootDocument.getElementById('store-mode-enter-button'),
      installButton: rootDocument.getElementById('install-button'),
      installHelp: rootDocument.getElementById('install-help'),
      hideCheckedButton: rootDocument.getElementById('hide-checked-button'),
      planSection: rootDocument.getElementById('plan-section'),
      goalRecap: rootDocument.getElementById('goal-recap'),
      mealsRecap: rootDocument.getElementById('meals-recap'),
      shoppingRecap: rootDocument.getElementById('shopping-recap'),
      nextRecipeSection: rootDocument.getElementById('next-recipe'),
      nextRecipeCard: rootDocument.getElementById('next-recipe-card'),
      nextRecipeProgress: rootDocument.getElementById('next-recipe-progress'),
      showCookedButton: rootDocument.getElementById('show-cooked-button'),
      weekOver: rootDocument.getElementById('week-over'),
      weekOverText: rootDocument.getElementById('week-over-text'),
      weekOverButton: rootDocument.getElementById('week-over-button'),
      restoreWeekButton: rootDocument.getElementById('restore-week-button'),
      storeSummary: rootDocument.getElementById('store-summary'),
      clearMissingButton: rootDocument.getElementById('clear-missing-button'),
      resetAislesButton: rootDocument.getElementById('reset-aisles-button'),
      addItemForm: rootDocument.getElementById('add-item-form'),
      addItemInput: rootDocument.getElementById('add-item-input'),
      catalogProductList: rootDocument.getElementById('catalog-products'),
      apkLink: rootDocument.getElementById('apk-link'),
      body: rootDocument.body,
    };
    this.#elements.numberInputs = [...this.#elements.settingsForm.querySelectorAll('input[type="number"][name]')];
    this.#cookMode = new CookMode(rootDocument.getElementById('cook-dialog'));
    this.#undoToast = new UndoToast({
      toast: rootDocument.getElementById('undo-toast'),
      message: rootDocument.getElementById('undo-message'),
      button: rootDocument.getElementById('undo-button'),
    });
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
    this.#leaveForgottenStoreMode();
    if (this.#isStoreMode) {
      this.#applyStoreMode();
    }
  }

  // Un mode magasin oublié (liste finie, ou ouvert un autre jour) ne doit pas cacher la recette suivante.
  #leaveForgottenStoreMode() {
    const isAnotherDay = this.#storeModeDate !== toIsoDate(new Date());
    const { doneCount, lineCount } = this.#countReceiptLines();
    if (this.#isStoreMode && (isAnotherDay || (lineCount > 0 && doneCount === lineCount))) {
      this.#isStoreMode = false;
      this.#persist();
    }
  }

  // Une autre fenêtre (appli installée et navigateur) ou une page restaurée du cache a pu
  // enregistrer d'autres données : on les relit, sinon la prochaine action les écraserait.
  #reloadSavedState() {
    const wasStoreMode = this.#isStoreMode;
    this.#debouncedSettingsUpdate.cancel();
    this.#undoToast.close();
    this.#swapHistoryBySlot.clear();
    this.#restoreSavedState();
    writeSettingsToForm(this.#elements.settingsForm, this.#settings);
    this.#renderWithoutSaving();
    this.#applyHideChecked();
    if (wasStoreMode !== this.#isStoreMode) {
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
    this.#storeModeDate = typeof savedState?.interface?.storeModeDate === 'string' ? savedState.interface.storeModeDate : null;
    this.#hidesCheckedItems = savedState?.interface?.hidesCheckedItems === true;
    this.#showsCookedMeals = savedState?.interface?.showsCookedMeals === true;
    this.#checkedProductIds = new Set(Array.isArray(savedState?.checkedProductIds) ? savedState.checkedProductIds : []);
    this.#weekStartDate = resolveWeekStart(savedState?.weekStart);
    this.#previousWeek = normalizeWeekSnapshot(savedState?.previousWeek);
    this.#isHistoryRecoveryDone = savedState?.isHistoryRecoveryDone === true;
    // Une semaine terminée reste affichée (bandeau « Semaine terminée ») : plus de passage automatique.
    try {
      this.#plan = savedState?.plan && typeof savedState.plan === 'object'
        ? restorePlan(savedState.plan, this.#planningSettings())
        : generatePlan(this.#planningSettings());
      this.#recoverPreviousWeekOnce(savedState);
    } catch (restoreError) {
      console.warn('Semaine enregistrée illisible, nouvelle semaine générée.', restoreError);
      this.#checkedProductIds = new Set();
      this.#weekStartDate = getUpcomingMonday();
      this.#plan = generatePlan(this.#planningSettings());
    }
  }

  // Avant cette version, une semaine terminée était remplacée d'office sans copie : ses plats
  // restent en tête de l'historique, d'où on la reconstitue une seule fois.
  #recoverPreviousWeekOnce(savedState) {
    if (!savedState || this.#isHistoryRecoveryDone || this.#previousWeek) {
      this.#isHistoryRecoveryDone = true;
      return;
    }
    this.#isHistoryRecoveryDone = true;
    this.#previousWeek = recoverSnapshotFromHistory({
      preferences: this.#preferences,
      currentPlan: this.#plan,
      previousWeekStart: toIsoDate(shiftWeek(this.#weekStartDate, -1)),
      slotCount: this.#plan.mainRecipeIds.length,
    });
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
    this.#undoToast.destroy();
    this.#cookMode.destroy();
    this.#storeWakeLock.disable();
    this.#removeInstallButton();
  }

  #attachListeners() {
    const { signal } = this.#listenersController;
    const { settingsForm, planList, receipt, regenerateButton, copyButton, uncheckButton } = this.#elements;
    const rootWindow = this.#elements.body.ownerDocument.defaultView;

    rootWindow.addEventListener('storage', (storageEvent) => {
      if (isSavedStateChange(storageEvent)) {
        this.#reloadSavedState();
      }
    }, { signal });
    rootWindow.addEventListener('pageshow', (pageshowEvent) => {
      if (pageshowEvent.persisted) {
        this.#reloadSavedState();
      }
    }, { signal });

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
    this.#elements.weekOverButton.addEventListener('click', () => this.#regenerateWeek(), { signal });
    this.#elements.restoreWeekButton.addEventListener('click', () => this.#resumePreviousWeek(), { signal });
    planList.addEventListener('click', (clickEvent) => this.#handlePlanClick(clickEvent), { signal });
    // L'événement « error » d'une image ne remonte pas : on l'écoute en phase de capture.
    planList.addEventListener('error', (errorEvent) => this.#hideMissingPhoto(errorEvent), { signal, capture: true });
    // La carte « Recette suivante » a les mêmes boutons que dans la semaine.
    this.#elements.nextRecipeSection.addEventListener('click', (clickEvent) => this.#handlePlanClick(clickEvent), { signal });
    this.#elements.nextRecipeSection.addEventListener('error', (errorEvent) => this.#hideMissingPhoto(errorEvent), { signal, capture: true });
    receipt.addEventListener('change', (changeEvent) => this.#handleReceiptCheck(changeEvent), { signal });
    receipt.addEventListener('click', (clickEvent) => this.#handleReceiptClick(clickEvent), { signal });
    this.#elements.hideCheckedButton.addEventListener('click', () => this.#toggleHideChecked(), { signal });
    this.#elements.showCookedButton.addEventListener('click', () => this.#toggleShowCooked(), { signal });
    this.#elements.addItemForm.addEventListener('submit', (submitEvent) => this.#handleAddItem(submitEvent), { signal });
    this.#elements.clearMissingButton.addEventListener('click', () => this.#updateStoreSetup(clearMissingProducts(this.#storeSetup)), { signal });
    this.#elements.resetAislesButton.addEventListener('click', () => this.#updateStoreSetup(resetAisleOrder(this.#storeSetup)), { signal });
    copyButton.addEventListener('click', () => this.#copyShoppingList(), { signal });
    uncheckButton.addEventListener('click', () => this.#uncheckAll(), { signal });
    this.#elements.resetDislikesButton.addEventListener('click', () => this.#resetDislikes(), { signal });
    this.#elements.clearStockButton.addEventListener('click', () => this.#clearStock(), { signal });
    this.#elements.storeModeButton.addEventListener('click', () => this.#toggleStoreMode(), { signal });
    this.#elements.storeModeEnterButton.addEventListener('click', () => this.#toggleStoreMode(), { signal });
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
    const invalidFieldNames = this.#elements.numberInputs
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
    this.#reconcileKeepingCooked({
      previousTotalToPay: this.#shoppingList?.totalToPay ?? Number.POSITIVE_INFINITY,
      budgetChanged: this.#settings.weeklyBudget !== previousSettings.weeklyBudget,
    });
    this.#renderAll();
  }

  // Un plat déjà cuisiné a été mangé et acheté : aucun réglage ni refus ne le remplace.
  // Les marques « cuisiné » suivent leur plat si les créneaux sont renumérotés.
  #reconcileKeepingCooked(reconcileOptions = {}) {
    const previousPlan = this.#plan;
    const planningSettings = this.#planningSettings();
    this.#plan = reconcilePlan(previousPlan, planningSettings, Math.random, {
      ...reconcileOptions,
      lockedSlotIndexes: listCookedSlotIndexes(this.#cookedMeals, previousPlan),
    });
    this.#cookedMeals = remapCookedMeals(this.#cookedMeals, previousPlan, this.#plan, createMainSlotMapper(previousPlan, planningSettings));
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
    this.#undoToast.offer('Nouvelle semaine préparée.', () => this.#swapWithPreviousWeek());
  }

  // Les deux semaines sont échangées, jamais écrasées : un appui par erreur se rattrape
  // avec « Annuler » ou en reprenant l'autre semaine.
  #resumePreviousWeek() {
    const previousWeekStart = this.#previousWeek?.weekStart;
    if (!previousWeekStart) {
      return;
    }
    this.#swapWithPreviousWeek();
    this.#undoToast.offer(`Semaine du ${formatFullDate(resolveWeekStart(previousWeekStart))} reprise.`, () => this.#swapWithPreviousWeek());
  }

  #swapWithPreviousWeek() {
    const previousWeek = this.#previousWeek;
    if (!previousWeek) {
      return;
    }
    const currentWeek = this.#createCurrentWeekSnapshot();
    this.#applyWeekSnapshot(previousWeek);
    this.#previousWeek = currentWeek;
    this.#renderAll();
  }

  #createCurrentWeekSnapshot() {
    return createWeekSnapshot({
      plan: this.#plan,
      weekStart: toIsoDate(this.#weekStartDate),
      cookedMeals: this.#cookedMeals,
      checkedProductIds: this.#checkedProductIds,
      extraItems: this.#extraItems,
      pantryStock: this.#pantryStock,
      preferences: this.#preferences,
    });
  }

  // Une semaine reconstituée depuis l'historique n'a ni préférences, ni stock, ni ajouts : on garde les actuels.
  #applyWeekSnapshot(snapshot) {
    if (snapshot.preferences) {
      this.#preferences = normalizePreferences(snapshot.preferences, RECIPES_BY_ID);
    }
    if (snapshot.pantryStock) {
      this.#pantryStock = normalizeStock(snapshot.pantryStock);
    }
    if (snapshot.extraItems) {
      this.#extraItems = normalizeExtraItems(snapshot.extraItems);
    }
    this.#weekStartDate = resolveWeekStart(snapshot.weekStart);
    this.#plan = restorePlan(snapshot.plan, this.#planningSettings());
    this.#cookedMeals = normalizeCookedMeals(snapshot.cookedMeals);
    this.#checkedProductIds = new Set(snapshot.checkedProductIds);
    this.#swapHistoryBySlot.clear();
  }

  #renderWeekTools() {
    const { weekOver, weekOverText, restoreWeekButton } = this.#elements;
    const weekIsOver = isWeekOver(this.#weekStartDate);
    weekOver.hidden = !weekIsOver;
    weekOverText.textContent = weekIsOver ? `Semaine du ${formatFullDate(this.#weekStartDate)} terminée.` : '';
    restoreWeekButton.hidden = this.#previousWeek === null;
    if (this.#previousWeek) {
      restoreWeekButton.textContent = `Reprendre la semaine du ${formatFullDate(resolveWeekStart(this.#previousWeek.weekStart))}`;
    }
  }

  // Passer à une nouvelle semaine : on garde une copie de celle-ci pour pouvoir y revenir,
  // ses restes en stock, et ses plats en mémoire pour ne pas les resservir tout de suite.
  #startNextWeek() {
    this.#previousWeek = this.#createCurrentWeekSnapshot();
    this.#carryLeftoversToStock();
    this.#preferences = rememberWeek(this.#preferences, this.#plan.mainRecipeIds);
    this.#extraItems = keepUnboughtExtraItems(this.#extraItems, this.#checkedProductIds);
    this.#cookedMeals = {};
    this.#checkedProductIds = new Set();
    this.#swapHistoryBySlot.clear();
    // Toujours la semaine qui commence au prochain lundi (ou aujourd'hui si on est lundi) :
    // préparée le samedi, elle ne doit pas garder la date de la semaine en cours,
    // sinon elle serait jugée terminée et remplacée dès le lundi.
    this.#weekStartDate = getUpcomingMonday();
    this.#plan = generatePlan(this.#planningSettings());
  }

  // Sans case cochée, rien ne prouve que les courses ont été faites : le stock ne change pas.
  #carryLeftoversToStock() {
    if (!hasShoppingEvidence(this.#checkedProductIds)) {
      return;
    }
    const planningSettings = this.#planningSettings();
    this.#pantryStock = computeNextStock({
      stock: this.#pantryStock,
      shoppingList: buildShoppingList(this.#plan, planningSettings),
      checkedProductIds: this.#checkedProductIds,
      eatenShoppingList: buildShoppingList(buildEatenPlan(this.#plan, this.#cookedMeals), planningSettings),
    });
  }

  #toggleStoreMode() {
    this.#isStoreMode = !this.#isStoreMode;
    this.#storeModeDate = this.#isStoreMode ? toIsoDate(new Date()) : null;
    this.#applyStoreMode();
    this.#persist();
  }

  #applyStoreMode() {
    const { body, receipt } = this.#elements;
    body.classList.toggle('is-store-mode', this.#isStoreMode);
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
    this.#reconcileKeepingCooked();
    this.#renderAll();
  }

  // Semaine ou « Recette suivante » : le focus revient là où l'on a appuyé, sans faire défiler.
  #handlePlanClick(clickEvent) {
    const actionButton = clickEvent.target.closest('[data-action]');
    const handleAction = this.#planActionHandlers[actionButton?.dataset.action];
    if (!handleAction) {
      return;
    }
    const { action, planKind, slotIndex, recipeId } = actionButton.dataset;
    const rendersAgain = handleAction({ planKind, recipeId, slotNumber: Number.parseInt(slotIndex, 10) });
    if (rendersAgain) {
      clickEvent.currentTarget
        .querySelector(`[data-action="${action}"][data-plan-kind="${planKind}"][data-slot-index="${slotIndex}"]`)
        ?.focus({ preventScroll: true });
    }
  }

  #openCookMode({ planKind, slotNumber, recipeId }) {
    const recipe = RECIPES_BY_ID.get(recipeId);
    const getServings = SERVINGS_BY_PLAN_KIND[planKind];
    if (!recipe || !getServings) {
      return false;
    }
    const onFinish = planKind === PLAN_KINDS.MAIN ? () => this.#markCookedAfterCooking(slotNumber, recipeId) : null;
    this.#cookMode.open(recipe, getServings(this.#settings), this.#planningSettings(), { onFinish });
    return false;
  }

  #toggleCooked(slotNumber) {
    this.#setCooked(slotNumber, !isMealCooked(this.#cookedMeals, this.#plan, slotNumber));
    return false;
  }

  #toggleLike(recipeId) {
    this.#preferences = toggleLiked(this.#preferences, recipeId);
    this.#renderAll();
    return true;
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
    // Les portions suivent le nouvel objectif ; les plats prévus, peut-être déjà achetés, restent.
    this.#renderAll();
  }

  #swapSlot({ planKind, slotNumber, recipeId }) {
    const slotKey = `${planKind}:${slotNumber}`;
    const avoidedRecipeIds = [recipeId, ...(this.#swapHistoryBySlot.get(slotKey) ?? [])].slice(0, SWAP_HISTORY_LENGTH);
    this.#swapHistoryBySlot.set(slotKey, avoidedRecipeIds);
    this.#plan = swapMeal(this.#plan, planKind, slotNumber, this.#planningSettings(), Math.random, { avoidedRecipeIds });
    this.#renderAll();
    return true;
  }

  // Le créneau a pu changer de plat pendant la cuisine : on ne coche que s'il s'agit du même.
  #markCookedAfterCooking(slotNumber, recipeId) {
    if (this.#plan.mainRecipeIds[slotNumber] === recipeId) {
      this.#setCooked(slotNumber, true);
    }
  }

  #setCooked(slotNumber, isCooked) {
    this.#cookedMeals = setMealCooked(this.#cookedMeals, this.#plan, slotNumber, isCooked);
    this.#showCookedChange(slotNumber, isCooked);
    this.#persist();
    if (isCooked && !this.#showsCookedMeals) {
      this.#offerUncook(slotNumber);
    }
  }

  // La carte est mise à jour sur place pour laisser voir la coche avant qu'elle ne s'efface.
  #showCookedChange(slotNumber, isCooked) {
    const cardElement = this.#elements.planList.querySelector(`[data-action="cooked"][data-slot-index="${slotNumber}"]`)?.closest('.meal');
    if (cardElement) {
      updateCookedCard(cardElement, isCooked);
    }
    this.#renderCookedProgress();
    this.#renderNextRecipe();
  }

  // Le plat coché disparaît de la liste : « Annuler » rattrape un appui sur la mauvaise carte.
  #offerUncook(slotNumber) {
    const recipe = RECIPES_BY_ID.get(this.#plan.mainRecipeIds[slotNumber]);
    if (!recipe) {
      return;
    }
    this.#undoToast.offer(`« ${recipe.name} » cuisiné.`, () => {
      this.#cookedMeals = setMealCooked(this.#cookedMeals, this.#plan, slotNumber, false);
      this.#renderPlanning();
      this.#persist();
    });
  }

  #renderNextRecipe() {
    renderNextRecipe(
      { cardContainer: this.#elements.nextRecipeCard, progressElement: this.#elements.nextRecipeProgress },
      this.#plan,
      this.#planningSettings(),
      new Set(listCookedSlotIndexes(this.#cookedMeals, this.#plan)),
    );
  }

  #toggleShowCooked() {
    this.#showsCookedMeals = !this.#showsCookedMeals;
    this.#renderCookedProgress();
    this.#persist();
  }

  // Mis à jour à part du reste : cocher un plat ne doit pas reconstruire toute la semaine.
  #renderCookedProgress() {
    const cookedCount = listCookedSlotIndexes(this.#cookedMeals, this.#plan).length;
    const dishCount = this.#plan.mainRecipeIds.filter(Boolean).length;
    const { planSection, showCookedButton } = this.#elements;
    renderSummary(this.#elements.summary, this.#shoppingList, this.#settings, cookedCount);
    planSection.classList.toggle('shows-cooked', this.#showsCookedMeals);
    planSection.classList.toggle('all-cooked', dishCount > 0 && cookedCount === dishCount);
    showCookedButton.hidden = cookedCount === 0;
    showCookedButton.setAttribute('aria-pressed', String(this.#showsCookedMeals));
    showCookedButton.textContent = this.#showsCookedMeals
      ? 'Masquer les plats cuisinés'
      : `Afficher les plats cuisinés (${cookedCount})`;
  }

  // Le plat est retiré de tous les jours où il apparaît, sauf là où il est déjà cuisiné.
  // Un appui raté se rattrape avec « Annuler ».
  #dislikeRecipe(recipeId) {
    const recipe = RECIPES_BY_ID.get(recipeId);
    if (!recipe) {
      return false;
    }
    const previousState = { plan: this.#plan, preferences: this.#preferences, cookedMeals: this.#cookedMeals };
    this.#preferences = markDisliked(this.#preferences, recipeId);
    this.#reconcileKeepingCooked();
    this.#renderAll();
    this.#undoToast.offer(`« ${recipe.name} » écarté.`, () => {
      this.#plan = previousState.plan;
      this.#preferences = previousState.preferences;
      this.#cookedMeals = previousState.cookedMeals;
      this.#renderAll();
    });
    return false;
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
    const previousCheckedProductIds = this.#checkedProductIds;
    if (previousCheckedProductIds.size === 0) {
      return;
    }
    this.#replaceCheckedProductIds(new Set());
    this.#undoToast.offer('Liste décochée.', () => this.#replaceCheckedProductIds(previousCheckedProductIds));
  }

  #replaceCheckedProductIds(checkedProductIds) {
    this.#checkedProductIds = checkedProductIds;
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
    this.#renderWithoutSaving();
    this.#persist();
  }

  #renderWithoutSaving() {
    // Les ajouts à la main vont sur la liste mais restent hors du choix des menus et du budget.
    this.#shoppingList = buildShoppingList(this.#plan, { ...this.#planningSettings(), extraItems: this.#extraItems });
    this.#renderPlanning();
    this.#renderReceipt();
  }

  // Séparé du ticket : cocher un article ou marquer un produit introuvable ne doit pas reconstruire la liste.
  #renderPlanning() {
    const planningSettings = this.#planningSettings();
    this.#elements.profileFields.hidden = !hasWeightLossGoal(this.#settings);
    renderGoalHint(this.#elements.goalHint, this.#settings);
    renderSettingsRecap({
      goalRecap: this.#elements.goalRecap,
      mealsRecap: this.#elements.mealsRecap,
      shoppingRecap: this.#elements.shoppingRecap,
    }, this.#settings);
    const cookedSlotIndexes = new Set(listCookedSlotIndexes(this.#cookedMeals, this.#plan));
    renderPlan(this.#elements.planList, this.#plan, planningSettings, this.#weekStartDate, cookedSlotIndexes);
    this.#renderWeekTools();
    this.#renderCookedProgress();
    this.#renderNextRecipe();
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
    const { doneCount, lineCount } = this.#countReceiptLines();
    updateReceiptProgress(this.#elements.receipt, doneCount, lineCount);
  }

  #countReceiptLines() {
    const listedProductIds = this.#shoppingList.aisleGroups.flatMap((group) => [
      ...group.lines.map((line) => line.product.id),
      ...group.extraLines.map((line) => line.extra.id),
    ]);
    const doneCount = listedProductIds.filter((productId) => isLineDone(productId, this.#checkedProductIds, this.#storeSetup)).length;
    return { doneCount, lineCount: listedProductIds.length };
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
      previousWeek: this.#previousWeek,
      isHistoryRecoveryDone: this.#isHistoryRecoveryDone,
      interface: {
        isStoreMode: this.#isStoreMode,
        storeModeDate: this.#storeModeDate,
        hidesCheckedItems: this.#hidesCheckedItems,
        showsCookedMeals: this.#showsCookedMeals,
      },
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
// Pas d'attente : l'enregistrement gère lui-même son échec, l'appli marche sans.
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
