import { DIETS } from './planner.js';

export const SETTINGS_LIMITS = Object.freeze({
  personCount: { min: 1, max: 8 },
  dayCount: { min: 1, max: 7 },
  mealsPerDay: { min: 1, max: 2 },
  weeklyBudget: { min: 0, max: 500 },
});

export const DEFAULT_SETTINGS = Object.freeze({
  personCount: 2,
  dayCount: 7,
  mealsPerDay: 1,
  diet: DIETS.OMNIVORE,
  withoutPork: false,
  weeklyBudget: 0,
  pantryStaplesOwned: true,
});

function clampInteger(rawValue, { min, max }, fallback) {
  const parsedValue = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsedValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsedValue));
}

export function normalizeSettings(rawSettings = {}) {
  const knownDiets = Object.values(DIETS);
  return {
    personCount: clampInteger(rawSettings.personCount, SETTINGS_LIMITS.personCount, DEFAULT_SETTINGS.personCount),
    dayCount: clampInteger(rawSettings.dayCount, SETTINGS_LIMITS.dayCount, DEFAULT_SETTINGS.dayCount),
    mealsPerDay: clampInteger(rawSettings.mealsPerDay, SETTINGS_LIMITS.mealsPerDay, DEFAULT_SETTINGS.mealsPerDay),
    diet: knownDiets.includes(rawSettings.diet) ? rawSettings.diet : DEFAULT_SETTINGS.diet,
    withoutPork: rawSettings.withoutPork === true,
    weeklyBudget: clampInteger(rawSettings.weeklyBudget, SETTINGS_LIMITS.weeklyBudget, DEFAULT_SETTINGS.weeklyBudget),
    pantryStaplesOwned: rawSettings.pantryStaplesOwned !== false,
  };
}

export function readSettingsFromForm(formElement) {
  const formData = new FormData(formElement);
  return normalizeSettings({
    personCount: formData.get('personCount'),
    dayCount: formData.get('dayCount'),
    mealsPerDay: formData.get('mealsPerDay'),
    diet: formData.get('diet'),
    withoutPork: formData.has('withoutPork'),
    weeklyBudget: formData.get('weeklyBudget') || 0,
    pantryStaplesOwned: formData.has('pantryStaplesOwned'),
  });
}

export function writeSettingsToForm(formElement, settings) {
  const { elements } = formElement;
  elements.personCount.value = String(settings.personCount);
  elements.dayCount.value = String(settings.dayCount);
  elements.mealsPerDay.value = String(settings.mealsPerDay);
  elements.diet.value = settings.diet;
  elements.withoutPork.checked = settings.withoutPork;
  elements.weeklyBudget.value = settings.weeklyBudget > 0 ? String(settings.weeklyBudget) : '';
  elements.pantryStaplesOwned.checked = settings.pantryStaplesOwned;
}
