// Plats déjà cuisinés dans la semaine : on retient, pour chaque créneau, la recette cuisinée.
// Si le plat du créneau change (« Changer », réglages), la marque ne s'applique plus d'elle-même.
export function normalizeCookedMeals(savedCookedMeals) {
  if (savedCookedMeals === null || typeof savedCookedMeals !== 'object' || Array.isArray(savedCookedMeals)) {
    return {};
  }
  return Object.fromEntries(Object.entries(savedCookedMeals).filter(
    ([slotIndex, recipeId]) => /^\d+$/.test(slotIndex) && typeof recipeId === 'string',
  ));
}

export function isMealCooked(cookedMeals, plan, slotIndex) {
  const recipeId = plan.mainRecipeIds[slotIndex];
  return Boolean(recipeId) && cookedMeals[slotIndex] === recipeId;
}

export function listCookedSlotIndexes(cookedMeals, plan) {
  return plan.mainRecipeIds
    .map((_recipeId, slotIndex) => slotIndex)
    .filter((slotIndex) => isMealCooked(cookedMeals, plan, slotIndex));
}

export function setMealCooked(cookedMeals, plan, slotIndex, isCooked) {
  const nextCookedMeals = { ...cookedMeals };
  if (isCooked && plan.mainRecipeIds[slotIndex]) {
    nextCookedMeals[slotIndex] = plan.mainRecipeIds[slotIndex];
  } else {
    delete nextCookedMeals[slotIndex];
  }
  return nextCookedMeals;
}

// Ce qui a vraiment été mangé, pour calculer les restes. Sans aucun plat marqué, on ne sait rien :
// on suppose alors, comme avant, que toute la semaine a été cuisinée.
export function buildEatenPlan(plan, cookedMeals) {
  const cookedSlotIndexes = new Set(listCookedSlotIndexes(cookedMeals, plan));
  if (cookedSlotIndexes.size === 0) {
    return plan;
  }
  return {
    ...plan,
    mainRecipeIds: plan.mainRecipeIds.map((recipeId, slotIndex) => (cookedSlotIndexes.has(slotIndex) ? recipeId : null)),
  };
}
