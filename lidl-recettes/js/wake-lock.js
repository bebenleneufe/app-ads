// Garde l'écran allumé pendant la cuisine ou les courses. Le navigateur peut refuser
// (batterie faible, onglet masqué, navigateur ancien) : l'appli marche alors normalement.
// La WebView Android ne connaît pas navigator.wakeLock : dans l'APK, c'est l'appli native
// qui garde l'écran allumé, via le pont « SemainierAndroid » qu'elle expose à la page.
function getAndroidBridge() {
  const bridge = globalThis.SemainierAndroid;
  return typeof bridge?.setKeepScreenOn === 'function' ? bridge : null;
}

// Mode magasin et mode cuisine peuvent vouloir l'écran allumé en même temps :
// l'écran ne s'éteint que quand plus aucun des deux n'en a besoin.
let androidKeepOnRequestCount = 0;

function updateAndroidKeepScreenOn(countChange) {
  androidKeepOnRequestCount = Math.max(0, androidKeepOnRequestCount + countChange);
  try {
    getAndroidBridge()?.setKeepScreenOn(androidKeepOnRequestCount > 0);
  } catch (bridgeError) {
    console.info('Écran allumé non disponible dans l’appli Android.', bridgeError);
  }
}

export function createScreenWakeLock() {
  let wakeLockSentinel = null;
  let isWanted = false;
  let visibilityController = null;

  const releaseSentinel = async (sentinel) => {
    try {
      await sentinel?.release();
    } catch (releaseError) {
      console.info('Verrou d’écran déjà libéré.', releaseError);
    }
  };

  const request = async () => {
    if (!isWanted || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) {
      return;
    }
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      // Le mode a pu être quitté pendant la demande : on rend aussitôt le verrou obtenu trop tard.
      if (!isWanted) {
        await releaseSentinel(sentinel);
        return;
      }
      wakeLockSentinel = sentinel;
    } catch (wakeLockError) {
      console.info('Écran allumé non disponible ici.', wakeLockError);
      wakeLockSentinel = null;
    }
  };

  const enable = async () => {
    if (!isWanted) {
      updateAndroidKeepScreenOn(1);
    }
    isWanted = true;
    visibilityController?.abort();
    visibilityController = new AbortController();
    // Le navigateur libère le verrou quand l'onglet est masqué : on le redemande au retour.
    document.addEventListener('visibilitychange', () => request(), { signal: visibilityController.signal });
    await request();
  };

  const disable = async () => {
    if (isWanted) {
      updateAndroidKeepScreenOn(-1);
    }
    isWanted = false;
    visibilityController?.abort();
    visibilityController = null;
    const sentinel = wakeLockSentinel;
    wakeLockSentinel = null;
    await releaseSentinel(sentinel);
  };

  return { enable, disable };
}
