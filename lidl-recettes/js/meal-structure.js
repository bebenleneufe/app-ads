export const MAIN_MEAL_MODES = Object.freeze({
  SAME_LUNCH_AND_DINNER: 'midi-soir-identiques',
  DIFFERENT_LUNCH_AND_DINNER: 'midi-soir-differents',
  DINNER_ONLY: 'diner',
});

export function getMainSlotsPerDay(settings) {
  return settings.mainMealMode === MAIN_MEAL_MODES.DIFFERENT_LUNCH_AND_DINNER ? 2 : 1;
}

// Un plat « midi et soir » est cuisiné une fois en double : chaque recette compte deux portions.
export function getServingsPerMainRecipe(settings) {
  return settings.mainMealMode === MAIN_MEAL_MODES.SAME_LUNCH_AND_DINNER ? 2 : 1;
}

// Source unique du nombre de portions cuisinées : l'affichage, le générateur et la liste
// de courses doivent toujours compter la même chose.
export function getServingsPerMainSlot(settings) {
  return settings.personCount * getServingsPerMainRecipe(settings);
}

export function getServingsPerBreakfast(settings) {
  return settings.personCount;
}

export function getMainSlotLabels(settings) {
  if (settings.mainMealMode === MAIN_MEAL_MODES.DIFFERENT_LUNCH_AND_DINNER) {
    return ['Déjeuner', 'Dîner'];
  }
  if (settings.mainMealMode === MAIN_MEAL_MODES.SAME_LUNCH_AND_DINNER) {
    return ['Déjeuner et dîner'];
  }
  return ['Dîner'];
}

export function getMainSlotCount(settings) {
  return settings.dayCount * getMainSlotsPerDay(settings);
}

export function getBreakfastSlotCount(settings) {
  return settings.includeBreakfast ? settings.dayCount : 0;
}

export function getMealsEatenPerDay(settings) {
  const mainMealsPerDay = settings.mainMealMode === MAIN_MEAL_MODES.DINNER_ONLY ? 1 : 2;
  return mainMealsPerDay + (settings.includeBreakfast ? 1 : 0);
}

export function createEmptyPlan() {
  return { mainRecipeIds: [], breakfastRecipeIds: [] };
}
