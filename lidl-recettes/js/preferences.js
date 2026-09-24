// Deux semaines de plats suffisent pour éviter la lassitude sans vider le choix de recettes.
const RECENT_HISTORY_LENGTH = 14;

export const EMPTY_PREFERENCES = Object.freeze({ liked: Object.freeze([]), disliked: Object.freeze([]), recent: Object.freeze([]) });

function keepKnownIds(rawIds, knownRecipeIds) {
  return Array.isArray(rawIds) ? [...new Set(rawIds.filter((recipeId) => knownRecipeIds.has(recipeId)))] : [];
}

export function normalizePreferences(savedPreferences, knownRecipeIds) {
  const rawPreferences = savedPreferences !== null && typeof savedPreferences === 'object' ? savedPreferences : {};
  return {
    liked: keepKnownIds(rawPreferences.liked, knownRecipeIds),
    disliked: keepKnownIds(rawPreferences.disliked, knownRecipeIds),
    recent: keepKnownIds(rawPreferences.recent, knownRecipeIds).slice(0, RECENT_HISTORY_LENGTH),
  };
}

export function toggleLiked(preferences, recipeId) {
  const isLiked = preferences.liked.includes(recipeId);
  return {
    ...preferences,
    liked: isLiked ? preferences.liked.filter((likedId) => likedId !== recipeId) : [...preferences.liked, recipeId],
    disliked: preferences.disliked.filter((dislikedId) => dislikedId !== recipeId),
  };
}

export function markDisliked(preferences, recipeId) {
  return {
    ...preferences,
    liked: preferences.liked.filter((likedId) => likedId !== recipeId),
    disliked: [...new Set([...preferences.disliked, recipeId])],
  };
}

export function clearDisliked(preferences) {
  return { ...preferences, disliked: [] };
}

export function rememberWeek(preferences, mainRecipeIds) {
  const recentIds = [...new Set([...mainRecipeIds.filter(Boolean), ...preferences.recent])];
  return { ...preferences, recent: recentIds.slice(0, RECENT_HISTORY_LENGTH) };
}
