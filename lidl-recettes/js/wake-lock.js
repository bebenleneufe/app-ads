// Garde l'écran allumé pendant la cuisine ou les courses. Le navigateur peut refuser
// (batterie faible, onglet masqué, navigateur ancien) : l'appli marche alors normalement.
export function createScreenWakeLock() {
  let wakeLockSentinel = null;
  let isWanted = false;
  let visibilityController = null;

  const request = async () => {
    if (!isWanted || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) {
      return;
    }
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
    } catch (wakeLockError) {
      console.info('Écran allumé non disponible ici.', wakeLockError);
      wakeLockSentinel = null;
    }
  };

  const enable = async () => {
    isWanted = true;
    visibilityController?.abort();
    visibilityController = new AbortController();
    // Le navigateur libère le verrou quand l'onglet est masqué : on le redemande au retour.
    document.addEventListener('visibilitychange', () => request(), { signal: visibilityController.signal });
    await request();
  };

  const disable = async () => {
    isWanted = false;
    visibilityController?.abort();
    visibilityController = null;
    const sentinel = wakeLockSentinel;
    wakeLockSentinel = null;
    try {
      await sentinel?.release();
    } catch (releaseError) {
      console.info('Verrou d’écran déjà libéré.', releaseError);
    }
  };

  return { enable, disable };
}
