// Service worker : l'appli reste utilisable sans réseau (dans le magasin, en cuisine).
// Changer CACHE_VERSION à chaque mise en ligne pour que les téléphones récupèrent la nouvelle version.
const CACHE_VERSION = 'semainier-v15';
const APP_SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/favicon-32.png',
  'js/app.js',
  'js/catalog.js',
  'js/cook-mode.js',
  'js/cooked-meals.js',
  'js/dom.js',
  'js/extra-items.js',
  'js/format.js',
  'js/install-prompt.js',
  'js/list-text.js',
  'js/meal-structure.js',
  'js/nutrition-facts.js',
  'js/nutrition.js',
  'js/planner.js',
  'js/preferences.js',
  'js/recipes.js',
  'js/render-weight.js',
  'js/render.js',
  'js/settings.js',
  'js/shopping-list.js',
  'js/stock.js',
  'js/storage.js',
  'js/store-setup.js',
  'js/undo-toast.js',
  'js/wake-lock.js',
  'js/week-history.js',
  'js/week.js',
  'js/weight-log.js'
];

// L'erreur est relancée pour que le navigateur abandonne l'installation et garde l'ancienne version.
async function precacheAppShell() {
  try {
    const appCache = await caches.open(CACHE_VERSION);
    await appCache.addAll(APP_SHELL);
  } catch (precacheError) {
    console.error('Mise en cache de l’appli impossible.', precacheError);
    throw precacheError;
  }
}

async function deleteOldCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter((cacheName) => cacheName !== CACHE_VERSION).map((cacheName) => caches.delete(cacheName)));
  } catch (cleanupError) {
    console.error('Suppression des anciens caches impossible.', cleanupError);
    throw cleanupError;
  }
}

// Un cache en panne (quota, stockage bloqué) ne doit jamais empêcher de servir le réseau :
// les lectures renvoient « rien » et les écritures sont abandonnées.
async function findInAppCache(cacheKey) {
  try {
    const appCache = await caches.open(CACHE_VERSION);
    return await appCache.match(cacheKey);
  } catch (cacheError) {
    console.warn('Lecture du cache impossible.', cacheError);
    return undefined;
  }
}

async function findInAnyCache(request) {
  try {
    return await caches.match(request);
  } catch (cacheError) {
    console.warn('Lecture du cache impossible.', cacheError);
    return undefined;
  }
}

async function storeInAppCache(cacheKey, response) {
  try {
    const appCache = await caches.open(CACHE_VERSION);
    await appCache.put(cacheKey, response);
  } catch (cacheError) {
    console.warn('Écriture dans le cache impossible.', cacheError);
  }
}

const MEDIA_PATH_PATTERN = /\/(images|icons)\//;

// GitHub Pages demande aux navigateurs de garder les fichiers 10 minutes : sans revalidation,
// une mise à jour publiée n'arriverait qu'après ce délai. « no-cache » redemande au serveur
// si le fichier a changé (réponse légère s'il est identique).
function fetchFresh(request) {
  // Une requête de navigation ne peut pas être recopiée avec des options : on repart de son adresse.
  if (request.mode === 'navigate') {
    return fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' });
  }
  return fetch(request, { cache: 'no-cache' });
}

// Page, scripts et styles : réseau d'abord, pour que la page et son code restent toujours
// de la même version ; la copie en cache ne sert que hors ligne.
async function respondNetworkFirst(request, cacheKey = request) {
  try {
    const networkResponse = await fetchFresh(request);
    if (networkResponse.ok) {
      await storeInAppCache(cacheKey, networkResponse.clone());
    }
    return networkResponse;
  } catch (networkError) {
    const cachedResponse = await findInAppCache(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw networkError;
  }
}

// Réseau faible en magasin : au-delà de ce délai, la page enregistrée s'ouvre sans attendre.
const NAVIGATION_TIMEOUT_MILLISECONDS = 3000;
// Une page servie depuis le cache charge ensuite tout son code depuis le cache, pour ne jamais
// mélanger l'ancienne page avec des scripts plus récents (imports introuvables).
const CACHED_PAGE_SESSION_MILLISECONDS = 60000;
let cachedPageSessionUntil = 0;

function createTimeout(delayMilliseconds) {
  let timeoutId = 0;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(null), delayMilliseconds);
  });
  return { timeoutPromise, timeoutId };
}

