import { CookMode } from './cook-mode.js';
import { debounce } from './dom.js';
import { setUpInstallButton } from './install-prompt.js';
import { buildShoppingListText } from './list-text.js';
import { generatePlan, PLAN_KINDS, reconcilePlan, swapMeal } from './planner.js';
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
  renderGoalHint,
  renderPlan,
  renderPreferencesSummary,
  renderReceipt,
  renderStockSummary,
  renderSummary,
  updateReceiptProgress,
} from './render.js';
import { normalizeSettings, readSettingsFromForm, writeSettingsToForm } from './settings.js';
import { buildShoppingList } from './shopping-list.js';
import { renderWeightTracker } from './render-weight.js';
import { computeNextStock, describeStock, hasShoppingEvidence, normalizeStock } from './stock.js';
import { loadSavedState, saveState } from './storage.js';
import { createScreenWakeLock } from './wake-lock.js';
import { addWeightEntry, analyzeWeightTrend, isValidWeight, normalizeWeightLog } from './weight-log.js';
import { getUpcomingMonday, resolveWeekStart, toIsoDate } from './week.js';

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
  #shoppingList = null;
  #weekStartDate = getUpcomingMonday();
  #listenersController = new AbortController();
  #debouncedSettingsUpdate = debounce(() => this.#applySettingsFromForm(), SETTINGS_DEBOUNCE_MILLISECONDS);
  #copyStatusTimeoutId = null;

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
      body: rootDocument.body,
    };
    this.#cookMode = new CookMode(rootDocument.getElementById('cook-dialog'));
  }

  start() {
    this.#restoreSavedState();
    this.#removeInstallButton = setUpInstallButton({
      installButton: this.#elements.installButton,
      installHelp: this.#elements.installHelp,
    });
    writeSettingsToForm(this.#elements.settingsForm, this.#settings);
    this.#attachListeners();
    this.#renderAll();
  }

  // Des données enregistrées abîmées ne doivent jamais bloquer l'appli : on repart d'une semaine neuve.
  #restoreSavedState() {
    const savedState = loadSavedState();
    try {
      this.#settings = normalizeSettings(savedState?.settings);
      this.#preferences = normalizePreferences(savedState?.preferences, RECIPES_BY_ID);
      this.#weightLog = normalizeWeightLog(savedState?.weightLog);
      this.#pantryStock = normalizeStock(savedState?.pantryStock);
      this.#checkedProductIds = new Set(Array.isArray(savedState?.checkedProductIds) ? savedState.checkedProductIds : []);
      this.#weekStartDate = resolveWeekStart(savedState?.weekStart);
      this.#plan = savedState?.plan && typeof savedState.plan === 'object'
        ? reconcilePlan(savedState.plan, this.#planningSettings())
        : generatePlan(this.#planningSettings());
      // La semaine enregistrée est terminée : on passe à la suivante comme avec « Nouvelle semaine ».
      if (typeof savedState?.weekStart === 'string' && savedState.weekStart !== toIsoDate(this.#weekStartDate)) {
        this.#startNextWeek();
      }
    } catch (restoreError) {
      console.warn('Semaine enregistrée illisible, nouvelle semaine générée.', restoreError);
      this.#settings = normalizeSettings(null);
      this.#preferences = EMPTY_PREFERENCES;
      this.#weightLog = [];
      this.#pantryStock = {};
      this.#checkedProductIds = new Set();
      this.#weekStartDate = getUpcomingMonday();
      this.#plan = generatePlan(this.#planningSettings());
    }
  }

  // Les préférences voyagent avec les réglages jusqu'au générateur, sans être des champs du formulaire.
  #planningSettings() {
    return { ...this.#settings, preferences: this.#preferences, pantryStock: this.#pantryStock };
  }

  // Une saisie encore en attente est appliquée (et donc enregistrée) avant de quitter la page.
  destroy() {
    this.#debouncedSettingsUpdate.flush();
    this.#listenersController.abort();
    clearTimeout(this.#copyStatusTimeoutId);
    this.#cookMode.destroy();
    this.#storeWakeLock.disable();
    this.#removeInstallButton();
  }

  #attachListeners() {
    const { signal } = this.#listenersController;
    const { settingsForm, planList, receipt, regenerateButton, copyButton, uncheckButton } = this.#elements;

    settingsForm.addEventListener('submit', (submitEvent) => submitEvent.preventDefault(), { signal });
    settingsForm.addEventListener('input', (inputEvent) => this.#handleSettingsInput(inputEvent), { signal });
    settingsForm.addEventListener('change', (changeEvent) => this.#handleSettingsCommit(changeEvent), { signal });
    regenerateButton.addEventListener('click', () => this.#regenerateWeek(), { signal });
    planList.addEventListener('click', (clickEvent) => this.#handlePlanClick(clickEvent), { signal });
    // L'événement « error » d'une image ne remonte pas : on l'écoute en phase de capture.
    planList.addEventListener('error', (errorEvent) => this.#hideMissingPhoto(errorEvent), { signal, capture: true });
    receipt.addEventListener('change', (changeEvent) => this.#handleReceiptCheck(changeEvent), { signal });
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
      this.#debouncedSettingsUpdate.run();
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
    this.#applySettingsFromForm();
    writeSettingsToForm(this.#elements.settingsForm, this.#settings);
  }

  // Changer la priorité change la façon de choisir les plats : elle ne peut s'appliquer
  // qu'en refaisant la semaine. Les autres réglages gardent les plats encore compatibles.
  #applySettingsFromForm() {
    const previousPriority = this.#settings.priority;
    this.#settings = readSettingsFromForm(this.#elements.settingsForm);
    if (this.#settings.priority !== previousPriority) {
      this.#regenerateWeek();
      return;
    }
    this.#plan = reconcilePlan(this.#plan, this.#planningSettings());
    this.#renderAll();
  }

  #regenerateWeek() {
    this.#startNextWeek();
    this.#renderAll();
  }

  // Passer à une nouvelle semaine : on retient ses plats (pour ne pas les resservir tout de suite)
  // et, si des courses ont été cochées, ce qu'il reste en stock pour la semaine suivante.
  #startNextWeek() {
    if (hasShoppingEvidence(this.#checkedProductIds)) {
      const shoppingList = buildShoppingList(this.#plan, this.#planningSettings());
      this.#pantryStock = computeNextStock({ stock: this.#pantryStock, shoppingList, checkedProductIds: this.#checkedProductIds });
    }
    this.#preferences = rememberWeek(this.#preferences, this.#plan.mainRecipeIds);
    this.#swapHistoryBySlot.clear();
    this.#checkedProductIds.clear();
    this.#weekStartDate = resolveWeekStart(toIsoDate(this.#weekStartDate));
    this.#plan = generatePlan(this.#planningSettings());
  }

  #toggleStoreMode() {
    const isStoreMode = this.#elements.body.classList.toggle('is-store-mode');
    const { storeModeButton } = this.#elements;
    storeModeButton.setAttribute('aria-pressed', String(isStoreMode));
    storeModeButton.textContent = isStoreMode ? 'Quitter le mode magasin' : 'Mode magasin';
    if (isStoreMode) {
      this.#storeWakeLock.enable();
      this.#elements.receipt.scrollIntoView({ block: 'start' });
    } else {
      this.#storeWakeLock.disable();
    }
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
        this.#cookMode.open(recipe, getServings(this.#settings), this.#planningSettings());
      }
      return;
    }
    if (action === 'like') {
      this.#preferences = toggleLiked(this.#preferences, recipeId);
    } else if (action === 'dislike') {
      this.#preferences = markDisliked(this.#preferences, recipeId);
      this.#swapSlot(planKind, slotNumber, recipeId);
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
    this.#updateProgress();
    this.#persist();
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
    const planningSettings = this.#planningSettings();
    this.#shoppingList = buildShoppingList(this.#plan, planningSettings);
    this.#elements.profileFields.hidden = !hasWeightLossGoal(this.#settings);
    renderGoalHint(this.#elements.goalHint, this.#settings);
    renderSummary(this.#elements.summary, this.#shoppingList, this.#settings);
    renderPlan(this.#elements.planList, this.#plan, planningSettings, this.#weekStartDate);
    renderPreferencesSummary(this.#elements.preferencesSummary, this.#elements.resetDislikesButton, this.#preferences);
    renderStockSummary(this.#elements.stockSummary, this.#elements.clearStockButton, describeStock(this.#pantryStock));
    renderWeightTracker({
      chartContainer: this.#elements.weightChartContainer,
      adviceElement: this.#elements.weightAdvice,
      weightLog: this.#weightLog,
      pantryStock: this.#pantryStock,
      analysis: analyzeWeightTrend(this.#weightLog, toIsoDate(new Date())),
    });
    this.#renderReceipt();
    this.#persist();
  }

  #renderReceipt() {
    renderReceipt(this.#elements.receipt, this.#shoppingList, this.#settings, this.#checkedProductIds, this.#weekStartDate);
    this.#updateProgress();
  }

  #updateProgress() {
    const listedProductIds = this.#shoppingList.aisleGroups.flatMap((group) => group.lines.map((line) => line.product.id));
    const checkedCount = listedProductIds.filter((productId) => this.#checkedProductIds.has(productId)).length;
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
