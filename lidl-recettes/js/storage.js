const STORAGE_KEY = 'semainier-lidl:v2';

// Le stockage peut être bloqué (navigation privée, cookies refusés) : l'application
// doit rester utilisable, elle perd seulement la mémorisation entre deux visites.
export function loadSavedState() {
  try {
    const serializedState = window.localStorage.getItem(STORAGE_KEY);
    return serializedState ? JSON.parse(serializedState) : null;
  } catch (storageError) {
    console.warn('Impossible de relire la semaine enregistrée.', storageError);
    return null;
  }
}

export function saveState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (storageError) {
    console.warn('Impossible d’enregistrer la semaine.', storageError);
  }
}