// Une requête abandonnée peut encore échouer plus tard : son erreur ne concerne plus personne.
async function ignoreFailure(abandonedPromise) {
  try {
    await abandonedPromise;
  } catch {
    // Rien à faire : la réponse a déjà été servie autrement.
  }
}

async function respondToNavigation(request) {
  const cachedPage = await findInAppCache('index.html');
  if (!cachedPage) {
    return respondNetworkFirst(request, 'index.html');
  }
  const networkAttempt = fetchFresh(request);
  const navigationTimeout = createTimeout(NAVIGATION_TIMEOUT_MILLISECONDS);
  try {
    const networkResponse = await Promise.race([networkAttempt, navigationTimeout.timeoutPromise]);
    if (networkResponse?.ok) {
      cachedPageSessionUntil = 0;
      await storeInAppCache('index.html', networkResponse.clone());
      return networkResponse;
    }
  } catch (networkError) {
    console.info('Réseau indisponible : page enregistrée.', networkError);
  } finally {
    clearTimeout(navigationTimeout.timeoutId);
  }
  // La réponse tardive n'est pas enregistrée : elle irait avec des scripts plus récents que ceux du cache.
  ignoreFailure(networkAttempt);
  cachedPageSessionUntil = Date.now() + CACHED_PAGE_SESSION_MILLISECONDS;
  return cachedPage;
}

async function respondFromCacheFirst(request) {
  const cachedResponse = await findInAnyCache(request);
  return cachedResponse ?? fetch(request);
}

// Hors ligne, l'ancienne copie reste la meilleure réponse ; sans copie, l'échec réseau est relancé.
async function fetchAndRefreshCache(request, cachedResponse) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await storeInAppCache(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (networkError) {
    if (!cachedResponse) {
      throw networkError;
    }
    return cachedResponse;
  }
}

// Photos et icônes : elles ne changent pas, la copie en cache est servie tout de suite.
async function respondFromCacheThenRefresh(request, backgroundTasks) {
  const cachedResponse = await findInAppCache(request);
  const networkUpdate = fetchAndRefreshCache(request, cachedResponse);
  if (cachedResponse) {
    backgroundTasks(ignoreFailure(networkUpdate));
    return cachedResponse;
  }
  return networkUpdate;
}

async function installNewVersion() {
  try {
    await precacheAppShell();
    await self.skipWaiting();
  } catch (installError) {
    console.error('Installation du service worker impossible.', installError);
    throw installError;
  }
}

async function activateNewVersion() {
  try {
    await deleteOldCaches();
    await self.clients.claim();
  } catch (activationError) {
    console.error('Activation du service worker impossible.', activationError);
    throw activationError;
  }
}

self.addEventListener('install', (installEvent) => {
  installEvent.waitUntil(installNewVersion());
});

self.addEventListener('activate', (activateEvent) => {
  activateEvent.waitUntil(activateNewVersion());
});

self.addEventListener('fetch', (fetchEvent) => {
  const { request } = fetchEvent;
  const isSameOrigin = new URL(request.url).origin === self.location.origin;
  // L'APK se télécharge une fois : inutile de l'ajouter au cache hors ligne.
  if (request.method !== 'GET' || !isSameOrigin || new URL(request.url).pathname.endsWith('.apk')) {
    return;
  }
  if (request.mode === 'navigate') {
    fetchEvent.respondWith(respondToNavigation(request));
    return;
  }
  if (MEDIA_PATH_PATTERN.test(new URL(request.url).pathname)) {
    fetchEvent.respondWith(respondFromCacheThenRefresh(request, (task) => fetchEvent.waitUntil(task)));
    return;
  }
  fetchEvent.respondWith(Date.now() < cachedPageSessionUntil ? respondFromCacheFirst(request) : respondNetworkFirst(request));
});
