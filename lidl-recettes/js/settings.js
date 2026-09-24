import { ACTIVITY_FACTORS, GOALS, SEXES } from './nutrition.js';
import { DIETS } from './planner.js';

export const SETTINGS_LIMITS = Object.freeze({
  personCount: { min: 1, max: 8 },
  dayCount: { min: 1, max: 7 },
  mealsPerDay: { min: 1, max: 2 },
  weeklyBudget: { min: 0, max: 500 },
  age: { min: 18, max: 99 },
  weightKg: { min: 40, max: 250 },
  heightCm: { min: 130, max: 220 },
});

export const DEFAULT_SETTINGS = Object.freeze({
  personCount: 1,
  dayCount: 7,
  mealsPerDay: 2,
  diet: DIETS.OMNIVORE,
  withoutPork: false,
  weeklyBudget: 0,
  pantryStaplesOwned: true,
  goal: GOALS.WEIGHT_LOSS,
  sex: SEXES.MALE,
  age: 35,
  weightKg: 85,
  heightCm: 178,
  activityLevel: 'sedentaire',
});

function clampInteger(rawValue, { min, max }, fallback) {
  const parsedValue = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsedValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsedValue));
}

function pickKnownValue(rawValue, knownValues, fallback) {
  return knownValues.includes(rawValue) ? rawValue : fallback;
}

export function normalizeSettings(rawSettings = {}) {
  return {
    personCount: clampInteger(rawSettings.personCount, SETTINGS_LIMITS.personCount, DEFAULT_SETTINGS.personCount),
    dayCount: clampInteger(rawSettings.dayCount, SETTINGS_LIMITS.dayCount, DEFAULT_SETTINGS.dayCount),
    mealsPerDay: clampInteger(rawSettings.mealsPerDay, SETTINGS_LIMITS.mealsPerDay, DEFAULT_SETTINGS.mealsPerDay),
    diet: pickKnownValue(rawSettings.diet, Object.values(DIETS), DEFAULT_SETTINGS.diet),
    withoutPork: rawSettings.withoutPork === true,
    weeklyBudget: clampInteger(rawSettings.weeklyBudget, SETTINGS_LIMITS.weeklyBudget, DEFAULT_SETTINGS.weeklyBudget),
    pantryStaplesOwned: rawSettings.pantryStaplesOwned !== false,
    goal: pickKnownValue(rawSettings.goal, Object.values(GOALS), DEFAULT_SETTINGS.goal),
    sex: pickKnownValue(rawSettings.sex, Object.values(SEXES), DEFAULT_SETTINGS.sex),
    age: clampInteger(rawSettings.age, SETTINGS_LIMITS.age, DEFAULT_SETTINGS.age),
    weightKg: clampInteger(rawSettings.weightKg, SETTINGS_LIMITS.weightKg, DEFAULT_SETTINGS.weightKg),
    heightCm: clampInteger(rawSettings.heightCm, SETTINGS_LIMITS.heightCm, DEFAULT_SETTINGS.heightCm),
    activityLevel: pickKnownValue(rawSettings.activityLevel, Object.keys(ACTIVITY_FACTORS), DEFAULT_SETTINGS.activityLevel),
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
    goal: formData.get('goal'),
    sex: formData.get('sex'),
    age: formData.get('age'),
    weightKg: formData.get('weightKg'),
    heightCm: formData.get('heightCm'),
    activityLevel: formData.get('activityLevel'),
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
  elements.goal.value = settings.goal;
  elements.sex.value = settings.sex;
  elements.age.value = String(settings.age);
  elements.weightKg.value = String(settings.weightKg);
  elements.heightCm.value = String(settings.heightCm);
  elements.activityLevel.value = settings.activityLevel;
}
