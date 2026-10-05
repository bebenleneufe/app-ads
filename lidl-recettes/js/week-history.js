// Copie de la semaine remplacée par « Nouvelle semaine », pour pouvoir y revenir :
// menus, plats cuisinés, cases cochées, ajouts, stock et préférences d'avant le passage.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function createWeekSnapshot({ plan, weekStart, cookedMeals, checkedProductIds, extraItems, pantryStock, preferences }) {
  return {
    plan,
    weekStart,
    cookedMeals,
    checkedProductIds: [...checkedProductIds],
    extraItems,
    pantryStock,
    preferences,
  };
}

export function normalizeWeekSnapshot(savedSnapshot) {
  const hasPlan = Array.isArray(savedSnapshot?.plan?.mainRecipeIds);
  const hasDate = typeof savedSnapshot?.weekStart === 'string' && ISO_DATE_PATTERN.test(savedSnapshot.weekStart);
  return hasPlan && hasDate ? savedSnapshot : null;
}

// Les semaines remplacées avant l'existence de cette copie ont laissé leurs plats en tête de
// l'historique « déjà servis » (dans l'ordre des jours) : on les retrouve de là.
export function recoverSnapshotFromHistory({ preferences, currentPlan, previousWeekStart, slotCount }) {
  const recoveredRecipeIds = preferences.recent.slice(0, slotCount);
  if (recoveredRecipeIds.length === 0) {
    return null;
  }
  return createWeekSnapshot({
    plan: { ...currentPlan, mainRecipeIds: recoveredRecipeIds },
    weekStart: previousWeekStart,
    cookedMeals: {},
    checkedProductIds: [],
    extraItems: null,
    pantryStock: null,
    preferences: null,
  });
}
