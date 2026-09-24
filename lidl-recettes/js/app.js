import { debounce } from './dom.js';
import { buildShoppingListText } from './list-text.js';
import { generatePlan, reconcilePlan, swapMeal } from './planner.js';
import { createEmptyPlan } from './meal-structure.js';
import { hasWeightLossGoal } from './nutrition.js';
import { renderGoalHint, renderPlan, renderReceipt, renderSummary, updateReceiptProgress } from './render.js';
import { normalizeSettings, readSettingsFromForm, writeSettingsToForm } from './settings.js';
import { buildShoppingList } from './shopping-list.js';
import { loadSavedState, saveState } from './storage.js';

const SETTINGS_DEBOUNCE_MILLISECONDS = 300;
const COPY_STATUS_DURATION_MILLISECONDS = 4000;

function getUpcomingMonday(today = new Date()) {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntilMonday = (8 - monday.getDay()) % 7;
  monday.setDate(monday.getDate() + daysUntilMonday);
  return monday;
}

class WeeklyPlannerApp {
  #elements;
  #settings;
  #plan = createEmptyPlan();
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
    };
  }

  start() {
    const savedState = loadSavedState();
    this.#settings = normalizeSettings(savedState?.settings);
    this.#checkedProductIds = new Set(Array.isArray(savedState?.checkedProductIds) ? savedState.checkedProductIds : []);
    this.#plan = savedState?.plan
      ? reconcilePlan(savedState.plan, this.#settings)
      : generatePlan(this.#settings);

    writeSettingsToForm(this.#elements.settingsForm, this.#settings);
    this.#attachListeners();
    this.#renderAll();
  }

  destroy() {
    this.#listenersController.abort();
    this.#debouncedSettingsUpdate.cancel();
    clearTimeout(this.#copyStatusTimeoutId);
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
  }

  #handleSettingsInput(inputEvent) {
    if (inputEvent.target.type === 'number') {
      this.#debouncedSettingsUpdate.run();
      return;
    }
    this.#applySettingsFromForm();
  }

  // Les champs numériques ne sont réécrits qu'à la sortie du champ, pour ne pas
  // corriger la saisie pendant que la personne tape encore.
  #handleSettingsCommit(changeEvent) {
    if (changeEvent.target.type !== 'number') {
      return;
    }
    this.#debouncedSettingsUpdate.cancel();
    this.#applySettingsFromForm();
    writeSettingsToForm(this.#elements.settingsForm, this.#settings);
  }

  #applySettingsFromForm() {
    const previousBudget = this.#settings.weeklyBudget;
    this.#settings = readSettingsFromForm(this.#elements.settingsForm);
    this.#plan = this.#settings.weeklyBudget !== previousBudget
      ? generatePlan(this.#settings)
      : reconcilePlan(this.#plan, this.#settings);
    this.#renderAll();
  }

  #regenerateWeek() {
    this.#plan = generatePlan(this.#settings);
    this.#checkedProductIds.clear();
    this.#renderAll();
  }

  #handlePlanClick(clickEvent) {
    const swapButton = clickEvent.target.closest('[data-action="swap"]');
    if (!swapButton) {
      return;
    }
    const { planKind, slotIndex } = swapButton.dataset;
    this.#plan = swapMeal(this.#plan, planKind, Number.parseInt(slotIndex, 10), this.#settings);
    this.#renderAll();
    this.#elements.planList.querySelector(`[data-plan-kind="${planKind}"][data-slot-index="${slotIndex}"]`)?.focus();
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
    this.#shoppingList = buildShoppingList(this.#plan, this.#settings);
    this.#elements.profileFields.hidden = !hasWeightLossGoal(this.#settings);
    renderGoalHint(this.#elements.goalHint, this.#settings);
    renderSummary(this.#elements.summary, this.#shoppingList, this.#settings);
    renderPlan(this.#elements.planList, this.#plan, this.#settings, this.#weekStartDate);
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
      checkedProductIds: [...this.#checkedProductIds],
    });
  }
}

const weeklyPlannerApp = new WeeklyPlannerApp(document);
weeklyPlannerApp.start();
// Une page mise en cache (bfcache, persisted) peut être restaurée : on ne détruit que les sorties définitives.
function destroyOnFinalPageExit(pagehideEvent) {
  if (pagehideEvent.persisted) {
    return;
  }
  weeklyPlannerApp.destroy();
  window.removeEventListener('pagehide', destroyOnFinalPageExit);
}
window.addEventListener('pagehide', destroyOnFinalPageExit);
